const { SlashCommandBuilder } = require('discord.js');
const { createCustomEmbed, createErrorEmbed, createProgressBar } = require('../../utils/embeds');
const { validatePremiumLicense } = require('../../utils/premium_guard');
const { Activity } = require('../../database/mongo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('forecast')
    .setDescription('🔮 Enterprise 30-Day growth forecast using real linear regression on activity data'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const license = await validatePremiumLicense(interaction);
      if (!license.allowed) {
        return interaction.editReply({ embeds: [license.embed], components: license.components });
      }

      const guildId = interaction.guildId;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const activities = await Activity.find({ guildId, createdAt: { $gte: thirtyDaysAgo } }).lean();

      if (activities.length < 10) {
        return interaction.editReply({ embeds: [createErrorEmbed('Not enough data for forecasting (minimum 10 events needed). Start using commands to build your dataset!')] });
      }

      // Group by day (last 30 days)
      const now = Date.now();
      const dailyCounts = {};
      activities.forEach(a => {
        const daysAgo = Math.floor((now - new Date(a.createdAt).getTime()) / 86400000);
        const dayKey = String(30 - daysAgo);
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      });

      const days = Array.from({ length: 30 }, (_, i) => i + 1);
      const counts = days.map(d => dailyCounts[String(d)] || 0);

      // Linear regression: y = slope * x + intercept
      const n = days.length;
      const sumX = days.reduce((s, x) => s + x, 0);
      const sumY = counts.reduce((s, y) => s + y, 0);
      const sumXY = days.reduce((s, x, i) => s + x * counts[i], 0);
      const sumX2 = days.reduce((s, x) => s + x * x, 0);
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Forecast next 30 days
      const forecastDays = Array.from({ length: 30 }, (_, i) => 31 + i);
      const forecastValues = forecastDays.map(d => Math.max(0, Math.round(slope * d + intercept)));
      const projectedTotal = forecastValues.reduce((s, v) => s + v, 0);
      const currentTotal = counts.reduce((s, v) => s + v, 0);
      const forecastGrowth = currentTotal > 0 ? ((projectedTotal - currentTotal) / currentTotal * 100).toFixed(1) : '∞';

      // ASCII trend line (12 points)
      const trendSample = forecastValues.filter((_, i) => i % 3 === 0); // every 3rd day
      const trendMax = Math.max(...trendSample, 1);
      const trendLine = trendSample.map(v => {
        const h = Math.round((v / trendMax) * 4);
        return ['_', '▁', '▃', '▅', '▇'][h];
      }).join(' ');

      const growthColor = parseFloat(forecastGrowth) >= 0 ? '#43b581' : '#f04747';
      const growthArrow = parseFloat(forecastGrowth) >= 0 ? '📈' : '📉';

      const embed = await createCustomEmbed(interaction, {
        title: `🔮 30-Day Forecast — ${interaction.guild.name}`,
        thumbnail: interaction.guild.iconURL({ dynamic: true }),
        description: `Activity forecast using **linear regression** on the last **${activities.length}** real events.\n\n**Trend Line:** \`${trendLine}\``,
        fields: [
          { name: '📊 Current 30d Total', value: `\`${currentTotal.toLocaleString()}\` events`, inline: true },
          { name: '🔮 Projected 30d Total', value: `\`${projectedTotal.toLocaleString()}\` events`, inline: true },
          { name: `${growthArrow} Projected Growth`, value: `\`${forecastGrowth}%\``, inline: true },
          { name: '📐 Regression Slope', value: `\`${slope.toFixed(2)}\` events/day`, inline: true },
          { name: '🗓️ Forecast Period', value: `Next 30 days`, inline: true },
          { name: '📈 Engagement Bar', value: `\`${createProgressBar(Math.min(100, Math.round((currentTotal / Math.max(interaction.guild.memberCount, 1)) * 100 * 2)))} \``, inline: false }
        ],
        color: growthColor,
        footer: 'uwu-chan • Enterprise Forecast • Linear Regression on Real Data'
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[forecast] Error:', error);
      const errEmbed = createErrorEmbed('Failed to generate forecast. Please try again.');
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  }
};
