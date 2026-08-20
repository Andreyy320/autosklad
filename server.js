const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Загружаем переменные окружения из .env файла

const app = express();

// Базовая безопасность (отключаем принудительный HTTPS и CSP для работы по IP без домена)
app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: false
}));
app.disable('x-powered-by');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Подключение к БД напрямую (без использования поврежденного .env)
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'auto_sklad2',
    password: 'martyn999',
    port: 5432,
});

// Подключаем наш отдельный файл с API
const apiRoutes = require('./routes/api')(pool);
app.use('/api', apiRoutes); // Теперь все запросы будут идти через /api/users, /api/parts и т.д.

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}!`);
});