const db = require('../database/connection');

// Seed data for development/testing
function seedDatabase() {
    console.log('[Seed] Starting database seeding...');

    // Sample guild
    const guildId = '123456789012345678';
    
    db.prepare(`
        INSERT OR IGNORE INTO guilds (id, name, icon, owner_id, tier, mod_channel_id, staff_channel_id, warn_threshold, min_shift_minutes, auto_promotion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, 'Test Server', null, '987654321098765432', 'premium', '111111111111111111', '222222222222222222', 3, 30, 1);

    // Sample staff members
    const staffMembers = [
        { id: '100000000000000001', username: 'AdminUser', rank: 'admin', points: 5000, shifts: 150, isStaff: 1, isAdmin: 1 },
        { id: '100000000000000002', username: 'ManagerPro', rank: 'manager', points: 3500, shifts: 100, isStaff: 1, isAdmin: 0 },
        { id: '100000000000000003', username: 'SeniorMod', rank: 'senior', points: 2000, shifts: 75, isStaff: 1, isAdmin: 0 },
        { id: '100000000000000004', username: 'RegularStaff', rank: 'staff', points: 1200, shifts: 50, isStaff: 1, isAdmin: 0 },
        { id: '100000000000000005', username: 'TrialMember', rank: 'trial', points: 300, shifts: 10, isStaff: 1, isAdmin: 0 }
    ];

    const memberStmt = db.prepare(`
        INSERT OR IGNORE INTO guild_members (guild_id, user_id, username, rank, points, is_staff, is_admin)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    staffMembers.forEach(m => {
        memberStmt.run(guildId, m.id, m.username, m.rank, m.points, m.isStaff, m.isAdmin);
    });

    // Sample staff profiles
    const profileStmt = db.prepare(`
        INSERT OR IGNORE INTO staff_profiles (guild_id, user_id, current_rank, shifts_completed, warnings_count, total_shift_minutes)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    staffMembers.forEach(m => {
        profileStmt.run(guildId, m.id, m.rank, m.shifts, 0, m.shifts * 60);
    });

    // Sample shifts
    const shiftStmt = db.prepare(`
        INSERT INTO shifts (guild_id, user_id, username, started_at, ended_at, duration_minutes, points_earned, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Create some completed shifts
    for (let i = 0; i < 30; i++) {
        const member = staffMembers[Math.floor(Math.random() * staffMembers.length)];
        const daysAgo = Math.floor(Math.random() * 7);
        const hoursAgo = Math.floor(Math.random() * 12);
        const startedAt = new Date();
        startedAt.setDate(startedAt.getDate() - daysAgo);
        startedAt.setHours(startedAt.getHours() - hoursAgo);
        
        const duration = 30 + Math.floor(Math.random() * 180); // 30-210 minutes
        const endedAt = new Date(startedAt.getTime() + duration * 60000);
        const points = Math.floor(duration / 10);

        shiftStmt.run(guildId, member.id, member.username, startedAt.toISOString(), endedAt.toISOString(), duration, points, 'completed');
    }

    // Sample warnings
    const warnStmt = db.prepare(`
        INSERT INTO warnings (guild_id, target_user_id, target_username, issuer_user_id, issuer_username, reason, severity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    warnStmt.run(guildId, '100000000000000005', 'TrialMember', '100000000000000001', 'AdminUser', 'Inappropriate behavior in chat', 'medium', 'active');
    warnStmt.run(guildId, '100000000000000004', 'RegularStaff', '100000000000000002', 'ManagerPro', 'Missed shift without notice', 'low', 'active');

    // Sample promotion requirements
    const promoStmt = db.prepare(`
        INSERT OR IGNORE INTO promotion_requirements 
        (guild_id, rank_name, rank_role_id, points_required, shifts_required, consistency_required, max_warnings, shift_hours_required)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    promoStmt.run(guildId, 'trial', '333333333333333333', 0, 0, 0, 3, 0);
    promoStmt.run(guildId, 'staff', '444444444444444444', 500, 10, 50, 2, 5);
    promoStmt.run(guildId, 'senior', '555555555555555555', 1500, 30, 70, 1, 20);
    promoStmt.run(guildId, 'manager', '666666666666666666', 3000, 60, 80, 0, 50);
    promoStmt.run(guildId, 'admin', '777777777777777777', 5000, 100, 90, 0, 100);

    // Sample system configs
    const systemStmt = db.prepare(`
        INSERT OR IGNORE INTO system_configs (guild_id, system_type, config_json, enabled)
        VALUES (?, ?, ?, ?)
    `);

    systemStmt.run(guildId, 'welcome', JSON.stringify({
        channelId: '888888888888888888',
        message: 'Welcome {user} to {server}! You are member #{count}.',
        dmEnabled: false,
        dmMessage: ''
    }), 1);

    systemStmt.run(guildId, 'automod', JSON.stringify({
        blockProfanity: true,
        blockLinks: false,
        antiMentionSpam: true,
        blockInvites: true,
        autoTimeout: true,
        logViolations: true,
        bannedWords: ['badword1', 'badword2'],
        allowedDomains: ['discord.com', 'youtube.com'],
        maxMentions: 5,
        timeoutDuration: 10,
        logChannel: '999999999999999999'
    }), 1);

    systemStmt.run(guildId, 'logging', JSON.stringify({
        memberLog: true,
        memberLogChannel: '111111111111111111',
        messageLog: true,
        messageLogChannel: '222222222222222222',
        modLog: true,
        modLogChannel: '333333333333333333'
    }), 1);

    // Sample custom commands
    const cmdStmt = db.prepare(`
        INSERT OR IGNORE INTO custom_commands (guild_id, trigger, response, match_type, is_embed, enabled)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    cmdStmt.run(guildId, '!rules', 'Please follow the server rules:\n1. Be respectful\n2. No spam\n3. Have fun!', 'starts', 1, 1);
    cmdStmt.run(guildId, '!help', 'Need help? Contact a staff member or open a ticket!', 'exact', 1, 1);

    // Sample achievements
    const achStmt = db.prepare(`
        INSERT OR IGNORE INTO achievements (guild_id, achievement_id, name, description, icon, criteria_type, criteria_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    achStmt.run(guildId, 'ach_first_shift', 'First Shift', 'Complete your first work shift', '🎯', 'shifts', 1);
    achStmt.run(guildId, 'ach_dedicated', 'Dedicated Staff', 'Complete 50 shifts', '💪', 'shifts', 50);
    achStmt.run(guildId, 'ach_point_master', 'Point Master', 'Earn 1000 points', '💎', 'points', 1000);

    // Sample role rewards
    const rewardStmt = db.prepare(`
        INSERT OR IGNORE INTO role_rewards (guild_id, name, role_id, required_points)
        VALUES (?, ?, ?, ?)
    `);

    rewardStmt.run(guildId, 'Bronze Staff', '101010101010101010', 500);
    rewardStmt.run(guildId, 'Silver Staff', '202020202020202020', 1500);
    rewardStmt.run(guildId, 'Gold Staff', '303030303030303030', 3000);

    // ========== NEW FEATURES SEED DATA ==========

    // Leveling System
    const levelingStmt = db.prepare(`
        INSERT OR IGNORE INTO leveling_config (guild_id, enabled, xp_rate, xp_cooldown, max_xp_per_message, min_xp_per_message, level_up_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    levelingStmt.run(guildId, 1, 1.5, 60, 25, 15, 'Congratulations {user}, you reached level {level}!');

    // Level Roles
    const levelRoleStmt = db.prepare(`
        INSERT OR IGNORE INTO level_roles (guild_id, level, role_id, remove_previous)
        VALUES (?, ?, ?, ?)
    `);
    levelRoleStmt.run(guildId, 5, '555555555555555001', 0);
    levelRoleStmt.run(guildId, 10, '555555555555555002', 0);
    levelRoleStmt.run(guildId, 25, '555555555555555003', 0);
    levelRoleStmt.run(guildId, 50, '555555555555555004', 0);

    // User Levels
    const userLevelStmt = db.prepare(`
        INSERT OR IGNORE INTO user_levels (guild_id, user_id, username, xp, level, total_messages, total_voice_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const regularMembers = [
        { id: '200000000000000001', username: 'ActiveUser1' },
        { id: '200000000000000002', username: 'ChatterBox' },
        { id: '200000000000000003', username: 'ServerRegular' },
        { id: '200000000000000004', username: 'VoiceChatKing' },
        { id: '200000000000000005', username: 'Newbie' }
    ];

    regularMembers.forEach((m, i) => {
        const level = [25, 18, 12, 8, 2][i];
        const xp = level * level * 100 + Math.floor(Math.random() * 500);
        userLevelStmt.run(guildId, m.id, m.username, xp, level, level * 100 + Math.floor(Math.random() * 500), Math.floor(Math.random() * 1000));
    });

    // Level Rewards
    const levelRewardStmt = db.prepare(`
        INSERT OR IGNORE INTO level_rewards (guild_id, name, description, level_required, reward_type, reward_value)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    levelRewardStmt.run(guildId, 'Level 10 Bonus', 'Bonus points for reaching level 10', 10, 'points', '500');
    levelRewardStmt.run(guildId, 'Level 25 Role', 'Special role for dedicated members', 25, 'role', '555555555555555005');
    levelRewardStmt.run(guildId, 'Level 50 Elite', 'Elite status with custom color', 50, 'custom_role', 'Elite Member');

    // Reaction Role Panels
    const rrPanelStmt = db.prepare(`
        INSERT OR IGNORE INTO reaction_role_panels (guild_id, name, description, channel_id, color, max_roles, unique_roles, allow_remove)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    rrPanelStmt.run(guildId, 'Color Roles', 'Choose your favorite color', '888888888888888001', '#FF6B6B', 1, 1, 1);
    rrPanelStmt.run(guildId, 'Notification Roles', 'Get notified about different topics', '888888888888888002', '#4ECDC4', 0, 0, 1);
    rrPanelStmt.run(guildId, 'Gaming Roles', 'Select your favorite games', '888888888888888003', '#95E1D3', 3, 0, 1);

    // Get panel IDs
    const panels = db.prepare('SELECT id FROM reaction_role_panels WHERE guild_id = ?').all(guildId);
    
    // Reaction Roles
    const rrStmt = db.prepare(`
        INSERT OR IGNORE INTO reaction_roles (guild_id, panel_id, emoji, role_id, description)
        VALUES (?, ?, ?, ?, ?)
    `);

    if (panels[0]) {
        rrStmt.run(guildId, panels[0].id, '🔴', '777777777777777001', 'Red');
        rrStmt.run(guildId, panels[0].id, '🔵', '777777777777777002', 'Blue');
        rrStmt.run(guildId, panels[0].id, '🟢', '777777777777777003', 'Green');
        rrStmt.run(guildId, panels[0].id, '🟡', '777777777777777004', 'Yellow');
        rrStmt.run(guildId, panels[0].id, '🟣', '777777777777777005', 'Purple');
    }

    if (panels[1]) {
        rrStmt.run(guildId, panels[1].id, '📢', '777777777777777006', 'Announcements');
        rrStmt.run(guildId, panels[1].id, '🎮', '777777777777777007', 'Gaming News');
        rrStmt.run(guildId, panels[1].id, '🎉', '777777777777777008', 'Events');
        rrStmt.run(guildId, panels[1].id, '📺', '777777777777777009', 'Streams');
    }

    if (panels[2]) {
        rrStmt.run(guildId, panels[2].id, '🎯', '777777777777777010', 'FPS Games');
        rrStmt.run(guildId, panels[2].id, '⚔️', '777777777777777011', 'RPG Games');
        rrStmt.run(guildId, panels[2].id, '🏎️', '777777777777777012', 'Racing Games');
        rrStmt.run(guildId, panels[2].id, '♟️', '777777777777777013', 'Strategy Games');
    }

    // Giveaways
    const giveawayStmt = db.prepare(`
        INSERT OR IGNORE INTO giveaways (guild_id, creator_id, creator_username, prize, description, channel_id, winner_count, end_time, ended, entries_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+7 days'), 0, ?)
    `);
    giveawayStmt.run(guildId, '100000000000000001', 'AdminUser', 'Nitro Classic', '1 month of Discord Nitro Classic', '888888888888888004', 1, 42);
    giveawayStmt.run(guildId, '100000000000000001', 'AdminUser', 'Steam Gift Card $20', 'Digital Steam gift card', '888888888888888004', 2, 156);

    // Ended Giveaway
    const endedGiveawayStmt = db.prepare(`
        INSERT OR IGNORE INTO giveaways (guild_id, creator_id, creator_username, prize, description, channel_id, winner_count, end_time, ended, ended_at, winners, entries_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), 1, datetime('now', '-2 days'), ?, ?)
    `);
    endedGiveawayStmt.run(guildId, '100000000000000001', 'AdminUser', 'Special Role', 'Exclusive server role', '888888888888888004', 1, JSON.stringify(['200000000000000002']), 89);

    // Giveaway Entries
    const giveawayIds = db.prepare('SELECT id FROM giveaways WHERE guild_id = ?').all(guildId);
    const entryStmt = db.prepare(`
        INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, username)
        VALUES (?, ?, ?)
    `);

    giveawayIds.forEach(g => {
        regularMembers.forEach(m => {
            if (Math.random() > 0.3) { // 70% chance to enter
                entryStmt.run(g.id, m.id, m.username);
            }
        });
    });

    // Daily Stats (last 30 days)
    const dailyStatsStmt = db.prepare(`
        INSERT OR IGNORE INTO daily_stats (guild_id, date, message_count, member_joins, member_leaves, voice_minutes, active_members, new_members, commands_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        dailyStatsStmt.run(
            guildId,
            dateStr,
            500 + Math.floor(Math.random() * 1000),
            Math.floor(Math.random() * 10),
            Math.floor(Math.random() * 5),
            1000 + Math.floor(Math.random() * 2000),
            50 + Math.floor(Math.random() * 100),
            Math.floor(Math.random() * 10),
            50 + Math.floor(Math.random() * 100)
        );
    }

    // Member Activity
    const memberActivityStmt = db.prepare(`
        INSERT OR IGNORE INTO member_activity (guild_id, user_id, date, message_count, voice_minutes, xp_earned, points_earned)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    [...staffMembers, ...regularMembers].forEach(m => {
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            memberActivityStmt.run(
                guildId,
                m.id,
                date.toISOString().split('T')[0],
                Math.floor(Math.random() * 100),
                Math.floor(Math.random() * 120),
                Math.floor(Math.random() * 500),
                Math.floor(Math.random() * 50)
            );
        }
    });

    // Economy Config
    const economyStmt = db.prepare(`
        INSERT OR IGNORE INTO economy_config (guild_id, enabled, currency_name, currency_symbol, daily_amount, work_cooldown, work_min_amount, work_max_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    economyStmt.run(guildId, 1, 'Coins', '🪙', 150, 3600, 20, 150);

    // User Economy
    const userEconomyStmt = db.prepare(`
        INSERT OR IGNORE INTO user_economy (guild_id, user_id, balance, bank, total_earned, total_spent)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const economyUsers = [
        { id: '200000000000000001', balance: 5000, bank: 10000 },
        { id: '200000000000000002', balance: 3500, bank: 8000 },
        { id: '200000000000000003', balance: 2500, bank: 5000 },
        { id: '200000000000000004', balance: 1200, bank: 3000 },
        { id: '200000000000000005', balance: 500, bank: 1000 }
    ];

    economyUsers.forEach(u => {
        userEconomyStmt.run(guildId, u.id, u.balance, u.bank, u.balance + u.bank + 2000, 2000);
    });

    // Shop Items
    const shopStmt = db.prepare(`
        INSERT OR IGNORE INTO shop_items (guild_id, name, description, price, role_id, stock)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    shopStmt.run(guildId, 'VIP Role', 'Exclusive VIP perks', 5000, '999999999999999001', 10);
    shopStmt.run(guildId, 'Custom Color', 'Change your name color', 2000, null, 50);
    shopStmt.run(guildId, 'Server Boost', 'Help boost the server', 10000, null, 5);
    shopStmt.run(guildId, 'Custom Emoji', 'Add your own emoji', 3000, null, -1);

    // AutoMod Rules
    const automodStmt = db.prepare(`
        INSERT OR IGNORE INTO automod_rules (guild_id, name, rule_type, enabled, action, threshold, blacklist_content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    automodStmt.run(guildId, 'Anti-Spam', 'spam', 1, 'delete', 5, JSON.stringify([]));
    automodStmt.run(guildId, 'Mention Spam', 'mention_spam', 1, 'timeout', 5, JSON.stringify([]));
    automodStmt.run(guildId, 'Bad Words', 'words', 1, 'warn', null, JSON.stringify(['badword1', 'badword2', 'slur1', 'slur2']));
    automodStmt.run(guildId, 'Discord Invites', 'invites', 1, 'delete', null, JSON.stringify(['discord.gg/', 'discord.com/invite']));
    automodStmt.run(guildId, 'Caps Lock', 'caps', 1, 'warn', 70, JSON.stringify([]));

    // Server Settings
    const serverSettingsStmt = db.prepare(`
        INSERT OR IGNORE INTO server_settings (guild_id, prefix, language, timezone, embed_color, mute_role_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    serverSettingsStmt.run(guildId, '!', 'en', 'UTC', '#6c63ff', '999999999999999002');

    // Voice Sessions (sample historical data)
    const voiceSessionStmt = db.prepare(`
        INSERT OR IGNORE INTO voice_sessions (guild_id, user_id, username, channel_id, joined_at, left_at, duration_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < 50; i++) {
        const member = [...staffMembers, ...regularMembers][Math.floor(Math.random() * (staffMembers.length + regularMembers.length))];
        const daysAgo = Math.floor(Math.random() * 7);
        const hoursAgo = Math.floor(Math.random() * 12);
        const joinedAt = new Date();
        joinedAt.setDate(joinedAt.getDate() - daysAgo);
        joinedAt.setHours(joinedAt.getHours() - hoursAgo);
        
        const duration = 15 + Math.floor(Math.random() * 180);
        const leftAt = new Date(joinedAt.getTime() + duration * 60000);

        voiceSessionStmt.run(
            guildId,
            member.id,
            member.username,
            `777777777777777${100 + Math.floor(Math.random() * 5)}`,
            joinedAt.toISOString(),
            leftAt.toISOString(),
            duration
        );
    }

    // Moderation Actions
    const modActionStmt = db.prepare(`
        INSERT OR IGNORE INTO moderation_actions (guild_id, action_type, target_user_id, target_username, moderator_user_id, moderator_username, reason, duration_minutes, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    modActionStmt.run(guildId, 'ban', '300000000000000001', 'ToxicUser', '100000000000000001', 'AdminUser', 'Repeated rule violations', null, 1);
    modActionStmt.run(guildId, 'kick', '300000000000000002', 'Spammer', '100000000000000002', 'ManagerPro', 'Mass spam in channels', null, 0);
    modActionStmt.run(guildId, 'timeout', '300000000000000003', 'RudeUser', '100000000000000003', 'SeniorMod', 'Cooling off period', 60, 0);

    console.log('[Seed] Database seeding completed!');
    console.log(`[Seed] Guild ID: ${guildId}`);
    console.log(`[Seed] Staff members: ${staffMembers.length}`);
    console.log(`[Seed] Regular members: ${regularMembers.length}`);
    console.log(`[Seed] Level roles: 4`);
    console.log(`[Seed] Reaction panels: ${panels.length}`);
    console.log(`[Seed] Giveaways: ${giveawayIds.length}`);
    console.log(`[Seed] Shop items: 4`);
    console.log(`[Seed] AutoMod rules: 5`);
}

// Run seeding
seedDatabase();

module.exports = { seedDatabase };
