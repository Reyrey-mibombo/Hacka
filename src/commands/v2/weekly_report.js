const { SlashCommandBuilder } = require('discord.js');
const { createCustomEmbed, createErrorEmbed, createProgressBar } = require('../../utils/embeds');
const { Activity, Shift, Warning, User } = require('../../database/mongo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weekly_report')
    .setDescription('📅 Full weekly performance report — shifts, points, warnings, promotions'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const guildId = interaction.guildId;
      const now = new Date();
      const sevenDaysAgo = new Date(now - 7 * 86400000);
      const fourteenDaysAgo = new Date(now - 14 * 86400000);

      // Fetch current week and previous week in parallel
      const [
        thisWeekActs, lastWeekActs,
        thisWeekShifts, lastWeekShifts,
        thisWeekWarnings,
        topUsers
      ] = await Promise.all([
        Activity.find({ guildId, createdAt: { $gte: sevenDaysAgo } }).lean(),
        Activity.find({ guildId, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } }).lean(),
        Shift.find({ guildId, startTime: { $gte: sevenDaysAgo }, endTime: { $ne: null } }).lean(),
        Shift.find({ guildId, startTime: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }, endTime: { $ne: null } }).lean(),
        Warning.find({ guildId, createdAt: { $gte: sevenDaysAgo } }).lean(),
        User.find({ userId: { $exists: true }, 'staff.points': { $gt: 0 } })
          .sort({ 'staff.points': -1 })
          .limit(3)
          .lean()
      ]);

      // Analytics
      const cmdCount = thisWeekActs.filter(a => a.type === 'command').length;
      const lastCmdCount = lastWeekActs.filter(a => a.type === 'command').length;
      const activeUsers = new Set(thisWeekActs.map(a => a.userId)).size;

      const shiftTime = thisWeekShifts.reduce((s, sh) => s + (sh.duration || 0), 0);
      const lastShiftTime = lastWeekShifts.reduce((s, sh) => s + (sh.duration || 0), 0);

      const cmdDelta = lastCmdCount > 0 ? ((cmdCount - lastCmdCount) / lastCmdCount * 100).toFixed(1) : '∞';
      const shiftDelta = lastShiftTime > 0 ? ((shiftTime - lastShiftTime) / lastShiftTime * 100).toFixed(1) : '∞';
      const cmdArrow = parseFloat(cmdDelta) > 0 ? '📈' : (parseFloat(cmdDelta) < 0 ? '📉' : '➡️');
      const shiftArrow = parseFloat(shiftDelta) > 0 ? '📈' : (parseFloat(shiftDelta) < 0 ? '📉' : '➡️');

      const shiftHours = Math.floor(shiftTime / 3600);
      const shiftMins = Math.floor((shiftTime % 3600) / 60);

      // Top performers
      const topList = topUsers.length > 0
        ? await Promise.all(topUsers.map(async (u, i) => {
          const medals = ['🥇', '🥈', '🥉'];
          let username = u.username || `User ${u.userId}`;
          const pts = u.staff?.points || 0;
          return `${medals[i]} **${username}** — \`${pts.toLocaleString()} pts\``;
        }))
        : ['*No data yet.*'];

      // Activity bar
      const actBar = createProgressBar(Math.min(100, Math.round((activeUsers / Math.max(interaction.guild.memberCount, 1)) * 100)), 15);

      const embed = await createCustomEmbed(interaction, {
        title: `📅 Weekly Report — ${interaction.guild.name}`,
        thumbnail: interaction.guild.iconURL({ dynamic: true }),
        description: `Performance summary for the week of **<t:${Math.floor(sevenDaysAgo.getTime() / 1000)}:D>** → **<t:${Math.floor(now.getTime() / 1000)}:D>**`,
        fields: [
          { name: '⚡ Commands Executed', value: `\`${cmdCount.toLocaleString()}\` ${cmdArrow} \`${cmdDelta}%\` vs last week`, inline: true },
          { name: '🔄 Shifts Completed', value: `\`${thisWeekShifts.length}\` shifts • \`${shiftHours}h ${shiftMins}m\` ${shiftArrow} \`${shiftDelta}%\``, inline: true },
          { name: '⚠️ Warnings Issued', value: `\`${thisWeekWarnings.length}\` warnings`, inline: true },
          { name: '👥 Active Staff', value: `\`${actBar}\` **${activeUsers}** users active`, inline: false },
          { name: '🏆 Top Performers', value: topList.join('\n'), inline: false },
          { name: '📌 Week Summary', value: `\`${thisWeekActs.length}\` total events tracked this week`, inline: false }
        ],
        color: '#5865F2',
        footer: 'uwu-chan • Weekly Report • Real DB Data'
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[weekly_report] Error:', error);
      const errEmbed = createErrorEmbed('Failed to generate weekly report.');
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  }
};
