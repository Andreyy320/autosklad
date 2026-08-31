const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const path = require('path'); // Нужно для указания пути к файлу html
const multer = require('multer'); // <--- 1. Подключаем multer


const upload = multer({ dest: path.join(__dirname, '../uploads/') });
module.exports = (pool) => {
    
    // 1. АВТОРИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
    router.post('/login', async (req, res) => {
        const { login, password } = req.body;
        try {
            const result = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
            
            if (result.rows.length > 0) {
                const user = result.rows[0];
                const match = await bcrypt.compare(password, user.password_hash);
                
                if (match) {
                    return res.json({ success: true, user: user });
                } else {
                    return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
                }
            } else {
                return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
            }
        } catch (err) {
            console.error('Ошибка сервера при логине:', err.message);
            return res.status(500).send('Ошибка сервера');
        }
    });



// Открытие самой страницы logs.html по адресу /logs (GET)
router.get('/logs', (req, res) => {
    res.sendFile(path.join(__dirname, '../logs.html'));
});

// 2. ПОЛУЧЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users ORDER BY id ASC');
        return res.json(result.rows);
    } catch (err) {
        console.error('>>> [API ОШИБКА] в /users:', err.message);
        return res.status(500).send(err.message);
    }
});

    // ПОЛУЧЕНИЕ СПИСКА МОЛ (mol_users)
    router.get('/mol_users', async (req, res) => {
        
        try {
            const result = await pool.query('SELECT * FROM mol_users ORDER BY id ASC');
            return res.json(result.rows);
        } catch (err) {
            console.error('>>> [API ОШИБКА] в /mol_users:', err.message);
            return res.status(500).send(err.message);
        }
    });


    // 3. ДОБАВЛЕНИЕ НОВОГО ПОЛЬЗОВАТЕЛЯ
    router.post('/users', async (req, res) => {
        try {
            const { login, password_hash, name, description } = req.body;

            let finalPasswordHash = null;
            if (password_hash) {
                const saltRounds = 10;
                finalPasswordHash = await bcrypt.hash(password_hash, saltRounds);
            }

            const newRecord = await pool.query(
                'INSERT INTO users (login, password_hash, name, description) VALUES ($1, $2, $3, $4) RETURNING *',
                [login, finalPasswordHash, name, description]
            );

            res.json(newRecord.rows[0]);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка сервера');
        }
    });



    // Получение списка запчастей
    router.get('/parts', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM spare_parts');
            res.json(result.rows);
        } catch (err) {
            res.status(500).send(err.message);
        }
    });

    // ПОЛУЧЕНИЕ СПИСКА БРЕНДОВ МАШИН (из твоей таблицы car_brands)
    router.get('/brands', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM car_brands ORDER BY id ASC');
            res.json(result.rows);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка при получении брендов');
        }
    });


// ПОЛУЧЕНИЕ СПИСКА ТИПОВ КУЗОВА (из таблицы kyzov_type)
    router.get('/bodies', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM kyzov_type ORDER BY id ASC');
            res.json(result.rows);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка при получении типов кузова');
        }
    });


    // ПОЛУЧЕНИЕ СПИСКА МОДЕЛЕЙ МАШИН С НАЗВАНИЯМИ БРЕНДОВ И КУЗОВОВ
    router.get('/models', async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT 
                    car_models.*,
                    car_brands.name AS brand_name,
                    kyzov_type.name AS body_name,
                    toplivo.name AS toplivo_name
                FROM car_models
                LEFT JOIN car_brands ON car_models.brand_id = car_brands.id
                LEFT JOIN kyzov_type ON car_models.kyzov_type_id = kyzov_type.id
                LEFT JOIN toplivo ON car_models.toplivo_id = toplivo.id
                ORDER BY car_models.id ASC
            `);
            res.json(result.rows);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка при получении моделей автомобилей');
        }
    });


// ПОЛУЧЕНИЕ СПИСКА КОНТРАГЕНТОВ (с JOIN для получения названия типа)
router.get('/counterparties', async (req, res) => {
    try {
        const query = `
            SELECT c.*, ct.name AS counterparty_type_name 
            FROM counterparties c
            LEFT JOIN counterparty_types ct ON c.counterparty_type_id = ct.id
            ORDER BY c.id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении контрагентов');
    }
});

// ПОЛУЧЕНИЕ КОНТАКТОВ КОНКРЕТНОГО КОНТРАГЕНТА (поддерживает и /api/counterparty_contacts/1, и /api/counterparty_contacts?counterparty_id=1)
router.get('/counterparty_contacts', async (req, res) => {
    try {
        const counterparty_id = req.params.counterparty_id || req.query.counterparty_id;
        const query = `
            SELECT * FROM counterparty_contacts 
            WHERE counterparty_id = $1 
            ORDER BY id ASC
        `;
        const result = await pool.query(query, [counterparty_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении контактов контрагента');
    }
});

// Оставляем старый роут на всякий случай, если где-то еще вызывается со слэшем
router.get('/counterparty_contacts/:counterparty_id', async (req, res) => {
    try {
        const { counterparty_id } = req.params;
        const query = `
            SELECT * FROM counterparty_contacts 
            WHERE counterparty_id = $1 
            ORDER BY id ASC
        `;
        const result = await pool.query(query, [counterparty_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении контактов контрагента');
    }
});



// Роут получения поставщиков с JOIN
router.get('/postavhik', async (req, res) => {
    try {
        const query = `
            SELECT p.*, t.name AS type_name 
            FROM postavhik p 
            LEFT JOIN counterparty_types t ON p.type_id = t.id 
            ORDER BY p.id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении поставщиков');
    }
});


// ПОЛУЧЕНИЕ КОНТАКТОВ КОНКРЕТНОГО ПОСТАВЩИКА (поддерживает и /api/postavhik_contacts/1, и /api/postavhik_contacts?postavhik_id=1)
router.get('/postavhik_contacts', async (req, res) => {
    try {
        const postavhik_id = req.params.postavhik_id || req.query.postavhik_id;
        const query = `
            SELECT * FROM postavhik_contacts 
            WHERE postavhik_id = $1 
            ORDER BY id ASC
        `;
        const result = await pool.query(query, [postavhik_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении контактов поставщика');
    }
});

// Оставляем старый роут на всякий случай, если вызывается со слэшем
router.get('/postavhik_contacts/:postavhik_id', async (req, res) => {
    try {
        const { postavhik_id } = req.params;
        const query = `
            SELECT * FROM postavhik_contacts 
            WHERE postavhik_id = $1 
            ORDER BY id ASC
        `;
        const result = await pool.query(query, [postavhik_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении контактов поставщика');
    }
});


// 1. Обновленный роут получения покупателей (с JOIN для типов и новых скидок)
router.get('/customers', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.*, 
                t.name AS type_name,
                pd.name AS part_discount_name,
                pd.discount_percent AS part_discount_percent,
                sd.name AS service_discount_name,
                sd.discount_percent AS service_discount_percent
            FROM customers c 
            LEFT JOIN counterparty_types t ON c.type_id = t.id 
            LEFT JOIN part_discounts pd ON c.discount_part_id = pd.id
            LEFT JOIN service_discounts sd ON c.discount_service_id = sd.id
            ORDER BY c.id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении покупателей');
    }
});

// 2. Роут получения списка скидок на запчасти
router.get('/part_discounts', async (req, res) => {
    try {
        const query = `SELECT * FROM part_discounts ORDER BY id ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении скидок на запчасти');
    }
});

// 3. Роут получения списка скидок на услуги
router.get('/service_discounts', async (req, res) => {
    try {
        const query = `SELECT * FROM service_discounts ORDER BY id ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении скидок на услуги');
    }
});


// ПОЛУЧЕНИЕ КОНТАКТОВ КОНКРЕТНОГО ПОКУПАТЕЛЯ (поддерживает и /api/customer_contacts/1, и /api/customer_contacts?customer_id=1)
router.get('/customer_contacts', async (req, res) => {
    try {
        const customer_id = req.params.customer_id || req.query.customer_id;
        const query = `
            SELECT * FROM customer_contacts 
            WHERE customer_id = $1 
            ORDER BY id ASC
        `;
        const result = await pool.query(query, [customer_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении контактов покупателя');
    }
});

// Оставляем роут со слэшем на случай вызова с ID в параметрах пути
router.get('/customer_contacts/:customer_id', async (req, res) => {
    try {
        const { customer_id } = req.params;
        const query = `
            SELECT * FROM customer_contacts 
            WHERE customer_id = $1 
            ORDER BY id ASC
        `;
        const result = await pool.query(query, [customer_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении контактов покупателя');
    }
});




// 4. Роуты для получения автомобилей конкретного покупателя (поддерживает оба варианта запроса)
router.get('/customer_cars', async (req, res) => {
    try {
        const customer_id = req.query.customer_id;
        const query = `
            SELECT * FROM customer_cars 
            WHERE customer_id = $1 
            ORDER BY id ASC
        `;
        const result = await pool.query(query, [customer_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении автомобилей покупателя');
    }
});

router.get('/customer_cars/:customer_id', async (req, res) => {
    try {
        const { customer_id } = req.params;
        const query = `
            SELECT * FROM customer_cars 
            WHERE customer_id = $1 
            ORDER BY id ASC
        `;
        const result = await pool.query(query, [customer_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении автомобилей покупателя');
    }
});




    // ПОЛУЧЕНИЕ СПИСКА ТИПОВ КОНТРАГЕНТОВ (из таблицы counterparty_types)
    router.get('/counterparty_types', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM counterparty_types ORDER BY id ASC');
            res.json(result.rows);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка при получении типов контрагентов');
        }
    });


    // ПОЛУЧЕНИЕ СПИСКА ТИПОВ СКЛАДОВ (из таблицы type_sklad)
    router.get('/type_sklad', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM type_sklad ORDER BY id ASC');
            res.json(result.rows);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка при получении типов складов');
        }
    });


    // ПОЛУЧЕНИЕ СПИСКА СКЛАДОВ (с названием типа склада)
    router.get('/skladi', async (req, res) => {
        try {
            const query = `
                SELECT s.*, t.name AS type_name 
                FROM skladi s 
                LEFT JOIN type_sklad t ON s.type_sklad_id = t.id 
                ORDER BY s.id ASC
            `;
            const result = await pool.query(query);
            res.json(result.rows);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка при получении складов');
        }
    });

  router.get('/cars', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.*, 
                m.name AS car_model_name,
                m.engine AS engine_name,
                k.name AS body_name,
                t.name AS toplivo_name
            FROM cars c
            LEFT JOIN car_models m ON c.model_id = m.id
            LEFT JOIN kyzov_type k ON m.kyzov_type_id = k.id
            LEFT JOIN toplivo t ON c.toplivo_id = t.id
            ORDER BY c.id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении автомобилей');
    }
});
// 1. Получение деталей автомобилей (с фильтрацией по car_id, если он передан)
    router.get('/car_details', async (req, res) => {
        try {
            const { car_id } = req.query;
            
            let query = `
                SELECT 
                    cd.*, 
                    c.gos_number AS car_gos_number,
                    m.name AS car_model_name
                FROM car_details cd
                LEFT JOIN cars c ON cd.car_id = c.id
                LEFT JOIN car_models m ON c.model_id = m.id
            `;
            
            const values = [];
            
            // Если передан car_id — фильтруем по нему
            if (car_id) {
                query += ` WHERE cd.car_id = $1 `;
                values.push(car_id);
            }
            
            query += ` ORDER BY cd.id ASC `;

            const result = await pool.query(query, values);
            res.json(result.rows);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка при получении деталей и фото автомобилей');
        }
    });


    // ПОЛУЧЕНИЕ СПИСКА ТИПОВ РАБОТ (из таблицы type_rabot)
    router.get('/type_rabot', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM type_rabot ORDER BY id ASC');
            res.json(result.rows);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Ошибка при получении типов работ');
        }
    });



router.get('/works', async (req, res) => {
    try {
        const query = `
            SELECT w.*, 
                   tr.name AS type_rabot_name, 
                   gz.name AS replacement_group_name 
            FROM works w
            LEFT JOIN type_rabot tr ON w.type_rabot_id = tr.id
            LEFT JOIN gryppa_zamehenia gz ON w.replacement_group_id = gz.id
            ORDER BY w.id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении списка работ');
    }
});



// ПОЛУЧЕНИЕ СПИСКА ИСПОЛНИТЕЛЕЙ
router.get('/ispolnitel', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ispolnitel ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Ошибка при получении исполнителей:", err.message);
        res.status(500).send('Ошибка сервера');
    }
});

// ПОЛУЧЕНИЕ СПИСКА ТИПОВ РЕМОНТА
router.get('/repair_types', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM repair_types ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Ошибка при получении типов ремонта:", err.message);
        res.status(500).send('Ошибка сервера');
    }
});




// ПОЛУЧЕНИЕ СПИСКА МОЛ (с JOIN для mol_users и складов)
router.get('/mol', async (req, res) => {
 
    try {
        const query = `
            SELECT m.*, mu.name AS user_fio, s.name AS warehouse_name 
            FROM mol m
            LEFT JOIN mol_users mu ON m.user_id = mu.id
            LEFT JOIN skladi s ON m.warehouse_id = s.id
            ORDER BY m.id ASC
        `;
        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (err) {
        console.error('>>> [API ОШИБКА] в /mol:', err.message);
        return res.status(500).send('Ошибка при получении списка МОЛ');
    }
});

// ДОБАВЛЕНИЕ НОВОЙ ЗАПИСИ МОЛ
router.post('/mol', async (req, res) => {
    try {
        const { user_id, warehouse_id, date_assigned, date_removed, description } = req.body;
        const query = `
            INSERT INTO mol (user_id, warehouse_id, date_assigned, date_removed, description, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `;
        const values = [
            user_id || null, 
            warehouse_id || null, 
            date_assigned || null, 
            date_removed || null, 
            description
        ];
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при добавлении МОЛ');
    }
});


// Получить список всех видов топлива
router.get('/toplivo', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM toplivo ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении списка топлива' });
    }
});

// Получить один вид топлива по ID
router.get('/toplivo/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM toplivo WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Топливо не найдено' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить новый вид топлива
router.post('/toplivo', async (req, res) => {
    try {
        const { name, account_tmc, account_expense, description } = req.body;
        const query = `
            INSERT INTO toplivo (name, account_tmc, account_expense, description)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [name, account_tmc, account_expense, description];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при добавлении топлива' });
    }
});


// Получить список всех единиц измерения
router.get('/ed_izmereniya', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ed_izmereniya ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении единиц измерения' });
    }
});

// Добавить новую единицу измерения
router.post('/ed_izmereniya', async (req, res) => {
    try {
        const { name, short_name, regex_pattern, error_text } = req.body;
        const query = `
            INSERT INTO ed_izmereniya (name, short_name, regex_pattern, error_text)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [name, short_name, regex_pattern, error_text];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при добавлении единицы измерения' });
    }
});


// 1. Получение списка Групп цен
router.get('/gruppa_tsen', async (req, res) => {
    try {
        const query = `
            SELECT * FROM gruppa_tsen 
            ORDER BY id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении групп цен');
    }
});


// ПОЛУЧЕНИЕ СПИСКА ЗАПЧАСТЕЙ
router.get('/zaphasti', async (req, res) => {
    try {
        const query = `
            SELECT z.*, 
                   p.name AS proizvoditel_name, 
                   e.name AS ed_izmereniya_name, 
                   gt.name AS gruppa_tsen_name, 
                   gz.name AS gryppa_zamehenia_name 
            FROM zaphasti z
            LEFT JOIN proizvoditel_zaphasti p ON z.proizvoditel_id = p.id
            LEFT JOIN ed_izmereniya e ON z.ed_izmereniya_id = e.id
            LEFT JOIN gruppa_tsen gt ON z.gruppa_tsen_id = gt.id
            LEFT JOIN gryppa_zamehenia gz ON z.gryppa_zamehenia_id = gz.id
            ORDER BY z.id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении списка запчастей');
    }
});


// ==================== ПОЛУЧЕНИЕ ОДНОЙ ЗАПЧАСТИ ПО ID (Устраняет ошибку 404) ====================
router.get('/zaphasti/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT z.*, 
                   p.name AS proizvoditel_name, 
                   e.name AS ed_izmereniya_name, 
                   gt.name AS gruppa_tsen_name, 
                   gz.name AS gryppa_zamehenia_name 
            FROM zaphasti z
            LEFT JOIN proizvoditel_zaphasti p ON z.proizvoditel_id = p.id
            LEFT JOIN ed_izmereniya e ON z.ed_izmereniya_id = e.id
            LEFT JOIN gruppa_tsen gt ON z.gruppa_tsen_id = gt.id
            LEFT JOIN gryppa_zamehenia gz ON z.gryppa_zamehenia_id = gz.id
            WHERE z.id = $1
        `;
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Запчасть не найдена' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка при получении запчасти:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении запчасти' });
    }
});


// ПОЛУЧЕНИЕ СПИСКА ПРОИЗВОДИТЕЛЕЙ ЗАПЧАСТЕЙ
router.get('/proizvoditel_zaphasti', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM proizvoditel_zaphasti ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Ошибка при получении производителей запчастей:", err.message);
        res.status(500).send('Ошибка сервера');
    }
});


// ПОЛУЧЕНИЕ СПИСКА ГРУПП ЗАМЕЩЕНИЯ
router.get('/gryppa_zamehenia', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM gryppa_zamehenia ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Ошибка при получении групп замещения:", err.message);
        res.status(500).send('Ошибка сервера');
    }
});

// ПОЛУЧЕНИЕ СПИСКА ВИДОВ РАБОТ
router.get('/vidy_rabot', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM vidy_rabot ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error("Ошибка при получении видов работ:", err.message);
        res.status(500).send('Ошибка сервера');
    }
});

// ПОЛУЧЕНИЕ ВИДА РАБОТЫ ПО ID
router.get('/vidy_rabot/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM vidy_rabot WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Вид работ не найден' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Ошибка при получении вида работ:", err.message);
        res.status(500).send('Ошибка сервера');
    }
});

// ==================== GET РОУТЫ ====================
router.get('/receipts', async (req, res) => {
    try {
        const query = `
            SELECT r.*, 
                   s.name AS warehouse_name, 
                   COALESCE(u.name, u.login, m.description, 'МОЛ #' || m.id) AS mol_user_fio, 
                   p.name AS supplier_name
            FROM receipts r
            LEFT JOIN skladi s ON r.warehouse_id = s.id
            LEFT JOIN mol m ON r.mol_id = m.id
            LEFT JOIN users u ON m.user_id = u.id
            LEFT JOIN postavhik p ON r.supplier_id = p.id
            ORDER BY r.id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении приходов' });
    }
});





router.get('/receipt_items', async (req, res) => {
    try {
        const { receipt_id } = req.query;
        
        let query = `
            SELECT 
                ri.*, 
                z.article AS zaphasti_article, 
                z.code AS zaphasti_code, 
                z.name AS zaphasti_name, 
                z.unit AS zaphasti_unit 
            FROM receipt_items ri
            LEFT JOIN zaphasti z ON ri.zaphasti_id = z.id
        `;
        
        let params = [];

        if (receipt_id) {
            query += ' WHERE ri.receipt_id = $1';
            params.push(receipt_id);
        }

        const result = await pool.query(query, params);
        
        if (result.rows.length > 0) {
        }

        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении строк прихода:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


router.get('/statuses', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name FROM statuses ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении статусов' });
    }
});


// ==================== ПОЛУЧИТЬ ВСЕ АВТОСЕРВИСЫ ====================
router.get('/autoservices', async (req, res) => {
    try {
        const query = `SELECT * FROM autoservices ORDER BY id ASC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении автосервисов:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении автосервисов' });
    }
});




router.get('/moves', async (req, res) => {
    try {
        const query = `
            SELECT m.*, 
                   wf.name AS warehouse_from_name, 
                   wt.name AS warehouse_to_name,
                   COALESCE(uf.name, uf.login, mf.description, 'МОЛ #' || mf.id) AS mol_from_name,
                   COALESCE(ut.name, ut.login, mt.description, 'МОЛ #' || mt.id) AS mol_to_name
            FROM moves m
            LEFT JOIN skladi wf ON m.warehouse_from_id = wf.id
            LEFT JOIN skladi wt ON m.warehouse_to_id = wt.id
            LEFT JOIN mol mf ON m.mol_from_id = mf.id
            LEFT JOIN users uf ON mf.user_id = uf.id
            LEFT JOIN mol mt ON m.mol_to_id = mt.id
            LEFT JOIN users ut ON mt.user_id = ut.id
            ORDER BY m.id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении перемещений' });
    }
});


router.get('/move_items', async (req, res) => {
    try {
        const moveId = req.query.move_id;
        
        let query = `
            SELECT 
                mi.*, 
                -- Подтягиваем цену из прихода, если документ прихода указан, иначе оставляем цену из move_items
                COALESCE(ri_orig.price, mi.price, 0) AS price,
                z.name AS zaphasti_name, 
                z.code AS zaphasti_code,
                z.article AS zaphasti_article,
                e.name AS zaphasti_unit,
                COALESCE(
                    CASE 
                        WHEN r.fact_date IS NOT NULL THEN CONCAT(r.doc_number, ' от ', TO_CHAR(r.fact_date, 'DD.MM.YYYY HH24:MI'))
                        ELSE r.doc_number
                    END, 
                    '—'
                ) AS income_document
            FROM move_items mi
            LEFT JOIN zaphasti z ON mi.zaphasti_id = z.id
            LEFT JOIN ed_izmereniya e ON z.ed_izmereniya_id = e.id
            LEFT JOIN receipts r ON mi.income_document_id = r.id
            -- Джойним конкретную строку прихода, чтобы взять точную закупочную цену партии
            LEFT JOIN receipt_items ri_orig ON mi.income_document_id = ri_orig.receipt_id AND mi.zaphasti_id = ri_orig.zaphasti_id
        `;
        
        const params = [];
        if (moveId) {
            query += ` WHERE mi.move_id = $1`;
            params.push(moveId);
        }
        
        query += ` ORDER BY mi.id DESC`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении строк перемещения' });
    }
});





// ==================== ПОЛУЧИТЬ ВСЕ ТЕХОСМОТРЫ ====================
router.get('/tehosmotr', async (req, res) => {
    try {
        const query = `
            SELECT t.*, 
                   c.gos_number AS car_number, 
                   COALESCE(c.model, cm.name, '—') AS car_model,
                   p.name AS payment_type_name
            FROM tehosmotr t
            LEFT JOIN cars c ON t.car_id = c.id
            LEFT JOIN car_models cm ON c.model_id = cm.id
            LEFT JOIN payment_types p ON t.payment_type_id = p.id
            ORDER BY t.id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении техосмотров:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении техосмотров' });
    }
});



// Эндпоинт для быстрой проводки техосмотра
router.patch('/tehosmotr/:id/post', async (routerReq, routerRes) => {
    try {
        const { id } = routerReq.params;
        const now = new Date();

        const query = `
            UPDATE tehosmotr 
            SET is_posted = true, 
                fact_date = COALESCE(fact_date, $1)
            WHERE id = $2
            RETURNING *;
        `;
        const result = await pool.query(query, [now, id]);

        if (result.rows.length === 0) {
            return routerRes.status(404).json({ error: 'Документ не найден' });
        }

        routerRes.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка при проведении техосмотра:', err);
        routerRes.status(500).json({ error: 'Ошибка сервера' });
    }
});





// ==================== ПОЛУЧИТЬ ВСЕ ЗАПИСИ АВТОСТРАХОВАНИЯ ====================
router.get('/autostrahovanie', async (req, res) => {
    try {
        const query = `
            SELECT a.*, 
                   c.gos_number AS car_number, 
                   COALESCE(c.model, cm.name, '—') AS car_model,
                   s.name AS autoservice_name,
                   p.name AS payment_type_name
            FROM autostrahovanie a
            LEFT JOIN cars c ON a.car_id = c.id
            LEFT JOIN car_models cm ON c.model_id = cm.id
            LEFT JOIN autoservices s ON a.autoservice_id = s.id
            LEFT JOIN payment_types p ON a.payment_type_id = p.id
            ORDER BY a.id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении автострахования:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении автострахования' });
    }
});


// ==================== ПОЛУЧИТЬ НАПОМИНАНИЯ ПО ДАТАМ ====================
router.get('/reminders', async (req, res) => {
    try {
        const query = `
            WITH calculated_reminders AS (
                SELECT 
                    c.id,
                    c.gos_number,
                    COALESCE(c.model, m.name, '—') AS model_name,
                    c.description,
                    COALESCE(c.pto_current, latest_pto.to_date) AS pto_current,
                    COALESCE(c.pto_next, latest_pto.next_to_date) AS pto_next,
                    COALESCE(c.insurance_current, latest_ins.insurance_current) AS insurance_current,
                    COALESCE(c.insurance_next, latest_ins.insurance_next) AS insurance_next
                FROM cars c
                LEFT JOIN car_models m ON c.model_id = m.id
                LEFT JOIN (
                    SELECT DISTINCT ON (car_id) car_id, to_date, next_to_date
                    FROM tehosmotr
                    ORDER BY car_id, id DESC
                ) latest_pto ON c.id = latest_pto.car_id
                LEFT JOIN (
                    SELECT DISTINCT ON (car_id) car_id, insurance_current, insurance_next
                    FROM autostrahovanie
                    ORDER BY car_id, id DESC
                ) latest_ins ON c.id = latest_ins.car_id
            )
            SELECT * FROM calculated_reminders
            WHERE 
                (pto_current IS NOT NULL AND pto_current < CURRENT_DATE) OR
                (pto_next IS NOT NULL AND pto_next < CURRENT_DATE) OR
                (insurance_current IS NOT NULL AND insurance_current < CURRENT_DATE) OR
                (insurance_next IS NOT NULL AND insurance_next < CURRENT_DATE)
            ORDER BY id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении напоминаний:', err.message);
        res.status(500).json({ error: 'Ошибка при получении напоминаний' });
    }
});
// ==================== ОБНОВЛЕНИЕ ПЕРЕМЕЩЕНИЯ ====================
router.put('/moves/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { doc_number, date, warehouse_from_id, mol_from_id, warehouse_to_id, mol_to_id, description, is_posted } = req.body;

        // 1. Загружаем старые данные
        const oldDocRes = await pool.query('SELECT * FROM moves WHERE id = $1', [id]);
        if (oldDocRes.rows.length === 0) {
            return res.status(404).json({ error: 'Документ не найден' });
        }
        const oldDoc = oldDocRes.rows[0];

        // 2. Статус проведения
        let boolIsPosted = oldDoc.is_posted;
        if (is_posted !== undefined && is_posted !== null) {
            boolIsPosted = is_posted === true || is_posted === 'true' || is_posted === 1 || is_posted === '1';
        }

// 3. Фактическая дата
        let factDate = oldDoc.fact_date;
        if (boolIsPosted) {
            if (!oldDoc.is_posted || !oldDoc.fact_date) {
                factDate = new Date();
            }
        } else {
            factDate = null;
        }

        // 4. Защита от стирания данных
        const finalDocNumber = doc_number !== undefined && doc_number !== '' ? doc_number : oldDoc.doc_number;
        const finalDate = date || oldDoc.date;
        const finalWhFrom = warehouse_from_id ? parseInt(warehouse_from_id, 10) : oldDoc.warehouse_from_id;
        const finalMolFrom = mol_from_id ? parseInt(mol_from_id, 10) : oldDoc.mol_from_id;
        const finalWhTo = warehouse_to_id ? parseInt(warehouse_to_id, 10) : oldDoc.warehouse_to_id;
        const finalMolTo = mol_to_id ? parseInt(mol_to_id, 10) : oldDoc.mol_to_id;
        const finalDescription = description !== undefined ? description : oldDoc.description;

        // 5. Запрос в БД
        const updateQuery = `
            UPDATE moves 
            SET doc_number = $1, 
                date = $2, 
                warehouse_from_id = $3, 
                mol_from_id = $4, 
                warehouse_to_id = $5, 
                mol_to_id = $6, 
                description = $7, 
                is_posted = $8, 
                fact_date = $9
            WHERE id = $10
            RETURNING *;
        `;

        const values = [
            finalDocNumber,
            finalDate,
            finalWhFrom,
            finalMolFrom,
            finalWhTo,
            finalMolTo,
            finalDescription,
            boolIsPosted,
            factDate,
            id
        ];

        const result = await pool.query(updateQuery, values);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка при обновлении перемещения:', err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении перемещения' });
    }
});




// Пример явного эндпоинта, если требуется:
router.get('/payment_types', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM payment_types ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});




// Замени '/car-cards' на '/car_cards' в бэкенде:
router.get('/car_cards', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.*, 
                m.name AS car_model_name,
                m.engine AS engine_name,
                k.name AS body_name,
                t.name AS toplivo_name,
                teh.to_date AS tehosmotr_current,
                teh.next_to_date AS tehosmotr_next,
                ast.insurance_current AS autostrahovanie_current,
                ast.insurance_next AS autostrahovanie_next
            FROM cars c
            LEFT JOIN car_models m ON c.model_id = m.id
            LEFT JOIN kyzov_type k ON m.kyzov_type_id = k.id
            LEFT JOIN toplivo t ON c.toplivo_id = t.id
            LEFT JOIN LATERAL (
                SELECT to_date, next_to_date 
                FROM tehosmotr 
                WHERE car_id = c.id 
                ORDER BY id DESC 
                LIMIT 1
            ) teh ON true
            LEFT JOIN LATERAL (
                SELECT insurance_current, insurance_next 
                FROM autostrahovanie 
                WHERE car_id = c.id 
                ORDER BY id DESC 
                LIMIT 1
            ) ast ON true
            ORDER BY c.id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении карточек автомобилей');
    }
});


// ==================== ТЕХОСМОТРЫ КОНКРЕТНОЙ МАШИНЫ (для нижней таблицы) ====================
router.get('/car_tehosmotr', async (req, res) => {
    try {
        const { car_id } = req.query;
        const query = `
            SELECT * 
            FROM tehosmotr 
            WHERE car_id = $1 
            ORDER BY id DESC
        `;
        const result = await pool.query(query, [car_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении техосмотров автомобиля');
    }
});

// ==================== ДТП КОНКРЕТНОЙ МАШИНЫ (для нижней таблицы) ====================
router.get('/dtp_history', async (req, res) => {
    try {
        const { car_id } = req.query;
        const query = `
            SELECT * 
            FROM accidents 
            WHERE car_id = $1 
            ORDER BY id DESC
        `;
        const result = await pool.query(query, [car_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении истории ДТП автомобиля');
    }
});



router.get('/accident_images', async (req, res) => {
    try {
        const { accident_id, car_id } = req.query;
        let query = '';
        let params = [];

        if (car_id) {
            // Если запрос пришел из карточки авто, достаем все фото ДТП, которые принадлежат машинам с этим car_id
            // (Предполагается, что в таблице ДТП (например, accidents или dtp) есть поле car_id)
            query = `
                SELECT ai.* 
                FROM accident_images ai
                JOIN accidents a ON ai.accident_id = a.id
                WHERE a.car_id = $1
                ORDER BY ai.id DESC
            `;
            params = [car_id];
        } else if (accident_id) {
            // Стандартный запрос для конкретного ДТП
            query = `SELECT * FROM accident_images WHERE accident_id = $1 ORDER BY id DESC`;
            params = [accident_id];
        } else {
            return res.status(400).json({ error: 'Не указан accident_id или car_id' });
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении изображений ДТП');
    }
});

router.post('/accident_images', upload.single('image_url'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { accident_id, description, created_at } = req.body;
        
        const image_url = req.file ? `/uploads/${req.file.filename}` : null;

        if (!accident_id || !image_url) {
            return res.status(400).json({ error: 'Не указан accident_id или не загружено изображение' });
        }

        await client.query('BEGIN');

        // Добавили created_at, если пользователь его менял
        const query = `
            INSERT INTO accident_images (accident_id, image_url, description, created_at) 
            VALUES ($1, $2, $3, COALESCE($4, NOW())) 
            RETURNING *;
        `;
        const values = [accident_id, image_url, description || null, created_at || null];
        const result = await client.query(query, values);

        await client.query('COMMIT');
        
        console.log(`[SUCCESS] Успешно добавлено фото ДТП ID: ${result.rows[0].id}`);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Ошибка при добавлении фото ДТП:", err.message);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    } finally {
        client.release();
    }
});

// ==================== ОБНОВЛЕНИЕ ИЗОБРАЖЕНИЯ ДТП (РЕДАКТИРОВАНИЕ) ====================
router.put('/accident_images/:id', upload.single('image_url'), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { description, created_at } = req.body;

        await client.query('BEGIN');

        // 1. Получаем старую запись, чтобы узнать старый путь к файлу
        const oldRecord = await client.query('SELECT * FROM accident_images WHERE id = $1', [id]);
        if (oldRecord.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Запись не найдена' });
        }

        let image_url = oldRecord.rows[0].image_url;

        // 2. Если загружен новый файл, удаляем старый с диска и обновляем путь
        if (req.file) {
            const newImageUrl = `/uploads/${req.file.filename}`;
            
            // Удаляем старый файл физически из папки uploads, если он существует
            if (image_url && image_url.startsWith('/uploads/')) {
                const oldFilePath = path.join(__dirname, '..', image_url); // Подстройте путь к папке uploads при необходимости
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            image_url = newImageUrl;
        }

        // 3. Обновляем данные в базе
        const query = `
            UPDATE accident_images 
            SET image_url = $1, description = $2, created_at = COALESCE($3, created_at)
            WHERE id = $4 
            RETURNING *;
        `;
        const values = [image_url, description || null, created_at || null, id];
        const result = await client.query(query, values);

        await client.query('COMMIT');
        
        console.log(`[SUCCESS] Обновлено фото ДТП ID: ${id}`);
        res.json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Ошибка при обновлении фото ДТП:", err.message);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    } finally {
        client.release();
    }
});

// ==================== УДАЛЕНИЕ ИЗОБРАЖЕНИЯ ДТП ====================
router.delete('/accident_images/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Сначала получаем запись, чтобы удалить физический файл с диска
        const record = await pool.query('SELECT * FROM accident_images WHERE id = $1', [id]);
        if (record.rows.length > 0) {
            const image_url = record.rows[0].image_url;
            if (image_url && image_url.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, '..', image_url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        const result = await pool.query('DELETE FROM accident_images WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Фотография не найдена' });
        }

        console.log(`[SUCCESS] Удалено фото ДТП ID: ${id}`);
        res.json({ message: 'Фотография успешно удалена', deleted: result.rows[0] });
    } catch (err) {
        console.error("Ошибка при удалении фото ДТП:", err.message);
        res.status(500).json({ error: 'Ошибка сервера при удалении фото' });
    }
});


router.get('/doc_types', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name, description FROM doc_types ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Ошибка сервера при получении типов документов' });
    }
});


// Получение списка ремонтов
router.get('/repairs', async (req, res) => {
    try {
        const { car_id } = req.query;
        
        let query = `
            SELECT 
                r.*,
                dt.name AS doc_type_name,
                rt.name AS repair_type_name,
                c.gos_number AS car_number,
                COALESCE(c.model, cm.name, 'Не указана') AS car_model,
                s.name AS warehouse_name,
                u.name AS mol_name
            FROM repairs r
            LEFT JOIN doc_types dt ON r.doc_type_id = dt.id
            LEFT JOIN repair_types rt ON r.repair_type_id = rt.id
            LEFT JOIN cars c ON r.car_id = c.id
            LEFT JOIN car_models cm ON c.model_id = cm.id
            LEFT JOIN skladi s ON r.warehouse_id = s.id
            LEFT JOIN mol m ON r.mol_id = m.id
            LEFT JOIN users u ON m.user_id = u.id
        `;
        
        let queryParams = [];
        if (car_id) {
            query += ` WHERE r.car_id = $1`;
            queryParams.push(car_id);
        }
        
        query += ` ORDER BY r.id DESC`;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error("Ошибка в /api/repairs:", err.message);
        res.status(500).send(err.message);
    }
});



router.get('/repair_items', async (req, res) => {
    try {
        const { repair_id } = req.query;
        
        let query = `
            SELECT 
                ri.*, 
                z.article AS zaphasti_article, 
                z.code AS zaphasti_code, 
                z.name AS zaphasti_name, 
                z.unit AS zaphasti_unit,
                COALESCE(
                    CASE 
                        WHEN r.fact_date IS NOT NULL 
                        THEN CONCAT(r.doc_number, ' от ', TO_CHAR(r.fact_date, 'DD.MM.YYYY'))
                        ELSE r.doc_number 
                    END, 
                    '—'
                ) AS income_document
            FROM repair_items ri
            LEFT JOIN zaphasti z ON ri.zaphast_id = z.id
            LEFT JOIN receipts r ON ri.receipt_id = r.id
        `;
        
        let params = [];
        if (repair_id) {
            query += ' WHERE ri.repair_id = $1';
            params.push(repair_id);
        }

        query += ' ORDER BY ri.id DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении запчастей ремонта:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});



// ==================== ПОЛУЧЕНИЕ РАБОТ ДЛЯ РЕМОНТА ====================

router.get('/repair_works', async (req, res) => {
    try {
        const { repair_id } = req.query;
        
        let query = `
            SELECT 
                rw.*,
                w.name AS work_name,
                i.name AS ispolnitel_name
            FROM repair_works rw
            LEFT JOIN works w ON rw.work_id = w.id
            LEFT JOIN ispolnitel i ON rw.ispolnitel_id = i.id
        `;
        let params = [];

        if (repair_id) {
            query += ' WHERE rw.repair_id = $1';
            params.push(repair_id);
        }

        query += ' ORDER BY rw.id ASC';

        const result = await pool.query(query, params);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении работ для ремонта:', err);
        res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
    }
});




// ==================== РЕМОНТЫ КОНКРЕТНОЙ МАШИНЫ (запчасти + работы) ====================
router.get('/repair_history', async (req, res) => {
    try {
        const { car_id } = req.query;

        // 1. Получаем сами ремонты для машины
        const repairsQuery = `
            SELECT r.*, rt.name as repair_type_name 
            FROM repairs r
            LEFT JOIN repair_types rt ON r.repair_type_id = rt.id
            WHERE r.car_id = $1 
            ORDER BY r.id DESC
        `;
        const repairsResult = await pool.query(repairsQuery, [car_id]);
        const repairs = repairsResult.rows;

        if (repairs.length === 0) {
            return res.json([]);
        }

        const repairIds = repairs.map(r => r.id);

        // 2. Получаем запчасти из repair_items с правильной подтяжкой из receipts
        const itemsQuery = `
            SELECT 
                ri.id,
                ri.repair_id,
                COALESCE(ri.article, z.article, '') AS article, 
                COALESCE(ri.code, z.code, '') AS code, 
                COALESCE(ri.name, z.name, 'Запчасть') AS name, 
                COALESCE(ri.unit, z.unit, 'шт') AS unit,
                ri.quantity,
                ri.price,
                COALESCE(ri.total, (ri.quantity * ri.price), 0) AS sum,
                ri.description,
                COALESCE(
                    ri.receipt_doc, 
                    CONCAT('', rc.doc_number, ' от ', TO_CHAR(rc.date, 'DD.MM.YYYY')), 
                    ''
                ) AS doc_source,
                'item' AS row_type
            FROM repair_items ri
            LEFT JOIN zaphasti z ON ri.zaphast_id = z.id
            LEFT JOIN receipts rc ON ri.receipt_id = rc.id
            WHERE ri.repair_id = ANY($1::int[])
        `;

        // 3. Получаем работы из repair_works
        const worksQuery = `
            SELECT 
                rw.id,
                rw.repair_id,
                '' AS article,
                '' AS code,
                COALESCE(w.name, rw.description, 'Работа') AS name,
                '' AS unit,
                null AS quantity,
                rw.price AS price,
                COALESCE(rw.price, 0) AS sum,
                rw.description,
                COALESCE(i.name, '') AS doc_source,
                'work' AS row_type
            FROM repair_works rw
            LEFT JOIN works w ON rw.work_id = w.id
            LEFT JOIN ispolnitel i ON rw.ispolnitel_id = i.id
            WHERE rw.repair_id = ANY($1::int[])
        `;

        let allItems = [];
        try {
            const [itemsRes, worksRes] = await Promise.all([
                pool.query(itemsQuery, [repairIds]),
                pool.query(worksQuery, [repairIds])
            ]);
            allItems = [...itemsRes.rows, ...worksRes.rows];
        } catch (subErr) {
            console.warn("Ошибка при загрузке деталей/работ ремонта:", subErr.message);
        }

        // 4. Собираем итоговую древовидную структуру
        const dataWithItems = repairs.map(repair => {
            const repairItems = allItems.filter(item => item.repair_id === repair.id);
            return {
                ...repair,
                items: repairItems
            };
        });

        res.json(dataWithItems);

    } catch (err) {
        console.error("Ошибка в /repair_history:", err.message);
        res.status(500).send('Ошибка при получении истории ремонта автомобиля');
    }
});


// ==================== ОСТАТКИ ЗАПЧАСТЕЙ (СУММАРНО ПО СКЛАДАМ) ====================
router.get('/stock_balances', async (req, res) => {
    try {
        const { date, warehouse_id, mol_id } = req.query;

        const queryParams = [];
        let paramIndex = 1;

        let dateConditionReceipts = '';
        let dateConditionMoves = '';
        let dateConditionRepairs = '';
        let dateConditionRealizations = '';

        // Фильтр по дате: берем всё С выбранной даты и до текущего момента (>=)
        if (date && date.trim() !== '' && date !== 'undefined' && date !== 'null') {
            const formattedDate = date.replace('T', ' '); // Корректируем формат из datetime-local
            queryParams.push(formattedDate);
            dateConditionReceipts = `AND r.date >= $${paramIndex}::timestamp`;
            dateConditionMoves = `AND m.date >= $${paramIndex}::timestamp`;
            dateConditionRepairs = `AND rep.doc_date >= $${paramIndex}::timestamp`;
            dateConditionRealizations = `AND r_rel.doc_date >= $${paramIndex}::timestamp`; // Учитываем дату документа реализации
            paramIndex++;
        }

        let extraFilters = '';

        // Фильтр по складу
        if (warehouse_id && warehouse_id.trim() !== '' && warehouse_id !== 'undefined') {
            queryParams.push(warehouse_id);
            extraFilters += ` AND st.warehouse_id = $${paramIndex}`;
            paramIndex++;
        }

        // Фильтр по МОЛ
        if (mol_id && mol_id.trim() !== '' && mol_id !== 'undefined') {
            queryParams.push(mol_id);
            extraFilters += ` AND st.mol_id = $${paramIndex}`;
            paramIndex++;
        }

        const query = `
            WITH warehouse_stocks AS (
                -- 1. Приходы на склады (с выбранной даты по текущий момент)
                SELECT 
                    ri.zaphasti_id,
                    r.warehouse_id,
                    r.mol_id,
                    SUM(ri.quantity) as qty
                FROM receipt_items ri
                JOIN receipts r ON ri.receipt_id = r.id
                WHERE r.warehouse_id IS NOT NULL ${dateConditionReceipts}
                GROUP BY ri.zaphasti_id, r.warehouse_id, r.mol_id

                UNION ALL

                -- 2. Приход от перемещений (куда привезли, с выбранной даты)
                SELECT 
                    mi.zaphasti_id,
                    m.warehouse_to_id AS warehouse_id,
                    m.mol_to_id AS mol_id,
                    SUM(mi.quantity) as qty
                FROM move_items mi
                JOIN moves m ON mi.move_id = m.id
                WHERE m.warehouse_to_id IS NOT NULL ${dateConditionMoves}
                GROUP BY mi.zaphasti_id, m.warehouse_to_id, m.mol_to_id

                UNION ALL

                -- 3. Расход от перемещений (откуда увезли, с выбранной даты)
                SELECT 
                    mi.zaphasti_id,
                    m.warehouse_from_id AS warehouse_id,
                    m.mol_from_id AS mol_id,
                    -SUM(mi.quantity) as qty
                FROM move_items mi
                JOIN moves m ON mi.move_id = m.id
                WHERE m.warehouse_from_id IS NOT NULL ${dateConditionMoves}
                GROUP BY mi.zaphasti_id, m.warehouse_from_id, m.mol_from_id

                UNION ALL

                -- 4. Расход на списания в ремонт (откуда списали, с выбранной даты)
                SELECT 
                    rep_i.zaphast_id AS zaphasti_id,
                    rep.warehouse_id,
                    rep.mol_id,
                    -SUM(rep_i.quantity) as qty
                FROM repair_items rep_i
                JOIN repairs rep ON rep_i.repair_id = rep.id
                WHERE rep.warehouse_id IS NOT NULL ${dateConditionRepairs}
                GROUP BY rep_i.zaphast_id, rep.warehouse_id, rep.mol_id

                UNION ALL

                -- 5. Расход по реализациям (продажи запчастей со складов)
                SELECT 
                    ri_rel.zaphasti_id,
                    r_rel.sklad_id AS warehouse_id,
                    r_rel.mol_id,
                    -SUM(ri_rel.quantity) as qty
                FROM realization_items ri_rel
                JOIN realizations r_rel ON ri_rel.realization_id = r_rel.id
                WHERE r_rel.sklad_id IS NOT NULL ${dateConditionRealizations}
                GROUP BY ri_rel.zaphasti_id, r_rel.sklad_id, r_rel.mol_id
            ),
            aggregated_stocks AS (
                -- Схлопываем всё строго по связке: Товар + Склад + МОЛ
                SELECT 
                    zaphasti_id,
                    warehouse_id,
                    mol_id,
                    SUM(qty) AS total_qty
                FROM warehouse_stocks
                GROUP BY zaphasti_id, warehouse_id, mol_id
            )
            SELECT 
                z.id,
                st.warehouse_id,
                z.article AS artikul,
                z.code,
                z.name,
                p.name AS manufacturer,
                z.price_group,
                z.description,
                COALESCE(s.name, 'Основной склад') AS sklad,
                COALESCE(u.name, 'Не назначен') AS mol,
                COALESCE(st.total_qty, 0) AS qty,
                COALESCE(z.unit, 'шт') AS unit
            FROM zaphasti z
            LEFT JOIN aggregated_stocks st ON z.id = st.zaphasti_id
            LEFT JOIN proizvoditel_zaphasti p ON z.proizvoditel_id = p.id
            LEFT JOIN skladi s ON st.warehouse_id = s.id
            LEFT JOIN mol mol_table ON st.mol_id = mol_table.id
            LEFT JOIN users u ON mol_table.user_id = u.id
            WHERE 1=1 ${extraFilters}
            ORDER BY z.name ASC, s.name ASC;
        `;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);

    } catch (err) {
        console.error("Ошибка в /stock_balances:", err.message);
        res.status(500).json({ error: err.message });
    }
});
// ==================== ИСТОРИЯ ДВИЖЕНИЙ ТОВАРА (НИЖНЯЯ ТАБЛИЦА) ====================
router.get('/stock_batches', async (req, res) => {
    try {
        let { zaphasti_id, warehouse_id } = req.query;

        console.log("📡 [Server] Запрос истории движений /stock_batches получен:", { zaphasti_id, warehouse_id });

        if (!zaphasti_id) {
            return res.status(400).json({ error: 'Не указан zaphasti_id' });
        }

        const hasWarehouse = warehouse_id && warehouse_id !== 'undefined' && warehouse_id !== 'null' && warehouse_id !== '';

        let query = '';
        let queryParams = [];

        // Если выбран склад, показываем историю операций ТОЛЬКО для него
        if (hasWarehouse) {
            query = `
                SELECT 
                    z.article AS artikul,
                    z.code,
                    z.name,
                    docs.document_name,
                    docs.doc_date,
                    docs.description,
                    docs.qty,
                    COALESCE(z.unit, 'шт') AS unit,
                    docs.price AS purchase_price,
                    ROUND(docs.price * 1.3, 2) AS retail_price, 
                    COALESCE(docs.currency, 'Рубль ПМР') AS currency
                FROM (
                    -- Приходы на этот склад
                    SELECT 
                        ri.zaphasti_id,
                        CONCAT('Приход ', r.doc_number) AS document_name,
                        r.date AS doc_date,
                        ri.description,
                        ri.quantity AS qty,
                        ri.price,
                        ri.currency
                    FROM receipt_items ri
                    JOIN receipts r ON ri.receipt_id = r.id
                    WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2

                    UNION ALL

                    -- Входящие перемещения на этот склад
                    SELECT 
                        mi.zaphasti_id,
                        CONCAT('Входящее перемещение №', m.id) AS document_name,
                        m.date AS doc_date,
                        mi.description,
                        mi.quantity AS qty,
                        mi.price,
                        mi.currency
                    FROM move_items mi
                    JOIN moves m ON mi.move_id = m.id
                    WHERE mi.zaphasti_id = $1 AND m.warehouse_to_id = $2

                    UNION ALL

                    -- Исходящие перемещения с этого склада (отрицательное кол-во)
                    SELECT 
                        mi.zaphasti_id,
                        CONCAT('Исходящее перемещение №', m.id) AS document_name,
                        m.date AS doc_date,
                        mi.description,
                        (-1 * mi.quantity) AS qty,
                        mi.price,
                        mi.currency
                    FROM move_items mi
                    JOIN moves m ON mi.move_id = m.id
                    WHERE mi.zaphasti_id = $1 AND m.warehouse_from_id = $2

                    UNION ALL

                    -- Списания в ремонт с этого склада (отрицательное кол-во)
                    SELECT 
                        rep_i.zaphast_id AS zaphasti_id,
                        CONCAT('Списание в ремонт №', rep.id) AS document_name,
                        COALESCE(rep.doc_date, NOW()) AS doc_date,
                        rep_i.description,
                        (-1 * rep_i.quantity) AS qty,
                        rep_i.price,
                        'Рубль ПМР' AS currency
                    FROM repair_items rep_i
                    JOIN repairs rep ON rep_i.repair_id = rep.id
                    WHERE rep_i.zaphast_id = $1 AND rep.warehouse_id = $2

                    UNION ALL

                    -- Реализации (продажи) с этого склада с указанием покупателя (отрицательное кол-во)
                    SELECT 
                        ri_rel.zaphasti_id,
                        CONCAT('Реализация №', r_rel.id, COALESCE(CONCAT(' (Покупатель: ', cust.name_full, ')'), '')) AS document_name,
                        COALESCE(r_rel.doc_date, NOW()) AS doc_date,
                        ri_rel.description,
                        (-1 * ri_rel.quantity) AS qty,
                        ri_rel.purchase_price AS price,
                        'Рубль ПМР' AS currency
                    FROM realization_items ri_rel
                    JOIN realizations r_rel ON ri_rel.realization_id = r_rel.id
                    LEFT JOIN customers cust ON r_rel.customer_id = cust.id
                    WHERE ri_rel.zaphasti_id = $1 AND r_rel.sklad_id = $2
                ) docs
                JOIN zaphasti z ON docs.zaphasti_id = z.id
                ORDER BY docs.doc_date DESC;
            `;
            queryParams = [zaphasti_id, warehouse_id];
        } else {
            // Если склад не выбран, общая история товара по всем складам
            query = `
                SELECT 
                    z.article AS artikul,
                    z.code,
                    z.name,
                    all_docs.document_name,
                    all_docs.doc_date,
                    all_docs.description,
                    all_docs.qty,
                    COALESCE(z.unit, 'шт') AS unit,
                    all_docs.price AS purchase_price,
                    ROUND(all_docs.price * 1.3, 2) AS retail_price, 
                    COALESCE(all_docs.currency, 'Рубль ПМР') AS currency
                FROM (
                    SELECT ri.zaphasti_id, CONCAT('Приход ПР', r.doc_number) AS document_name, r.date AS doc_date, ri.description, ri.quantity AS qty, ri.price, ri.currency
                    FROM receipt_items ri JOIN receipts r ON ri.receipt_id = r.id WHERE ri.zaphasti_id = $1
                    
                    UNION ALL
                    
                    SELECT mi.zaphasti_id, CONCAT('Перемещение №', m.id) AS document_name, m.date AS doc_date, mi.description, mi.quantity AS qty, mi.price, mi.currency
                    FROM move_items mi JOIN moves m ON mi.move_id = m.id WHERE mi.zaphasti_id = $1
                    
                    UNION ALL
                    
                    SELECT rep_i.zaphast_id AS zaphasti_id, CONCAT('Списание в ремонт №', rep.id) AS document_name, COALESCE(rep.doc_date, NOW()) AS doc_date, rep_i.description, (-1 * rep_i.quantity) AS qty, rep_i.price, 'Рубль ПМР' AS currency
                    FROM repair_items rep_i JOIN repairs rep ON rep_i.repair_id = rep.id WHERE rep_i.zaphast_id = $1

                    UNION ALL

                    SELECT ri_rel.zaphasti_id, CONCAT('Реализация №', r_rel.id, COALESCE(CONCAT(' (Покупатель: ', cust.name_full, ')'), '')) AS document_name, COALESCE(r_rel.doc_date, NOW()) AS doc_date, ri_rel.description, (-1 * ri_rel.quantity) AS qty, ri_rel.purchase_price AS price, 'Рубль ПМР' AS currency
                    FROM realization_items ri_rel 
                    JOIN realizations r_rel ON ri_rel.realization_id = r_rel.id 
                    LEFT JOIN customers cust ON r_rel.customer_id = cust.id 
                    WHERE ri_rel.zaphasti_id = $1
                ) all_docs
                JOIN zaphasti z ON all_docs.zaphasti_id = z.id
                ORDER BY all_docs.doc_date DESC;
            `;
            queryParams = [zaphasti_id];
        }

        const result = await pool.query(query, queryParams);
        
        console.log(`📥 [Server] История операций успешно получена. Всего записей: ${result.rows.length}`);
        res.json(result.rows);

    } catch (err) {
        console.error("❌ [Server] Ошибка при получении истории:", err.message);
        res.status(500).json({ error: err.message });
    }
});



// ==================== ДВИЖЕНИЕ ЗАПЧАСТЕЙ (ОБОРОТНАЯ ВЕДОМОСТЬ) ====================
router.get('/stock_movement', async (req, res) => {
    try {
        const { start_date, end_date, warehouse_id, mol_id } = req.query;

        const queryParams = [];
        let paramIndex = 1;

        let dateCondition = '';

        // Фильтр по диапазону дат (если указаны обе или одна из них)
        if (start_date && start_date.trim() !== '' && start_date !== 'undefined' && start_date !== 'null') {
            const formattedStart = start_date.replace('T', ' ');
            queryParams.push(formattedStart);
            dateCondition += ` AND d.date >= $${paramIndex}::timestamp`;
            paramIndex++;
        }

        if (end_date && end_date.trim() !== '' && end_date !== 'undefined' && end_date !== 'null') {
            const formattedEnd = end_date.replace('T', ' ');
            queryParams.push(formattedEnd);
            dateCondition += ` AND d.date <= $${paramIndex}::timestamp`;
            paramIndex++;
        }

        // Дополнительные фильтры по складу и МОЛ
        let extraFilters = '';
        if (warehouse_id && warehouse_id.trim() !== '' && warehouse_id !== 'undefined') {
            queryParams.push(parseInt(warehouse_id, 10));
            extraFilters += ` AND warehouse_id = $${paramIndex}::int`;
            paramIndex++;
        }

        if (mol_id && mol_id.trim() !== '' && mol_id !== 'undefined') {
            queryParams.push(parseInt(mol_id, 10));
            extraFilters += ` AND mol_id = $${paramIndex}::int`;
            paramIndex++;
        }

        const query = `
            WITH all_operations AS (
                -- 1. Приходы (receipts)
                SELECT 
                    ri.zaphasti_id,
                    r.warehouse_id,
                    r.mol_id,
                    r.date,
                    ri.quantity AS qty_in,
                    0 AS qty_out,
                    (ri.quantity * COALESCE(ri.price_rub, ri.price, 0)) AS sum_in,
                    0 AS sum_out
                FROM receipt_items ri
                JOIN receipts r ON ri.receipt_id = r.id
                WHERE r.warehouse_id IS NOT NULL

                UNION ALL

                -- 2. Перемещения - приход (warehouse_to)
                SELECT 
                    mi.zaphasti_id,
                    m.warehouse_to_id AS warehouse_id,
                    m.mol_to_id AS mol_id,
                    m.date,
                    mi.quantity AS qty_in,
                    0 AS qty_out,
                    (mi.quantity * COALESCE(mi.price, 0)) AS sum_in,
                    0 AS sum_out
                FROM move_items mi
                JOIN moves m ON mi.move_id = m.id
                WHERE m.warehouse_to_id IS NOT NULL AND m.is_posted = true

                UNION ALL

                -- 3. Перемещения - расход (warehouse_from)
                SELECT 
                    mi.zaphasti_id,
                    m.warehouse_from_id AS warehouse_id,
                    m.mol_from_id AS mol_id,
                    m.date,
                    0 AS qty_in,
                    mi.quantity AS qty_out,
                    0 AS sum_in,
                    (mi.quantity * COALESCE(mi.price, 0)) AS sum_out
                FROM move_items mi
                JOIN moves m ON mi.move_id = m.id
                WHERE m.warehouse_from_id IS NOT NULL AND m.is_posted = true

                UNION ALL

                -- 4. Списания в ремонт - расход (repair_items)
                SELECT 
                    rep_i.zaphast_id AS zaphasti_id,
                    rep.warehouse_id,
                    rep.mol_id,
                    rep.doc_date AS date,
                    0 AS qty_in,
                    rep_i.quantity AS qty_out,
                    0 AS sum_in,
                    (rep_i.quantity * COALESCE(rep_i.price, 0)) AS sum_out
                FROM repair_items rep_i
                JOIN repairs rep ON rep_i.repair_id = rep.id
                WHERE rep.warehouse_id IS NOT NULL AND rep.is_posted = true

                UNION ALL

                -- 5. Реализации (продажи) - расход (realization_items)
                SELECT 
                    ri_rel.zaphasti_id,
                    r_rel.sklad_id AS warehouse_id,
                    r_rel.mol_id,
                    COALESCE(r_rel.doc_date, NOW()) AS date,
                    0 AS qty_in,
                    ri_rel.quantity AS qty_out,
                    0 AS sum_in,
                    (ri_rel.quantity * COALESCE(ri_rel.purchase_price, 0)) AS sum_out
                FROM realization_items ri_rel
                JOIN realizations r_rel ON ri_rel.realization_id = r_rel.id
                WHERE r_rel.sklad_id IS NOT NULL AND (r_rel.is_posted::text IN ('true', '1', '2'))
            ),
            filtered_ops AS (
                SELECT * FROM all_operations d
                WHERE 1=1 ${extraFilters} ${dateCondition}
            ),
            calculated_turnover AS (
                SELECT 
                    zaphasti_id,
                    warehouse_id,
                    
                    -- Приход за период (суммируем количества и общие суммы по разным ценам партий)
                    SUM(qty_in) AS income_qty,
                    SUM(sum_in) AS income_sum,
                    
                    -- Расход за период (включая перемещения, ремонты и реализации по их реальным ценам)
                    SUM(qty_out) AS outcome_qty,
                    SUM(sum_out) AS outcome_sum

                FROM filtered_ops
                GROUP BY zaphasti_id, warehouse_id
            )
            SELECT 
                z.id AS zaphasti_id,
                t.warehouse_id,
                z.article AS artikul,
                z.code,
                z.name,
                p.name AS manufacturer,
                COALESCE(z.unit, 'шт') AS unit,
                
                COALESCE(t.income_qty, 0) AS income_qty,
                COALESCE(t.income_sum, 0) AS income_sum,
                
                COALESCE(t.outcome_qty, 0) AS outcome_qty,
                COALESCE(t.outcome_sum, 0) AS outcome_sum,
                
                (COALESCE(t.income_qty, 0) - COALESCE(t.outcome_qty, 0)) AS end_qty,
                (COALESCE(t.income_sum, 0) - COALESCE(t.outcome_sum, 0)) AS end_sum,
                
                z.description
            FROM calculated_turnover t
            JOIN zaphasti z ON t.zaphasti_id = z.id
            LEFT JOIN proizvoditel_zaphasti p ON z.proizvoditel_id = p.id
            WHERE (COALESCE(t.income_qty, 0) <> 0 OR COALESCE(t.outcome_qty, 0) <> 0)
            ORDER BY z.name ASC;
        `;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);

    } catch (err) {
        console.error("Ошибка в /stock_movement:", err.message);
        res.status(500).json({ error: err.message });
    }
});
router.get('/part_movement_details', async (req, res) => {
    try {
        const { zaphasti_id, warehouse_id, start_date, end_date } = req.query;

        if (!zaphasti_id) {
            return res.status(400).json({ error: "Не указан zaphasti_id" });
        }

        const queryParams = [zaphasti_id];
        let paramIndex = 2;

        let dateCondition = '';
        if (start_date && start_date.trim() !== '' && start_date !== 'undefined' && start_date !== 'null') {
            queryParams.push(start_date.replace('T', ' '));
            dateCondition += ` AND op_date >= $${paramIndex}::timestamp`;
            paramIndex++;
        }
        if (end_date && end_date.trim() !== '' && end_date !== 'undefined' && end_date !== 'null') {
            queryParams.push(end_date.replace('T', ' '));
            dateCondition += ` AND op_date <= $${paramIndex}::timestamp`;
            paramIndex++;
        }

        let warehouseCondition = '';
        let currentWarehouseId = null;
        if (warehouse_id && warehouse_id.trim() !== '' && warehouse_id !== 'undefined' && warehouse_id !== 'null') {
            currentWarehouseId = parseInt(warehouse_id, 10);
            queryParams.push(currentWarehouseId);
            warehouseCondition += ` AND (warehouse_from_id = $${paramIndex}::int OR warehouse_to_id = $${paramIndex}::int OR sklad_id = $${paramIndex}::int)`;
            paramIndex++;
        }

        const query = `
            WITH all_ops AS (
                -- 1. Приходы (Поставщик -> Склад)
                SELECT 
                    r.date AS op_date,
                    r.doc_number AS doc_num,
                    'Приход запчастей' AS doc_type,
                    COALESCE(p.name, 'Поставщик не указан') AS source_info,
                    CONCAT(COALESCE(s.name, 'Склад #' || r.warehouse_id), ' | МОЛ: ', COALESCE(u.name, 'не назначен')) AS dest_info,
                    ri.quantity AS qty,
                    COALESCE(ri.price_rub, ri.price, 0) AS price,
                    (ri.quantity * COALESCE(ri.price_rub, ri.price, 0)) AS sum,
                    ri.description,
                    NULL::int AS warehouse_from_id,
                    r.warehouse_id AS warehouse_to_id,
                    NULL::int AS sklad_id
                FROM receipt_items ri
                JOIN receipts r ON ri.receipt_id = r.id
                LEFT JOIN postavhik p ON r.supplier_id = p.id
                LEFT JOIN skladi s ON r.warehouse_id = s.id
                LEFT JOIN mol m_mol ON r.mol_id = m_mol.id
                LEFT JOIN users u ON m_mol.user_id = u.id
                WHERE ri.zaphasti_id = $1 AND r.warehouse_id IS NOT NULL

                UNION ALL

                -- 2. Перемещения (Склад-источник -> Склад-получатель)
                SELECT 
                    m.date AS op_date,
                    m.doc_number AS doc_num,
                    'Перемещение' AS doc_type,
                    CONCAT(COALESCE(s_from.name, 'Склад'), ' | МОЛ: ', COALESCE(u_from.name, 'не указан')) AS source_info,
                    CONCAT(COALESCE(s_to.name, 'Склад'), ' | МОЛ: ', COALESCE(u_to.name, 'не указан')) AS dest_info,
                    CASE 
                        WHEN ${currentWarehouseId ? 'm.warehouse_from_id = ' + currentWarehouseId : 'FALSE'} THEN (-1 * mi.quantity)
                        ELSE mi.quantity
                    END AS qty,
                    COALESCE(mi.price, 0) AS price,
                    CASE 
                        WHEN ${currentWarehouseId ? 'm.warehouse_from_id = ' + currentWarehouseId : 'FALSE'} THEN (-1 * mi.quantity * COALESCE(mi.price, 0))
                        ELSE (mi.quantity * COALESCE(mi.price, 0))
                    END AS sum,
                    mi.description,
                    m.warehouse_from_id,
                    m.warehouse_to_id,
                    NULL::int AS sklad_id
                FROM move_items mi
                JOIN moves m ON mi.move_id = m.id
                LEFT JOIN skladi s_from ON m.warehouse_from_id = s_from.id
                LEFT JOIN mol mol_from ON m.mol_from_id = mol_from.id
                LEFT JOIN users u_from ON mol_from.user_id = u_from.id
                LEFT JOIN skladi s_to ON m.warehouse_to_id = s_to.id
                LEFT JOIN mol mol_to ON m.mol_to_id = mol_to.id
                LEFT JOIN users u_to ON mol_to.user_id = u_to.id
                WHERE mi.zaphasti_id = $1 
                  AND (m.warehouse_from_id IS NOT NULL OR m.warehouse_to_id IS NOT NULL) 
                  AND (m.is_posted::text IN ('true', '1', '2'))

                UNION ALL

                -- 3. Списания в ремонт (Склад -> Автомобиль / Ремонт)
                SELECT 
                    rep.doc_date AS op_date,
                    rep.doc_number AS doc_num,
                    'Списание в ремонт' AS doc_type,
                    CONCAT(COALESCE(s_rep.name, 'Склад'), ' | МОЛ: ', COALESCE(u_rep.name, 'не указан')) AS source_info,
                    CONCAT('Авто: ', COALESCE(car.gos_number, 'б/н'), ' ', COALESCE(car.model, '')) AS dest_info,
                    (-1 * ri_rep.quantity) AS qty,
                    COALESCE(ri_rep.price, 0) AS price,
                    (-1 * ri_rep.quantity * COALESCE(ri_rep.price, 0)) AS sum,
                    ri_rep.description,
                    rep.warehouse_id AS warehouse_from_id,
                    NULL::int AS warehouse_to_id,
                    NULL::int AS sklad_id
                FROM repair_items ri_rep
                JOIN repairs rep ON ri_rep.repair_id = rep.id
                LEFT JOIN skladi s_rep ON rep.warehouse_id = s_rep.id
                LEFT JOIN mol mol_rep ON rep.mol_id = mol_rep.id
                LEFT JOIN users u_rep ON mol_rep.user_id = u_rep.id
                LEFT JOIN cars car ON rep.car_id = car.id
                WHERE ri_rep.zaphast_id = $1 
                  AND rep.warehouse_id IS NOT NULL 
                  AND (rep.is_posted::text IN ('true', '1', '2'))

                UNION ALL

                -- 4. Реализации / Продажи (Склад -> Покупатель)
                SELECT 
                    COALESCE(r_rel.doc_date, NOW()) AS op_date,
                    CAST(r_rel.id AS VARCHAR) AS doc_num,
                    'Реализация (продажа)' AS doc_type,
                    CONCAT(COALESCE(s_rel.name, 'Склад'), ' | МОЛ: ', COALESCE(u_rel.name, 'не указан')) AS source_info,
                    CONCAT('Покупатель: ', COALESCE(cust.name_full, 'Не указан')) AS dest_info,
                    (-1 * ri_rel.quantity) AS qty,
                    COALESCE(ri_rel.purchase_price, ri_rel.price, 0) AS price,
                    (-1 * ri_rel.quantity * COALESCE(ri_rel.purchase_price, ri_rel.price, 0)) AS sum,
                    ri_rel.description,
                    r_rel.sklad_id AS warehouse_from_id,
                    NULL::int AS warehouse_to_id,
                    r_rel.sklad_id AS sklad_id
                FROM realization_items ri_rel
                JOIN realizations r_rel ON ri_rel.realization_id = r_rel.id
                LEFT JOIN skladi s_rel ON r_rel.sklad_id = s_rel.id
                LEFT JOIN mol mol_rel ON r_rel.mol_id = mol_rel.id
                LEFT JOIN users u_rel ON mol_rel.user_id = u_rel.id
                LEFT JOIN customers cust ON r_rel.customer_id = cust.id
                WHERE ri_rel.zaphasti_id = $1 
                  AND r_rel.sklad_id IS NOT NULL 
                  AND (r_rel.is_posted::text IN ('true', '1', '2'))
            )
            SELECT op_date, doc_num, doc_type, source_info, dest_info, qty, price, sum, description 
            FROM all_ops
            WHERE 1=1 ${warehouseCondition} ${dateCondition}
            ORDER BY op_date DESC;
        `;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);

    } catch (err) {
        console.error("Ошибка в /part_movement_details:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ==================== ОБЩИЕ ЗАТРАТЫ МАШИНЫ (для вкладки "Общая") ====================
router.get('/car_general', async (req, res) => {
    try {
        const { car_id } = req.query;

        const query = `
            -- 1. Запчасти из ремонтов
            SELECT 
                COALESCE(r.doc_date, NOW()) AS operational_date,
                COALESCE(ri.name, z.name, 'Запчасть') AS name,
                ri.quantity AS qty,
                COALESCE(ri.unit, z.unit, 'шт') AS unit,
                ri.price AS price,
                COALESCE(ri.total, (ri.quantity * ri.price), 0) AS sum,
                ri.description,
                CONCAT('Ремонт ', rt.name, ' от ', TO_CHAR(r.doc_date, 'DD.MM.YYYY')) AS document
            FROM repair_items ri
            JOIN repairs r ON ri.repair_id = r.id
            LEFT JOIN zaphasti z ON ri.zaphast_id = z.id
            LEFT JOIN repair_types rt ON r.repair_type_id = rt.id
            WHERE r.car_id = $1

            UNION ALL

            -- 2. Работы из ремонтов
            SELECT 
                COALESCE(r.doc_date, NOW()) AS operational_date,
                COALESCE(w.name, rw.description, 'Работа') AS name,
                null AS qty,
                '' AS unit,
                rw.price AS price,
                COALESCE(rw.price, 0) AS sum,
                rw.description,
                CONCAT('Ремонт ', rt.name, ' от ', TO_CHAR(r.doc_date, 'DD.MM.YYYY'), ' | Исполнитель: ', i.name) AS document
            FROM repair_works rw
            JOIN repairs r ON rw.repair_id = r.id
            LEFT JOIN works w ON rw.work_id = w.id
            LEFT JOIN repair_types rt ON r.repair_type_id = rt.id
            LEFT JOIN ispolnitel i ON rw.ispolnitel_id = i.id
            WHERE r.car_id = $1

            UNION ALL

            -- 3. Страхование (autostrahovanie)
            SELECT 
                COALESCE(a.date, a.fact_date, NOW()) AS operational_date,
                CONCAT('Страховка полис №', a.doc_number) AS name,
                1 AS qty,
                'шт' AS unit,
                a.sum AS price,
                COALESCE(a.sum, 0) AS sum,
                a.description,
                CONCAT('Автострахование от ', TO_CHAR(COALESCE(a.date, a.fact_date), 'DD.MM.YYYY')) AS document
            FROM autostrahovanie a
            WHERE a.car_id = $1

            UNION ALL

            -- 4. Техосмотр (tehosmotr)
            SELECT 
                COALESCE(t.date, t.fact_date, NOW()) AS operational_date,
                CONCAT('Техосмотр док. №', t.doc_number) AS name,
                1 AS qty,
                'шт' AS unit,
                t.sum AS price,
                COALESCE(t.sum, 0) AS sum,
                t.description,
                CONCAT('Техосмотр от ', TO_CHAR(COALESCE(t.date, t.fact_date), 'DD.MM.YYYY')) AS document
            FROM tehosmotr t
            WHERE t.car_id = $1

            UNION ALL

            -- 5. ДТП (accidents)
            SELECT 
                COALESCE(ac.doc_date, ac.fact_date, ac.detected_date, NOW()) AS operational_date,
                CONCAT('ДТП / Ущерб №', COALESCE(ac.doc_number, ac.id::text)) AS name,
                1 AS qty,
                'шт' AS unit,
                ac.damage_amount AS price,
                COALESCE(ac.damage_amount, 0) AS sum,
                ac.description,
                CONCAT('ДТП от ', TO_CHAR(COALESCE(ac.doc_date, ac.fact_date, ac.detected_date), 'DD.MM.YYYY')) AS document
            FROM accidents ac
            WHERE ac.car_id = $1

            ORDER BY operational_date DESC
        `;

        const result = await pool.query(query, [car_id]);
        res.json(result.rows);

    } catch (err) {
        console.error("Ошибка в /car_general:", err.message);
        res.status(500).send('Ошибка при получении общих данных автомобиля');
    }
});

// ==================== АВТОСТРАХОВАНИЕ КОНКРЕТНОЙ МАШИНЫ (для нижней таблицы) ====================
router.get('/car_autostrahovanie', async (req, res) => {
    try {
        const { car_id } = req.query;
        const query = `
            SELECT a.*, s.name AS autoservice_name 
            FROM autostrahovanie a
            LEFT JOIN autoservices s ON a.autoservice_id = s.id
            WHERE a.car_id = $1 
            ORDER BY a.id DESC
        `;
        const result = await pool.query(query, [car_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении страхований автомобиля');
    }
});

router.get('/accidents', async (req, res) => {
    try {
        const query = `
            SELECT 
                a.*, 
                c.gos_number AS car_number, 
                COALESCE(c.model, cm.name, '—') AS car_model,
                s.name AS status_name
            FROM accidents a
            LEFT JOIN cars c ON a.car_id = c.id
            LEFT JOIN car_models cm ON c.model_id = cm.id
            LEFT JOIN accident_statuses s ON a.status_id = s.id
            ORDER BY a.id DESC
        `;
        
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении списка ДТП:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении данных ДТП' });
    }
});

router.get('/accident_invoices', async (req, res) => {
    try {
        const parentId = req.query.dtp_id || req.query.accident_id;
        
        const query = `
            SELECT * 
            FROM accident_invoices 
            WHERE dtp_id = $1 
            ORDER BY id DESC
        `;
        const result = await pool.query(query, [parentId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении счетов по ДТП');
    }
});


// ==================== ОПЛАЧЕННЫЕ СЧЕТА ПО ДТП (для нижней таблицы) ====================
router.get('/accident_payments', async (req, res) => {
    try {
        const { dtp_id } = req.query;
        const query = `
            SELECT ap.*, 
                   COALESCE(pt.name, ap.payment_type) AS payment_type_name
            FROM accident_payments ap
            LEFT JOIN payment_types pt ON ap.payment_type = pt.id::text
            WHERE ap.dtp_id = $1 
            ORDER BY ap.id DESC
        `;
        const result = await pool.query(query, [dtp_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении оплат по ДТП');
    }
});


// ==================== СОБЫТИЯ ДТП (для нижней таблицы) ====================
router.get('/accident_events', async (req, res) => {
    try {
        const { dtp_id } = req.query;
        const query = `
            SELECT * 
            FROM accident_events 
            WHERE dtp_id = $1 
            ORDER BY id DESC
        `;
        const result = await pool.query(query, [dtp_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении событий ДТП');
    }
});


// Получить все статусы ДТП (для выпадающих списков)
router.get('/accident_statuses', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, name FROM accident_statuses ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при получении статусов ДТП' });
    }
});


// ==================== БЫСТРОЕ ПРОВЕДЕНИЕ ПЕРЕМЕЩЕНИЯ ====================
router.put('/moves/:id/post', async (req, res) => {
    try {
        const { id } = req.params;

        const oldDocRes = await pool.query('SELECT is_posted, fact_date FROM moves WHERE id = $1', [id]);
        if (oldDocRes.rows.length === 0) {
            return res.status(404).json({ error: 'Документ не найден' });
        }
        const oldDoc = oldDocRes.rows[0];

        let factDate = oldDoc.fact_date;
        if (!oldDoc.is_posted || !oldDoc.fact_date) {
            factDate = new Date();
        }

        const updateQuery = `
            UPDATE moves 
            SET is_posted = true, 
                fact_date = $1 
            WHERE id = $2 
            RETURNING *;
        `;

        const result = await pool.query(updateQuery, [factDate, id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка при быстрой проводке перемещения:', err);
        res.status(500).json({ error: 'Ошибка сервера при проведении' });
    }
});


// 2. Запись лога (POST)
router.post('/logs', async (req, res) => {
    const { userId, entity, action, recordId, details } = req.body;
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, entity, action, record_id, details) VALUES ($1, $2, $3, $4, $5)`,
            [userId || null, entity || null, action, recordId || null, details || '']
        );
        return res.json({ success: true });
    } catch (err) {
        console.error('Ошибка записи лога:', err.message);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});



// Эндпоинт для создания записи с деталями и фото автомобиля
    router.post('/car_details', upload.single('photo'), async (req, res) => {
        const client = await pool.connect();
        try {
            const { car_id, date, title, description } = req.body;
            
            // Если файл был прикреплен, формируем путь к нему, иначе null
            const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

            await client.query('BEGIN');

            const query = `
                INSERT INTO car_details (car_id, date, title, description, photo_url)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;
            const values = [car_id, date || new Date(), title, description, photo_url];
            const result = await client.query(query, values);

            await client.query('COMMIT');
            res.json(result.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Ошибка при добавлении car_details:", err.message);
            res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
        } finally {
            client.release();
        }
    });

// Эндпоинт для обновления записи (PUT)
    router.put('/car_details/:id', upload.single('photo'), async (req, res) => {
        const client = await pool.connect();
        try {
            const { id } = req.params;
            const { car_id, date, title, description } = req.body;
            
            // Если прикреплен новый файл, берем его путь, иначе оставляем старый из базы
            const newPhotoUrl = req.file ? `/uploads/${req.file.filename}` : null;

            await client.query('BEGIN');

            let query, values;
            if (newPhotoUrl) {
                query = `
                    UPDATE car_details 
                    SET car_id = $1, date = $2, title = $3, description = $4, photo_url = $5
                    WHERE id = $6
                    RETURNING *;
                `;
                values = [car_id, date || new Date(), title, description, newPhotoUrl, id];
            } else {
                query = `
                    UPDATE car_details 
                    SET car_id = $1, date = $2, title = $3, description = $4
                    WHERE id = $5
                    RETURNING *;
                `;
                values = [car_id, date || new Date(), title, description, id];
            }

            const result = await client.query(query, values);
            await client.query('COMMIT');

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Запись не найдена' });
            }

            res.json(result.rows[0]);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Ошибка при обновлении car_details:", err.message);
            res.status(500).json({ error: 'Ошибка сервера: ' + err.message });
        } finally {
            client.release();
        }
    });

    // Эндпоинт для удаления записи (DELETE)
  const fs = require('fs');
const path = require('path');

router.delete('/car_details/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Находим запись в базе
        const findQuery = 'SELECT photo_url FROM car_details WHERE id = $1';
        const findResult = await pool.query(findQuery, [id]);

        if (findResult.rows.length > 0) {
            const photoUrl = findResult.rows[0].photo_url;
            
            if (photoUrl) {
                const filename = path.basename(photoUrl);
                
                // ИСПРАВЛЕНИЕ ЗДЕСЬ: поднимись из папки routes в корень проекта через '../uploads'
                // Или используй process.cwd() — это всегда папка, откуда запущен сервер (корень проекта!)
                const filePath = path.join(process.cwd(), 'uploads', filename);

                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        // 2. Удаляем из базы
        await pool.query('DELETE FROM car_details WHERE id = $1', [id]);

        res.json({ message: 'Успешно удалено' });
    } catch (err) {
        console.error("Ошибка при удалении:", err.message);
        res.status(500).send('Ошибка сервера при удалении');
    }
});


router.get('/realizations', async (req, res) => {
    try {
        const query = `
            SELECT r.*, 
                   COALESCE(c.name_full, c.name_short, 'Покупатель #' || c.id) AS customer_name,
                   s.name AS sklad_name,
                   COALESCE(u.name, u.login, m.description, 'МОЛ #' || m.id) AS mol_name,
                   COALESCE(
                       TRIM(CONCAT(cc.brand, ' ', cc.model, ' (', cc.gos_number, ')')), 
                       cc.gos_number, 
                       'Авто #' || cc.id
                   ) AS car_display_name,
                   cc.model AS car_model,
                   cc.brand AS car_brand,
                   cc.gos_number AS car_number
            FROM realizations r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN skladi s ON r.sklad_id = s.id
            LEFT JOIN mol m ON r.mol_id = m.id
            LEFT JOIN users u ON m.user_id = u.id
            LEFT JOIN customer_cars cc ON r.car_id = cc.id
            ORDER BY r.id DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении реализаций:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении реализаций' });
    }
});



// ==================== ПОЛУЧИТЬ СПИСОК ЗАПЧАСТЕЙ РЕАЛИЗАЦИИ ====================
router.get('/realization_items', async (req, res) => {
    const { realization_id } = req.query;
    try {
        const query = `
            SELECT ri.*, 
                   COALESCE(ri.name, z.name) AS name,
                   COALESCE(ri.article, z.article) AS article,
                   COALESCE(ri.code, z.code) AS code,
                   COALESCE(ri.unit, z.unit, 'шт') AS unit,
                   COALESCE(ri.quantity, 1) AS quantity,
                   COALESCE(ri.price, 0) AS price,
                   COALESCE(ri.total_rub, 0) AS total_rub,
                   COALESCE(
                       CASE 
                           WHEN r.fact_date IS NOT NULL THEN CONCAT(r.doc_number, ' от ', TO_CHAR(r.fact_date, 'DD.MM.YYYY HH24:MI'))
                           ELSE r.doc_number
                       END, 
                       '—'
                   ) AS income_document
            FROM realization_items ri
            LEFT JOIN zaphasti z ON ri.zaphasti_id = z.id
            LEFT JOIN receipts r ON ri.income_document_id = r.id
            WHERE ri.realization_id = $1
            ORDER BY ri.id DESC
        `;
        const result = await pool.query(query, [realization_id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении запчастей реализации:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении запчастей реализации' });
    }
});



router.get('/get-realization-logs', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                rl.*,
                w.name AS warehouse_name,
                z.name AS part_name,
                COALESCE(z.article, z.code, '—') AS part_article,
                c.gos_number AS car_number,
                COALESCE(c.model, '—') AS car_model,
                COALESCE(cust.name_full, cust.name_short) AS customer_name,
                u.name AS user_name
            FROM realization_logs rl
            LEFT JOIN skladi w ON rl.warehouse_id::text = w.id::text
            LEFT JOIN zaphasti z ON rl.zaphasti_id::text = z.id::text
            LEFT JOIN cars c ON rl.car_id::text = c.id::text
            LEFT JOIN customers cust ON rl.customer_id::text = cust.id::text
            LEFT JOIN users u ON rl.user_id::text = u.id::text
            ORDER BY rl.created_at DESC
            LIMIT 500;
        `;
        const result = await client.query(query);
        return res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения логов реализации:', err.message);
        return res.status(500).json({ error: 'Ошибка получения логов реализации: ' + err.message });
    } finally {
        client.release();
    }
});

// Функция для записи логов реализации в таблицу realization_logs
async function writeRealizationLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO realization_logs (
                action, realization_id, document_number, warehouse_id, car_id, 
                customer_id, zaphasti_id, quantity, price, total_rub, 
                income_document_id, description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
                data.action,
                data.realization_id,
                data.document_number,
                data.warehouse_id,
                data.car_id,
                data.customer_id,
                data.zaphasti_id,
                data.quantity,
                data.price,
                data.total_rub,
                data.income_document_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога реализации (не критично):', logErr.message);
    }
}


// ==================== ДОБАВИТЬ ЗАПЧАСТЬ К РЕАЛИЗАЦИИ (С УЧЕТОМ ВСЕГО И FIFO) ====================
router.post('/realization_items', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[POST REQUEST] Добавление запчасти в реализацию (realization_items) с FIFO`);
    console.log(`[BODY]:`, req.body);

    const { realization_id, zaphasti_id, quantity, description } = req.body;
    const requestedQty = Number(quantity) || 0;

    if (!zaphasti_id || !realization_id) {
        return res.status(400).json({ error: 'Не указан ID запчасти (zaphasti_id) или ID документа реализации (realization_id).' });
    }

    if (requestedQty <= 0) {
        return res.status(400).json({ error: 'Количество запчасти должно быть больше нуля.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Узнаем склад, клиента, номер документа и статус проведения реализации
        const realizationQuery = `SELECT sklad_id, mol_id, customer_id, is_posted, doc_number FROM realizations WHERE id = $1 FOR UPDATE`;
        const realizationRes = await client.query(realizationQuery, [realization_id]);
        
        if (realizationRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Реализация не найдена' });
        }

        const { sklad_id, customer_id, is_posted, doc_number } = realizationRes.rows[0];

        const isDocumentPosted = is_posted === true || is_posted === 'true' || is_posted === 1 || is_posted === '1' || is_posted === 2 || is_posted === '2';
        if (isDocumentPosted) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя добавлять запчасти в уже проведенную реализацию!' });
        }

        if (!sklad_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'В документе реализации не указан склад, с которого списываются запчасти.' });
        }

        // 2. Получаем справочные данные запчасти
        const zaphastiQuery = `SELECT * FROM zaphasti WHERE id = $1`;
        const zaphastiRes = await client.query(zaphastiQuery, [zaphasti_id]);

        if (zaphastiRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Запчасть не найдена' });
        }

        const zap = zaphastiRes.rows[0];

        // 3. Получаем актуальные партии (приходы) и их реальные остатки по FIFO
        // Учитываем: уход на другие склады (перемещения), другие реализации, текущую реализацию в черновике ($3) и ремонты
        const batchesQuery = `
            SELECT 
                r.id AS receipt_id,
                r.doc_number AS receipt_doc_number,
                r.date AS receipt_date,
                ri.price,
                ri.price_rub,
                ri.quantity AS initial_qty,
                (
                    COALESCE((
                        SELECT SUM(mi.quantity) 
                        FROM move_items mi 
                        JOIN moves m ON mi.move_id = m.id 
                        WHERE mi.income_document_id = r.id 
                          AND mi.zaphasti_id = ri.zaphasti_id 
                          AND m.warehouse_from_id = r.warehouse_id 
                          AND m.is_posted = true
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rel_i.quantity) 
                        FROM realization_items rel_i 
                        JOIN realizations rel ON rel_i.realization_id = rel.id 
                        WHERE rel_i.income_document_id = r.id 
                          AND rel_i.zaphasti_id = ri.zaphasti_id 
                          AND rel.sklad_id = r.warehouse_id 
                          AND (rel.is_posted = true OR rel.id = $3)
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rep_i.quantity) 
                        FROM repair_items rep_i 
                        JOIN repairs rep ON rep_i.repair_id = rep.id 
                        WHERE rep_i.receipt_id = r.id 
                          AND rep_i.zaphast_id = ri.zaphasti_id 
                          AND rep.warehouse_id = r.warehouse_id 
                          AND rep.is_posted = true
                    ), 0)
                ) AS spent_qty
            FROM receipt_items ri
            JOIN receipts r ON ri.receipt_id = r.id
            WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2
            ORDER BY r.date ASC, r.id ASC
        `;

        const batchesRes = await client.query(batchesQuery, [zaphasti_id, sklad_id, realization_id]);
        
        let batches = batchesRes.rows.map(b => {
            const initial = Number(b.initial_qty) || 0;
            const spent = Number(b.spent_qty) || 0;
            const available = initial - spent;
            const purchasePrice = Number(b.price_rub !== undefined && b.price_rub !== null ? b.price_rub : b.price) || 0;
            return {
                receipt_id: b.receipt_id,
                doc_number: b.receipt_doc_number || `ПР-${b.receipt_id}`,
                purchase_price: purchasePrice,
                available: available > 0 ? available : 0
            };
        }).filter(b => b.available > 0);

        const totalAvailableStock = batches.reduce((sum, b) => sum + b.available, 0);

        console.log(`[FIFO REALIZATION DEBUG] Запрошено к добавлению: ${requestedQty} шт.`);
        console.log(`[FIFO REALIZATION DEBUG] Реально доступно на складе с учетом текущего документа:`, totalAvailableStock);
        console.log(`[FIFO REALIZATION DEBUG] Доступные партии:`, batches);

        if (requestedQty > totalAvailableStock) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: `Недостаточно товара на складе! Доступно: ${totalAvailableStock > 0 ? totalAvailableStock : 0} шт., а вы пытаетесь добавить: ${requestedQty} шт.` 
            });
        }

        // 4. Скидка клиента
        let discountPercent = 0;
        let discountText = 'Розница (0%)';

        if (customer_id) {
            const customerDiscountQuery = `
                SELECT pd.name, pd.discount_percent 
                FROM customers c
                LEFT JOIN part_discounts pd ON c.discount_part_id = pd.id
                WHERE c.id = $1
            `;
            const cdRes = await client.query(customerDiscountQuery, [customer_id]);
            
            if (cdRes.rows.length > 0 && cdRes.rows[0].discount_percent !== null) {
                discountPercent = Number(cdRes.rows[0].discount_percent) || 0;
                const discountName = cdRes.rows[0].name || 'Скидка';
                discountText = `${discountName} (${discountPercent}%)`;
            }
        }

        let remainingToDistribute = requestedQty;
        const createdRecords = [];

        // 5. Распределение по партиям (FIFO)
        for (const batch of batches) {
            if (remainingToDistribute <= 0) break;

            const takeQty = Math.min(remainingToDistribute, batch.available);
            if (takeQty <= 0) continue;

            const purchase_price = batch.purchase_price;
            const baseRetailPrice = Number((purchase_price * 1.30).toFixed(2));
            const finalPrice = Number((baseRetailPrice * (1 - discountPercent / 100)).toFixed(2));
            const total_rub = Number((takeQty * finalPrice).toFixed(2));

            console.log(`➡️ [FIFO REALIZATION STEP] Партия "${batch.doc_number}" (ID: ${batch.receipt_id}): берем ${takeQty} шт. по закупочной цене ${purchase_price}`);

            const insertQuery = `
                INSERT INTO realization_items (
                    realization_id, zaphasti_id, article, code, name, 
                    quantity, unit, purchase_price, retail_price, price, 
                    discount, total_rub, description, income_document_id
                ) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
                RETURNING *
            `;
            
            const values = [
                realization_id, 
                zaphasti_id, 
                zap.article, 
                zap.code, 
                zap.name, 
                takeQty, 
                zap.unit || 'шт', 
                purchase_price, 
                baseRetailPrice, 
                finalPrice, 
                discountText, 
                total_rub, 
                description || null, 
                batch.receipt_id 
            ];

            const result = await client.query(insertQuery, values);
            const newRecord = result.rows[0];
            createdRecords.push(newRecord);

            // Пишем в realization_logs вместо audit_logs
            await writeRealizationLog(client, req, {
                action: 'INSERT',
                realization_id: realization_id,
                document_number: doc_number || null,
                warehouse_id: sklad_id,
                car_id: null,
                customer_id: customer_id || null,
                zaphasti_id: zaphasti_id,
                quantity: takeQty,
                price: finalPrice,
                total_rub: total_rub,
                income_document_id: batch.receipt_id,
                description: description || `Добавление запчасти (партия: ${batch.doc_number})`
            });

            remainingToDistribute -= takeQty;
        }

        if (remainingToDistribute > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Ошибка распределения партий FIFO: не удалось покрыть запрошенное количество за счет существующих партий прихода.' });
        }

        await client.query('COMMIT');
        console.log(`[SUCCESS] Успешно добавлено строк в реализацию: ${createdRecords.length}`);
        return res.status(201).json(createdRecords.length === 1 ? createdRecords[0] : createdRecords);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при добавлении запчасти: ' + err.message });
    } finally {
        client.release();
    }
});
// ==================== ИЗМЕНИТЬ ЗАПЧАСТЬ В РЕАЛИЗАЦИИ ====================
router.put('/realization_items/:id', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[PUT REQUEST] Изменение запчасти в реализации (realization_items) с FIFO`);
    console.log(`[PARAMS]:`, req.params);
    console.log(`[BODY]:`, req.body);

    const { id } = req.params;
    const { realization_id, zaphasti_id, quantity, description } = req.body;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Находим существующую запись в реализации
        const existingItemRes = await client.query(`SELECT * FROM realization_items WHERE id = $1`, [id]);
        if (existingItemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Позиция запчасти в реализации не найдена' });
        }
        const currentItem = existingItemRes.rows[0];

        // Проверяем, не проведена ли исходная реализация, которой принадлежит эта позиция
        const sourceRealizationCheck = await client.query(`SELECT is_posted, doc_number FROM realizations WHERE id = $1`, [currentItem.realization_id]);
        if (sourceRealizationCheck.rows.length > 0) {
            const { is_posted } = sourceRealizationCheck.rows[0];
            const isSourcePosted = is_posted === true || is_posted === 'true' || is_posted === 1 || is_posted === '1' || is_posted === 2 || is_posted === '2';
            if (isSourcePosted) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Нельзя изменять запчасти в уже проведенной реализации!' });
            }
        }

        // Определяем финальные идентификаторы (если не переданы в теле, берем старые)
        const targetRealizationId = realization_id || currentItem.realization_id;
        const targetZaphastiId = zaphasti_id !== undefined ? zaphasti_id : currentItem.zaphasti_id;
        const requestedQty = quantity !== undefined ? Number(quantity) : Number(currentItem.quantity);

        if (requestedQty <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Количество запчасти должно быть больше нуля.' });
        }

        // Если целевая реализация отличается от исходной, проверяем также и её статус
        if (targetRealizationId !== currentItem.realization_id) {
            const targetRealizationCheck = await client.query(`SELECT is_posted FROM realizations WHERE id = $1`, [targetRealizationId]);
            if (targetRealizationCheck.rows.length > 0) {
                const { is_posted } = targetRealizationCheck.rows[0];
                const isTargetPosted = is_posted === true || is_posted === 'true' || is_posted === 1 || is_posted === '1' || is_posted === 2 || is_posted === '2';
                if (isTargetPosted) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Нельзя переносить запчасти в уже проведенную реализацию!' });
                }
            }
        }

        // 2. Узнаем склад, клиента, номер документа для этой реализации с блокировкой строки FOR UPDATE
        const realizationQuery = `SELECT sklad_id, mol_id, customer_id, is_posted, doc_number FROM realizations WHERE id = $1 FOR UPDATE`;
        const realizationRes = await client.query(realizationQuery, [targetRealizationId]);
        
        if (realizationRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Реализация не найдена' });
        }

        const { sklad_id, customer_id, is_posted, doc_number } = realizationRes.rows[0];

        const isDocumentPosted = is_posted === true || is_posted === 'true' || is_posted === 1 || is_posted === '1' || is_posted === 2 || is_posted === '2';
        if (isDocumentPosted) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя изменять запчасти в уже проведенной реализации!' });
        }

        if (!sklad_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'В документе реализации не указан склад, с которого списываются запчасти.' });
        }

        // 3. Получаем справочные данные запчасти
        const zaphastiQuery = `SELECT * FROM zaphasti WHERE id = $1`;
        const zaphastiRes = await client.query(zaphastiQuery, [targetZaphastiId]);

        if (zaphastiRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Запчасть не найдена в справочнике' });
        }

        const zap = zaphastiRes.rows[0];

        // 4. Получаем партии (приходы) по FIFO с учетом ухода товара во всех документах, 
        // исключая текущую редактируемую позицию из расхода (чтобы вернуть её объем обратно в доступные при расчете)
        const batchesQuery = `
            SELECT 
                r.id AS receipt_id,
                r.doc_number AS receipt_doc_number,
                r.date AS receipt_date,
                ri.price,
                ri.price_rub,
                ri.quantity AS initial_qty,
                (
                    COALESCE((
                        SELECT SUM(mi.quantity) 
                        FROM move_items mi 
                        JOIN moves m ON mi.move_id = m.id 
                        WHERE mi.income_document_id = r.id 
                          AND mi.zaphasti_id = ri.zaphasti_id 
                          AND m.warehouse_from_id = r.warehouse_id 
                          AND m.is_posted = true
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rel_i.quantity) 
                        FROM realization_items rel_i 
                        JOIN realizations rel ON rel_i.realization_id = rel.id 
                        WHERE rel_i.income_document_id = r.id 
                          AND rel_i.zaphasti_id = ri.zaphasti_id 
                          AND rel.sklad_id = r.warehouse_id 
                          AND (rel.is_posted = true OR rel.id = $3)
                          AND rel_i.id != $4
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rep_i.quantity) 
                        FROM repair_items rep_i 
                        JOIN repairs rep ON rep_i.repair_id = rep.id 
                        WHERE rep_i.receipt_id = r.id 
                          AND rep_i.zaphast_id = ri.zaphasti_id 
                          AND rep.warehouse_id = r.warehouse_id 
                          AND rep.is_posted = true
                    ), 0)
                ) AS spent_qty
            FROM receipt_items ri
            JOIN receipts r ON ri.receipt_id = r.id
            WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2
            ORDER BY r.date ASC, r.id ASC
        `;

        const batchesRes = await client.query(batchesQuery, [targetZaphastiId, sklad_id, targetRealizationId, id]);
        
        let batches = batchesRes.rows.map(b => {
            const initial = Number(b.initial_qty) || 0;
            const spent = Number(b.spent_qty) || 0;
            const available = initial - spent;
            const purchasePrice = Number(b.price_rub !== undefined && b.price_rub !== null ? b.price_rub : b.price) || 0;
            return {
                receipt_id: b.receipt_id,
                doc_number: b.receipt_doc_number || `ПР-${b.receipt_id}`,
                purchase_price: purchasePrice,
                available: available > 0 ? available : 0
            };
        }).filter(b => b.available > 0);

        const totalAvailableStock = batches.reduce((sum, b) => sum + b.available, 0);

        console.log(`[FIFO EDIT REALIZATION DEBUG] Запрошено при редактировании: ${requestedQty} шт.`);
        console.log(`[FIFO EDIT REALIZATION DEBUG] Реально доступно на складе с учетом возврата редактируемой строки:`, totalAvailableStock);
        console.log(`[FIFO EDIT REALIZATION DEBUG] Доступные партии:`, batches);

        if (requestedQty > totalAvailableStock) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: `Недостаточно товара на складе! Доступно: ${totalAvailableStock > 0 ? totalAvailableStock : 0} шт., а вы пытаетесь установить: ${requestedQty} шт.` 
            });
        }

        // 5. Скидка клиента
        let discountPercent = 0;
        let discountText = 'Розница (0%)';

        if (customer_id) {
            const customerDiscountQuery = `
                SELECT pd.name, pd.discount_percent 
                FROM customers c
                LEFT JOIN part_discounts pd ON c.discount_part_id = pd.id
                WHERE c.id = $1
            `;
            const cdRes = await client.query(customerDiscountQuery, [customer_id]);
            
            if (cdRes.rows.length > 0 && cdRes.rows[0].discount_percent !== null) {
                discountPercent = Number(cdRes.rows[0].discount_percent) || 0;
                const discountName = cdRes.rows[0].name || 'Скидка';
                discountText = `${discountName} (${discountPercent}%)`;
            }
        }

        // 6. Распределяем по FIFO для получения первой подходящей партии (или берем базовые цены из первой покрывающей партии)
        let remainingToDistribute = requestedQty;
        let chosenPurchasePrice = 0;
        let chosenIncomeDocumentId = null;

        for (const batch of batches) {
            if (remainingToDistribute <= 0) break;
            const takeQty = Math.min(remainingToDistribute, batch.available);
            if (takeQty > 0) {
                if (chosenPurchasePrice === 0) {
                    chosenPurchasePrice = batch.purchase_price;
                    chosenIncomeDocumentId = batch.receipt_id;
                }
                remainingToDistribute -= takeQty;
            }
        }

        if (remainingToDistribute > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Ошибка распределения партий FIFO при редактировании: не удалось покрыть требуемый объем.' });
        }

        const baseRetailPrice = Number((chosenPurchasePrice * 1.30).toFixed(2));
        const finalPrice = Number((baseRetailPrice * (1 - discountPercent / 100)).toFixed(2));
        const total_rub = Number((requestedQty * finalPrice).toFixed(2));
        const finalDescription = description !== undefined ? description : currentItem.description;

        // 7. Обновляем запись в базе
        const updateQuery = `
            UPDATE realization_items 
            SET realization_id = $1, 
                zaphasti_id = $2, 
                article = $3, 
                code = $4, 
                name = $5, 
                quantity = $6, 
                unit = $7, 
                purchase_price = $8, 
                retail_price = $9, 
                price = $10, 
                discount = $11, 
                total_rub = $12, 
                description = $13, 
                income_document_id = $14
            WHERE id = $15
            RETURNING *
        `;
        
        const values = [
            targetRealizationId, 
            targetZaphastiId, 
            zap.article, 
            zap.code, 
            zap.name, 
            requestedQty, 
            zap.unit || 'шт', 
            chosenPurchasePrice, 
            baseRetailPrice, 
            finalPrice, 
            discountText, 
            total_rub, 
            finalDescription, 
            chosenIncomeDocumentId,
            id
        ];

        const result = await client.query(updateQuery, values);

        // 8. Записываем лог в realization_logs вместо audit_logs
        await writeRealizationLog(client, req, {
            action: 'UPDATE',
            realization_id: targetRealizationId,
            document_number: doc_number || null,
            warehouse_id: sklad_id,
            car_id: null,
            customer_id: customer_id || null,
            zaphasti_id: targetZaphastiId,
            quantity: requestedQty,
            price: finalPrice,
            total_rub: total_rub,
            income_document_id: chosenIncomeDocumentId,
            description: finalDescription || `Изменение запчасти (позиция ID: ${id})`
        });

        await client.query('COMMIT');
        console.log(`[SUCCESS] Успешно обновлена строка в реализации ID: ${id}`);
        return res.json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при обновлении запчасти: ' + err.message });
    } finally {
        client.release();
    }
});
// Функция для записи логов реализации в таблицу realization_logs
async function writeRealizationLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO realization_logs (
                action, realization_id, document_number, warehouse_id, car_id, 
                customer_id, zaphasti_id, quantity, price, total_rub, 
                income_document_id, description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
                data.action,
                data.realization_id,
                data.document_number,
                data.warehouse_id,
                data.car_id,
                data.customer_id,
                data.zaphasti_id,
                data.quantity,
                data.price,
                data.total_rub,
                data.income_document_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога реализации (не критично):', logErr.message);
    }
}

// ==================== УДАЛИТЬ ЗАПЧАСТЬ ИЗ РЕАЛИЗАЦИИ ====================
router.delete('/realization_items/:id', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[DELETE REQUEST] Удаление запчасти из реализации (realization_items)`);
    console.log(`[PARAMS]:`, req.params);
    console.log(`[QUERY]:`, req.query);

    const { id } = req.query;
    const itemId = req.params.id || id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Находим удаляемую позицию, чтобы узнать, к какому документу она принадлежит
        const existingItemRes = await client.query(`SELECT * FROM realization_items WHERE id = $1`, [itemId]);
        if (existingItemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        const currentItem = existingItemRes.rows[0];

        // 2. Проверяем, не проведена ли реализация, которой принадлежит эта позиция, а также получаем склад, клиента и номер документа
        const realizationCheck = await client.query(`SELECT sklad_id, customer_id, is_posted, doc_number FROM realizations WHERE id = $1`, [currentItem.realization_id]);
        
        let sklad_id = null;
        let customer_id = null;
        let doc_number = null;

        if (realizationCheck.rows.length > 0) {
            const realizationData = realizationCheck.rows[0];
            sklad_id = realizationData.sklad_id;
            customer_id = realizationData.customer_id;
            doc_number = realizationData.doc_number;

            const { is_posted } = realizationData;
            const isPosted = is_posted === true || is_posted === 'true' || is_posted === 1 || is_posted === '1' || is_posted === 2 || is_posted === '2';
            if (isPosted) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Нельзя удалять запчасти из уже проведенной реализации!' });
            }
        }

        // 3. Удаляем позицию
        const deleteQuery = `DELETE FROM realization_items WHERE id = $1 RETURNING *`;
        const result = await client.query(deleteQuery, [itemId]);

        // 4. Записываем лог в realization_logs вместо audit_logs
        await writeRealizationLog(client, req, {
            action: 'DELETE',
            realization_id: currentItem.realization_id,
            document_number: doc_number || null,
            warehouse_id: sklad_id,
            car_id: null,
            customer_id: customer_id || null,
            zaphasti_id: currentItem.zaphasti_id,
            quantity: currentItem.quantity,
            price: currentItem.price,
            total_rub: currentItem.total_rub,
            income_document_id: currentItem.income_document_id || null,
            description: `Удалена запчасть ID ${currentItem.zaphasti_id}, количество: ${currentItem.quantity}`
        });

        await client.query('COMMIT');
        console.log(`[SUCCESS] Успешно удалена строка из реализации ID: ${itemId}`);
        return res.json({ success: true, deleted: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при удалении запчасти: ' + err.message });
    } finally {
        client.release();
    }
});
// Функция для записи логов реализации в таблицу realization_logs
async function writeRealizationLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO realization_logs (
                action, realization_id, document_number, warehouse_id, car_id, 
                customer_id, zaphasti_id, quantity, price, total_rub, 
                income_document_id, description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
                data.action,
                data.realization_id,
                data.document_number,
                data.warehouse_id,
                data.car_id,
                data.customer_id,
                data.zaphasti_id,
                data.quantity,
                data.price,
                data.total_rub,
                data.income_document_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога реализации (не критично):', logErr.message);
    }
}


// ==================== ПОЛУЧИТЬ СПИСОК УСЛУГ РЕАЛИЗАЦИИ ====================
router.get('/realization_works', async (req, res) => {
    const { realization_id } = req.query;
    try {
        const query = `
            SELECT rw.*, 
                   COALESCE(rw.name, vr.name) AS name,
                   COALESCE(rw.retail_price, vr.price, 0) AS retail_price
            FROM realization_works rw
            LEFT JOIN vidy_rabot vr ON rw.vidy_rabot_id = vr.id
            WHERE rw.realization_id = $1 
            ORDER BY rw.id DESC
        `;
        const result = await pool.query(query, [realization_id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении услуг реализации:', err);
        res.status(500).json({ error: 'Ошибка сервера при получении услуг реализации' });
    }
});
// ==================== ДОБАВИТЬ УСЛУГУ В РЕАЛИЗАЦИЮ ====================
router.post('/realization_works', async (req, res) => {
    const { realization_id, vidy_rabot_id, quantity, price: userPrice, description } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Узнаем клиента и статус проведения реализации с блокировкой строки
        const realizationRes = await client.query(
            `SELECT customer_id, is_posted FROM realizations WHERE id = $1 FOR UPDATE`, 
            [realization_id]
        );
        
        if (realizationRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Реализация не найдена' });
        }

        const { customer_id, is_posted } = realizationRes.rows[0];

        // Проверяем, проведена ли реализация
        if (is_posted === true || is_posted === 'true' || is_posted === 2) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя добавлять услуги в уже проведенную реализацию!' });
        }

        const requestedQty = Number(quantity) || 1;

        // 2. Берем наименование и базовую розничную цену из справочника видов работ (vidy_rabot)
        const workRes = await client.query(`SELECT name, price FROM vidy_rabot WHERE id = $1`, [vidy_rabot_id]);
        if (workRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Вид работы не найден в справочнике' });
        }

        const work = workRes.rows[0];
        const retailPrice = Number(work.price) || 0; // Базовая розница из справочника

        // 3. Узнаем скидку клиента НА УСЛУГИ из service_discounts по полю discount_services из customers
        let discountPercent = 0;
        let discountText = 'Розница (0%)';

        if (customer_id) {
            const cdRes = await client.query(`
                SELECT sd.name, sd.discount_percent 
                FROM customers c
                LEFT JOIN service_discounts sd ON c.discount_services = sd.name
                WHERE c.id = $1
            `, [customer_id]);
            
            if (cdRes.rows.length > 0 && cdRes.rows[0].discount_percent !== null) {
                discountPercent = Number(cdRes.rows[0].discount_percent) || 0;
                const discountName = cdRes.rows[0].name || 'Скидка';
                discountText = `${discountName} (${discountPercent}%)`;
            }
        }

        // 4. Считаем цену реализации (если пользователь ввел вручную — берем её, иначе считаем со скидкой)
        let realizationPrice;
        if (userPrice !== undefined && userPrice !== null && String(userPrice).trim() !== '') {
            realizationPrice = Number(userPrice);
        } else {
            realizationPrice = Number((retailPrice * (1 - discountPercent / 100)).toFixed(2));
        }

        const total_rub = Number((requestedQty * realizationPrice).toFixed(2));

        // 5. Вставляем в базу
        const insertQuery = `
            INSERT INTO realization_works (
                realization_id, vidy_rabot_id, name, quantity, retail_price, price, discount, total_rub, description
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            RETURNING *
        `;
        
        const values = [
            realization_id, 
            vidy_rabot_id,
            work.name, 
            requestedQty, 
            retailPrice,        // Розница из справочника
            realizationPrice,   // Цена реализации (ручная или со скидкой)
            discountText,       // Текст скидки
            total_rub,          // Сумма РУБ
            description
        ];

        const result = await client.query(insertQuery, values);

        await client.query('COMMIT');
        res.json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при добавлении услуги:', err);
        res.status(500).json({ error: 'Ошибка сервера при добавлении услуги: ' + err.message });
    } finally {
        client.release();
    }
});


// ==================== ИЗМЕНИТЬ УСЛУГУ В РЕАЛИЗАЦИИ ====================
router.put('/realization_works/:id', async (req, res) => {
    const { id } = req.params;
    const { realization_id, vidy_rabot_id, quantity, price: userPrice, description } = req.body;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Проверяем существование записи услуги
        const existingWorkRes = await client.query(`SELECT * FROM realization_works WHERE id = $1`, [id]);
        if (existingWorkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Услуга в реализации не найдена' });
        }
        const currentWork = existingWorkRes.rows[0];

        // Проверяем статус исходной реализации
        const sourceRealizationCheck = await client.query(`SELECT is_posted FROM realizations WHERE id = $1`, [currentWork.realization_id]);
        if (sourceRealizationCheck.rows.length > 0) {
            const { is_posted } = sourceRealizationCheck.rows[0];
            if (is_posted === true || is_posted === 'true' || is_posted === 2) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Нельзя изменять услуги в уже проведенной реализации!' });
            }
        }

        // Определяем реализацию (если realization_id не передан в теле, берем из существующей записи)
        const targetRealizationId = realization_id || currentWork.realization_id;

        // Если целевая реализация отличается от исходной, проверяем её статус
        if (targetRealizationId !== currentWork.realization_id) {
            const targetRealizationCheck = await client.query(`SELECT is_posted FROM realizations WHERE id = $1`, [targetRealizationId]);
            if (targetRealizationCheck.rows.length > 0) {
                const { is_posted } = targetRealizationCheck.rows[0];
                if (is_posted === true || is_posted === 'true' || is_posted === 2) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Нельзя переносить услуги в уже проведенную реализацию!' });
                }
            }
        }

        // 2. Узнаем клиента и статус проведения реализации с блокировкой
        const realizationRes = await client.query(
            `SELECT customer_id, is_posted FROM realizations WHERE id = $1 FOR UPDATE`, 
            [targetRealizationId]
        );
        
        if (realizationRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Реализация не найдена' });
        }

        const { customer_id, is_posted } = realizationRes.rows[0];

        // Дополнительная проверка статуса целевой реализации
        if (is_posted === true || is_posted === 'true' || is_posted === 2) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя изменять услуги в уже проведенной реализации!' });
        }

        const requestedQty = quantity !== undefined ? Number(quantity) : Number(currentWork.quantity);
        const targetVidyRabotId = vidy_rabot_id !== undefined ? vidy_rabot_id : currentWork.vidy_rabot_id;

        // 3. Берем наименование и базовую розничную цену из справочника видов работ
        const workRes = await client.query(`SELECT name, price FROM vidy_rabot WHERE id = $1`, [targetVidyRabotId]);
        if (workRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Вид работы не найден в справочнике' });
        }

        const work = workRes.rows[0];
        const retailPrice = Number(work.price) || 0;

        // 4. Узнаем скидку клиента НА УСЛУГИ
        let discountPercent = 0;
        let discountText = 'Розница (0%)';

        if (customer_id) {
            const cdRes = await client.query(`
                SELECT sd.name, sd.discount_percent 
                FROM customers c
                LEFT JOIN service_discounts sd ON c.discount_services = sd.name
                WHERE c.id = $1
            `, [customer_id]);
            
            if (cdRes.rows.length > 0 && cdRes.rows[0].discount_percent !== null) {
                discountPercent = Number(cdRes.rows[0].discount_percent) || 0;
                const discountName = cdRes.rows[0].name || 'Скидка';
                discountText = `${discountName} (${discountPercent}%)`;
            }
        }

        // 5. Считаем цену реализации
        let realizationPrice;
        if (userPrice !== undefined && userPrice !== null && String(userPrice).trim() !== '') {
            realizationPrice = Number(userPrice);
        } else {
            realizationPrice = Number((retailPrice * (1 - discountPercent / 100)).toFixed(2));
        }

        const total_rub = Number((requestedQty * realizationPrice).toFixed(2));
        const finalDescription = description !== undefined ? description : currentWork.description;

        // 6. Обновляем запись в базе
        const updateQuery = `
            UPDATE realization_works 
            SET realization_id = $1, 
                vidy_rabot_id = $2, 
                name = $3, 
                quantity = $4, 
                retail_price = $5, 
                price = $6, 
                discount = $7, 
                total_rub = $8, 
                description = $9
            WHERE id = $10
            RETURNING *
        `;
        
        const values = [
            targetRealizationId, 
            targetVidyRabotId,
            work.name, 
            requestedQty, 
            retailPrice, 
            realizationPrice, 
            discountText, 
            total_rub, 
            finalDescription,
            id
        ];

        const result = await client.query(updateQuery, values);

        await client.query('COMMIT');
        res.json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при обновлении услуги:', err);
        res.status(500).json({ error: 'Ошибка сервера при обновлении услуги: ' + err.message });
    } finally {
        client.release();
    }
});
// ==================== УДАЛИТЬ УСЛУГУ ИЗ РЕАЛИЗАЦИИ ====================
router.delete('/realization_works/:id', async (req, res) => {
    const { id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Проверяем существование записи перед удалением
        const checkRes = await client.query(`SELECT id FROM realization_works WHERE id = $1`, [id]);
        if (checkRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Услуга в реализации не найдена' });
        }

        // Удаляем запись (триггер в БД автоматически пересчитаетсуммы в realizations)
        await client.query(`DELETE FROM realization_works WHERE id = $1`, [id]);

        await client.query('COMMIT');
        res.json({ success: true, message: 'Услуга успешно удалена' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Ошибка при удалении услуги:', err);
        res.status(500).json({ error: 'Ошибка сервера при удалении услуги: ' + err.message });
    } finally {
        client.release();
    }
});

router.get('/money_receipts_by_sklad', async (req, res) => {
    try {
        const query = `
            SELECT 
                sk.id AS id,
                sk.id AS sklad_id,
                COALESCE(sk.name, 'Основной склад')::text AS sklad_name,
                COUNT(DISTINCT real.id)::integer AS total_orders,
                COALESCE(SUM(sub_i.total_qty), 0)::numeric AS total_qty,
                COALESCE(SUM(sub_i.parts_sum), 0)::numeric AS parts_sum,
                COALESCE(SUM(sub_w.works_sum), 0)::numeric AS works_sum,
                (COALESCE(SUM(sub_i.parts_sum), 0) + COALESCE(SUM(sub_w.works_sum), 0))::numeric AS total_realization_sum
            FROM realizations real
            LEFT JOIN skladi sk ON real.sklad_id = sk.id
            -- Подзапрос для суммирования запчастей по конкретной реализации
            LEFT JOIN (
                SELECT ri.realization_id, SUM(ri.quantity) AS total_qty, SUM(ri.total_rub) AS parts_sum
                FROM realization_items ri
                GROUP BY ri.realization_id
            ) sub_i ON real.id = sub_i.realization_id
            -- Подзапрос для суммирования услуг по конкретной реализации
            LEFT JOIN (
                SELECT rw.realization_id, SUM(rw.total_rub) AS works_sum
                FROM realization_works rw
                GROUP BY rw.realization_id
            ) sub_w ON real.id = sub_w.realization_id
            WHERE real.is_posted = true
            GROUP BY sk.id, sk.name
            ORDER BY total_realization_sum DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения аналитики по складам:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.get('/money_receipts', async (req, res) => {
    try {
        const { sklad_id } = req.query;

        const query = `
            SELECT 
                real.id AS realization_id,
                real.doc_number::text AS doc_number,
                real.doc_date AS date,
                c.id AS customer_id,
                COALESCE(c.name_full, c.name_short, 'Розничный покупатель')::text AS counterparty_name,
                sk.name::text AS sklad_name,
                1 AS total_orders,
                COALESCE(sub_i.total_qty, 0)::numeric AS total_qty,
                COALESCE(sub_i.total_purchase_sum, 0)::numeric AS total_purchase_sum,
                COALESCE(sub_i.total_retail_sum, 0)::numeric AS total_retail_sum,
                COALESCE(sub_i.parts_sum, 0)::numeric AS parts_sum,
                COALESCE(sub_w.works_sum, 0)::numeric AS works_sum,
                (COALESCE(sub_i.parts_sum, 0) + COALESCE(sub_w.works_sum, 0))::numeric AS total_realization_sum
            FROM realizations real
            JOIN customers c ON real.customer_id = c.id
            LEFT JOIN skladi sk ON real.sklad_id = sk.id
            LEFT JOIN (
                SELECT 
                    ri.realization_id, 
                    SUM(ri.quantity) AS total_qty, 
                    SUM(ri.purchase_price * ri.quantity) AS total_purchase_sum,
                    SUM(ri.retail_price * ri.quantity) AS total_retail_sum,
                    SUM(ri.total_rub) AS parts_sum
                FROM realization_items ri
                GROUP BY ri.realization_id
            ) sub_i ON real.id = sub_i.realization_id
            LEFT JOIN (
                SELECT rw.realization_id, SUM(rw.total_rub) AS works_sum
                FROM realization_works rw
                GROUP BY rw.realization_id
            ) sub_w ON real.id = sub_w.realization_id
            WHERE real.is_posted = true
              AND ($1::integer IS NULL OR real.sklad_id = $1)
            ORDER BY real.doc_date DESC;
        `;
        const result = await pool.query(query, [sklad_id || null]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.get('/money_receipts_detail', async (req, res) => {
    try {
        const { realization_id, customer_id, sklad_id } = req.query;
        
        if (!realization_id && !customer_id) {
            return res.json([]);
        }

        const query = `
            SELECT 
                ri.id,
                real.doc_number::text AS doc_number,
                real.doc_date AS date,
                ri.code::text AS product_code,
                ri.name::text AS product_name,
                ri.quantity::numeric AS quantity,
                ri.purchase_price::numeric AS purchase_price,
                ri.retail_price::numeric AS retail_price,
                ri.price::numeric AS final_unit_price,
                ri.total_rub::numeric AS total_rub
            FROM realization_items ri
            JOIN realizations real ON ri.realization_id = real.id
            WHERE real.is_posted = true 
              AND ($1::integer IS NULL OR real.id = $1)
              AND ($2::integer IS NULL OR real.customer_id = $2)
              AND ($3::integer IS NULL OR real.sklad_id = $3)
            ORDER BY real.doc_date DESC, ri.id ASC;
        `;
        
        const result = await pool.query(query, [
            realization_id || null, 
            customer_id || null, 
            sklad_id || null
        ]);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении детальных позиций:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
router.get('/money_receipts_works_detail', async (req, res) => {
    try {
        const { customer_id, sklad_id, realization_id } = req.query;
        
        const query = `
            SELECT 
                rw.id,
                real.doc_number::text AS doc_number,
                real.doc_date AS date,
                rw.name::text AS work_name,
                rw.quantity::numeric AS quantity,
                rw.retail_price::numeric AS retail_price,
                rw.price::numeric AS final_unit_price,
                COALESCE(rw.discount, 'Розница (0%)')::text AS discount_label,
                rw.total_rub::numeric AS total_rub,
                COALESCE(rw.description, '')::text AS description
            FROM realization_works rw
            JOIN realizations real ON rw.realization_id = real.id
            WHERE real.is_posted = true 
              AND ($1::integer IS NULL OR real.customer_id = $1)
              AND ($2::integer IS NULL OR real.sklad_id = $2)
              AND ($3::integer IS NULL OR rw.realization_id = $3)
            ORDER BY real.doc_date DESC;
        `;
        
        const result = await pool.query(query, [
            customer_id || null, 
            sklad_id || null, 
            realization_id || null
        ]);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка при получении детальных услуг:', err.message);
        res.status(500).json({ error: 'Ошибка сервера', details: err.message });
    }
});




// 1. Расходы по складам (уровень 1)
router.get('/expenses_by_sklad', async (req, res) => {
    try {
        const query = `
            SELECT 
                sk.id AS id,
                sk.id AS sklad_id,
                COALESCE(sk.name, 'Основной склад')::text AS sklad_name,
                COUNT(DISTINCT rec.id)::integer AS total_receipts,
                COALESCE(SUM(sub_i.total_qty), 0)::numeric AS total_qty,
                COALESCE(SUM(sub_i.total_sum), 0)::numeric AS total_expense_sum
            FROM skladi sk
            LEFT JOIN receipts rec ON rec.warehouse_id = sk.id AND rec.is_posted = true
            LEFT JOIN (
                SELECT ri.receipt_id, SUM(ri.quantity) AS total_qty, SUM(ri.total_rub) AS total_sum
                FROM receipt_items ri
                GROUP BY ri.receipt_id
            ) sub_i ON rec.id = sub_i.receipt_id
            GROUP BY sk.id, sk.name
            ORDER BY total_expense_sum DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения расходов по складам:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// 2. Список поставщиков для конкретного склада (уровень 2)
router.get('/expenses_by_suppliers', async (req, res) => {
    try {
        const { sklad_id } = req.query;

        const listQuery = `
            SELECT 
                p.id AS id,
                p.id AS postavhik_id,
                COALESCE(p.name, 'Основной поставщик')::text AS postavhik_name,
                sk.name::text AS sklad_name,
                COUNT(DISTINCT rec.id)::integer AS total_receipts,
                COALESCE(SUM(sub_i.total_qty), 0)::numeric AS total_qty,
                COALESCE(SUM(sub_i.total_sum), 0)::numeric AS total_expense_sum
            FROM receipts rec
            JOIN postavhik p ON rec.supplier_id = p.id
            LEFT JOIN skladi sk ON rec.warehouse_id = sk.id
            LEFT JOIN (
                SELECT 
                    ri.receipt_id, 
                    SUM(ri.quantity) AS total_qty, 
                    SUM(ri.total_rub) AS total_sum
                FROM receipt_items ri
                GROUP BY ri.receipt_id
            ) sub_i ON rec.id = sub_i.receipt_id
            WHERE rec.is_posted = true
              AND ($1::integer IS NULL OR rec.warehouse_id = $1::integer)
            GROUP BY p.id, p.name, sk.name
            ORDER BY total_expense_sum DESC;
        `;
        
        const sIdList = (sklad_id && sklad_id !== '' && sklad_id !== 'undefined') ? sklad_id : null;
        const listResult = await pool.query(listQuery, [sIdList]);
        res.json(listResult.rows);

    } catch (err) {
        console.error('Ошибка получения расходов по поставщикам:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// 3. Список накладных по поставщику и складу (уровень 3)
router.get('/expenses_by_receipts', async (req, res) => {
    try {
        const { sklad_id, postavhik_id } = req.query;

        let query = `
            SELECT 
                rec.id AS id,
                rec.id AS receipt_id,
                COALESCE(rec.doc_number, 'Без номера')::text AS doc_number,
                p.id AS postavhik_id,
                COALESCE(p.name, 'Основной поставщик')::text AS postavhik_name,
                sk.name::text AS sklad_name,
                rec.date,
                COALESCE(sub_i.total_qty, 0)::numeric AS total_qty,
                COALESCE(sub_i.total_sum, 0)::numeric AS total_expense_sum
            FROM receipts rec
            JOIN postavhik p ON rec.supplier_id = p.id
            LEFT JOIN skladi sk ON rec.warehouse_id = sk.id
            LEFT JOIN (
                SELECT 
                    ri.receipt_id, 
                    SUM(ri.quantity) AS total_qty, 
                    SUM(ri.total_rub) AS total_sum
                FROM receipt_items ri
                GROUP BY ri.receipt_id
            ) sub_i ON rec.id = sub_i.receipt_id
            WHERE rec.is_posted = true
        `;

        const queryParams = [];

        const sId = (sklad_id && sklad_id !== '' && sklad_id !== 'undefined') ? sklad_id : null;
        if (sId) {
            queryParams.push(sId);
            query += ` AND rec.warehouse_id = $${queryParams.length}`;
        }

        const pId = (postavhik_id && postavhik_id !== '' && postavhik_id !== 'undefined') ? postavhik_id : null;
        if (pId) {
            queryParams.push(pId);
            query += ` AND rec.supplier_id = $${queryParams.length}`;
        }

        query += ` ORDER BY rec.date DESC;`;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Ошибка получения списка накладных (expenses_by_receipts):', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Детали (позиции) конкретной накладной (уровень 4 / таблица деталей)
router.get('/expense_items', async (req, res) => {
    try {
        const postavhikId = req.query.postavhik_id;
        const skladId = req.query.sklad_id;
        const expenseId = req.query.expense_id || req.query.receipt_id;

        let query = `
            SELECT 
                ri.id AS id,
                COALESCE(z.name, 'Запчасть')::text AS part_name,
                COALESCE(z.article, '—')::text AS article,
                ri.quantity::numeric AS quantity,
                ri.price_rub::numeric AS purchase_price,
                ri.total_rub::numeric AS total_rub
            FROM receipt_items ri
            JOIN receipts rec ON ri.receipt_id = rec.id
            LEFT JOIN zaphasti z ON ri.zaphasti_id = z.id
            WHERE rec.is_posted = true
        `;

        const queryParams = [];

        if (expenseId) {
            queryParams.push(expenseId);
            query += ` AND ri.receipt_id = $${queryParams.length}`;
        }
        
        if (postavhikId) {
            queryParams.push(postavhikId);
            query += ` AND rec.supplier_id = $${queryParams.length}`;
        }

        const sId = (skladId && skladId !== '' && skladId !== 'undefined') ? skladId : null;
        if (sId) {
            queryParams.push(sId);
            query += ` AND rec.warehouse_id = $${queryParams.length}`;
        }

        query += ` ORDER BY ri.id ASC;`;

        const result = await pool.query(query, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Ошибка получения деталей расходов (expense_items):', err);
        res.status(500).json({ error: err.message });
    }
});




    
// 1. Получение журнала операций для приходов из таблицы receipt_logs (GET)
router.get('/get-receipt-logs', async (req, res) => {
    try {
        let query = `
            SELECT 
                'receipt' AS operation_type,
                rl.receipt_id AS doc_id,
                COALESCE(r.doc_number, '—') AS doc_number,
                rl.created_at AS created_at,
                COALESCE(u.name, u.login, 'Система') AS user_name,
                s.name AS warehouse_to,
                NULL AS warehouse_from,
                p.name AS counterparty,
                COALESCE(z.name, 'Документ прихода') AS part_name,
                COALESCE(z.article, '—') AS part_article,
                rl.quantity AS quantity,
                rl.price AS price,
                rl.total_rub AS total_amount,
                rl.action AS action,
                CONCAT(
                    'Приход №', COALESCE(r.doc_number, '—'), 
                    CASE WHEN p.name IS NOT NULL THEN CONCAT(' от ', p.name) ELSE '' END,
                    CASE 
                        WHEN rl.action = 'INSERT' THEN ' [Добавлена позиция / Документ создан]'
                        WHEN rl.action = 'UPDATE' THEN ' [Изменена позиция / Документ]'
                        WHEN rl.action = 'DELETE' THEN ' [Удалена позиция из прихода]'
                        ELSE CONCAT(' [', rl.action, ']')
                    END
                ) AS reason
            FROM receipt_logs rl
            LEFT JOIN receipts r ON rl.receipt_id = r.id
            LEFT JOIN zaphasti z ON rl.zaphasti_id = z.id
            LEFT JOIN skladi s ON rl.warehouse_id = s.id
            LEFT JOIN postavhik p ON rl.supplier_id = p.id
            LEFT JOIN users u ON rl.user_id = u.id
            ORDER BY rl.created_at DESC
            LIMIT 200
        `;

        const result = await pool.query(query);
        return res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения журнала приходов:', err.message);
        return res.status(500).json({ error: 'Ошибка сервера при получении логов приходов: ' + err.message });
    }
});

router.get('/get-move-logs', async (req, res) => {
    try {
        const query = `
            SELECT 
                ml.*,
                z.name AS part_name,
                z.article AS part_article,
                u.name AS user_name,
                wh_from.name AS warehouse_from_name,
                wh_to.name AS warehouse_to_name
            FROM move_logs ml
            LEFT JOIN zaphasti z ON ml.zaphasti_id = z.id
            LEFT JOIN users u ON ml.user_id = u.id
            LEFT JOIN skladi wh_from ON ml.warehouse_from_id = wh_from.id
            LEFT JOIN skladi wh_to ON ml.warehouse_to_id = wh_to.id
            ORDER BY ml.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения логов перемещений:', err.message);
        res.status(500).json({ error: 'Ошибка сервера при получении логов перемещений' });
    }
});

// GET /api/get-repair-logs - получение логов ремонта
router.get('/get-repair-logs', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                rl.*,
                w.name AS warehouse_name,
                z.name AS part_name,
                COALESCE(z.article, z.code, '—') AS part_article,
                c.gos_number AS car_number,
                COALESCE(c.model, '—') AS car_model,
                u.name AS user_name
            FROM repair_logs rl
            LEFT JOIN skladi w ON rl.warehouse_id::text = w.id::text
            LEFT JOIN zaphasti z ON rl.zaphast_id::text = z.id::text
            LEFT JOIN cars c ON rl.car_id::text = c.id::text
            LEFT JOIN users u ON rl.user_id::text = u.id::text
            ORDER BY rl.created_at DESC
            LIMIT 500;
        `;
        const result = await client.query(query);
        return res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения логов ремонта:', err.message);
        return res.status(500).json({ error: 'Ошибка получения логов ремонта: ' + err.message });
    } finally {
        client.release();
    }
});

// Функция записи лога приходов
async function writeReceiptLog(client, req, data = {}) {
    try {
        const d = data || {};
        
        const userId = req?.headers?.['x-user-id'] || 
                       req?.headers?.['user-id'] || 
                       req?.body?.user_id || 
                       d.user_id || 
                       null;

        await client.query(`
            INSERT INTO receipt_logs (
                action, receipt_id, document_number, user_id, 
                supplier_id, warehouse_id, zaphasti_id, 
                quantity, price, currency, price_rub, total_rub, description
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
            d.action || 'INSERT',
            d.receipt_id ? Number(d.receipt_id) : null,
            d.document_number ? String(d.document_number) : null,
            userId ? Number(userId) : null,
            d.supplier_id ? Number(d.supplier_id) : null,
            d.warehouse_id ? Number(d.warehouse_id) : null,
            d.zaphasti_id ? Number(d.zaphasti_id) : null,
            Number(d.quantity) || 0,
            Number(d.price) || 0,
            d.currency || 'RUB',
            Number(d.price_rub) || 0,
            Number(d.total_rub) || 0,
            d.description || ''
        ]);
    } catch (err) {
        console.error('❌ ОШИБКА записи в receipt_logs:', err.message);
        throw err;
    }
}

// Функция для записи логов перемещений (аналог writeReceiptLog, создайте её в своем файле или утилите)
async function writeMoveLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO move_logs (
                action, move_id, document_number, warehouse_from_id, warehouse_to_id, 
                zaphasti_id, quantity, price, currency, price_rub, total_rub, 
                income_document_id, description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                data.action,
                data.move_id,
                data.document_number,
                data.warehouse_from_id,
                data.warehouse_to_id,
                data.zaphasti_id,
                data.quantity,
                data.price,
                data.currency,
                data.price_rub,
                data.total_rub,
                data.income_document_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога перемещения (не критично):', logErr.message);
    }
}

// Функция для записи логов ремонта в таблицу repair_logs
async function writeRepairLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO repair_logs (
                action, repair_id, document_number, warehouse_id, car_id, 
                zaphast_id, quantity, price, total, receipt_id, 
                description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                data.action,
                data.repair_id,
                data.document_number,
                data.warehouse_id,
                data.car_id,
                data.zaphast_id,
                data.quantity,
                data.price,
                data.total,
                data.receipt_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога ремонта (не критично):', logErr.message);
    }
}


// POST /api/receipt_items - добавление позиции в приход
router.post('/receipt_items', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            receipt_id,
            zaphasti_id,
            price,
            currency,
            quantity,
            description
        } = req.body;

        // 1. Проверяем обязательные поля
        if (!receipt_id || !zaphasti_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Не указан ID прихода (receipt_id) или запчасти (zaphasti_id).' });
        }

        // 2. Проверяем, проведен ли уже родительский документ (receipts), и забираем нужные поля для лога (warehouse_id, supplier_id, doc_number)
        const receiptCheck = await client.query(
            'SELECT is_posted, warehouse_id, supplier_id, doc_number FROM receipts WHERE id = $1',
            [receipt_id]
        );

        if (receiptCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Указанный приход не найден.' });
        }

        const receiptData = receiptCheck.rows[0];
        const isPostedVal = receiptData.is_posted;
        if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2 || isPostedVal === 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя добавлять запчасти в уже проведенный документ!' });
        }

        // 3. Подготовка и расчёт числовых полей
        const numPrice = Number(price) || 0;
        const numQty = Number(quantity) || 0;
        const priceRub = numPrice; 
        const totalRub = numPrice * numQty;
        const curr = currency || 'Рубль ПМР';

        // 4. Вставка позиции в таблицу receipt_items
        const insertQuery = `
            INSERT INTO receipt_items (
                receipt_id, 
                zaphasti_id, 
                price, 
                currency, 
                quantity, 
                description, 
                price_rub, 
                total_rub
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *;
        `;

        const values = [
            receipt_id,
            zaphasti_id,
            numPrice,
            curr,
            numQty,
            description || null,
            priceRub,
            totalRub
        ];

        const newItemResult = await client.query(insertQuery, values);
        const createdItem = newItemResult.rows[0];

        // 5. Запись лога в новую изолированную таблицу receipt_logs
        await writeReceiptLog(client, req, {
            action: 'INSERT',
            receipt_id: receipt_id,
            document_number: receiptData.doc_number || '',
            supplier_id: receiptData.supplier_id || null,
            warehouse_id: receiptData.warehouse_id || null,
            zaphasti_id: zaphasti_id,
            quantity: numQty,
            price: numPrice,
            currency: curr,
            price_rub: priceRub,
            total_rub: totalRub,
            description: description || 'Добавлена новая позиция в приход'
        });

        await client.query('COMMIT');

        return res.status(201).json({
            message: 'Позиция успешно добавлена в приход',
            item: createdItem
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('ПОЛНАЯ ОШИБКА БД при добавлении позиции:', {
            message: error.message,
            detail: error.detail,
            hint: error.hint,
            code: error.code,
            position: error.position
        });
        return res.status(500).json({ 
            error: 'Внутренняя ошибка сервера при добавлении позиции.',
            details: error.message 
        });
    } finally {
        client.release();
    }
});

// PUT /api/receipt_items/:id - редактирование позиции в приходе
router.put('/receipt_items/:id', async (req, res) => {
    const itemId = req.params.id;
    const {
        price,
        currency,
        quantity,
        description
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Находим саму позицию прихода и блокируем её
        const itemCheck = await client.query(
            'SELECT * FROM receipt_items WHERE id = $1 FOR UPDATE',
            [itemId]
        );

        if (itemCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Позиция прихода не найдена.' });
        }

        const currentItem = itemCheck.rows[0];
        const receipt_id = currentItem.receipt_id;
        const zaphasti_id = currentItem.zaphasti_id;

        // 2. Проверяем, проведен ли родительский документ (receipts), и забираем нужные поля (warehouse_id, supplier_id, doc_number)
        const receiptCheck = await client.query(
            'SELECT is_posted, warehouse_id, supplier_id, doc_number FROM receipts WHERE id = $1 FOR UPDATE',
            [receipt_id]
        );

        if (receiptCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Родительский документ прихода не найден.' });
        }

        const receiptData = receiptCheck.rows[0];
        const isPostedVal = receiptData.is_posted;
        if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2 || isPostedVal === '2' || isPostedVal === 1 || isPostedVal === '1') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя изменять запчасти в уже проведенном документе!' });
        }

        // 3. Подготовка и расчёт новых числовых полей (если поле не передано, оставляем старое)
        const numPrice = price !== undefined ? Number(price) || 0 : Number(currentItem.price);
        const numQty = quantity !== undefined ? Number(quantity) || 0 : Number(currentItem.quantity);
        const priceRub = numPrice; 
        const totalRub = numPrice * numQty;
        const curr = currency !== undefined ? currency : currentItem.currency;
        const desc = description !== undefined ? description : currentItem.description;

        if (numQty <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Количество запчасти должно быть больше нуля.' });
        }

        // 4. Обновление позиции в таблице receipt_items
        const updateQuery = `
            UPDATE receipt_items 
            SET price = $1, 
                currency = $2, 
                quantity = $3, 
                description = $4, 
                price_rub = $5, 
                total_rub = $6
            WHERE id = $7 
            RETURNING *;
        `;

        const values = [
            numPrice,
            curr,
            numQty,
            desc || null,
            priceRub,
            totalRub,
            itemId
        ];

        const updateResult = await client.query(updateQuery, values);
        const updatedItem = updateResult.rows[0];

        // 5. Запись лога в новую изолированную таблицу receipt_logs через writeReceiptLog
        await writeReceiptLog(client, req, {
            action: 'UPDATE',
            receipt_id: receipt_id,
            document_number: receiptData.doc_number || '',
            supplier_id: receiptData.supplier_id || null,
            warehouse_id: receiptData.warehouse_id || null,
            zaphasti_id: zaphasti_id,
            quantity: numQty,
            price: numPrice,
            currency: curr,
            price_rub: priceRub,
            total_rub: totalRub,
            description: desc || 'Изменена позиция прихода'
        });

        await client.query('COMMIT');

        return res.status(200).json({
            message: 'Позиция прихода успешно обновлена',
            item: updatedItem
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('ПОЛНАЯ ОШИБКА БД при обновлении позиции прихода:', {
            message: error.message,
            detail: error.detail,
            hint: error.hint,
            code: error.code,
            position: error.position
        });
        return res.status(500).json({ 
            error: 'Внутренняя ошибка сервера при обновлении позиции.',
            details: error.message 
        });
    } finally {
        client.release();
    }
});


// DELETE /api/receipt_items/:id - удаление позиции из прихода с проверкой FIFO
router.delete('/receipt_items/:id', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[DELETE REQUEST] Удаление позиции прихода (receipt_items)`);
    console.log(`[ID]:`, req.params.id);

    const itemId = req.params.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Находим удаляемую позицию прихода и блокируем её (без LEFT JOIN с FOR UPDATE, чтобы PostgreSQL не ругался на nullable сторону)
        const itemCheck = await client.query('SELECT * FROM receipt_items WHERE id = $1 FOR UPDATE', [itemId]);
        if (itemCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Позиция прихода не найдена.' });
        }

        const currentItem = itemCheck.rows[0];
        const receipt_id = currentItem.receipt_id;
        const zaphasti_id = currentItem.zaphasti_id;
        const initialQty = Number(currentItem.quantity) || 0;

        // Дополнительно подтянем название запчасти для лога (без FOR UPDATE)
        const zaphastiRes = await client.query('SELECT name FROM zaphasti WHERE id = $1', [zaphasti_id]);
        const zaphastiName = zaphastiRes.rows[0]?.name || 'запчасть';

        // 2. Проверяем родительский документ (receipts), забираем warehouse_id, is_posted и doc_number
        const receiptCheck = await client.query('SELECT warehouse_id, is_posted, doc_number, supplier_id FROM receipts WHERE id = $1 FOR UPDATE', [receipt_id]);
        if (receiptCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Родительский документ прихода не найден.' });
        }

        const receiptData = receiptCheck.rows[0];
        const warehouseId = receiptData.warehouse_id;
        const isPosted = receiptData.is_posted;

        // 3. Если документ проведен, проверяем, не были ли списаны товары из этой конкретной строки прихода
        if (isPosted) {
            // Считаем, сколько из этой позиции уже ушло в перемещения, реализации и ремонты
            const spentCheckQuery = `
                SELECT 
                    (
                        COALESCE((
                            SELECT SUM(mi.quantity) 
                            FROM move_items mi 
                            JOIN moves m ON mi.move_id = m.id 
                            WHERE mi.income_document_id = $1 
                              AND mi.zaphasti_id = $2 
                              AND m.warehouse_from_id = $3 
                              AND m.is_posted = true
                        ), 0) +
                        COALESCE((
                            SELECT SUM(rel_i.quantity) 
                            FROM realization_items rel_i 
                            JOIN realizations rel ON rel_i.realization_id = rel.id 
                            WHERE rel_i.income_document_id = $1 
                              AND rel_i.zaphasti_id = $2 
                              AND rel.sklad_id = $3 
                              AND rel.is_posted = true
                        ), 0) +
                        COALESCE((
                            SELECT SUM(rep_i.quantity) 
                            FROM repair_items rep_i 
                            JOIN repairs rep ON rep_i.repair_id = rep.id 
                            WHERE rep_i.receipt_id = $1 
                              AND rep_i.zaphast_id = $2 
                              AND rep.warehouse_id = $3 
                              AND rep.is_posted = true
                        ), 0)
                    ) AS total_spent
            `;

            const spentRes = await client.query(spentCheckQuery, [receipt_id, zaphasti_id, warehouseId]);
            const totalSpent = Number(spentRes.rows[0]?.total_spent) || 0;

            // Если по этой партии уже что-то списано, удалять нельзя
            if (totalSpent > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: `Нельзя удалить позицию из проведенного прихода, так как часть товара (${totalSpent} шт. из ${initialQty} шт.) уже была списана в другие документы (перемещения/продажи/ремонты).` 
                });
            }
        }

        // 4. Удаляем позицию из базы данных
        await client.query('DELETE FROM receipt_items WHERE id = $1', [itemId]);

        // 5. Запись лога через writeReceiptLog (как в эндпоинте обновления)
        await writeReceiptLog(client, req, {
            action: 'DELETE',
            receipt_id: receipt_id,
            document_number: receiptData.doc_number || '',
            supplier_id: receiptData.supplier_id || null,
            warehouse_id: warehouseId || null,
            zaphasti_id: zaphasti_id,
            quantity: initialQty,
            price: currentItem.price || 0,
            currency: currentItem.currency || 'RUB',
            price_rub: currentItem.price_rub || 0,
            total_rub: currentItem.total_rub || 0,
            description: currentItem.description || 'Удалена позиция из прихода'
        });

        await client.query('COMMIT');

        console.log(`[SUCCESS] Позиция прихода успешно удалена: ID ${itemId}`);
        return res.status(200).json({ message: 'Позиция прихода успешно удалена', id: itemId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR DELETE receipt_items]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при удалении позиции прихода: ' + err.message });
    } finally {
        client.release();
    }
});


// POST /api/move_items - добавление позиции перемещения с корректным FIFO и учетом текущего документа
router.post('/move_items', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[POST REQUEST] Добавление позиции перемещения (move_items) с FIFO`);
    console.log(`[BODY]:`, req.body);

    const { zaphasti_id, currency, quantity, description, move_id } = req.body;
    const requestedQty = Number(quantity) || 0;

    if (!zaphasti_id || !move_id) {
        return res.status(400).json({ error: 'Не указан ID запчасти (zaphasti_id) или ID документа перемещения (move_id).' });
    }

    if (requestedQty <= 0) {
        return res.status(400).json({ error: 'Количество товара должно быть больше нуля.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Проверяем документ перемещения, его склады и статус проведения (is_posted) с получением doc_number
        const moveCheck = await client.query('SELECT warehouse_from_id, warehouse_to_id, is_posted, doc_number FROM moves WHERE id = $1 FOR UPDATE', [move_id]);
        if (moveCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Указанный документ перемещения не найден.' });
        }

        const moveData = moveCheck.rows[0];
        const warehouseFromId = moveData.warehouse_from_id;
        const warehouseToId = moveData.warehouse_to_id;
        const isPosted = moveData.is_posted;
        const moveDocNumber = moveData.doc_number || '';

        if (isPosted) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя добавлять позиции в уже проведенный документ перемещения.' });
        }

        if (!warehouseFromId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'В документе перемещения не указан склад-источник (откуда перемещать).' });
        }

        if (warehouseFromId === warehouseToId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Склад-источник и склад-получатель не могут быть одинаковыми.' });
        }

        // 2. Получаем актуальные партии (приходы) и их реальные остатки по FIFO
        const batchesQuery = `
            SELECT 
                r.id AS receipt_id,
                r.doc_number AS receipt_doc_number,
                r.date AS receipt_date,
                ri.price,
                ri.price_rub,
                ri.quantity AS initial_qty,
                (
                    COALESCE((
                        SELECT SUM(mi.quantity) 
                        FROM move_items mi 
                        JOIN moves m ON mi.move_id = m.id 
                        WHERE mi.income_document_id = r.id 
                          AND mi.zaphasti_id = ri.zaphasti_id 
                          AND m.warehouse_from_id = r.warehouse_id 
                          AND (m.is_posted = true OR m.id = $3)
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rel_i.quantity) 
                        FROM realization_items rel_i 
                        JOIN realizations rel ON rel_i.realization_id = rel.id 
                        WHERE rel_i.income_document_id = r.id 
                          AND rel_i.zaphasti_id = ri.zaphasti_id 
                          AND rel.sklad_id = r.warehouse_id 
                          AND rel.is_posted = true
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rep_i.quantity) 
                        FROM repair_items rep_i 
                        JOIN repairs rep ON rep_i.repair_id = rep.id 
                        WHERE rep_i.receipt_id = r.id 
                          AND rep_i.zaphast_id = ri.zaphasti_id 
                          AND rep.warehouse_id = r.warehouse_id 
                          AND rep.is_posted = true
                    ), 0)
                ) AS spent_qty
            FROM receipt_items ri
            JOIN receipts r ON ri.receipt_id = r.id
            WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2
            ORDER BY r.date ASC, r.id ASC
        `;

        const batchesRes = await client.query(batchesQuery, [zaphasti_id, warehouseFromId, move_id]);
        
        let batches = batchesRes.rows.map(b => {
            const initial = Number(b.initial_qty) || 0;
            const spent = Number(b.spent_qty) || 0;
            const available = initial - spent;
            const price = Number(b.price_rub !== undefined && b.price_rub !== null ? b.price_rub : b.price) || 0;
            return {
                receipt_id: b.receipt_id,
                doc_number: b.receipt_doc_number || `ПР-${b.receipt_id}`,
                price: price,
                available: available > 0 ? available : 0
            };
        }).filter(b => b.available > 0);

        const totalAvailableStock = batches.reduce((sum, b) => sum + b.available, 0);

        console.log(`[FIFO DEBUG] Запрошено к добавлению: ${requestedQty} шт.`);
        console.log(`[FIFO DEBUG] Реально доступно на складе с учетом текущего документа:`, totalAvailableStock);
        console.log(`[FIFO DEBUG] Доступные партии:`, batches);

        if (requestedQty > totalAvailableStock) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: `Недостаточно товара на выбранном складе! Доступно: ${totalAvailableStock > 0 ? totalAvailableStock : 0} шт., а вы пытаетесь перенести: ${requestedQty} шт.` 
            });
        }

        let remainingToDistribute = requestedQty;
        const createdRecords = [];
        const curr = currency || 'Рубль ПМР';
        const userId = req.headers['x-user-id'] || req.headers['user-id'] || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        // 3. Распределяем строго по партиям FIFO
        for (const batch of batches) {
            if (remainingToDistribute <= 0) break;

            const takeQty = Math.min(remainingToDistribute, batch.available);
            if (takeQty <= 0) continue;

            const totalRub = takeQty * batch.price;

            console.log(`➡️ [FIFO STEP] Партия "${batch.doc_number}" (ID: ${batch.receipt_id}): берем ${takeQty} шт. по цене ${batch.price}`);

            const insertQuery = `
                INSERT INTO "move_items" 
                ("zaphasti_id", "price", "currency", "quantity", "price_rub", "total_rub", "description", "move_id", "income_document_id") 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                RETURNING *;
            `;

            const values = [
                zaphasti_id, 
                batch.price, 
                curr, 
                takeQty, 
                batch.price, 
                totalRub, 
                description || null, 
                move_id, 
                batch.receipt_id 
            ];

            const result = await client.query(insertQuery, values);
            const newRecord = result.rows[0];
            createdRecords.push(newRecord);

            // 4. Запись лога перемещения через writeMoveLog
            await writeMoveLog(client, req, {
                action: 'INSERT',
                move_id: move_id,
                document_number: moveDocNumber,
                warehouse_from_id: warehouseFromId,
                warehouse_to_id: warehouseToId,
                zaphasti_id: zaphasti_id,
                quantity: takeQty,
                price: batch.price,
                currency: curr,
                price_rub: batch.price,
                total_rub: totalRub,
                income_document_id: batch.receipt_id,
                description: description || 'Добавлена позиция в перемещение'
            });

            try {
                await client.query(
                    `INSERT INTO audit_logs (user_id, action, table_name, record_id, details, ip_address) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [userId, 'INSERT', 'move_items', newRecord.id, JSON.stringify({ ...req.body, split_quantity: takeQty, income_document_id: batch.receipt_id }), clientIp]
                );
            } catch (logErr) {
                console.error('Ошибка записи audit_logs:', logErr.message);
            }

            remainingToDistribute -= takeQty;
        }

        // Страховка на случай непредвиденного остатка
        if (remainingToDistribute > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Ошибка распределения партий FIFO: не удалось покрыть запрошенное количество за счет существующих партий прихода.' });
        }

        await client.query('COMMIT');

        console.log(`[SUCCESS] Успешно добавлено строк: ${createdRecords.length}`);
        return res.status(201).json(createdRecords);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR НА СЕРВЕРЕ]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при добавлении позиции перемещения: ' + err.message });
    } finally {
        client.release();
    }
});

// PUT /api/move_items/:id - редактирование позиции перемещения с исправленным FIFO и учетом других строк текущего документа
router.put('/move_items/:id', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[PUT REQUEST] Редактирование позиции перемещения (move_items) с FIFO`);
    console.log(`[ID]:`, req.params.id);
    console.log(`[BODY]:`, req.body);

    const itemId = req.params.id;
    const { quantity, price, currency, description } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Находим текущую позицию перемещения и блокируем её
        const itemCheck = await client.query('SELECT * FROM move_items WHERE id = $1 FOR UPDATE', [itemId]);
        if (itemCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Позиция перемещения не найдена.' });
        }

        const currentItem = itemCheck.rows[0];
        const move_id = currentItem.move_id;
        const zaphasti_id = currentItem.zaphasti_id;

        // 2. Проверяем документ перемещения, его склады и статус проведения (is_posted)
        const moveCheck = await client.query('SELECT doc_number, warehouse_from_id, warehouse_to_id, is_posted FROM moves WHERE id = $1 FOR UPDATE', [move_id]);
        if (moveCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Документ перемещения не найден.' });
        }

        const moveRecord = moveCheck.rows[0];
        const warehouseFromId = moveRecord.warehouse_from_id;
        const warehouseToId = moveRecord.warehouse_to_id;
        const isPosted = moveRecord.is_posted;
        const documentNumber = moveRecord.doc_number || `ПЕР-${move_id}`;

        if (isPosted) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя изменять позиции в уже проведенном документе перемещения.' });
        }

        if (!warehouseFromId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'В документе перемещения не указан склад-источник.' });
        }

        // Новое количество и цена (если не переданы, берем старые)
        const requestedQty = quantity !== undefined ? Number(quantity) : Number(currentItem.quantity);
        const newPrice = price !== undefined ? Number(price) : Number(currentItem.price);

        if (requestedQty <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Количество товара должно быть больше нуля.' });
        }

        // 3. Получаем актуальные партии (приходы) по FIFO с честным остатком (учитываем все списания, 
        // а собственное количество текущей строки вычитаем обратно, чтобы оно не блокировало саму себя)
        const batchesQuery = `
            SELECT 
                r.id AS receipt_id,
                r.doc_number AS receipt_doc_number,
                r.date AS receipt_date,
                ri.price,
                ri.price_rub,
                ri.quantity AS initial_qty,
                (
                    COALESCE((
                        SELECT SUM(mi.quantity) 
                        FROM move_items mi 
                        JOIN moves m ON mi.move_id = m.id 
                        WHERE mi.income_document_id = r.id 
                          AND mi.zaphasti_id = ri.zaphasti_id 
                          AND m.warehouse_from_id = r.warehouse_id 
                          AND (m.is_posted = true OR m.id = $3)
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rel_i.quantity) 
                        FROM realization_items rel_i 
                        JOIN realizations rel ON rel_i.realization_id = rel.id 
                        WHERE rel_i.income_document_id = r.id 
                          AND rel_i.zaphasti_id = ri.zaphasti_id 
                          AND rel.sklad_id = r.warehouse_id 
                          AND rel.is_posted = true
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rep_i.quantity) 
                        FROM repair_items rep_i 
                        JOIN repairs rep ON rep_i.repair_id = rep.id 
                        WHERE rep_i.receipt_id = r.id 
                          AND rep_i.zaphast_id = ri.zaphasti_id 
                          AND rep.warehouse_id = r.warehouse_id 
                          AND rep.is_posted = true
                    ), 0)
                    - COALESCE((
                        SELECT mi_curr.quantity 
                        FROM move_items mi_curr 
                        WHERE mi_curr.id = $4 AND mi_curr.income_document_id = r.id
                    ), 0)
                ) AS spent_qty
            FROM receipt_items ri
            JOIN receipts r ON ri.receipt_id = r.id
            WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2
            ORDER BY r.date ASC, r.id ASC
        `;

        const batchesRes = await client.query(batchesQuery, [zaphasti_id, warehouseFromId, move_id, itemId]);
        
        let batches = batchesRes.rows.map(b => {
            const initial = Number(b.initial_qty) || 0;
            const spent = Number(b.spent_qty) || 0;
            const available = initial - spent;
            const batchPrice = Number(b.price_rub !== undefined && b.price_rub !== null ? b.price_rub : b.price) || 0;
            return {
                receipt_id: b.receipt_id,
                doc_number: b.receipt_doc_number || `ПР-${b.receipt_id}`,
                price: batchPrice,
                available: available > 0 ? available : 0
            };
        }).filter(b => b.available > 0);

        const totalAvailableStock = batches.reduce((sum, b) => sum + b.available, 0);

        console.log(`[FIFO PUT DEBUG] Запрошено количество: ${requestedQty} шт.`);
        console.log(`[FIFO PUT DEBUG] Доступно на складе (честный остаток):`, totalAvailableStock);

        if (requestedQty > totalAvailableStock) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: `Недостаточно товара на выбранном складе! Доступно: ${totalAvailableStock > 0 ? totalAvailableStock : 0} шт., а вы пытаетесь установить: ${requestedQty} шт.` 
            });
        }

        let chosenBatch = batches.find(b => b.receipt_id === currentItem.income_document_id);
        
        if (!chosenBatch || chosenBatch.available < requestedQty) {
            chosenBatch = batches[0];
        }

        const finalPrice = price !== undefined ? newPrice : chosenBatch.price;
        const totalRub = requestedQty * finalPrice;
        const curr = currency !== undefined ? currency : (currentItem.currency || 'Рубль ПМР');
        const desc = description !== undefined ? description : currentItem.description;

        const updateQuery = `
            UPDATE "move_items" 
            SET "quantity" = $1, 
                "price" = $2, 
                "price_rub" = $3, 
                "total_rub" = $4, 
                "currency" = $5, 
                "description" = $6, 
                "income_document_id" = $7
            WHERE id = $8 
            RETURNING *;
        `;

        const values = [
            requestedQty,
            finalPrice,
            finalPrice,
            totalRub,
            curr,
            desc || null,
            chosenBatch.receipt_id,
            itemId
        ];

        const result = await client.query(updateQuery, values);
        const updatedRecord = result.rows[0];

        // Запись в move_logs вместо audit_logs
        await writeMoveLog(client, req, {
            action: 'UPDATE',
            move_id: move_id,
            document_number: documentNumber,
            warehouse_from_id: warehouseFromId,
            warehouse_to_id: warehouseToId,
            zaphasti_id: zaphasti_id,
            quantity: requestedQty,
            price: finalPrice,
            currency: curr,
            price_rub: finalPrice,
            total_rub: totalRub,
            income_document_id: chosenBatch.receipt_id,
            description: desc || null
        });

        await client.query('COMMIT');

        console.log(`[SUCCESS] Позиция перемещения успешно обновлена: ID ${itemId}`);
        return res.status(200).json(updatedRecord);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR PUT move_items]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при обновлении позиции перемещения: ' + err.message });
    } finally {
        client.release();
    }
});

// Функция для записи логов перемещений в таблицу move_logs
async function writeMoveLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO move_logs (
                action, move_id, document_number, warehouse_from_id, warehouse_to_id, 
                zaphasti_id, quantity, price, currency, price_rub, total_rub, 
                income_document_id, description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                data.action,
                data.move_id,
                data.document_number,
                data.warehouse_from_id,
                data.warehouse_to_id,
                data.zaphasti_id,
                data.quantity,
                data.price,
                data.currency,
                data.price_rub,
                data.total_rub,
                data.income_document_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога перемещения (не критично):', logErr.message);
    }
}
// DELETE /api/move_items/:id - удаление позиции перемещения с возвратом количества на склад-источник
router.delete('/move_items/:id', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[DELETE REQUEST] Удаление позиции перемещения (move_items)`);
    console.log(`[ID]:`, req.params.id);

    const itemId = req.params.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Находим удаляемую позицию перемещения и блокируем её
        const itemCheck = await client.query('SELECT * FROM move_items WHERE id = $1 FOR UPDATE', [itemId]);
        if (itemCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Позиция перемещения не найдена.' });
        }

        const currentItem = itemCheck.rows[0];
        const move_id = currentItem.move_id;
        const zaphasti_id = currentItem.zaphasti_id;

        // 2. Проверяем родительский документ перемещения (moves), его статус проведения и склады
        const moveCheck = await client.query('SELECT doc_number, warehouse_from_id, warehouse_to_id, is_posted FROM moves WHERE id = $1 FOR UPDATE', [move_id]);
        if (moveCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Родительский документ перемещения не найден.' });
        }

        const moveRecord = moveCheck.rows[0];
        const warehouseFromId = moveRecord.warehouse_from_id;
        const warehouseToId = moveRecord.warehouse_to_id;
        const isPosted = moveRecord.is_posted;
        const documentNumber = moveRecord.doc_number || `ПЕР-${move_id}`;

        // 3. Если документ перемещения проведен, удалять из него позиции нельзя (нужна отмена проведения)
        if (isPosted) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя удалять позиции из уже проведенного документа перемещения. Сначала отмените проведение документа.' });
        }

        // Примечание по логике FIFO: 
        // Так как документ не проведен, эта позиция «занимала» остаток на складе-источнике (warehouse_from_id) 
        // через проверку в запросах (где исключался или учитывался текущий документ). 
        // При простом удалении строки из базы её «бронь» автоматически снимается, 
        // и товар в исходных партиях (с их родными ценами по 50 и 60 рублей) снова становится полностью доступным на складе-отправителе.

        // 4. Удаляем позицию из базы данных
        await client.query('DELETE FROM move_items WHERE id = $1', [itemId]);

        // 5. Запись в move_logs вместо audit_logs
        await writeMoveLog(client, req, {
            action: 'DELETE',
            move_id: move_id,
            document_number: documentNumber,
            warehouse_from_id: warehouseFromId,
            warehouse_to_id: warehouseToId,
            zaphasti_id: zaphasti_id,
            quantity: currentItem.quantity,
            price: currentItem.price,
            currency: currentItem.currency,
            price_rub: currentItem.price_rub,
            total_rub: currentItem.total_rub,
            income_document_id: currentItem.income_document_id,
            description: currentItem.description
        });

        await client.query('COMMIT');

        console.log(`[SUCCESS] Позиция перемещения успешно удалена: ID ${itemId}`);
        return res.status(200).json({ message: 'Позиция перемещения успешно удалена', id: itemId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR DELETE move_items]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при удалении позиции перемещения: ' + err.message });
    } finally {
        client.release();
    }
});

// Функция для записи логов перемещений в таблицу move_logs
async function writeMoveLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO move_logs (
                action, move_id, document_number, warehouse_from_id, warehouse_to_id, 
                zaphasti_id, quantity, price, currency, price_rub, total_rub, 
                income_document_id, description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                data.action,
                data.move_id,
                data.document_number,
                data.warehouse_from_id,
                data.warehouse_to_id,
                data.zaphasti_id,
                data.quantity,
                data.price,
                data.currency,
                data.price_rub,
                data.total_rub,
                data.income_document_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога перемещения (не критично):', logErr.message);
    }
}
// POST /api/repair_items - добавление запчасти в ремонт с честным FIFO и разделением партий
router.post('/repair_items', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[POST REQUEST] Добавление запчасти в ремонт (repair_items) с FIFO`);
    console.log(`[BODY]:`, req.body);

    const { zaphast_id, quantity, description, repair_id } = req.body;
    const requestedQty = Number(quantity) || 0;

    if (!zaphast_id || !repair_id) {
        return res.status(400).json({ error: 'Не указан ID запчасти (zaphast_id) или ID документа ремонта (repair_id).' });
    }

    if (requestedQty <= 0) {
        return res.status(400).json({ error: 'Количество запчасти должно быть больше нуля.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Проверяем документ ремонта, его склад и статус проведения
        const repairCheck = await client.query('SELECT doc_number, warehouse_id, car_id, is_posted FROM repairs WHERE id = $1 FOR UPDATE', [repair_id]);
        if (repairCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Указанный документ ремонта не найден.' });
        }

        const repairRecord = repairCheck.rows[0];
        const warehouseId = repairRecord.warehouse_id;
        const carId = repairRecord.car_id;
        const isPosted = repairRecord.is_posted;
        const documentNumber = repairRecord.doc_number || `РЕМОНТ-${repair_id}`;

        const isDocumentPosted = isPosted === true || isPosted === 'true' || isPosted === 1 || isPosted === '1' || isPosted === 2 || isPosted === '2';
        if (isDocumentPosted) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя добавлять запчасти в уже проведенный ремонт!' });
        }

        if (!warehouseId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'В документе ремонта не указан склад, с которого списываются запчасти.' });
        }

        // 2. Получаем актуальные партии (приходы) и их реальные остатки по FIFO для склада ремонта
        // Учитываем приходы, входящие перемещения, исходящие перемещения, реализации и другие ремонты (кроме текущего)
        const batchesQuery = `
            SELECT 
                r.id AS receipt_id,
                r.doc_number AS receipt_doc_number,
                r.date AS receipt_date,
                ri.price,
                ri.price_rub,
                ri.quantity AS initial_qty,
                (
                    COALESCE((
                        SELECT SUM(mi.quantity) 
                        FROM move_items mi 
                        JOIN moves m ON mi.move_id = m.id 
                        WHERE mi.income_document_id = r.id 
                          AND mi.zaphasti_id = ri.zaphasti_id 
                          AND m.warehouse_from_id = r.warehouse_id 
                          AND m.is_posted = true
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rel_i.quantity) 
                        FROM realization_items rel_i 
                        JOIN realizations rel ON rel_i.realization_id = rel.id 
                        WHERE rel_i.income_document_id = r.id 
                          AND rel_i.zaphasti_id = ri.zaphasti_id 
                          AND rel.sklad_id = r.warehouse_id 
                          AND rel.is_posted = true
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rep_i.quantity) 
                        FROM repair_items rep_i 
                        JOIN repairs rep ON rep_i.repair_id = rep.id 
                        WHERE rep_i.receipt_id = r.id 
                          AND rep_i.zaphast_id = ri.zaphasti_id 
                          AND rep.warehouse_id = r.warehouse_id 
                          AND (rep.is_posted = true OR rep.id = $3)
                    ), 0)
                ) AS spent_qty
            FROM receipt_items ri
            JOIN receipts r ON ri.receipt_id = r.id
            WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2
            ORDER BY r.date ASC, r.id ASC
        `;

        const batchesRes = await client.query(batchesQuery, [zaphast_id, warehouseId, repair_id]);
        
        let batches = batchesRes.rows.map(b => {
            const initial = Number(b.initial_qty) || 0;
            const spent = Number(b.spent_qty) || 0;
            const available = initial - spent;
            const price = Number(b.price_rub !== undefined && b.price_rub !== null ? b.price_rub : b.price) || 0;
            return {
                receipt_id: b.receipt_id,
                doc_number: b.receipt_doc_number || `ПР-${b.receipt_id}`,
                price: price,
                available: available > 0 ? available : 0
            };
        }).filter(b => b.available > 0);

        const totalAvailableStock = batches.reduce((sum, b) => sum + b.available, 0);

        console.log(`[FIFO REPAIR DEBUG] Запрошено к списанию: ${requestedQty} шт.`);
        console.log(`[FIFO REPAIR DEBUG] Реально доступно на складе:`, totalAvailableStock);
        console.log(`[FIFO REPAIR DEBUG] Доступные партии:`, batches);

        if (requestedQty > totalAvailableStock) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: `Недостаточно запчастей на складе! Доступно: ${totalAvailableStock > 0 ? totalAvailableStock : 0} шт., а вы пытаетесь списать: ${requestedQty} шт.` 
            });
        }

        let remainingToDistribute = requestedQty;
        const createdRecords = [];

        // 3. Распределяем строго по партиям FIFO
        for (const batch of batches) {
            if (remainingToDistribute <= 0) break;

            const takeQty = Math.min(remainingToDistribute, batch.available);
            if (takeQty <= 0) continue;

            const totalSum = takeQty * batch.price;

            console.log(`➡️ [FIFO REPAIR STEP] Партия "${batch.doc_number}" (ID: ${batch.receipt_id}): берем ${takeQty} шт. по цене ${batch.price}`);

            const insertQuery = `
                INSERT INTO "repair_items" 
                ("zaphast_id", "price", "quantity", "description", "repair_id", "total", "receipt_id") 
                VALUES ($1, $2, $3, $4, $5, $6, $7) 
                RETURNING *;
            `;

            const values = [
                zaphast_id, 
                batch.price, 
                takeQty, 
                description || null, 
                repair_id, 
                totalSum, 
                batch.receipt_id 
            ];

            const result = await client.query(insertQuery, values);
            const newRecord = result.rows[0];
            createdRecords.push(newRecord);

            // Запись в repair_logs вместо audit_logs
            await writeRepairLog(client, req, {
                action: 'INSERT',
                repair_id: repair_id,
                document_number: documentNumber,
                warehouse_id: warehouseId,
                car_id: carId,
                zaphast_id: zaphast_id,
                quantity: takeQty,
                price: batch.price,
                total: totalSum,
                receipt_id: batch.receipt_id,
                description: description || null
            });

            remainingToDistribute -= takeQty;
        }

        if (remainingToDistribute > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Ошибка распределения партий FIFO в ремонте: не удалось покрыть запрошенное количество за счет существующих партий.' });
        }

        await client.query('COMMIT');

        console.log(`[SUCCESS] Успешно добавлено строк в ремонт: ${createdRecords.length}`);
        return res.status(201).json(createdRecords);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR НА СЕРВЕРЕ]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при добавлении запчасти в ремонт: ' + err.message });
    } finally {
        client.release();
    }
});

// Функция для записи логов ремонта в таблицу repair_logs
async function writeRepairLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO repair_logs (
                action, repair_id, document_number, warehouse_id, car_id, 
                zaphast_id, quantity, price, total, receipt_id, 
                description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                data.action,
                data.repair_id,
                data.document_number,
                data.warehouse_id,
                data.car_id,
                data.zaphast_id,
                data.quantity,
                data.price,
                data.total,
                data.receipt_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога ремонта (не критично):', logErr.message);
    }
}

// PUT /api/repair_items/:id - редактирование запчасти в ремонте с полноценным FIFO и проверкой склада
router.put('/repair_items/:id', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[PUT REQUEST] Редактирование запчасти в ремонте (repair_items) с FIFO`);
    console.log(`[ID]:`, req.params.id);
    console.log(`[BODY]:`, req.body);

    const itemId = req.params.id;
    const { quantity, price, description } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Находим текущую запчасть в ремонте и блокируем её
        const itemCheck = await client.query('SELECT * FROM repair_items WHERE id = $1 FOR UPDATE', [itemId]);
        if (itemCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Позиция запчасти в ремонте не найдена.' });
        }

        const currentItem = itemCheck.rows[0];
        const repair_id = currentItem.repair_id;
        const zaphast_id = currentItem.zaphast_id;

        // 2. Проверяем документ ремонта, его склад и статус проведения (is_posted)
        const repairCheck = await client.query('SELECT doc_number, warehouse_id, car_id, is_posted FROM repairs WHERE id = $1 FOR UPDATE', [repair_id]);
        if (repairCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Документ ремонта не найден.' });
        }

        const repairRecord = repairCheck.rows[0];
        const warehouseId = repairRecord.warehouse_id;
        const carId = repairRecord.car_id;
        const isPosted = repairRecord.is_posted;
        const documentNumber = repairRecord.doc_number || `РЕМОНТ-${repair_id}`;

        const isDocumentPosted = isPosted === true || isPosted === 'true' || isPosted === 1 || isPosted === '1' || isPosted === 2 || isPosted === '2';

        if (isDocumentPosted) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя изменять запчасти в уже проведенном ремонте!' });
        }

        if (!warehouseId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'В документе ремонта не указан склад.' });
        }

        // Новое количество и цена (если не переданы, берем старые)
        const requestedQty = quantity !== undefined ? Number(quantity) : Number(currentItem.quantity);
        const newPrice = price !== undefined ? Number(price) : Number(currentItem.price);

        if (requestedQty <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Количество запчасти должно быть больше нуля.' });
        }

        // 3. Получаем актуальные партии (приходы) по FIFO, ИСКЛЮЧАЯ текущую редактируемую строку из расхода текущего документа
        const batchesQuery = `
            SELECT 
                r.id AS receipt_id,
                r.doc_number AS receipt_doc_number,
                r.date AS receipt_date,
                ri.price,
                ri.price_rub,
                ri.quantity AS initial_qty,
                (
                    COALESCE((
                        SELECT SUM(mi.quantity) 
                        FROM move_items mi 
                        JOIN moves m ON mi.move_id = m.id 
                        WHERE mi.income_document_id = r.id 
                          AND mi.zaphasti_id = ri.zaphasti_id 
                          AND m.warehouse_from_id = r.warehouse_id 
                          AND m.is_posted = true
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rel_i.quantity) 
                        FROM realization_items rel_i 
                        JOIN realizations rel ON rel_i.realization_id = rel.id 
                        WHERE rel_i.income_document_id = r.id 
                          AND rel_i.zaphasti_id = ri.zaphasti_id 
                          AND rel.sklad_id = r.warehouse_id 
                          AND rel.is_posted = true
                    ), 0) +
                    COALESCE((
                        SELECT SUM(rep_i.quantity) 
                        FROM repair_items rep_i 
                        JOIN repairs rep ON rep_i.repair_id = rep.id 
                        WHERE rep_i.receipt_id = r.id 
                          AND rep_i.zaphast_id = ri.zaphasti_id 
                          AND rep.warehouse_id = r.warehouse_id 
                          AND (rep.is_posted = true OR (rep.id = $3 AND rep_i.id != $4))
                    ), 0)
                ) AS spent_qty
            FROM receipt_items ri
            JOIN receipts r ON ri.receipt_id = r.id
            WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2
            ORDER BY r.date ASC, r.id ASC
        `;

        const batchesRes = await client.query(batchesQuery, [zaphast_id, warehouseId, repair_id, itemId]);
        
        let batches = batchesRes.rows.map(b => {
            const initial = Number(b.initial_qty) || 0;
            const spent = Number(b.spent_qty) || 0;
            const available = initial - spent;
            const batchPrice = Number(b.price_rub !== undefined && b.price_rub !== null ? b.price_rub : b.price) || 0;
            return {
                receipt_id: b.receipt_id,
                doc_number: b.receipt_doc_number || `ПР-${b.receipt_id}`,
                price: batchPrice,
                available: available > 0 ? available : 0
            };
        }).filter(b => b.available > 0);

        const totalAvailableStock = batches.reduce((sum, b) => sum + b.available, 0);

        console.log(`[FIFO REPAIR PUT DEBUG] Запрошено количество: ${requestedQty} шт.`);
        console.log(`[FIFO REPAIR PUT DEBUG] Доступно на складе (без учета текущей строки):`, totalAvailableStock);

        if (requestedQty > totalAvailableStock) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: `Недостаточно запчастей на складе! Доступно: ${totalAvailableStock > 0 ? totalAvailableStock : 0} шт., а вы пытаетесь установить: ${requestedQty} шт.` 
            });
        }

        // Подбираем партию для сохранения: стараемся оставить текущую привязку к receipt_id, если в ней хватает остатка, иначе берем первую доступную по FIFO
        let chosenBatch = batches.find(b => b.receipt_id === currentItem.receipt_id);
        if (!chosenBatch || chosenBatch.available < requestedQty) {
            chosenBatch = batches[0];
        }

        const finalPrice = price !== undefined ? newPrice : chosenBatch.price;
        const totalSum = requestedQty * finalPrice;
        const desc = description !== undefined ? description : currentItem.description;

        const updateQuery = `
            UPDATE "repair_items" 
            SET "quantity" = $1, 
                "price" = $2, 
                "total" = $3, 
                "description" = $4, 
                "receipt_id" = $5
            WHERE id = $6 
            RETURNING *;
        `;

        const values = [
            requestedQty,
            finalPrice,
            totalSum,
            desc || null,
            chosenBatch.receipt_id,
            itemId
        ];

        const result = await client.query(updateQuery, values);
        const updatedRecord = result.rows[0];

        // Запись в repair_logs вместо audit_logs
        await writeRepairLog(client, req, {
            action: 'UPDATE',
            repair_id: repair_id,
            document_number: documentNumber,
            warehouse_id: warehouseId,
            car_id: carId,
            zaphast_id: zaphast_id,
            quantity: requestedQty,
            price: finalPrice,
            total: totalSum,
            receipt_id: chosenBatch.receipt_id,
            description: desc || null
        });

        await client.query('COMMIT');

        console.log(`[SUCCESS] Запчасть в ремонте успешно обновлена: ID ${itemId}`);
        return res.status(200).json(updatedRecord);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR PUT repair_items]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при обновлении запчасти в ремонте: ' + err.message });
    } finally {
        client.release();
    }
});

// Функция для записи логов ремонта в таблицу repair_logs
async function writeRepairLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO repair_logs (
                action, repair_id, document_number, warehouse_id, car_id, 
                zaphast_id, quantity, price, total, receipt_id, 
                description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                data.action,
                data.repair_id,
                data.document_number,
                data.warehouse_id,
                data.car_id,
                data.zaphast_id,
                data.quantity,
                data.price,
                data.total,
                data.receipt_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога ремонта (не критично):', logErr.message);
    }
}
// DELETE /api/repair_items/:id - удаление запчасти из ремонта с возвратом количества на склад
router.delete('/repair_items/:id', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[DELETE REQUEST] Удаление запчасти из ремонта (repair_items)`);
    console.log(`[ID]:`, req.params.id);

    const itemId = req.params.id;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Находим удаляемую позицию запчасти в ремонте и блокируем её
        const itemCheck = await client.query('SELECT * FROM repair_items WHERE id = $1 FOR UPDATE', [itemId]);
        if (itemCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Позиция запчасти в ремонте не найдена.' });
        }

        const currentItem = itemCheck.rows[0];
        const repair_id = currentItem.repair_id;
        const zaphast_id = currentItem.zaphast_id;

        // 2. Проверяем родительский документ ремонта (repairs), его статус проведения, склад и машину
        const repairCheck = await client.query('SELECT doc_number, warehouse_id, car_id, is_posted FROM repairs WHERE id = $1 FOR UPDATE', [repair_id]);
        if (repairCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Родительский документ ремонта не найден.' });
        }

        const repairRecord = repairCheck.rows[0];
        const warehouseId = repairRecord.warehouse_id;
        const carId = repairRecord.car_id;
        const isPosted = repairRecord.is_posted;
        const documentNumber = repairRecord.doc_number || `РЕМОНТ-${repair_id}`;

        const isDocumentPosted = isPosted === true || isPosted === 'true' || isPosted === '1' || isPosted === 1 || isPosted === '2' || isPosted === 2;

        // 3. Если документ ремонта проведен, удалять из него позиции нельзя (нужна отмена проведения)
        if (isDocumentPosted) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нельзя удалять запчасти из уже проведенного ремонта. Сначала отмените проведение документа.' });
        }

        // Примечание по логике FIFO:
        // Поскольку документ ремонта не проведен, эта позиция учитывалась в расчетах остатков как зарезервированная.
        // При удалении строки из таблицы `repair_items` эта «бронь» снимается, 
        // и количество запчасти автоматически возвращается на склад (в ту самую партию по её исходной цене).

        // 4. Удаляем позицию из базы данных
        await client.query('DELETE FROM repair_items WHERE id = $1', [itemId]);

        // 5. Запись в repair_logs вместо audit_logs
        await writeRepairLog(client, req, {
            action: 'DELETE',
            repair_id: repair_id,
            document_number: documentNumber,
            warehouse_id: warehouseId,
            car_id: carId,
            zaphast_id: zaphast_id,
            quantity: currentItem.quantity,
            price: currentItem.price,
            total: currentItem.total,
            receipt_id: currentItem.receipt_id,
            description: currentItem.description || null
        });

        await client.query('COMMIT');

        console.log(`[SUCCESS] Запчасть успешно удалена из ремонта: ID ${itemId}`);
        return res.status(200).json({ message: 'Запчасть успешно удалена из ремонта', id: itemId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ [CRITICAL ERROR DELETE repair_items]:", err.message);
        console.error(err.stack);
        return res.status(500).json({ error: 'Ошибка сервера при удалении запчасти из ремонта: ' + err.message });
    } finally {
        client.release();
    }
});
// Функция для записи логов ремонта в таблицу repair_logs
async function writeRepairLog(client, req, data) {
    try {
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        const userId = currentUserId || req.body.user_id || null;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

        await client.query(
            `INSERT INTO repair_logs (
                action, repair_id, document_number, warehouse_id, car_id, 
                zaphast_id, quantity, price, total, receipt_id, 
                description, user_id, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                data.action,
                data.repair_id,
                data.document_number,
                data.warehouse_id,
                data.car_id,
                data.zaphast_id,
                data.quantity,
                data.price,
                data.total,
                data.receipt_id,
                data.description,
                userId,
                clientIp
            ]
        );
    } catch (logErr) {
        console.error('Ошибка записи лога ремонта (не критично):', logErr.message);
    }
}




// ==================== УНИВЕРСАЛЬНЫЙ POST С ЛОГИРОВАНИЕМ ====================
router.post('/:entity', async (req, res) => {
    const logsBuffer = []; // Буфер для сбора логов и отправки в браузер
    const browserLog = (msg) => {
        console.log(msg);
        logsBuffer.push(msg);
    };

    browserLog(`\n----------------------------------------`);
    browserLog(`[POST REQUEST] Сущность: ${req.params.entity}`);
    browserLog(`[BODY]: ${JSON.stringify(req.body)}`);

    try {
        let { entity } = req.params;

        if (entity === 'brands') { entity = 'car_brands'; }
        if (entity === 'models') { entity = 'car_models'; }
        if (entity === 'bodies') { entity = 'kyzov_type'; }
        
        // Обработка для поставщиков
        if (entity === 'postavhik-contacts' || entity === 'postavhik_ contacts') { 
            entity = 'postavhik_contacts'; 
        }

        // Обработка для покупателей
        if (entity === 'customer-contacts' || entity === 'customer_ contacts') { 
            entity = 'customer_contacts'; 
        }

        const allowedTables = [
            'users', 'spare_parts', 'car_brands', 'kyzov_type', 'bodies', 'car_models',
            'counterparties', 'postavhik', 'customers', 'counterparty_types', 
            'type_sklad', 'skladi', 'cars', 'type_rabot', 'works', 
            'ispolnitel', 'repair_types', 'gruppa_tsen', 'zaphasti', 
            'proizvoditel_zaphasti', 'gryppa_zamehenia', 'vidy_rabot',
            'toplivo', 'ed_izmereniya', 'mol', 'receipts',
            'moves', 'statuses', 'tehosmotr', 
            'autoservices', 'payment_types', 'autostrahovanie', 'accidents',
            'accident_invoices', 'accident_payments', 'accident_events', 'repairs', 'repair_works', 'mol_users', 'counterparty_contacts', 
            'postavhik_contacts', 'customer_contacts','part_discounts','service_discounts','customer_cars','realizations'
        ];

        if (!allowedTables.includes(entity)) {
            browserLog(`[ERROR] Недопустимая таблица: ${entity}`);
            return res.status(400).json({ 
                error: `Недопустимая таблица: ${entity}`,
                serverLogs: logsBuffer 
            });
        }

        if (entity === 'repairs') {
            if (req.body.repair_type !== undefined && req.body.repair_type_id === undefined) {
                req.body.repair_type_id = req.body.repair_type === '' ? null : req.body.repair_type;
            }
            delete req.body.repair_type;

            if (req.body.doc_type !== undefined && req.body.doc_type_id === undefined) {
                req.body.doc_type_id = req.body.doc_type === '' ? null : req.body.doc_type;
            }
            delete req.body.doc_type;
        }

        if (req.body.is_posted !== undefined) {
            if (req.body.is_posted === '' || req.body.is_posted === null) {
                delete req.body.is_posted; 
            } else {
                req.body.is_posted = req.body.is_posted === 'true' || req.body.is_posted === true || req.body.is_posted === '1' || req.body.is_posted === 1;
            }
        }

        if (entity === 'repair_works') {
            const { repair_id } = req.body;
            
            if (repair_id) {
                const repairCheck = await pool.query('SELECT is_posted FROM repairs WHERE id = $1', [repair_id]);
                if (repairCheck.rows.length > 0) {
                    const isPostedVal = repairCheck.rows[0].is_posted;
                    if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2) {
                        browserLog(`[ERROR] Попытка добавить работу в проведенный ремонт ID: ${repair_id}`);
                        return res.status(400).json({ 
                            error: 'Нельзя добавлять работы в уже проведенный ремонт!',
                            serverLogs: logsBuffer 
                        });
                    }
                }
            }
        }

        if (entity === 'tehosmotr') {
            if (!req.body.date) {
                req.body.date = new Date();
            }
            if (!req.body.to_date) {
                req.body.to_date = new Date();
            }

            if (!req.body.doc_number) {
                const countResult = await pool.query('SELECT COUNT(*) FROM tehosmotr');
                const nextId = Number(countResult.rows[0].count) + 1;
                req.body.doc_number = `ТО-${nextId}`;
            }
            
            if (!req.body.car_id) {
                return res.status(400).json({ error: 'Необходимо выбрать автомобиль!', serverLogs: logsBuffer });
            }
            if (req.body.sum === undefined || req.body.sum === null || req.body.sum === '') {
                return res.status(400).json({ error: 'Необходимо указать сумму!', serverLogs: logsBuffer });
            }
        }

        if (entity === 'autostrahovanie') {
            if (!req.body.date) {
                req.body.date = new Date();
            }
            if (!req.body.insurance_current) {
                req.body.insurance_current = new Date();
            }
            if (!req.body.insurance_next) {
                req.body.insurance_next = new Date();
            }

            if (!req.body.doc_number) {
                const countResult = await pool.query('SELECT COUNT(*) FROM autostrahovanie');
                const nextId = Number(countResult.rows[0].count) + 1;
                req.body.doc_number = `СТРАХ-${nextId}`;
            }
            
            if (!req.body.car_id) {
                return res.status(400).json({ error: 'Необходимо выбрать автомобиль!', serverLogs: logsBuffer });
            }
            if (req.body.sum === undefined || req.body.sum === null || req.body.sum === '') {
                return res.status(400).json({ error: 'Необходимо указать сумму!', serverLogs: logsBuffer });
            }
        }

        // Автоматически подставляем user_id из заголовков для receipts, moves, repairs и realizations
        const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
        if (!req.body.user_id && currentUserId && (entity === 'receipts' || entity === 'moves' || entity === 'repairs' || entity === 'realizations')) {
            req.body.user_id = currentUserId;
        }

        const keys = Object.keys(req.body);
        const values = Object.values(req.body);

        if (keys.length === 0) {
            browserLog(`[ERROR] Пустое тело запроса`);
            return res.status(400).json({ error: 'Нет данных для сохранения', serverLogs: logsBuffer });
        }

        const processedValues = values.map(val => val === '' ? null : val);
        const columns = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        const query = `INSERT INTO "${entity}" (${columns}) VALUES (${placeholders}) RETURNING *;`;
        const result = await pool.query(query, processedValues);
        const newRecord = result.rows[0];

        // ==================== ПОЛНОЕ УНИВЕРСАЛЬНОЕ ЛОГИРОВАНИЕ (ОБЩИЙ INSERT) ====================
        try {
            const userId = currentUserId || req.body.user_id || null;
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
            
            await pool.query(
                `INSERT INTO audit_logs (user_id, action, table_name, record_id, details, ip_address) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    userId,
                    'INSERT',
                    entity,
                    newRecord.id || null,
                    JSON.stringify(req.body),
                    clientIp
                ]
            );
        } catch (logErr) {
            console.error('❌ [AUDIT ERROR] Не удалось записать лог:', logErr.message);
        }
        // ======================================================================================

        browserLog(`[SUCCESS] Запись успешно добавлена в таблицу ${entity}, ID: ${newRecord.id}`);
        
        // Возвращаем запись и логи для браузера
        res.status(201).json({
            ...newRecord,
            serverLogs: logsBuffer
        });

    } catch (err) {
        console.error("❌ [CRITICAL ERROR НА СЕРВЕРЕ]:", err.message);
        console.error(err.stack);
        res.status(500).json({ 
            error: 'Ошибка сервера при добавлении: ' + err.message,
            serverLogs: logsBuffer 
        });
    }
});
// ==========================================
// УНИВЕРСАЛЬНЫЙ PUT (ПРОФЕССИОНАЛЬНЫЙ С ЛОГИРОВАНИЕМ И ЗАЩИТОЙ)
// ==========================================
router.put('/:entity/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        let { entity, id } = req.params;

        if (entity === 'brands') entity = 'car_brands';
        if (entity === 'models') entity = 'car_models';
        if (entity === 'bodies') entity = 'kyzov_type';

        const allowedTables = [
            'users', 'spare_parts', 'car_brands', 'kyzov_type', 'bodies', 'car_models',
            'counterparties', 'postavhik', 'customers', 'counterparty_types', 
            'type_sklad', 'skladi', 'cars', 'type_rabot', 'works', 
            'ispolnitel', 'repair_types', 'gruppa_tsen', 'zaphasti', 
            'proizvoditel_zaphasti', 'gryppa_zamehenia', 'vidy_rabot',
            'toplivo', 'ed_izmereniya', 'mol', 'receipts',
            'moves', 'statuses', 'tehosmotr',
            'autoservices', 'payment_types', 'autostrahovanie', 'accidents',
            'accident_invoices', 'accident_payments', 'accident_events', 'repairs', 'repair_works', 'mol_users', 'counterparty_contacts', 
            'postavhik_contacts', 'customer_contacts','part_discounts','service_discounts','customer_cars','realizations'
        ];

        if (!allowedTables.includes(entity)) {
            return res.status(400).json({ error: `Недопустимая таблица: ${entity}` });
        }

        if (entity === 'accidents' && req.body.car_model !== undefined) {
            delete req.body.car_model;
        }

        if (entity === 'repairs') {
            if (req.body.repair_type !== undefined && req.body.repair_type_id === undefined) {
                req.body.repair_type_id = req.body.repair_type === '' ? null : req.body.repair_type;
            }
            delete req.body.repair_type;

            if (req.body.doc_type !== undefined && req.body.doc_type_id === undefined) {
                req.body.doc_type_id = req.body.doc_type === '' ? null : req.body.doc_type;
            }
            delete req.body.doc_type;
        }

        if (req.body.is_posted !== undefined) {
            if (req.body.is_posted === '' || req.body.is_posted === null) {
                delete req.body.is_posted;
            } else {
                req.body.is_posted = req.body.is_posted === 'true' || req.body.is_posted === true || req.body.is_posted === '1' || req.body.is_posted === 1;
            }
        }

        await client.query('BEGIN');

        // Получаем старую запись для сравнения изменений (что на что поменялось)
        const currentDocRes = await client.query(`SELECT * FROM "${entity}" WHERE id = $1 FOR UPDATE`, [id]);
        if (currentDocRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Запись не найдена' });
        }
        const oldDoc = currentDocRes.rows[0];

        const docWithStatusTables = ['tehosmotr', 'autostrahovanie', 'receipts', 'moves', 'accidents', 'repairs', 'realizations'];
        if (docWithStatusTables.includes(entity)) {
            const oldIsPosted = oldDoc.is_posted === true || oldDoc.is_posted === 'true' || oldDoc.is_posted === 1 || oldDoc.is_posted === '1';

            if (oldIsPosted) {
                const allowedKeysForPosted = ['is_posted', 'fact_date'];
                const incomingKeys = Object.keys(req.body);

                for (const key of incomingKeys) {
                    if (!allowedKeysForPosted.includes(key)) {
                        delete req.body[key];
                    }
                }
            }
        }

        if (entity === 'repair_works') {
            const targetRepairId = req.body.repair_id || oldDoc.repair_id;

            if (targetRepairId) {
                const repairCheck = await client.query('SELECT is_posted FROM repairs WHERE id = $1', [targetRepairId]);
                if (repairCheck.rows.length > 0) {
                    const isPostedVal = repairCheck.rows[0].is_posted;
                    if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2 || isPostedVal === 1) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'Нельзя изменять работы в уже проведенном ремонте!' });
                    }
                }
            }
        }

        const keys = Object.keys(req.body);
        const values = Object.values(req.body);

        if (keys.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нет данных для обновления или документ защищен от изменений' });
        }

        const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
        const processedValues = values.map(val => val === '' ? null : val);

        const query = `UPDATE "${entity}" SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *;`;
        const result = await client.query(query, [...processedValues, id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Запись не найдена' });
        }

        const updatedDoc = result.rows[0];

        // ==================== АВТОМАТИЧЕСКАЯ ЗАПИСЬ ЛОГА (UPDATE с детализацией изменений) ====================
        try {
            const currentUserId = req.headers['x-user-id'] || req.headers['user-id'] || null;
            const userId = currentUserId || req.body.user_id || oldDoc.user_id || null;
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

            // Сравниваем старые и новые значения по измененным полям
            const changes = {};
            for (const key of keys) {
                const oldValue = oldDoc[key];
                const newValue = updatedDoc[key];
                if (String(oldValue) !== String(newValue)) {
                    changes[key] = {
                        from: oldValue,
                        to: newValue
                    };
                }
            }

            const detailsObj = {
                updated_fields: req.body,
                changes: changes
            };

            // Проверяем структуру таблицы audit_logs (наличие колонки table_name / ip_address для совместимости)
            await client.query(
                `INSERT INTO audit_logs (user_id, action, table_name, record_id, details, ip_address) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    userId,
                    'UPDATE',
                    entity,
                    id,
                    JSON.stringify(detailsObj),
                    clientIp
                ]
            );
        } catch (logErr) {
            console.error('Ошибка записи лога (не критично):', logErr.message);
        }
        // ============================================================================

        await client.query('COMMIT');
        res.json(updatedDoc);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Ошибка при обновлении в БД:", err.message);
        res.status(500).json({ error: 'Ошибка сервера при обновлении: ' + err.message });
    } finally {
        client.release();
    }
});

// ==========================================
// УНИВЕРСАЛЬНЫЙ DELETE (ПРОФЕССИОНАЛЬНЫЙ С ЛОГИРОВАНИЕМ И ЗАЩИТОЙ)
// ==========================================

router.delete('/:entity/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        let { entity, id } = req.params;

        if (entity === 'brands') entity = 'car_brands';
        if (entity === 'models') entity = 'car_models';
        if (entity === 'bodies') entity = 'kyzov_type';

        const allowedTables = [
            'users', 'spare_parts', 'car_brands', 'kyzov_type', 'bodies', 'car_models',
            'counterparties', 'postavhik', 'customers', 'counterparty_types', 
            'type_sklad', 'skladi', 'cars', 'type_rabot', 'works', 
            'ispolnitel', 'repair_types', 'gruppa_tsen', 'zaphasti', 
            'proizvoditel_zaphasti', 'gryppa_zamehenia', 'vidy_rabot',
            'toplivo', 'ed_izmereniya', 'mol', 'receipts',
            'moves', 'statuses', 'tehosmotr',
            'autoservices', 'payment_types', 'autostrahovanie', 'accidents',
            'accident_invoices', 'accident_payments', 'accident_events', 'repairs', 'repair_works','mol_users','counterparty_contacts','postavhik_contacts', 'customer_contacts',
            'customer_cars','part_discounts','service_discounts','realizations'
        ];

        if (!allowedTables.includes(entity)) {
            return res.status(400).json({ error: `Недопустимая таблица: ${entity}` });
        }

        await client.query('BEGIN');

        if (entity === 'receipts' || entity === 'moves' || entity === 'tehosmotr' || entity === 'autostrahovanie' || entity === 'accidents' || entity === 'repairs') {
            const docCheck = await client.query(`SELECT is_posted FROM "${entity}" WHERE id = $1`, [id]);
            if (docCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Запись с таким ID не найдена' });
            }
            const isPosted = docCheck.rows[0].is_posted;
            if (isPosted === true || isPosted === 'true' || isPosted === 2 || isPosted === 1) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Нельзя удалить уже проведенный документ!' });
            }
        }

        if (entity === 'repair_works') {
            const itemRes = await client.query('SELECT repair_id FROM repair_works WHERE id = $1', [id]);
            if (itemRes.rows.length > 0 && itemRes.rows[0].repair_id) {
                const parentCheck = await client.query('SELECT is_posted FROM repairs WHERE id = $1', [itemRes.rows[0].repair_id]);
                if (parentCheck.rows.length > 0) {
                    const pVal = parentCheck.rows[0].is_posted;
                    if (pVal === true || pVal === 'true' || pVal === 2 || pVal === 1) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'Нельзя удалять работы из проведенного ремонта!' });
                    }
                }
            }
        }

        if (entity === 'receipts') {
            await client.query('DELETE FROM receipt_items WHERE receipt_id = $1', [id]);
        } else if (entity === 'moves') {
            await client.query('DELETE FROM move_items WHERE move_id = $1', [id]);
        } else if (entity === 'repairs') {
            await client.query('DELETE FROM repair_items WHERE repair_id = $1', [id]);
            await client.query('DELETE FROM repair_works WHERE repair_id = $1', [id]);
        } else if (entity === 'accidents') {
            await client.query('DELETE FROM accident_invoices WHERE dtp_id = $1', [id]);
            await client.query('DELETE FROM accident_payments WHERE dtp_id = $1', [id]);
            await client.query('DELETE FROM accident_events WHERE dtp_id = $1', [id]);
        }

        const query = `DELETE FROM "${entity}" WHERE id = $1 RETURNING *;`;
        const result = await client.query(query, [id]);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Запись с таким ID не найдена' });
        }

        // ==================== АВТОМАТИЧЕСКАЯ ЗАПИСЬ ЛОГА (DELETE) ====================
        try {
            const userId = req.headers['x-user-id'] || req.body.user_id || null;
            const deletedData = result.rows[0];
            const detailsStr = Object.entries(deletedData)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');

            await client.query(
                `INSERT INTO audit_logs (user_id, entity, action, record_id, details) VALUES ($1, $2, $3, $4, $5)`,
                [userId, entity, 'DELETE', id, `Удалена запись. Данные: ${detailsStr}`]
            );
        } catch (logErr) {
            console.error('Ошибка записи лога удаления (не критично):', logErr.message);
        }
        // ============================================================================

        await client.query('COMMIT');
        res.json({ message: 'Запись успешно удалена', deleted: result.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Ошибка при удалении из БД:", err.message);
        res.status(500).json({ error: 'Ошибка сервера при удалении: ' + err.message });
    } finally {
        client.release();
    }
});

return router;
};