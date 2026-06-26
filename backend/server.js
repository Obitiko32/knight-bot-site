const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const BOT_TOKEN = process.env.BOT_TOKEN;

// ============================================
// НАСТРОЙКИ
// ============================================

app.use(cors({
    origin: process.env.SITE_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// СЕССИИ
// ============================================

const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fallback_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30
    },
    rolling: true,
    name: 'knightbot.sid'
};

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

app.use(session(sessionConfig));

// ============================================
// PASSPORT
// ============================================

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URI,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, { ...profile, accessToken }));
}));

// ============================================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Не авторизован' });
}

// ============================================
// 1. API МАРШРУТЫ
// ============================================

// Публичные
app.get('/api/bot-info', async (req, res) => {
    try {
        if (BOT_TOKEN) {
            const response = await axios.get('https://discord.com/api/v10/users/@me', {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            });
            res.json(response.data);
        } else {
            res.json({ username: 'Knight Bot (заглушка)', id: '0', guilds: 0 });
        }
    } catch (error) {
        res.json({ username: 'Knight Bot (офлайн)', id: '0', guilds: 0 });
    }
});

app.get('/api/invite-url', (req, res) => {
    const clientId = process.env.CLIENT_ID || '0';
    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    res.json({ url });
});

app.get('/api/guilds', async (req, res) => {
    try {
        if (BOT_TOKEN) {
            const response = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            });
            res.json(response.data);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.json([]);
    }
});

// ============================================
// НОВЫЕ API ДЛЯ СЕРВЕРОВ (ДОБАВЛЕНЫ!)
// ============================================

// Все сервера пользователя (из Discord)
app.get('/api/user-guilds', isAuthenticated, (req, res) => {
    const guilds = req.user.guilds || [];
    res.json(guilds);
});

// Сервера, где есть бот
app.get('/api/bot-guilds', isAuthenticated, async (req, res) => {
    try {
        if (BOT_TOKEN) {
            const response = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            });
            res.json(response.data);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.json([]);
    }
});

// ============================================
// АВТОРИЗАЦИЯ
// ============================================

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><title>Закрытие...</title></head>
            <body>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({ type: 'auth-success' }, '*');
                    }
                    window.close();
                <\/script>
            </body>
            </html>
        `);
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// ============================================
// ЗАЩИЩЁННЫЕ API
// ============================================

app.get('/api/me', isAuthenticated, (req, res) => {
    res.json(req.user);
});

app.get('/api/my-guilds', isAuthenticated, async (req, res) => {
    try {
        if (BOT_TOKEN) {
            const userGuilds = req.user.guilds || [];
            const botGuildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            });
            const botGuilds = botGuildsResponse.data;
            const botGuildIds = new Set(botGuilds.map(g => g.id));

            const guilds = userGuilds
                .filter(g => botGuildIds.has(g.id))
                .filter(g => (g.permissions & 0x8) === 0x8)
                .map(g => ({
                    id: g.id,
                    name: g.name,
                    icon: g.icon,
                    member_count: g.approximate_member_count || 0,
                    botInGuild: true,
                    isAdmin: true
                }));

            res.json({ guilds });
        } else {
            res.json({ guilds: [] });
        }
    } catch (error) {
        res.json({ guilds: [] });
    }
});

// ===== ПОЛУЧЕНИЕ РЕАЛЬНЫХ УЧАСТНИКОВ СЕРВЕРА =====
// ============================================
// API ДЛЯ МОДЕРАЦИИ (РЕАЛЬНЫЕ ДАННЫЕ)
// ============================================

// ===== ПОЛУЧЕНИЕ РЕАЛЬНЫХ УЧАСТНИКОВ =====
app.get('/api/guilds/:guildId/members', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        
        if (!BOT_TOKEN) {
            return res.json([]);
        }
        
        const response = await axios.get(
            `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`,
            {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            }
        );
        
        const members = response.data
            .filter(m => !m.user.bot)
            .map(m => ({
                id: m.user.id,
                username: m.user.username,
                display_name: m.nick || m.user.username,
                avatar: m.user.avatar 
                    ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png` 
                    : null
            }));
        
        res.json(members);
    } catch (error) {
        console.error('Ошибка получения участников:', error.message);
        res.json([]);
    }
});

// ===== ПОЛУЧЕНИЕ РЕАЛЬНЫХ РОЛЕЙ =====
app.get('/api/guilds/:guildId/roles', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        
        if (!BOT_TOKEN) {
            return res.json([]);
        }
        
        const response = await axios.get(
            `https://discord.com/api/v10/guilds/${guildId}/roles`,
            {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            }
        );
        
        const roles = response.data
            .filter(r => r.name !== '@everyone')
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.color
            }));
        
        res.json(roles);
    } catch (error) {
        console.error('Ошибка получения ролей:', error.message);
        res.json([]);
    }
});

// ===== ПОЛУЧЕНИЕ РЕАЛЬНОГО ЛИДЕРБОРДА =====
app.get('/api/guilds/:guildId/leaderboard', isAuthenticated, async (req, res) => {
    try {
        const { guildId } = req.params;
        
        // Здесь нужна БД для хранения сообщений
        // Пока возвращаем тестовые данные
        res.json([
            { id: '1', username: 'TopUser', display_name: 'Топ пользователь', messages: 5000, avatar: null },
            { id: '2', username: 'SecondUser', display_name: 'Второй', messages: 3000, avatar: null },
            { id: '3', username: 'ThirdUser', display_name: 'Третий', messages: 1000, avatar: null }
        ]);
    } catch (error) {
        res.json([]);
    }
});

app.get('/api/guilds/:guildId/thresholds', isAuthenticated, (req, res) => {
    res.json({
        1000: 'role_1',
        2000: 'role_2',
        5000: 'role_3'
    });
});

app.post('/api/guilds/:guildId/mute', isAuthenticated, (req, res) => {
    res.json({ success: true, message: 'Заглушка' });
});

app.post('/api/guilds/:guildId/unmute', isAuthenticated, (req, res) => {
    res.json({ success: true, message: 'Заглушка' });
});

// ============================================
// СТАТИЧЕСКИЕ ФАЙЛЫ
// ============================================

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ============================================
// СТРАНИЦЫ
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/servers', (req, res) => {
    res.sendFile(path.join(frontendPath, 'servers.html'));
});

app.get('/commands', (req, res) => {
    res.sendFile(path.join(frontendPath, 'commands.html'));
});

app.get('/leaderboard', (req, res) => {
    res.sendFile(path.join(frontendPath, 'leaderboard.html'));
});

app.get('/moderation', (req, res) => {
    res.sendFile(path.join(frontendPath, 'moderation.html'));
});

app.get('/roles-settings', (req, res) => {
    res.sendFile(path.join(frontendPath, 'roles-settings.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

app.get('/guild-settings', (req, res) => {
    res.sendFile(path.join(frontendPath, 'guild-settings.html'));
});

// ============================================
// 404 (В САМОМ КОНЦЕ!)
// ============================================

app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ============================================
// ЗАПУСК
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Сайт: ${process.env.SITE_URL || 'http://localhost:' + PORT}`);
});