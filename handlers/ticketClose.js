const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { getTicket, saveTicket, getPanel, deleteTicket } = require('../utils/dataManager');
const { canModerate, canAttend } = require('../utils/permissions');
const { errorEmbed } = require('../utils/embeds');
const { sendLog } = require('./ticketLog');
const { generateTranscript } = require('../utils/transcript');

/**
 * Inicia o processo de fechar ticket (pede confirmação / motivo)
 */
async function initiateClose(interaction, channelId) {
  const ticket = getTicket(channelId);
  if (!ticket) return interaction.reply({ embeds: [errorEmbed('Ticket não encontrado.')], ephemeral: true });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId) || {};

  // Tanto o abridor quanto a staff podem fechar
  const isOpener = ticket.openerId === member.id;
  const isStaff = canAttend(member, panel) || canModerate(member, panel);

  if (!isOpener && !isStaff) {
    return interaction.reply({ embeds: [errorEmbed('Você não tem permissão para fechar este ticket.')], ephemeral: true });
  }

  // Se precisa de motivo, abre modal
  if (panel.requireReason) {
    const modal = new ModalBuilder()
      .setCustomId(`ticket_close_modal_${channelId}`)
      .setTitle('Fechar Ticket');

    const reasonInput = new TextInputBuilder()
      .setCustomId('reason')
      .setLabel('Motivo do fechamento')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Descreva o motivo do fechamento...')
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  // Sem motivo: pede só confirmação
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('🔒 Fechar Ticket')
        .setDescription('Tem certeza que deseja fechar este ticket?')
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_close_confirm_${channelId}`)
          .setLabel('Confirmar')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ticket_close_cancel`)
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary)
      )
    ],
    ephemeral: true
  });
}

/**
 * Chamado quando o modal de motivo é submetido
 */
async function handleCloseModal(interaction, channelId) {
  const reason = interaction.fields.getTextInputValue('reason');
  await interaction.deferReply({ ephemeral: true });
  await closeTicket(interaction, channelId, reason);
}

/**
 * Confirma o fechamento (sem modal)
 */
async function confirmClose(interaction, channelId) {
  await interaction.deferUpdate();
  await closeTicket(interaction, channelId, null);
}

/**
 * Executa o fechamento do ticket
 */
async function closeTicket(interaction, channelId, reason) {
  const ticket = getTicket(channelId);
  if (!ticket) return;

  const panel = getPanel(ticket.panelId) || {};
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  // Atualiza status
  ticket.status = 'closed';
  ticket.closedBy = interaction.user.id;
  ticket.closedByTag = interaction.user.tag;
  ticket.closedAt = Date.now();
  ticket.closeReason = reason || null;
  saveTicket(channelId, ticket);

  // Avisa no canal
  const closeEmbed = new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle('🔒 Ticket Fechado')
    .addFields(
      { name: 'Fechado por', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    );

  if (reason) closeEmbed.addFields({ name: 'Motivo', value: reason });
  await channel.send({ embeds: [closeEmbed] });

  // Gera transcript
  let transcriptPath = null;
  try {
    transcriptPath = await generateTranscript(channel, ticket);
  } catch (err) {
    console.error('[Close] Erro ao gerar transcript:', err.message);
  }

  // Envia transcript ao log e DM
  await sendTranscript(interaction.client, ticket, panel, transcriptPath, reason);

  // Log
  if (panel.logChannelId) {
    await sendLog(interaction.client, panel.logChannelId, 'close', {
      ticket: `#${ticket.id}`,
      user: `<@${ticket.openerId}>`,
      staff: `<@${interaction.user.id}>`,
      panel: ticket.panelName,
      reason: reason || 'Não informado',
    });
  }

  // Arquiva ou deleta conforme config
  setTimeout(async () => {
    try {
      if (panel.archiveOnClose) {
        await archiveTicketChannel(channel, ticket, panel);
      } else {
        await channel.delete('Ticket fechado');
        deleteTicket(channelId);
      }
    } catch (err) {
      console.error('[Close] Erro ao finalizar canal:', err.message);
    }
  }, 5000);

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [{ color: 0x57F287, description: '✅ Ticket fechado com sucesso!' }] }).catch(() => {});
  }
}

async function archiveTicketChannel(channel, ticket, panel) {
  const { saveTicket } = require('../utils/dataManager');

  if (channel.isThread()) {
    await channel.setArchived(true);
  } else {
    // Move para categoria de arquivo se configurada
    if (panel.archiveCategoryId) {
      await channel.setParent(panel.archiveCategoryId, { lockPermissions: false });
    }
    // Remove permissão de enviar do abridor
    await channel.permissionOverwrites.edit(ticket.openerId, {
      SendMessages: false
    }).catch(() => {});

    await channel.setName(`fechado-${ticket.id}`).catch(() => {});
  }

  ticket.status = 'archived';
  saveTicket(ticket.channelId, ticket);
}

async function sendTranscript(client, ticket, panel, transcriptPath, reason) {
  if (!transcriptPath) return;

  const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
  const attachment = new AttachmentBuilder(transcriptPath, { name: `transcript-${ticket.id}.html` });

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`📄 Transcript — Ticket #${ticket.id}`)
    .addFields(
      { name: 'Aberto por', value: `<@${ticket.openerId}>`, inline: true },
      { name: 'Painel', value: ticket.panelName, inline: true },
    )
    .setTimestamp();

  if (reason) embed.addFields({ name: 'Motivo', value: reason });

  // Envia ao canal de log
  if (panel.logChannelId) {
    const logChannel = await client.channels.fetch(panel.logChannelId).catch(() => null);
    if (logChannel) await logChannel.send({ embeds: [embed], files: [attachment] }).catch(() => {});
  }

  // Envia DM ao usuário
  try {
    const opener = await client.users.fetch(ticket.openerId).catch(() => null);
    if (opener) {
      await opener.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setDescription(`📄 Seu ticket **#${ticket.id}** foi fechado. Segue o transcript.`)
        ],
        files: [new AttachmentBuilder(transcriptPath, { name: `transcript-${ticket.id}.html` })]
      }).catch(() => {});
    }
  } catch {}
}

module.exports = { initiateClose, handleCloseModal, confirmClose, closeTicket };
