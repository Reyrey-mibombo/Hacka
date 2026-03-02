const { SlashCommandBuilder } = require('discord.js');
const { createCustomEmbed, createErrorEmbed, createProgressBar } = require('../../utils/embeds');
const { Shift, User } = require('../../database/mongo');

const BURNOUT_THRESHOLD_HOURS = 40; // 40h/week
const WARNING_THRESHOLD_HOURS = 25;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('burnout_check')
        .setDescription('🔥 Analyze staff burnout risk based on real weekly shift data')
        .addUserOption(opt =>
            opt.setName('user').setDescription('Staff member to check (leave blank for server overview)').setRequired(false)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const guildId = interaction.guildId;
            const target = interaction.options.getUser('user');
            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

            if (target) {
                // Individual burnout check
                const shifts = await Shift.find({
                    userId: target.id,
                    guildId,
                    startTime: { $gte: sevenDaysAgo },
                    endTime: { $ne: null }
                }).lean();

                const user = await User.findOne({ userId: target.id, 'guilds.guildId': guildId }).lean();
                const totalSecs = shifts.reduce((s, sh) => s + (sh.duration || 0), 0);
                const weeklyHours = totalSecs / 3600;
                const shiftCount = shifts.length;
                const consistency = user?.staff?.consistency || 100;

                const pct = Math.min(100, Math.round((weeklyHours / BURNOUT_THRESHOLD_HOURS) * 100));
                const bar = createProgressBar(pct);
                const riskLabel = weeklyHours >= BURNOUT_THRESHOLD_HOURS
                    ? '🔴 **HIGH RISK** — Recommend mandatory rest'
                    : weeklyHours >= WARNING_THRESHOLD_HOURS
                        ? '🟡 **MODERATE** — Monitor closely'
                        : '🟢 **LOW RISK** — Healthy workload';

                const embed = await createCustomEmbed(interaction, {
                    title: `🔥 Burnout Check: ${target.username}`,
                    thumbnail: target.displayAvatarURL({ dynamic: true }),
                    description: `Weekly workload analysis for **${target.username}** in **${interaction.guild.name}**.\n\n${riskLabel}`,
                    fields: [
                        { name: '⏱️ Weekly Hours', value: `\`${weeklyHours.toFixed(1)}h\` / \`${BURNOUT_THRESHOLD_HOURS}h max\``, inline: true },
                        { name: '🔄 Shifts This Week', value: `\`${shiftCount}\` shifts`, inline: true },
                        { name: '📊 Consistency Score', value: `\`${createProgressBar(consistency)}\` ${consistency}%`, inline: false },
                        { name: '📈 Workload Meter', value: `\`${bar}\` ${pct}%`, inline: false },
                        {
                            name: '💡 Recommendation', value: weeklyHours >= BURNOUT_THRESHOLD_HOURS
                                ? 'Strongly advise scheduling a break period to prevent performance degradation.'
                                : weeklyHours >= WARNING_THRESHOLD_HOURS
                                    ? 'Workload is elevated — ensure adequate rest between shifts.'
                                    : 'Workload is within a healthy range. Encourage continued consistency.'
                            , inline: false
                        }
                    ],
                    color: weeklyHours >= BURNOUT_THRESHOLD_HOURS ? 'error' : weeklyHours >= WARNING_THRESHOLD_HOURS ? 'warning' : 'success',
                    footer: 'uwu-chan • Burnout Analysis • Last 7 Days'
                });

                return interaction.editReply({ embeds: [embed] });
            }

            // Server-wide burnout overview
            const allShifts = await Shift.find({
                guildId,
                startTime: { $gte: sevenDaysAgo },
                endTime: { $ne: null }
            }).lean();

            // Group by userId
            const userHours = {};
            allShifts.forEach(sh => {
                userHours[sh.userId] = (userHours[sh.userId] || 0) + (sh.duration || 0) / 3600;
            });

            const highRisk = Object.values(userHours).filter(h => h >= BURNOUT_THRESHOLD_HOURS).length;
            const moderate = Object.values(userHours).filter(h => h >= WARNING_THRESHOLD_HOURS && h < BURNOUT_THRESHOLD_HOURS).length;
            const healthy = Object.values(userHours).filter(h => h < WARNING_THRESHOLD_HOURS).length;
            const avgHours = Object.values(userHours).length > 0
                ? (Object.values(userHours).reduce((a, b) => a + b, 0) / Object.values(userHours).length).toFixed(1)
                : '0.0';

            const serverPct = Math.min(100, Math.round((parseFloat(avgHours) / BURNOUT_THRESHOLD_HOURS) * 100));

            const embed = await createCustomEmbed(interaction, {
                title: `🔥 Server Burnout Overview — ${interaction.guild.name}`,
                thumbnail: interaction.guild.iconURL({ dynamic: true }),
                description: `Burnout risk assessment for all tracked staff over the last **7 days**.`,
                fields: [
                    { name: '🔴 High Risk', value: `\`${highRisk}\` staff members`, inline: true },
                    { name: '🟡 Moderate Risk', value: `\`${moderate}\` staff members`, inline: true },
                    { name: '🟢 Healthy', value: `\`${healthy}\` staff members`, inline: true },
                    { name: '⏱️ Average Weekly Hours', value: `\`${avgHours}h\``, inline: true },
                    { name: '👥 Total Tracked', value: `\`${Object.keys(userHours).length}\` staff`, inline: true },
                    { name: '📊 Overall Workload', value: `\`${createProgressBar(serverPct)}\` ${serverPct}%`, inline: false }
                ],
                color: highRisk > 0 ? 'error' : moderate > 0 ? 'warning' : 'success',
                footer: 'uwu-chan • Server Burnout Analysis • Last 7 Days'
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[burnout_check] Error:', error);
            const errEmbed = createErrorEmbed('Failed to run burnout analysis. Please try again.');
            if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
            else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
    }
};
