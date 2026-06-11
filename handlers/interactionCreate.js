const { createTicket } = require('./ticketCreate');
const { claimTicket } = require('./ticketClaim');
const { initiateClose, handleCloseModal, confirmClose } = require('./ticketClose');
const { archiveTicket, unarchiveTicket } = require('./ticketArchive');
const { finalizeTicket } = require('./ticketFinalize');
const { showAddMemberModal, showRemoveMemberModal, addMember, removeMember } = require('./ticketMembers');
const { requestReclaim, requestAuxiliar } = require('./ticketReclaim');
const { handleBuilderInteraction } = require('../systems/panelBuilder');
const { handleEditorInteraction } = require('../systems/panelEditor');
const { getPanel, getTicket } = require('../utils/dataManager');
const { modDropdown, errorEmbed } = require('../utils/embeds');
const { EmbedBuilder } = require('discord.js');

/**
 * Router principal de interações
 */
async function handleInteraction(interaction) {
  try {
    // ── SLASH COMMANDS ──
    if (interaction.isChatInputCommand()) {
      return handleSlashCommand(interaction);
    }

    // ── BOTÕES ──
    if (interaction.isButton()) {
      return handleButton(interaction);
    }

    // ── SELECT MENUS ──
    if (interaction.isStringSelectMenu()) {
      return handleSelectMenu(interaction);
    }

    // ── MODAIS ──
    if (interaction.isModalSubmit()) {
      return handleModal(interaction);
    }
  } catch (err) {
    console.error('[InteractionCreate] Erro não tratado:', err);
    const reply = { embeds: [errorEmbed('Ocorreu um erro inesperado.')], ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
}

// ── SLASH COMMANDS ──
async function handleSlashCommand(interaction) {
  const { commandName } = interaction;

  if (commandName === 'criar-painel') {
    const { startPanelCreation } = require('../systems/panelBuilder');
    return startPanelCreation(interaction);
  }
  if (commandName === 'editar-painel') {
    const { listPanels } = require('../systems/panelEditor');
    return listPanels(interaction);
  }
  if (commandName === 'enviar-painel') {
    const panelId = interaction.options.getString('painel');
    const { sendPanelToChannel } = require('../systems/panelEditor');
    return sendPanelToChannel(interaction, panelId);
  }
  if (commandName === 'blacklist') {
    return handleBlacklistCommand(interaction);
  }
}

// ── BOTÕES ──
async function handleButton(interaction) {
  const { customId } = interaction;

  // Ticket: abrir via botão
  if (customId.startsWith('ticket_open_')) {
    const parts = customId.replace('ticket_open_', '').split('_');
    const panelId = parts[0];
    const optionId = parts[1];
    const panel = getPanel(panelId);
    if (!panel) return interaction.reply({ embeds: [errorEmbed('Painel não encontrado.')], ephemeral: true });
    const option = panel.options.find(o => o.id === optionId);
    return createTicket(interaction, panel, panelId, option?.label || '');
  }

  // Ticket: fechar
  if (customId.startsWith('ticket_close_') && !customId.includes('confirm') && !customId.includes('cancel') && !customId.includes('modal')) {
    const channelId = customId.replace('ticket_close_', '');
    return initiateClose(interaction, channelId);
  }

  // Ticket: confirmar fechar
  if (customId.startsWith('ticket_close_confirm_')) {
    const channelId = customId.replace('ticket_close_confirm_', '');
    return confirmClose(interaction, channelId);
  }

  // Ticket: cancelar fechar
  if (customId === 'ticket_close_cancel') {
    return interaction.update({ components: [] });
  }

  // Ticket: reivindicar
  if (customId.startsWith('ticket_claim_')) {
    const channelId = customId.replace('ticket_claim_', '');
    return claimTicket(interaction, channelId);
  }

  // Ticket: menu moderação
  if (customId.startsWith('ticket_mod_menu_')) {
    const channelId = customId.replace('ticket_mod_menu_', '');
    const ticket = getTicket(channelId);
    if (!ticket) return interaction.reply({ embeds: [errorEmbed('Ticket não encontrado.')], ephemeral: true });
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('⚙️ Menu de Moderação').setDescription('Selecione uma ação:')],
      components: [modDropdown(channelId)],
      ephemeral: true,
    });
  }

  // Ticket: arquivar (via botão de finalização)
  if (customId.startsWith('ticket_archive_')) {
    const channelId = customId.replace('ticket_archive_', '');
    return archiveTicket(interaction, channelId);
  }

  // Panel builder
  if (await handleBuilderInteraction(interaction)) return;

  // Panel editor
  if (await handleEditorInteraction(interaction)) return;
}

// ── SELECT MENUS ──
async function handleSelectMenu(interaction) {
  const { customId } = interaction;

  // Dropdown de abertura de ticket
  if (customId.startsWith('ticket_open_dropdown_')) {
    const panelId = customId.replace('ticket_open_dropdown_', '');
    const value = interaction.values[0]; // formato: panelId_optionId
    const optionId = value.split('_')[1];
    const panel = getPanel(panelId);
    if (!panel) return interaction.reply({ embeds: [errorEmbed('Painel não encontrado.')], ephemeral: true });
    const option = panel.options.find(o => o.id === optionId);
    return createTicket(interaction, panel, panelId, option?.label || '');
  }

  // Ações de moderação
  if (customId.startsWith('ticket_mod_action_')) {
    const channelId = customId.replace('ticket_mod_action_', '');
    const action = interaction.values[0];
    return handleModAction(interaction, channelId, action);
  }

  // Panel editor select
  if (await handleEditorInteraction(interaction)) return;

  // Panel builder select
  if (await handleBuilderInteraction(interaction)) return;
}

// ── MODAIS ──
async function handleModal(interaction) {
  const { customId } = interaction;

  // Fechar com motivo
  if (customId.startsWith('ticket_close_modal_')) {
    const channelId = customId.replace('ticket_close_modal_', '');
    return handleCloseModal(interaction, channelId);
  }

  // Adicionar membro
  if (customId.startsWith('ticket_add_member_submit_')) {
    const channelId = customId.replace('ticket_add_member_submit_', '');
    return addMember(interaction, channelId);
  }

  // Remover membro
  if (customId.startsWith('ticket_remove_member_submit_')) {
    const channelId = customId.replace('ticket_remove_member_submit_', '');
    return removeMember(interaction, channelId);
  }

  // Panel builder modais
  if (await handleBuilderInteraction(interaction)) return;

  // Panel editor modais
  if (await handleEditorInteraction(interaction)) return;
}

// ── MOD ACTIONS ──
async function handleModAction(interaction, channelId, action) {
  switch (action) {
    case 'finalize':
      return finalizeTicket(interaction, channelId);
    case 'aux':
      return requestAuxiliar(interaction, channelId);
    case 'reclaim':
      return requestReclaim(interaction, channelId);
    case 'add_member':
      return showAddMemberModal(interaction, channelId);
    case 'remove_member':
      return showRemoveMemberModal(interaction, channelId);
    default:
      return interaction.reply({ embeds: [errorEmbed('Ação desconhecida.')], ephemeral: true });
  }
}

// ── BLACKLIST COMMAND ──
async function handleBlacklistCommand(interaction) {
  const { canManagePanels } = require('../utils/permissions');
  const { addToBlacklist, removeFromBlacklist } = require('../utils/blacklist');
  const { successEmbed } = require('../utils/embeds');

  if (!canManagePanels(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Você não tem permissão.')], ephemeral: true });
  }

  const subcommand = interaction.options.getSubcommand();
  const user = interaction.options.getUser('usuario');

  if (subcommand === 'add') {
    addToBlacklist(interaction.guild.id, user.id);
    return interaction.reply({ embeds: [successEmbed(`<@${user.id}> adicionado à blacklist.`)], ephemeral: true });
  }
  if (subcommand === 'remove') {
    removeFromBlacklist(interaction.guild.id, user.id);
    return interaction.reply({ embeds: [successEmbed(`<@${user.id}> removido da blacklist.`)], ephemeral: true });
  }
}

module.exports = { handleInteraction };
