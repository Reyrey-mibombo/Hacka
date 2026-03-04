import authService from './authService.js';
import guildService from './guildService.js';
import staffService from './staffService.js';
import shiftService from './shiftService.js';
import warningService from './warningService.js';
import promotionService from './promotionService.js';
import leaderboardService from './leaderboardService.js';
import systemSettingsService from './systemSettingsService.js';
import ticketService from './ticketService.js';
import customCommandService from './customCommandService.js';
import activityLogService from './activityLogService.js';
import websocketService from './websocketService.js';
import discordService from './discordService.js';

export {
  authService,
  guildService,
  staffService,
  shiftService,
  warningService,
  promotionService,
  leaderboardService,
  systemSettingsService,
  ticketService,
  customCommandService,
  activityLogService,
  websocketService,
  discordService
};

export default {
  auth: authService,
  guild: guildService,
  staff: staffService,
  shift: shiftService,
  warning: warningService,
  promotion: promotionService,
  leaderboard: leaderboardService,
  systemSettings: systemSettingsService,
  ticket: ticketService,
  customCommand: customCommandService,
  activityLog: activityLogService,
  websocket: websocketService,
  discord: discordService
};
