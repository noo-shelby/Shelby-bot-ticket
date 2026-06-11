const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getTicket, saveTicket, getPanel } = require('../utils/dataManager');
const { canAttend } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { sendLog } = require('./ticketLog');

/**
 * Solicita re-reivindicação (troca de atendente)
 */
async function requestReclaim(interaction, channelId) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = getTicket(channelId);
  if (!ticket) return interaction.editReply({ embeds: [errorEmbed('Ticket não encontrado.')] });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId) || {};

  if (!canAttend(member, panel)) {
    return interaction.editReply({ embeds: [errorEmbed('Você não tem permissão para solicitar re-reivindicação.')] });
  }

  // Notifica no canal de re-reivindicação
  if (panel.reclaimChannelId) {
    try {
      const reclaimChannel = await interaction.client.channels.fetch(panel.reclaimChannelId).catch(() => null);
      if (reclaimChannel) {
        const goBtn = new ButtonBuilder()
          .setLabel('Ir ao Ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${ticket.guildId}/${channelId}`);

        const claimBtn = new ButtonBuilder()
          .setCustomId(`ticket_claim_${channelId}`)
          .setLabel('Reivindicar')
          .setEmoji('🙋')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(claimBtn, goBtn);

        await reclaimChannel.send({
          content: (panel.staffRoles || []).map(r => `<@&${r}>`).join(' '),
          embeds: [
            new EmbedBuilder()
              .setColor(0xEB459E)
              .setTitle('🔄 Solicitação de Re-Reivindicação')
              .setDescription(`O atendente <@${member.id}> está solicitando troca no ticket **#${ticket.id}**.`)
              .addFields(
                { name: 'Ticket', value: `<#${channelId}>`, inline: true },
                { name: 'Atendente atual', value: `<@${member.id}>`, inline: true },
                { name: 'Usuário', value: `<@${ticket.openerId}>`, inline: true },
              )
              .setTimestamp()
          ],
          components: [row],
        });
      }
    } catch (err) {
      console.error('[Reclaim] Erro ao notificar canal:', err.message);
    }
  }

  // Notifica no canal do ticket
  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (channel) {
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xEB459E)
          .setDescription(`🔄 <@${member.id}> solicitou troca de atendente. Aguardando nova reivindicação.`)
      ]
    }).catch(() => {});
  }

  // Remove reivindicação atual
  ticket.claimedBy = null;
  ticket.claimedByTag = null;
  saveTicket(channelId, ticket);

  // Log
  if (panel.logChannelId) {
    await sendLog(interaction.client, panel.logChannelId, 'reclaim', {
      ticket: `<#${channelId}> (#${ticket.id})`,
      staff: `<@${member.id}> (${member.user.tag})`,
      panel: ticket.panelName,
    });
  }

  await interaction.editReply({ embeds: [successEmbed('Solicitação de re-reivindicação enviada!')] });
}

/**
 * Solicita auxiliar
 */
async function requestAuxiliar(interaction, channelId) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = getTicket(channelId);
  if (!ticket) return interaction.editReply({ embeds: [errorEmbed('Ticket não encontrado.')] });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId) || {};

  if (!canAttend(member, panel)) {
    return interaction.editReply({ embeds: [errorEmbed('Você não tem permissão para solicitar auxiliar.')] });
  }

  if (panel.auxChannelId) {
    try {
      const auxChannel = await interaction.client.channels.fetch(panel.auxChannelId).catch(() => null);
      if (auxChannel) {
        const goBtn = new ButtonBuilder()
          .setLabel('Ir ao Ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${ticket.guildId}/${channelId}`);

        const row = new ActionRowBuilder().addComponents(goBtn);

        await auxChannel.send({
          content: (panel.staffRoles || []).map(r => `<@&${r}>`).join(' '),
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF4500)
              .setTitle('🆘 Solicitação de Auxiliar')
              .setDescription(`O atendente <@${member.id}> precisa de ajuda no ticket **#${ticket.id}**!`)
              .addFields(
                { name: 'Ticket', value: `<#${channelId}>`, inline: true },
                { name: 'Atendente', value: `<@${member.id}>`, inline: true },
                { name: 'Usuário', value: `<@${ticket.openerId}>`, inline: true },
              )
              .setTimestamp()
          ],
          components: [row],
        });
      }
    } catch (err) {
      console.error('[Auxiliar] Erro ao notificar canal:', err.message);
    }
  }

  await interaction.editReply({ embeds: [successEmbed('Solicitação de auxiliar enviada!')] });
}

module.exports = { requestReclaim, requestAuxiliar };
