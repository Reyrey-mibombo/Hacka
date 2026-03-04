/**
 * STRATA Dashboard - Main JavaScript
 * Comprehensive Discord Bot Dashboard
 */

// API Configuration
const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3000' : '';

// State Management
const state = {
    user: null,
    guilds: [],
    currentGuild: null,
    currentPage: 'overview',
    charts: {},
    data: {}
};

// DOM Elements
const elements = {
    loginScreen: document.getElementById('login-screen'),
    dashboardScreen: document.getElementById('dashboard-screen'),
    loginBtn: document.getElementById('login-btn'),
    logoutBtn: document.getElementById('logout-btn'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    guildSelector: document.getElementById('guild-selector'),
    tierBadge: document.getElementById('tier-badge'),
    pageTitle: document.getElementById('page-title'),
    modalContainer: document.getElementById('modal-container'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    toastContainer: document.getElementById('toast-container')
};

// ==================== AUTHENTICATION ====================

function initAuth() {
    const token = localStorage.getItem('discord_token');
    if (token) {
        validateToken(token);
    }

    elements.loginBtn.addEventListener('click', () => {
        window.location.href = `${API_BASE}/auth/discord`;
    });

    elements.logoutBtn.addEventListener('click', logout);

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        handleOAuthCallback(code);
    }
}

async function validateToken(token) {
    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const user = await response.json();
            state.user = user;
            showDashboard();
            loadGuilds();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Token validation failed:', error);
        logout();
    }
}

async function handleOAuthCallback(code) {
    try {
        const response = await fetch(`${API_BASE}/auth/callback?code=${code}`);
        const data = await response.json();

        if (data.token) {
            localStorage.setItem('discord_token', data.token);
            state.user = data.user;
            showDashboard();
            loadGuilds();
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (error) {
        console.error('OAuth callback failed:', error);
        showToast('Authentication failed', 'error');
    }
}

function logout() {
    localStorage.removeItem('discord_token');
    state.user = null;
    state.currentGuild = null;
    showLogin();
}

function showLogin() {
    elements.loginScreen.classList.remove('hidden');
    elements.dashboardScreen.classList.add('hidden');
}

function showDashboard() {
    elements.loginScreen.classList.add('hidden');
    elements.dashboardScreen.classList.remove('hidden');
    
    if (state.user) {
        elements.userAvatar.src = state.user.avatar 
            ? `https://cdn.discordapp.com/avatars/${state.user.id}/${state.user.avatar}.png`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        elements.userName.textContent = state.user.username;
    }
}

// ==================== GUILDS ====================

async function loadGuilds() {
    try {
        const token = localStorage.getItem('discord_token');
        const response = await fetch(`${API_BASE}/api/dashboard/guilds`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const guilds = await response.json();
            state.guilds = guilds;
            renderGuildSelector();
        }
    } catch (error) {
        console.error('Failed to load guilds:', error);
    }
}

function renderGuildSelector() {
    const select = elements.guildSelector;
    select.innerHTML = '<option value="">Select Server</option>';

    state.guilds.forEach(guild => {
        const option = document.createElement('option');
        option.value = guild.id;
        option.textContent = guild.name;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        const guildId = e.target.value;
        if (guildId) {
            selectGuild(guildId);
        }
    });

    // Auto-select first guild if available
    if (state.guilds.length > 0 && !state.currentGuild) {
        select.value = state.guilds[0].id;
        selectGuild(state.guilds[0].id);
    }
}

async function selectGuild(guildId) {
    const guild = state.guilds.find(g => g.id === guildId);
    if (!guild) return;

    state.currentGuild = guild;
    elements.tierBadge.textContent = guild.tier;
    elements.tierBadge.className = `tier-badge tier-${guild.tier}`;

    await loadGuildData();
}

async function loadGuildData() {
    if (!state.currentGuild) return;

    const token = localStorage.getItem('discord_token');
    const guildId = state.currentGuild.id;

    try {
        // Load overview data
        const overviewRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (overviewRes.ok) {
            const overview = await overviewRes.json();
            state.data.overview = overview;
            updateOverviewStats(overview);
        }

        // Load data based on current page
        loadPageData(state.currentPage);
    } catch (error) {
        console.error('Failed to load guild data:', error);
    }
}

// ==================== NAVIGATION ====================

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);

            // Update active state
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Tab buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            const tabContainer = e.target.closest('.tabs');
            const tabContent = e.target.closest('.page').querySelectorAll('.tab-content');
            const tabId = e.target.dataset.tab;

            tabContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            tabContent.forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${tabId}`)?.classList.add('active');
        }
    });
}

function navigateTo(page) {
    state.currentPage = page;

    // Update page title
    const titles = {
        'overview': 'Dashboard',
        'staff': 'Staff Management',
        'moderation': 'Moderation',
        'leveling': 'Leveling System',
        'reaction-roles': 'Reaction Roles',
        'giveaways': 'Giveaways',
        'welcome': 'Welcome Settings',
        'automod': 'Auto-Moderation',
        'logging': 'Logging',
        'commands': 'Custom Commands',
        'analytics': 'Analytics',
        'economy': 'Economy System',
        'settings': 'Settings'
    };

    elements.pageTitle.textContent = titles[page] || page;

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`)?.classList.add('active');

    // Load page data
    loadPageData(page);
}

async function loadPageData(page) {
    if (!state.currentGuild) return;

    const token = localStorage.getItem('discord_token');
    const guildId = state.currentGuild.id;

    try {
        switch (page) {
            case 'overview':
                await loadOverviewData(token, guildId);
                break;
            case 'staff':
                await loadStaffData(token, guildId);
                break;
            case 'moderation':
                await loadModerationData(token, guildId);
                break;
            case 'leveling':
                await loadLevelingData(token, guildId);
                break;
            case 'reaction-roles':
                await loadReactionRolesData(token, guildId);
                break;
            case 'giveaways':
                await loadGiveawaysData(token, guildId);
                break;
            case 'welcome':
                await loadWelcomeData(token, guildId);
                break;
            case 'automod':
                await loadAutomodData(token, guildId);
                break;
            case 'logging':
                await loadLoggingData(token, guildId);
                break;
            case 'commands':
                await loadCommandsData(token, guildId);
                break;
            case 'analytics':
                await loadAnalyticsData(token, guildId);
                break;
            case 'economy':
                await loadEconomyData(token, guildId);
                break;
            case 'settings':
                await loadSettingsData(token, guildId);
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${page} data:`, error);
    }
}

// ==================== OVERVIEW PAGE ====================

function updateOverviewStats(data) {
    document.getElementById('stat-members').textContent = data.stats?.staffCount || 0;
    document.getElementById('stat-staff').textContent = data.stats?.staffCount || 0;
    document.getElementById('stat-shifts').textContent = data.stats?.shiftCount || 0;
    document.getElementById('stat-warnings').textContent = data.stats?.warnCount || 0;
}

async function loadOverviewData(token, guildId) {
    // Activity chart
    const ctx = document.getElementById('activity-chart')?.getContext('2d');
    if (ctx) {
        const activityData = state.data.overview?.activity || [];
        
        if (state.charts.activity) {
            state.charts.activity.destroy();
        }

        state.charts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: activityData.map(a => new Date(a.date).toLocaleDateString()),
                datasets: [{
                    label: 'Activity',
                    data: activityData.map(a => a.count),
                    borderColor: '#6c63ff',
                    backgroundColor: 'rgba(108, 99, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Recent activity
    const activityList = document.getElementById('recent-activity');
    if (activityList) {
        activityList.innerHTML = `
            <div class="activity-item">
                <i class="fas fa-info-circle"></i>
                <span>Dashboard loaded successfully</span>
            </div>
        `;
    }
}

// ==================== STAFF PAGE ====================

async function loadStaffData(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const staff = await response.json();
        renderStaffTable(staff);
    }
}

function renderStaffTable(staff) {
    const tbody = document.getElementById('staff-table');
    if (!tbody) return;

    tbody.innerHTML = staff.map(member => `
        <tr>
            <td>
                <div class="user-cell">
                    <span>${member.username}</span>
                </div>
            </td>
            <td><span class="badge badge-${member.role}">${member.role}</span></td>
            <td>${member.points}</td>
            <td>${member.shifts}</td>
            <td>
                <span class="status ${member.onShift ? 'online' : 'offline'}">
                    ${member.onShift ? 'On Shift' : 'Off Duty'}
                </span>
            </td>
            <td>
                <button class="btn btn-icon" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-icon" title="Profile">
                    <i class="fas fa-user"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==================== MODERATION PAGE ====================

async function loadModerationData(token, guildId) {
    // Load moderation actions
    const actionsRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/moderation/actions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (actionsRes.ok) {
        const actions = await actionsRes.json();
        renderModerationActions(actions);
    }

    // Load warnings
    const warningsRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/warnings`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (warningsRes.ok) {
        const warnings = await warningsRes.json();
        renderWarnings(warnings);
    }
}

function renderModerationActions(actions) {
    const tbody = document.getElementById('mod-actions-table');
    if (!tbody) return;

    const actionIcons = {
        'ban': 'fa-ban',
        'kick': 'fa-user-times',
        'timeout': 'fa-clock',
        'warn': 'fa-exclamation-triangle'
    };

    tbody.innerHTML = actions.map(action => `
        <tr>
            <td>
                <i class="fas ${actionIcons[action.actionType] || 'fa-gavel'}"></i>
                ${action.actionType}
            </td>
            <td>${action.targetUsername}</td>
            <td>${action.moderatorUsername}</td>
            <td>${action.reason || 'No reason'}</td>
            <td>${new Date(action.createdAt).toLocaleDateString()}</td>
            <td>
                <span class="badge ${action.active ? 'badge-warning' : 'badge-success'}">
                    ${action.active ? 'Active' : 'Resolved'}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderWarnings(warnings) {
    const tbody = document.getElementById('warnings-table');
    if (!tbody) return;

    tbody.innerHTML = warnings.map(warning => `
        <tr>
            <td>${warning.targetUsername}</td>
            <td>${warning.issuerUsername}</td>
            <td>${warning.reason}</td>
            <td>
                <span class="badge badge-${warning.severity}">${warning.severity}</span>
            </td>
            <td>${new Date(warning.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-icon" title="Revoke">
                    <i class="fas fa-undo"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==================== LEVELING PAGE ====================

async function loadLevelingData(token, guildId) {
    // Load config
    const configRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/leveling/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (configRes.ok) {
        const config = await configRes.json();
        fillLevelingConfig(config);
    }

    // Load level roles
    const rolesRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/leveling/roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (rolesRes.ok) {
        const { roles } = await rolesRes.json();
        renderLevelRoles(roles);
    }

    // Load rewards
    const rewardsRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/leveling/rewards`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (rewardsRes.ok) {
        const { rewards } = await rewardsRes.json();
        renderLevelRewards(rewards);
    }

    // Load leaderboard
    const lbRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/leveling/leaderboard?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (lbRes.ok) {
        const { leaderboard } = await lbRes.json();
        renderXpLeaderboard(leaderboard);
    }
}

function fillLevelingConfig(config) {
    document.getElementById('leveling-enabled').checked = config.enabled;
    document.getElementById('xp-rate').value = config.xpRate;
    document.getElementById('xp-cooldown').value = config.xpCooldown;
    document.getElementById('min-xp').value = config.minXpPerMessage;
    document.getElementById('max-xp').value = config.maxXpPerMessage;
    document.getElementById('level-channel').value = config.levelUpChannelId || '';
    document.getElementById('level-message').value = config.levelUpMessage;
    document.getElementById('dm-level-up').checked = config.dmOnLevelUp;
    document.getElementById('stack-roles').checked = config.stackRoles;
}

function renderLevelRoles(roles) {
    const tbody = document.querySelector('#level-roles-table tbody');
    if (!tbody) return;

    tbody.innerHTML = roles.map(role => `
        <tr>
            <td>Level ${role.level}</td>
            <td>${role.roleId}</td>
            <td>${role.removePrevious ? 'Yes' : 'No'}</td>
            <td>
                <button class="btn btn-icon" onclick="deleteLevelRole(${role.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderLevelRewards(rewards) {
    const container = document.getElementById('level-rewards-list');
    if (!container) return;

    container.innerHTML = rewards.map(reward => `
        <div class="reward-card">
            <h4>${reward.name}</h4>
            <p>${reward.description || ''}</p>
            <div class="reward-meta">
                <span>Level ${reward.levelRequired}</span>
                <span>${reward.rewardType}</span>
            </div>
            <button class="btn btn-icon" onclick="deleteLevelReward(${reward.id})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function renderXpLeaderboard(leaderboard) {
    const tbody = document.querySelector('#xp-leaderboard-table tbody');
    if (!tbody) return;

    tbody.innerHTML = leaderboard.map((user, i) => `
        <tr>
            <td>
                <span class="rank">${i + 1}</span>
            </td>
            <td>${user.username}</td>
            <td>Level ${user.level}</td>
            <td>${user.xp} XP</td>
            <td>${user.totalMessages}</td>
        </tr>
    `).join('');
}

// ==================== REACTION ROLES PAGE ====================

async function loadReactionRolesData(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/reaction-roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const { panels } = await response.json();
        renderReactionPanels(panels);
    }
}

function renderReactionPanels(panels) {
    const container = document.getElementById('reaction-panels-list');
    if (!container) return;

    container.innerHTML = panels.map(panel => `
        <div class="panel-card">
            <div class="panel-header" style="background-color: ${panel.color}">
                <h4>${panel.name}</h4>
                <span class="panel-status">${panel.messageId ? 'Active' : 'Draft'}</span>
            </div>
            <div class="panel-body">
                <p>${panel.description || 'No description'}</p>
                <div class="panel-roles">
                    ${panel.roles.map(role => `
                        <div class="panel-role">
                            <span class="emoji">${role.emoji}</span>
                            <span class="role-name">${role.roleId}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="panel-footer">
                <button class="btn btn-sm" onclick="editReactionPanel(${panel.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteReactionPanel(${panel.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// ==================== GIVEAWAYS PAGE ====================

async function loadGiveawaysData(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/giveaways`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const { giveaways } = await response.json();
        renderGiveaways(giveaways);
    }
}

function renderGiveaways(giveaways) {
    const activeContainer = document.getElementById('active-giveaways');
    const endedContainer = document.getElementById('ended-giveaways');

    const active = giveaways.filter(g => !g.ended);
    const ended = giveaways.filter(g => g.ended);

    const renderGiveawayCard = (giveaway) => {
        const endTime = new Date(giveaway.endTime);
        const now = new Date();
        const timeLeft = endTime - now;

        return `
            <div class="giveaway-card">
                <div class="giveaway-prize">
                    <i class="fas fa-gift"></i>
                    <h4>${giveaway.prize}</h4>
                </div>
                <div class="giveaway-info">
                    <p>${giveaway.description || ''}</p>
                    <div class="giveaway-stats">
                        <span><i class="fas fa-users"></i> ${giveaway.entriesCount} entries</span>
                        <span><i class="fas fa-trophy"></i> ${giveaway.winnerCount} winner${giveaway.winnerCount > 1 ? 's' : ''}</span>
                    </div>
                    ${!giveaway.ended ? `
                        <div class="giveaway-timer">
                            ${formatTimeLeft(timeLeft)}
                        </div>
                    ` : `
                        <div class="giveaway-winners">
                            Winners: ${giveaway.winners.join(', ') || 'None'}
                        </div>
                    `}
                </div>
                <div class="giveaway-actions">
                    ${!giveaway.ended ? `
                        <button class="btn btn-primary btn-sm" onclick="endGiveaway(${giveaway.id})">End Early</button>
                        <button class="btn btn-sm" onclick="editGiveaway(${giveaway.id})">Edit</button>
                    ` : `
                        <button class="btn btn-primary btn-sm" onclick="rerollGiveaway(${giveaway.id})">Reroll</button>
                    `}
                    <button class="btn btn-danger btn-sm" onclick="deleteGiveaway(${giveaway.id})">Delete</button>
                </div>
            </div>
        `;
    };

    if (activeContainer) {
        activeContainer.innerHTML = active.length > 0 
            ? active.map(renderGiveawayCard).join('')
            : '<p class="empty-state">No active giveaways</p>';
    }

    if (endedContainer) {
        endedContainer.innerHTML = ended.length > 0
            ? ended.map(renderGiveawayCard).join('')
            : '<p class="empty-state">No ended giveaways</p>';
    }
}

function formatTimeLeft(ms) {
    if (ms < 0) return 'Ended';
    
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
}

// ==================== WELCOME PAGE ====================

async function loadWelcomeData(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/systems/welcome`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const config = await response.json();
        document.getElementById('welcome-enabled').checked = config.enabled;
        document.getElementById('welcome-channel').value = config.channel || '';
        document.getElementById('welcome-message').value = config.message || '';
        document.getElementById('welcome-dm').checked = config.dm || false;
        document.getElementById('welcome-dm-message').value = config['dm-message'] || '';
    }
}

// ==================== AUTOMOD PAGE ====================

async function loadAutomodData(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/automod/rules`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const { rules } = await response.json();
        renderAutomodRules(rules);
    }
}

function renderAutomodRules(rules) {
    const container = document.getElementById('automod-rules-list');
    if (!container) return;

    container.innerHTML = rules.map(rule => `
        <div class="rule-card ${rule.enabled ? '' : 'disabled'}">
            <div class="rule-header">
                <h4>${rule.name}</h4>
                <label class="switch">
                    <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="toggleAutomodRule(${rule.id}, this.checked)">
                    <span class="slider"></span>
                </label>
            </div>
            <div class="rule-body">
                <span class="rule-type">${rule.ruleType}</span>
                <span class="rule-action">${rule.action}</span>
            </div>
            <div class="rule-footer">
                <button class="btn btn-sm" onclick="editAutomodRule(${rule.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteAutomodRule(${rule.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// ==================== LOGGING PAGE ====================

async function loadLoggingData(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/systems/logging`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const config = await response.json();
        document.getElementById('log-members').checked = config.members;
        document.getElementById('log-members-channel').value = config['members-ch'] || '';
        document.getElementById('log-messages').checked = config.messages;
        document.getElementById('log-messages-channel').value = config['messages-ch'] || '';
        document.getElementById('log-mod').checked = config.mod;
        document.getElementById('log-mod-channel').value = config['mod-ch'] || '';
    }
}

// ==================== COMMANDS PAGE ====================

async function loadCommandsData(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/custom-commands`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const { commands } = await response.json();
        renderCustomCommands(commands);
    }
}

function renderCustomCommands(commands) {
    const tbody = document.getElementById('custom-commands-table');
    if (!tbody) return;

    tbody.innerHTML = commands.map(cmd => `
        <tr>
            <td><code>${cmd.trigger}</code></td>
            <td><span class="badge">${cmd.type}</span></td>
            <td>${cmd.response.substring(0, 50)}${cmd.response.length > 50 ? '...' : ''}</td>
            <td>
                <span class="status ${cmd.enabled ? 'online' : 'offline'}">
                    ${cmd.enabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td>
                <button class="btn btn-icon" onclick="editCommand('${cmd.trigger}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-icon" onclick="deleteCommand('${cmd.trigger}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==================== ANALYTICS PAGE ====================

async function loadAnalyticsData(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/analytics/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        
        document.getElementById('stat-messages').textContent = formatNumber(data.activity?.messages || 0);
        document.getElementById('stat-voice').textContent = formatDuration(data.activity?.voiceMinutes || 0);
        document.getElementById('stat-joins').textContent = formatNumber(data.activity?.joins || 0);
        
        const growth = data.activity?.joins > 0 
            ? Math.round(((data.activity.joins - data.activity.leaves) / data.activity.joins) * 100)
            : 0;
        document.getElementById('stat-growth').textContent = `${growth}%`;

        // Render analytics chart
        renderAnalyticsChart(data.trend);

        // Load top members
        loadTopMembers(token, guildId);

        // Load heatmap
        loadHeatmap(token, guildId);
    }
}

function renderAnalyticsChart(trend) {
    const ctx = document.getElementById('analytics-chart')?.getContext('2d');
    if (!ctx) return;

    if (state.charts.analytics) {
        state.charts.analytics.destroy();
    }

    state.charts.analytics = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: trend?.map(t => new Date(t.date).toLocaleDateString()) || [],
            datasets: [
                {
                    label: 'Messages',
                    data: trend?.map(t => t.messages) || [],
                    backgroundColor: 'rgba(108, 99, 255, 0.5)',
                    borderColor: '#6c63ff',
                    borderWidth: 1
                },
                {
                    label: 'Active Members',
                    data: trend?.map(t => t.activeMembers) || [],
                    backgroundColor: 'rgba(76, 175, 80, 0.5)',
                    borderColor: '#4caf50',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

async function loadTopMembers(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/analytics/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const { activity } = await response.json();
        const tbody = document.querySelector('#top-members-table tbody');
        
        if (tbody) {
            tbody.innerHTML = activity.slice(0, 10).map((user, i) => `
                <tr>
                    <td>${user.username}</td>
                    <td>${formatNumber(user.messages)}</td>
                </tr>
            `).join('');
        }
    }
}

async function loadHeatmap(token, guildId) {
    const response = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/analytics/heatmap`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const { heatmap } = await response.json();
        const container = document.getElementById('activity-heatmap');
        
        if (container) {
            container.innerHTML = `
                <div class="heatmap-grid">
                    ${heatmap.map(h => `
                        <div class="heatmap-cell" style="opacity: ${Math.min(1, h.messages / 100)}">
                            <span class="heatmap-hour">${h.hour}:00</span>
                            <span class="heatmap-value">${h.messages}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
}

// ==================== ECONOMY PAGE ====================

async function loadEconomyData(token, guildId) {
    // Load config
    const configRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/economy/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (configRes.ok) {
        const config = await configRes.json();
        document.getElementById('economy-enabled').checked = config.enabled;
        document.getElementById('currency-name').value = config.currencyName;
        document.getElementById('currency-symbol').value = config.currencySymbol;
        document.getElementById('daily-amount').value = config.dailyAmount;
        document.getElementById('work-cooldown').value = config.workCooldown;
    }

    // Load shop
    const shopRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/economy/shop`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (shopRes.ok) {
        const { items } = await shopRes.json();
        renderShopItems(items);
    }

    // Load leaderboard
    const lbRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/economy/leaderboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (lbRes.ok) {
        const { leaderboard } = await lbRes.json();
        renderEconomyLeaderboard(leaderboard);
    }
}

function renderShopItems(items) {
    const container = document.getElementById('shop-items-list');
    if (!container) return;

    container.innerHTML = items.map(item => `
        <div class="shop-item">
            <h4>${item.name}</h4>
            <p>${item.description || ''}</p>
            <div class="shop-item-price">
                <span class="price">${item.price}</span>
                <span class="stock">${item.stock === -1 ? 'Unlimited' : `${item.stock} left`}</span>
            </div>
            <div class="shop-item-actions">
                <button class="btn btn-sm" onclick="editShopItem(${item.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteShopItem(${item.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderEconomyLeaderboard(leaderboard) {
    const tbody = document.querySelector('#economy-leaderboard-table tbody');
    if (!tbody) return;

    tbody.innerHTML = leaderboard.map((user, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${user.userId}</td>
            <td>${formatNumber(user.balance)}</td>
            <td>${formatNumber(user.bank)}</td>
            <td>${formatNumber(user.total)}</td>
        </tr>
    `).join('');
}

// ==================== SETTINGS PAGE ====================

async function loadSettingsData(token, guildId) {
    // Load promotion requirements
    const promoRes = await fetch(`${API_BASE}/api/dashboard/guild/${guildId}/promotion-requirements`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (promoRes.ok) {
        const data = await promoRes.json();
        renderPromotionRequirements(data.requirements);
    }
}

function renderPromotionRequirements(requirements) {
    const container = document.getElementById('promo-requirements');
    if (!container) return;

    container.innerHTML = Object.entries(requirements).map(([rank, req]) => `
        <div class="requirement-group">
            <h5>${rank.charAt(0).toUpperCase() + rank.slice(1)}</h5>
            <div class="form-row">
                <div class="form-group">
                    <label>Points Required</label>
                    <input type="number" class="input" value="${req.points}" data-rank="${rank}" data-field="points">
                </div>
                <div class="form-group">
                    <label>Shifts Required</label>
                    <input type="number" class="input" value="${req.shifts}" data-rank="${rank}" data-field="shifts">
                </div>
            </div>
        </div>
    `).join('');
}

// ==================== FORM SUBMISSIONS ====================

function initFormHandlers() {
    // Leveling config form
    document.getElementById('leveling-config-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentGuild) return;

        const token = localStorage.getItem('discord_token');
        const config = {
            enabled: document.getElementById('leveling-enabled').checked,
            xpRate: parseFloat(document.getElementById('xp-rate').value),
            xpCooldown: parseInt(document.getElementById('xp-cooldown').value),
            minXpPerMessage: parseInt(document.getElementById('min-xp').value),
            maxXpPerMessage: parseInt(document.getElementById('max-xp').value),
            levelUpChannelId: document.getElementById('level-channel').value,
            levelUpMessage: document.getElementById('level-message').value,
            dmOnLevelUp: document.getElementById('dm-level-up').checked,
            stackRoles: document.getElementById('stack-roles').checked
        };

        try {
            const response = await fetch(`${API_BASE}/api/dashboard/guild/${state.currentGuild.id}/leveling/config`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (response.ok) {
                showToast('Leveling configuration saved', 'success');
            } else {
                showToast('Failed to save configuration', 'error');
            }
        } catch (error) {
            showToast('Error saving configuration', 'error');
        }
    });

    // Welcome form
    document.getElementById('welcome-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentGuild) return;

        const token = localStorage.getItem('discord_token');
        const config = {
            enabled: document.getElementById('welcome-enabled').checked,
            channel: document.getElementById('welcome-channel').value,
            message: document.getElementById('welcome-message').value,
            dm: document.getElementById('welcome-dm').checked,
            'dm-message': document.getElementById('welcome-dm-message').value
        };

        try {
            await fetch(`${API_BASE}/api/dashboard/guild/${state.currentGuild.id}/systems/welcome`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            showToast('Welcome settings saved', 'success');
        } catch (error) {
            showToast('Error saving welcome settings', 'error');
        }
    });

    // Logging form
    document.getElementById('logging-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentGuild) return;

        const token = localStorage.getItem('discord_token');
        const config = {
            members: document.getElementById('log-members').checked,
            'members-ch': document.getElementById('log-members-channel').value,
            messages: document.getElementById('log-messages').checked,
            'messages-ch': document.getElementById('log-messages-channel').value,
            mod: document.getElementById('log-mod').checked,
            'mod-ch': document.getElementById('log-mod-channel').value
        };

        try {
            await fetch(`${API_BASE}/api/dashboard/guild/${state.currentGuild.id}/systems/logging`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });
            showToast('Logging settings saved', 'success');
        } catch (error) {
            showToast('Error saving logging settings', 'error');
        }
    });
}

// ==================== UTILITY FUNCTIONS ====================

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatDuration(minutes) {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}d`;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== MODAL ====================

function showModal(title, content) {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = content;
    elements.modalContainer.classList.remove('hidden');
}

function hideModal() {
    elements.modalContainer.classList.add('hidden');
}

// Modal close handlers
document.querySelector('.modal-overlay')?.addEventListener('click', hideModal);
document.querySelector('.modal-close')?.addEventListener('click', hideModal);

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initNavigation();
    initFormHandlers();
});

// Export functions for inline event handlers
window.deleteLevelRole = async (id) => {
    if (!confirm('Are you sure?')) return;
    // Implementation
};

window.deleteLevelReward = async (id) => {
    if (!confirm('Are you sure?')) return;
    // Implementation
};

window.editReactionPanel = (id) => {
    // Implementation
};

window.deleteReactionPanel = async (id) => {
    if (!confirm('Are you sure?')) return;
    // Implementation
};

window.endGiveaway = async (id) => {
    if (!confirm('End this giveaway early?')) return;
    // Implementation
};

window.editGiveaway = (id) => {
    // Implementation
};

window.deleteGiveaway = async (id) => {
    if (!confirm('Are you sure?')) return;
    // Implementation
};

window.rerollGiveaway = async (id) => {
    // Implementation
};

window.toggleAutomodRule = async (id, enabled) => {
    // Implementation
};

window.editAutomodRule = (id) => {
    // Implementation
};

window.deleteAutomodRule = async (id) => {
    if (!confirm('Are you sure?')) return;
    // Implementation
};

window.editCommand = (trigger) => {
    // Implementation
};

window.deleteCommand = async (trigger) => {
    if (!confirm('Are you sure?')) return;
    // Implementation
};

window.editShopItem = (id) => {
    // Implementation
};

window.deleteShopItem = async (id) => {
    if (!confirm('Are you sure?')) return;
    // Implementation
};
