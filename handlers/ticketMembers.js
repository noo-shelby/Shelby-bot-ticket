const {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits
} = require('discord.js');
const { getTicket, getPanel } = require('../utils/dataManager');
const { canAttend } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { sendLog } = require('./ticketLog');

/**
 * Abre modal para adicionar membro
 */
async function showAddMemberModal(interaction, channelId) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_add_member_submit_${channelId}`)
    .setTitle('Adicionar Membro');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('ID do usuário')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Cole o ID do usuário aqui...')
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

/**
 * Abre modal para remover membro
 */
async function showRemoveMemberModal(interaction, channelId) {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_remove_member_submit_${channelId}`)
    .setTitle('Remover Membro');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('user_id')
        .setLabel('ID do usuário')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Cole o ID do usuário aqui...')
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

/**
 * Processa adição de membro
 */
async function addMember(interaction, channelId) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.fields.getTextInputValue('user_id').trim();
  const ticket = getTicket(channelId);
  if (!ticket) return interaction.editReply({ embeds: [errorEmbed('Ticket não encontrado.')] });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId) || {};

  if (!canAttend(member, panel)) {
    return interaction.editReply({ embeds: [errorEmbed('Você não tem permissão para adicionar membros.')] });
  }

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) return interaction.editReply({ embeds: [errorEmbed('Canal não encontrado.')] });

  try {
    const targetUser = await interaction.client.users.fetch(userId).catch(() => null);
    if (!targetUser) return interaction.editReply({ embeds: [errorEmbed('Usuário não encontrado. Verifique o ID.')] });

    if (channel.isThread()) {
      await channel.members.add(userId);
    } else {
      await channel.permissionOverwrites.create(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
    }

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(`➕ <@${userId}> foi adicionado ao ticket por <@${member.id}>.`)
      ]
    });

    if (panel.logChannelId) {
      await sendLog(interaction.client, panel.logChannelId, 'add_member', {
        ticket: `#${ticket.id}`,
        user: `<@${userId}> (${targetUser.tag})`,
        staff: `<@${member.id}>`,
        panel: ticket.panelName,
      });
    }

    await interaction.editReply({ embeds: [successEmbed(`<@${userId}> adicionado com sucesso!`)] });
  } catch (err) {
    console.error('[AddMember]', err);
    await interaction.editReply({ embeds: [errorEmbed('Erro ao adicionar o membro.')] });
  }
}

/**
 * Processa remoção de membro
 */
async function removeMember(interaction, channelId) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.fields.getTextInputValue('user_id').trim();
  const ticket = getTicket(channelId);
  if (!ticket) return interaction.editReply({ embeds: [errorEmbed('Ticket não encontrado.')] });

  const member = interaction.member;
  const panel = getPanel(ticket.panelId) || {};

  if (!canAttend(member, panel)) {
    return interaction.editReply({ embeds: [errorEmbed('Você não tem permissão para remover membros.')] });
  }

  if (userId === ticket.openerId) {
    return interaction.editReply({ embeds: [errorEmbed('Não é possível remover o dono do ticket.')] });
  }

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) return interaction.editReply({ embeds: [errorEmbed('Canal não encontrado.')] });

  try {
    const targetUser = await interaction.client.users.fetch(userId).catch(() => null);

    if (channel.isThread()) {
      await channel.members.remove(userId);
    } else {
      await channel.permissionOverwrites.delete(userId);
    }

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF4444)
          .setDescription(`➖ <@${userId}> foi removido do ticket por <@${member.id}>.`)
      ]
    });

    if (panel.logChannelId) {
      await sendLog(interaction.client, panel.logChannelId, 'remove_member', {
        ticket: `#${ticket.id}`,
        user: targetUser ? `<@${userId}> (${targetUser.tag})` : `<@${userId}>`,
        staff: `<@${member.id}>`,
        panel: ticket.panelName,
      });
    }

    await interaction.editReply({ embeds: [successEmbed(`Membro removido com sucesso!`)] });
  } catch (err) {
    console.error('[RemoveMember]', err);
    await interaction.editReply({ embeds: [errorEmbed('Erro ao remover o membro.')] });
  }
}

module.exports = { showAddMemberModal, showRemoveMemberModal, addMember, removeMember };
