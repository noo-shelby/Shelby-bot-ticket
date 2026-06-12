const {
  ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const { saveTicket, getTickets, getTicket } = require('../utils/dataManager');
const { isBlacklisted } = require('../utils/blacklist');
const { ticketButtons, errorEmbed } = require('../utils/embeds');
const { sendLog } = require('./ticketLog');

function getNextTicketId(guildId) {
  const tickets = getTickets();
  const guildTickets = Object.values(tickets).filter(t => t.guildId === guildId);
  return (guildTickets.length + 1).toString().padStart(4, '0');
}

async function createTicket(interaction, panelConfig, panelId, optionLabel = '') {
  await interaction.deferReply({ ephemeral: true });

  const { guild, user } = interaction;

  // Blacklist
  if (panelConfig.useBlacklist && isBlacklisted(guild.id, user.id)) {
    return interaction.editReply({ embeds: [errorEmbed('Você está na blacklist e não pode abrir tickets.')] });
  }

  // Ticket já aberto
  const tickets = getTickets();
  const existing = Object.values(tickets).find(
    t => t.guildId === guild.id && t.openerId === user.id &&
         t.panelId === panelId && (t.status === 'open' || t.status === 'pending_review')
  );
  if (existing) {
    return interaction.editReply({ embeds: [errorEmbed(`Você já possui um ticket aberto: <#${existing.channelId}>`)] });
  }

  const ticketId = getNextTicketId(guild.id);
  const ticketName = `ticket-${ticketId}`;

  try {
    let ticketChannel;

    const basePerms = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: interaction.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles],
      },
    ];

    const staffRoles = [...(panelConfig.staffRoles || []), ...(panelConfig.modRoles || [])];
    for (const roleId of staffRoles) {
      basePerms.push({
        id: roleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      });
    }

    if (panelConfig.channelType === 'thread') {
      // Tópico de fórum
      if (!panelConfig.forumChannelId) {
        return interaction.editReply({ embeds: [errorEmbed('Canal de fórum não configurado no painel. Configure o ID do fórum.')] });
      }
      const forumChannel = guild.channels.cache.get(panelConfig.forumChannelId);
      if (!forumChannel) {
        return interaction.editReply({ embeds: [errorEmbed('Canal de fórum não encontrado. Verifique o ID configurado no painel.')] });
      }
      const thread = await forumChannel.threads.create({
        name: ticketName,
        message: { content: `Ticket aberto por <@${user.id}>` },
      });
      ticketChannel = thread;
    } else {
      // Canal de texto
      const category = panelConfig.categoryId
        ? guild.channels.cache.get(panelConfig.categoryId)
        : null;

      ticketChannel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: category || null,
        permissionOverwrites: basePerms,
        topic: `Ticket de ${user.tag} | Painel: ${panelConfig.name || panelId}`,
      });
    }

    const ticketData = {
      id: ticketId,
      guildId: guild.id,
      channelId: ticketChannel.id,
      openerId: user.id,
      openerTag: user.tag,
      panelId,
      panelName: panelConfig.name || panelId,
      optionLabel,
      status: 'open',
      claimedBy: null,
      claimedByTag: null,
      staffMessageId: null,
      staffChannelId: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      inactivityWarned: false,
    };

    saveTicket(ticketChannel.id, ticketData);

    // Mensagem inicial
    const openEmbed = new EmbedBuilder()
      .setColor(panelConfig.color || 0x5865F2)
      .setTitle(panelConfig.ticketTitle || `Ticket #${ticketId}`)
      .setDescription(
        (panelConfig.ticketDescription || `Olá ${user}, obrigado por abrir um ticket!\nAguarde, em breve um membro da staff irá atendê-lo.`)
          .replace('{user}', `${user}`)
          .replace('{ticket}', `#${ticketId}`)
          .replace('{option}', optionLabel)
      )
      .setFooter({ text: `Ticket #${ticketId}${optionLabel ? ` • ${optionLabel}` : ''}` })
      .setTimestamp();

    const row = ticketButtons(ticketChannel.id);
    await ticketChannel.send({ content: `${user}`, embeds: [openEmbed], components: [row] });

    // Notifica canal staff
    if (panelConfig.staffChannelId) {
      await notifyStaff(interaction.client, panelConfig, ticketData, ticketChannel);
    }

    // Log
    if (panelConfig.logChannelId) {
      await sendLog(interaction.client, panelConfig.logChannelId, 'create', {
        ticket: `<#${ticketChannel.id}> (#${ticketId})`,
        user: `<@${user.id}> (${user.tag})`,
        panel: panelConfig.name || panelId,
        extra: optionLabel ? `Opção: ${optionLabel}` : null,
      });
    }

    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ Seu ticket foi criado: <#${ticketChannel.id}>`)],
    });

  } catch (err) {
    console.error('[TicketCreate] Erro:', err);
    await interaction.editReply({ embeds: [errorEmbed(`Erro ao criar o ticket: ${err.message}`)] });
  }
}

async function notifyStaff(client, panelConfig, ticketData, ticketChannel) {
  try {
    const staffChannel = await client.channels.fetch(panelConfig.staffChannelId).catch(() => null);
    if (!staffChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎫 Novo Ticket Aberto')
      .addFields(
        { name: 'Ticket', value: `<#${ticketChannel.id}> (#${ticketData.id})`, inline: true },
        { name: 'Usuário', value: `<@${ticketData.openerId}>`, inline: true },
        { name: 'Painel', value: ticketData.panelName, inline: true },
      )
      .setTimestamp();

    if (ticketData.optionLabel) {
      embed.addFields({ name: 'Categoria', value: ticketData.optionLabel, inline: true });
    }

    const goBtn = new ButtonBuilder()
      .setLabel('Ir ao Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${ticketData.guildId}/${ticketChannel.id}`);

    const claimBtn = new ButtonBuilder()
      .setCustomId(`ticket_claim_${ticketChannel.id}`)
      .setLabel('Reivindicar')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(claimBtn, goBtn);

    const staffMsg = await staffChannel.send({
      content: panelConfig.staffRoles?.map(r => `<@&${r}>`).join(' ') || '',
      embeds: [embed],
      components: [row],
    });

    // Salva staffMessageId
    const { saveTicket, getTicket } = require('../utils/dataManager');
    const tData = getTicket(ticketChannel.id);
    if (tData) {
      tData.staffMessageId = staffMsg.id;
      tData.staffChannelId = staffChannel.id;
      saveTicket(ticketChannel.id, tData);
    }
  } catch (err) {
    console.error('[NotifyStaff] Erro:', err.message);
  }
}

module.exports = { createTicket };
