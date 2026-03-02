const { SlashCommandBuilder } = require('discord.js');
const { createCustomEmbed, createErrorEmbed, createProgressBar } = require('../../utils/embeds');
const { validatePremiumLicense } = require('../../utils/premium_guard');
const { Activity } = require('../../database/mongo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('growth_tracking')
    .setDescription('📈 Track real member and activity growth trends over time'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const license = await validatePremiumLicense(interaction);
      if (!license.allowed) {
        return interaction.editReply({ embeds: [license.embed], components: license.components });
      }

      const guildId = interaction.guildId;
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 86400000);

      // Fetch 30 days of activity
      const activities = await Activity.find({ guildId, createdAt: { $gte: thirtyDaysAgo } })
        .sort({ createdAt: 1 }).lean();

      if (activities.length === 0) {
        return interaction.editReply({ embeds: [createErrorEmbed('Not enough activity data for growth tracking. Start using commands!')] });
      }

      // Group by week (4 weeks)
      const weekCounts = [0, 0, 0, 0];
      activities.forEach(a => {
        const daysAgo = Math.floor((now - new Date(a.createdAt)) / 86400000);
        const weekIdx = Math.min(3, Math.floor(daysAgo / 7));
        weekCounts[3 - weekIdx]++;
      });

      // Growth rates
      const weekLabels = ['Week 4 ago', 'Week 3 ago', 'Week 2 ago', 'This Week'];
      const maxWeek = Math.max(...weekCounts, 1);
      const weekDisplay = weekCounts.map((c, i) => {
        const bar = createProgressBar(Math.round((c / maxWeek) * 100), 10);
        const delta = i > 0 && weekCounts[i - 1] > 0
          ? ((c - weekCounts[i - 1]) / weekCounts[i - 1] * 100).toFixed(0)
          : null;
        const arrow = delta !== null ? (parseFloat(delta) > 0 ? `📈 +${delta}%` : `📉 ${delta}%`) : '';
        return `**${weekLabels[i]}**: \`${bar}\` \`${c}\` ${arrow}`;
      }).join('\n');

      // Week-over-week overall
      const thisWeek = weekCounts[3];
      const lastWeek = weekCounts[2];
      const overallGrowth = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100).toFixed(1) : '∞';
      const growthColor = parseFloat(overallGrowth) >= 0 ? '#43b581' : '#f04747';

      // Member count from Discord
      const memberCount = interaction.guild.memberCount;

      // Active users this week
      const oneWeekAgo = new Date(now - 7 * 86400000);
      const recentActs = activities.filter(a => new Date(a.createdAt) >= oneWeekAgo);
      const activeUsers = new Set(recentActs.map(a => a.userId)).size;
      const retentionPct = Math.min(100, Math.round((activeUsers / Math.max(memberCount, 1)) * 100));

      const embed = await createCustomEmbed(interaction, {
        title: `📈 Growth Tracking — ${interaction.guild.name}`,
        thumbnail: interaction.guild.iconURL({ dynamic: true }),
        description: `Real activity growth over the last **30 days** across **4 weeks**.`,
        fields: [
          { name: '📊 Weekly Activity Trend', value: weekDisplay, inline: false },
          { name: '📈 Week-over-Week Growth', value: `\`${overallGrowth}%\``, inline: true },
          { name: '👥 Members', value: `\`${memberCount.toLocaleString()}\``, inline: true },
          { name: '🔁 Weekly Retention', value: `\`${createProgressBar(retentionPct)}\` **${retentionPct}%**`, inline: false },
          { name: '⭐ Total Events (30d)', value: `\`${activities.length.toLocaleString()}\``, inline: true },
          { name: '👥 Active This Week', value: `\`${activeUsers}\` users`, inline: true }
        ],
        color: growthColor,
        footer: 'uwu-chan • Premium Growth Tracking • 30-Day View'
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[growth_tracking] Error:', error);
      const errEmbed = createErrorEmbed('Failed to load growth tracking data.');
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  }
};
