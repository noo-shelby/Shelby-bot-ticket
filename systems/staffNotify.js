// Re-exporta as funções de notificação da staff centralizadas
const { requestReclaim, requestAuxiliar } = require('../handlers/ticketReclaim');

module.exports = { requestReclaim, requestAuxiliar };
