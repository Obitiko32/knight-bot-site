// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

let currentUser = null;
let currentGuilds = [];
let currentTheme = localStorage.getItem('knight-theme') || 'light';
let selectedGuildId = null;

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
// ПРОФИЛЬ
// ============================================

async function loadProfile() {
    try {
        const response = await fetch('/api/me', { credentials: 'include' });
        if (response.ok) {
            currentUser = await response.json();
            
            const avatar = document.getElementById('profileAvatar');
            const name = document.getElementById('profileName');
            const dropdownName = document.getElementById('dropdownUserName');
            const dropdownId = document.getElementById('dropdownUserId');
            
            if (avatar) {
                avatar.src = currentUser.avatar 
                    ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png` 
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';
            }
            if (name) name.textContent = currentUser.username;
            if (dropdownName) dropdownName.textContent = currentUser.username;
            if (dropdownId) dropdownId.textContent = `ID: ${currentUser.id}`;
            
            // Прячем кнопку входа, показываем профиль
            const loginBtn = document.getElementById('heroLoginBtn');
            if (loginBtn) {
                loginBtn.textContent = '📊 Мои сервера';
                loginBtn.href = '/servers';
            }
            
            return true;
        } else {
            // Не авторизован
            const avatar = document.getElementById('profileAvatar');
            const name = document.getElementById('profileName');
            if (avatar) avatar.src = '';
            if (name) name.textContent = 'Войти';
            
            const loginBtn = document.getElementById('heroLoginBtn');
            if (loginBtn) {
                loginBtn.textContent = 'Войти через Discord';
                loginBtn.href = '/auth/discord';
            }
            
            return false;
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        return false;
    }
}

// ============================================
// ВЫПАДАЮЩЕЕ МЕНЮ ПРОФИЛЯ
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const profileBtn = document.getElementById('profileBtn');
    const dropdown = document.getElementById('profileDropdown');
    
    if (profileBtn && dropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
            profileBtn.classList.toggle('active');
        });
        
        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
            profileBtn.classList.remove('active');
        });
        
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    // Кнопки в меню
    const themeBtn = document.getElementById('dropdownTheme');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }
    
    const logoutBtn = document.getElementById('dropdownLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.location.href = '/auth/logout';
        });
    }
    
    const serversBtn = document.getElementById('dropdownServers');
    if (serversBtn) {
        serversBtn.addEventListener('click', () => {
            window.location.href = '/servers';
        });
    }
    
    // Применяем тему
    applyTheme(currentTheme);
    
    // Загружаем профиль
    loadProfile();
});

// ============================================
// TOAST / УВЕДОМЛЕНИЯ
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
// API ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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
// СТРАНИЦА СЕРВЕРОВ
// ============================================

async function loadServers() {
    const container = document.getElementById('serversContainer');
    if (!container) return;
    
    try {
        // Проверяем авторизацию
        const user = await apiFetch('/api/me');
        if (!user) {
            window.location.href = '/';
            return;
        }
        
        const guilds = await apiFetch('/api/my-guilds');
        currentGuilds = guilds.guilds || [];
        
        if (currentGuilds.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-castle"></i>
                    <h3>Нет серверов</h3>
                    <p>Knight Bot не добавлен ни на один ваш сервер</p>
                    <a href="/api/invite-url" class="btn-primary" style="margin-top: 16px; display: inline-block;">
                        <i class="fas fa-plus"></i> Пригласить бота
                    </a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = currentGuilds.map(guild => `
            <div class="server-card" onclick="selectServer('${guild.id}')">
                <div class="server-icon">
                    ${guild.icon 
                        ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png" alt="${guild.name}">` 
                        : guild.name.charAt(0).toUpperCase()
                    }
                </div>
                <div class="server-name">${guild.name}</div>
                <div class="server-members">👥 ${guild.member_count || 0} участников</div>
                <div class="server-actions">
                    <button class="btn-primary btn-sm" onclick="event.stopPropagation(); manageServer('${guild.id}')">
                        <i class="fas fa-cog"></i> Управлять
                    </button>
                    <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); inviteToServer('${guild.id}')">
                        <i class="fas fa-user-plus"></i> Пригласить
                    </button>
                </div>
            </div>
        `).join('');
        
        // Фильтр поиска
        const searchInput = document.getElementById('serverSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.toLowerCase();
                document.querySelectorAll('.server-card').forEach(card => {
                    const name = card.querySelector('.server-name')?.textContent?.toLowerCase() || '';
                    card.style.display = name.includes(query) ? '' : 'none';
                });
            });
        }
        
    } catch (error) {
        console.error('Ошибка загрузки серверов:', error);
        if (error.message.includes('Не авторизован')) {
            window.location.href = '/';
        } else {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                    <h3>Ошибка загрузки</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }
}

function selectServer(guildId) {
    selectedGuildId = guildId;
    window.location.href = `/moderation?guild=${guildId}`;
}

function manageServer(guildId) {
    window.location.href = `/moderation?guild=${guildId}`;
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
// СТРАНИЦА ЛИДЕРБОРДА
// ============================================

async function loadLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    const select = document.getElementById('guildSelect');
    const btn = document.getElementById('loadLeaderboardBtn');
    
    if (!container || !select) return;
    
    try {
        // Загружаем сервера
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
        
        // Проверяем параметр URL
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
            
            // Собираем данные с формы
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
    // Создаём карту ролей по ID
    const rolesMap = {};
    roles.forEach(r => { rolesMap[r.id] = r; });
    
    // Сортируем пороги
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