const { SlashCommandBuilder } = require('discord.js');
const { createCustomEmbed, createErrorEmbed, createProgressBar } = require('../../utils/embeds');
const { validatePremiumLicense } = require('../../utils/premium_guard');
const { Activity, Shift, Warning, User } = require('../../database/mongo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('monthly_insights')
    .setDescription('📆 Comprehensive 30-day performance insights with real analytics'),

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
      const sixtyDaysAgo = new Date(now - 60 * 86400000);

      const [thisMonthActs, lastMonthActs, shifts, warnings, promotions, topUsers] = await Promise.all([
        Activity.find({ guildId, createdAt: { $gte: thirtyDaysAgo } }).lean(),
        Activity.find({ guildId, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }).lean(),
        Shift.find({ guildId, startTime: { $gte: thirtyDaysAgo }, endTime: { $ne: null } }).lean(),
        Warning.find({ guildId, createdAt: { $gte: thirtyDaysAgo } }).lean(),
        Activity.find({ guildId, type: 'promotion', createdAt: { $gte: thirtyDaysAgo } }).lean(),
        User.find({ userId: { $exists: true }, 'staff.points': { $gt: 0 } })
          .sort({ 'staff.points': -1 }).limit(5).lean()
      ]);

      const cmdCount = thisMonthActs.filter(a => a.type === 'command').length;
      const lastCmdCount = lastMonthActs.filter(a => a.type === 'command').length;
      const growth = lastCmdCount > 0 ? ((cmdCount - lastCmdCount) / lastCmdCount * 100).toFixed(1) : '∞';
      const growthEmoji = parseFloat(growth) >= 0 ? '📈' : '📉';

      const activeUsers = new Set(thisMonthActs.map(a => a.userId)).size;
      const totalShiftSecs = shifts.reduce((s, sh) => s + (sh.duration || 0), 0);
      const shiftHours = Math.floor(totalShiftSecs / 3600);

      // Daily avg
      const dailyAvg = (cmdCount / 30).toFixed(1);

      // Engagement %
      const engagePct = Math.min(100, Math.round((activeUsers / Math.max(interaction.guild.memberCount, 1)) * 100));

      // Top performers
      const topList = topUsers.length > 0
        ? topUsers.slice(0, 5).map((u, i) => {
          const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
          return `${medals[i]} ${u.username || `<@${u.userId}>`} — \`${(u.staff?.points || 0).toLocaleString()} pts\``;
        }).join('\n')
        : '`No data yet`';

      // Day-of-week breakdown
      const dayCounts = new Array(7).fill(0);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      thisMonthActs.forEach(a => { dayCounts[new Date(a.createdAt).getDay()]++; });
      const peakDay = dayNames[dayCounts.indexOf(Math.max(...dayCounts))];
      const dayBarline = dayCounts.map((c, i) => {
        const pct = Math.round((c / Math.max(...dayCounts, 1)) * 5);
        return `${dayNames[i]}: ${'█'.repeat(pct)}${'░'.repeat(5 - pct)} ${c}`;
      }).join('\n');

      const embed = await createCustomEmbed(interaction, {
        title: `📆 Monthly Insights — ${interaction.guild.name}`,
        thumbnail: interaction.guild.iconURL({ dynamic: true }),
        description: `Full 30-day performance breakdown for **${interaction.guild.name}**.\n\n**Engagement Rate:** \`${createProgressBar(engagePct)}\` **${engagePct}%**`,
        fields: [
          { name: '⚡ Commands This Month', value: `\`${cmdCount.toLocaleString()}\` ${growthEmoji} \`${growth}%\` vs last month`, inline: true },
          { name: '📅 Daily Average', value: `\`${dailyAvg}\` cmds/day`, inline: true },
          { name: '👥 Unique Active Users', value: `\`${activeUsers}\``, inline: true },
          { name: '🔄 Shifts Completed', value: `\`${shifts.length}\` shifts — \`${shiftHours}h\` total`, inline: true },
          { name: '⚠️ Warnings Issued', value: `\`${warnings.length}\``, inline: true },
          { name: '🏆 Promotions', value: `\`${promotions.length}\``, inline: true },
          { name: '📊 Activity by Day', value: `\`\`\`\n${dayBarline}\`\`\``, inline: false },
          { name: '🏅 Peak Day', value: `\`${peakDay}\``, inline: true },
          { name: '🎖️ Top 5 Staff', value: topList, inline: false }
        ],
        color: 'premium',
        footer: 'uwu-chan • Premium Monthly Insights • Last 30 Days'
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[monthly_insights] Error:', error);
      const errEmbed = createErrorEmbed('Failed to generate monthly insights.');
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  }
};
