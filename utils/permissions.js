/**
 * Verifica se um membro possui algum dos cargos listados
 * @param {GuildMember} member
 * @param {string[]} roleIds
 */
function hasRole(member, roleIds = []) {
  if (!roleIds || roleIds.length === 0) return false;
  return roleIds.some(id => member.roles.cache.has(id));
}

/**
 * Verifica se membro pode atender tickets (cargos de atendimento)
 * @param {GuildMember} member
 * @param {Object} panelConfig
 */
function canAttend(member, panelConfig) {
  if (member.permissions.has('Administrator')) return true;
  return hasRole(member, panelConfig.staffRoles || []);
}

/**
 * Verifica se membro pode moderar tickets (arquivar/fechar)
 * @param {GuildMember} member
 * @param {Object} panelConfig
 */
function canModerate(member, panelConfig) {
  if (member.permissions.has('Administrator')) return true;
  return hasRole(member, panelConfig.modRoles || []);
}

/**
 * Verifica se membro pode gerenciar painéis (admin ou permissão)
 * @param {GuildMember} member
 */
function canManagePanels(member) {
  return member.permissions.has('Administrator') ||
    member.permissions.has('ManageGuild');
}

module.exports = { hasRole, canAttend, canModerate, canManagePanels };
