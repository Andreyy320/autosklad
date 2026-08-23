const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();

app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: false
}));
app.disable('x-powered-by');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Делаем папку uploads публичной, чтобы картинки открывались в браузере
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Настройка multer для сохранения загружаемых файлов
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

// Передаем upload в роуты (если потребуется) или оставляем вызов
const apiRoutes = require('./routes/api')(pool, upload);
app.use('/api', apiRoutes); 

// ВОТ СЮДА ДОБАВЬ:
app.get('/logs', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logs.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}!`);
});