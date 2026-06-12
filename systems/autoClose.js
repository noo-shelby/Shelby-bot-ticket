const cron = require('node-cron');
const { getTickets, getPanel } = require('../utils/dataManager');

let clientRef = null;

/**
 * Inicia o sistema de auto-fechamento
 * Verifica a cada 5 minutos tickets inativos
 */
function startAutoClose(client) {
  clientRef = client;

  cron.schedule('*/5 * * * *', async () => {
    await checkInactiveTickets();
  });

  console.log('[AutoClose] Sistema de auto-fechamento iniciado.');
}

async function checkInactiveTickets() {
  if (!clientRef) return;

  const tickets = getTickets();
  const now = Date.now();

  for (const [channelId, ticket] of Object.entries(tickets)) {
    if (ticket.status !== 'open') continue;

    const panel = getPanel(ticket.panelId);
    if (!panel || !panel.autoCloseMinutes) continue;

    const inactiveMs = panel.autoCloseMinutes * 60 * 1000;
    const lastActivity = ticket.lastActivity || ticket.createdAt;

    if (now - lastActivity >= inactiveMs) {
      await autoCloseTicket(channelId, ticket, panel);
    } else if (now - lastActivity >= inactiveMs * 0.75) {
      // Aviso quando estiver a 75% do tempo de inatividade
      await warnInactivity(channelId, ticket, panel, inactiveMs - (now - lastActivity));
    }
  }
}

async function warnInactivity(channelId, ticket, panel, remainingMs) {
  if (ticket.inactivityWarned) return;

  try {
    const channel = await clientRef.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const { EmbedBuilder } = require('discord.js');
    const minutes = Math.ceil(remainingMs / 60000);

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setDescription(`⚠️ Este ticket será fechado automaticamente por inatividade em **${minutes} minutos**.`)
      ]
    });

    const { saveTicket } = require('../utils/dataManager');
    ticket.inactivityWarned = true;
    saveTicket(channelId, ticket);
  } catch {}
}

async function autoCloseTicket(channelId, ticket, panel) {
  try {
    const { closeTicket } = require('../handlers/ticketClose');
    const channel = await clientRef.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    // Simula uma interação fake para o closeTicket
    const fakeInteraction = {
      client: clientRef,
      user: clientRef.user,
      deferred: true,
      replied: false,
      editReply: async () => {},
    };

    console.log(`[AutoClose] Fechando ticket #${ticket.id} por inatividade.`);
    await closeTicket(fakeInteraction, channelId, 'Fechado automaticamente por inatividade.');
  } catch (err) {
    console.error(`[AutoClose] Erro ao fechar ticket ${channelId}:`, err.message);
  }
}

/**
 * Atualiza o lastActivity de um ticket ao receber mensagem
 */
function updateActivity(channelId) {
  const { getTicket, saveTicket } = require('../utils/dataManager');
  const ticket = getTicket(channelId);
  if (!ticket || ticket.status !== 'open') return;

  ticket.lastActivity = Date.now();
  ticket.inactivityWarned = false;
  saveTicket(channelId, ticket);
}

module.exports = { startAutoClose, updateActivity };
