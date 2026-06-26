// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

let currentUser = null;
let currentTheme = localStorage.getItem('knight-theme') || 'light';
let currentGuildId = null;

// ============================================
// ТЕМА
// ============================================

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('knight-theme', theme);
    currentTheme = theme;
    
    const badge = document.getElementById('themeBadge');
    if (badge) {
        badge.textContent = theme === 'dark' ? 'Тёмная' : 'Светлая';
    }
    
    const icon = document.querySelector('#dropdownTheme i');
    if (icon) {
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    showToast(newTheme === 'dark' ? '🌙 Тёмная тема' : '☀️ Светлая тема', 'info');
}

// ============================================
// TOAST
// ============================================

function showToast(message, type = 'info', duration = 3000) {
    const container = document.querySelector('.toast-container') || (() => {
        const div = document.createElement('div');
        div.className = 'toast-container';
        document.body.appendChild(div);
        return div;
    })();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// API
// ============================================

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Ошибка ${response.status}`);
    }
    return response.json();
}

// ===== ПОЛУЧЕНИЕ ИНФОРМАЦИИ О СЕРВЕРЕ =====
app.get('/api/guilds/:guildId', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        
        if (!BOT_TOKEN) {
            return res.json({ 
                guild: { id: guildId, name: 'Тестовый сервер' },
                members: [],
                roles: []
            });
        }
        
        const [guildResponse, membersResponse, rolesResponse] = await Promise.all([
            axios.get(`https://discord.com/api/v10/guilds/${guildId}`, {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            }),
            axios.get(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            }),
            axios.get(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            })
        ]);
        
        const members = membersResponse.data
            .filter(m => !m.user.bot)
            .map(m => ({
                id: m.user.id,
                username: m.user.username,
                display_name: m.nick || m.user.username,
                avatar: m.user.avatar 
                    ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png` 
                    : null
            }));
        
        const roles = rolesResponse.data
            .filter(r => r.name !== '@everyone')
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.color
            }));
        
        res.json({
            guild: guildResponse.data,
            members: members,
            roles: roles
        });
    } catch (error) {
        console.error('Ошибка получения информации о сервере:', error.message);
        res.json({ 
            guild: { id: req.params.guildId, name: 'Сервер' },
            members: [],
            roles: []
        });
    }
});

// ============================================
// ПРОФИЛЬ
// ============================================

async function loadProfile() {
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownId = document.getElementById('dropdownUserId');
    
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.ok) {
            currentUser = await response.json();
            
            if (avatar) {
                avatar.src = currentUser.avatar 
                    ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png` 
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';
                avatar.classList.add('show');
            }
            if (name) {
                name.textContent = currentUser.username;
                name.style.display = 'inline';
            }
            if (dropdownName) dropdownName.textContent = currentUser.username;
            if (dropdownId) dropdownId.textContent = `ID: ${currentUser.id}`;
            
            const heroBtn = document.getElementById('heroInviteBtn');
            if (heroBtn) {
                heroBtn.textContent = '📊 Мои сервера';
                heroBtn.href = '/servers';
                heroBtn.className = 'btn-primary btn-large';
            }
            
            return true;
        } else {
            if (avatar) avatar.classList.remove('show');
            if (name) {
                name.textContent = 'Войти';
                name.style.display = 'inline';
            }
            if (dropdownName) dropdownName.textContent = 'Гость';
            if (dropdownId) dropdownId.textContent = 'Не авторизован';
            
            const heroBtn = document.getElementById('heroInviteBtn');
            if (heroBtn) {
                heroBtn.textContent = '➕ Добавить бота';
                heroBtn.href = '#';
                heroBtn.className = 'btn-primary btn-large';
                heroBtn.onclick = async (e) => {
                    e.preventDefault();
                    try {
                        const data = await apiFetch('/api/invite-url');
                        window.open(data.url, '_blank');
                    } catch (error) {
                        showToast('Ошибка получения ссылки', 'error');
                    }
                };
            }
            
            return false;
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        return false;
    }
}

// ============================================
// КНОПКА ВХОДА
// ============================================

function setupLoginButton() {
    const profileBtn = document.getElementById('profileBtn');
    if (!profileBtn) return;
    
    const newBtn = profileBtn.cloneNode(true);
    profileBtn.parentNode.replaceChild(newBtn, profileBtn);
    
    newBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        try {
            const response = await fetch('/api/me', { credentials: 'include' });
            if (response.ok) {
                const dropdown = document.getElementById('profileDropdown');
                if (dropdown) {
                    dropdown.classList.toggle('open');
                    newBtn.classList.toggle('active');
                }
            } else {
                const width = 500;
                const height = 650;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                
                const popup = window.open(
                    '/auth/discord',
                    'Discord Login',
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                );
                
                const handleMessage = (event) => {
                    if (event.data && event.data.type === 'auth-success') {
                        window.location.reload();
                        window.removeEventListener('message', handleMessage);
                    }
                };
                window.addEventListener('message', handleMessage);
                
                const checkPopup = setInterval(async () => {
                    if (popup.closed) {
                        clearInterval(checkPopup);
                        const authCheck = await fetch('/api/me', { credentials: 'include' });
                        if (authCheck.ok) {
                            window.location.reload();
                        }
                        window.removeEventListener('message', handleMessage);
                    }
                }, 500);
            }
        } catch (error) {
            window.open('/auth/discord', '_blank');
        }
    });
}

function setupLogout() {
    const logoutBtn = document.getElementById('dropdownLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.location.href = '/auth/logout';
        });
    }
}

// ============================================
// СТАТИСТИКА (ИСПРАВЛЕНА)
// ============================================

async function loadStats() {
    try {
        // Получаем информацию о боте
        const botInfoResponse = await fetch('/api/bot-info');
        if (botInfoResponse.ok) {
            const botInfo = await botInfoResponse.json();
            const guildsEl = document.getElementById('statGuilds');
            if (guildsEl) guildsEl.textContent = botInfo.guilds || 0;
        }
        
        // Получаем список серверов бота
        const guildsResponse = await fetch('/api/guilds');
        if (guildsResponse.ok) {
            const guilds = await guildsResponse.json();
            let totalUsers = 0;
            
            for (const guild of guilds) {
                try {
                    const membersRes = await fetch(`/api/guilds/${guild.id}/members`);
                    if (membersRes.ok) {
                        const members = await membersRes.json();
                        totalUsers += members.length;
                    }
                } catch (e) {}
            }
            
            const usersEl = document.getElementById('statUsers');
            if (usersEl) usersEl.textContent = totalUsers || '0';
        }
        
        // Команды - показываем количество доступных команд
        const commandsEl = document.getElementById('statCommands');
        if (commandsEl) {
            // Считаем команды из списка
            const allCommands = [
                'stats', 'leaderboard', 'help', 'mute', 'unmute', 
                'clear', 'setstats', 'resetstats', 'syncroles'
            ];
            commandsEl.textContent = allCommands.length;
        }
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// ============================================
// СТРАНИЦА СЕРВЕРОВ
// ============================================

async function loadServers() {
    const container = document.getElementById('serversContainer');
    if (!container) return;
    
    console.log('🔄 Загрузка серверов...');
    
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
            <div class="loading-spinner" style="margin: 0 auto 16px;"></div>
            <p style="color: var(--text-secondary);">Загрузка серверов...</p>
        </div>
    `;
    
    try {
        // Проверка авторизации
        const meResponse = await fetch('/api/me', { credentials: 'include' });
        if (!meResponse.ok) {
            window.location.href = '/';
            return;
        }
        
        // Получаем сервера пользователя
        const userGuildsResponse = await fetch('/api/user-guilds', { credentials: 'include' });
        let userGuilds = [];
        if (userGuildsResponse.ok) {
            userGuilds = await userGuildsResponse.json();
        }
        console.log('✅ Серверов пользователя:', userGuilds.length);
        
        // Получаем сервера бота
        let botGuildIds = new Set();
        try {
            const botGuildsResponse = await fetch('/api/bot-guilds', { credentials: 'include' });
            if (botGuildsResponse.ok) {
                const botGuilds = await botGuildsResponse.json();
                botGuildIds = new Set(botGuilds.map(g => g.id));
                console.log('✅ Бот на серверах:', botGuildIds.size);
            }
        } catch (e) {
            console.warn('⚠️ Не удалось получить сервера бота');
        }
        
        // Фильтруем сервера с правами
        const adminGuilds = userGuilds.filter(g => (g.permissions & 0x8) === 0x8);
        console.log('✅ Серверов с правами:', adminGuilds.length);
        
        if (adminGuilds.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                    <i class="fas fa-shield-halved" style="font-size: 48px; color: var(--text-muted); display: block; margin-bottom: 16px;"></i>
                    <h3 style="font-size: 20px; margin-bottom: 8px;">Нет серверов с правами</h3>
                    <p style="color: var(--text-secondary);">У вас нет прав администратора ни на одном сервере</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = adminGuilds.map(guild => {
            const hasBot = botGuildIds.has(guild.id);
            const memberCount = guild.approximate_member_count || 0;
            
            return `
                <div class="server-card">
                    <div class="server-icon">
                        ${guild.icon 
                            ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png" alt="${guild.name}">` 
                            : guild.name.charAt(0).toUpperCase()
                        }
                    </div>
                    <div class="server-info">
                        <div class="server-name">${guild.name}</div>
                        <div class="server-members">👥 ${memberCount} участников</div>
                    </div>
                    <div class="server-actions">
                        ${hasBot 
                            ? `<button class="btn-primary btn-sm" onclick="window.location.href='/guild-settings?guild=${guild.id}'">
                                <i class="fas fa-cog"></i> Управлять
                            </button>`
                            : `<button class="btn-secondary btn-sm" onclick="inviteToServer('${guild.id}')">
                                <i class="fas fa-user-plus"></i> Пригласить
                            </button>`
                        }
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки серверов:', error);
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--danger); display: block; margin-bottom: 16px;"></i>
                <h3 style="font-size: 20px; margin-bottom: 8px;">Ошибка загрузки</h3>
                <p style="color: var(--text-secondary);">${error.message}</p>
                <button class="btn-primary" style="margin-top: 16px;" onclick="location.reload()">
                    <i class="fas fa-sync"></i> Попробовать снова
                </button>
            </div>
        `;
    }
}

// ============================================
// ПРИГЛАШЕНИЕ БОТА НА КОНКРЕТНЫЙ СЕРВЕР
// ============================================

async function inviteToServer(guildId) {
    try {
        const clientId = await getClientId();
        // Создаём ссылку с guild_id для конкретного сервера
        const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${guildId}`;
        window.open(url, '_blank');
    } catch (error) {
        showToast('Ошибка получения ссылки', 'error');
    }
}

async function getClientId() {
    try {
        const response = await fetch('/api/invite-url');
        const data = await response.json();
        // Извлекаем client_id из URL
        const match = data.url.match(/client_id=(\d+)/);
        return match ? match[1] : null;
    } catch (error) {
        return null;
    }
}

// ============================================
// СТРАНИЦА УПРАВЛЕНИЯ СЕРВЕРОМ
// ============================================

async function loadGuildSettings() {
    const params = new URLSearchParams(window.location.search);
    const guildId = params.get('guild');
    
    if (!guildId) {
        window.location.href = '/servers';
        return;
    }
    
    currentGuildId = guildId;
    
    try {
        // Загружаем информацию о сервере
        const response = await fetch(`/api/guilds/${guildId}`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error('Не удалось загрузить сервер');
        }
        
        const data = await response.json();
        
        // Обновляем заголовок
        document.getElementById('guildName').textContent = data.guild.name || 'Название сервера';
        document.getElementById('guildId').textContent = `ID: ${data.guild.id || guildId}`;
        
        // Загружаем участников
        loadMembers(guildId);
        
        // Загружаем роли
        loadRoles(guildId);
        
        // Загружаем лидерборд
        loadGuildLeaderboard(guildId);
        
    } catch (error) {
        console.error('Ошибка загрузки сервера:', error);
        showToast('Ошибка загрузки сервера', 'error');
    }
}

async function loadMembers(guildId) {
    const container = document.getElementById('membersList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner" style="margin: 20px auto; display: block;"></div>';
    
    try {
        const response = await fetch(`/api/guilds/${guildId}/members`, { credentials: 'include' });
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const members = await response.json();
        
        if (members.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Нет участников</p>';
            return;
        }
        
        container.innerHTML = members.slice(0, 50).map(m => `
            <div class="user-item">
                <div class="user-info">
                    <img class="avatar-sm" src="${m.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="${m.display_name}">
                    <span class="username">${m.display_name || m.username}</span>
                </div>
                <div class="user-actions">
                    <button class="btn-danger btn-sm" onclick="muteUser('${guildId}', '${m.id}')">
                        <i class="fas fa-microphone-slash"></i>
                    </button>
                    <button class="btn-success btn-sm" onclick="unmuteUser('${guildId}', '${m.id}')">
                        <i class="fas fa-microphone"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки участников:', error);
        container.innerHTML = '<p style="color: var(--danger);">Ошибка загрузки участников</p>';
    }
}

async function loadRoles(guildId) {
    const container = document.getElementById('rolesList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner" style="margin: 20px auto; display: block;"></div>';
    
    try {
        const response = await fetch(`/api/guilds/${guildId}/roles`, { credentials: 'include' });
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const roles = await response.json();
        
        if (roles.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Нет ролей</p>';
            return;
        }
        
        container.innerHTML = roles.map(r => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <span style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #${r.color.toString(16).padStart(6, '0')};"></span>
                    ${r.name}
                </span>
                <span style="color: var(--text-muted); font-size: 12px;">${r.id}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки ролей:', error);
        container.innerHTML = '<p style="color: var(--danger);">Ошибка загрузки ролей</p>';
    }
}

async function loadGuildLeaderboard(guildId) {
    const container = document.getElementById('leaderboardList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner" style="margin: 20px auto; display: block;"></div>';
    
    try {
        const response = await fetch(`/api/guilds/${guildId}/leaderboard`, { credentials: 'include' });
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const data = await response.json();
        
        if (data.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">Нет данных</p>';
            return;
        }
        
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border);">
                        <th style="text-align: left; padding: 8px 12px;">#</th>
                        <th style="text-align: left; padding: 8px 12px;">Пользователь</th>
                        <th style="text-align: right; padding: 8px 12px;">Сообщений</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map((user, index) => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 8px 12px; font-weight: 600; color: ${index === 0 ? 'var(--gold)' : 'var(--text-secondary)'};">${index + 1}</td>
                            <td style="padding: 8px 12px; display: flex; align-items: center; gap: 8px;">
                                <img src="${user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" style="width: 24px; height: 24px; border-radius: 50%;">
                                ${user.display_name || user.username}
                            </td>
                            <td style="padding: 8px 12px; text-align: right; font-weight: 600; color: var(--gold);">${user.messages}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки лидерборда:', error);
        container.innerHTML = '<p style="color: var(--danger);">Ошибка загрузки рейтинга</p>';
    }
}

// ============================================
// МУТ / РАЗМУТ
// ============================================

async function muteUser(guildId, userId) {
    try {
        await apiFetch(`/api/guilds/${guildId}/mute`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, duration: 60, reason: 'Мут через сайт' })
        });
        showToast('✅ Пользователь заглушен на 60 секунд', 'success');
        loadMembers(guildId);
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
}

async function unmuteUser(guildId, userId) {
    try {
        await apiFetch(`/api/guilds/${guildId}/unmute`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId })
        });
        showToast('✅ Пользователь размучен', 'success');
        loadMembers(guildId);
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
}

// ============================================
// ВКЛАДКИ В УПРАВЛЕНИИ СЕРВЕРОМ
// ============================================

function setupGuildTabs() {
    const tabs = document.querySelectorAll('.guild-tab');
    if (!tabs.length) return;
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Убираем активные классы
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.guild-tab-content').forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            const content = document.getElementById(`tab-${tabId}`);
            if (content) content.classList.add('active');
        });
    });
}

// ============================================
// СТРАНИЦА КОМАНД
// ============================================

function loadCommands() {
    const container = document.getElementById('commandsContainer');
    if (!container) return;
    
    const commands = {
        '👑 Основные': [
            { name: '!stats', desc: 'Показать вашу статистику', admin: false },
            { name: '!leaderboard', desc: 'Топ пользователей', admin: false },
            { name: '!help', desc: 'Список команд', admin: false },
        ],
        '🛡️ Модерация': [
            { name: '!mute @user [сек]', desc: 'Заглушить пользователя', admin: true },
            { name: '!unmute @user', desc: 'Снять мут', admin: true },
            { name: '!clear [количество]', desc: 'Очистить чат', admin: true },
        ],
        '⚙️ Администрирование': [
            { name: '!setstats @user', desc: 'Установить счётчик', admin: true },
            { name: '!resetstats @user', desc: 'Сбросить счётчик', admin: true },
            { name: '!syncroles', desc: 'Синхронизировать роли', admin: true },
        ]
    };
    
    container.innerHTML = Object.entries(commands).map(([category, cmds]) => `
        <div class="commands-category">
            <div class="category-title">${category}</div>
            <div class="commands-grid">
                ${cmds.map(cmd => `
                    <div class="command-card">
                        <span class="cmd-name">${cmd.name}</span>
                        <span class="cmd-desc">${cmd.desc}</span>
                        ${cmd.admin 
                            ? '<span class="cmd-badge admin"><i class="fas fa-shield-halved"></i> Админ</span>' 
                            : '<span class="cmd-badge">Все</span>'
                        }
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ============================================
// ЗАПУСК
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    applyTheme(currentTheme);
    
    // Кнопка темы
    const themeBtn = document.getElementById('dropdownTheme');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
    
    // Выход
    setupLogout();
    
    // Вход
    setupLoginButton();
    
    // Меню профиля
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown) {
        dropdown.addEventListener('click', (e) => e.stopPropagation());
    }
    
    document.addEventListener('click', () => {
        if (dropdown) {
            dropdown.classList.remove('open');
            const btn = document.getElementById('profileBtn');
            if (btn) btn.classList.remove('active');
        }
    });
    
    // Кнопки в меню
    const serversBtn = document.getElementById('dropdownServers');
    if (serversBtn) {
        serversBtn.addEventListener('click', () => {
            window.location.href = '/servers';
        });
    }
    
    const commandsBtn = document.getElementById('dropdownCommands');
    if (commandsBtn) {
        commandsBtn.addEventListener('click', () => {
            window.location.href = '/commands';
        });
    }
    
    const leaderboardBtn = document.getElementById('dropdownLeaderboard');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', () => {
            window.location.href = '/leaderboard';
        });
    }
    
    // Загружаем профиль и статистику
    await loadProfile();
    loadStats();
    
    // Запуск страниц
    const path = window.location.pathname;
    if (path === '/servers' || path === '/servers.html') {
        loadServers();
    } else if (path === '/commands' || path === '/commands.html') {
        loadCommands();
    } else if (path === '/guild-settings' || path === '/guild-settings.html') {
        setupGuildTabs();
        loadGuildSettings();
    }
});