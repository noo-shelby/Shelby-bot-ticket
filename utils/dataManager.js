const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data');

function readJSON(filename) {
  const file = path.join(dataPath, filename);
  if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeJSON(filename, data) {
  const file = path.join(dataPath, filename);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// PANELS
function getPanels() { return readJSON('panels.json'); }
function savePanel(id, data) {
  const panels = getPanels();
  panels[id] = data;
  writeJSON('panels.json', panels);
}
function deletePanel(id) {
  const panels = getPanels();
  delete panels[id];
  writeJSON('panels.json', panels);
}
function getPanel(id) { return getPanels()[id] || null; }

// TICKETS
function getTickets() { return readJSON('tickets.json'); }
function saveTicket(channelId, data) {
  const tickets = getTickets();
  tickets[channelId] = data;
  writeJSON('tickets.json', tickets);
}
function deleteTicket(channelId) {
  const tickets = getTickets();
  delete tickets[channelId];
  writeJSON('tickets.json', tickets);
}
function getTicket(channelId) { return getTickets()[channelId] || null; }

// CONFIG
function getConfig() { return readJSON('config.json'); }
function saveConfig(data) { writeJSON('config.json', data); }

// BLACKLIST
function getBlacklist() { return readJSON('blacklist.json'); }
function addToBlacklist(guildId, userId) {
  const bl = getBlacklist();
  if (!bl[guildId]) bl[guildId] = [];
  if (!bl[guildId].includes(userId)) bl[guildId].push(userId);
  writeJSON('blacklist.json', bl);
}
function removeFromBlacklist(guildId, userId) {
  const bl = getBlacklist();
  if (!bl[guildId]) return;
  bl[guildId] = bl[guildId].filter(id => id !== userId);
  writeJSON('blacklist.json', bl);
}
function isBlacklisted(guildId, userId) {
  const bl = getBlacklist();
  return bl[guildId] ? bl[guildId].includes(userId) : false;
}

module.exports = {
  getPanels, savePanel, deletePanel, getPanel,
  getTickets, saveTicket, deleteTicket, getTicket,
  getConfig, saveConfig,
  getBlacklist, addToBlacklist, removeFromBlacklist, isBlacklisted
};
