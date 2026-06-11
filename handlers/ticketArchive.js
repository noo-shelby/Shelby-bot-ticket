const { EmbedBuilder } = require('discord.js');
const { getTicket, saveTicket, getPanel } = require('../utils/dataManager');
const { canModerate } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { sendLog } = require('./ticketLog');

async function archiveTicket(interaction, channelId) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = getTicket(channelId);
  if (!ticket) return interaction.editReply({ embeds: [errorEmbed('Ticket não encontrado.')] });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId) || {};

  if (!canModerate(member, panel)) {
    return interaction.editReply({ embeds: [errorEmbed('Você não tem permissão para arquivar este ticket.')] });
  }

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) return interaction.editReply({ embeds: [errorEmbed('Canal não encontrado.')] });

  try {
    if (channel.isThread()) {
      await channel.setArchived(true);
    } else {
      if (panel.archiveCategoryId) {
        await channel.setParent(panel.archiveCategoryId, { lockPermissions: false });
      }
      await channel.permissionOverwrites.edit(ticket.openerId, { SendMessages: false }).catch(() => {});
      await channel.setName(`arquivado-${ticket.id}`).catch(() => {});
    }

    ticket.status = 'archived';
    ticket.archivedBy = member.id;
    ticket.archivedAt = Date.now();
    saveTicket(channelId, ticket);

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setDescription(`📦 Ticket arquivado por <@${member.id}>.`)
      ]
    });

    if (panel.logChannelId) {
      await sendLog(interaction.client, panel.logChannelId, 'archive', {
        ticket: `#${ticket.id}`,
        user: `<@${ticket.openerId}>`,
        staff: `<@${member.id}>`,
        panel: ticket.panelName,
      });
    }

    await interaction.editReply({ embeds: [successEmbed('Ticket arquivado com sucesso!')] });
  } catch (err) {
    console.error('[Archive]', err);
    await interaction.editReply({ embeds: [errorEmbed('Erro ao arquivar o ticket.')] });
  }
}

async function unarchiveTicket(interaction, channelId) {
  await interaction.deferReply({ ephemeral: true });

  const ticket = getTicket(channelId);
  if (!ticket) return interaction.editReply({ embeds: [errorEmbed('Ticket não encontrado.')] });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId) || {};

  if (!canModerate(member, panel)) {
    return interaction.editReply({ embeds: [errorEmbed('Você não tem permissão para desarquivar este ticket.')] });
  }

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) return interaction.editReply({ embeds: [errorEmbed('Canal não encontrado.')] });

  try {
    if (channel.isThread()) {
      await channel.setArchived(false);
    } else {
      await channel.permissionOverwrites.edit(ticket.openerId, { SendMessages: true }).catch(() => {});
      await channel.setName(`ticket-${ticket.id}`).catch(() => {});
    }

    ticket.status = 'open';
    ticket.archivedBy = null;
    ticket.archivedAt = null;
    saveTicket(channelId, ticket);

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription(`📂 Ticket desarquivado por <@${member.id}>.`)
      ]
    });

    if (panel.logChannelId) {
      await sendLog(interaction.client, panel.logChannelId, 'unarchive', {
        ticket: `#${ticket.id}`,
        user: `<@${ticket.openerId}>`,
        staff: `<@${member.id}>`,
        panel: ticket.panelName,
      });
    }

    await interaction.editReply({ embeds: [successEmbed('Ticket desarquivado com sucesso!')] });
  } catch (err) {
    console.error('[Unarchive]', err);
    await interaction.editReply({ embeds: [errorEmbed('Erro ao desarquivar o ticket.')] });
  }
}

module.exports = { archiveTicket, unarchiveTicket };
