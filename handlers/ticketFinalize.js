const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getTicket, saveTicket, getPanel } = require('../utils/dataManager');
const { canAttend } = require('../utils/permissions');
const { errorEmbed } = require('../utils/embeds');
const { sendLog } = require('./ticketLog');

/**
 * Finaliza o ticket: remove o usuário e pinga a moderação para revisão
 */
async function finalizeTicket(interaction, channelId) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = getTicket(channelId);
  if (!ticket) return interaction.editReply({ embeds: [errorEmbed('Ticket não encontrado.')] });
  if (ticket.status !== 'open') return interaction.editReply({ embeds: [errorEmbed('Este ticket não está aberto.')] });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId) || {};

  if (!canAttend(member, panel)) {
    return interaction.editReply({ embeds: [errorEmbed('Você não tem permissão para finalizar este ticket.')] });
  }

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) return interaction.editReply({ embeds: [errorEmbed('Canal não encontrado.')] });

  // Remove o usuário abridor do canal
  try {
    if (channel.isThread()) {
      await channel.members.remove(ticket.openerId);
    } else {
      await channel.permissionOverwrites.edit(ticket.openerId, {
        ViewChannel: false,
        SendMessages: false,
      });
    }
  } catch (err) {
    console.error('[Finalize] Erro ao remover usuário:', err.message);
  }

  // Atualiza ticket
  ticket.status = 'pending_review';
  ticket.finalizedBy = member.id;
  ticket.finalizedByTag = member.user.tag;
  ticket.finalizedAt = Date.now();
  saveTicket(channelId, ticket);

  // Monta a mensagem de revisão para a moderação
  const reviewMsg = (panel.reviewMessage || '🔔 Este ticket foi finalizado e aguarda revisão.')
    .replace('{user}', `<@${ticket.openerId}>`)
    .replace('{staff}', `<@${member.id}>`)
    .replace('{ticket}', `#${ticket.id}`);

  const modMention = (panel.reviewRoles || []).map(r => `<@&${r}>`).join(' ') || '';

  const embed = new EmbedBuilder()
    .setColor(0xFF7043)
    .setTitle('✅ Ticket Finalizado — Aguardando Revisão')
    .setDescription(reviewMsg)
    .addFields(
      { name: 'Finalizado por', value: `<@${member.id}>`, inline: true },
      { name: 'Usuário removido', value: `<@${ticket.openerId}>`, inline: true },
    )
    .setTimestamp();

  // Botões de ação para a moderação
  const closeBtn = new ButtonBuilder()
    .setCustomId(`ticket_close_${channelId}`)
    .setLabel('Fechar Ticket')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const archiveBtn = new ButtonBuilder()
    .setCustomId(`ticket_archive_${channelId}`)
    .setLabel('Arquivar')
    .setEmoji('📦')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(closeBtn, archiveBtn);

  await channel.send({
    content: modMention,
    embeds: [embed],
    components: [row],
  });

  // Log
  if (panel.logChannelId) {
    await sendLog(interaction.client, panel.logChannelId, 'finalize', {
      ticket: `<#${channelId}> (#${ticket.id})`,
      user: `<@${ticket.openerId}>`,
      staff: `<@${member.id}> (${member.user.tag})`,
      panel: ticket.panelName,
    });
  }

  await interaction.editReply({ embeds: [{ color: 0x57F287, description: '✅ Ticket finalizado! A moderação foi notificada.' }] });
}

module.exports = { finalizeTicket };
