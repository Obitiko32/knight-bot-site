// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

let currentUser = null;
let currentTheme = localStorage.getItem('knight-theme') || 'light';
let totalCommandsExecuted = 0;

// ============================================
// ВЫБОР СЕРВЕРА (ОТКРЫТИЕ НАСТРОЕК)
// ============================================

function selectServer(guildId) {
    window.location.href = `/guild-settings?guild=${guildId}`;
}

function manageServer(guildId) {
    window.location.href = `/guild-settings?guild=${guildId}`;
}

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
// ТОСТ УВЕДОМЛЕНИЯ
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
            
            // Меняем кнопку "Добавить бота" в центре на "Мои сервера"
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
            // НЕ АВТОРИЗОВАН
            if (avatar) avatar.classList.remove('show');
            if (name) {
                name.textContent = 'Войти';
                name.style.display = 'inline';
            }
            if (dropdownName) dropdownName.textContent = 'Гость';
            if (dropdownId) dropdownId.textContent = 'Не авторизован';
            
            // Кнопка "Добавить бота" в центре
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
                // Открываем popup
                const width = 500;
                const height = 650;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                
                const popup = window.open(
                    '/auth/discord',
                    'Discord Login',
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
                );
                
                // Слушаем сообщение от popup
                const handleMessage = (event) => {
                    if (event.data && event.data.type === 'auth-success') {
                        window.location.reload();
                        window.removeEventListener('message', handleMessage);
                    }
                };
                window.addEventListener('message', handleMessage);
                
                // Проверяем закрытие окна (если пользователь закрыл вручную)
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
    
    window.profileBtnRef = newBtn;
}

// ============================================
// НАСТРОЙКА ВЫХОДА
// ============================================

function setupLogout() {
    const logoutBtn = document.getElementById('dropdownLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.location.href = '/auth/logout';
        });
    }
}

// ============================================
// ЗАПУСК ПРИ ЗАГРУЗКЕ
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Применяем тему
    applyTheme(currentTheme);
    
    // Настраиваем кнопку переключения темы
    const themeBtn = document.getElementById('dropdownTheme');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
    
    // Настраиваем выход
    setupLogout();
    
    // Настраиваем кнопку входа (исправлено)
    setupLoginButton();
    
    // Настраиваем меню (закрытие при клике вне)
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
    
    // Загружаем профиль
    await loadProfile();
    
    // Загружаем статистику
    loadStats();
});

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
            let totalCommands = 0;
            
            for (const guild of guilds) {
                try {
                    // Реальные участники через API
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

// ============================================
// ФОРМАТИРОВАНИЕ ЧИСЕЛ
// ============================================

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
// СТРАНИЦА СЕРВЕРОВ (ИСПРАВЛЕНА)
// ============================================

async function loadServers() {
    const container = document.getElementById('serversContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-container" style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; gap: 16px;">
            <div class="loading-spinner"></div>
            <p style="color: var(--text-secondary);">Загрузка серверов...</p>
        </div>
    `;
    
    try {
        // Проверяем авторизацию
        let user = null;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts && !user) {
            try {
                const response = await fetch('/api/me', { credentials: 'include' });
                if (response.ok) {
                    user = await response.json();
                    break;
                }
            } catch (e) {}
            attempts++;
            if (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        if (!user) {
            window.location.href = '/';
            return;
        }
        
        // Получаем ВСЕ сервера пользователя (из Discord) с правами
        const userGuildsResponse = await fetch('/api/user-guilds', { credentials: 'include' });
        const userGuilds = await userGuildsResponse.json();
        
        // Получаем сервера, где есть бот
        const botGuildsResponse = await fetch('/api/bot-guilds', { credentials: 'include' });
        let botGuilds = [];
        let botGuildIds = new Set();
        
        if (botGuildsResponse.ok) {
            botGuilds = await botGuildsResponse.json();
            botGuildIds = new Set(botGuilds.map(g => g.id));
            console.log('🔍 Бот на серверах:', botGuildIds);
        }
        
        // Фильтруем сервера: только где есть права администратора (0x8)
        const adminGuilds = userGuilds.filter(g => (g.permissions & 0x8) === 0x8);
        
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
        
        // Отображаем сервера
        container.innerHTML = adminGuilds.map(guild => {
            // Проверяем, есть ли бот на этом сервере
            const hasBot = botGuildIds.has(guild.id);
            const memberCount = guild.approximate_member_count || 0;
            
            // Для отладки
            console.log(`🟢 ${guild.name}: hasBot = ${hasBot}, ID = ${guild.id}`);
            
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
        console.error('Ошибка загрузки серверов:', error);
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

// ============================================
// СЕРВЕРА, ГДЕ ЕСТЬ БОТ
// ============================================

app.get('/api/bot-guilds', isAuthenticated, async (req, res) => {
    try {
        if (!BOT_TOKEN) {
            console.log('⚠️ BOT_TOKEN не найден');
            return res.json([]);
        }
        
        console.log('🔍 Запрос к Discord API для получения серверов бота...');
        
        const response = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: {
                'Authorization': `Bot ${BOT_TOKEN}`
            }
        });
        
        console.log(`✅ Бот на ${response.data.length} серверах`);
        res.json(response.data);
    } catch (error) {
        console.error('❌ Ошибка получения серверов бота:', error.message);
        res.json([]);
    }
});

async function inviteToServer(guildId) {
    try {
        const data = await apiFetch('/api/invite-url');
        window.open(data.url, '_blank');
    } catch (error) {
        showToast('Ошибка получения ссылки', 'error');
    }
}

async function inviteToServer(guildId) {
    try {
        // Получаем ссылку для приглашения с правами
        const data = await apiFetch('/api/invite-url');
        // Открываем в новой вкладке
        window.open(data.url, '_blank');
    } catch (error) {
        showToast('Ошибка получения ссылки', 'error');
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
            { name: '!stats', desc: 'Показать вашу статистику (сообщения, роль, прогресс)', admin: false },
            { name: '!leaderboard / !топ', desc: 'Топ пользователей по сообщениям', admin: false },
            { name: '!help', desc: 'Показать список всех команд', admin: false },
        ],
        '🛡️ Модерация': [
            { name: '!mute @user [сек] [причина]', desc: 'Заглушить пользователя', admin: true },
            { name: '!unmute @user', desc: 'Снять мут с пользователя', admin: true },
            { name: '!clear [количество]', desc: 'Очистить чат (до 100 сообщений)', admin: true },
            { name: '!roles / !роли', desc: 'Показать все роли на сервере', admin: true },
        ],
        '⚙️ Администрирование': [
            { name: '!setstats @user [число]', desc: 'Установить счётчик сообщений пользователю', admin: true },
            { name: '!addstats @user [число]', desc: 'Добавить или отнять сообщения', admin: true },
            { name: '!resetstats @user', desc: 'Сбросить счётчик пользователя', admin: true },
            { name: '!syncroles', desc: 'Синхронизировать роли всех участников', admin: true },
            { name: '!antispam [лимит] [сек]', desc: 'Настроить антиспам', admin: true },
            { name: '!mute_duration [сек]', desc: 'Установить длительность мута', admin: true },
        ],
        '🎯 Дополнительные': [
            { name: '!stats @user', desc: 'Показать статистику другого пользователя', admin: false },
        ]
    };
    
    container.innerHTML = Object.entries(commands).map(([category, cmds]) => `
        <div class="commands-category">
            <div class="category-title">
                ${category}
                ${category.includes('Модерация') || category.includes('Администрирование') 
                    ? '<span class="shield" title="Требуются права администратора"><i class="fas fa-shield-halved"></i></span>' 
                    : ''}
            </div>
            <div class="commands-grid">
                ${cmds.map(cmd => `
                    <div class="command-card">
                        <span class="cmd-name">${cmd.name}</span>
                        <span class="cmd-desc">${cmd.desc}</span>
                        ${cmd.admin 
                            ? '<span class="cmd-badge admin" title="Требуются права администратора"><i class="fas fa-shield-halved"></i> Админ</span>' 
                            : '<span class="cmd-badge">Все</span>'
                        }
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ============================================
// СТРАНИЦА ЛИДЕРБОРДА
// ============================================

async function loadLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    const select = document.getElementById('guildSelect');
    const btn = document.getElementById('loadLeaderboardBtn');
    
    if (!container || !select) return;
    
    try {
        const guilds = await apiFetch('/api/my-guilds');
        const guildList = guilds.guilds || [];
        
        select.innerHTML = '<option value="">Выберите сервер</option>' + 
            guildList.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        
        btn.addEventListener('click', async () => {
            const guildId = select.value;
            if (!guildId) {
                showToast('Выберите сервер', 'error');
                return;
            }
            
            container.innerHTML = '<div class="loading-spinner" style="margin: 40px auto; display: block;"></div>';
            
            try {
                const data = await apiFetch(`/api/guilds/${guildId}/leaderboard`);
                
                if (data.length === 0) {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-trophy"></i>
                            <h3>Нет данных</h3>
                            <p>Пока нет сообщений для отображения</p>
                        </div>
                    `;
                    return;
                }
                
                container.innerHTML = `
                    <table class="leaderboard-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Пользователь</th>
                                <th>Сообщений</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map((user, index) => {
                                const rank = index + 1;
                                let rankClass = '';
                                let medal = '';
                                if (rank === 1) { rankClass = 'gold'; medal = '👑'; }
                                else if (rank === 2) { rankClass = 'silver'; medal = '🥈'; }
                                else if (rank === 3) { rankClass = 'bronze'; medal = '🥉'; }
                                return `
                                    <tr>
                                        <td class="rank ${rankClass}">${medal || rank}</td>
                                        <td>
                                            <div class="user-cell">
                                                <img class="avatar-sm" src="${user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="${user.display_name}">
                                                ${user.display_name || user.username}
                                            </div>
                                        </td>
                                        <td class="messages">${user.messages.toLocaleString()}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
                
            } catch (error) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                        <h3>Ошибка</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        });
        
    } catch (error) {
        console.error('Ошибка загрузки лидерборда:', error);
    }
}

// ============================================
// СТРАНИЦА МОДЕРАЦИИ
// ============================================

async function loadModeration() {
    const container = document.getElementById('moderationContainer');
    const select = document.getElementById('modGuildSelect');
    const btn = document.getElementById('loadModerationBtn');
    
    if (!container || !select) return;
    
    try {
        const guilds = await apiFetch('/api/my-guilds');
        const guildList = guilds.guilds || [];
        
        select.innerHTML = '<option value="">Выберите сервер</option>' + 
            guildList.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        
        const params = new URLSearchParams(window.location.search);
        const guildParam = params.get('guild');
        if (guildParam) {
            select.value = guildParam;
            loadModerationData(guildParam);
        }
        
        btn.addEventListener('click', () => {
            const guildId = select.value;
            if (!guildId) {
                showToast('Выберите сервер', 'error');
                return;
            }
            loadModerationData(guildId);
        });
        
    } catch (error) {
        console.error('Ошибка загрузки модерации:', error);
    }
}

async function loadModerationData(guildId) {
    const container = document.getElementById('moderationContainer');
    
    container.innerHTML = '<div class="loading-spinner" style="margin: 40px auto; display: block;"></div>';
    
    try {
        const [members, roles] = await Promise.all([
            apiFetch(`/api/guilds/${guildId}/members`),
            apiFetch(`/api/guilds/${guildId}/roles`)
        ]);
        
        container.innerHTML = `
            <div class="moderation-panel">
                <div class="panel-card">
                    <h3><i class="fas fa-users"></i> Участники</h3>
                    ${members.slice(0, 20).map(m => `
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
                    `).join('')}
                    ${members.length > 20 ? `<p style="color: var(--text-muted); font-size: 13px; margin-top: 12px;">... и ещё ${members.length - 20} участников</p>` : ''}
                </div>
                
                <div class="panel-card">
                    <h3><i class="fas fa-crown"></i> Роли (${roles.length})</h3>
                    ${roles.slice(0, 15).map(r => `
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 14px;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #${r.color.toString(16).padStart(6, '0')};"></span>
                                ${r.name}
                            </span>
                            <span style="color: var(--text-muted); font-size: 12px;">${r.id}</span>
                        </div>
                    `).join('')}
                    ${roles.length > 15 ? `<p style="color: var(--text-muted); font-size: 13px; margin-top: 8px;">... и ещё ${roles.length - 15} ролей</p>` : ''}
                </div>
            </div>
        `;
        
    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                <h3>Ошибка</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function muteUser(guildId, userId) {
    try {
        await apiFetch(`/api/guilds/${guildId}/mute`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, duration: 600, reason: 'Мут через сайт' })
        });
        showToast('✅ Пользователь заглушен на 10 минут', 'success');
        loadModerationData(guildId);
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
        loadModerationData(guildId);
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
}

// ============================================
// СТРАНИЦА НАСТРОЙКИ РОЛЕЙ
// ============================================

async function loadRolesSettings() {
    const container = document.getElementById('rolesContainer');
    const select = document.getElementById('rolesGuildSelect');
    const loadBtn = document.getElementById('loadRolesBtn');
    const saveBtn = document.getElementById('saveRolesBtn');
    
    if (!container || !select) return;
    
    let currentThresholds = {};
    let currentRoles = [];
    let currentGuildId = null;
    
    try {
        const guilds = await apiFetch('/api/my-guilds');
        const guildList = guilds.guilds || [];
        
        select.innerHTML = '<option value="">Выберите сервер</option>' + 
            guildList.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        
        loadBtn.addEventListener('click', async () => {
            currentGuildId = select.value;
            if (!currentGuildId) {
                showToast('Выберите сервер', 'error');
                return;
            }
            
            container.innerHTML = '<div class="loading-spinner" style="margin: 40px auto; display: block;"></div>';
            
            try {
                const [thresholds, roles] = await Promise.all([
                    apiFetch(`/api/guilds/${currentGuildId}/thresholds`),
                    apiFetch(`/api/guilds/${currentGuildId}/roles`)
                ]);
                
                currentThresholds = thresholds;
                currentRoles = roles;
                
                renderRolesSettings(container, thresholds, roles);
                
            } catch (error) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                        <h3>Ошибка</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        });
        
        saveBtn.addEventListener('click', async () => {
            if (!currentGuildId) {
                showToast('Сначала загрузите настройки', 'error');
                return;
            }
            
            const items = container.querySelectorAll('.role-settings-item');
            const newThresholds = {};
            items.forEach(item => {
                const roleId = item.dataset.roleId;
                const messagesInput = item.querySelector('.role-messages-input');
                if (roleId && messagesInput) {
                    const messages = parseInt(messagesInput.value);
                    if (messages > 0) {
                        newThresholds[messages] = roleId;
                    }
                }
            });
            
            try {
                await apiFetch(`/api/guilds/${currentGuildId}/thresholds`, {
                    method: 'POST',
                    body: JSON.stringify({ thresholds: newThresholds })
                });
                showToast('✅ Настройки сохранены!', 'success');
                currentThresholds = newThresholds;
            } catch (error) {
                showToast('❌ Ошибка сохранения: ' + error.message, 'error');
            }
        });
        
    } catch (error) {
        console.error('Ошибка загрузки настроек ролей:', error);
    }
}

function renderRolesSettings(container, thresholds, roles) {
    const rolesMap = {};
    roles.forEach(r => { rolesMap[r.id] = r; });
    
    const sortedThresholds = Object.entries(thresholds)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    
    if (sortedThresholds.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-crown"></i>
                <h3>Нет настроенных ролей</h3>
                <p>Добавьте роли и укажите количество сообщений для их получения</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = sortedThresholds.map(([messages, roleId]) => {
        const role = rolesMap[roleId];
        return `
            <div class="role-settings-item" data-role-id="${roleId}">
                <div class="role-info">
                    <div class="role-color" style="background: ${role ? '#' + role.color.toString(16).padStart(6, '0') : '#888'};"></div>
                    <span class="role-name">${role ? role.name : 'Неизвестная роль'}</span>
                    <span class="role-id">${roleId}</span>
                </div>
                <div class="role-messages">
                    <span>📨</span>
                    <input class="role-messages-input" type="number" value="${messages}" min="1" step="100">
                    <span>сообщений</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// ЗАПУСК СТРАНИЦ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    if (path === '/servers' || path === '/servers.html') {
        loadServers();
    } else if (path === '/commands' || path === '/commands.html') {
        loadCommands();
    } else if (path === '/leaderboard' || path === '/leaderboard.html') {
        loadLeaderboard();
    } else if (path === '/moderation' || path === '/moderation.html') {
        loadModeration();
    } else if (path === '/roles-settings' || path === '/roles-settings.html') {
        loadRolesSettings();
    }
});