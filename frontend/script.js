// ============================================
// ГЛАВНАЯ СТРАНИЦА
// ============================================

async function loadBotInfo() {
    try {
        const response = await fetch('/api/bot-info');
        if (response.ok) {
            const data = await response.json();
            document.querySelector('.hero-content h1').innerHTML = 
                `Управляй сервером <br>с <span class="highlight">${data.username || 'Knight Bot'}</span>`;
        }
    } catch (error) {
        console.error('Ошибка загрузки бота:', error);
    }
}

async function loadInviteUrl() {
    try {
        const response = await fetch('/api/invite-url');
        const data = await response.json();
        document.getElementById('inviteBtn').href = data.url;
    } catch (error) {
        console.error('Ошибка загрузки ссылки:', error);
    }
}

// Проверка авторизации (для кнопки входа)
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
        // Не авторизован — оставляем кнопку "Войти"
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadBotInfo();
    loadInviteUrl();
    checkAuth();
});

// ============================================
// ПАНЕЛЬ УПРАВЛЕНИЯ (dashboard.html)
// ============================================

let selectedGuildId = null;

async function loadDashboard() {
    try {
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
                <div style="text-align: center; padding: 20px 0;">
                    <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">
                        🤖 Бот не добавлен<br>ни на один сервер
                    </p>
                    <a href="/api/invite-url" class="btn-primary" style="display: inline-block; padding: 8px 20px; border-radius: 10px; text-decoration: none; color: white; font-size: 13px;">
                        <i class="fas fa-plus"></i> Пригласить бота
                    </a>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.guilds.map(guild => `
            <div class="guild-item" data-guild-id="${guild.id}" onclick="selectGuild('${guild.id}')">
                <div class="guild-icon">
                    ${guild.icon 
                        ? `<img src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png" alt="${guild.name}">` 
                        : guild.name.charAt(0).toUpperCase()
                    }
                </div>
                <span class="guild-name">${guild.name}</span>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки серверов:', error);
        document.getElementById('guildsList').innerHTML = `
            <p style="color: var(--danger); font-size: 14px;">❌ Ошибка загрузки</p>
        `;
    }
}

async function selectGuild(guildId) {
    selectedGuildId = guildId;
    
    document.querySelectorAll('.guild-item').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.guildId === guildId) {
            el.classList.add('active');
        }
    });
    
    try {
        const response = await fetch(`/api/guilds/${guildId}`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const data = await response.json();
        
        const main = document.getElementById('guildDashboard');
        main.innerHTML = `
            <div class="card">
                <h3><i class="fas fa-server"></i> ${data.guild.name}</h3>
                <div class="stat-grid">
                    <div class="stat-item">
                        <div class="number">${data.members.length}</div>
                        <div class="label">👥 Участников</div>
                    </div>
                    <div class="stat-item">
                        <div class="number">${data.channels.length}</div>
                        <div class="label">📝 Каналов</div>
                    </div>
                    <div class="stat-item">
                        <div class="number">${data.roles.length}</div>
                        <div class="label">🎭 Ролей</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h3><i class="fas fa-users"></i> Участники (${data.members.length})</h3>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${data.members.slice(0, 50).map(m => `
                        <div class="member-item">
                            <span class="name">${m.user.username}#${m.user.discriminator}</span>
                            <span class="id">${m.user.id}</span>
                        </div>
                    `).join('')}
                    ${data.members.length > 50 ? `<p style="color: var(--text-secondary); font-size: 13px; padding: 8px 0;">... и ещё ${data.members.length - 50} участников</p>` : ''}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Ошибка загрузки сервера:', error);
        document.getElementById('guildDashboard').innerHTML = `
            <div class="card">
                <h3><i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> Ошибка</h3>
                <p style="color: var(--danger);">Не удалось загрузить данные сервера</p>
            </div>
        `;
    }
}

if (document.getElementById('guildsList')) {
    document.addEventListener('DOMContentLoaded', loadDashboard);
}