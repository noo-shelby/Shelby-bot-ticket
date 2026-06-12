const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder
} = require('discord.js');
const { getPanels, getPanel, savePanel, deletePanel } = require('../utils/dataManager');
const { canManagePanels } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { startPanelCreation, handleBuilderInteraction } = require('./panelBuilder');

/**
 * Lista todos os painéis salvos
 */
async function listPanels(interaction) {
  if (!canManagePanels(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Você não tem permissão.')], ephemeral: true });
  }

  const panels = getPanels();
  const entries = Object.entries(panels);

  if (entries.length === 0) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription('📭 Nenhum painel criado ainda. Use `/criar-painel`.')],
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📋 Painéis Salvos')
    .setDescription(
      entries.map(([id, p]) =>
        `**${p.name}** • \`${id}\`\n> ${p.options.length} opção(ões) • ${p.channelType === 'thread' ? 'Fórum' : 'Canal'}`
      ).join('\n\n')
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId('pe_select_panel')
    .setPlaceholder('Selecione um painel para gerenciar...')
    .addOptions(
      entries.slice(0, 25).map(([id, p]) => ({
        label: p.name,
        value: id,
        description: `ID: ${id} • ${p.options.length} opção(ões)`,
      }))
    );

  return interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
    ephemeral: true,
  });
}

/**
 * Menu de gerenciamento de painel específico
 */
async function managePanelMenu(interaction, panelId) {
  const panel = getPanel(panelId);
  if (!panel) return interaction.update({ embeds: [errorEmbed('Painel não encontrado.')], components: [] });

  const embed = new EmbedBuilder()
    .setColor(panel.color || 0x5865F2)
    .setTitle(`⚙️ Gerenciar: ${panel.name}`)
    .setDescription(`ID: \`${panelId}\``)
    .addFields(
      { name: '📡 Tipo', value: panel.channelType === 'thread' ? 'Tópico de Fórum' : 'Canal de Texto', inline: true },
      { name: '🎛️ Opções', value: String(panel.options.length), inline: true },
      { name: '📋 Log', value: panel.logChannelId ? `<#${panel.logChannelId}>` : '*Não conf.*', inline: true },
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pe_edit_${panelId}`).setLabel('Editar').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pe_send_${panelId}`).setLabel('Enviar').setEmoji('📤').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`pe_delete_${panelId}`).setLabel('Deletar').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('pe_back_list').setLabel('Voltar').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
  );

  return interaction.update({ embeds: [embed], components: [row] });
}

/**
 * Confirma deleção de painel
 */
async function confirmDeletePanel(interaction, panelId) {
  const panel = getPanel(panelId);
  if (!panel) return interaction.update({ embeds: [errorEmbed('Painel não encontrado.')], components: [] });

  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle('🗑️ Deletar Painel')
        .setDescription(`Tem certeza que deseja deletar o painel **${panel.name}**?\n\n⚠️ Esta ação é irreversível.`)
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`pe_delete_confirm_${panelId}`).setLabel('Confirmar Deleção').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`pe_manage_${panelId}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
      )
    ]
  });
}

async function executeDeletePanel(interaction, panelId) {
  const panel = getPanel(panelId);
  const name = panel?.name || panelId;
  deletePanel(panelId);

  return interaction.update({
    embeds: [successEmbed(`Painel **${name}** deletado com sucesso.`)],
    components: [],
  });
}

/**
 * Envia o painel para um canal (constrói os componentes V2)
 */
async function sendPanelToChannel(interaction, panelId) {
  if (!canManagePanels(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Você não tem permissão.')], ephemeral: true });
  }

  const panel = getPanel(panelId);
  if (!panel) return interaction.reply({ embeds: [errorEmbed('Painel não encontrado.')], ephemeral: true });

  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId(`pe_send_submit_${panelId}`)
    .setTitle(`Enviar Painel: ${panel.name}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('channel_id')
        .setLabel('ID do canal destino')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Ex: 123456789012345678')
    )
  );

  return interaction.showModal(modal);
}

/**
 * Executa o envio do painel após modal
 */
async function executeSendPanel(interaction, panelId) {
  await interaction.deferReply({ ephemeral: true });

  const channelId = interaction.fields.getTextInputValue('channel_id').trim();
  const panel = getPanel(panelId);
  if (!panel) return interaction.editReply({ embeds: [errorEmbed('Painel não encontrado.')] });

  const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!channel) return interaction.editReply({ embeds: [errorEmbed('Canal não encontrado. Verifique o ID.')] });

  try {
    const { buildPanelMessage } = require('./panelSender');
    await buildPanelMessage(channel, panel, panelId);
    await interaction.editReply({ embeds: [successEmbed(`Painel **${panel.name}** enviado para <#${channelId}>!`)] });
  } catch (err) {
    console.error('[SendPanel]', err);
    await interaction.editReply({ embeds: [errorEmbed('Erro ao enviar o painel.')] });
  }
}

/**
 * Processa interações do editor
 */
async function handleEditorInteraction(interaction) {
  const customId = interaction.customId;

  if (customId === 'pe_select_panel') {
    const panelId = interaction.values[0];
    return managePanelMenu(interaction, panelId);
  }
  if (customId === 'pe_back_list') return listPanels(interaction);

  if (customId.startsWith('pe_manage_')) return managePanelMenu(interaction, customId.replace('pe_manage_', ''));
  if (customId.startsWith('pe_send_') && !customId.includes('submit')) return sendPanelToChannel(interaction, customId.replace('pe_send_', ''));
  if (customId.startsWith('pe_send_submit_')) return executeSendPanel(interaction, customId.replace('pe_send_submit_', ''));
  if (customId.startsWith('pe_delete_confirm_')) return executeDeletePanel(interaction, customId.replace('pe_delete_confirm_', ''));
  if (customId.startsWith('pe_delete_')) return confirmDeletePanel(interaction, customId.replace('pe_delete_', ''));

  return false;
}

module.exports = { listPanels, managePanelMenu, handleEditorInteraction };
