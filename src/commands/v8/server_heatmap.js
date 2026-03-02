const { SlashCommandBuilder } = require('discord.js');
const { createCustomEmbed, createErrorEmbed } = require('../../utils/embeds');
const { validatePremiumLicense } = require('../../utils/premium_guard');
const { Activity } = require('../../database/mongo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server_heatmap')
    .setDescription('🌡️ Visual server activity heatmap — hour-by-hour real data over 30 days'),

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

      if (activities.length === 0) {
        return interaction.editReply({ embeds: [createErrorEmbed('No activity data available yet. Use commands to start building your heatmap!')] });
      }

      // Build 24-hour activity counts from real data
      const hourCounts = new Array(24).fill(0);
      activities.forEach(a => {
        const h = new Date(a.createdAt).getHours();
        hourCounts[h]++;
      });

      const maxVal = Math.max(...hourCounts, 1);

      // 4-row ASCII heatmap (intensity levels)
      const levels = ['▁', '▃', '▆', '█'];
      const heatRows = [3, 2, 1, 0].map(level =>
        hourCounts.map(c => {
          const intensity = Math.floor((c / maxVal) * 4);
          return intensity > level ? levels[level] : ' ';
        }).join('')
      );

      // Hour-of-day label row (every 6 hours)
      const labelRow = Array.from({ length: 24 }, (_, i) => (i % 6 === 0 ? String(i).padStart(2, '0') : '  ')).join('');
      const heatmapDisplay = [...heatRows, labelRow].join('\n');

      // Day-of-week breakdown
      const dayCounts = new Array(7).fill(0);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      activities.forEach(a => { dayCounts[new Date(a.createdAt).getDay()]++; });
      const maxDay = Math.max(...dayCounts, 1);
      const dayBar = dayCounts.map((c, i) => {
        const bars = Math.round((c / maxDay) * 6);
        return `${dayNames[i]}: ${'█'.repeat(bars)}${'░'.repeat(6 - bars)} ${c}`;
      }).join('\n');

      const peakHour = hourCounts.indexOf(maxVal);
      const quietHour = hourCounts.indexOf(Math.min(...hourCounts));
      const peakDay = dayNames[dayCounts.indexOf(Math.max(...dayCounts))];

      const embed = await createCustomEmbed(interaction, {
        title: `🌡️ Server Heatmap — ${interaction.guild.name}`,
        thumbnail: interaction.guild.iconURL({ dynamic: true }),
        description: `Real activity heatmap from **${activities.length.toLocaleString()}** events over **30 days**.\n\`\`\`\n${heatmapDisplay}\`\`\`\n*▁▃▆█ = Low → Peak activity*`,
        fields: [
          { name: '⚡ Peak Hour', value: `\`${String(peakHour).padStart(2, '0')}:00\` — \`${maxVal}\` events`, inline: true },
          { name: '😴 Quiet Hour', value: `\`${String(quietHour).padStart(2, '0')}:00\``, inline: true },
          { name: '📅 Busiest Day', value: `\`${peakDay}\``, inline: true },
          { name: '📊 Day-of-Week Breakdown', value: `\`\`\`\n${dayBar}\`\`\``, inline: false }
        ],
        color: 'zenith',
        footer: 'uwu-chan • Enterprise Visual Heatmap • Real DB Data'
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[server_heatmap] Error:', error);
      const errEmbed = createErrorEmbed('Failed to generate server heatmap.');
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  }
};
