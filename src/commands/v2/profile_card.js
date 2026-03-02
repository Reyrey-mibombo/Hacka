const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCustomEmbed, createErrorEmbed, createProgressBar } = require('../../utils/embeds');
const { User, Warning, Shift, Activity } = require('../../database/mongo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile_card')
        .setDescription('🪪 View your full staff profile card — XP, achievements, shifts, and badges')
        .addUserOption(opt =>
            opt.setName('user').setDescription('Staff member to view').setRequired(false)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const target = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guildId;

            const [user, warnings, shifts] = await Promise.all([
                User.findOne({ userId: target.id, 'guilds.guildId': guildId }).lean(),
                Warning.find({ userId: target.id, guildId }).lean(),
                Shift.find({ userId: target.id, guildId, endTime: { $ne: null } }).lean()
            ]);

            const staff = user?.staff || {};
            const points = staff.points || 0;
            const level = staff.level || 1;
            const xp = staff.xp || 0;
            const rank = (staff.rank || 'Member').toUpperCase();
            const consistency = staff.consistency || 100;
            const reputation = staff.reputation || 0;
            const achievements = staff.achievements || [];
            const trophies = staff.trophies || [];
            const streak = staff.streak || 0;
            const warnCount = warnings.length;

            // XP Progress Bar (per level ~ 1000 xp)
            const xpForLevel = 1000;
            const xpPercent = Math.min(100, Math.round((xp % xpForLevel) / xpForLevel * 100));
            const xpBar = createProgressBar(xpPercent, 15);

            // Points Progress Bar (capped at 1000 for visual)
            const ptsPercent = Math.min(100, Math.round((points % 1000) / 1000 * 100));
            const ptsBar = createProgressBar(ptsPercent, 15);

            // Total shift time
            const totalShiftSecs = shifts.reduce((sum, s) => sum + (s.duration || 0), 0);
            const shiftHours = Math.floor(totalShiftSecs / 3600);
            const shiftMins = Math.floor((totalShiftSecs % 3600) / 60);

            const achievementDisplay = achievements.length > 0
                ? achievements.slice(0, 5).map(a => `🏅 ${a}`).join('\n')
                : '*(No achievements yet)*';

            const badgeDisplay = trophies.length > 0
                ? trophies.slice(0, 5).map(t => `🏆 ${t}`).join('\n')
                : '*(No trophies yet)*';

            const embed = await createCustomEmbed(interaction, {
                title: `🪪 Staff Profile: ${target.username}`,
                thumbnail: target.displayAvatarURL({ dynamic: true, size: 256 }),
                description: `**${target.globalName || target.username}** — ${interaction.guild.name}\nRank: \`${rank}\` | Streak: \`🔥 ${streak} days\``,
                fields: [
                    { name: '⭐ Points', value: `\`${points.toLocaleString()} pts\`\n\`${ptsBar}\` ${ptsPercent}%`, inline: true },
                    { name: '✨ EXP / Level', value: `\`LVL ${level}\`\n\`${xpBar}\` ${xpPercent}%`, inline: true },
                    { name: '📊 Consistency', value: `\`${createProgressBar(consistency)}\` ${consistency}%`, inline: false },
                    { name: '⏱️ Total Shift Time', value: `\`${shiftHours}h ${shiftMins}m\` across \`${shifts.length}\` shifts`, inline: true },
                    { name: '⚠️ Warnings', value: `\`${warnCount}\` recorded`, inline: true },
                    { name: '🤝 Reputation', value: `\`${reputation}\` commendations`, inline: true },
                    { name: '🏅 Achievements', value: achievementDisplay, inline: true },
                    { name: '🏆 Trophies', value: badgeDisplay, inline: true }
                ],
                color: '#5865F2',
                footer: `uwu-chan • Profile Card • ID: ${target.id}`
            });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`export_stats_${target.id}`)
                    .setLabel('📥 Export CSV')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setLabel('🔗 Discord Profile')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/users/${target.id}`)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[profile_card] Error:', error);
            const errEmbed = createErrorEmbed('Failed to load profile card. Make sure the user has used the bot before.');
            if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
            else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
    }
};
