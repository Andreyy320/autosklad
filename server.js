const express = require('express');
const helmet = require('helmet');
const { Pool, types } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

// ==================== ФИКС ДЛЯ TIMESTAMP БЕЗ ЧАСОВОГО ПОЯСА ====================
// По умолчанию pg конвертирует "timestamp without time zone" в JS Date,
// интерпретируя "голую" строку из базы как UTC. Это ломает и чтение (сдвиг при
// отображении через локальные геттеры), и повторную запись (Date.toISOString()
// снова конвертирует в UTC при использовании как fallback-значения, как было
// в PUT /moves/:id с oldDoc.date). Отключаем автоконвертацию: pg отдаёт
// timestamp/date как обычные строки "как есть" из базы.
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
app.use(cors());
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

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'autosklad',
    password: 'martyn999',
    port: 5432,
});

const apiRoutes = require('./routes/api')(pool, upload);
app.use('/api', apiRoutes); 

app.get('/logs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logs.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}!`);
});