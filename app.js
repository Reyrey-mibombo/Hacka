// ── COMMANDS DATA (from extracted_commands.json) ──
const COMMANDS = [];
// Loaded dynamically from extracted_commands.json

// ── DEMO USER STATE ──
let currentUser = null;

// Discord OAuth config — replace with your real client ID
const DISCORD_CLIENT_ID = '1234567890'; // Replace with real client ID
const REDIRECT_URI = encodeURIComponent(window.location.origin + '/callback');
const DISCORD_OAUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20guilds`;

// DEMO DATA for dashboard preview
const DEMO_USER = {
    id: '1234567890',
    username: 'StaffMember',
    avatar: null,
    rank: 'senior',
    points: 387,
    shifts: 14,
    consistency: 82,
    warnings: 1,
    streak: 5,
    achievements: ['First Shift Completed', 'Iron Worker (4hr+ Shift)', '7-Day Streak Master']
};

const DEMO_STAFF = [
    { username: 'Reyrey', rank: 'admin', points: 1240, shifts: 42, consistency: 94, status: '🟢' },
    { username: 'Mibombo', rank: 'manager', points: 712, shifts: 27, consistency: 88, status: '🟢' },
    { username: 'StaffJane', rank: 'senior', points: 390, shifts: 16, consistency: 80, status: '🟡' },
    { username: 'HelperBob', rank: 'staff', points: 145, shifts: 7, consistency: 65, status: '🔴' },
    { username: 'NewTrial', rank: 'trial', points: 38, shifts: 2, consistency: 40, status: '🔴' }
];

const PROMO_REQS = [
    { rank: 'trial', emoji: '🔰', pts: 0, shifts: 0, consistency: 0, maxWarns: 99 },
    { rank: 'staff', emoji: '⭐', pts: 100, shifts: 5, consistency: 70, maxWarns: 3 },
    { rank: 'senior', emoji: '🌟', pts: 300, shifts: 10, consistency: 75, maxWarns: 2 },
    { rank: 'manager', emoji: '💎', pts: 600, shifts: 20, consistency: 80, maxWarns: 1 },
    { rank: 'admin', emoji: '👑', pts: 1000, shifts: 30, consistency: 85, maxWarns: 0 }
];

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    loadCommands();
    setupFilters();
    setupSearch();
    setupNav();
    checkOAuthCallback();
    animateStats();
    setupSidebar();
});

// ── PARTICLES ──
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (8 + Math.random() * 12) + 's';
        p.style.animationDelay = (Math.random() * 10) + 's';
        p.style.width = p.style.height = (1 + Math.random() * 2) + 'px';
        container.appendChild(p);
    }
}

// ── COMMANDS ──
async function loadCommands() {
    try {
        const res = await fetch('./extracted_commands.json');
        const data = await res.json();
        COMMANDS.push(...data);
        renderCommands(data);
    } catch {
        // fallback
        renderCommands([]);
    }
}

function renderCommands(cmds, filter = 'all', query = '') {
    const grid = document.getElementById('cmdGrid');
    if (!grid) return;

    let filtered = cmds;
    if (filter !== 'all') filtered = filtered.filter(c => c.tier === filter || c.tier?.startsWith(filter));
    if (query) filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(query.toLowerCase()) ||
        c.description?.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text3);text-align:center;padding:40px 0;">No commands found</div>`;
        return;
    }

    grid.innerHTML = filtered.slice(0, 80).map(cmd => {
        const tier = cmd.tier || 'v1';
        const tierClass = `tier-${tier}`;
        const tierLabel = tier?.startsWith('v3') || tier?.startsWith('v4') || tier?.startsWith('v5') ? 'PREMIUM'
            : tier?.startsWith('v6') || tier?.startsWith('v7') || tier?.startsWith('v8') ? 'ENTERPRISE' : 'FREE';
        return `
      <div class="cmd-item" onclick="showCmdDetail('${cmd.name}', '${(cmd.description || '').replace(/'/g, "\\'")}', '${tier}')">
        <div class="cmd-name">/${cmd.name || 'unknown'}</div>
        <div class="cmd-desc">${cmd.description || 'No description available'}</div>
        <div class="cmd-tier ${tierClass}">${tier?.toUpperCase()} • ${tierLabel}</div>
      </div>
    `;
    }).join('');
}

function showCmdDetail(name, desc, tier) {
    const tierLabel = tier?.startsWith('v3') || tier?.startsWith('v4') || tier?.startsWith('v5') ? 'Premium' :
        tier?.startsWith('v6') || tier?.startsWith('v7') || tier?.startsWith('v8') ? 'Enterprise' : 'Free';
    document.getElementById('modalTitle').textContent = `/${name}`;
    document.getElementById('modalBody').innerHTML = `
    <p>${desc}</p>
    <p style="margin-top:12px"><strong>Tier:</strong> <span style="color:var(--accent)">${tier?.toUpperCase()} — ${tierLabel}</span></p>
    <p style="margin-top:6px;color:var(--text3);font-size:.82rem">Use this slash command in any Discord server with uwu-chan installed.</p>
  `;
    document.getElementById('cmdModal').classList.add('active');
}

// ── FILTERS ──
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const f = btn.dataset.filter;
            const q = document.getElementById('cmdSearch')?.value || '';
            renderCommands(COMMANDS, f, q);
        });
    });
}

function setupSearch() {
    const input = document.getElementById('cmdSearch');
    if (!input) return;
    input.addEventListener('input', () => {
        const active = document.querySelector('.filter-btn.active');
        const f = active?.dataset.filter || 'all';
        renderCommands(COMMANDS, f, input.value);
    });
}

// ── NAV / SMOOTH SCROLL ──
function setupNav() {
    document.querySelectorAll('[data-scroll]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const target = document.getElementById(el.dataset.scroll);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

// ── STATS ANIMATION ──
function animateStats() {
    const targets = { servers: 2400, staff: 18000, tickets: 95000, commands: 271 };
    Object.entries(targets).forEach(([key, target]) => {
        const el = document.getElementById('stat-' + key);
        if (!el) return;
        let cur = 0;
        const step = target / 60;
        const interval = setInterval(() => {
            cur = Math.min(cur + step, target);
            el.textContent = Math.floor(cur).toLocaleString() + (key === 'commands' ? '' : '+');
            if (cur >= target) clearInterval(interval);
        }, 20);
    });
}

// ── DISCORD OAUTH ──
function loginWithDiscord() {
    // In production, use real Discord OAuth. For demo, use mock login.
    document.getElementById('loginModal').classList.add('active');
}

function doDiscordLogin() {
    // Mock login for demo — in production redirect to DISCORD_OAUTH_URL
    currentUser = { ...DEMO_USER };
    document.getElementById('loginModal').classList.remove('active');
    showDashboard();
    showToast('✅ Logged in as ' + currentUser.username);
}

function checkOAuthCallback() {
    // Check URL hash for OAuth token (real implementation)
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) fetchDiscordUser(token);
    }
}

async function fetchDiscordUser(token) {
    try {
        const res = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const user = await res.json();
        currentUser = { ...DEMO_USER, username: user.username, id: user.id, avatar: user.avatar };
        window.history.pushState({}, document.title, window.location.pathname);
        showDashboard();
        showToast('✅ Welcome back, ' + user.username + '!');
    } catch { }
}

function logout() {
    currentUser = null;
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('landingPage').style.display = '';
    showToast('👋 Logged out');
}

// ── DASHBOARD ──
function showDashboard() {
    document.getElementById('landingPage').style.display = 'none';
    const dash = document.getElementById('dashboard');
    dash.classList.add('active');
    renderDashboard();
}

function renderDashboard() {
    if (!currentUser) return;
    const u = currentUser;
    document.getElementById('dashGreet').textContent = `Welcome back, ${u.username}! 👋`;
    document.getElementById('dashPts').textContent = u.points.toLocaleString();
    document.getElementById('dashShifts').textContent = u.shifts;
    document.getElementById('dashConsistency').textContent = u.consistency + '%';
    document.getElementById('dashRank').textContent = u.rank.toUpperCase();
    document.getElementById('dashStreak').textContent = u.streak + ' days';
    document.getElementById('dashWarns').textContent = u.warnings;

    // Progress bars
    setBar('barPts', (u.points / 1000) * 100);
    setBar('barConsist', u.consistency);
    setBar('barShifts', (u.shifts / 30) * 100);

    // Staff table
    renderStaffTable();
    // Promo track
    renderPromoTrack();
    // Achievements
    renderAchievements();
    // Nav User
    document.getElementById('navUserName').textContent = u.username;
    document.getElementById('navUser').style.display = 'flex';
    document.getElementById('navLoginBtn').style.display = 'none';
}

function setBar(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.min(100, Math.max(0, pct)) + '%';
}

function renderStaffTable() {
    const tbody = document.getElementById('staffTbody');
    if (!tbody) return;
    tbody.innerHTML = DEMO_STAFF.map(s => `
    <tr>
      <td>${s.status} ${s.username}</td>
      <td><span class="staff-rank ${s.rank}">${s.rank.toUpperCase()}</span></td>
      <td>${s.points.toLocaleString()}</td>
      <td>${s.shifts}</td>
      <td>${s.consistency}%</td>
      <td><div class="prog-bar-wrap" style="width:80px"><div class="prog-bar-fill" style="width:${s.consistency}%"></div></div></td>
    </tr>
  `).join('');
}

function renderPromoTrack() {
    const container = document.getElementById('promoTrack');
    if (!container || !currentUser) return;
    const u = currentUser;
    const rankOrder = ['member', 'trial', 'staff', 'senior', 'manager', 'admin'];
    const currentIdx = rankOrder.indexOf(u.rank);

    container.innerHTML = PROMO_REQS.map((r, i) => {
        const rankIdx = rankOrder.indexOf(r.rank);
        const isDone = rankIdx < currentIdx;
        const isCurrent = r.rank === u.rank;
        const isNext = rankIdx === currentIdx + 1;

        const pct = r.pts > 0 ? Math.min(100, Math.round((u.points / r.pts) * 100)) : 100;
        const statusClass = isDone ? 'ps-done' : isCurrent ? 'ps-current' : 'ps-locked';
        const statusText = isDone ? '✅ Achieved' : isCurrent ? '▶ Current Rank' : isNext ? `${pct}% there` : '🔒 Locked';

        return `
      <div class="promo-step">
        <div class="ps-rank">${r.emoji}</div>
        <div class="ps-info">
          <div class="ps-name">${r.rank.toUpperCase()}</div>
          <div class="ps-req">${r.pts} pts · ${r.shifts} shifts · ${r.consistency}% consistency</div>
          ${isNext ? `<div class="prog-bar-wrap" style="margin-top:6px"><div class="prog-bar-fill" style="width:${pct}%"></div></div>` : ''}
        </div>
        <div class="ps-status ${statusClass}">${statusText}</div>
      </div>
    `;
    }).join('');
}

function renderAchievements() {
    const container = document.getElementById('achieveList');
    if (!container || !currentUser) return;
    const items = currentUser.achievements || [];
    container.innerHTML = items.length > 0
        ? items.map(a => `<div class="card" style="padding:12px 16px;display:flex;gap:10px;align-items:center"><span>🏅</span><span style="font-size:.87rem;font-weight:600">${a}</span></div>`).join('')
        : `<div style="color:var(--text3);font-size:.87rem">No achievements yet — start your first shift!</div>`;
}

// ── SIDEBAR NAV ──
function setupSidebar() {
    document.querySelectorAll('[data-panel]').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('[data-panel]').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            showPanel(item.dataset.panel);
        });
    });
}

function showPanel(panel) {
    document.querySelectorAll('.dash-panel').forEach(p => p.style.display = 'none');
    const target = document.getElementById('panel-' + panel);
    if (target) target.style.display = '';
}

// ── MODAL ──
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ── TOAST ──
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── SLIDER ──
function updateSlider(val) {
    const rec = document.getElementById('sliderRec');
    if (!rec) return;
    const tier = val < 30 ? 'Free' : val < 80 ? 'Premium' : 'Enterprise';
    const tierColor = val < 30 ? 'var(--accent)' : val < 80 ? 'var(--premium)' : 'var(--enterprise)';
    rec.textContent = `Recommendation: ${tier}`;
    rec.style.color = tierColor;
}
