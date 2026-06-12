const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { getPanels, getPanel, savePanel, deletePanel } = require('../utils/dataManager');
const { canManagePanels } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

// ─────────────────────────────────────────
// LISTAR PAINÉIS
// ─────────────────────────────────────────
async function listPanels(interaction) {
  if (!canManagePanels(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Você não tem permissão.')], ephemeral: true });
  }

  const panels = getPanels();
  const entries = Object.entries(panels);

  if (entries.length === 0) {
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription('📭 Nenhum painel criado. Use `/criar-painel`.')],
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('📋 Painéis Salvos')
    .setDescription(entries.map(([id, p]) =>
      `**${p.name}** • \`${id}\`\n> ${p.options?.length || 0} opção(ões) • ${p.channelType === 'thread' ? 'Fórum' : 'Canal'}`
    ).join('\n\n'));

  // Select menu com os painéis
  const options = entries.slice(0, 25).map(([id, p]) => ({
    label: p.name.substring(0, 100),
    value: id,
    description: `ID: ${id}`,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('pe_select')
    .setPlaceholder('Selecione um painel...')
    .addOptions(options);

  const payload = { embeds: [embed], components: [new ActionRowBuilder().addComponents(select)], ephemeral: true };

  if (interaction.isStringSelectMenu() || interaction.isButton()) {
    return interaction.update(payload);
  }
  return interaction.reply(payload);
}

// ─────────────────────────────────────────
// MENU DE UM PAINEL
// ─────────────────────────────────────────
async function showPanelMenu(interaction, panelId) {
  const panel = getPanel(panelId);
  if (!panel) return interaction.update({ embeds: [errorEmbed('Painel não encontrado.')], components: [] });

  const embed = new EmbedBuilder().setColor(panel.color || 0x5865F2)
    .setTitle(`⚙️ ${panel.name}`)
    .setDescription(`ID: \`${panelId}\``)
    .addFields(
      { name: '📡 Tipo', value: panel.channelType === 'thread' ? 'Tópico de Fórum' : 'Canal de Texto', inline: true },
      { name: '🎛️ Opções', value: String(panel.options?.length || 0), inline: true },
      { name: '📦 Containers', value: String(panel.containers?.length || 0), inline: true },
      { name: '📋 Log', value: panel.logChannelId ? `<#${panel.logChannelId}>` : '*Não conf.*', inline: true },
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pe_send_${panelId}`).setLabel('📤 Enviar').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`pe_delete_${panelId}`).setLabel('🗑️ Deletar').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('pe_back').setLabel('◀️ Voltar').setStyle(ButtonStyle.Secondary),
  );

  return interaction.update({ embeds: [embed], components: [row] });
}

// ─────────────────────────────────────────
// ENVIAR PAINEL
// ─────────────────────────────────────────
async function sendPanelToChannel(interaction, panelId) {
  if (!canManagePanels(interaction.member)) {
    const reply = { embeds: [errorEmbed('Você não tem permissão.')], ephemeral: true };
    if (interaction.replied || interaction.deferred) return interaction.followUp(reply);
    return interaction.reply(reply);
  }

  const panel = getPanel(panelId);
  if (!panel) {
    const reply = { embeds: [errorEmbed('Painel não encontrado.')], ephemeral: true };
    if (interaction.replied || interaction.deferred) return interaction.followUp(reply);
    return interaction.reply(reply);
  }

  const modal = new ModalBuilder()
    .setCustomId(`pe_send_submit_${panelId}`)
    .setTitle(`Enviar: ${panel.name.substring(0,40)}`);

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
    console.error('[PanelEditor] Erro ao enviar:', err);
    await interaction.editReply({ embeds: [errorEmbed(`Erro ao enviar o painel: ${err.message}`)] });
  }
}

// ─────────────────────────────────────────
// DELETAR PAINEL
// ─────────────────────────────────────────
async function confirmDelete(interaction, panelId) {
  const panel = getPanel(panelId);
  if (!panel) return interaction.update({ embeds: [errorEmbed('Painel não encontrado.')], components: [] });

  return interaction.update({
    embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('🗑️ Deletar Painel')
      .setDescription(`Tem certeza que deseja deletar **${panel.name}**?\n⚠️ Irreversível.`)],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`pe_delete_confirm_${panelId}`).setLabel('Confirmar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`pe_panel_${panelId}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
    )],
  });
}

async function executeDelete(interaction, panelId) {
  const panel = getPanel(panelId);
  const name = panel?.name || panelId;
  deletePanel(panelId);
  return interaction.update({ embeds: [successEmbed(`Painel **${name}** deletado.`)], components: [] });
}

// ─────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────
async function handleEditorInteraction(interaction) {
  const id = interaction.customId;

  if (!id.startsWith('pe_')) return false;

  try {
    if (id === 'pe_select') {
      return showPanelMenu(interaction, interaction.values[0]);
    }
    if (id === 'pe_back') return listPanels(interaction);
    if (id.startsWith('pe_panel_')) return showPanelMenu(interaction, id.replace('pe_panel_', ''));
    if (id.startsWith('pe_send_') && !id.includes('submit')) return sendPanelToChannel(interaction, id.replace('pe_send_', ''));
    if (id.startsWith('pe_send_submit_')) return executeSendPanel(interaction, id.replace('pe_send_submit_', ''));
    if (id.startsWith('pe_delete_confirm_')) return executeDelete(interaction, id.replace('pe_delete_confirm_', ''));
    if (id.startsWith('pe_delete_')) return confirmDelete(interaction, id.replace('pe_delete_', ''));
  } catch (err) {
    console.error('[PanelEditor] Erro:', err);
    try {
      const reply = { embeds: [errorEmbed('Erro no editor de painéis.')], ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(()=>{});
      else await interaction.reply(reply).catch(()=>{});
    } catch {}
  }

  return true;
}

module.exports = { listPanels, sendPanelToChannel, handleEditorInteraction };
