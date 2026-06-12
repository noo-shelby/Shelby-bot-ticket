const fs = require('fs');
const path = require('path');

/**
 * Gera um transcript HTML de um canal/tópico de ticket
 * @param {TextChannel|ThreadChannel} channel
 * @param {Object} ticketData
 * @returns {string} caminho do arquivo gerado
 */
async function generateTranscript(channel, ticketData) {
  const messages = await fetchAllMessages(channel);

  const html = buildHTML(channel, ticketData, messages);

  const dir = path.join(__dirname, '../data/transcripts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `transcript-${ticketData.id}-${Date.now()}.html`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, html);

  return filepath;
}

async function fetchAllMessages(channel) {
  const messages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;

    messages.push(...batch.values());
    lastId = batch.last().id;

    if (batch.size < 100) break;
  }

  return messages.reverse();
}

function buildHTML(channel, ticketData, messages) {
  const rows = messages.map(msg => {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 32 });
    const time = new Date(msg.createdTimestamp).toLocaleString('pt-BR');
    const content = escapeHTML(msg.content || '');
    const attachments = msg.attachments.map(a =>
      a.contentType?.startsWith('image/')
        ? `<img src="${a.url}" class="attachment-img" alt="attachment">`
        : `<a href="${a.url}" target="_blank" class="attachment-link">📎 ${a.name}</a>`
    ).join('');

    const embeds = msg.embeds.map(e => {
      let embedHtml = '<div class="embed">';
      if (e.title) embedHtml += `<div class="embed-title">${escapeHTML(e.title)}</div>`;
      if (e.description) embedHtml += `<div class="embed-desc">${escapeHTML(e.description)}</div>`;
      embedHtml += '</div>';
      return embedHtml;
    }).join('');

    return `
      <div class="message ${msg.author.bot ? 'bot-message' : ''}">
        <img src="${avatar}" class="avatar" alt="avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <div class="msg-content">
          <div class="msg-header">
            <span class="username ${msg.author.bot ? 'bot-tag' : ''}">${escapeHTML(msg.author.username)}</span>
            ${msg.author.bot ? '<span class="badge">BOT</span>' : ''}
            <span class="timestamp">${time}</span>
          </div>
          <div class="msg-text">${content}</div>
          ${attachments}
          ${embeds}
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript — ${escapeHTML(channel.name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #313338; color: #dcddde; font-family: 'gg sans', 'Noto Sans', sans-serif; font-size: 14px; }
    .header { background: #232428; padding: 20px 30px; border-bottom: 2px solid #5865F2; display: flex; align-items: center; gap: 16px; }
    .header h1 { font-size: 20px; color: #fff; }
    .header .meta { color: #96989d; font-size: 13px; margin-top: 4px; }
    .header .badge-ticket { background: #5865F2; color: #fff; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .stats { background: #2b2d31; padding: 12px 30px; display: flex; gap: 30px; border-bottom: 1px solid #1e1f22; }
    .stat { display: flex; flex-direction: column; }
    .stat-label { font-size: 11px; color: #96989d; text-transform: uppercase; letter-spacing: .5px; }
    .stat-value { font-size: 15px; color: #fff; font-weight: 600; margin-top: 2px; }
    .messages { padding: 20px 30px; max-width: 900px; margin: 0 auto; }
    .message { display: flex; gap: 12px; padding: 8px 0; transition: background .1s; }
    .message:hover { background: #2e3035; border-radius: 6px; padding: 8px 8px; margin: 0 -8px; }
    .bot-message .username { color: #5865F2; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; margin-top: 2px; }
    .msg-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
    .username { font-weight: 600; color: #fff; font-size: 15px; }
    .badge { background: #5865F2; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; }
    .timestamp { color: #96989d; font-size: 12px; }
    .msg-text { line-height: 1.5; color: #dcddde; white-space: pre-wrap; word-break: break-word; }
    .attachment-img { max-width: 400px; max-height: 300px; border-radius: 6px; margin-top: 8px; display: block; }
    .attachment-link { color: #00aff4; text-decoration: none; display: inline-block; margin-top: 6px; }
    .embed { background: #2b2d31; border-left: 4px solid #5865F2; border-radius: 0 4px 4px 0; padding: 10px 14px; margin-top: 8px; }
    .embed-title { font-weight: 700; color: #fff; margin-bottom: 4px; }
    .embed-desc { color: #dcddde; font-size: 13px; }
    .footer { text-align: center; padding: 30px; color: #4f545c; font-size: 12px; border-top: 1px solid #1e1f22; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="display:flex;align-items:center;gap:10px;">
        <h1>#${escapeHTML(channel.name)}</h1>
        <span class="badge-ticket">Ticket #${ticketData.id}</span>
      </div>
      <div class="meta">Aberto por ${escapeHTML(ticketData.openerTag || 'Desconhecido')} • ${new Date(ticketData.createdAt).toLocaleString('pt-BR')}</div>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><span class="stat-label">Total de mensagens</span><span class="stat-value">${messages.length}</span></div>
    <div class="stat"><span class="stat-label">Atendente</span><span class="stat-value">${escapeHTML(ticketData.claimedByTag || 'Não reivindicado')}</span></div>
    <div class="stat"><span class="stat-label">Painel</span><span class="stat-value">${escapeHTML(ticketData.panelName || '—')}</span></div>
    <div class="stat"><span class="stat-label">Status</span><span class="stat-value">Fechado</span></div>
  </div>
  <div class="messages">
    ${rows}
  </div>
  <div class="footer">Gerado automaticamente pelo sistema de tickets</div>
</body>
</html>`;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { generateTranscript };
