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

// 1. Получение списка логов для таблицы (GET)
router.get('/get-logs', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                audit_logs.id, 
                users.login AS user_name, 
                audit_logs.entity,
                audit_logs.action, 
                audit_logs.record_id,
                audit_logs.details, 
                audit_logs.created_at 
            FROM audit_logs 
            LEFT JOIN users ON audit_logs.user_id = users.id 
            ORDER BY audit_logs.created_at DESC
        `);
        return res.json(result.rows);
    } catch (err) {
        console.error('Ошибка получения логов:', err.message);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});
    // Открытие самой страницы logs.html по адресу /logs (GET)
    router.get('/logs', (req, res) => {
        res.sendFile(path.join(__dirname, '../logs.html'));
    });

    // 2. ПОЛУЧЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ (С полными логами)
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


// Роут получения покупателей с JOIN
router.get('/customers', async (req, res) => {
    try {
        const query = `
            SELECT c.*, t.name AS type_name 
            FROM customers c 
            LEFT JOIN counterparty_types t ON c.type_id = t.id 
            ORDER BY c.id ASC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка при получении покупателей');
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

router.get('/car_details', async (req, res) => {
    try {
        const query = `
            SELECT 
                cd.*, 
                c.gos_number AS car_gos_number,
                m.name AS car_model_name
            FROM car_details cd
            LEFT JOIN cars c ON cd.car_id = c.id
            LEFT JOIN car_models m ON c.model_id = m.id
            ORDER BY cd.id ASC
        `;
        const result = await pool.query(query);
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
// ==================== ОСТАТКИ ЗАПЧАСТЕЙ (СУММАРНО ПО СКЛАДАМ) ====================
router.get('/stock_balances', async (req, res) => {
    try {
        const { date, warehouse_id, mol_id } = req.query;

        const queryParams = [];
        let paramIndex = 1;

        let dateConditionReceipts = '';
        let dateConditionMoves = '';
        let dateConditionRepairs = '';

        // Фильтр по дате: берем всё С выбранной даты и до текущего момента (>=)
        if (date && date.trim() !== '' && date !== 'undefined' && date !== 'null') {
            const formattedDate = date.replace('T', ' '); // Корректируем формат из datetime-local
            queryParams.push(formattedDate);
            dateConditionReceipts = `AND r.date >= $${paramIndex}::timestamp`;
            dateConditionMoves = `AND m.date >= $${paramIndex}::timestamp`;
            dateConditionRepairs = `AND rep.doc_date >= $${paramIndex}::timestamp`;
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
                HAVING SUM(qty) > 0 -- Показываем только то, что есть в наличии (> 0)
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
                st.total_qty AS qty,
                COALESCE(z.unit, 'шт') AS unit
            FROM aggregated_stocks st
            JOIN zaphasti z ON st.zaphasti_id = z.id
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
            queryParams.push(warehouse_id);
            extraFilters += ` AND warehouse_id = $${paramIndex}`;
            paramIndex++;
        }

        if (mol_id && mol_id.trim() !== '' && mol_id !== 'undefined') {
            queryParams.push(mol_id);
            extraFilters += ` AND mol_id = $${paramIndex}`;
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
                    (ri.quantity * COALESCE(ri.price, 0)) AS sum_in,
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
                WHERE m.warehouse_to_id IS NOT NULL

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
                WHERE m.warehouse_from_id IS NOT NULL

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
                WHERE rep.warehouse_id IS NOT NULL
            ),
            filtered_ops AS (
                SELECT * FROM all_operations d
                WHERE 1=1 ${extraFilters} ${dateCondition}
            ),
            calculated_turnover AS (
                SELECT 
                    zaphasti_id,
                    warehouse_id,
                    
                    -- Приход за период
                    SUM(qty_in) AS income_qty,
                    SUM(sum_in) AS income_sum,
                    
                    -- Расход за период (включая перемещения и ремонты)
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


// ==================== ДЕТАЛЬНОЕ ДВИЖЕНИЕ КОНКРЕТНОЙ ЗАПЧАСТИ ====================
router.get('/part_movement_details', async (req, res) => {
    try {
        const { zaphasti_id, warehouse_id, start_date, end_date, mol_id } = req.query;

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
            warehouseCondition += ` AND (warehouse_from_id = $${paramIndex}::int OR warehouse_to_id = $${paramIndex}::int)`;
            paramIndex++;
        }

        const query = `
            WITH all_ops AS (
                -- 1. Приходы (Поставщик -> Склад) — ВСЕГДА ПЛЮС
                SELECT 
                    r.date AS op_date,
                    r.doc_number AS doc_num,
                    'Приход запчастей' AS doc_type,
                    COALESCE(k.name, 'Поставщик не указан') AS source_info,
                    CONCAT(COALESCE(s.name, 'Склад'), ' | ', COALESCE(u.name, 'МОЛ не назначен')) AS dest_info,
                    ri.quantity AS qty,
                    COALESCE(ri.price, 0) AS price,
                    (ri.quantity * COALESCE(ri.price, 0)) AS sum,
                    ri.description,
                    NULL::int AS warehouse_from_id,
                    r.warehouse_id AS warehouse_to_id
                FROM receipt_items ri
                JOIN receipts r ON ri.receipt_id = r.id
                LEFT JOIN counterparties k ON r.supplier_id = k.id
                LEFT JOIN skladi s ON r.warehouse_id = s.id
                LEFT JOIN mol m_mol ON r.mol_id = m_mol.id
                LEFT JOIN users u ON m_mol.user_id = u.id
                WHERE ri.zaphasti_id = $1

                UNION ALL

                -- 2. Перемещения (Склад-источник -> Склад-получатель)
                -- Если выбран конкретный склад и он источник -> МИНУС (ушло). Если получатель -> ПЛЮС (пришло).
                SELECT 
                    m.date AS op_date,
                    m.doc_number AS doc_num,
                    'Перемещение' AS doc_type,
                    CONCAT(COALESCE(s_from.name, 'Склад'), ' | ', COALESCE(u_from.name, 'МОЛ')) AS source_info,
                    CONCAT(COALESCE(s_to.name, 'Склад'), ' | ', COALESCE(u_to.name, 'МОЛ')) AS dest_info,
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
                    m.warehouse_to_id
                FROM move_items mi
                JOIN moves m ON mi.move_id = m.id
                LEFT JOIN skladi s_from ON m.warehouse_from_id = s_from.id
                LEFT JOIN mol mol_from ON m.mol_from_id = mol_from.id
                LEFT JOIN users u_from ON mol_from.user_id = u_from.id
                LEFT JOIN skladi s_to ON m.warehouse_to_id = s_to.id
                LEFT JOIN mol mol_to ON m.mol_to_id = mol_to.id
                LEFT JOIN users u_to ON mol_to.user_id = u_to.id
                WHERE mi.zaphasti_id = $1

                UNION ALL

                -- 3. Ремонты / Расход (Склад -> Автомобиль) — ВСЕГДА МИНУС (списание)
                SELECT 
                    rep.doc_date AS op_date,
                    rep.doc_number AS doc_num,
                    'Ремонт база' AS doc_type,
                    CONCAT(COALESCE(s_rep.name, 'Склад'), ' | ', COALESCE(u_rep.name, 'МОЛ')) AS source_info,
                    CONCAT(COALESCE(car.gos_number, 'Авто'), ' | ', COALESCE(car.model, '')) AS dest_info,
                    (-1 * ri_rep.quantity) AS qty,
                    COALESCE(ri_rep.price, 0) AS price,
                    (-1 * ri_rep.quantity * COALESCE(ri_rep.price, 0)) AS sum,
                    ri_rep.description,
                    rep.warehouse_id AS warehouse_from_id,
                    NULL::int AS warehouse_to_id
                FROM repair_items ri_rep
                JOIN repairs rep ON ri_rep.repair_id = rep.id
                LEFT JOIN skladi s_rep ON rep.warehouse_id = s_rep.id
                LEFT JOIN mol mol_rep ON rep.mol_id = mol_rep.id
                LEFT JOIN users u_rep ON mol_rep.user_id = u_rep.id
                LEFT JOIN cars car ON rep.car_id = car.id
                WHERE ri_rep.zaphast_id = $1
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


// ==================== УНИВЕРСАЛЬНЫЙ POST С ЛОГИРОВАНИЕМ ====================
router.post('/:entity', async (req, res) => {
    console.log(`\n----------------------------------------`);
    console.log(`[POST REQUEST] Сущность: ${req.params.entity}`);
    console.log(`[BODY]:`, req.body);

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
            'toplivo', 'ed_izmereniya', 'mol', 'receipts', 'receipt_items',
            'moves', 'move_items', 'statuses', 'tehosmotr', 
            'autoservices', 'payment_types', 'autostrahovanie', 'accidents',
            'accident_invoices', 'accident_payments', 'accident_events', 'repairs',
            'repair_items', 'repair_works', 'mol_users', 'counterparty_contacts', 
            'postavhik_contacts', 'customer_contacts'
        ];

        if (!allowedTables.includes(entity)) {
            console.log(`[ERROR] Недопустимая таблица: ${entity}`);
            return res.status(400).json({ error: `Недопустимая таблица: ${entity}` });
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

        // Безопасная проверка req.body, чтобы избежать ошибки чтения undefined
        if (req.body && req.body.is_posted !== undefined) {
            if (req.body.is_posted === '' || req.body.is_posted === null) {
                delete req.body.is_posted; 
            } else {
                req.body.is_posted = req.body.is_posted === 'true' || req.body.is_posted === true || req.body.is_posted === '1' || req.body.is_posted === 1;
            }
        }

        if (entity === 'repair_items') {
            const { zaphast_id, price, quantity, description, repair_id, receipt_id } = req.body;
            const requestedQty = Number(quantity) || 0;
            const numPrice = Number(price) || 0;
                
            console.log(`[REPAIR_ITEMS] Проверка списания запчасти ID=${zaphast_id}, запрошено кол-во=${requestedQty}`);

            // Открываем транзакцию для безопасной проверки и списания
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                if (repair_id) {
                    const repairCheck = await client.query('SELECT is_posted, warehouse_id FROM repairs WHERE id = $1 FOR UPDATE', [repair_id]);
                    if (repairCheck.rows.length > 0) {
                        const isPostedVal = repairCheck.rows[0].is_posted;
                        const warehouseId = repairCheck.rows[0].warehouse_id;

                        if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2) {
                            console.log(`[ERROR] Попытка изменить проведенный документ ремонта ID: ${repair_id}`);
                            await client.query('ROLLBACK');
                            return res.status(400).json({ error: 'Нельзя добавлять запчасти в уже проведенный ремонт!' });
                        }

                        if (warehouseId) {
                            const balanceQuery = `
                                SELECT 
                                    (
                                        COALESCE((SELECT SUM(ri.quantity) FROM receipt_items ri JOIN receipts r ON ri.receipt_id = r.id WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2), 0) +
                                        COALESCE((SELECT SUM(mi_to.quantity) FROM move_items mi_to JOIN moves m_to ON mi_to.move_id = m_to.id WHERE mi_to.zaphasti_id = $1 AND m_to.warehouse_to_id = $2), 0)
                                    ) - 
                                    (
                                        COALESCE((SELECT SUM(mi_from.quantity) FROM move_items mi_from JOIN moves m_from ON mi_from.move_id = m_from.id WHERE mi_from.zaphasti_id = $1 AND m_from.warehouse_from_id = $2), 0) +
                                        COALESCE((SELECT SUM(rep_i.quantity) FROM repair_items rep_i JOIN repairs rep ON rep_i.repair_id = rep.id WHERE rep_i.zaphast_id = $1 AND rep.warehouse_id = $2), 0)
                                    ) 
                                AS available_qty
                            `;
                            
                            const balanceRes = await client.query(balanceQuery, [zaphast_id, warehouseId]);
                            const availableStock = Number(balanceRes.rows[0].available_qty) || 0;

                            console.log(`[STOCK DEBUG] Склад ремонта ID=${warehouseId}, доступно: ${availableStock}, запрошено: ${requestedQty}`);

                            if (requestedQty > availableStock) {
                                console.log(`[ERROR] Недостаточно остатка на складе ремонта! Доступно: ${availableStock}, запрошено: ${requestedQty}`);
                                await client.query('ROLLBACK');
                                return res.status(400).json({ 
                                    error: `Недостаточно запчастей на складе этого ремонта! Доступно: ${availableStock} шт., а вы пытаетесь списать: ${requestedQty} шт.` 
                                });
                            }
                        }
                    }
                }

                let targetReceiptId = receipt_id;
                if (!targetReceiptId) {
                    const docQuery = `
                        SELECT RI.receipt_id 
                        FROM receipt_items RI
                        JOIN receipts R ON RI.receipt_id = R.id
                        WHERE RI.zaphasti_id = $1
                        ORDER BY R.date ASC, R.id ASC
                        LIMIT 1
                    `;
                    const docResult = await client.query(docQuery, [zaphast_id]);
                    if (docResult.rows.length > 0) {
                        targetReceiptId = docResult.rows[0].receipt_id;
                    }
                }

                const totalSum = numPrice * requestedQty;
                const query = `
                    INSERT INTO "repair_items" 
                    ("zaphast_id", "price", "quantity", "description", "repair_id", "total", "receipt_id") 
                    VALUES ($1, $2, $3, $4, $5, $6, $7) 
                    RETURNING *;
                `;
                
                const values = [
                    zaphast_id || null, 
                    numPrice, 
                    requestedQty, 
                    description || null, 
                    repair_id || null, 
                    totalSum, 
                    targetReceiptId || null
                ];
                
                const result = await client.query(query, values);
                const newRecord = result.rows[0];

                // ==================== ПОЛНОЕ ЛОГИРОВАНИЕ (repair_items) ====================
                try {
                    const userId = req.headers['user-id'] || req.body.user_id || null;
                    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
                    await client.query(
                        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details, ip_address) 
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [userId, 'INSERT', 'repair_items', newRecord.id, JSON.stringify(req.body), clientIp]
                    );
                } catch (logErr) {
                    console.error('Ошибка записи audit_logs:', logErr.message);
                }
                // =========================================================================

                await client.query('COMMIT');
                client.release();

                console.log(`[SUCCESS] Успешно добавлена запчасть в ремонт ID: ${newRecord.id}`);
                return res.status(201).json(newRecord);

            } catch (txErr) {
                await client.query('ROLLBACK');
                client.release();
                throw txErr;
            }
        }

        if (entity === 'repair_works') {
            const { repair_id } = req.body;
            
            if (repair_id) {
                const repairCheck = await pool.query('SELECT is_posted FROM repairs WHERE id = $1', [repair_id]);
                if (repairCheck.rows.length > 0) {
                    const isPostedVal = repairCheck.rows[0].is_posted;
                    if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2) {
                        console.log(`[ERROR] Попытка добавить работу в проведенный ремонт ID: ${repair_id}`);
                        return res.status(400).json({ error: 'Нельзя добавлять работы в уже проведенный ремонт!' });
                    }
                }
            }
        }

        if (entity === 'receipt_items') {
            const { zaphasti_id, price, currency, quantity, description, receipt_id } = req.body;
            
            if (receipt_id) {
                const receiptCheck = await pool.query('SELECT is_posted FROM receipts WHERE id = $1', [receipt_id]);
                if (receiptCheck.rows.length > 0) {
                    const isPostedVal = receiptCheck.rows[0].is_posted;
                    if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2) {
                        console.log(`[ERROR] Попытка изменить проведенный документ прихода ID: ${receipt_id}`);
                        return res.status(400).json({ error: 'Нельзя добавлять запчасти в уже проведенный документ!' });
                    }
                }
            }

            const numPrice = Number(price) || 0;
            const numQty = Number(quantity) || 0;
            const priceRub = numPrice; 
            const totalRub = numPrice * numQty;

            const query = `
                INSERT INTO "receipt_items" 
                ("zaphasti_id", "price", "currency", "quantity", "description", "receipt_id", "price_rub", "total_rub") 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
                RETURNING *;
            `;
            
            const values = [zaphasti_id, numPrice, currency, numQty, description, receipt_id, priceRub, totalRub];
            const result = await pool.query(query, values);
            const newRecord = result.rows[0];

            // ==================== ПОЛНОЕ ЛОГИРОВАНИЕ (receipt_items) ====================
            try {
                const userId = req.headers['user-id'] || req.body.user_id || null;
                const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
                await pool.query(
                    `INSERT INTO audit_logs (user_id, action, table_name, record_id, details, ip_address) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [userId, 'INSERT', 'receipt_items', newRecord.id, JSON.stringify(req.body), clientIp]
                );
            } catch (logErr) {
                console.error('Ошибка записи audit_logs:', logErr.message);
            }
            // =========================================================================

            console.log(`[SUCCESS] Успешно добавлена строка прихода ID: ${newRecord.id}`);
            return res.status(201).json(newRecord);
        }

        if (entity === 'move_items') {
            const { zaphasti_id, price, currency, quantity, description, move_id } = req.body;
            const requestedQty = Number(quantity) || 0;
            const numPrice = Number(price) || 0;
            
            console.log(`[MOVE_ITEMS] Проверка перемещения запчасти ID=${zaphasti_id}, запрошено кол-во=${requestedQty}`);

            // Открываем транзакцию для безопасной проверки остатков при перемещении
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                if (move_id) {
                    const moveCheck = await client.query('SELECT is_posted, warehouse_from_id FROM moves WHERE id = $1 FOR UPDATE', [move_id]);
                    if (moveCheck.rows.length > 0) {
                        const isPostedVal = moveCheck.rows[0].is_posted;
                        const warehouseFromId = moveCheck.rows[0].warehouse_from_id;

                        if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2) {
                            console.log(`[ERROR] Попытка изменить проведенный документ перемещения ID: ${move_id}`);
                            await client.query('ROLLBACK');
                            return res.status(400).json({ error: 'Нельзя добавлять товары в уже проведенный документ перемещения!' });
                        }

                        if (warehouseFromId) {
                            const balanceQuery = `
                                SELECT 
                                    (
                                        COALESCE((SELECT SUM(ri.quantity) FROM receipt_items ri JOIN receipts r ON ri.receipt_id = r.id WHERE ri.zaphasti_id = $1 AND r.warehouse_id = $2), 0) +
                                        COALESCE((SELECT SUM(mi_to.quantity) FROM move_items mi_to JOIN moves m_to ON mi_to.move_id = m_to.id WHERE mi_to.zaphasti_id = $1 AND m_to.warehouse_to_id = $2), 0)
                                    ) - 
                                    (
                                        COALESCE((SELECT SUM(mi_from.quantity) FROM move_items mi_from JOIN moves m_from ON mi_from.move_id = m_from.id WHERE mi_from.zaphasti_id = $1 AND m_from.warehouse_from_id = $2 AND m_from.id != $3), 0) +
                                        COALESCE((SELECT SUM(rep_i.quantity) FROM repair_items rep_i JOIN repairs rep ON rep_i.repair_id = rep.id WHERE rep_i.zaphast_id = $1 AND rep.warehouse_id = $2), 0)
                                    ) 
                                AS available_qty
                            `;
                            
                            const balanceRes = await client.query(balanceQuery, [zaphasti_id, warehouseFromId, move_id]);
                            const availableStock = Number(balanceRes.rows[0].available_qty) || 0;

                            console.log(`[STOCK DEBUG] Склад-источник ID=${warehouseFromId}, доступно: ${availableStock}, запрошено: ${requestedQty}`);

                            if (requestedQty > availableStock) {
                                console.log(`[ERROR] Недостаточно остатка на складе! Доступно: ${availableStock}, запрошено: ${requestedQty}`);
                                await client.query('ROLLBACK');
                                return res.status(400).json({ 
                                    error: `Недостаточно товара на выбранном складе! Доступно: ${availableStock} шт., а вы пытаетесь переместить: ${requestedQty} шт.` 
                                });
                            }
                        }
                    }
                }

                const docQuery = `
                    SELECT RI.receipt_id 
                    FROM receipt_items RI
                    JOIN receipts R ON RI.receipt_id = R.id
                    WHERE RI.zaphasti_id = $1
                    ORDER BY R.date ASC, R.id ASC
                    LIMIT 1
                `;
                const docResult = await client.query(docQuery, [zaphasti_id]);
                const income_document_id = docResult.rows.length > 0 ? docResult.rows[0].receipt_id : null;

                const priceRub = numPrice; 
                const totalRub = requestedQty * priceRub;

                const query = `
                    INSERT INTO "move_items" 
                    ("zaphasti_id", "price", "currency", "quantity", "price_rub", "total_rub", "description", "move_id", "income_document_id") 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                    RETURNING *;
                `;
                
                const values = [
                    zaphasti_id, 
                    numPrice, 
                    currency || 'Рубль ПМР', 
                    requestedQty, 
                    priceRub, 
                    totalRub, 
                    description, 
                    move_id, 
                    income_document_id 
                ];
                
                const result = await client.query(query, values);
                const newRecord = result.rows[0];

                // ==================== ПОЛНОЕ ЛОГИРОВАНИЕ (move_items) ====================
                try {
                    const userId = req.headers['user-id'] || req.body.user_id || null;
                    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
                    await client.query(
                        `INSERT INTO audit_logs (user_id, action, table_name, record_id, details, ip_address) 
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [userId, 'INSERT', 'move_items', newRecord.id, JSON.stringify(req.body), clientIp]
                    );
                } catch (logErr) {
                    console.error('Ошибка записи audit_logs:', logErr.message);
                }
                // =========================================================================

                await client.query('COMMIT');
                client.release();

                console.log(`[SUCCESS] Строка перемещения успешно создана с ID: ${newRecord.id}`);
                return res.status(201).json(newRecord);

            } catch (txErr) {
                await client.query('ROLLBACK');
                client.release();
                throw txErr;
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
                return res.status(400).json({ error: 'Необходимо выбрать автомобиль!' });
            }
            if (req.body.sum === undefined || req.body.sum === null || req.body.sum === '') {
                return res.status(400).json({ error: 'Необходимо указать сумму!' });
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
                return res.status(400).json({ error: 'Необходимо выбрать автомобиль!' });
            }
            if (req.body.sum === undefined || req.body.sum === null || req.body.sum === '') {
                return res.status(400).json({ error: 'Необходимо указать сумму!' });
            }
        }

        const keys = Object.keys(req.body);
        const values = Object.values(req.body);

        if (keys.length === 0) {
            console.log(`[ERROR] Пустое тело запроса`);
            return res.status(400).json({ error: 'Нет данных для сохранения' });
        }

        const processedValues = values.map(val => val === '' ? null : val);
        const columns = keys.map(k => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        const query = `INSERT INTO "${entity}" (${columns}) VALUES (${placeholders}) RETURNING *;`;
        const result = await pool.query(query, processedValues);
        const newRecord = result.rows[0];

        // ==================== ПОЛНОЕ УНИВЕРСАЛЬНОЕ ЛОГИРОВАНИЕ (ОБЩИЙ INSERT) ====================
        try {
            const userId = req.headers['user-id'] || req.body.user_id || null;
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

        console.log(`[SUCCESS] Запись успешно добавлена в таблицу ${entity}, ID: ${newRecord.id}`);
        res.status(201).json(newRecord);

    } catch (err) {
        console.error("❌ [CRITICAL ERROR НА СЕРВЕРЕ]:", err.message);
        console.error(err.stack);
        res.status(500).json({ error: 'Ошибка сервера при добавлении: ' + err.message });
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
            'toplivo', 'ed_izmereniya', 'mol', 'receipts', 'receipt_items',
            'moves', 'move_items', 'statuses', 'tehosmotr',
            'autoservices', 'payment_types', 'autostrahovanie', 'accidents',
            'accident_invoices', 'accident_payments', 'accident_events', 'repairs',
            'repair_items', 'repair_works', 'mol_users', 'counterparty_contacts', 
            'postavhik_contacts', 'customer_contacts'
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

        const docWithStatusTables = ['tehosmotr', 'autostrahovanie', 'receipts', 'moves', 'accidents', 'repairs'];
        if (docWithStatusTables.includes(entity)) {
            // Добавлен FOR UPDATE для блокировки шапки документа от гонок
            const currentDocRes = await client.query(`SELECT * FROM "${entity}" WHERE id = $1 FOR UPDATE`, [id]);
            if (currentDocRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Запись не найдена' });
            }
            const oldDoc = currentDocRes.rows[0];
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
            // Добавлен FOR UPDATE
            const oldItemRes = await client.query('SELECT * FROM "repair_works" WHERE id = $1 FOR UPDATE', [id]);
            if (oldItemRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Запись не найдена' });
            }
            const oldItem = oldItemRes.rows[0];
            const targetRepairId = req.body.repair_id || oldItem.repair_id;

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

        if (entity === 'move_items' || entity === 'receipt_items' || entity === 'repair_items') {
            if (req.body.quantity !== undefined || req.body.price !== undefined) {
                const newQty = Number(req.body.quantity !== undefined ? req.body.quantity : 0);
                const newPrice = Number(req.body.price !== undefined ? req.body.price : 0);

                if (newQty < 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Количество не может быть отрицательным' });
                }

                if (entity === 'move_items') {
                    // Добавлен FOR UPDATE
                    const oldItemRes = await client.query('SELECT * FROM "move_items" WHERE id = $1 FOR UPDATE', [id]);
                    if (oldItemRes.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(404).json({ error: 'Запись не найдена' });
                    }
                    const oldItem = oldItemRes.rows[0];
                    const sparePartId = req.body.zaphasti_id || oldItem.zaphasti_id;

                    if (oldItem.move_id) {
                        const moveCheck = await client.query('SELECT is_posted FROM moves WHERE id = $1', [oldItem.move_id]);
                        if (moveCheck.rows.length > 0) {
                            const isPostedVal = moveCheck.rows[0].is_posted;
                            if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2 || isPostedVal === 1) {
                                await client.query('ROLLBACK');
                                return res.status(400).json({ error: 'Нельзя изменять позиции в уже проведенном документе перемещения!' });
                            }
                        }
                    }

                    const stockQuery = `SELECT COALESCE(SUM(quantity), 0) as total_in FROM receipt_items WHERE zaphasti_id = $1`;
                    const stockResult = await client.query(stockQuery, [sparePartId]);
                    const totalIn = Number(stockResult.rows[0].total_in);

                    const movedQuery = `SELECT COALESCE(SUM(quantity), 0) as total_moved FROM move_items WHERE zaphasti_id = $1 AND id != $2`;
                    const movedResult = await client.query(movedQuery, [sparePartId, id]);
                    const totalMovedOthers = Number(movedResult.rows[0].total_moved);

                    const availableStock = totalIn - totalMovedOthers;

                    if (newQty > availableStock) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ 
                            error: `Недостаточно товара на складе! Доступно: ${availableStock} шт., а вы пытаетесь установить: ${newQty} шт.` 
                        });
                    }

                    req.body.total_rub = newQty * newPrice;
                    if (req.body.price_rub !== undefined) {
                        req.body.price_rub = newPrice;
                    }
                }

                if (entity === 'repair_items') {
                    // Добавлен FOR UPDATE
                    const oldItemRes = await client.query('SELECT * FROM "repair_items" WHERE id = $1 FOR UPDATE', [id]);
                    if (oldItemRes.rows.length === 0) {
                        await client.query('ROLLBACK');
                        return res.status(404).json({ error: 'Запись не найдена' });
                    }
                    const oldItem = oldItemRes.rows[0];
                    const sparePartId = req.body.zaphast_id || oldItem.zaphast_id;

                    if (oldItem.repair_id) {
                        const repairCheck = await client.query('SELECT is_posted FROM repairs WHERE id = $1', [oldItem.repair_id]);
                        if (repairCheck.rows.length > 0) {
                            const isPostedVal = repairCheck.rows[0].is_posted;
                            if (isPostedVal === true || isPostedVal === 'true' || isPostedVal === 2 || isPostedVal === 1) {
                                await client.query('ROLLBACK');
                                return res.status(400).json({ error: 'Нельзя изменять запчасти в уже проведенном ремонте!' });
                            }
                        }
                    }

                    const stockQuery = `SELECT COALESCE(SUM(quantity), 0) as total_in FROM receipt_items WHERE zaphasti_id = $1`;
                    const stockResult = await client.query(stockQuery, [sparePartId]);
                    const totalIn = Number(stockResult.rows[0].total_in);

                    const spentQuery = `SELECT COALESCE(SUM(quantity), 0) as total_spent FROM repair_items WHERE zaphast_id = $1 AND id != $2`;
                    const spentResult = await client.query(spentQuery, [sparePartId, id]);
                    const totalSpentOthers = Number(spentResult.rows[0].total_spent);

                    const availableStock = totalIn - totalSpentOthers;

                    if (newQty > availableStock) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ 
                            error: `Недостаточно запчастей на складе! Доступно: ${availableStock} шт., а вы пытаетесь установить: ${newQty} шт.` 
                        });
                    }

                    req.body.total = newQty * newPrice;
                }

                if (entity === 'receipt_items') {
                    req.body.total_rub = newQty * newPrice;
                    req.body.price_rub = newPrice;
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

        // ==================== АВТОМАТИЧЕСКАЯ ЗАПИСЬ ЛОГА (UPDATE) ====================
        try {
            const userId = req.headers['x-user-id'] || req.body.user_id || null;
            const detailsStr = Object.entries(req.body)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');

            await client.query(
                `INSERT INTO audit_logs (user_id, entity, action, record_id, details) VALUES ($1, $2, $3, $4, $5)`,
                [userId, entity, 'UPDATE', id, detailsStr || 'Обновление записи']
            );
        } catch (logErr) {
            console.error('Ошибка записи лога (не критично):', logErr.message);
        }
        // ============================================================================

        await client.query('COMMIT');
        res.json(result.rows[0]);

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
            'toplivo', 'ed_izmereniya', 'mol', 'receipts', 'receipt_items',
            'moves', 'move_items', 'statuses', 'tehosmotr',
            'autoservices', 'payment_types', 'autostrahovanie', 'accidents',
            'accident_invoices', 'accident_payments', 'accident_events', 'repairs',
            'repair_items', 'repair_works','mol_users','counterparty_contacts','postavhik_contacts', 'customer_contacts'
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

        if (entity === 'receipt_items') {
            const itemRes = await client.query('SELECT receipt_id FROM receipt_items WHERE id = $1', [id]);
            if (itemRes.rows.length > 0 && itemRes.rows[0].receipt_id) {
                const parentCheck = await client.query('SELECT is_posted FROM receipts WHERE id = $1', [itemRes.rows[0].receipt_id]);
                if (parentCheck.rows.length > 0) {
                    const pVal = parentCheck.rows[0].is_posted;
                    if (pVal === true || pVal === 'true' || pVal === 2 || pVal === 1) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'Нельзя удалять позиции из проведенного прихода!' });
                    }
                }
            }
        }

        if (entity === 'move_items') {
            const itemRes = await client.query('SELECT move_id FROM move_items WHERE id = $1', [id]);
            if (itemRes.rows.length > 0 && itemRes.rows[0].move_id) {
                const parentCheck = await client.query('SELECT is_posted FROM moves WHERE id = $1', [itemRes.rows[0].move_id]);
                if (parentCheck.rows.length > 0) {
                    const pVal = parentCheck.rows[0].is_posted;
                    if (pVal === true || pVal === 'true' || pVal === 2 || pVal === 1) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'Нельзя удалять позиции из проведенного перемещения!' });
                    }
                }
            }
        }

        if (entity === 'repair_items') {
            const itemRes = await client.query('SELECT repair_id FROM repair_items WHERE id = $1', [id]);
            if (itemRes.rows.length > 0 && itemRes.rows[0].repair_id) {
                const parentCheck = await client.query('SELECT is_posted FROM repairs WHERE id = $1', [itemRes.rows[0].repair_id]);
                if (parentCheck.rows.length > 0) {
                    const pVal = parentCheck.rows[0].is_posted;
                    if (pVal === true || pVal === 'true' || pVal === 2 || pVal === 1) {
                        await client.query('ROLLBACK');
                        return res.status(400).json({ error: 'Нельзя удалять запчасти из проведенного ремонта!' });
                    }
                }
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