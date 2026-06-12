const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

/**
 * Monta e envia o painel usando Components V2 (IS_COMPONENTS_V2)
 * com múltiplos containers, imagens, textos, separadores e ações
 */
async function buildPanelMessage(channel, panel, panelId) {
  try {
    const payload = buildComponentsV2Payload(panel, panelId);
    await channel.send(payload);
  } catch (err) {
    console.error('[PanelSender] Erro ao enviar painel:', err);
    throw err;
  }
}

function buildComponentsV2Payload(panel, panelId) {
  const containers = panel.containers || [];
  const components = [];

  for (const container of containers) {
    const containerComponent = buildContainer(container, panel, panelId);
    if (containerComponent) components.push(containerComponent);
  }

  if (components.length === 0) {
    components.push(buildDefaultContainer(panel, panelId));
  }

  return {
    components,
    flags: 1 << 15, // IS_COMPONENTS_V2
  };
}

function buildContainer(container, panel, panelId) {
  const children = [];

  for (const block of (container.blocks || [])) {
    switch (block.type) {
      case 'text':
        if (block.content) {
          children.push({
            type: 10,
            content: block.content,
          });
        }
        break;

      case 'image':
        if (block.url) {
          children.push({
            type: 11,
            items: [{ media: { url: block.url }, description: block.alt || '' }],
          });
        }
        break;

      case 'separator':
        children.push({
          type: 14,
          divider: true,
          spacing: block.spacing || 1,
        });
        break;

      case 'actions':
        const actionRows = buildActionRows(panel, panelId);
        children.push(...actionRows);
        break;
    }
  }

  if (children.length === 0) return null;

  const comp = {
    type: 17,
    components: children,
  };

  if (container.color) {
    const hex = String(container.color).replace('#', '');
    const num = parseInt(hex, 16);
    if (!isNaN(num)) comp.accent_color = num;
  }

  if (container.spoiler) comp.spoiler = true;

  return comp;
}

function buildDefaultContainer(panel, panelId) {
  const children = [];

  children.push({
    type: 10,
    content: `## ${panel.name || 'Painel de Tickets'}\nClique abaixo para abrir um ticket.`,
  });

  children.push({ type: 14, divider: true, spacing: 1 });

  const actionRows = buildActionRows(panel, panelId);
  children.push(...actionRows);

  return {
    type: 17,
    accent_color: panel.color || 0x5865F2,
    components: children,
  };
}

function buildActionRows(panel, panelId) {
  const rows = [];
  const buttons = (panel.options || []).filter(o => o.type === 'button');
  const dropdowns = (panel.options || []).filter(o => o.type === 'dropdown');

  const chunks = chunkArray(buttons, 5);
  for (const chunk of chunks) {
    rows.push({
      type: 1,
      components: chunk.map(opt => ({
        type: 2,
        custom_id: `ticket_open_${panelId}_${opt.id}`,
        label: opt.label,
        style: opt.style || 1,
        ...(opt.emoji ? { emoji: { name: opt.emoji } } : {}),
      })),
    });
  }

  if (dropdowns.length > 0) {
    rows.push({
      type: 1,
      components: [{
        type: 3,
        custom_id: `ticket_open_dropdown_${panelId}`,
        placeholder: panel.dropdownPlaceholder || 'Selecione uma categoria...',
        options: dropdowns.map(opt => ({
          label: opt.label,
          value: `${panelId}_${opt.id}`,
          ...(opt.description ? { description: opt.description } : {}),
          ...(opt.emoji ? { emoji: { name: opt.emoji } } : {}),
        })),
      }],
    });
  }

  return rows;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

module.exports = { buildPanelMessage };
