const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createCustomEmbed, createErrorEmbed } = require('../../utils/embeds');
const { validatePremiumLicense } = require('../../utils/premium_guard');
const { Warning } = require('../../database/mongo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('smart_alerts')
    .setDescription('🚨 Real-time smart alert analysis — detect warning spikes and at-risk users from real data'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const license = await validatePremiumLicense(interaction);
      if (!license.allowed) {
        return interaction.editReply({ embeds: [license.embed], components: license.components });
      }

      const guildId = interaction.guildId;
      const now = new Date();
      const oneDayAgo = new Date(now - 86400000);
      const sevenDaysAgo = new Date(now - 7 * 86400000);

      const [dayWarnings, weekWarnings] = await Promise.all([
        Warning.find({ guildId, createdAt: { $gte: oneDayAgo } }).lean(),
        Warning.find({ guildId, createdAt: { $gte: sevenDaysAgo } }).lean()
      ]);

      // Spike detection: today vs 7-day daily average
      const weekDailyAvg = weekWarnings.length / 7;
      const spikeMultiplier = weekDailyAvg > 0 ? (dayWarnings.length / weekDailyAvg).toFixed(1) : 'N/A';
      const isSpike = weekDailyAvg > 0 && dayWarnings.length > weekDailyAvg * 1.5;

      // At-risk users: 3+ warnings in 24h
      const userWarnCounts = {};
      dayWarnings.forEach(w => { userWarnCounts[w.userId] = (userWarnCounts[w.userId] || 0) + 1; });
      const atRiskUsers = Object.entries(userWarnCounts).filter(([, count]) => count >= 2);

      // Most warned user this week
      const weekUserCounts = {};
      weekWarnings.forEach(w => { weekUserCounts[w.userId] = (weekUserCounts[w.userId] || 0) + 1; });
      const mostWarnedId = Object.entries(weekUserCounts).sort((a, b) => b[1] - a[1])[0];

      // Alert severity
      const alertLevel = isSpike ? '🔴 **SPIKE DETECTED**' : atRiskUsers.length > 0 ? '🟡 **MODERATE RISK**' : '🟢 **Normal Activity**';
      const alertColor = isSpike ? 'error' : atRiskUsers.length > 0 ? 'warning' : 'success';

      const atRiskDisplay = atRiskUsers.length > 0
        ? atRiskUsers.map(([uid, count]) => `• <@${uid}> — \`${count}\` warnings today`).join('\n')
        : '`No at-risk users detected`';

      const embed = await createCustomEmbed(interaction, {
        title: `🚨 Smart Alerts — ${interaction.guild.name}`,
        thumbnail: interaction.guild.iconURL({ dynamic: true }),
        description: `Real-time warning analysis and spike detection.\n\n**Alert Level:** ${alertLevel}`,
        fields: [
          { name: '⚠️ Warnings Today', value: `\`${dayWarnings.length}\``, inline: true },
          { name: '📅 Warnings This Week', value: `\`${weekWarnings.length}\``, inline: true },
          { name: '📊 Daily Average (7d)', value: `\`${weekDailyAvg.toFixed(1)}/day\``, inline: true },
          { name: '📈 Today vs Average', value: `\`${spikeMultiplier}x\` ${isSpike ? '⚠️ Spike!' : ''}`, inline: true },
          { name: '🚨 At-Risk Users (2+ today)', value: atRiskDisplay, inline: false },
          {
            name: '🏆 Most Warned (7d)',
            value: mostWarnedId ? `<@${mostWarnedId[0]}> — \`${mostWarnedId[1]}\` warnings` : '`None`',
            inline: false
          }
        ],
        color: alertColor,
        footer: 'uwu-chan • Enterprise Smart Alerts • Real Warning Data'
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[smart_alerts] Error:', error);
      const errEmbed = createErrorEmbed('Failed to analyze smart alerts.');
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  }
};
