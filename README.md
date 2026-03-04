# STRATA Discord Bot Dashboard

A comprehensive SaaS dashboard for managing Discord bot features across all servers. Built with Node.js, Express, SQLite, and vanilla JavaScript.

## Features

### Staff Management
- Staff roster with ranks and permissions
- Shift tracking with automatic point calculation
- Promotion requirements and auto-promotion
- Warning system with severity levels
- Activity logging and leaderboards

### Leveling System
- XP tracking with customizable rates
- Level-up rewards and roles
- Message and voice activity tracking
- Leaderboards and progress tracking
- Import/export functionality

### Reaction Roles
- Self-assignable role panels
- Multiple panels per server
- Unique or stackable roles
- Emoji-based role assignment

### Giveaway System
- Giveaway creation with requirements
- Entry tracking and winner selection
- Reroll functionality
- Duration and prize management

### Moderation Tools
- Ban, kick, warn, timeout users
- Moderation action history
- Warning management with expiration
- Custom reason tracking

### Auto-Moderation
- Spam detection
- Word/invite filtering
- Mention spam protection
- Caps lock detection
- Configurable actions (warn, delete, timeout, ban)

### Server Statistics
- Daily, hourly activity tracking
- Member growth analytics
- Voice channel statistics
- Message activity heatmaps
- Export to CSV/JSON

### Economy System
- Currency management
- Daily rewards
- Shop with role rewards
- Balance tracking
- Leaderboards

### Welcome System
- Custom welcome messages
- DM welcome option
- Autorole assignment
- Verification system

### Logging
- Member events (join/leave)
- Message events (delete/edit)
- Moderation actions
- Role changes
- Voice channel activity

### Custom Commands
- User-defined bot responses
- Exact, starts with, or contains matching
- Embed support
- Enable/disable toggle

## Installation

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Discord Application with OAuth2 configured

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd strata-dashboard
```

2. Install dependencies:
```bash
cd backend
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables:
```env
PORT=3000
NODE_ENV=development
DB_PATH=./database/strata.db

# Discord OAuth2
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/callback

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:8080
```

5. Initialize database:
```bash
npm run seed
```

6. Start the server:
```bash
npm start
```

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

## Project Structure

```
strata-dashboard/
├── backend/
│   ├── database/
│   │   ├── connection.js    # Database connection
│   │   └── schema.sql       # Database schema
│   ├── routes/
│   │   ├── auth.js          # Discord OAuth
│   │   ├── dashboard.js     # Main dashboard routes
│   │   ├── guild.js         # Guild settings
│   │   ├── moderation.js    # Moderation actions
│   │   ├── systems.js       # System configs
│   │   ├── leveling.js      # Leveling system
│   │   ├── reactionRoles.js # Reaction roles
│   │   ├── giveaways.js     # Giveaways
│   │   ├── analytics.js     # Statistics
│   │   └── extended.js      # Economy & extended features
│   ├── scripts/
│   │   └── seed.js          # Sample data
│   ├── server.js            # Express server
│   └── package.json
├── frontend/
│   ├── index.html           # Main dashboard
│   ├── dashboard.js         # Frontend logic
│   └── style.css            # Styles
└── README.md
```

## API Documentation

### Authentication

All protected endpoints require Discord OAuth2 Bearer token:
```
Authorization: Bearer <discord_access_token>
```

### Endpoints

#### Dashboard
- `GET /api/dashboard/stats` - Public statistics
- `GET /api/dashboard/guilds` - User's managed guilds
- `GET /api/dashboard/guild/:id` - Guild overview
- `GET /api/dashboard/guild/:id/staff` - Staff list
- `GET /api/dashboard/guild/:id/shifts` - Shift logs
- `GET /api/dashboard/guild/:id/warnings` - Warning logs
- `GET /api/dashboard/guild/:id/leaderboard` - Staff leaderboard

#### Leveling System
- `GET /api/dashboard/guild/:id/leveling/config` - Get configuration
- `PATCH /api/dashboard/guild/:id/leveling/config` - Update configuration
- `GET /api/dashboard/guild/:id/leveling/roles` - Get level roles
- `POST /api/dashboard/guild/:id/leveling/roles` - Add level role
- `DELETE /api/dashboard/guild/:id/leveling/roles/:roleId` - Delete level role
- `GET /api/dashboard/guild/:id/leveling/leaderboard` - XP leaderboard
- `GET /api/dashboard/guild/:id/leveling/users/:userId` - User level details
- `POST /api/dashboard/guild/:id/leveling/users/:userId/add-xp` - Add XP

#### Reaction Roles
- `GET /api/dashboard/guild/:id/reaction-roles` - Get all panels
- `GET /api/dashboard/guild/:id/reaction-roles/:panelId` - Get single panel
- `POST /api/dashboard/guild/:id/reaction-roles` - Create panel
- `PATCH /api/dashboard/guild/:id/reaction-roles/:panelId` - Update panel
- `DELETE /api/dashboard/guild/:id/reaction-roles/:panelId` - Delete panel

#### Giveaways
- `GET /api/dashboard/guild/:id/giveaways` - Get all giveaways
- `GET /api/dashboard/guild/:id/giveaways/:giveawayId` - Get single giveaway
- `POST /api/dashboard/guild/:id/giveaways` - Create giveaway
- `PATCH /api/dashboard/guild/:id/giveaways/:giveawayId` - Update giveaway
- `POST /api/dashboard/guild/:id/giveaways/:giveawayId/end` - End early
- `POST /api/dashboard/guild/:id/giveaways/:giveawayId/draw` - Draw winners
- `POST /api/dashboard/guild/:id/giveaways/:giveawayId/reroll` - Reroll winner

#### Analytics
- `GET /api/dashboard/guild/:id/analytics/overview` - Server overview
- `GET /api/dashboard/guild/:id/analytics/daily` - Daily stats
- `GET /api/dashboard/guild/:id/analytics/heatmap` - Activity heatmap
- `GET /api/dashboard/guild/:id/analytics/members` - Member activity
- `GET /api/dashboard/guild/:id/analytics/growth` - Growth metrics
- `GET /api/dashboard/guild/:id/analytics/export` - Export data

#### Economy
- `GET /api/dashboard/guild/:id/economy/config` - Economy configuration
- `PATCH /api/dashboard/guild/:id/economy/config` - Update configuration
- `GET /api/dashboard/guild/:id/economy/leaderboard` - Richest users
- `GET /api/dashboard/guild/:id/economy/shop` - Shop items
- `POST /api/dashboard/guild/:id/economy/shop` - Add shop item

#### Moderation
- `GET /api/dashboard/guild/:id/moderation/actions` - Moderation history
- `POST /api/dashboard/guild/:id/moderation/ban` - Ban user
- `POST /api/dashboard/guild/:id/moderation/kick` - Kick user
- `POST /api/dashboard/guild/:id/moderation/warn` - Warn user
- `POST /api/dashboard/guild/:id/moderation/mute` - Timeout user

### Systems Configuration

All systems follow the same pattern:
- `GET /api/dashboard/guild/:id/systems/:system` - Get configuration
- `PATCH /api/dashboard/guild/:id/systems/:system` - Update configuration

Available systems: `automod`, `welcome`, `autorole`, `logging`, `antispam`, `tickets`

## Database Schema

### Core Tables
- `guilds` - Server configurations
- `guild_members` - Member data
- `staff_profiles` - Extended staff data
- `shifts` - Work shift tracking
- `warnings` - Moderation warnings
- `moderation_actions` - Ban/kick/timeout logs
- `activity_logs` - General activity

### Feature Tables
- `leveling_config` - Leveling settings
- `level_roles` - Level role rewards
- `user_levels` - Member XP/levels
- `reaction_role_panels` - RR panels
- `reaction_roles` - Individual RR entries
- `giveaways` - Giveaway data
- `giveaway_entries` - Giveaway participants
- `daily_stats` - Daily server stats
- `member_activity` - Per-member activity
- `economy_config` - Currency settings
- `user_economy` - User balances
- `shop_items` - Shop inventory
- `automod_rules` - Auto-mod rules

## Discord Bot Integration

To integrate this dashboard with your Discord bot:

1. Create a Discord application at https://discord.com/developers/applications
2. Add OAuth2 redirect URL: `http://your-domain/auth/callback`
3. Copy Client ID and Secret to `.env`
4. Bot should sync data via API calls:

### Example: Recording Message XP
```javascript
// When a message is sent
fetch(`${API_BASE}/api/dashboard/guild/${guildId}/analytics/member-activity`, {
    method: 'POST',
    headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        userId: member.id,
        username: member.username,
        messageCount: 1,
        xpEarned: xpGained
    })
});
```

### Example: Level Up Check
```javascript
// After adding XP, check for level up
const userLevel = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/leveling/users/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
});

const data = await userLevel.json();
if (data.progressPercent >= 100) {
    // User leveled up - assign role, send message, etc.
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `DB_PATH` | SQLite database path | ./database/strata.db |
| `DISCORD_CLIENT_ID` | Discord app client ID | - |
| `DISCORD_CLIENT_SECRET` | Discord app secret | - |
| `DISCORD_REDIRECT_URI` | OAuth callback URL | - |
| `FRONTEND_URL` | CORS allowed origin | * |

## Security Considerations

1. Always use HTTPS in production
2. Store database file outside web root
3. Keep Discord client secret secure
4. Implement rate limiting (included)
5. Validate all user inputs
6. Use prepared statements (SQLite)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support, join our Discord server or create an issue on GitHub.

---

Built for [reynerabdon14](https://newworkspace-d8i3453.slack.com/archives/D0AHX76RKKR/p1772653550285179?thread_ts=1772579600.412499&cid=D0AHX76RKKR) by [Kilo for Slack](https://kilo.ai/features/slack-integration)
