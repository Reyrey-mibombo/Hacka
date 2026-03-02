const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEnterpriseEmbed, createErrorEmbed } = require('../../utils/embeds');
const { Guild } = require('../../database/mongo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('enterprise')
        .setDescription('🌟 Enterprise tier — unlock v6, v7, v8 commands with AI forecasting, automation, and visuals'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: false });
            const guildId = interaction.guildId;
            const guildData = await Guild.findOne({ guildId }).lean();
            const currentTier = guildData?.premium?.tier || 'free';
            const isActive = currentTier === 'enterprise';
            const enterpriseUrl = process.env.ENTERPRISE_CHECKOUT_URL || process.env.STRIPE_CHECKOUT_URL || null;

            const activatedAt = guildData?.premium?.activatedAt;
            const expiresAt = guildData?.premium?.expiresAt;

            const embed = createEnterpriseEmbed({
                title: 'Enterprise Tier — v6, v7, v8 Commands',
                description: `${isActive
                    ? `✅ **Enterprise is active on this server!**\n\nYou have access to all 102 Enterprise commands across v6, v7, and v8.`
                    : `🌟 **Upgrade to Enterprise** to unlock our most powerful features: AI forecasting, full automation, and visual dashboards.`
                    }`,
                thumbnail: interaction.guild.iconURL({ dynamic: true }),
                fields: [
                    { name: '📊 Status', value: isActive ? '✅ **Active**' : '❌ **Not Subscribed**', inline: true },
                    { name: '🏷️ Your Tier', value: `\`${currentTier.toUpperCase()}\``, inline: true },
                    ...(isActive ? [
                        { name: '📅 Activated', value: activatedAt ? `<t:${Math.floor(new Date(activatedAt).getTime() / 1000)}:D>` : '`Unknown`', inline: true },
                        { name: '⌛ Expires', value: expiresAt ? `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>` : '`No expiry set`', inline: true }
                    ] : []),
                    {
                        name: '📦 Enterprise Unlocks',
                        value: [
                            '**v6** — AI forecast (linear regression), server health score, engagement trends, role efficiency, productivity analysis',
                            '**v7** — Automation pulse, smart alerts (spike detection), auto-rewards (role grant), task completion, milestone tracking',
                            '**v8** — Interactive dashboard (3-tab), Zenith passport (shift history), elite badge system (grant/view/list), growth forecast, custom branding'
                        ].join('\n'),
                        inline: false
                    },
                    {
                        name: '💎 Enterprise Exclusive',
                        value: '• Custom server branding (colors, footer, icon)\n• White-label embed themes\n• Linear regression growth forecasting\n• Per-user productivity matrices',
                        inline: false
                    }
                ],
                footer: isActive ? 'uwu-chan • Enterprise Active' : 'uwu-chan • Use /buy to compare all plans'
            });

            const row = new ActionRowBuilder().addComponents(
                ...(isActive ? [] : [
                    ...(enterpriseUrl ? [new ButtonBuilder().setLabel('🌟 Buy Enterprise').setStyle(ButtonStyle.Link).setURL(enterpriseUrl)] : []),
                    new ButtonBuilder().setCustomId('enterprise_activate').setLabel('🔑 Activate Key').setStyle(ButtonStyle.Primary)
                ]),
                new ButtonBuilder().setCustomId('show_buy').setLabel('📊 Compare Plans').setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[enterprise] Error:', error);
            const errEmbed = createErrorEmbed('Failed to load enterprise status.');
            if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
            else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
    }
};
