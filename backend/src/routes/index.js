import express from 'express';
import authRoutes from './auth.js';
import guildsRoutes from './guilds.js';
import staffRoutes from './staff.js';
import shiftsRoutes from './shifts.js';
import warningsRoutes from './warnings.js';
import promotionsRoutes from './promotions.js';
import leaderboardRoutes from './leaderboard.js';
import systemsRoutes from './systems.js';
import ticketsRoutes from './tickets.js';
import customCommandsRoutes from './customCommands.js';
import activityRoutes from './activity.js';
import dashboardRoutes from './dashboard.js';

const router = express.Router();

router.use('/auth', authRoutes);

router.use('/guilds', guildsRoutes);
router.use('/guilds/:guildId/staff', staffRoutes);
router.use('/guilds/:guildId/shifts', shiftsRoutes);
router.use('/guilds/:guildId/warnings', warningsRoutes);
router.use('/guilds/:guildId/promotions', promotionsRoutes);
router.use('/guilds/:guildId/leaderboard', leaderboardRoutes);
router.use('/guilds/:guildId/systems', systemsRoutes);
router.use('/guilds/:guildId/tickets', ticketsRoutes);
router.use('/guilds/:guildId/commands', customCommandsRoutes);
router.use('/guilds/:guildId/activity', activityRoutes);

router.use('/dashboard', dashboardRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

export const mountRoutes = (app) => {
  app.use('/api/v1', router);

  app.use('/api/v1/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: 'The requested API endpoint does not exist'
    });
  });

  app.use((err, req, res, next) => {
    console.error('API Error:', err);

    if (err.name === 'UnauthorizedError') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token'
      });
    }

    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: err.message,
        errors: err.errors
      });
    }

    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid ID format'
      });
    }

    res.status(err.status || 500).json({
      success: false,
      error: err.name || 'Internal Server Error',
      message: err.message || 'An unexpected error occurred'
    });
  });

  return app;
};

export {
  authRoutes,
  guildsRoutes,
  staffRoutes,
  shiftsRoutes,
  warningsRoutes,
  promotionsRoutes,
  leaderboardRoutes,
  systemsRoutes,
  ticketsRoutes,
  customCommandsRoutes,
  activityRoutes,
  dashboardRoutes
};

export default router;
