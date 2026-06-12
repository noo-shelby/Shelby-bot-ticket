const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ChannelType, ComponentType
} = require('discord.js');
const { savePanel, getPanel, getPanels } = require('../utils/dataManager');
const { canManagePanels } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { v4: uuidv4 } = require('crypto');

// Sessões de criação ativas: Map<userId, sessionData>
const sessions = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Inicia a criação de um novo painel
 */
async function startPanelCreation(interaction) {
  if (!canManagePanels(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Você não tem permissão para criar painéis.')], ephemeral: true });
  }

  const panelId = generateId();
  const session = {
    panelId,
    step: 'main',
    data: {
      name: 'Novo Painel',
      color: 0x5865F2,
      channelType: 'text',
      staffRoles: [],
      modRoles: [],
      reviewRoles: [],
      options: [],
      useBlacklist: false,
      requireReason: false,
      autoCloseMinutes: 0,
      archiveOnClose: false,
    }
  };

  sessions.set(interaction.user.id, session);

  await interaction.reply({
    embeds: [buildMainMenuEmbed(session.data)],
    components: buildMainMenuComponents(panelId),
    ephemeral: true,
  });
}

/**
 * Processa interações do builder
 */
async function handleBuilderInteraction(interaction) {
  const userId = interaction.user.id;
  const session = sessions.get(userId);
  if (!session) return false;

  const customId = interaction.customId;

  // ── BOTÕES DO MENU PRINCIPAL ──
  if (customId === `pb_name_${session.panelId}`) {
    return showModal(interaction, 'Nome do Painel', 'pb_modal_name', 'name', 'Nome do painel', session.data.name);
  }
  if (customId === `pb_desc_${session.panelId}`) {
    return showModalLong(interaction, 'Descrição do Painel', 'pb_modal_desc', 'desc',
      'Mensagem exibida no ticket\nUse {user}, {ticket}, {option}', session.data.ticketDescription || '');
  }
  if (customId === `pb_color_${session.panelId}`) {
    return showModal(interaction, 'Cor do Painel', 'pb_modal_color', 'color', 'Hex (ex: #5865F2)', `#${session.data.color.toString(16).padStart(6, '0')}`);
  }
  if (customId === `pb_channel_type_${session.panelId}`) {
    return toggleChannelType(interaction, session);
  }
  if (customId === `pb_options_${session.panelId}`) {
    return showOptionsMenu(interaction, session);
  }
  if (customId === `pb_staffroles_${session.panelId}`) {
    return showModal(interaction, 'Cargos de Atendimento', 'pb_modal_staffroles', 'roles',
      'IDs separados por vírgula', session.data.staffRoles.join(','));
  }
  if (customId === `pb_modroles_${session.panelId}`) {
    return showModal(interaction, 'Cargos de Moderação', 'pb_modal_modroles', 'roles',
      'IDs separados por vírgula', session.data.modRoles.join(','));
  }
  if (customId === `pb_reviewroles_${session.panelId}`) {
    return showModal(interaction, 'Cargos de Revisão (Finalizar)', 'pb_modal_reviewroles', 'roles',
      'IDs separados por vírgula', session.data.reviewRoles.join(','));
  }
  if (customId === `pb_reviewmsg_${session.panelId}`) {
    return showModalLong(interaction, 'Mensagem de Revisão', 'pb_modal_reviewmsg', 'msg',
      'Use {user}, {staff}, {ticket}', session.data.reviewMessage || '');
  }
  if (customId === `pb_channels_${session.panelId}`) {
    return showChannelsMenu(interaction, session);
  }
  if (customId === `pb_settings_${session.panelId}`) {
    return showSettingsMenu(interaction, session);
  }
  if (customId === `pb_save_${session.panelId}`) {
    return saveAndFinish(interaction, session);
  }
  if (customId === `pb_cancel_${session.panelId}`) {
    sessions.delete(userId);
    return interaction.update({ embeds: [{ color: 0xFF4444, description: '❌ Criação cancelada.' }], components: [] });
  }

  // ── MODAIS ──
  if (customId === 'pb_modal_name') {
    session.data.name = interaction.fields.getTextInputValue('name');
    sessions.set(userId, session);
    return refreshMainMenu(interaction, session);
  }
  if (customId === 'pb_modal_desc') {
    session.data.ticketDescription = interaction.fields.getTextInputValue('desc');
    sessions.set(userId, session);
    return refreshMainMenu(interaction, session);
  }
  if (customId === 'pb_modal_color') {
    const hex = interaction.fields.getTextInputValue('color').replace('#', '');
    session.data.color = parseInt(hex, 16) || 0x5865F2;
    sessions.set(userId, session);
    return refreshMainMenu(interaction, session);
  }
  if (customId === 'pb_modal_staffroles') {
    session.data.staffRoles = parseRoles(interaction.fields.getTextInputValue('roles'));
    sessions.set(userId, session);
    return refreshMainMenu(interaction, session);
  }
  if (customId === 'pb_modal_modroles') {
    session.data.modRoles = parseRoles(interaction.fields.getTextInputValue('roles'));
    sessions.set(userId, session);
    return refreshMainMenu(interaction, session);
  }
  if (customId === 'pb_modal_reviewroles') {
    session.data.reviewRoles = parseRoles(interaction.fields.getTextInputValue('roles'));
    sessions.set(userId, session);
    return refreshMainMenu(interaction, session);
  }
  if (customId === 'pb_modal_reviewmsg') {
    session.data.reviewMessage = interaction.fields.getTextInputValue('msg');
    sessions.set(userId, session);
    return refreshMainMenu(interaction, session);
  }

  // ── CANAIS ──
  if (customId === `pb_ch_log_${session.panelId}`) return showModal(interaction, 'Canal de Log', 'pb_modal_ch_log', 'id', 'ID do canal', session.data.logChannelId || '');
  if (customId === `pb_ch_staff_${session.panelId}`) return showModal(interaction, 'Canal Staff', 'pb_modal_ch_staff', 'id', 'ID do canal', session.data.staffChannelId || '');
  if (customId === `pb_ch_aux_${session.panelId}`) return showModal(interaction, 'Canal Auxiliar', 'pb_modal_ch_aux', 'id', 'ID do canal', session.data.auxChannelId || '');
  if (customId === `pb_ch_reclaim_${session.panelId}`) return showModal(interaction, 'Canal Re-Reivindicação', 'pb_modal_ch_reclaim', 'id', 'ID do canal', session.data.reclaimChannelId || '');
  if (customId === `pb_ch_category_${session.panelId}`) return showModal(interaction, 'Categoria dos Tickets', 'pb_modal_ch_category', 'id', 'ID da categoria', session.data.categoryId || '');
  if (customId === `pb_ch_archive_${session.panelId}`) return showModal(interaction, 'Categoria de Arquivo', 'pb_modal_ch_archive', 'id', 'ID da categoria', session.data.archiveCategoryId || '');
  if (customId === `pb_ch_back_${session.panelId}`) return refreshMainMenu(interaction, session);

  if (customId === 'pb_modal_ch_log') { session.data.logChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
  if (customId === 'pb_modal_ch_staff') { session.data.staffChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
  if (customId === 'pb_modal_ch_aux') { session.data.auxChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
  if (customId === 'pb_modal_ch_reclaim') { session.data.reclaimChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
  if (customId === 'pb_modal_ch_category') { session.data.categoryId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
  if (customId === 'pb_modal_ch_archive') { session.data.archiveCategoryId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }

  // ── OPÇÕES ──
  if (customId === `pb_add_option_${session.panelId}`) return showAddOptionModal(interaction, session);
  if (customId === `pb_remove_option_${session.panelId}`) return showRemoveOptionMenu(interaction, session);
  if (customId === `pb_opt_back_${session.panelId}`) return refreshMainMenu(interaction, session);
  if (customId === 'pb_modal_add_option') return addOption(interaction, session, userId);
  if (customId.startsWith('pb_remove_opt_select_')) {
    const idx = parseInt(customId.replace('pb_remove_opt_select_', ''));
    session.data.options.splice(idx, 1);
    sessions.set(userId, session);
    return showOptionsMenu(interaction, session, true);
  }

  // ── SETTINGS ──
  if (customId === `pb_toggle_blacklist_${session.panelId}`) {
    session.data.useBlacklist = !session.data.useBlacklist;
    sessions.set(userId, session);
    return showSettingsMenu(interaction, session, true);
  }
  if (customId === `pb_toggle_reason_${session.panelId}`) {
    session.data.requireReason = !session.data.requireReason;
    sessions.set(userId, session);
    return showSettingsMenu(interaction, session, true);
  }
  if (customId === `pb_toggle_archive_${session.panelId}`) {
    session.data.archiveOnClose = !session.data.archiveOnClose;
    sessions.set(userId, session);
    return showSettingsMenu(interaction, session, true);
  }
  if (customId === `pb_autoclose_${session.panelId}`) return showModal(interaction, 'Auto-Fechamento', 'pb_modal_autoclose', 'minutes', 'Minutos (0 = desativado)', String(session.data.autoCloseMinutes));
  if (customId === 'pb_modal_autoclose') {
    session.data.autoCloseMinutes = parseInt(interaction.fields.getTextInputValue('minutes')) || 0;
    sessions.set(userId, session);
    return showSettingsMenu(interaction, session, true);
  }
  if (customId === `pb_settings_back_${session.panelId}`) return refreshMainMenu(interaction, session);

  return false;
}

// ── HELPERS ──

function buildMainMenuEmbed(data) {
  const opts = data.options.length > 0
    ? data.options.map((o, i) => `${i + 1}. ${o.emoji || ''} **${o.label}** (${o.type})`).join('\n')
    : '*Nenhuma opção adicionada*';

  return new EmbedBuilder()
    .setColor(data.color)
    .setTitle(`🛠️ Construtor de Painel — ${data.name}`)
    .addFields(
      { name: '📋 Nome', value: data.name, inline: true },
      { name: '🎨 Cor', value: `#${data.color.toString(16).padStart(6, '0')}`, inline: true },
      { name: '📡 Tipo de Canal', value: data.channelType === 'thread' ? 'Tópico de Fórum' : 'Canal de Texto', inline: true },
      { name: '👥 Cargos Atendimento', value: data.staffRoles.length > 0 ? data.staffRoles.map(r => `<@&${r}>`).join(', ') : '*Não configurado*', inline: true },
      { name: '🛡️ Cargos Moderação', value: data.modRoles.length > 0 ? data.modRoles.map(r => `<@&${r}>`).join(', ') : '*Não configurado*', inline: true },
      { name: '🔍 Cargos Revisão', value: data.reviewRoles.length > 0 ? data.reviewRoles.map(r => `<@&${r}>`).join(', ') : '*Não configurado*', inline: true },
      { name: '🎛️ Opções do Ticket', value: opts },
    )
    .setFooter({ text: 'Configure todos os campos e clique em Salvar Painel' });
}

function buildMainMenuComponents(panelId) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pb_name_${panelId}`).setLabel('Nome').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_desc_${panelId}`).setLabel('Descrição').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_color_${panelId}`).setLabel('Cor').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_channel_type_${panelId}`).setLabel('Tipo Canal').setEmoji('📡').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_options_${panelId}`).setLabel('Opções').setEmoji('🎛️').setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pb_staffroles_${panelId}`).setLabel('Cargos Staff').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_modroles_${panelId}`).setLabel('Cargos Mod').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_reviewroles_${panelId}`).setLabel('Cargos Revisão').setEmoji('🔍').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_reviewmsg_${panelId}`).setLabel('Msg Revisão').setEmoji('💬').setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pb_channels_${panelId}`).setLabel('Canais').setEmoji('📢').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_settings_${panelId}`).setLabel('Configurações').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_save_${panelId}`).setLabel('Salvar Painel').setEmoji('💾').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`pb_cancel_${panelId}`).setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2, row3];
}

async function refreshMainMenu(interaction, session) {
  return interaction.update({
    embeds: [buildMainMenuEmbed(session.data)],
    components: buildMainMenuComponents(session.panelId),
  });
}

async function toggleChannelType(interaction, session) {
  session.data.channelType = session.data.channelType === 'text' ? 'thread' : 'text';
  sessions.set(interaction.user.id, session);
  return refreshMainMenu(interaction, session);
}

async function showOptionsMenu(interaction, session, isUpdate = false) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎛️ Opções do Painel')
    .setDescription(
      session.data.options.length > 0
        ? session.data.options.map((o, i) => `**${i + 1}.** ${o.emoji || ''} ${o.label} — \`${o.type}\``).join('\n')
        : '*Nenhuma opção adicionada ainda.*\nAdicione botões ou itens de dropdown.'
    )
    .setFooter({ text: 'Máximo de 5 opções por painel' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pb_add_option_${session.panelId}`).setLabel('Adicionar Opção').setEmoji('➕').setStyle(ButtonStyle.Success).setDisabled(session.data.options.length >= 5),
    new ButtonBuilder().setCustomId(`pb_remove_option_${session.panelId}`).setLabel('Remover Opção').setEmoji('➖').setStyle(ButtonStyle.Danger).setDisabled(session.data.options.length === 0),
    new ButtonBuilder().setCustomId(`pb_opt_back_${session.panelId}`).setLabel('Voltar').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
  );

  const payload = { embeds: [embed], components: [row] };
  return isUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

async function showAddOptionModal(interaction, session) {
  const modal = new ModalBuilder()
    .setCustomId('pb_modal_add_option')
    .setTitle('Adicionar Opção');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('label').setLabel('Label (nome da opção)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(10)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('type').setLabel('Tipo: "button" ou "dropdown"').setStyle(TextInputStyle.Short).setRequired(true).setValue('button')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Descrição (dropdown only, opcional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
    ),
  );

  return interaction.showModal(modal);
}

async function addOption(interaction, session, userId) {
  await interaction.deferUpdate();
  const label = interaction.fields.getTextInputValue('label');
  const emoji = interaction.fields.getTextInputValue('emoji') || null;
  const type = interaction.fields.getTextInputValue('type').toLowerCase() === 'dropdown' ? 'dropdown' : 'button';
  const description = interaction.fields.getTextInputValue('description') || null;

  session.data.options.push({ label, emoji, type, description, id: generateId() });
  sessions.set(userId, session);
  return showOptionsMenu(interaction, session, true);
}

async function showRemoveOptionMenu(interaction, session) {
  if (session.data.options.length === 0) return;

  const select = new StringSelectMenuBuilder()
    .setCustomId(`pb_remove_opt_select`)
    .setPlaceholder('Selecione a opção para remover');

  session.data.options.forEach((opt, i) => {
    select.addOptions({ label: opt.label, value: String(i), emoji: opt.emoji || undefined });
  });

  // Ajusta customId para incluir índice no select
  select.options.forEach((opt, i) => {
    opt.data.value = String(i);
  });

  const row = new ActionRowBuilder().addComponents(select);

  // Listener temporário
  const reply = await interaction.update({
    embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('Remover Opção').setDescription('Selecione a opção que deseja remover:')],
    components: [row],
    fetchReply: true,
  });
}

async function showChannelsMenu(interaction, session, isUpdate = false) {
  const d = session.data;
  const ch = (id) => id ? `<#${id}>` : '*Não configurado*';

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📢 Configuração de Canais')
    .addFields(
      { name: '📋 Log', value: ch(d.logChannelId), inline: true },
      { name: '👥 Staff', value: ch(d.staffChannelId), inline: true },
      { name: '🆘 Auxiliar', value: ch(d.auxChannelId), inline: true },
      { name: '🔄 Re-Reivindicação', value: ch(d.reclaimChannelId), inline: true },
      { name: '📁 Categoria Tickets', value: ch(d.categoryId), inline: true },
      { name: '📦 Categoria Arquivo', value: ch(d.archiveCategoryId), inline: true },
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pb_ch_log_${session.panelId}`).setLabel('Log').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_ch_staff_${session.panelId}`).setLabel('Staff').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_ch_aux_${session.panelId}`).setLabel('Auxiliar').setEmoji('🆘').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_ch_reclaim_${session.panelId}`).setLabel('Re-Reivindicação').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pb_ch_category_${session.panelId}`).setLabel('Categoria').setEmoji('📁').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_ch_archive_${session.panelId}`).setLabel('Arquivo').setEmoji('📦').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_ch_back_${session.panelId}`).setLabel('Voltar').setEmoji('◀️').setStyle(ButtonStyle.Primary),
  );

  const payload = { embeds: [embed], components: [row1, row2] };
  return isUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

async function showSettingsMenu(interaction, session, isUpdate = false) {
  const d = session.data;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('⚙️ Configurações do Painel')
    .addFields(
      { name: '🚫 Blacklist', value: d.useBlacklist ? '✅ Ativada' : '❌ Desativada', inline: true },
      { name: '📝 Pedir Motivo', value: d.requireReason ? '✅ Sim' : '❌ Não', inline: true },
      { name: '📦 Arquivar ao Fechar', value: d.archiveOnClose ? '✅ Sim' : '❌ Não (Deletar)', inline: true },
      { name: '⏰ Auto-Fechar', value: d.autoCloseMinutes > 0 ? `${d.autoCloseMinutes} minutos` : '❌ Desativado', inline: true },
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pb_toggle_blacklist_${session.panelId}`).setLabel('Blacklist').setEmoji('🚫').setStyle(d.useBlacklist ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_toggle_reason_${session.panelId}`).setLabel('Pedir Motivo').setEmoji('📝').setStyle(d.requireReason ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_toggle_archive_${session.panelId}`).setLabel('Arquivar').setEmoji('📦').setStyle(d.archiveOnClose ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_autoclose_${session.panelId}`).setLabel('Auto-Fechar').setEmoji('⏰').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pb_settings_back_${session.panelId}`).setLabel('Voltar').setEmoji('◀️').setStyle(ButtonStyle.Primary),
  );

  const payload = { embeds: [embed], components: [row] };
  return isUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

async function saveAndFinish(interaction, session) {
  if (!session.data.name) {
    return interaction.reply({ embeds: [errorEmbed('Defina um nome para o painel.')], ephemeral: true });
  }
  if (session.data.options.length === 0) {
    return interaction.reply({ embeds: [errorEmbed('Adicione pelo menos uma opção ao painel.')], ephemeral: true });
  }

  session.data.createdAt = Date.now();
  session.data.createdBy = interaction.user.id;
  savePanel(session.panelId, session.data);
  sessions.delete(interaction.user.id);

  return interaction.update({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Painel Salvo!')
        .setDescription(`O painel **${session.data.name}** foi salvo com ID \`${session.panelId}\`.\n\nUse \`/enviar-painel\` para enviá-lo a um canal.`)
    ],
    components: [],
  });
}

// ── UTILITÁRIOS ──

function parseRoles(str) {
  return str.split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s));
}

async function showModal(interaction, title, customId, fieldId, label, value = '') {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(fieldId).setLabel(label).setStyle(TextInputStyle.Short).setValue(value).setRequired(true)
    )
  );
  return interaction.showModal(modal);
}

async function showModalLong(interaction, title, customId, fieldId, label, value = '') {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(fieldId).setLabel(label).setStyle(TextInputStyle.Paragraph).setValue(value).setRequired(false)
    )
  );
  return interaction.showModal(modal);
}

module.exports = { startPanelCreation, handleBuilderInteraction };
