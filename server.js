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
// 1. ЛОГГЕР (для отладки сессий)
// ============================================

function logSession(req, message) {
    console.log(`[SESSION] ${message} | ID: ${req.sessionID} | User: ${req.user?.username || 'Гость'}`);
}

// ============================================
// 2. CORS (ОЧЕНЬ ВАЖНО ДЛЯ СЕССИЙ)
// ============================================

app.use(cors({
    origin: process.env.SITE_URL || 'http://localhost:3000',
    credentials: true, // ОБЯЗАТЕЛЬНО для сессий
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// 3. СЕССИИ (ПРАВИЛЬНАЯ НАСТРОЙКА)
// ============================================

const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'fallback_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30 // 30 дней
    },
    rolling: true, // обновляет сессию при каждом запросе
    name: 'knightbot.sid' // имя куки (чтобы не конфликтовать)
};

if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Доверяем proxy на Render
}

app.use(session(sessionConfig));

// Промежуточный слой для логирования сессий
app.use((req, res, next) => {
    logSession(req, 'Запрос');
    next();
});

// ============================================
// 4. PASSPORT
// ============================================

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    console.log('[PASSPORT] Сериализация:', user.id, user.username);
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    console.log('[PASSPORT] Десериализация:', obj.id, obj.username);
    done(null, obj);
});

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URI,
    scope: ['identify', 'guilds', 'guilds.members.read']
}, (accessToken, refreshToken, profile, done) => {
    console.log('[PASSPORT] Стратегия сработала для:', profile.username);
    process.nextTick(() => done(null, { 
        ...profile, 
        accessToken,
        refreshToken 
    }));
}));

// ============================================
// 5. ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        logSession(req, '✅ Авторизован');
        return next();
    }
    logSession(req, '❌ НЕ авторизован');
    res.status(401).json({ error: 'Не авторизован' });
}

// ============================================
// 6. ПУБЛИЧНЫЕ ЭНДПОИНТЫ
// ============================================

app.get('/api/bot-info', async (req, res) => {
    try {
        const response = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/invite-url', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;
    res.json({ url });
});

// ============================================
// 7. АВТОРИЗАЦИЯ
// ============================================

app.get('/auth/discord', (req, res, next) => {
    logSession(req, 'Начало авторизации');
    passport.authenticate('discord')(req, res, next);
});

app.get('/auth/discord/callback',
    passport.authenticate('discord', {
        failureRedirect: '/',
        successRedirect: '/dashboard',
        failureFlash: false,
        successFlash: false
    }),
    (req, res) => {
        logSession(req, '✅ Успешный вход');
        res.redirect('/dashboard');
    }
);

app.get('/auth/logout', (req, res) => {
    logSession(req, 'Выход из аккаунта');
    req.logout((err) => {
        if (err) console.error('Ошибка выхода:', err);
        req.session.destroy((err) => {
            if (err) console.error('Ошибка удаления сессии:', err);
            res.clearCookie('knightbot.sid');
            res.redirect('/');
        });
    });
});

// ============================================
// 8. ЗАЩИЩЁННЫЕ ЭНДПОИНТЫ
// ============================================

app.get('/api/me', isAuthenticated, (req, res) => {
    logSession(req, 'Запрос /api/me');
    res.json(req.user);
});

app.get('/api/my-guilds', isAuthenticated, async (req, res) => {
    try {
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
                botInGuild: true,
                isAdmin: true
            }));

        res.json({ guilds });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/guilds/:guildId', isAuthenticated, async (req, res) => {
    try {
        const [guild, channels, roles, members] = await Promise.all([
            axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}`, {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            }),
            axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/channels`, {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            }),
            axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/roles`, {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            }),
            axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/members?limit=1000`, {
                headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
            })
        ]);

        res.json({
            guild: guild.data,
            channels: channels.data.filter(c => c.type === 0),
            roles: roles.data,
            members: members.data.filter(m => !m.user.bot)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 9. СТАТИЧЕСКИЕ ФАЙЛЫ
// ============================================

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
    logSession(req, 'Главная страница');
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    logSession(req, 'Панель управления');
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

// ============================================
// 10. ОБРАБОТКА ОШИБОК
// ============================================

app.use((err, req, res, next) => {
    console.error('❌ Ошибка:', err.message);
    console.error(err.stack);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ============================================
// 11. ЗАПУСК
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Сайт: ${process.env.SITE_URL || 'http://localhost:' + PORT}`);
});