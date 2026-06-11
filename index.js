require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const keepAlive = require('./keep-alive');
const { handleInteraction } = require('./handlers/interactionCreate');
const { startAutoClose, updateActivity } = require('./systems/autoClose');

// ── CLIENT ──
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ── READY ──
client.once('ready', () => {
  console.log(`[Bot] Logado como ${client.user.tag}`);
  console.log(`[Bot] Servidores: ${client.guilds.cache.size}`);
  startAutoClose(client);
});

// ── INTERACTIONS ──
client.on('interactionCreate', async (interaction) => {
  await handleInteraction(interaction);
});

// ── MENSAGENS (atualiza lastActivity) ──
client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  if (message.channel) {
    updateActivity(message.channel.id);
  }
});

// ── ERROR HANDLING ──
client.on('error', (err) => console.error('[Client Error]', err));
process.on('unhandledRejection', (err) => console.error('[UnhandledRejection]', err));

// ── KEEP ALIVE (Render) ──
keepAlive();

// ── LOGIN ──
client.login(process.env.DISCORD_TOKEN);
