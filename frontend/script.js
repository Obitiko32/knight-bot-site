// ============================================
// ГЛАВНАЯ СТРАНИЦА
// ============================================

async function loadBotInfo() {
    try {
        const response = await fetch('/api/bot-info');
        if (response.ok) {
            const data = await response.json();
            const heroTitle = document.querySelector('.hero-content h1');
            if (heroTitle) {
                heroTitle.innerHTML = 
                    `Управляй сервером <br>с <span class="highlight">${data.username || 'Knight Bot'}</span>`;
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки бота:', error);
    }
}

async function loadInviteUrl() {
    try {
        const response = await fetch('/api/invite-url');
        const data = await response.json();
        const inviteBtn = document.getElementById('inviteBtn');
        if (inviteBtn) inviteBtn.href = data.url;
        const heroInvite = document.getElementById('heroInviteBtn');
        if (heroInvite) heroInvite.href = data.url;
    } catch (error) {
        console.error('Ошибка загрузки ссылки:', error);
    }
}

// ===== ПРОВЕРКА АВТОРИЗАЦИИ (исправлено) =====
async function checkAuth() {
    try {
        const response = await fetch('/api/me', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const user = await response.json();
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                loginBtn.innerHTML = `<i class="fas fa-user"></i> ${user.username}`;
                loginBtn.href = '/dashboard';
                loginBtn.classList.remove('btn-discord');
                loginBtn.classList.add('btn-profile');
            }
            return true;
        } else {
            // Не авторизован — показываем кнопку "Войти"
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) {
                loginBtn.innerHTML = `<i class="fab fa-discord"></i> Войти`;
                loginBtn.href = '/auth/discord';
                loginBtn.classList.remove('btn-profile');
                loginBtn.classList.add('btn-discord');
            }
            return false;
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        return false;
    }
}

// ===== ОБРАБОТЧИК КЛИКА ПО ПРОФИЛЮ =====
// Если пользователь уже авторизован — переход на панель
// Если нет — переход на вход через Discord

document.addEventListener('DOMContentLoaded', async () => {
    await loadBotInfo();
    await loadInviteUrl();
    await checkAuth();
    
    // Обработчик для кнопки профиля
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', async (e) => {
            // Проверяем, авторизован ли пользователь
            const response = await fetch('/api/me', { credentials: 'include' });
            if (response.ok) {
                // Если авторизован — идём в панель
                window.location.href = '/dashboard';
            } else {
                // Если нет — идём на вход
                window.location.href = '/auth/discord';
            }
            e.preventDefault();
        });
    }
});

// ============================================
// ПАНЕЛЬ УПРАВЛЕНИЯ (dashboard.html)
// ============================================

let selectedGuildId = null;

async function loadDashboard() {
    try {
        const meResponse = await fetch('/api/me', {
            credentials: 'include'
        });
        
        if (!meResponse.ok) {
            console.error('❌ Не авторизован, перенаправление на главную');
            window.location.href = '/';
            return;
        }
        
        const user = await meResponse.json();
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        
        if (userNameEl) userNameEl.textContent = user.username;
        if (userAvatarEl) {
            userAvatarEl.src = user.avatar 
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
                : 'https://cdn.discordapp.com/embed/avatars/0.png';
        }
        
        await loadGuilds();
        
    } catch (error) {
        console.error('Ошибка загрузки панели:', error);
        window.location.href = '/';
    }
}

async function loadGuilds() {
    try {
        const response = await fetch('/api/my-guilds', {
            credentials: 'include'
        });
        const data = await response.json();
        
        const container = document.getElementById('guildsList');
        if (!container) return;
        
        if (!data.guilds || data.guilds.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px 0;">
                    <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">
                        🛡️ Бот не добавлен<br>ни на один сервер
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
        if (container) {
            container.innerHTML = `<p style="color: var(--danger); font-size: 14px;">❌ Ошибка загрузки</p>`;
        }
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
        const response = await fetch(`/api/guilds/${guildId}`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Ошибка загрузки');
        
        const data = await response.json();
        
        const main = document.getElementById('guildDashboard');
        if (!main) return;
        
        main.innerHTML = `
            <div class="card">
                <h3><i class="fas fa-crown"></i> ${data.guild.name}</h3>
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
        const main = document.getElementById('guildDashboard');
        if (main) {
            main.innerHTML = `
                <div class="card">
                    <h3><i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i> Ошибка</h3>
                    <p style="color: var(--danger);">Не удалось загрузить данные сервера</p>
                </div>
            `;
        }
    }
}

// Запуск панели
if (document.getElementById('guildsList')) {
    document.addEventListener('DOMContentLoaded', loadDashboard);
}