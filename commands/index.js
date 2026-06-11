const { SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('criar-painel')
    .setDescription('Cria um novo painel de tickets interativamente.')
    .setDefaultMemberPermissions(0x20), // MANAGE_GUILD

  new SlashCommandBuilder()
    .setName('editar-painel')
    .setDescription('Edita, envia ou deleta painéis de tickets salvos.')
    .setDefaultMemberPermissions(0x20),

  new SlashCommandBuilder()
    .setName('enviar-painel')
    .setDescription('Envia um painel salvo para um canal.')
    .setDefaultMemberPermissions(0x20)
    .addStringOption(opt =>
      opt.setName('painel')
        .setDescription('ID do painel a enviar')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Gerencia a blacklist de tickets.')
    .setDefaultMemberPermissions(0x20)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Adiciona usuário à blacklist')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuário').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove usuário da blacklist')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuário').setRequired(true))
    ),
];

module.exports = commands.map(c => c.toJSON());
