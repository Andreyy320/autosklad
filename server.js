const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
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

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'autosklad',
    password: 'martyn999',
    port: 5432,
});

const apiRoutes = require('./routes/api')(pool);
app.use('/api', apiRoutes); 

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}!`);
});