const { EmbedBuilder } = require('discord.js');

const EMBED_COLORS = {
    primary: '#5865F2',
    success: '#43b581',
    error: '#f04747',
    warning: '#faa61a',
    info: '#3498db',
    premium: '#ff73fa',
    enterprise: '#f1c40f',
    zenith: '#00fff5',
    dark: '#2f3136',
    free: '#5865F2'
};

// Tier-specific branding
const TIER_BRANDING = {
    free: { color: '#5865F2', prefix: '', footer: 'uwu-chan • Free Tier' },
    premium: { color: '#ff73fa', prefix: '✨ ', footer: 'uwu-chan • Premium Tier' },
    enterprise: { color: '#f1c40f', prefix: '👑 ', footer: 'uwu-chan • Enterprise Tier' },
    zenith: { color: '#00fff5', prefix: '💎 ', footer: 'uwu-chan • Zenith Hyper-Apex' }
};

/**
 * Creates a visual progress bar string
 * @param {number} percent 0-100
 * @param {number} length Bar character length
 * @returns {string}
 */
function createProgressBar(percent, length = 15) {
    const p = Math.min(Math.max(parseFloat(percent) || 0, 0), 100);
    const filled = Math.round((p / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Creates a tier-styled embed with consistent branding
 * @param {string} tier 'free' | 'premium' | 'enterprise' | 'zenith'
 * @param {Object} options Embed options
 * @returns {EmbedBuilder}
 */
function createTierEmbed(tier = 'free', options = {}) {
    const brand = TIER_BRANDING[tier] || TIER_BRANDING.free;
    return createCoolEmbed({
        ...options,
        color: options.color || brand.color,
        title: options.title ? `${brand.prefix}${options.title}` : options.title,
        branding: {
            footer: options.footer || brand.footer,
            ...options.branding
        }
    });
}

/**
 * Asynchronously generates a branded embed by fetching guild settings
 * @param {Object} interaction The discord interaction or message object
 * @param {Object} options Options for the embed
 * @returns {Promise<EmbedBuilder>}
 */
async function createCustomEmbed(interaction, options = {}) {
    let guildBranding = {};

    if (interaction && interaction.guildId) {
        try {
            const { Guild } = require('../database/mongo');
            const guildData = await Guild.findOne({ guildId: interaction.guildId }).lean();
            if (guildData?.customBranding) {
                guildBranding = guildData.customBranding;
            }
        } catch (e) {
            console.error('Failed to fetch guild branding for embeds', e);
        }
    }

    if (!options.branding) options.branding = {};

    // Server theme overrides default styling if present
    if (guildBranding.color) options.branding.color = guildBranding.color;
    if (guildBranding.footer) options.branding.footer = guildBranding.footer;
    if (guildBranding.iconURL) options.branding.iconURL = guildBranding.iconURL;

    return createCoolEmbed(options);
}

function createCoolEmbed(options = {}) {
    const embed = new EmbedBuilder();

    const branding = options.branding || {};

    // Set color
    let color = EMBED_COLORS.primary;
    if (branding.color) {
        color = branding.color;
    } else if (options.color) {
        color = EMBED_COLORS[options.color] || options.color;
    }
    embed.setColor(color);

    // Handle Custom Branding Footer
    const footerText = branding.footer || options.footer || null;
    const footerIcon = branding.iconURL || null;

    if (footerText && footerIcon) {
        embed.setFooter({ text: footerText, iconURL: footerIcon });
    } else if (footerText) {
        embed.setFooter({ text: footerText });
    } else if (footerIcon) {
        embed.setFooter({ text: '\u200B', iconURL: footerIcon });
    }

    embed.setTimestamp();

    // Set content
    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);

    if (options.author) {
        const authorData = { name: options.author.name };
        if (options.author.iconURL) authorData.iconURL = options.author.iconURL;
        if (options.author.url) authorData.url = options.author.url;
        embed.setAuthor(authorData);
    }

    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);

    if (options.fields && options.fields.length > 0) {
        embed.addFields(options.fields);
    }

    return embed;
}

/**
 * Creates an error embed
 */
function createErrorEmbed(message) {
    return createCoolEmbed({
        title: '❌ Error',
        description: message,
        color: 'error',
        footer: 'uwu-chan • Something went wrong'
    });
}

/**
 * Creates a success embed
 */
function createSuccessEmbed(title, message) {
    return createCoolEmbed({
        title: title || '✅ Success',
        description: message,
        color: 'success'
    });
}

/**
 * Creates a premium-styled embed
 */
function createPremiumEmbed(options = {}) {
    return createTierEmbed('premium', {
        ...options,
        title: options.title || 'Premium Feature'
    });
}

/**
 * Creates an enterprise-styled embed
 */
function createEnterpriseEmbed(options = {}) {
    return createTierEmbed('enterprise', {
        ...options,
        title: options.title || 'Enterprise Feature'
    });
}

/**
 * Creates a zenith-styled embed
 */
function createZenithEmbed(options = {}) {
    return createTierEmbed('zenith', {
        ...options,
        title: options.title || 'Zenith Feature'
    });
}

/**
 * Creates a stat field object for use in embed.addFields()
 * @param {string} label Field name
 * @param {string|number} value Field value
 * @param {boolean} inline
 * @returns {{ name, value, inline }}
 */
function createStatField(label, value, inline = true) {
    return { name: label, value: String(value), inline };
}

module.exports = {
    EMBED_COLORS,
    TIER_BRANDING,
    createProgressBar,
    createTierEmbed,
    createCoolEmbed,
    createCustomEmbed,
    createErrorEmbed,
    createSuccessEmbed,
    createPremiumEmbed,
    createEnterpriseEmbed,
    createZenithEmbed,
    createStatField
};
