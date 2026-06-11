const { EmbedBuilder } = require('discord.js');

const LOG_COLORS = {
  create:    0x57F287,
  close:     0xFF4444,
  archive:   0xFEE75C,
  unarchive: 0x5865F2,
  claim:     0x00AFF4,
  reclaim:   0xEB459E,
  finalize:  0xFF7043,
  add_member:    0x57F287,
  remove_member: 0xFF4444,
  config_change: 0x9B59B6,
  transcript:    0x3498DB,
};

const LOG_EMOJIS = {
  create:    '🎫',
  close:     '🔒',
  archive:   '📦',
  unarchive: '📂',
  claim:     '🙋',
  reclaim:   '🔄',
  finalize:  '✅',
  add_member:    '➕',
  remove_member: '➖',
  config_change: '⚙️',
  transcript:    '📄',
};

/**
 * Envia uma mensagem de log para o canal configurado
 * @param {Client} client
 * @param {string} guildId
 * @param {string} logChannelId
 * @param {string} type - tipo do evento
 * @param {Object} fields - campos do embed
 */
async function sendLog(client, logChannelId, type, fields = {}) {
  if (!logChannelId) return;

  try {
    const channel = await client.channels.fetch(logChannelId).catch(() => null);
    if (!channel) return;

    const emoji = LOG_EMOJIS[type] || '📋';
    const color = LOG_COLORS[type] || 0x5865F2;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} ${formatTitle(type)}`)
      .setTimestamp();

    if (fields.ticket)   embed.addFields({ name: 'Ticket', value: fields.ticket, inline: true });
    if (fields.user)     embed.addFields({ name: 'Usuário', value: fields.user, inline: true });
    if (fields.staff)    embed.addFields({ name: 'Staff', value: fields.staff, inline: true });
    if (fields.panel)    embed.addFields({ name: 'Painel', value: fields.panel, inline: true });
    if (fields.reason)   embed.addFields({ name: 'Motivo', value: fields.reason });
    if (fields.extra)    embed.addFields({ name: 'Info', value: fields.extra });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Log] Erro ao enviar log:', err.message);
  }
}

function formatTitle(type) {
  const titles = {
    create:    'Ticket Criado',
    close:     'Ticket Fechado',
    archive:   'Ticket Arquivado',
    unarchive: 'Ticket Desarquivado',
    claim:     'Ticket Reivindicado',
    reclaim:   'Re-Reivindicação',
    finalize:  'Ticket Finalizado',
    add_member:    'Membro Adicionado',
    remove_member: 'Membro Removido',
    config_change: 'Configuração Alterada',
    transcript:    'Transcript Gerado',
  };
  return titles[type] || type;
}

module.exports = { sendLog };
