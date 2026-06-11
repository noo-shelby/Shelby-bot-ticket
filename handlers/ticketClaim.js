const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getTicket, saveTicket, getPanel } = require('../utils/dataManager');
const { canAttend } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { sendLog } = require('./ticketLog');

/**
 * Reivindica um ticket
 */
async function claimTicket(interaction, channelId) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = getTicket(channelId);
  if (!ticket) return interaction.editReply({ embeds: [errorEmbed('Ticket não encontrado.')] });
  if (ticket.status !== 'open') return interaction.editReply({ embeds: [errorEmbed('Este ticket não está aberto.')] });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId);

  if (!canAttend(member, panel || {})) {
    return interaction.editReply({ embeds: [errorEmbed('Você não tem permissão para reivindicar este ticket.')] });
  }

  if (ticket.claimedBy === member.id) {
    return interaction.editReply({ embeds: [errorEmbed('Você já reivindicou este ticket.')] });
  }

  // Atualiza ticket
  ticket.claimedBy = member.id;
  ticket.claimedByTag = member.user.tag;
  ticket.claimedAt = Date.now();
  saveTicket(channelId, ticket);

  // Atualiza msg inicial do ticket (edita embed para mostrar atendente)
  try {
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (channel) {
      const messages = await channel.messages.fetch({ limit: 10 });
      const botMsg = messages.find(m => m.author.id === interaction.client.user.id && m.components.length > 0);
      if (botMsg) {
        const newEmbed = EmbedBuilder.from(botMsg.embeds[0])
          .setFooter({ text: `Ticket #${ticket.id} • Atendente: ${member.user.tag}` });

        // Atualiza botão de reivindicar para "Reivindicado"
        const claimedBtn = new ButtonBuilder()
          .setCustomId(`ticket_claimed_disabled`)
          .setLabel(`Reivindicado por ${member.displayName}`)
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true);

        const closeBtn = new ButtonBuilder()
          .setCustomId(`ticket_close_${channelId}`)
          .setLabel('Fechar')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger);

        const modBtn = new ButtonBuilder()
          .setCustomId(`ticket_mod_menu_${channelId}`)
          .setLabel('Moderação')
          .setEmoji('⚙️')
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(closeBtn, claimedBtn, modBtn);
        await botMsg.edit({ embeds: [newEmbed], components: [row] });
      }
    }
  } catch (err) {
    console.error('[Claim] Erro ao editar msg inicial:', err.message);
  }

  // Remove botão de reivindicar da msg do canal staff
  await removeStaffClaimButton(interaction.client, ticket);

  // Notifica no canal do ticket
  try {
    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (channel) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00AFF4)
            .setDescription(`🙋 **${member.displayName}** reivindicou este ticket e será seu atendente.`)
        ]
      });
    }
  } catch {}

  // Log
  if (panel?.logChannelId) {
    await sendLog(interaction.client, panel.logChannelId, 'claim', {
      ticket: `<#${channelId}> (#${ticket.id})`,
      user: `<@${ticket.openerId}>`,
      staff: `<@${member.id}> (${member.user.tag})`,
      panel: ticket.panelName,
    });
  }

  await interaction.editReply({ embeds: [successEmbed('Ticket reivindicado com sucesso!')] });
}

/**
 * Remove o botão de reivindicar da mensagem do canal staff
 */
async function removeStaffClaimButton(client, ticket) {
  if (!ticket.staffChannelId || !ticket.staffMessageId) return;
  try {
    const staffChannel = await client.channels.fetch(ticket.staffChannelId).catch(() => null);
    if (!staffChannel) return;

    const staffMsg = await staffChannel.messages.fetch(ticket.staffMessageId).catch(() => null);
    if (!staffMsg) return;

    const goBtn = new ButtonBuilder()
      .setLabel('Ir ao Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${ticket.guildId}/${ticket.channelId}`);

    const claimedBtn = new ButtonBuilder()
      .setCustomId('staff_claimed_disabled')
      .setLabel('Ticket Reivindicado')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);

    const row = new ActionRowBuilder().addComponents(claimedBtn, goBtn);

    const newEmbed = EmbedBuilder.from(staffMsg.embeds[0])
      .setColor(0x57F287)
      .setFooter({ text: `Reivindicado por ${ticket.claimedByTag}` });

    await staffMsg.edit({ embeds: [newEmbed], components: [row] });
  } catch (err) {
    console.error('[Claim] Erro ao atualizar msg staff:', err.message);
  }
}

module.exports = { claimTicket, removeStaffClaimButton };
