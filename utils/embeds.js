const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

/**
 * Embed padrão de erro
 */
function errorEmbed(msg) {
  return new EmbedBuilder()
    .setColor(0xFF4444)
    .setDescription(`❌ ${msg}`);
}

/**
 * Embed padrão de sucesso
 */
function successEmbed(msg) {
  return new EmbedBuilder()
    .setColor(0x44FF88)
    .setDescription(`✅ ${msg}`);
}

/**
 * Embed padrão de info
 */
function infoEmbed(title, msg) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setDescription(msg);
}

/**
 * Botões iniciais do ticket
 */
function ticketButtons(ticketId) {
  const close = new ButtonBuilder()
    .setCustomId(`ticket_close_${ticketId}`)
    .setLabel('Fechar')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger);

  const claim = new ButtonBuilder()
    .setCustomId(`ticket_claim_${ticketId}`)
    .setLabel('Reivindicar')
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Primary);

  const modMenu = new ButtonBuilder()
    .setCustomId(`ticket_mod_menu_${ticketId}`)
    .setLabel('Moderação')
    .setEmoji('⚙️')
    .setStyle(ButtonStyle.Secondary);

  return new ActionRowBuilder().addComponents(close, claim, modMenu);
}

/**
 * Dropdown menu de moderação
 */
function modDropdown(ticketId) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_mod_action_${ticketId}`)
    .setPlaceholder('Selecione uma ação de moderação')
    .addOptions([
      { label: 'Finalizar Ticket', value: 'finalize', emoji: '✅', description: 'Remove o usuário e notifica a moderação' },
      { label: 'Solicitar Auxiliar', value: 'aux', emoji: '🆘', description: 'Solicita ajuda de outro atendente' },
      { label: 'Solicitar Re-Reivindicação', value: 'reclaim', emoji: '🔄', description: 'Solicita troca de atendente' },
      { label: 'Adicionar Membro', value: 'add_member', emoji: '➕', description: 'Adiciona um membro ao ticket' },
      { label: 'Remover Membro', value: 'remove_member', emoji: '➖', description: 'Remove um membro do ticket' },
    ]);

  return new ActionRowBuilder().addComponents(menu);
}

/**
 * Botão de ir ao ticket (canal staff)
 */
function goToTicketButton(ticketId, channelId) {
  const btn = new ButtonBuilder()
    .setLabel('Ir ao Ticket')
    .setEmoji('🎫')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://discord.com/channels/0/${channelId}`);

  // Botão de reivindicar inline na msg da staff
  const claim = new ButtonBuilder()
    .setCustomId(`ticket_claim_${ticketId}`)
    .setLabel('Reivindicar')
    .setEmoji('🙋')
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder().addComponents(claim, btn);
}

module.exports = {
  errorEmbed, successEmbed, infoEmbed,
  ticketButtons, modDropdown, goToTicketButton
};
