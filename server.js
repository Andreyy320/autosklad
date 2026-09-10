const express = require('express');
const helmet = require('helmet');
const { Pool, types } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();


types.setTypeParser(1114, (val) => val); // timestamp without time zone
types.setTypeParser(1082, (val) => val); // date
// =================================================================================

const app = express();

app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: false
}));
app.disable('x-powered-by');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== ОГРАНИЧЕНИЕ CORS ====================
// Раньше cors() без параметров разрешал запросы с ЛЮБОГО сайта в интернете.
// Теперь разрешаем только со своих собственных адресов.
const corsOptions = {
    origin: [
        'http://194.156.66.100:5000',
        'http://194.156.66.100'
        // добавьте сюда ваш домен, если он появится, например 'https://autosklad.ваш-домен.ru'
    ],
    credentials: true
};
app.use(cors(corsOptions));
// ============================================================

app.use(express.static(path.join(__dirname, 'public')));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==================== ПОДКЛЮЧЕНИЕ К БАЗЕ ЧЕРЕЗ .env ====================
// Раньше логин/пароль от базы были захардкожены прямо в коде.
// Теперь берём готовую строку подключения DATABASE_URL из .env — она там уже есть.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
// =========================================================================

const apiRoutes = require('./routes/api')(pool, upload);
app.use('/api', apiRoutes); 

app.get('/logs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logs.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}!`);
});