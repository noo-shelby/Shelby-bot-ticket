const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const { savePanel, getPanel } = require('../utils/dataManager');
const { canManagePanels } = require('../utils/permissions');
const { errorEmbed } = require('../utils/embeds');

// Sessões ativas: Map<userId, session>
const sessions = new Map();

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// ─────────────────────────────────────────
// INICIAR CRIAÇÃO
// ─────────────────────────────────────────
async function startPanelCreation(interaction) {
  if (!canManagePanels(interaction.member)) {
    return interaction.reply({ embeds: [errorEmbed('Você não tem permissão para criar painéis.')], ephemeral: true });
  }

  const panelId = generateId();
  const session = {
    panelId,
    data: {
      name: 'Novo Painel',
      color: 0x5865F2,
      channelType: 'text',
      forumChannelId: null,
      staffRoles: [],
      modRoles: [],
      reviewRoles: [],
      reviewMessage: '',
      options: [],
      containers: [],
      useBlacklist: false,
      requireReason: false,
      autoCloseMinutes: 0,
      archiveOnClose: false,
      logChannelId: null,
      staffChannelId: null,
      auxChannelId: null,
      reclaimChannelId: null,
      categoryId: null,
      archiveCategoryId: null,
      dropdownPlaceholder: 'Selecione uma categoria...',
    }
  };

  sessions.set(interaction.user.id, session);
  return interaction.reply({ embeds: [mainEmbed(session.data)], components: mainRows(panelId), ephemeral: true });
}

// ─────────────────────────────────────────
// ROUTER PRINCIPAL
// ─────────────────────────────────────────
async function handleBuilderInteraction(interaction) {
  const userId = interaction.user.id;
  const session = sessions.get(userId);
  if (!session) return false;

  const id = interaction.customId;
  const pid = session.panelId;

  // Verifica se é do builder
  if (!id.startsWith('pb_')) return false;

  try {
    // ── MENU PRINCIPAL ──
    if (id === `pb_name_${pid}`) return showModal(interaction, 'Nome do Painel', 'pb_m_name', 'name', 'Nome', session.data.name);
    if (id === `pb_color_${pid}`) return showModal(interaction, 'Cor (hex)', 'pb_m_color', 'color', 'Ex: #5865F2', `#${session.data.color.toString(16).padStart(6,'0')}`);
    if (id === `pb_channeltype_${pid}`) return toggleChannelType(interaction, session);
    if (id === `pb_forumid_${pid}`) return showModal(interaction, 'ID do Canal de Fórum', 'pb_m_forumid', 'id', 'ID do canal de fórum', session.data.forumChannelId || '');
    if (id === `pb_options_${pid}`) return showOptionsMenu(interaction, session);
    if (id === `pb_containers_${pid}`) return showContainersMenu(interaction, session);
    if (id === `pb_staffroles_${pid}`) return showModal(interaction, 'Cargos de Atendimento', 'pb_m_staffroles', 'roles', 'IDs separados por vírgula', session.data.staffRoles.join(','));
    if (id === `pb_modroles_${pid}`) return showModal(interaction, 'Cargos de Moderação', 'pb_m_modroles', 'roles', 'IDs separados por vírgula', session.data.modRoles.join(','));
    if (id === `pb_reviewroles_${pid}`) return showModal(interaction, 'Cargos de Revisão', 'pb_m_reviewroles', 'roles', 'IDs separados por vírgula', session.data.reviewRoles.join(','));
    if (id === `pb_reviewmsg_${pid}`) return showModalLong(interaction, 'Mensagem de Revisão', 'pb_m_reviewmsg', 'msg', 'Use {user} {staff} {ticket}', session.data.reviewMessage || '');
    if (id === `pb_channels_${pid}`) return showChannelsMenu(interaction, session);
    if (id === `pb_settings_${pid}`) return showSettingsMenu(interaction, session);
    if (id === `pb_save_${pid}`) return saveAndFinish(interaction, session);
    if (id === `pb_cancel_${pid}`) {
      sessions.delete(userId);
      return interaction.update({ embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription('❌ Criação cancelada.')], components: [] });
    }

    // ── MODAIS PRINCIPAIS ──
    if (id === 'pb_m_name') { session.data.name = interaction.fields.getTextInputValue('name'); sessions.set(userId, session); return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) }); }
    if (id === 'pb_m_color') { const h = interaction.fields.getTextInputValue('color').replace('#',''); session.data.color = parseInt(h,16)||0x5865F2; sessions.set(userId, session); return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) }); }
    if (id === 'pb_m_forumid') { session.data.forumChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) }); }
    if (id === 'pb_m_staffroles') { session.data.staffRoles = parseRoles(interaction.fields.getTextInputValue('roles')); sessions.set(userId, session); return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) }); }
    if (id === 'pb_m_modroles') { session.data.modRoles = parseRoles(interaction.fields.getTextInputValue('roles')); sessions.set(userId, session); return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) }); }
    if (id === 'pb_m_reviewroles') { session.data.reviewRoles = parseRoles(interaction.fields.getTextInputValue('roles')); sessions.set(userId, session); return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) }); }
    if (id === 'pb_m_reviewmsg') { session.data.reviewMessage = interaction.fields.getTextInputValue('msg'); sessions.set(userId, session); return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) }); }

    // ── OPÇÕES ──
    if (id === `pb_opt_add_${pid}`) return showAddOptionModal(interaction);
    if (id === `pb_opt_remove_${pid}`) return showRemoveOptionSelect(interaction, session);
    if (id === `pb_opt_back_${pid}`) return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) });
    if (id === 'pb_m_addoption') return addOption(interaction, session, userId);
    if (id.startsWith('pb_opt_del_')) {
      const idx = parseInt(id.replace('pb_opt_del_',''));
      session.data.options.splice(idx, 1);
      sessions.set(userId, session);
      return showOptionsMenu(interaction, session, true);
    }

    // ── CONTAINERS ──
    if (id === `pb_cont_add_${pid}`) return addContainer(interaction, session, userId);
    if (id === `pb_cont_back_${pid}`) return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) });
    if (id.startsWith('pb_cont_sel_')) {
      const idx = parseInt(id.replace('pb_cont_sel_',''));
      return showContainerEditor(interaction, session, idx);
    }
    if (id.startsWith('pb_cont_del_')) {
      const idx = parseInt(id.replace('pb_cont_del_',''));
      session.data.containers.splice(idx, 1);
      sessions.set(userId, session);
      return showContainersMenu(interaction, session, true);
    }

    // ── EDITOR DE CONTAINER ──
    if (id.startsWith('pb_blk_addtext_')) {
      const idx = parseInt(id.replace('pb_blk_addtext_',''));
      return showModal(interaction, 'Bloco de Texto', `pb_m_blktext_${idx}`, 'content', 'Texto (suporta markdown)', '');
    }
    if (id.startsWith('pb_blk_addimg_')) {
      const idx = parseInt(id.replace('pb_blk_addimg_',''));
      return showModal(interaction, 'URL da Imagem', `pb_m_blkimg_${idx}`, 'url', 'https://...', '');
    }
    if (id.startsWith('pb_blk_addsep_')) {
      const idx = parseInt(id.replace('pb_blk_addsep_',''));
      session.data.containers[idx].blocks.push({ type: 'separator', spacing: 1 });
      sessions.set(userId, session);
      return showContainerEditor(interaction, session, idx);
    }
    if (id.startsWith('pb_blk_addactions_')) {
      const idx = parseInt(id.replace('pb_blk_addactions_',''));
      session.data.containers[idx].blocks.push({ type: 'actions' });
      sessions.set(userId, session);
      return showContainerEditor(interaction, session, idx);
    }
    if (id.startsWith('pb_blk_color_')) {
      const idx = parseInt(id.replace('pb_blk_color_',''));
      return showModal(interaction, 'Cor do Container (hex)', `pb_m_contcolor_${idx}`, 'color', 'Ex: #5865F2 (deixe vazio para remover)', session.data.containers[idx].color || '');
    }
    if (id.startsWith('pb_blk_spoiler_')) {
      const idx = parseInt(id.replace('pb_blk_spoiler_',''));
      session.data.containers[idx].spoiler = !session.data.containers[idx].spoiler;
      sessions.set(userId, session);
      return showContainerEditor(interaction, session, idx);
    }
    if (id.startsWith('pb_blk_clearlast_')) {
      const idx = parseInt(id.replace('pb_blk_clearlast_',''));
      if (session.data.containers[idx].blocks.length > 0) {
        session.data.containers[idx].blocks.pop();
        sessions.set(userId, session);
      }
      return showContainerEditor(interaction, session, idx);
    }
    if (id.startsWith('pb_blk_back_')) {
      return showContainersMenu(interaction, session, true);
    }

    // ── MODAIS DE BLOCOS ──
    if (id.startsWith('pb_m_blktext_')) {
      const idx = parseInt(id.replace('pb_m_blktext_',''));
      const content = interaction.fields.getTextInputValue('content');
      session.data.containers[idx].blocks.push({ type: 'text', content });
      sessions.set(userId, session);
      return showContainerEditor(interaction, session, idx);
    }
    if (id.startsWith('pb_m_blkimg_')) {
      const idx = parseInt(id.replace('pb_m_blkimg_',''));
      const url = interaction.fields.getTextInputValue('url').trim();
      session.data.containers[idx].blocks.push({ type: 'image', url });
      sessions.set(userId, session);
      return showContainerEditor(interaction, session, idx);
    }
    if (id.startsWith('pb_m_contcolor_')) {
      const idx = parseInt(id.replace('pb_m_contcolor_',''));
      const val = interaction.fields.getTextInputValue('color').trim();
      session.data.containers[idx].color = val || null;
      sessions.set(userId, session);
      return showContainerEditor(interaction, session, idx);
    }

    // ── CANAIS ──
    if (id === `pb_ch_log_${pid}`) return showModal(interaction, 'Canal de Log', 'pb_m_ch_log', 'id', 'ID do canal', session.data.logChannelId || '');
    if (id === `pb_ch_staff_${pid}`) return showModal(interaction, 'Canal Staff', 'pb_m_ch_staff', 'id', 'ID do canal', session.data.staffChannelId || '');
    if (id === `pb_ch_aux_${pid}`) return showModal(interaction, 'Canal Auxiliar', 'pb_m_ch_aux', 'id', 'ID do canal', session.data.auxChannelId || '');
    if (id === `pb_ch_reclaim_${pid}`) return showModal(interaction, 'Canal Re-Reivindicação', 'pb_m_ch_reclaim', 'id', 'ID do canal', session.data.reclaimChannelId || '');
    if (id === `pb_ch_category_${pid}`) return showModal(interaction, 'Categoria dos Tickets', 'pb_m_ch_category', 'id', 'ID da categoria', session.data.categoryId || '');
    if (id === `pb_ch_archive_${pid}`) return showModal(interaction, 'Categoria de Arquivo', 'pb_m_ch_archive', 'id', 'ID da categoria', session.data.archiveCategoryId || '');
    if (id === `pb_ch_back_${pid}`) return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) });

    if (id === 'pb_m_ch_log') { session.data.logChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
    if (id === 'pb_m_ch_staff') { session.data.staffChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
    if (id === 'pb_m_ch_aux') { session.data.auxChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
    if (id === 'pb_m_ch_reclaim') { session.data.reclaimChannelId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
    if (id === 'pb_m_ch_category') { session.data.categoryId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }
    if (id === 'pb_m_ch_archive') { session.data.archiveCategoryId = interaction.fields.getTextInputValue('id').trim(); sessions.set(userId, session); return showChannelsMenu(interaction, session, true); }

    // ── SETTINGS ──
    if (id === `pb_set_blacklist_${pid}`) { session.data.useBlacklist = !session.data.useBlacklist; sessions.set(userId, session); return showSettingsMenu(interaction, session, true); }
    if (id === `pb_set_reason_${pid}`) { session.data.requireReason = !session.data.requireReason; sessions.set(userId, session); return showSettingsMenu(interaction, session, true); }
    if (id === `pb_set_archive_${pid}`) { session.data.archiveOnClose = !session.data.archiveOnClose; sessions.set(userId, session); return showSettingsMenu(interaction, session, true); }
    if (id === `pb_set_autoclose_${pid}`) return showModal(interaction, 'Auto-Fechar (minutos)', 'pb_m_autoclose', 'min', 'Minutos (0 = desativado)', String(session.data.autoCloseMinutes));
    if (id === `pb_set_back_${pid}`) return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(pid) });
    if (id === 'pb_m_autoclose') { session.data.autoCloseMinutes = parseInt(interaction.fields.getTextInputValue('min'))||0; sessions.set(userId, session); return showSettingsMenu(interaction, session, true); }

  } catch (err) {
    console.error('[PanelBuilder] Erro:', err);
    try {
      const reply = { embeds: [errorEmbed('Erro no construtor. Tente novamente.')], ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(()=>{});
      else await interaction.reply(reply).catch(()=>{});
    } catch {}
  }

  return true;
}

// ─────────────────────────────────────────
// EMBEDS E COMPONENTES
// ─────────────────────────────────────────
function mainEmbed(data) {
  return new EmbedBuilder()
    .setColor(data.color)
    .setTitle(`🛠️ Construtor — ${data.name}`)
    .addFields(
      { name: '📋 Nome', value: data.name, inline: true },
      { name: '🎨 Cor', value: `#${data.color.toString(16).padStart(6,'0')}`, inline: true },
      { name: '📡 Tipo Canal', value: data.channelType === 'thread' ? `Tópico de Fórum${data.forumChannelId ? ` (<#${data.forumChannelId}>)` : ' ⚠️ sem ID'}` : 'Canal de Texto', inline: true },
      { name: '🎛️ Opções', value: data.options.length > 0 ? data.options.map((o,i)=>`${i+1}. ${o.emoji||''} **${o.label}** (${o.type})`).join('\n') : '*Nenhuma*', inline: false },
      { name: '📦 Containers', value: data.containers.length > 0 ? data.containers.map((c,i)=>`${i+1}. ${c.blocks.length} bloco(s)${c.color?` • ${c.color}`:''}${c.spoiler?' • spoiler':''}`).join('\n') : '*Nenhum (padrão será usado)*', inline: false },
      { name: '👥 Staff', value: data.staffRoles.length>0?data.staffRoles.map(r=>`<@&${r}>`).join(' '):'*Não conf.*', inline: true },
      { name: '🛡️ Mod', value: data.modRoles.length>0?data.modRoles.map(r=>`<@&${r}>`).join(' '):'*Não conf.*', inline: true },
      { name: '🔍 Revisão', value: data.reviewRoles.length>0?data.reviewRoles.map(r=>`<@&${r}>`).join(' '):'*Não conf.*', inline: true },
    )
    .setFooter({ text: 'Configure todos os campos e clique em 💾 Salvar' });
}

function mainRows(pid) {
  return [
    new ActionRowBuilder().addComponents(
      btn(`pb_name_${pid}`, '📋 Nome', ButtonStyle.Secondary),
      btn(`pb_color_${pid}`, '🎨 Cor', ButtonStyle.Secondary),
      btn(`pb_channeltype_${pid}`, '📡 Tipo Canal', ButtonStyle.Secondary),
      btn(`pb_forumid_${pid}`, '🔗 ID Fórum', ButtonStyle.Secondary),
      btn(`pb_options_${pid}`, '🎛️ Opções', ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      btn(`pb_containers_${pid}`, '📦 Containers', ButtonStyle.Primary),
      btn(`pb_staffroles_${pid}`, '👥 Staff', ButtonStyle.Secondary),
      btn(`pb_modroles_${pid}`, '🛡️ Mod', ButtonStyle.Secondary),
      btn(`pb_reviewroles_${pid}`, '🔍 Revisão', ButtonStyle.Secondary),
      btn(`pb_reviewmsg_${pid}`, '💬 Msg Revisão', ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      btn(`pb_channels_${pid}`, '📢 Canais', ButtonStyle.Secondary),
      btn(`pb_settings_${pid}`, '⚙️ Config', ButtonStyle.Secondary),
      btn(`pb_save_${pid}`, '💾 Salvar', ButtonStyle.Success),
      btn(`pb_cancel_${pid}`, '❌ Cancelar', ButtonStyle.Danger),
    ),
  ];
}

// ── OPÇÕES ──
async function showOptionsMenu(interaction, session, isUpdate = false) {
  const pid = session.panelId;
  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎛️ Opções do Painel')
    .setDescription(session.data.options.length > 0
      ? session.data.options.map((o,i)=>`**${i+1}.** ${o.emoji||''} ${o.label} — \`${o.type}\``).join('\n')
      : '*Nenhuma opção ainda.*');

  const row = new ActionRowBuilder().addComponents(
    btn(`pb_opt_add_${pid}`, '➕ Adicionar', ButtonStyle.Success, session.data.options.length >= 5),
    btn(`pb_opt_remove_${pid}`, '➖ Remover', ButtonStyle.Danger, session.data.options.length === 0),
    btn(`pb_opt_back_${pid}`, '◀️ Voltar', ButtonStyle.Secondary),
  );

  const payload = { embeds: [embed], components: [row] };
  return isUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

async function showAddOptionModal(interaction) {
  const modal = new ModalBuilder().setCustomId('pb_m_addoption').setTitle('Adicionar Opção');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Label').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(10)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('type').setLabel('Tipo: button ou dropdown').setStyle(TextInputStyle.Short).setRequired(true).setValue('button')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Descrição (dropdown, opcional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)),
  );
  return interaction.showModal(modal);
}

async function addOption(interaction, session, userId) {
  await interaction.deferUpdate();
  const label = interaction.fields.getTextInputValue('label');
  const emoji = interaction.fields.getTextInputValue('emoji') || null;
  const type = interaction.fields.getTextInputValue('type').toLowerCase() === 'dropdown' ? 'dropdown' : 'button';
  const description = interaction.fields.getTextInputValue('description') || null;
  session.data.options.push({ id: generateId(), label, emoji, type, description, style: 1 });
  sessions.set(userId, session);
  return showOptionsMenu(interaction, session, true);
}

async function showRemoveOptionSelect(interaction, session) {
  if (session.data.options.length === 0) return;
  const rows = session.data.options.map((o, i) =>
    new ActionRowBuilder().addComponents(
      btn(`pb_opt_del_${i}`, `🗑️ ${o.label}`, ButtonStyle.Danger)
    )
  );
  rows.push(new ActionRowBuilder().addComponents(btn(`pb_opt_back_${session.panelId}`, '◀️ Voltar', ButtonStyle.Secondary)));
  return interaction.update({
    embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('Remover Opção').setDescription('Clique para remover:')],
    components: rows.slice(0, 5),
  });
}

// ── CONTAINERS ──
async function showContainersMenu(interaction, session, isUpdate = false) {
  const pid = session.panelId;
  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('📦 Containers')
    .setDescription(session.data.containers.length > 0
      ? session.data.containers.map((c,i)=>`**Container ${i+1}** — ${c.blocks.length} bloco(s)${c.color?` • cor ${c.color}`:''}${c.spoiler?' • spoiler':''}\n${c.blocks.map(b=>`  └ ${blockLabel(b)}`).join('\n')}`).join('\n\n')
      : '*Nenhum container. Clique em ➕ para adicionar.*');

  const rows = [];

  // Botões de containers existentes (editar/deletar)
  for (let i = 0; i < Math.min(session.data.containers.length, 4); i++) {
    rows.push(new ActionRowBuilder().addComponents(
      btn(`pb_cont_sel_${i}`, `✏️ Container ${i+1}`, ButtonStyle.Primary),
      btn(`pb_cont_del_${i}`, `🗑️`, ButtonStyle.Danger),
    ));
  }

  rows.push(new ActionRowBuilder().addComponents(
    btn(`pb_cont_add_${pid}`, '➕ Novo Container', ButtonStyle.Success, session.data.containers.length >= 10),
    btn(`pb_cont_back_${pid}`, '◀️ Voltar', ButtonStyle.Secondary),
  ));

  const payload = { embeds: [embed], components: rows };
  return isUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

async function addContainer(interaction, session, userId) {
  session.data.containers.push({ blocks: [], color: null, spoiler: false });
  sessions.set(userId, session);
  const idx = session.data.containers.length - 1;
  return showContainerEditor(interaction, session, idx);
}

async function showContainerEditor(interaction, session, idx) {
  const container = session.data.containers[idx];
  if (!container) return;

  const embed = new EmbedBuilder().setColor(0x5865F2)
    .setTitle(`📦 Container ${idx + 1}`)
    .setDescription(container.blocks.length > 0
      ? container.blocks.map((b,i)=>`**${i+1}.** ${blockLabel(b)}`).join('\n')
      : '*Vazio. Adicione blocos abaixo.*')
    .addFields(
      { name: 'Cor', value: container.color || '*nenhuma*', inline: true },
      { name: 'Spoiler', value: container.spoiler ? '✅' : '❌', inline: true },
    );

  const rows = [
    new ActionRowBuilder().addComponents(
      btn(`pb_blk_addtext_${idx}`, '📝 Texto', ButtonStyle.Secondary),
      btn(`pb_blk_addimg_${idx}`, '🖼️ Imagem', ButtonStyle.Secondary),
      btn(`pb_blk_addsep_${idx}`, '➖ Separador', ButtonStyle.Secondary),
      btn(`pb_blk_addactions_${idx}`, '🔘 Ações', ButtonStyle.Primary, container.blocks.some(b=>b.type==='actions')),
    ),
    new ActionRowBuilder().addComponents(
      btn(`pb_blk_color_${idx}`, '🎨 Cor', ButtonStyle.Secondary),
      btn(`pb_blk_spoiler_${idx}`, container.spoiler ? '👁️ Remover Spoiler' : '🙈 Spoiler', ButtonStyle.Secondary),
      btn(`pb_blk_clearlast_${idx}`, '↩️ Remover Último', ButtonStyle.Danger, container.blocks.length === 0),
      btn(`pb_blk_back_${idx}`, '◀️ Voltar', ButtonStyle.Secondary),
    ),
  ];

  return interaction.update({ embeds: [embed], components: rows });
}

// ── CANAIS ──
async function showChannelsMenu(interaction, session, isUpdate = false) {
  const pid = session.panelId;
  const d = session.data;
  const ch = id => id ? `<#${id}>` : '*Não conf.*';

  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('📢 Canais')
    .addFields(
      { name: '📋 Log', value: ch(d.logChannelId), inline: true },
      { name: '👥 Staff', value: ch(d.staffChannelId), inline: true },
      { name: '🆘 Auxiliar', value: ch(d.auxChannelId), inline: true },
      { name: '🔄 Re-Reivindicação', value: ch(d.reclaimChannelId), inline: true },
      { name: '📁 Categoria', value: ch(d.categoryId), inline: true },
      { name: '📦 Arquivo', value: ch(d.archiveCategoryId), inline: true },
    );

  const rows = [
    new ActionRowBuilder().addComponents(
      btn(`pb_ch_log_${pid}`, '📋 Log', ButtonStyle.Secondary),
      btn(`pb_ch_staff_${pid}`, '👥 Staff', ButtonStyle.Secondary),
      btn(`pb_ch_aux_${pid}`, '🆘 Auxiliar', ButtonStyle.Secondary),
      btn(`pb_ch_reclaim_${pid}`, '🔄 Re-Reivindicação', ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      btn(`pb_ch_category_${pid}`, '📁 Categoria', ButtonStyle.Secondary),
      btn(`pb_ch_archive_${pid}`, '📦 Arquivo', ButtonStyle.Secondary),
      btn(`pb_ch_back_${pid}`, '◀️ Voltar', ButtonStyle.Primary),
    ),
  ];

  const payload = { embeds: [embed], components: rows };
  return isUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

// ── SETTINGS ──
async function showSettingsMenu(interaction, session, isUpdate = false) {
  const pid = session.panelId;
  const d = session.data;

  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('⚙️ Configurações')
    .addFields(
      { name: '🚫 Blacklist', value: d.useBlacklist ? '✅ Ativada' : '❌ Desativada', inline: true },
      { name: '📝 Pedir Motivo', value: d.requireReason ? '✅ Sim' : '❌ Não', inline: true },
      { name: '📦 Arquivar ao Fechar', value: d.archiveOnClose ? '✅ Sim' : '❌ Deletar', inline: true },
      { name: '⏰ Auto-Fechar', value: d.autoCloseMinutes > 0 ? `${d.autoCloseMinutes} min` : '❌ Desativado', inline: true },
    );

  const row = new ActionRowBuilder().addComponents(
    btn(`pb_set_blacklist_${pid}`, '🚫 Blacklist', d.useBlacklist ? ButtonStyle.Success : ButtonStyle.Secondary),
    btn(`pb_set_reason_${pid}`, '📝 Motivo', d.requireReason ? ButtonStyle.Success : ButtonStyle.Secondary),
    btn(`pb_set_archive_${pid}`, '📦 Arquivar', d.archiveOnClose ? ButtonStyle.Success : ButtonStyle.Secondary),
    btn(`pb_set_autoclose_${pid}`, '⏰ Auto-Fechar', ButtonStyle.Secondary),
    btn(`pb_set_back_${pid}`, '◀️ Voltar', ButtonStyle.Primary),
  );

  const payload = { embeds: [embed], components: [row] };
  return isUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });
}

// ── SALVAR ──
async function saveAndFinish(interaction, session) {
  if (!session.data.name) return interaction.reply({ embeds: [errorEmbed('Defina um nome.')], ephemeral: true });
  if (session.data.options.length === 0) return interaction.reply({ embeds: [errorEmbed('Adicione pelo menos uma opção.')], ephemeral: true });

  session.data.createdAt = Date.now();
  session.data.createdBy = interaction.user.id;
  savePanel(session.panelId, session.data);
  sessions.delete(interaction.user.id);

  return interaction.update({
    embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('✅ Painel Salvo!').setDescription(`**${session.data.name}** salvo com ID \`${session.panelId}\`.\n\nUse \`/enviar-painel id:${session.panelId}\` para enviá-lo.`)],
    components: [],
  });
}

// ── TOGGLES ──
async function toggleChannelType(interaction, session) {
  session.data.channelType = session.data.channelType === 'text' ? 'thread' : 'text';
  sessions.set(interaction.user.id, session);
  return interaction.update({ embeds: [mainEmbed(session.data)], components: mainRows(session.panelId) });
}

// ── UTILS ──
function btn(customId, label, style, disabled = false) {
  return new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style).setDisabled(disabled);
}

function parseRoles(str) {
  return str.split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s));
}

function blockLabel(b) {
  if (b.type === 'text') return `📝 Texto: "${b.content?.substring(0,30)}${b.content?.length>30?'...':''}"`;
  if (b.type === 'image') return `🖼️ Imagem: ${b.url?.substring(0,40)}`;
  if (b.type === 'separator') return '➖ Separador';
  if (b.type === 'actions') return '🔘 Ações (botões/dropdown)';
  return b.type;
}

async function showModal(interaction, title, customId, fieldId, label, value = '') {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(fieldId).setLabel(label).setStyle(TextInputStyle.Short).setValue(String(value)).setRequired(false)
  ));
  return interaction.showModal(modal);
}

async function showModalLong(interaction, title, customId, fieldId, label, value = '') {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId(fieldId).setLabel(label).setStyle(TextInputStyle.Paragraph).setValue(String(value)).setRequired(false)
  ));
  return interaction.showModal(modal);
}

module.exports = { startPanelCreation, handleBuilderInteraction };
