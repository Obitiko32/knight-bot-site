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

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

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
    scope: ['identify', 'guilds', 'guilds.members.read']
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
// ПУБЛИЧНЫЕ ЭНДПОИНТЫ
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
    const url = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
    res.json({ url });
});

// ============================================
// АВТОРИЗАЦИЯ
// ============================================

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    passport.authenticate('discord', {
        failureRedirect: '/',
        successRedirect: '/dashboard'
    })
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// ============================================
// ЗАЩИЩЁННЫЕ ЭНДПОИНТЫ
// ============================================

app.get('/api/me', isAuthenticated, (req, res) => {
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

// ============================================
// ⚠️ ВАЖНО: ПРАВИЛЬНЫЙ ПУТЬ К СТАТИКЕ
// ============================================

// Получаем абсолютный путь к папке frontend
const frontendPath = path.join(__dirname, '..', 'frontend');
console.log('📂 Путь к фронтенду:', frontendPath);

// Раздаём статику
app.use(express.static(frontendPath));

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Панель управления
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

// Любой другой GET запрос - отдаём index.html (для SPA)
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