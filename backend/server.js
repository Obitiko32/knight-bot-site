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
// 1. API МАРШРУТЫ (СНАЧАЛА!)
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
            res.json({ username: 'Knight Bot (заглушка)', id: '0' });
        }
    } catch (error) {
        res.json({ username: 'Knight Bot (офлайн)', id: '0' });
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

// Авторизация
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

// Защищённые API
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
            res.json({
                guilds: [
                    {
                        id: '123456789',
                        name: 'Тестовый сервер',
                        icon: null,
                        member_count: 10,
                        botInGuild: true,
                        isAdmin: true
                    }
                ]
            });
        }
    } catch (error) {
        res.json({
            guilds: [
                {
                    id: '123456789',
                    name: 'Тестовый сервер (ошибка)',
                    icon: null,
                    member_count: 10,
                    botInGuild: true,
                    isAdmin: true
                }
            ]
        });
    }
});

// ===== API ДЛЯ МОДЕРАЦИИ (ВАЖНО!) =====
app.get('/api/guilds/:guildId/members', isAuthenticated, (req, res) => {
    // Заглушка — возвращаем тестовых пользователей
    res.json([
        { id: '1', username: 'Пользователь 1', display_name: 'Пользователь 1', avatar: null },
        { id: '2', username: 'Пользователь 2', display_name: 'Пользователь 2', avatar: null },
        { id: '3', username: 'Пользователь 3', display_name: 'Пользователь 3', avatar: null },
        { id: '4', username: 'Admin', display_name: 'Admin', avatar: null },
        { id: '5', username: 'Moderator', display_name: 'Moderator', avatar: null }
    ]);
});

app.get('/api/guilds/:guildId/roles', isAuthenticated, (req, res) => {
    res.json([
        { id: '1', name: 'Admin', color: 0xff0000 },
        { id: '2', name: 'Moderator', color: 0x00ff00 },
        { id: '3', name: 'Member', color: 0x0000ff }
    ]);
});

app.get('/api/guilds/:guildId/leaderboard', isAuthenticated, (req, res) => {
    res.json([
        { id: '1', username: 'TopUser', display_name: 'Топ пользователь', messages: 5000, avatar: null },
        { id: '2', username: 'SecondUser', display_name: 'Второй', messages: 3000, avatar: null },
        { id: '3', username: 'ThirdUser', display_name: 'Третий', messages: 1000, avatar: null }
    ]);
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
// 2. СТАТИЧЕСКИЕ ФАЙЛЫ
// ============================================

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// ============================================
// 3. СТРАНИЦЫ (HTML)
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

// ============================================
// 4. 404 (В САМОМ КОНЦЕ!)
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
// Страница управления сервером
app.get('/guild-settings', (req, res) => {
    res.sendFile(path.join(frontendPath, 'guild-settings.html'));
});