// ============================================
// ГЛАВНАЯ СТРАНИЦА
// ============================================

// Загрузка информации о боте
async function loadBotInfo() {
    try {
        const response = await fetch('/api/bot-info');
        const data = await response.json();
        
        document.getElementById('botName').textContent = data.username || 'Knight Bot';
        document.getElementById('botStats').textContent = `🤖 Готов к работе!`;
        
        // Обновляем ссылку приглашения
        const inviteResponse = await fetch('/api/invite-url');
        const inviteData = await inviteResponse.json();
        document.getElementById('inviteLink').href = inviteData.url;
        document.getElementById('heroInviteBtn').href = inviteData.url;
        document.getElementById('inviteBtn').href = inviteData.url;
        
    } catch (error) {
        console.error('Ошибка загрузки бота:', error);
    }
}

// Проверка авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            const user = await response.json();
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                loginBtn.innerHTML = `<i class="fas fa-user"></i> ${user.username}`;
                loginBtn.href = '/dashboard';
            }
        }
    } catch (error) {
        // Не авторизован
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    loadBotInfo();
    checkAuth();
});

// ============================================
// ПАНЕЛЬ УПРАВЛЕНИЯ (dashboard.html)
// ============================================

let selectedGuildId = null;

async function loadDashboard() {
    try {
        // Проверяем авторизацию
        const meResponse = await fetch('/api/me');
        if (!meResponse.ok) {
            window.location.href = '/';
            return;
        }
        
        const user = await meResponse.json();
        document.getElementById('userName').textContent = user.username;
        document.getElementById('userAvatar').src = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        // Загружаем сервера
        await loadGuilds();
        
    } catch (error) {
        console.error('Ошибка загрузки панели:', error);
    }
}

async function loadGuilds() {
    try {
        const response = await fetch('/api/my-guilds');
        const data = await response.json();
        
        const container = document.getElementById('guildsList');
        
        if (!data.guilds || data.guilds.length === 0) {
            container.innerHTML = `
                <p style="color: var(--text-secondary); font-size: 14px;">
                    Бот не добавлен ни на один ваш сервер.<br>
                    <a href="#" id="inviteFromSidebar" class="btn-primary" style="display: inline-block; margin-top: 10px; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px;">
                        <i class="fas fa-plus"></i> Пригласить бота
                    </a>
                </p>
            `;
            
            const inviteBtn = document.getElementById('inviteFromSidebar');
            if (inviteBtn) {
                const inviteResponse = await fetch('/api/invite-url');
                const inviteData = await inviteResponse.json();
                inviteBtn.href = inviteData.url;
            }
            return;
        }
        
        container.innerHTML = data.guilds.map(guild => `
            <div class="guild-item" data-guild-id="${guild.id}" onclick="selectGuild('${guild.id}')">
                <div class="guild-icon">
                    ${guild.icon 
                        ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png" style="width: 32px; height: 32px; border-radius: 50%;">` 
                        : guild.name.charAt(0).toUpperCase()
                    }
                </div>
                <span class="guild-name">${guild.name}</span>
            </div>
        `).join('');
        
        // Если есть приглашаемые сервера
        if (data.inviteable && data.inviteable.length > 0) {
            container.innerHTML += `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(127,90,240,0.1);">
                    <p style="color: var(--text-secondary); font-size: 12px;">Можно пригласить:</p>
                    ${data.inviteable.map(guild => `
                        <div class="guild-item" style="opacity: 0.6;">
                            <div class="guild-icon">
                                ${guild.icon 
                                    ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png" style="width: 32px; height: 32px; border-radius: 50%;">` 
                                    : guild.name.charAt(0).toUpperCase()
                                }
                            </div>
                            <span class="guild-name">${guild.name}</span>
                            <a href="#" onclick="inviteToGuild('${guild.id}')" style="margin-left: auto; color: var(--accent); text-decoration: none; font-size: 12px;">
                                <i class="fas fa-plus"></i>
                            </a>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Ошибка загрузки серверов:', error);
    }
}

async function inviteToGuild(guildId) {
    const inviteResponse = await fetch('/api/invite-url');
    const inviteData = await inviteResponse.json();
    window.open(inviteData.url, '_blank');
}

async function selectGuild(guildId) {
    selectedGuildId = guildId;
    
    // Обновляем активный элемент
    document.querySelectorAll('.guild-item').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.guildId === guildId) {
            el.classList.add('active');
        }
    });
    
    // Загружаем информацию о сервере
    try {
        const response = await fetch(`/api/guilds/${guildId}`);
        const data = await response.json();
        
        const main = document.getElementById('guildDashboard');
        main.innerHTML = `
            <div class="card">
                <h3><i class="fas fa-server"></i> ${data.guild.name}</h3>
                <p>👥 Участников: ${data.members.length} | 📝 Каналов: ${data.channels.length} | 🎭 Ролей: ${data.roles.length}</p>
            </div>
            
            <div class="card">
                <h3><i class="fas fa-microphone-slash"></i> Управление мутами</h3>
                <div class="form-group">
                    <label>Выберите пользователя:</label>
                    <select id="muteUserSelect">
                        <option value="">Загрузка...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Длительность (сек):</label>
                    <input type="number" id="muteDuration" value="60" min="1" max="600">
                </div>
                <button onclick="muteUser('${guildId}')" class="btn-danger">
                    <i class="fas fa-microphone-slash"></i> Замутить
                </button>
                <button onclick="unmuteUser('${guildId}')" class="btn-success">
                    <i class="fas fa-microphone"></i> Размутить
                </button>
                <div id="muteResult"></div>
            </div>
            
            <div class="card">
                <h3><i class="fas fa-trash"></i> Очистка чата</h3>
                <div class="form-group">
                    <label>Выберите канал:</label>
                    <select id="clearChannelSelect">
                        ${data.channels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Количество сообщений (1-100):</label>
                    <input type="number" id="clearAmount" value="10" min="1" max="100">
                </div>
                <button onclick="clearChat('${guildId}')" class="btn-danger">
                    <i class="fas fa-trash"></i> Очистить
                </button>
                <div id="clearResult"></div>
            </div>
            
            <div class="card">
                <h3><i class="fas fa-users"></i> Участники (${data.members.length})</h3>
                <div id="membersList" style="max-height: 300px; overflow-y: auto;">
                    ${data.members.slice(0, 50).map(m => `
                        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span>${m.user.username}#${m.user.discriminator}</span>
                            <span style="color: var(--text-secondary); font-size: 12px;">${m.user.id}</span>
                        </div>
                    `).join('')}
                    ${data.members.length > 50 ? `<p style="color: var(--text-secondary); font-size: 12px;">... и ещё ${data.members.length - 50} участников</p>` : ''}
                </div>
            </div>
        `;
        
        // Загружаем пользователей для мута
        const userSelect = document.getElementById('muteUserSelect');
        userSelect.innerHTML = data.members.map(m => 
            `<option value="${m.user.id}">${m.user.username}#${m.user.discriminator}</option>`
        ).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки сервера:', error);
    }
}

// ============================================
// ДЕЙСТВИЯ В ПАНЕЛИ
// ============================================

async function muteUser(guildId) {
    const userId = document.getElementById('muteUserSelect').value;
    const duration = parseInt(document.getElementById('muteDuration').value);
    const resultDiv = document.getElementById('muteResult');
    
    if (!userId) {
        resultDiv.className = 'error';
        resultDiv.textContent = '❌ Выберите пользователя';
        return;
    }
    
    try {
        const response = await fetch('/api/mute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId, userId, duration })
        });
        
        const result = await response.json();
        resultDiv.className = result.success ? 'success' : 'error';
        resultDiv.textContent = result.success ? '✅ Пользователь замучен!' : `❌ Ошибка: ${result.error}`;
        
        if (result.success) {
            setTimeout(() => selectGuild(guildId), 1000);
        }
    } catch (error) {
        resultDiv.className = 'error';
        resultDiv.textContent = '❌ Ошибка соединения';
    }
}

async function unmuteUser(guildId) {
    const userId = document.getElementById('muteUserSelect').value;
    const resultDiv = document.getElementById('muteResult');
    
    if (!userId) {
        resultDiv.className = 'error';
        resultDiv.textContent = '❌ Выберите пользователя';
        return;
    }
    
    try {
        const response = await fetch('/api/unmute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guildId, userId })
        });
        
        const result = await response.json();
        resultDiv.className = result.success ? 'success' : 'error';
        resultDiv.textContent = result.success ? '✅ Пользователь размучен!' : `❌ Ошибка: ${result.error}`;
        
        if (result.success) {
            setTimeout(() => selectGuild(guildId), 1000);
        }
    } catch (error) {
        resultDiv.className = 'error';
        resultDiv.textContent = '❌ Ошибка соединения';
    }
}

async function clearChat(guildId) {
    const channelId = document.getElementById('clearChannelSelect').value;
    const amount = parseInt(document.getElementById('clearAmount').value);
    const resultDiv = document.getElementById('clearResult');
    
    if (!channelId) {
        resultDiv.className = 'error';
        resultDiv.textContent = '❌ Выберите канал';
        return;
    }
    
    try {
        const response = await fetch('/api/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, amount })
        });
        
        const result = await response.json();
        resultDiv.className = result.success ? 'success' : 'error';
        resultDiv.textContent = result.success ? `✅ Удалено ${result.deleted} сообщений!` : `❌ Ошибка: ${result.error}`;
    } catch (error) {
        resultDiv.className = 'error';
        resultDiv.textContent = '❌ Ошибка соединения';
    }
}

// Запуск панели
if (document.getElementById('guildsList')) {
    document.addEventListener('DOMContentLoaded', loadDashboard);
}