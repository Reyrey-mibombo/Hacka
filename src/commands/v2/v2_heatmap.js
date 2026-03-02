const { SlashCommandBuilder } = require('discord.js');
const { createCustomEmbed, createErrorEmbed } = require('../../utils/embeds');
const { Activity } = require('../../database/mongo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('v2_heatmap')
        .setDescription('🌡️ Real activity heatmap — see when your server is most active by hour of day'),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const guildId = interaction.guildId;
            const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

            const activities = await Activity.find({
                guildId,
                createdAt: { $gte: thirtyDaysAgo }
            }).lean();

            if (activities.length === 0) {
                return interaction.editReply({ embeds: [createErrorEmbed('Not enough activity data yet. Start using commands to build the heatmap!')] });
            }

            // Count by hour-of-day (0-23)
            const hourCounts = new Array(24).fill(0);
            activities.forEach(a => {
                const hour = new Date(a.createdAt).getHours();
                hourCounts[hour]++;
            });

            const maxCount = Math.max(...hourCounts, 1);

            // Build ASCII heatmap: 4 rows (high/mid-high/mid-low/low), 24 columns (hours)
            const heatChars = ['░', '▒', '▓', '█'];
            const heatmapRows = [3, 2, 1, 0].map(level => {
                return hourCounts.map(count => {
                    const intensity = Math.floor((count / maxCount) * 4);
                    // Show block if this level <= intensity
                    return intensity > level ? heatChars[level] : ' ';
                }).join('');
            });

            // Hour labels row
            const hourLabels = Array.from({ length: 24 }, (_, i) => (i % 6 === 0) ? String(i).padStart(2, '0') : '  ').join('');
            const heatmapStr = [...heatmapRows, hourLabels].join('\n');

            // Find peak and quiet hours
            const peakHour = hourCounts.indexOf(maxCount);
            const quietHour = hourCounts.indexOf(Math.min(...hourCounts));

            // Day-of-week breakdown
            const dayCounts = new Array(7).fill(0);
            activities.forEach(a => {
                const day = new Date(a.createdAt).getDay();
                dayCounts[day]++;
            });
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const maxDay = dayCounts.indexOf(Math.max(...dayCounts));

            const dayBreakdown = dayCounts.map((c, i) => {
                const pct = Math.round((c / maxCount) * 5);
                return `${dayNames[i]}: ${'█'.repeat(pct)}${'░'.repeat(5 - pct)} ${c}`;
            }).join('\n');

            const embed = await createCustomEmbed(interaction, {
                title: `🌡️ Activity Heatmap — ${interaction.guild.name}`,
                thumbnail: interaction.guild.iconURL({ dynamic: true }),
                description: `Real activity heatmap from **${activities.length.toLocaleString()}** events over the last **30 days**.\n\`\`\`\n${heatmapStr}\`\`\`\n*High ▓ → Most active | ░ → Least active*`,
                fields: [
                    { name: '⚡ Peak Hour', value: `\`${String(peakHour).padStart(2, '0')}:00\` — \`${maxCount}\` events`, inline: true },
                    { name: '😴 Quietest Hour', value: `\`${String(quietHour).padStart(2, '0')}:00\``, inline: true },
                    { name: '📅 Most Active Day', value: `\`${dayNames[maxDay]}\` — \`${dayCounts[maxDay]}\` events`, inline: true },
                    { name: '📊 Day Breakdown', value: `\`\`\`\n${dayBreakdown}\`\`\``, inline: false }
                ],
                color: '#5865F2',
                footer: 'uwu-chan • Real Activity Heatmap • Last 30 Days'
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[v2_heatmap] Error:', error);
            const errEmbed = createErrorEmbed('Failed to generate activity heatmap.');
            if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
            else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
    }
};
