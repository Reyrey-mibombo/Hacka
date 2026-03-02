const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createPremiumEmbed, createErrorEmbed, createSuccessEmbed } = require('../../utils/embeds');
const { Guild } = require('../../database/mongo');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('💎 View Premium tier status and unlock v3-v5 commands for your server'),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: false });
            const guildId = interaction.guildId;
            const guildData = await Guild.findOne({ guildId }).lean();
            const currentTier = guildData?.premium?.tier || 'free';
            const isActive = currentTier === 'premium' || currentTier === 'enterprise';
            const premiumUrl = process.env.STRIPE_CHECKOUT_URL || process.env.PAYPAL_CHECKOUT_URL || null;

            const activatedAt = guildData?.premium?.activatedAt;
            const expiresAt = guildData?.premium?.expiresAt;
            const licenseKey = guildData?.premium?.licenseKey;

            const embed = createPremiumEmbed({
                title: 'Premium Tier — v3, v4, v5 Commands',
                description: `${isActive
                    ? `✅ **Premium is active on this server!**\n\nYou have access to all 89 Premium commands across v3, v4, and v5.`
                    : `💎 **Upgrade to unlock 89 additional commands**\n\nv3 (Premium Staff), v4 (Advanced Moderation), and v5 (Executive Analytics)`
                    }`,
                thumbnail: interaction.guild.iconURL({ dynamic: true }),
                fields: [
                    { name: '📊 Current Status', value: isActive ? '✅ **Active**' : '❌ **Not Active**', inline: true },
                    { name: '🏷️ Tier', value: `\`${currentTier.toUpperCase()}\``, inline: true },
                    ...(isActive ? [
                        { name: '📅 Activated', value: activatedAt ? `<t:${Math.floor(new Date(activatedAt).getTime() / 1000)}:D>` : '`Unknown`', inline: true },
                        { name: '⌛ Expires', value: expiresAt ? `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>` : '`No expiry set`', inline: true },
                        { name: '🔑 License', value: licenseKey ? `\`${licenseKey.substring(0, 4)}...${licenseKey.substring(licenseKey.length - 4)}\`` : '`N/A`', inline: true }
                    ] : []),
                    {
                        name: '📦 Premium Unlocks',
                        value: [
                            '**v3** — Achievement tracker, shift optimizer, monthly insights, task optimizer, role auto-assign',
                            '**v4** — Ban/kick/mute, audit logs, security hub, threat forecast, moderation charts',
                            '**v5** — Analytics dashboard, growth tracking, ROI calculator, performance stats, executive briefing'
                        ].join('\n'),
                        inline: false
                    }
                ],
                footer: isActive ? 'uwu-chan • Premium Active' : 'uwu-chan • Use /buy to upgrade'
            });

            const row = new ActionRowBuilder().addComponents(
                ...(isActive ? [] : [
                    ...(premiumUrl ? [new ButtonBuilder().setLabel('💎 Buy Premium').setStyle(ButtonStyle.Link).setURL(premiumUrl)] : []),
                    new ButtonBuilder().setCustomId('premium_activate').setLabel('🔑 Activate Key').setStyle(ButtonStyle.Primary)
                ]),
                new ButtonBuilder().setLabel('📖 All Plans').setStyle(ButtonStyle.Secondary).setCustomId('show_buy')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('[premium] Error:', error);
            const errEmbed = createErrorEmbed('Failed to load premium status.');
            if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
            else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
        }
    }
};
