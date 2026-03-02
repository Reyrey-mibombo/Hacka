const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCoolEmbed, createTierEmbed } = require('../../utils/embeds');
const { Guild } = require('../../database/mongo');

const PLAN_FEATURES = {
    free: {
        label: '🆓 Free (v1-v2)',
        color: '#5865F2',
        commands: '80 commands',
        features: [
            '✅ Staff shift tracking & profiles',
            '✅ Points & leaderboard system',
            '✅ Warn, promote, demote',
            '✅ Server analytics & charts',
            '✅ Ticket system',
            '✅ Activity heatmap',
            '✅ Weekly/monthly reports'
        ]
    },
    premium: {
        label: '💎 Premium (v3-v5)',
        color: '#ff73fa',
        commands: '80 + 89 = 169 commands',
        price: '$9.99/mo',
        features: [
            '✅ Everything in Free',
            '✅ Advanced moderation (ban, mute, audit logs)',
            '✅ Monthly & achievement analytics',
            '✅ Promotion predictor & role auto-assign',
            '✅ Staff efficiency & task optimization',
            '✅ Priority alerts & performance scoring',
            '✅ growth tracking & ROI calculator'
        ]
    },
    enterprise: {
        label: '🌟 Enterprise (v6-v8)',
        color: '#f1c40f',
        commands: '169 + 102 = 271 commands',
        price: '$24.99/mo',
        features: [
            '✅ Everything in Premium',
            '✅ AI forecasting (linear regression)',
            '✅ Server health score & smart alerts',
            '✅ Automation pulse dashboard',
            '✅ Zenith interactive dashboard (3 tabs)',
            '✅ Elite badges grant system',
            '✅ Zenith passport & visual rankings',
            '✅ Custom branding & white-label embeds'
        ]
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('🛒 View pricing plans and upgrade your server to Premium or Enterprise'),

    async execute(interaction) {
        try {
            const guildId = interaction.guildId;
            const guildData = await Guild.findOne({ guildId }).lean();
            const currentTier = guildData?.premium?.tier || 'free';

            const premiumUrl = process.env.STRIPE_CHECKOUT_URL || process.env.PAYPAL_CHECKOUT_URL || null;
            const enterpriseUrl = process.env.ENTERPRISE_CHECKOUT_URL || premiumUrl || null;

            const now = new Date();
            const expiresAt = guildData?.premium?.expiresAt;
            const expiryDisplay = expiresAt
                ? `Expires: <t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>`
                : currentTier === 'free' ? 'No active license' : 'Active (no expiry set)';

            const embed = createCoolEmbed({
                title: '🛒 uwu-chan Upgrade Center',
                description: `Choose the plan that fits your server's needs. All plans include real-time data, interactive embeds, and full Discord integration.\n\n**Your Current Plan:** \`${currentTier.toUpperCase()}\` — ${expiryDisplay}`,
                thumbnail: interaction.guild.iconURL({ dynamic: true }),
                color: currentTier === 'enterprise' ? '#f1c40f' : currentTier === 'premium' ? '#ff73fa' : '#5865F2'
            });

            // Build fields
            Object.entries(PLAN_FEATURES).forEach(([tier, plan]) => {
                const isActive = currentTier === tier || (tier === 'free' && currentTier === 'free');
                const priceStr = plan.price ? ` — **${plan.price}**` : ' — **Free Forever**';
                embed.addFields({
                    name: `${plan.label}${isActive ? ' ✅ (Active)' : ''}${priceStr}`,
                    value: [
                        `📦 ${plan.commands}`,
                        plan.features.join('\n')
                    ].join('\n'),
                    inline: false
                });
            });

            embed.setFooter({ text: 'uwu-chan • Use /activate to redeem a license key' });
            embed.setTimestamp();

            // Buttons
            const row = new ActionRowBuilder().addComponents(
                ...(premiumUrl ? [new ButtonBuilder()
                    .setLabel('💎 Buy Premium')
                    .setStyle(ButtonStyle.Link)
                    .setURL(premiumUrl)] : []),
                ...(enterpriseUrl ? [new ButtonBuilder()
                    .setLabel('🌟 Buy Enterprise')
                    .setStyle(ButtonStyle.Link)
                    .setURL(enterpriseUrl)] : []),
                new ButtonBuilder()
                    .setLabel('📖 Documentation')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://github.com/Reyrey-mibombo/uwu-chan-saas')
            );

            await interaction.reply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[buy] Error:', error);
            await interaction.reply({ content: '❌ Failed to load the upgrade menu.', ephemeral: true });
        }
    }
};
