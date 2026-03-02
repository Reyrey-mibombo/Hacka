const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { createCustomEmbed, createErrorEmbed, createProgressBar } = require('../../utils/embeds');
const { Activity, Shift, Warning, User } = require('../../database/mongo');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analytics_dashboard')
    .setDescription('📊 Full real-time analytics dashboard with Today/Week/Month views')
    .addStringOption(opt =>
      opt.setName('period')
        .setDescription('Time period to analyze')
        .addChoices(
          { name: '📅 Today', value: 'today' },
          { name: '📆 This Week', value: 'week' },
          { name: '🗓️ This Month', value: 'month' }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const guildId = interaction.guildId;
      let period = interaction.options.getString('period') || 'week';

      const embed = await generateDashboard(interaction, guildId, period);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dash_today').setLabel('📅 Today').setStyle(period === 'today' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dash_week').setLabel('📆 Week').setStyle(period === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dash_month').setLabel('🗓️ Month').setStyle(period === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      );

      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 180000
      });

      collector.on('collect', async i => {
        await i.deferUpdate();
        const p = i.customId.replace('dash_', '');
        const newEmbed = await generateDashboard(interaction, guildId, p);
        const newRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('dash_today').setLabel('📅 Today').setStyle(p === 'today' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('dash_week').setLabel('📆 Week').setStyle(p === 'week' ? ButtonStyle.Primary : ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('dash_month').setLabel('🗓️ Month').setStyle(p === 'month' ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );
        await i.editReply({ embeds: [newEmbed], components: [newRow] });
      });

      collector.on('end', () => {
        msg.edit({ components: [] }).catch(() => { });
      });
    } catch (error) {
      console.error('[analytics_dashboard] Error:', error);
      const errEmbed = createErrorEmbed('Failed to load analytics dashboard.');
      if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: [errEmbed] });
      else await interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  }
};

async function generateDashboard(interaction, guildId, period) {
  const now = new Date();
  let since;
  let periodLabel;

  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    periodLabel = 'Today';
  } else if (period === 'month') {
    since = new Date(now - 30 * 86400000);
    periodLabel = 'Last 30 Days';
  } else {
    since = new Date(now - 7 * 86400000);
    periodLabel = 'Last 7 Days';
  }

  const [activities, shifts, warnings] = await Promise.all([
    Activity.find({ guildId, createdAt: { $gte: since } }).lean(),
    Shift.find({ guildId, startTime: { $gte: since }, endTime: { $ne: null } }).lean(),
    Warning.find({ guildId, createdAt: { $gte: since } }).lean()
  ]);

  const commands = activities.filter(a => a.type === 'command').length;
  const activeUsers = new Set(activities.map(a => a.userId)).size;
  const promotions = activities.filter(a => a.type === 'promotion').length;
  const totalShiftTime = shifts.reduce((s, sh) => s + (sh.duration || 0), 0);
  const shiftHours = Math.floor(totalShiftTime / 3600);
  const memberCount = interaction.guild.memberCount;
  const engagePct = Math.round((activeUsers / Math.max(memberCount, 1)) * 100);
  const engageBar = createProgressBar(engagePct);

  // Top command user
  const cmdByUser = {};
  activities.filter(a => a.type === 'command').forEach(a => {
    cmdByUser[a.userId] = (cmdByUser[a.userId] || 0) + 1;
  });
  const topUserId = Object.entries(cmdByUser).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topUserObj = topUserId ? await interaction.client.users.fetch(topUserId).catch(() => null) : null;
  const topUserStr = topUserObj ? `**${topUserObj.username}** — \`${cmdByUser[topUserId]} cmds\`` : '`No data yet`';

  return createCustomEmbed(interaction, {
    title: `📊 Analytics Dashboard — ${periodLabel}`,
    thumbnail: interaction.guild.iconURL({ dynamic: true }),
    description: `Real-time analytics for **${interaction.guild.name}**.`,
    fields: [
      { name: '⚡ Commands Run', value: `\`${commands.toLocaleString()}\``, inline: true },
      { name: '👥 Active Users', value: `\`${activeUsers}\``, inline: true },
      { name: '🔄 Shifts Done', value: `\`${shifts.length}\` (\`${shiftHours}h\`)`, inline: true },
      { name: '⚠️ Warnings', value: `\`${warnings.length}\``, inline: true },
      { name: '📈 Promotions', value: `\`${promotions}\``, inline: true },
      { name: '📊 Engagement Rate', value: `\`${engageBar}\` **${engagePct}%**`, inline: false },
      { name: '🏆 Top User', value: topUserStr, inline: false }
    ],
    color: 'premium',
    footer: `uwu-chan • Premium Analytics • ${periodLabel}`
  });
}
