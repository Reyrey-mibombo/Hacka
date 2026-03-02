const { SlashCommandBuilder } = require('discord.js');
const { createCustomEmbed, createErrorEmbed, createProgressBar } = require('../../utils/embeds');
const { validatePremiumLicense } = require('../../utils/premium_guard');
const { Guild, Activity, Shift } = require('../../database/mongo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automation_pulse')
        .setDescription('⚡ Real-time automation system status — view all configured automations and their health'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const license = await validatePremiumLicense(interaction);
            if (!license.allowed) {
                return interaction.editReply({ embeds: [license.embed], components: license.components });
            }

            const guildId = interaction.guildId;
            const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

            const [guildData, weekActs, weekShifts] = await Promise.all([
                Guild.findOne({ guildId }).lean(),
                Activity.find({ guildId, createdAt: { $gte: sevenDaysAgo } }).lean(),
                Shift.find({ guildId, startTime: { $gte: sevenDaysAgo }, endTime: { $ne: null } }).lean()
            ]);

            const settings = guildData?.settings || {};
            const modules = settings.modules || {};

            // Real system statuses from DB config
            const systems = [
                {
                    name: '🎫 Ticket System',
                    active: !!settings.logChannel || modules.tickets,
                    detail: settings.logChannel ? `Log channel: <#${settings.logChannel}>` : 'Not configured'
                },
                {
                    name: '🛡️ Moderation System',
                    active: modules.moderation !== false,
                    detail: settings.mutedRole ? `Mute role: <@&${settings.mutedRole}>` : 'No muted role set'
                },
                {
                    name: '📊 Analytics Tracking',
                    active: modules.analytics !== false,
                    detail: `${weekActs.length} events tracked this week`
                },
                {
                    name: '🔔 Activity Alerts',
                    active: !!(settings.alerts?.enabled),
                    detail: settings.alerts?.channelId ? `Alert channel: <#${settings.alerts.channelId}>` : 'Not configured'
                },
                {
                    name: '📈 Promotion System',
                    active: modules.automation === true,
                    detail: settings.promotionChannel ? `Channel: <#${settings.promotionChannel}>` : 'No promotion channel set'
                },
                {
                    name: '⏱️ Shift Tracking',
                    active: weekShifts.length > 0,
                    detail: `${weekShifts.length} shifts completed this week`
                }
            ];

            const activeCount = systems.filter(s => s.active).length;
            const healthPct = Math.round((activeCount / systems.length) * 100);
            const healthBar = createProgressBar(healthPct);

            const systemField = systems.map(s => `${s.active ? '🟢' : '🔴'} **${s.name}** — ${s.detail}`).join('\n');

            const embed = await createCustomEmbed(interaction, {
                title: `⚡ Automation Pulse — ${interaction.guild.name}`,
                thumbnail: interaction.guild.iconURL({ dynamic: true }),
                description: `Real-time status of all configured automation systems.\n\n**System Health:** \`${healthBar}\` **${healthPct}%** (${activeCount}/${systems.length} active)`,
                fields: [
                    { name: '🔧 System Status', value: systemField, inline: false },
                    { name: '⚡ Events (7d)', value: `\`${weekActs.length.toLocaleString()}\``, inline: true },
                    { name: '🔄 Shifts (7d)', value: `\`${weekShifts.length}\``, inline: true },
                    { name: '📌 Guild ID', value: `\`${guildId}\``, inline: true }
                ],
                color: healthPct >= 80 ? 'success' : healthPct >= 50 ? 'warning' : 'error',
                footer: 'uwu-chan • Enterprise Automation Pulse • Real DB Config'
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[automation_pulse] Error:', error);
            const errEmbed = createErrorEmbed('Failed to load automation pulse data.');
            if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
            else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
    }
};
