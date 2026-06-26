const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const axios = require('axios');
require('dotenv').config();

const app = express();

// ===== НАСТРОЙКИ =====
app.use(cors({
    origin: process.env.SITE_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// ===== СЕССИИ =====
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 дней
    }
}));

// ===== PASSPORT =====
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Стратегия Discord
passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.REDIRECT_URI,
    scope: ['identify', 'guilds', 'guilds.members.read']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, { ...profile, accessToken }));
}));

const BOT_TOKEN = process.env.BOT_TOKEN;

// ============================================
// 1. АВТОРИЗАЦИЯ
// ============================================

// Проверка авторизации
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Не авторизован' });
}

// Вход
app.get('/auth/discord', passport.authenticate('discord'));

// Callback
app.get('/auth/discord/callback',
    passport.authenticate('discord', {
        failureRedirect: '/',
        successRedirect: '/dashboard'
    })
);

// Выход
app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Текущий пользователь
app.get('/api/me', isAuthenticated, (req, res) => {
    res.json(req.user);
});

// ============================================
// 2. ПРИГЛАШЕНИЕ БОТА
// ============================================

app.get('/api/invite-url', (req, res) => {
    const clientId = process.env.CLIENT_ID;
    const permissions = '8'; // Administrator
    const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`;
    res.json({ url });
});

// ============================================
// 3. ИНФОРМАЦИЯ О БОТЕ (публичная)
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

// ============================================
// 4. СЕРВЕРЫ ПОЛЬЗОВАТЕЛЯ (где есть бот)
// ============================================

app.get('/api/my-guilds', isAuthenticated, async (req, res) => {
    try {
        // Получаем сервера пользователя
        const userGuilds = req.user.guilds || [];
        
        // Получаем сервера, где есть бот
        const botGuildsResponse = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: { 'Authorization': `Bot ${BOT_TOKEN}` }
        });
        const botGuilds = botGuildsResponse.data;
        const botGuildIds = new Set(botGuilds.map(g => g.id));

        // Фильтруем сервера, где есть бот И пользователь админ
        const guilds = userGuilds
            .filter(g => botGuildIds.has(g.id))
            .filter(g => (g.permissions & 0x8) === 0x8) // Админ права
            .map(g => ({
                ...g,
                botInGuild: true,
                isAdmin: true
            }));

        // Сервера, куда можно пригласить бота
        const inviteable = userGuilds
            .filter(g => !botGuildIds.has(g.id))
            .filter(g => (g.permissions & 0x8) === 0x8)
            .map(g => ({
                ...g,
                botInGuild: false,
                isAdmin: true
            }));

        res.json({ guilds, inviteable });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 5. УПРАВЛЕНИЕ СЕРВЕРОМ
// ============================================

// Получить информацию о сервере
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
// 6. ДЕЙСТВИЯ С ПОЛЬЗОВАТЕЛЯМИ
// ============================================

// Замутить
app.post('/api/mute', isAuthenticated, async (req, res) => {
    const { guildId, userId, duration, reason } = req.body;

    try {
        // Находим или создаём роль Muted
        const rolesResponse = await axios.get(
            `https://discord.com/api/v10/guilds/${guildId}/roles`,
            { headers: { 'Authorization': `Bot ${BOT_TOKEN}` } }
        );
        
        let mutedRole = rolesResponse.data.find(r => r.name === 'Muted');

        if (!mutedRole) {
            const createResponse = await axios.post(
                `https://discord.com/api/v10/guilds/${guildId}/roles`,
                { name: 'Muted', permissions: 0, color: 0x808080 },
                { headers: { 'Authorization': `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' } }
            );
            mutedRole = createResponse.data;
        }

        await axios.put(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${mutedRole.id}`,
            {},
            { headers: { 'Authorization': `Bot ${BOT_TOKEN}` } }
        );

        if (duration && duration > 0) {
            setTimeout(async () => {
                await axios.delete(
                    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${mutedRole.id}`,
                    { headers: { 'Authorization': `Bot ${BOT_TOKEN}` } }
                );
            }, duration * 1000);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

// Размутить
app.post('/api/unmute', isAuthenticated, async (req, res) => {
    const { guildId, userId } = req.body;

    try {
        const rolesResponse = await axios.get(
            `https://discord.com/api/v10/guilds/${guildId}/roles`,
            { headers: { 'Authorization': `Bot ${BOT_TOKEN}` } }
        );
        
        const mutedRole = rolesResponse.data.find(r => r.name === 'Muted');

        if (!mutedRole) {
            return res.json({ success: false, error: 'Роль Muted не найдена' });
        }

        await axios.delete(
            `https://discord.com/api/v10/guilds/${guildId}/members/${userId}/roles/${mutedRole.id}`,
            { headers: { 'Authorization': `Bot ${BOT_TOKEN}` } }
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

// Очистить чат
app.post('/api/clear', isAuthenticated, async (req, res) => {
    const { channelId, amount } = req.body;

    try {
        const messages = await axios.get(
            `https://discord.com/api/v10/channels/${channelId}/messages?limit=${Math.min(amount, 100)}`,
            { headers: { 'Authorization': `Bot ${BOT_TOKEN}` } }
        );

        const results = await Promise.all(
            messages.data.map(m => 
                axios.delete(
                    `https://discord.com/api/v10/channels/${channelId}/messages/${m.id}`,
                    { headers: { 'Authorization': `Bot ${BOT_TOKEN}` } }
                ).catch(() => null)
            )
        );

        const deleted = results.filter(r => r !== null).length;
        res.json({ success: true, deleted });
    } catch (error) {
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

// ============================================
// 7. УПРАВЛЕНИЕ КОМАНДАМИ
// ============================================

let commandsState = {
    'stats': true,
    'leaderboard': true,
    'help': true,
    'setstats': false,
    'resetstats': false,
    'addstats': false,
    'syncroles': false,
    'mute': true,
    'unmute': true,
    'clear': true,
    'antispam': false,
    'mute_duration': false
};

app.get('/api/commands', isAuthenticated, (req, res) => {
    res.json(commandsState);
});

app.post('/api/commands/:name', isAuthenticated, (req, res) => {
    const { enabled } = req.body;
    if (commandsState.hasOwnProperty(req.params.name)) {
        commandsState[req.params.name] = enabled;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Команда не найдена' });
    }
});

// ============================================
// 8. НАСТРОЙКИ АНТИСПАМА
// ============================================

let spamSettings = {
    limit: 4,
    window: 5,
    muteDuration: 600
};

app.get('/api/spam-settings', isAuthenticated, (req, res) => {
    res.json(spamSettings);
});

app.post('/api/spam-settings', isAuthenticated, (req, res) => {
    const { limit, window, muteDuration } = req.body;
    if (limit) spamSettings.limit = limit;
    if (window) spamSettings.window = window;
    if (muteDuration) spamSettings.muteDuration = muteDuration;
    res.json({ success: true, settings: spamSettings });
});

// ============================================
// 9. УПРАВЛЕНИЕ ПОРОГАМИ РОЛЕЙ
// ============================================

let roleThresholds = {
    1000: '1382039628252708934',
    2000: '1382039700919029781',
    3500: '1382039800781213837',
    5000: '1382039844447977555',
    7000: '1425730207133995029',
    9500: '1503697954320420906',
    12000: '1503697957005033472',
    15000: '1503697950059004045',
    18000: '1503698108712878172',
    22000: '1503698109241229422',
    26000: '1503698109786755103',
    30500: '1503698111371939850',
    35000: '1503698881442086922',
    39500: '1503698882574549083',
    44000: '1503698882008453200',
    49000: '1503699765743980597',
    54000: '1503699749864345690',
    60000: '1503699748966633582',
    68000: '1503700839028756631',
    80000: '1503700838110204077'
};

app.get('/api/role-thresholds', isAuthenticated, (req, res) => {
    res.json(roleThresholds);
});

app.post('/api/role-thresholds', isAuthenticated, (req, res) => {
    const { thresholds } = req.body;
    if (thresholds && typeof thresholds === 'object') {
        roleThresholds = thresholds;
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Неверный формат' });
    }
});

// ============================================
// 10. СТАТИЧЕСКИЕ ФАЙЛЫ
// ============================================

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard.html');
});

// ============================================
// ЗАПУСК
// ============================================

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
    console.log(`🔗 Приглашение: http://localhost:${PORT}`);
    console.log(`📊 Панель: http://localhost:${PORT}/dashboard`);
});