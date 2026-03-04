# Hacka / STRATA Discord Dashboard

A comprehensive full-stack dashboard for Discord bot management. Transform your Discord server management with powerful automation, real-time analytics, and intuitive staff management tools.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

Hacka (also known as STRATA) is a powerful Discord bot dashboard that provides server administrators with a complete suite of tools for managing their Discord communities. From automated moderation to staff management, leveling systems to economy features, this dashboard transforms frontend concepts into a fully functional full-stack application.

## Features

### Welcome System
- Customizable welcome messages with embeds
- Auto-role assignment for new members
- Welcome channel configuration
- Personalized greeting templates with user variables

### Moderation System
- **Ban/Kick**: Permanent and temporary removal tools with reason logging
- **Warn**: Warning system with escalating punishment tiers
- **Mute/Timeout**: Temporary restriction of user messaging capabilities
- **Softban**: Kick users while deleting their recent messages
- **Mass actions**: Bulk ban/kick capabilities for raid protection
- **Mod logs**: Complete audit trail of all moderation actions

### Auto-Moderation
- **Anti-Spam**: Configurable message rate limits and duplicate detection
- **Anti-Link**: Block or whitelist specific URLs and domains
- **Word Filter**: Customizable banned word lists with regex support
- **Mention Spam**: Protection against excessive @mentions
- **Caps Lock Filter**: Limit excessive capital letters
- **Attachment Filter**: Control file uploads by type and size
- **Auto-actions**: Automatic mutes, warnings, or kicks for violations

### Leveling System
- **XP Tracking**: Message-based experience points with cooldowns
- **Rank Cards**: Customizable rank card displays
- **Leaderboards**: Server-wide and global leaderboards
- **Role Rewards**: Automatic role assignment at level milestones
- **Level-Up Notifications**: Customizable announcements
- **Voice XP**: Optional XP gain in voice channels
- **Multipliers**: Boosted XP rates for specific channels or roles

### Economy System
- **Currency**: Custom server currency with wallet and bank
- **Shop System**: Item creation and purchase management
- **Games**: Built-in gambling and economy games (slots, blackjack, etc.)
- **Daily Rewards**: Streak-based daily currency claims
- **Work System**: Jobs and work commands for earning
- **Transfer System**: User-to-user currency transfers
- **Leaderboards**: Richest users rankings

### Ticket System
- **Support Tickets**: User-initiated support channels
- **Ticket Categories**: Multiple ticket types with different routing
- **Transcripts**: Complete conversation logging and export
- **Auto-Assignment**: Round-robin or load-balanced staff assignment
- **Custom Forms**: Pre-ticket information collection
- **Ticket Analytics**: Response time and resolution tracking

### Reaction Roles
- **Message Reactions**: Add/remove roles via emoji reactions
- **Toggle Roles**: Users can toggle roles on/off
- **Unique Roles**: Mutually exclusive role groups
- **Requirements**: Role prerequisites for accessing certain roles
- **Timed Roles**: Temporary roles that expire after duration

### Custom Commands
- **Text Responses**: Custom trigger phrases with bot responses
- **Variables**: Dynamic content with user/server data
- **Embeds**: Rich embed responses with custom formatting
- **DM Commands**: Private message delivery options
- **Role-gated**: Commands restricted to specific roles
- **Cooldowns**: Per-command rate limiting

### Logging System
- **Message Logs**: Edit and delete tracking
- **Member Logs**: Join, leave, and profile change tracking
- **Voice Logs**: Channel join/leave and server mute/deafen
- **Mod Logs**: Complete moderation action history
- **Server Logs**: Channel/role creation, deletion, and updates
- **Webhook Integration**: Export logs to external systems

### Giveaway System
- **Creation**: Easy giveaway setup with duration and winner count
- **Requirements**: Role or message requirements to enter
- **Multiple Winners**: Random winner selection
- **Reroll**: Ability to redraw winners if needed
- **Statistics**: Giveaway participation analytics

### Polls/Voting System
- **Quick Polls**: Simple yes/no or multi-option polls
- **Timed Polls**: Automatic poll closure after duration
- **Anonymous Voting**: Hide voter identities
- **Results Display**: Real-time or post-close result viewing
- **Role Restriction**: Limit voting to specific roles

### Server Statistics & Analytics
- **Member Growth**: Join/leave trends over time
- **Activity Metrics**: Message and voice activity tracking
- **Command Usage**: Popular commands and usage statistics
- **Staff Performance**: Moderation and ticket handling metrics
- **Real-time Dashboard**: Live server statistics via WebSocket
- **Export Reports**: Data export for external analysis

### Backup System
- **Server Backups**: Complete server configuration snapshots
- **Scheduled Backups**: Automated backup creation
- **Selective Restore**: Choose specific elements to restore
- **Cloud Storage**: Backup storage with download options
- **Version History**: Multiple backup retention

## Tech Stack

### Frontend
- **HTML5**: Semantic markup and structure
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **JavaScript (Vanilla)**: No framework dependency for lightweight performance
- **Chart.js**: Data visualization for analytics

### Backend
- **Node.js**: JavaScript runtime (v18+)
- **Express.js**: Web application framework
- **ES Modules**: Modern JavaScript module system

### Database
- **MongoDB**: Document-based NoSQL database
- **Mongoose**: MongoDB object modeling for Node.js

### Real-time Communication
- **WebSocket (ws)**: Real-time bidirectional communication
- **Socket Broadcasting**: Live updates to connected clients

### Authentication & Security
- **Discord OAuth2**: Secure Discord account authentication
- **JWT (JSON Web Tokens)**: Stateless session management
- **bcryptjs**: Password hashing (where applicable)
- **Helmet**: Security headers middleware
- **express-rate-limit**: API rate limiting protection

### Additional Libraries
- **axios**: HTTP client for Discord API communication
- **uuid**: Unique identifier generation
- **node-cron**: Scheduled task execution
- **cookie-parser**: Cookie parsing middleware
- **cors**: Cross-origin resource sharing configuration

## Prerequisites

Before installing, ensure you have the following:

- **Node.js**: Version 18.0.0 or higher
- **MongoDB**: Local instance or MongoDB Atlas cluster
- **Discord Application**: Created at [Discord Developer Portal](https://discord.com/developers/applications)
- **Git**: For cloning the repository

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/hacka-discord-dashboard.git
cd hacka-discord-dashboard
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration (see [Environment Variables](#environment-variables) section).

### 4. Configure Discord Application

Follow the [Discord Application Setup](#discord-application-setup) guide to create and configure your Discord app.

### 5. Start the Backend Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

### 6. Serve the Frontend

The frontend is static HTML/CSS/JS. You can serve it using any static file server:

```bash
# Using Python 3
python -m http.server 5173

# Using Node.js http-server (if installed)
npx http-server -p 5173

# Or simply open index.html in your browser for local testing
```

### 7. Access the Dashboard

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Health Check: http://localhost:3000/health

## Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Port for the backend server to run on | Yes (default: 3000) |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `DISCORD_CLIENT_ID` | Your Discord application's Client ID | Yes |
| `DISCORD_CLIENT_SECRET` | Your Discord application's Client Secret | Yes |
| `DISCORD_REDIRECT_URI` | OAuth2 redirect URI (e.g., `http://localhost:3000/api/auth/discord/callback`) | Yes |
| `DISCORD_BOT_TOKEN` | Your Discord bot's authentication token | Yes |
| `JWT_SECRET` | Secret key for signing JWT tokens (use a strong random string) | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration time (e.g., `7d`, `24h`) | Yes (default: 7d) |
| `FRONTEND_URL` | URL of the frontend application | Yes (default: http://localhost:5173) |
| `NODE_ENV` | Environment mode (`development` or `production`) | Yes (default: development) |

### Example `.env` File

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/hacka-discord-dashboard
DISCORD_CLIENT_ID=1234567890123456789
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
DISCORD_BOT_TOKEN=your_bot_token_here
JWT_SECRET=your_super_secret_random_string_here
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## Discord Application Setup

### Creating a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Enter a name for your application (e.g., "Hacka Dashboard")
4. Click **"Create"**
5. Navigate to the **"General Information"** tab
6. Upload an icon and complete your app details
7. Save changes

### OAuth2 Configuration

1. Go to **OAuth2 > General** in the left sidebar
2. Add your redirect URI:
   - For local development: `http://localhost:3000/api/auth/discord/callback`
   - For production: `https://yourdomain.com/api/auth/discord/callback`
3. Click **"Save Changes"**

### Required OAuth2 Scopes

Your application requires the following OAuth2 scopes:

- `identify` - Access user identity information
- `email` - Access user email (optional, for notifications)
- `guilds` - Access user's guild list
- `guilds.members.read` - Read member information in guilds

### Bot Configuration

1. Go to **"Bot"** in the left sidebar
2. Click **"Add Bot"** (if not already created)
3. Enable the following **Privileged Gateway Intents**:
   - **Presence Intent**: For tracking online status
   - **Server Members Intent**: For member list and join/leave events
   - **Message Content Intent**: For message logging and automod
4. Copy the **Token** (you'll need this for `DISCORD_BOT_TOKEN`)
5. Under **"OAuth2 > URL Generator"**, select the following **Bot Permissions**:
   - **Administrator** (or manually select required permissions)
   - Recommended permissions:
     - Manage Channels
     - Manage Roles
     - Manage Messages
     - Kick Members
     - Ban Members
     - Create Instant Invite
     - Change Nickname
     - Manage Nicknames
     - Manage Webhooks
     - View Audit Log
     - Read Messages/View Channels
     - Send Messages
     - Manage Messages
     - Embed Links
     - Attach Files
     - Read Message History
     - Mention Everyone
     - Add Reactions
     - Use Slash Commands
     - Connect (voice)
     - Speak (voice)
     - Mute Members (voice)
     - Deafen Members (voice)
     - Move Members (voice)

### Inviting the Bot

1. Go to **OAuth2 > URL Generator**
2. Select **"bot"** and **"applications.commands"** scopes
3. Select your desired bot permissions
4. Copy the generated URL
5. Open the URL in your browser to invite the bot to your server

## API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Main Endpoints

#### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/auth/discord` | Initiate Discord OAuth2 login |
| GET | `/api/v1/auth/discord/callback` | OAuth2 callback handler |
| POST | `/api/v1/auth/refresh` | Refresh JWT token |
| POST | `/api/v1/auth/logout` | Logout and invalidate session |

#### Guilds (Servers)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds` | List user's guilds |
| GET | `/api/v1/guilds/:guildId` | Get guild details |
| GET | `/api/v1/guilds/:guildId/channels` | List guild channels |
| GET | `/api/v1/guilds/:guildId/roles` | List guild roles |
| GET | `/api/v1/guilds/:guildId/members` | List guild members |

#### Staff Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds/:guildId/staff` | List staff members |
| POST | `/api/v1/guilds/:guildId/staff` | Add staff member |
| PATCH | `/api/v1/guilds/:guildId/staff/:userId` | Update staff member |
| DELETE | `/api/v1/guilds/:guildId/staff/:userId` | Remove staff member |

#### Shifts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds/:guildId/shifts` | List shifts |
| POST | `/api/v1/guilds/:guildId/shifts/start` | Start a shift |
| POST | `/api/v1/guilds/:guildId/shifts/:shiftId/end` | End a shift |
| GET | `/api/v1/guilds/:guildId/shifts/stats` | Shift statistics |

#### Warnings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds/:guildId/warnings` | List warnings |
| POST | `/api/v1/guilds/:guildId/warnings` | Issue warning |
| DELETE | `/api/v1/guilds/:guildId/warnings/:warningId` | Remove warning |

#### Leaderboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds/:guildId/leaderboard` | Get XP/level leaderboard |
| GET | `/api/v1/guilds/:guildId/leaderboard/economy` | Get economy leaderboard |

#### System Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds/:guildId/systems` | Get system settings |
| PATCH | `/api/v1/guilds/:guildId/systems/:systemName` | Update system settings |

#### Tickets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds/:guildId/tickets` | List tickets |
| POST | `/api/v1/guilds/:guildId/tickets` | Create ticket |
| GET | `/api/v1/guilds/:guildId/tickets/:ticketId` | Get ticket details |
| PATCH | `/api/v1/guilds/:guildId/tickets/:ticketId` | Update ticket status |
| GET | `/api/v1/guilds/:guildId/tickets/:ticketId/transcript` | Get ticket transcript |

#### Custom Commands

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds/:guildId/commands` | List custom commands |
| POST | `/api/v1/guilds/:guildId/commands` | Create command |
| PATCH | `/api/v1/guilds/:guildId/commands/:commandId` | Update command |
| DELETE | `/api/v1/guilds/:guildId/commands/:commandId` | Delete command |

#### Activity Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/guilds/:guildId/activity` | Get activity logs |
| GET | `/api/v1/guilds/:guildId/activity/stats` | Activity statistics |

#### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/dashboard/stats` | Get dashboard statistics |
| GET | `/api/v1/dashboard/activity` | Get recent activity |

### Authentication Flow

1. **Initiate Login**: User clicks "Login with Discord" button
2. **Discord OAuth**: User is redirected to Discord authorization page
3. **Authorization**: User approves application access
4. **Callback**: Discord redirects to your callback URL with code
5. **Token Exchange**: Backend exchanges code for access token
6. **User Data**: Backend fetches user info from Discord API
7. **JWT Generation**: Backend creates JWT token with user data
8. **Session**: Token is returned to frontend and stored (localStorage/cookie)
9. **Authenticated Requests**: Frontend includes JWT in Authorization header for API calls

### Response Format

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "ErrorName",
  "message": "Human-readable error description"
}
```

## Project Structure

```
hacka-discord-dashboard/
├── backend/                    # Backend API
│   ├── src/
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.js        # JWT authentication
│   │   │   ├── discord.js     # Discord API middleware
│   │   │   ├── permissions.js # Permission checking
│   │   │   └── rateLimiter.js # Rate limiting
│   │   ├── models/            # Mongoose models
│   │   │   ├── ActivityLog.js
│   │   │   ├── CustomCommand.js
│   │   │   ├── Economy.js
│   │   │   ├── Guild.js
│   │   │   ├── Level.js
│   │   │   ├── Promotion.js
│   │   │   ├── Shift.js
│   │   │   ├── Staff.js
│   │   │   ├── SystemSettings.js
│   │   │   ├── Ticket.js
│   │   │   ├── User.js
│   │   │   ├── Warning.js
│   │   │   └── index.js
│   │   ├── routes/            # API routes
│   │   │   ├── activity.js
│   │   │   ├── auth.js
│   │   │   ├── customCommands.js
│   │   │   ├── dashboard.js
│   │   │   ├── guilds.js
│   │   │   ├── index.js
│   │   │   ├── leaderboard.js
│   │   │   ├── promotions.js
│   │   │   ├── shifts.js
│   │   │   ├── staff.js
│   │   │   ├── systems.js
│   │   │   ├── tickets.js
│   │   │   └── warnings.js
│   │   └── services/          # Business logic
│   │       ├── activityLogService.js
│   │       ├── authService.js
│   │       ├── customCommandService.js
│   │       ├── discordService.js
│   │       ├── guildService.js
│   │       ├── index.js
│   │       ├── leaderboardService.js
│   │       ├── promotionService.js
│   │       ├── shiftService.js
│   │       ├── staffService.js
│   │       ├── systemSettingsService.js
│   │       ├── ticketService.js
│   │       ├── warningService.js
│   │       └── websocketService.js
│   ├── config/
│   │   └── database.js        # MongoDB configuration
│   ├── server.js              # Main server entry (WebSocket + Express)
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
├── index.html                 # Frontend landing page
├── style.css                  # Frontend styles
├── app.js                     # Frontend JavaScript
├── dashboard-integration.js   # Dashboard integration utilities
├── extracted.js               # Extracted command data
├── extracted_commands.json    # Command definitions
├── .git/
└── README.md                  # This file
```

### Directory Explanations

- **`backend/src/middleware/`**: Express middleware functions for authentication, rate limiting, and Discord API integration
- **`backend/src/models/`**: Mongoose schema definitions for MongoDB collections
- **`backend/src/routes/`**: Express route handlers organized by feature area
- **`backend/src/services/`**: Business logic layer separating concerns from route handlers
- **`backend/config/`**: Configuration files for database connections
- **Root files**: Static frontend assets (HTML, CSS, JS)

## Contributing Guidelines

We welcome contributions to the Hacka Discord Dashboard! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit with clear messages (`git commit -m 'Add: amazing feature'`)
5. Push to your fork (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Standards

- **ES Modules**: Use `import/export` syntax (not CommonJS)
- **Async/Await**: Prefer async/await over raw promises
- **Error Handling**: Always use try/catch for async operations
- **Comments**: Document complex logic and public APIs
- **Linting**: Follow existing code style (indentation: 2 spaces)

### Commit Message Format

```
Type: Brief description

Detailed explanation (if needed)

- Bullet points for changes
- Another change
```

Types: `Add`, `Fix`, `Update`, `Remove`, `Refactor`, `Docs`, `Test`

### Pull Request Process

1. Update documentation for any changed functionality
2. Ensure all tests pass (when test suite is added)
3. Update the README.md if needed
4. Request review from maintainers
5. Address review feedback
6. Squash commits if requested

### Reporting Issues

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS, etc.)
- Screenshots if applicable

## License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2024 Hacka Discord Dashboard

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Support

- **Discord Support Server**: [Join our Discord](https://discord.gg/smNwftEhKe)
- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/hacka-discord-dashboard/issues)
- **Documentation**: This README and inline code comments

## Acknowledgments

- Discord.js community for API integration patterns
- MongoDB team for excellent documentation
- Express.js contributors for the robust framework
- All contributors who help improve this project

---

**Built with care for Discord communities worldwide.**
