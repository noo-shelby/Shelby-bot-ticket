const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, SectionBuilder, MessageFlags
} = require('discord.js');

/**
 * Constrói e envia o painel para um canal usando Components V2
 */
async function buildPanelMessage(channel, panel, panelId) {
  const hasButtons = panel.options.some(o => o.type === 'button');
  const hasDropdown = panel.options.some(o => o.type === 'dropdown');

  // Tenta usar Components V2 (container) se disponível
  try {
    await sendWithComponentsV2(channel, panel, panelId);
  } catch (err) {
    // Fallback para embed tradicional
    console.warn('[PanelSender] Components V2 falhou, usando embed tradicional:', err.message);
    await sendWithEmbed(channel, panel, panelId);
  }
}

/**
 * Envia com Components V2 (IS_COMPONENTS_V2)
 */
async function sendWithComponentsV2(channel, panel, panelId) {
  const embed = new EmbedBuilder()
    .setColor(panel.color || 0x5865F2)
    .setTitle(panel.embedTitle || panel.name)
    .setDescription(panel.embedDescription || 'Clique abaixo para abrir um ticket.')
    .setTimestamp();

  if (panel.embedImage) embed.setImage(panel.embedImage);
  if (panel.embedThumbnail) embed.setThumbnail(panel.embedThumbnail);
  if (panel.embedFooter) embed.setFooter({ text: panel.embedFooter });

  const components = buildComponents(panel, panelId);

  await channel.send({
    embeds: [embed],
    components,
    flags: panel.useComponentsV2 ? [MessageFlags.IsComponentsV2] : [],
  });
}

/**
 * Envia embed tradicional com componentes
 */
async function sendWithEmbed(channel, panel, panelId) {
  const embed = new EmbedBuilder()
    .setColor(panel.color || 0x5865F2)
    .setTitle(panel.embedTitle || panel.name)
    .setDescription(panel.embedDescription || 'Clique abaixo para abrir um ticket.')
    .setTimestamp();

  if (panel.embedImage) embed.setImage(panel.embedImage);
  if (panel.embedThumbnail) embed.setThumbnail(panel.embedThumbnail);
  if (panel.embedFooter) embed.setFooter({ text: panel.embedFooter });

  const components = buildComponents(panel, panelId);
  await channel.send({ embeds: [embed], components });
}

/**
 * Constrói os componentes de acordo com o tipo de opções
 */
function buildComponents(panel, panelId) {
  const buttons = panel.options.filter(o => o.type === 'button');
  const dropdowns = panel.options.filter(o => o.type === 'dropdown');

  const rows = [];

  // Botões (máx 5 por row)
  if (buttons.length > 0) {
    const chunks = chunkArray(buttons, 5);
    for (const chunk of chunks) {
      const row = new ActionRowBuilder();
      chunk.forEach(opt => {
        const btn = new ButtonBuilder()
          .setCustomId(`ticket_open_${panelId}_${opt.id}`)
          .setLabel(opt.label)
          .setStyle(ButtonStyle.Primary);
        if (opt.emoji) btn.setEmoji(opt.emoji);
        row.addComponents(btn);
      });
      rows.push(row);
    }
  }

  // Dropdown
  if (dropdowns.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`ticket_open_dropdown_${panelId}`)
      .setPlaceholder(panel.dropdownPlaceholder || 'Selecione uma categoria...')
      .addOptions(
        dropdowns.map(opt => {
          const option = { label: opt.label, value: `${panelId}_${opt.id}` };
          if (opt.description) option.description = opt.description;
          if (opt.emoji) option.emoji = opt.emoji;
          return option;
        })
      );

    rows.push(new ActionRowBuilder().addComponents(select));
  }

  return rows;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

module.exports = { buildPanelMessage };
