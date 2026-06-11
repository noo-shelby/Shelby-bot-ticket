require('dotenv').config();
const { REST, Routes } = require('discord.js');
const commands = require('./commands/index');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`[Deploy] Registrando ${commands.length} comandos...`);

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('[Deploy] Comandos registrados com sucesso!');
  } catch (err) {
    console.error('[Deploy] Erro:', err);
  }
})();
