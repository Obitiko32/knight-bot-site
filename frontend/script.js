// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

let currentUser = null;
let currentTheme = localStorage.getItem('knight-theme') || 'light';

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
            
            const ctaBtn = document.getElementById('ctaInviteBtn');
            if (ctaBtn) {
                ctaBtn.textContent = '📊 Мои сервера';
                ctaBtn.href = '/servers';
                ctaBtn.className = 'btn-primary btn-large';
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
            
            const ctaBtn = document.getElementById('ctaInviteBtn');
            if (ctaBtn) {
                ctaBtn.textContent = '➕ Добавить бота';
                ctaBtn.href = '#';
                ctaBtn.className = 'btn-primary btn-large';
                ctaBtn.onclick = async (e) => {
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
// СТАТИСТИКА
// ============================================

async function loadStats() {
    try {
        const botInfoResponse = await fetch('/api/bot-info');
        if (botInfoResponse.ok) {
            const botInfo = await botInfoResponse.json();
            const guildsEl = document.getElementById('statGuilds');
            if (guildsEl) guildsEl.textContent = botInfo.guilds || 0;
        }
        
        const guildsResponse = await fetch('/api/guilds');
        if (guildsResponse.ok) {
            const guilds = await guildsResponse.json();
            let totalUsers = 0;
            let totalCommands = 0;
            
            for (const guild of guilds) {
                try {
                    const membersRes = await fetch(`/api/guilds/${guild.id}/members`);
                    if (membersRes.ok) {
                        const members = await membersRes.json();
                        totalUsers += members.length;
                    }
                } catch (e) {}
                
                try {
                    const leaderboardRes = await fetch(`/api/guilds/${guild.id}/leaderboard`);
                    if (leaderboardRes.ok) {
                        const leaderboard = await leaderboardRes.json();
                        const guildCommands = leaderboard.reduce((sum, user) => sum + (user.messages || 0), 0);
                        totalCommands += guildCommands;
                    }
                } catch (e) {}
            }
            
            const usersEl = document.getElementById('statUsers');
            if (usersEl) usersEl.textContent = totalUsers || '0';
            
            const commandsEl = document.getElementById('statCommands');
            if (commandsEl) {
                commandsEl.textContent = formatNumber(totalCommands) || '0';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
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
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-shield-halved"></i>
                    <h3>Нет серверов с правами</h3>
                    <p>У вас нет прав администратора ни на одном сервере</p>
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
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                <h3>Ошибка загрузки</h3>
                <p>${error.message}</p>
                <button class="btn-primary" style="margin-top: 16px;" onclick="location.reload()">
                    <i class="fas fa-sync"></i> Попробовать снова
                </button>
            </div>
        `;
    }
}

async function inviteToServer(guildId) {
    try {
        const data = await apiFetch('/api/invite-url');
        window.open(data.url, '_blank');
    } catch (error) {
        showToast('Ошибка получения ссылки', 'error');
    }
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
    }
});