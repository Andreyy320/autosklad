let currentEntity = 'users';
let currentItems = [];
let selectedItem = null;

const referenceDataCache = {};

async function fetchReferenceData(refEntity) {
    if (!refEntity) return [];
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/${refEntity}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            // На случай, если бэкенд оборачивает массив в объект { data: [...] }
            return Array.isArray(data) ? data : (data.data || data.items || []);
        } else {
            const errorText = await response.text();
            console.warn(`Справочник ${refEntity} вернул статус ${response.status}:`, errorText);
        }
    } catch (err) {
        console.error(`Ошибка загрузки справочника ${refEntity}:`, err);
    }
    return [];
}

const tableConfig = {
    users: {
        title: 'Пользователи',
        columns: [
            { field: 'login', label: 'Логин', width: '150px' },
            { field: 'password_hash', label: 'Пароль', style: 'display: none;' },
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.login}</b></td>
            <td style="display: none;"></td>
            <td>${item.name || ''}</td>
            <td>${item.description || ''}</td>
        `
    },
    brands: {
        title: 'Бренды',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name}</b></td>
            <td>${item.description || ''}</td>
        `
    },
    bodies: {
        title: 'Кузов',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name}</b></td>
            <td>${item.description || ''}</td>
        `
    },
    models: {
        title: 'Модели',
        columns: [
            { field: 'name', label: 'Наименование', width: '180px' },
            { field: 'brand_id', label: 'Бренд', width: '130px', ref: 'brands' },
            { field: 'kyzov_type_id', label: 'Кузов', width: '110px', ref: 'bodies' },
            { field: 'toplivo_id', label: 'Топливо', width: '100px', ref: 'toplivo' },
            { field: 'engine', label: 'Двигатель', width: '100px' },
            { field: 'start_date', label: 'Начало', width: '90px' },
            { field: 'end_date', label: 'Конец', width: '90px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td><b>${item.brand_name || 'Не указан'}</b></td>
            <td><b>${item.body_name || 'Не указан'}</b></td>
            <td><b>${item.toplivo_name || 'Не указан'}</b></td>
            <td>${item.engine || ''}</td>
            <td>${item.start_date ? item.start_date.substring(0, 10) : ''}</td>
            <td>${item.end_date ? item.end_date.substring(0, 10) : ''}</td>
            <td>${item.description || ''}</td>
        `
    },
    counterparties: {
        title: 'Контрагенты',
        columns: [
            { field: 'counterparty_type_id', label: 'Тип', width: '150px', ref: 'counterparty_types' },
            { field: 'name', label: 'Наименование', width: '220px' },
            { field: 'short_name', label: 'Кратко', width: '150px' },
            { field: 'description', label: 'Описание' },
        ],
        render: (item) => `
            <td><b>${item.counterparty_type_name || '—'}</b></td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.short_name || ''}</td>
            <td>${item.description || ''}</td>
        `
    },
    postavhik: {
        title: 'Поставщики',
        columns: [
            { field: 'type_id', label: 'Тип', width: '130px', ref: 'counterparty_types' },
            { field: 'name', label: 'Наименование', width: '220px' },
            { field: 'short_name', label: 'Кратко', width: '150px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.type_name || '—'}</b></td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.short_name || ''}</td>
            <td>${item.description || ''}</td>
        `
    },
  customers: {
        title: 'Покупатели',
        columns: [
            { field: 'type_id', label: 'Тип', width: '130px', ref: 'counterparty_types' },
            { field: 'name_full', label: 'Наименование', width: '220px' },
            { field: 'name_short', label: 'Кратко', width: '150px' },
            { field: 'discount_part_id', label: 'Скидка зап.', width: '110px', ref: 'part_discounts' },
            { field: 'discount_service_id', label: 'Скидка усл.', width: '110px', ref: 'service_discounts' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.type_name || '—'}</b></td>
            <td><b>${item.name_full || ''}</b></td>
            <td>${item.name_short || ''}</td>
            <td>${item.part_discount_name || '—'}</td>
            <td>${item.service_discount_name || '—'}</td>
            <td>${item.description || ''}</td>
        `
    },

customer_contacts: {
        title: 'Контакты покупателей',
        columns: [
            { field: 'name', label: 'Имя', width: '180px' },
            { field: 'phone', label: 'Телефон', width: '150px' },
            { field: 'position', label: 'Должность', width: '150px' },
            { field: 'address', label: 'Адрес', width: '200px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.phone || ''}</td>
            <td>${item.position || ''}</td>
            <td>${item.address || ''}</td>
            <td>${item.description || ''}</td>
        `
    },
    customer_cars: {
        title: 'Автомобили покупателя',
        columns: [
            { field: 'brand', label: 'Бренд', width: '120px' },
            { field: 'model', label: 'Модель', width: '150px' },
            { field: 'gos_number', label: 'Гос. номер', width: '120px' },
            { field: 'year', label: 'Год', width: '70px' },
            { field: 'color', label: 'Цвет', width: '100px' },
            { field: 'vin', label: 'VIN-номер', width: '160px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.brand || ''}</b></td>
            <td><b>${item.model || ''}</b></td>
            <td><code>${item.gos_number || ''}</code></td>
            <td>${item.year || ''}</td>
            <td>${item.color || ''}</td>
            <td>${item.vin || ''}</td>
            <td>${item.description || ''}</td>
        `
    },

    postavhik_contacts: {
        title: 'Контакты поставщиков',
        columns: [
            { field: 'name', label: 'Имя', width: '180px' },
            { field: 'phone', label: 'Телефон', width: '150px' },
            { field: 'position', label: 'Должность', width: '150px' },
            { field: 'address', label: 'Адрес', width: '200px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.phone || ''}</td>
            <td>${item.position || ''}</td>
            <td>${item.address || ''}</td>
            <td>${item.description || ''}</td>
        `
    },

    counterparty_contacts: {
        title: 'Контакты контрагентов',
        columns: [
            { field: 'name', label: 'Имя', width: '180px' },
            { field: 'phone', label: 'Телефон', width: '150px' },
            { field: 'position', label: 'Должность', width: '150px' },
            { field: 'address', label: 'Адрес', width: '200px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.phone || ''}</td>
            <td>${item.position || ''}</td>
            <td>${item.address || ''}</td>
            <td>${item.description || ''}</td>
        `
    },


   counterparty_types: {
    title: 'Тип контрагента',
    columns: [
        { field: 'name', label: 'Наименование', width: '250px' },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => `
        <td><b>${item.name || ''}</b></td>
        <td>${item.description || ''}</td>
    `
},
    type_sklad: {
        title: 'Тип склада',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание' },
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.description || ''}</td>
        `
    },
    skladi: {
        title: 'Склады',
        columns: [
            { field: 'type_sklad_id', label: 'Тип склада', width: '150px', ref: 'type_sklad' },
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td>${item.type_name || '—'}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.description || ''}</td>
        `
    },

part_discounts: {
        title: 'Скидки на запчасти',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'discount_percent', label: 'Процент скидки', width: '150px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.discount_percent ?? '0'}%</td>
            <td>${item.description || ''}</td>
        `
    },
    service_discounts: {
        title: 'Скидки на услуги',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'discount_percent', label: 'Процент скидки', width: '150px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.discount_percent ?? '0'}%</td>
            <td>${item.description || ''}</td>
        `
    },

    cars: {
        title: 'Автомобили',
        columns: [
            { field: 'gos_number', label: 'Гос. номер' },
            { field: 'model_id', label: 'Модель', ref: 'models' },
            { field: 'body', label: 'Кузов', ref: 'bodies' },
            { field: 'engine', label: 'Двигатель' },
            { field: 'toplivo_id', label: 'Топливо', ref: 'toplivo' },
            { field: 'year', label: 'Год' },
            { field: 'color', label: 'Цвет' },
            { field: 'vin', label: 'VIN-номер' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.gos_number || ''}</b></td>
            <td><b>${item.car_model_name || '—'}</b></td>
            <td>${item.body_name || ''}</td>
            <td>${item.engine || ''}</td>
            <td><b>${item.toplivo_name || '—'}</b></td>
            <td>${item.year || ''}</td>
            <td>${item.color || ''}</td>
            <td>${item.vin || ''}</td>
            <td>${item.description || ''}</td>
        `
    },
car_details: {
        title: 'Детали и фото автомобиля',
        columns: [
            { field: 'date', label: 'Дата', type: 'date' },
            { field: 'title', label: 'Наименование' },
            { field: 'description', label: 'Описание' },
            { field: 'photo_url', label: 'Изображение', type: 'image' }
        ],
        render: (item) => `
            <td>${item.date ? new Date(item.date).toLocaleDateString() : ''}</td>
            <td><b>${item.title || ''}</b></td>
            <td>${item.description || ''}</td>
            <td>
                ${item.photo_url ? `<img src="${item.photo_url}" alt="Фото" style="width: 100px; height: 75px; object-fit: cover; border-radius: 6px; cursor: pointer;" />` : '—'}
            </td>
        `
    },
    type_rabot: {
        title: 'Тип работ',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание' },
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.description || ''}</td>
        `
    },
    works: {
        title: 'Работы',
        columns: [
            { field: 'name', label: 'Наименование' },
            { field: 'type_rabot_id', label: 'Тип работ', ref: 'type_rabot' },
            { field: 'replacement_group_id', label: 'Группа замещения', ref: 'gryppa_zamehenia' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.type_rabot_name || '—'}</td>
            <td>${item.replacement_group_name || '—'}</td>
            <td>${item.description || ''}</td>
        `
    },
    ispolnitel: {
        title: 'Исполнители',
        columns: [
            { field: 'name', label: 'Имя / Название', width: '250px' },
            { field: 'description', label: 'Описание' },
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.description || ''}</td>
        `
    },
    repair_types: {
        title: 'Типы ремонта',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание' },
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.description || ''}</td>
        `
    },
   mol: {
        title: 'МОЛ',
        columns: [
            { field: 'user_id', label: 'ФИО (Пользователь)', ref: 'mol_users' },
            { field: 'warehouse_id', label: 'Склад', ref: 'skladi' },
            { field: 'date_assigned', label: 'Дата назнач.', type: 'datetime-local', width: '160px' },
            { field: 'date_removed', label: 'Дата снятия', type: 'datetime-local', width: '160px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => {
            const formatDT = (dateStr) => {
                if (!dateStr) return '—';
                const d = new Date(dateStr);
                if (isNaN(d)) return '—';
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                return `${day}.${month}.${year} ${hours}:${minutes}`;
            };

            return `
                <td><b>${item.user_fio || '—'}</b></td>
                <td><b>${item.warehouse_name || '—'}</b></td>
                <td>${formatDT(item.date_assigned)}</td>
                <td>${formatDT(item.date_removed)}</td>
                <td>${item.description || ''}</td>
            `;
        }
    },
    zaphasti: {
        title: 'Запчасти',
        columns: [
            { field: 'article', label: 'Артикул' },
            { field: 'code', label: 'Код' },
            { field: 'name', label: 'Наименование' },
            { field: 'proizvoditel_id', label: 'Производитель', ref: 'proizvoditel_zaphasti' },
            { field: 'ed_izmereniya_id', label: 'Ед. изм.', ref: 'ed_izmereniya' },
            { field: 'gruppa_tsen_id', label: 'Группа цен', ref: 'gruppa_tsen' },
            { field: 'gryppa_zamehenia_id', label: 'Группа замещения', ref: 'gryppa_zamehenia' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td>${item.article || ''}</td>
            <td>${item.code || ''}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.proizvoditel_name || '—'}</td>
            <td>${item.ed_izmereniya_name || '—'}</td>
            <td>${item.gruppa_tsen_name || '—'}</td>
            <td>${item.gryppa_zamehenia_name || '—'}</td>
            <td>${item.description || ''}</td>
        `
    },
    proizvoditel_zaphasti: {
        title: 'Производитель',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание' },
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.description || ''}</td>
        `
    },
   gryppa_zamehenia: {
    title: 'Группа замещения',
    columns: [
        { field: 'name', label: 'Наименование', width: '250px' },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => `
        <td><b>${item.name || ''}</b></td>
        <td>${item.description || ''}</td>
    `
},
  toplivo: {
    title: 'Топливо',
    columns: [
        { field: 'name', label: 'Наименование', width: '250px' },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => `
        <td><b>${item.name || ''}</b></td>
        <td>${item.description || ''}</td>
    `
},
    gruppa_tsen: {
        title: 'Группа цен',
        columns: [
            { field: 'name', label: 'Наименование' },
            { field: 'markup_percent', label: 'Наценка (%)' },
            { field: 'rounding', label: 'Округление' },
            { field: 'description', label: 'Описание' },
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.markup_percent !== null ? item.markup_percent : ''}</td>
            <td>${item.rounding !== null ? item.rounding : ''}</td>
            <td>${item.description || ''}</td>
        `
    },
    ed_izmereniya: {
        title: 'Ед. измерения',
        columns: [
            { field: 'name', label: 'Наименование', width: '200px' },
            { field: 'short_name', label: 'Сокр.', width: '120px' },
            { field: 'regex_pattern', label: 'Паттерн (Regex)', width: '180px' },
            { field: 'error_text', label: 'Текст ошибки' },
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.short_name || ''}</td>
            <td><code>${item.regex_pattern || ''}</code></td>
            <td>${item.error_text || ''}</td>
        `
    },
    vidy_rabot: {
        title: 'Виды работ',
        columns: [
            { field: 'name', label: 'Наименование' },
            { field: 'price', label: 'Стоимость', width: '120px' },
            { field: 'description', label: 'Описание' },
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.price !== undefined && item.price !== null ? Number(item.price).toFixed(2) : '0.00'}</td>
            <td>${item.description || ''}</td>
        `
    },
receipts: {
    title: 'Документ прихода',
    columns: [
        { field: 'doc_number', label: '№ документа', width: '120px' },
        { field: 'date', label: 'Дата', type: 'datetime-local', width: '160px' },
        { field: 'warehouse_id', label: 'Склад', width: '150px', ref: 'skladi' },
        { field: 'mol_id', label: 'МОЛ', width: '150px', ref: 'mol' },
        { field: 'supplier_id', label: 'Поставщик', width: '180px', ref: 'postavhik' },
        { field: 'description', label: 'Описание' },

        { field: 'sum_rub', label: 'Сумма РУБ', width: '120px', insert: false, readonly: true },
        { field: 'fact_date', label: 'Дата факт', type: 'datetime-local', width: '160px' },
        { field: 'is_posted', label: 'Проведен', width: '120px', ref: 'statuses' }
    ],
    render: (item) => {
        const formatDT = (dateStr) => {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            if (isNaN(d)) return '—';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        };

        const sumRub = Number(item.sum_rub || 0).toFixed(2);
        const isPosted = Boolean(item.is_posted);
        const isPostedText = isPosted ? 'Проведен' : 'Не проведен';
        const isPostedColor = isPosted ? 'green' : 'gray';

        const actionButton = !isPosted 
            ? `<button onclick="event.stopPropagation(); postReceipt(${item.id})" style="margin-left: 8px; padding: 2px 6px; cursor: pointer; background-color: #28a745; color: white; border: none; border-radius: 3px;">Провести</button>` 
            : '';

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatDT(item.date)}</td>
            <td>${item.warehouse_name || '—'}</td>
            <td>${item.mol_user_fio || item.mol_name || '—'}</td>
            <td>${item.supplier_name || '—'}</td>
            <td>${item.description || ''}</td>
            <td style="text-align: right; font-weight: bold;">${sumRub}</td>
            <td>${formatDT(item.fact_date)}</td>
            <td>
                <span style="color: ${isPostedColor}; font-weight: bold;">${isPostedText}</span>
                ${actionButton}
            </td>
        `;
    }
},

receipt_items: {
    title: 'Спецификация документа',
    columns: [
        { field: 'zaphasti_id', label: 'Запчасть', ref: 'zaphasti', width: '250px', insert: true, table: false },
        { field: 'article', label: 'Артикул', width: '110px', insert: false },
        { field: 'code', label: 'Код', width: '100px', insert: false },
        { field: 'name', label: 'Наименование', width: '220px', insert: false },
        { field: 'quantity', label: 'Кол-во', width: '80px' },
        { field: 'unit', label: 'Ед.изм', width: '70px', insert: false },
        { field: 'price', label: 'Цена', width: '90px' },
        { field: 'currency', label: 'Валюта', width: '100px', default: 'Рубль ПМР' },
        { field: 'total_rub', label: 'Сумма', width: '90px', insert: false },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const totalSum = Number(item.total_rub) || (price * qty);

        return `
            <td>${item.article || item.zaphasti_article || '—'}</td>
            <td>${item.code || item.zaphasti_code || '—'}</td>
            <td><b>${item.name || item.zaphasti_name || item.zaphasti_title || '—'}</b></td>
            <td>${qty}</td>
            <td>${item.unit || item.zaphasti_unit || 'шт'}</td>
            <td>${price.toFixed(2)}</td>
            <td>${item.currency || 'Рубль ПМР'}</td>
            <td><b>${totalSum.toFixed(2)}</b></td>
            <td>${item.description || ''}</td>
        `;
    }
},
moves: {
    title: 'Документ перемещения',
    columns: [
        { field: 'doc_number', label: '№ документа', width: '120px' },
        { field: 'date', label: 'Дата', type: 'datetime-local', width: '160px' },
        { field: 'warehouse_from_id', label: 'Склад откуда', width: '150px', ref: 'skladi' },
        { field: 'mol_from_id', label: 'МОЛ с кого', width: '150px', ref: 'mol' },
        { field: 'warehouse_to_id', label: 'Склад куда', width: '150px', ref: 'skladi' },
        { field: 'mol_to_id', label: 'МОЛ кому', width: '150px', ref: 'mol' },
        { field: 'description', label: 'Описание' },

        { field: 'sum_rub', label: 'Сумма РУБ', width: '120px', insert: false, readonly: true },
        { field: 'fact_date', label: 'Дата факт', type: 'datetime-local', width: '160px' },
        { field: 'is_posted', label: 'Проведен', width: '120px', ref: 'statuses' }
    ],
    render: (item) => {
        const formatDT = (dateStr) => {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            if (isNaN(d)) return '—';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        };

        const sumRub = Number(item.sum_rub || 0).toFixed(2);
        
        const isPostedHtml = item.is_posted 
            ? `<span style="color: green; font-weight: bold;">Проведен</span>` 
            : `<span style="color: gray;">Не проведен</span> <button onclick="event.stopPropagation(); postMove(${item.id})" style="background: #28a745; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; margin-left: 5px;">Провести</button>`;

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatDT(item.date)}</td>
            <td>${item.warehouse_from_name || item.warehouse_from_id || '—'}</td>
            <td>${item.mol_from_name || item.mol_from_id || '—'}</td>
            <td>${item.warehouse_to_name || item.warehouse_to_id || '—'}</td>
            <td>${item.mol_to_name || item.mol_to_id || '—'}</td>
            <td>${item.description || ''}</td>
            <td style="text-align: right; font-weight: bold;">${sumRub}</td>
            <td>${formatDT(item.fact_date)}</td>
            <td>${isPostedHtml}</td>
        `;
    }
},
move_items: {
    title: 'Спецификация перемещения',
    columns: [
        { field: 'zaphasti_id', label: 'Запчасть', ref: 'zaphasti', width: '250px', insert: true, table: false },
        { field: 'article', label: 'Артикул', width: '110px', insert: false },
        { field: 'code', label: 'Код', width: '100px', insert: false },
        { field: 'name', label: 'Наименование', width: '220px', insert: false },
        { field: 'quantity', label: 'Кол-во', width: '80px' },
        { field: 'unit', label: 'Ед.изм', width: '70px', insert: false },
        { field: 'price', label: 'Цена', width: '90px' },
        { field: 'currency', label: 'Валюта', width: '100px' },
        { field: 'total_rub', label: 'Сумма', width: '90px', insert: false },
        { field: 'description', label: 'Описание' },
        { field: 'income_document', label: 'Документ прихода', width: '180px', insert: false }
    ],
    render: (item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const totalSum = Number(item.total_rub) || (price * qty);
        const incomeDocText = item.income_document || '—';
        
        const article = item.article || item.zaphasti_article || '—';
        const code = item.code || item.zaphasti_code || '—';
        const name = item.name || item.zaphasti_name || item.zaphasti_title || '—';
        const unit = item.unit || item.zaphasti_unit || 'шт';

        return `
            <td>${article}</td>
            <td>${code}</td>
            <td><b>${name}</b></td>
            <td>${qty}</td>
            <td>${unit}</td>
            <td>${price.toFixed(2)}</td>
            <td>${item.currency || 'Рубль ПМР'}</td>
            <td><b>${totalSum.toFixed(2)}</b></td>
            <td>${item.description || ''}</td>
            <td style="color: #000000; font-style: normal;">${incomeDocText}</td>
        `;
    }
},
tehosmotr: {
    title: 'Техосмотр',
    columns: [
        { field: 'doc_number', label: '№ документа', width: '120px' },
        { field: 'date', label: 'Дата', type: 'datetime-local', width: '160px' },
        { field: 'car_id', label: 'Гос номер / Модель', width: '180px', ref: 'cars' },
        { field: 'autoservice', label: 'Автосервис', width: '150px' },
        { field: 'to_date', label: 'Дата ТО', type: 'datetime-local', width: '160px' },
        { field: 'next_to_date', label: 'Следующее ТО', type: 'datetime-local', width: '160px' },
        { field: 'sum', label: 'Сумма', width: '100px' },
        { field: 'description', label: 'Описание' },

        { field: 'fact_date', label: 'Дата факт', width: '160px', insert: false, readonly: true },
        { field: 'is_posted', label: 'Проведен', width: '120px', ref: 'statuses', insert: false }
    ],
    render: (item) => {
        const formatDT = (dateStr, includeTime = true) => {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            if (isNaN(d)) return '—';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            if (!includeTime) return `${day}.${month}.${year}`;
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        };

        const sumVal = Number(item.sum || 0).toFixed(2);
        
        let carDisplay = '—';
        if (item.car_number && item.car_model) {
            carDisplay = `<b>${item.car_number}</b> <span style="color: #666; font-size: 0.9em;">(${item.car_model})</span>`;
        } else if (item.car_number) {
            carDisplay = `<b>${item.car_number}</b>`;
        } else if (item.car_model) {
            carDisplay = item.car_model;
        }

        const isPostedHtml = item.is_posted 
            ? `<span style="color: green; font-weight: bold;">Проведен</span>` 
            : `<span style="color: gray;">Не проведен</span> <button onclick="event.stopPropagation(); postTehosmotr(${item.id})" style="background: #28a745; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; margin-left: 5px;">Провести</button>`;

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatDT(item.date)}</td>
            <td>${carDisplay}</td>
            <td>${item.autoservice || '—'}</td>
            <td>${formatDT(item.to_date, true)}</td>
            <td>${formatDT(item.next_to_date, true)}</td>
            <td style="text-align: right; font-weight: bold;">${sumVal}</td>
            <td>${item.description || ''}</td>
            <td>${formatDT(item.fact_date)}</td>
            <td>${isPostedHtml}</td>
        `;
    }
},

autostrahovanie: {
    title: 'Автострахование',
    columns: [
        { field: 'doc_number', label: '№ документа', width: '120px' },
        { field: 'date', label: 'Дата', type: 'datetime-local', width: '160px' },
        { field: 'car_id', label: 'Гос номер / Модель', width: '180px', ref: 'cars' },
        { field: 'autoservice_id', label: 'Автосервис', width: '150px', ref: 'autoservices' },
        { field: 'insurance_current', label: 'Дата страх', type: 'datetime-local', width: '160px' },
        { field: 'insurance_next', label: 'Следующая дата', type: 'datetime-local', width: '160px' },
        { field: 'sum', label: 'Сумма', width: '100px' },
        { field: 'description', label: 'Описание' },

        { field: 'fact_date', label: 'Дата факт', width: '160px', insert: false, readonly: true },
        { field: 'is_posted', label: 'Проведен', width: '120px', ref: 'statuses', insert: false }
    ],
    render: (item) => {
        const formatDT = (dateStr, includeTime = true) => {
            if (!dateStr) return '—';
            let d = new Date(dateStr);
            if (isNaN(d)) return '—';

            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            
            if (!includeTime) return `${day}.${month}.${year}`;
            
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        };

        const sumVal = Number(item.sum || 0).toFixed(2);
        
        let carDisplay = '—';
        if (item.car_number && item.car_model) {
            carDisplay = `<b>${item.car_number}</b> <span style="color: #666; font-size: 0.9em;">(${item.car_model})</span>`;
        } else if (item.car_number) {
            carDisplay = `<b>${item.car_number}</b>`;
        } else if (item.car_model) {
            carDisplay = item.car_model;
        }

        const isPostedHtml = item.is_posted 
            ? `<span style="color: green; font-weight: bold;">Проведен</span>` 
            : `<span style="color: gray;">Не проведен</span> <button onclick="event.stopPropagation(); postAutostrahovanie(${item.id})" style="background: #28a745; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer; margin-left: 5px;">Провести</button>`;

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatDT(item.date)}</td>
            <td>${carDisplay}</td>
            <td>${item.autoservice_name || item.autoservice_id || '—'}</td>
            <td>${formatDT(item.insurance_current, true)}</td>
            <td>${formatDT(item.insurance_next, true)}</td>
            <td style="text-align: right; font-weight: bold;">${sumVal}</td>
            <td>${item.description || ''}</td>
            <td>${formatDT(item.fact_date)}</td>
            <td>${isPostedHtml}</td>
        `;
    }
},
car_cards: {
    title: 'Карточка авто',
    readonly: true, 
    columns: [
        { field: 'gos_number', label: 'Гос. номер', width: '100px' },
        { field: 'car_model_name', label: 'Модель', width: '200px' },
        { field: 'body_name', label: 'Кузов', width: '120px' },
        { field: 'engine_name', label: 'Двигатель', width: '150px' },
        { field: 'year', label: 'Год вып.', width: '80px' },
        { field: 'color', label: 'Цвет', width: '80px' },
        { field: 'vin', label: 'VIN-номер', width: '180px' },
        { field: 'tehosmotr_current', label: 'ТО (Тек)', width: '120px' },
        { field: 'tehosmotr_next', label: 'ТО (След)', width: '120px' },
        { field: 'autostrahovanie_current', label: 'Страх (Тек)', width: '120px' },
        { field: 'autostrahovanie_next', label: 'Страх (След)', width: '120px' },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => {
        const formatDate = (dateStr) => {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        };

        return `
            <td>${item.gos_number || ''}</td>
            <td>${item.car_model_name || ''}</td>
            <td>${item.body_name || ''}</td>
            <td>${item.engine_name || ''}</td>
            <td>${item.year || ''}</td>
            <td>${item.color || ''}</td>
            <td>${item.vin || ''}</td>
            <td>${formatDate(item.tehosmotr_current)}</td>
            <td>${formatDate(item.tehosmotr_next)}</td>
            <td>${formatDate(item.autostrahovanie_current)}</td>
            <td>${formatDate(item.autostrahovanie_next)}</td>
            <td>${item.description || ''}</td>
        `;
    }
},



stock_balances: {
    title: 'Остатки запчастей',
    columns: [
        { field: 'artikul', label: 'Артикул', width: '110px' },
        { field: 'code', label: 'Код', width: '110px', align: 'center' },
        { field: 'name', label: 'Наименование', width: '280px' },
        { field: 'manufacturer', label: 'Производитель', width: '140px' },
        { field: 'price_group', label: 'Группа цены', width: '120px' },
        { field: 'description', label: 'Описание' },
        { field: 'sklad', label: 'Склад', width: '130px' },
        { field: 'mol', label: 'МОЛ', width: '150px' },
        { field: 'qty', label: 'Кол-во', width: '70px', align: 'right' },
        { field: 'unit', label: 'Ед. изм.', width: '70px', align: 'center' }
    ],
    rowAttributes: (item) => {
        return `data-zaphasti-id="${item.id || ''}" data-warehouse-id="${item.warehouse_id || ''}"`;
    },
    render: (item) => {
        if (!item) return '';

        return `
            <td>${item.artikul || ''}</td>
            <td style="text-align: center;">${item.code || ''}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.manufacturer || ''}</td>
            <td>${item.price_group || ''}</td>
            <td>${item.description || ''}</td>
            <td>${item.sklad || 'Основной склад'}</td>
            <td>${item.mol || 'Не назначен'}</td>
            <td style="text-align: right; font-weight: bold; color: #006600; background-color: #e6fcf5;">${item.qty !== undefined ? item.qty : 0}</td>
            <td style="text-align: center;">${item.unit || 'шт'}</td>
        `;
    }
},

part_movement_details: {
    title: 'Детали движения',
    columns: [
        { field: 'op_date', label: 'Дата', width: '140px' },
        { field: 'doc_num', label: '№ документа', width: '110px' },
        { field: 'doc_type', label: 'Тип документа', width: '130px' },
        { field: 'source_info', label: 'Склад/МОЛ / Поставщик', width: '250px' },
        { field: 'dest_info', label: 'Склад/МОЛ / Авто', width: '250px' },
        { field: 'qty', label: 'Кол-во', width: '60px', align: 'right' },
        { field: 'price', label: 'Цена', width: '80px', align: 'right' },
        { field: 'sum', label: 'Сумма', width: '90px', align: 'right' },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => {
        if (!item) return '';
        let formattedDate = item.op_date ? item.op_date.replace('T', ' ').substring(0, 19) : '';
        
        return `
            <td>${formattedDate}</td>
            <td><b>${item.doc_num || ''}</b></td>
            <td>${item.doc_type || ''}</td>
            <td>${item.source_info || ''}</td>
            <td>${item.dest_info || ''}</td>
            <td style="text-align: right;">${item.qty || 0}</td>
            <td style="text-align: right;">${item.price !== undefined ? Number(item.price).toFixed(2) : '0.00'}</td>
            <td style="text-align: right; font-weight: bold;">${item.sum !== undefined ? Number(item.sum).toFixed(2) : '0.00'}</td>
            <td>${item.description || ''}</td>
        `;
    }
},
stock_batches: {
    title: 'Партии товара',
    columns: [
        { field: 'artikul', label: 'Артикул', width: '110px' },
        { field: 'code', label: 'Код', width: '90px', align: 'center' },
        { field: 'name', label: 'Наименование', width: '220px' },
        { field: 'document_name', label: 'Документ прихода / перемещения', width: '240px' },
        { field: 'doc_date', label: 'Дата', width: '100px', align: 'center' },
        { field: 'description', label: 'Описание' },
        { field: 'qty', label: 'Кол-во', width: '70px', align: 'right' },
        { field: 'unit', label: 'Ед. изм.', width: '60px', align: 'center' },
        { field: 'purchase_price', label: 'Цена закуп.', width: '90px', align: 'right' },
        { field: 'retail_price', label: 'Розн. цена', width: '90px', align: 'right' },
        { field: 'currency', label: 'Валюта', width: '80px', align: 'center' }
    ],
    render: (item) => {
        if (!item) return '';
        let formattedDate = item.doc_date ? new Date(item.doc_date).toLocaleDateString('ru-RU') : '';
        
        // Берем готовое значение от бэкенда либо вычисляем на лету, если бэкенд еще не перезапущен
        let rawPurchasePrice = item.purchase_price !== undefined ? Number(item.purchase_price) : 0;
        let retailPrice = item.retail_price !== undefined ? item.retail_price : (rawPurchasePrice * 1.3).toFixed(2);

        return `
            <td>${item.artikul || ''}</td>
            <td style="text-align: center;">${item.code || ''}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.document_name || ''}</td>
            <td style="text-align: center;">${formattedDate}</td>
            <td>${item.description || ''}</td>
            <td style="text-align: right; font-weight: bold; color: #0044cc;">${item.qty !== undefined ? item.qty : 0}</td>
            <td style="text-align: center;">${item.unit || 'шт'}</td>
            <td style="text-align: right;">${rawPurchasePrice}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">${retailPrice}</td>
            <td style="text-align: center;">${item.currency || ''}</td>
        `;
    }
},
stock_movement: {
    title: 'Движение запчастей',
    columns: [
        { field: 'artikul', label: 'Артикул', width: '110px' },
        { field: 'code', label: 'Код', width: '90px', align: 'center' },
        { field: 'name', label: 'Наименование', width: '280px' },
        { field: 'manufacturer', label: 'Производитель', width: '130px' },
        { field: 'unit', label: 'Ед.изм', width: '60px', align: 'center' },
        { field: 'income_qty', label: 'Кол-во', width: '60px', align: 'right' },
        { field: 'income_sum', label: 'Сумма', width: '80px', align: 'right' },
        { field: 'outcome_qty', label: 'Кол-во', width: '60px', align: 'right' },
        { field: 'outcome_sum', label: 'Сумма', width: '80px', align: 'right' },
        { field: 'end_qty', label: 'Кол-во', width: '60px', align: 'right' },
        { field: 'end_sum', label: 'Сумма', width: '80px', align: 'right' },
        { field: 'description', label: 'Описание' }
    ],
    rowAttributes: (item) => {
        return `data-zaphasti-id="${item.id || item.zaphasti_id || ''}" data-warehouse-id="${item.warehouse_id || ''}"`;
    },
    render: (item) => {
        if (!item) return '';

        return `
            <td>${item.artikul || ''}</td>
            <td style="text-align: center;">${item.code || ''}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.manufacturer || ''}</td>
            <td style="text-align: center;">${item.unit || 'шт'}</td>
            
            <!-- Приход -->
            <td style="text-align: right; color: #006600;">${item.income_qty || ''}</td>
            <td style="text-align: right; color: #006600;">${item.income_sum ? Number(item.income_sum).toFixed(2) : ''}</td>
            
            <!-- Расход -->
            <td style="text-align: right; color: #b30000;">${item.outcome_qty || ''}</td>
            <td style="text-align: right; color: #b30000;">${item.outcome_sum ? Number(item.outcome_sum).toFixed(2) : ''}</td>
            
            <!-- Остаток на конец -->
            <td style="text-align: right; font-weight: bold;">${item.end_qty !== undefined ? item.end_qty : 0}</td>
            <td style="text-align: right; font-weight: bold;">${item.end_sum !== undefined ? Number(item.end_sum).toFixed(2) : '0.00'}</td>
            
            <td>${item.description || ''}</td>
        `;
    }
},

car_tehosmotr: {
    title: 'Техосмотр машины',
    columns: [
        { field: 'to_date', label: 'Дата ТО', width: '130px' },
        { field: 'next_to_date', label: 'Следующая дата', width: '130px' },
        { field: 'autoservice', label: 'Автосервис', width: '180px' },
        { field: 'sum', label: 'Стоимость', width: '100px', align: 'right' },
        { field: 'description', label: 'Описание' },
        { field: 'doc_number', label: 'Документ ТО', width: '200px' }
    ],
    render: (item) => {
        const formatOnlyDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        };

        const sumVal = Number(item.sum || 0).toFixed(2);
        
        const formattedDate = formatOnlyDate(item.date);
        const docText = item.doc_number ? `Техосмотр ${item.doc_number}` : 'Техосмотр';
        const docDisplay = formattedDate ? `${docText} от ${formattedDate}` : docText;

        return `
            <td>${formatOnlyDate(item.to_date)}</td>
            <td>${formatOnlyDate(item.next_to_date)}</td>
            <td>${item.autoservice || '—'}</td>
            <td style="text-align: right;">${sumVal}</td>
            <td>${item.description || ''}</td>
            <td><b><b>${docDisplay}</b></b></td>
        `;
    }
},
car_autostrahovanie: {
    title: 'Страхование машины',
    columns: [
        { field: 'insurance_current', label: 'Дата страхования', width: '130px' },
        { field: 'insurance_next', label: 'Следующая дата', width: '130px' },
        { field: 'autoservice_id', label: 'Страховая компания', width: '180px' },
        { field: 'sum', label: 'Стоимость', width: '120px', align: 'right' },
        { field: 'description', label: 'Описание' },
        { field: 'doc_number', label: 'Документ ТО', width: '220px' }
    ],
    render: (item) => {
        const formatDT = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        };

        const sumVal = Number(item.sum || 0).toFixed(2);
        
        const formattedDate = formatDT(item.date);
        const docText = item.doc_number ? `Автострахование ${item.doc_number}` : 'Автострахование';
        const docDisplay = formattedDate ? `${docText} от ${formattedDate}` : docText;

        return `
            <td>${formatDT(item.insurance_current)}</td>
            <td>${formatDT(item.insurance_next)}</td>
            <td>${item.autoservice_name || item.autoservice_id || '—'}</td>
            <td style="text-align: right;">${sumVal}</td>
            <td>${item.description || ''}</td>
            <td><b>${docDisplay}</b></td>
        `;
    }
},
accidents: {
    title: 'ДТП',
    columns: [
        { label: "№", field: "doc_number", width: "120px" },
        { 
            label: "Дата", 
            field: "doc_date", 
            type: 'datetime-local', 
            width: "160px",
            value: () => {
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            }
        },
        { label: "Гос номер", field: "car_id", width: "120px", ref: "cars" },
        { label: "Модель", field: "car_model", width: "150px", insert: false, update: false, readonly: true },
        { label: "Факт", field: "fact_date", type: 'datetime-local', width: "110px" },
        { label: "Обнаружено", field: "detected_date", type: 'datetime-local', width: "110px" },
        { label: "Водитель", field: "driver", width: "180px" },
        { label: "Виновник", field: "culprit", width: "180px" },
        { label: "Ущерб", field: "damage_amount", width: "100px", align: "right" },
        { label: "Счет", field: "account_number", width: "90px", edit: false },
        { label: "Выплачено", field: "paid_amount", width: "100px", align: "right", edit: false },
        { label: "Описание", field: "description", edit: false },
        { label: "Дата факт", field: "actual_date", type: 'datetime-local', width: "130px", edit: false },
        { label: "Контроль", field: "status_id", width: "110px", ref: "accident_statuses" }
    ],
    render: (item) => {
        const formatDT = (dateStr, includeTime = true) => {
            if (!dateStr) return '—';
            const d = new Date(dateStr);
            if (isNaN(d)) return '—';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            if (!includeTime) return `${day}.${month}.${year}`;
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        };

        const damageVal = Number(item.damage_amount || 0).toFixed(2);
        const accountNum = Number(item.account_number || 0);
        const paidNum = Number(item.paid_amount || 0);
        const paidVal = paidNum.toFixed(2);

        const isUnderpaid = accountNum > paidNum;
        const paidStyle = isUnderpaid 
            ? 'text-align: right; color: #d9534f; font-weight: bold;' 
            : 'text-align: right;';

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatDT(item.doc_date)}</td>
            <td>${item.car_number || item.car_id || '—'}</td>
            <td>${item.car_model || '—'}</td>
            <td>${formatDT(item.fact_date)}</td>
            <td>${formatDT(item.detected_date)}</td>
            <td>${item.driver || '—'}</td>
            <td>${item.culprit || '—'}</td>
            <td style="text-align: right;">${damageVal}</td>
            <td>${item.account_number || '0.0'}</td>
            <td style="${paidStyle}">${paidVal}</td>
            <td>${item.description || ''}</td>
            <td>${formatDT(item.actual_date)}</td>
            <td><b>${item.status_name || 'На контроле'}</b></td>
        `;
    }
},
dtp_history: {
    title: 'ДТП машины',
    columns: [
        { field: 'fact_date', label: 'Факт', width: '110px' },
        { field: 'detected_date', label: 'Обнаружено', width: '110px' },
        { field: 'driver', label: 'Водитель', width: '160px' },
        { field: 'culprit', label: 'Виновник', width: '160px' },
        { field: 'damage_amount', label: 'Ущерб', width: '90px', align: 'right' },
        { field: 'account_number', label: 'Счет', width: '90px', align: 'right' },
        { field: 'paid_amount', label: 'Выплачено', width: '90px', align: 'right' },
        { field: 'description', label: 'Описание' },
        { field: 'doc_number', label: 'Документ ДТП', width: '180px' }
    ],
    render: (item) => {
        const formatOnlyDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        };

        const damageVal = Number(item.damage_amount || 0).toFixed(2);
        const billVal = Number(item.account_number || 0).toFixed(2);
        const paidVal = Number(item.paid_amount || 0).toFixed(2);
        
        const formattedDate = formatOnlyDate(item.detected_date || item.fact_date || item.doc_date);
        const docText = item.doc_number ? `ДТП ${item.doc_number}` : 'ДТП';
        const docDisplay = formattedDate ? `${docText} от ${formattedDate}` : docText;

        return `
            <td>${formatOnlyDate(item.fact_date)}</td>
            <td>${formatOnlyDate(item.detected_date)}</td>
            <td>${item.driver || '—'}</td>
            <td>${item.culprit || '—'}</td>
            <td style="text-align: right;">${damageVal}</td>
            <td style="text-align: right;">${billVal}</td>
            <td style="text-align: right;">${paidVal}</td>
            <td>${item.description || ''}</td>
            <td><b><b>${docDisplay}</b></b></td>
        `;
    }
},
accident_invoices: {
    title: 'Выставленные счета по ДТП',
    columns: [
        { field: 'invoice_date', label: 'Дата', width: '150px' },
        { field: 'debtor', label: 'Должник', width: '180px' },
        { field: 'amount', label: 'Сумма', width: '120px', align: 'right' },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => {
        const formatDT = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        const sumVal = Number(item.amount || 0).toFixed(2);

        return `
            <td>${formatDT(item.invoice_date)}</td>
            <td>${item.debtor || '—'}</td>
            <td style="text-align: right;">${sumVal}</td>
            <td>${item.description || ''}</td>
        `;
    }
},
accident_payments: {
    title: 'Оплаченные счета по ДТП',
    columns: [
        { field: 'payment_date', label: 'Дата', width: '150px', type: 'datetime-local' },
        { field: 'payer', label: 'Плательщик', width: '180px' },
        { field: 'amount', label: 'Сумма', width: '120px', align: 'right' },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => {
        const formatDT = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        const sumVal = Number(item.amount || 0).toFixed(2);

        return `
            <td>${formatDT(item.payment_date)}</td>
            <td>${item.payer_name || item.payer || item.payer_id || '—'}</td>
            <td style="text-align: right;">${sumVal}</td>
            <td>${item.description || ''}</td>
        `;
    }
},
accident_events: {
    title: 'События ДТП',
    columns: [
        { field: 'event_date', label: 'Дата', width: '160px' },
        { field: 'event_text', label: 'Событие' }
    ],
    render: (item) => {
        const formatDT = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        return `
            <td>${formatDT(item.event_date)}</td>
            <td><b>${item.event_text || ''}</b></td>
        `;
    }
},accident_images: {
    title: 'Изображения ДТП',
    columns: [
        { field: 'created_at', label: 'Дата загрузки', width: '160px' },
        { field: 'image_url', label: 'Изображение', type: 'image', width: '150px' },
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => {
        const formatDT = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        return `
            <td>${formatDT(item.created_at)}</td>
            <td>
                ${item.image_url ? `<a href="${item.image_url}" target="_blank"><img src="${item.image_url}" alt="Фото ДТП" style="width: 100px; height: 75px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc; cursor: pointer;" /></a>` : '—'}
            </td>
            <td>${item.description || ''}</td>
        `;
    }
},
repairs: {
    title: 'Ремонт',
    columns: [
        { field: 'doc_number', label: '№ документа', width: '110px' },
        { 
            field: 'doc_date', 
            label: 'Дата', 
            type: 'datetime-local', 
            width: '160px',
            value: () => {
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            }
        },
        { field: 'doc_type', label: 'Тип документа', width: '130px', ref: 'doc_types' },
        { field: 'repair_type', label: 'Тип ремонта', width: '130px', ref: 'repair_types' },
        { field: 'car_id', label: 'Гос номер', width: '100px', ref: 'cars' },
        { field: 'car_model', label: 'Модель авто', width: '130px', insert: false, update: false, readonly: true },
        { field: 'mileage', label: 'Пробег', width: '90px', align: 'right' },
        { field: 'warehouse_id', label: 'Склад', width: '130px', ref: 'skladi' },
        { field: 'mol_id', label: 'МОЛ', width: '130px', ref: 'mol' },
        { field: 'description', label: 'Описание' },
        { field: 'sum', label: 'Сумма', width: '100px', insert: false, update: false, readonly: true, align: 'right' },
        { field: 'fact_date', label: 'Дата факт', width: '110px', type: 'datetime-local' },
        { field: 'is_posted', label: 'Проведен', width: '90px' }
    ],
    render: (item) => {
        const formatOnlyDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        };

        const mileageVal = item.mileage ? Number(item.mileage).toLocaleString('ru-RU') : '—';
        const sumVal = item.sum ? Number(item.sum).toFixed(2) : '0.00';
        const postedText = item.is_posted ? 'Да' : 'Нет';

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatOnlyDate(item.doc_date)}</td>
            <td>${item.doc_type_name || item.doc_type || '—'}</td>
            <td>${item.repair_type_name || item.repair_type || '—'}</td>
            <td>${item.car_number || item.car_id || '—'}</td>
            <td>${item.car_model || '—'}</td>
            <td style="text-align: right;">${mileageVal}</td>
            <td>${item.warehouse_name || item.warehouse_id || '—'}</td>
            <td>${item.mol_name || item.mol_id || '—'}</td>
            <td>${item.description || ''}</td>
            <td style="text-align: right; font-weight: bold;">${sumVal}</td>
            <td>${formatOnlyDate(item.fact_date)}</td>
            <td>${postedText}</td>
        `;
    }
},
repair_items: {
    title: 'Список запчастей в ремонте',
    columns: [
        { field: 'zaphast_id', label: 'Запчасть', width: '0px', ref: 'zaphasti', insert: true, table: false },
        { field: 'article', label: 'Артикул', width: '110px', insert: false, table: true },
        { field: 'code', label: 'Код', width: '100px', insert: false, table: true },
        { field: 'name', label: 'Наименование', width: '220px', insert: false, table: true },
        { field: 'quantity', label: 'Кол-во', width: '80px', insert: true, table: true },
        { field: 'unit', label: 'Ед. изм', width: '70px', insert: false, table: true },
        { field: 'price', label: 'Цена за штуку', width: '90px', insert: false, table: true }, // Скрываем из формы, цена подставится сама
        { field: 'total', label: 'Сумма', width: '90px', insert: false, table: true },
        { field: 'description', label: 'Описание', width: '150px', insert: true, table: true },
        { field: 'receipt_id', label: 'Документ прихода', width: '150px', ref: 'receipts', insert: false, table: true }, // Скрываем из формы, бэкенд подхватит со склада
    ],
    render: (item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const totalSum = Number(item.total) || (price * qty);
        const incomeDocText = item.income_document || item.receipt_doc || (item.receipt_id ? `Документ ID: ${item.receipt_id}` : '—');

        return `
            <td>${item.article || item.zaphasti_article || ''}</td>
            <td>${item.code || item.zaphasti_code || ''}</td>
            <td><b>${item.name || item.zaphasti_name || '—'}</b></td>
            <td>${qty}</td>
            <td>${item.unit || item.zaphasti_unit || 'шт'}</td>
            <td>${price.toFixed(2)}</td>
            <td><b>${totalSum.toFixed(2)}</b></td>
            <td>${item.description || ''}</td>
            <td style="color: #000000; font-style: normal;">${incomeDocText}</td>
        `;
    }
},
repair_works: {
    title: 'Выполненные работы',
    columns: [
        { field: 'ispolnitel_id', label: 'Исполнитель', width: '180px', ref: 'ispolnitel', insert: true, table: true },
        { field: 'work_id', label: 'Работа', width: '220px', ref: 'works', insert: true, table: true },
        { field: 'price', label: 'Стоимость', width: '120px', align: 'right', insert: true, table: true },
        { field: 'description', label: 'Описание', insert: true, table: true }
    ],
    render: (item) => {
        const priceVal = item.price ? Number(item.price).toFixed(2) : '0.00';
        
        return `
            <td>${item.ispolnitel_name || item.ispolnitel_id || '—'}</td>
            <td><b>${item.work_name || item.work_id || '—'}</b></td>
            <td style="text-align: right;">${priceVal}</td>
            <td>${item.description || ''}</td>
        `;
    }
},repair_history: {
    title: 'Ремонт машины',
    columns: [
        { field: 'article', label: 'Артикул', width: '100px' },
        { field: 'code', label: 'Код', width: '80px' },
        { field: 'name', label: 'Наименование', width: '220px' },
        { field: 'qty', label: 'Кол-во', width: '70px', align: 'center' },
        { field: 'unit', label: 'Ед.изм', width: '70px', align: 'center' },
        { field: 'price', label: 'Цена РУБ', width: '90px', align: 'right' },
        { field: 'sum', label: 'Сумма РУБ', width: '90px', align: 'right' },
        { field: 'description', label: 'Описание' },
        { field: 'doc_source', label: 'Документ прихода / Исполнитель', width: '200px' }
    ],
    render: (repairsList) => {
        if (!Array.isArray(repairsList) || repairsList.length === 0) {
            return `<tr><td colspan="9" style="text-align: center; color: #888; padding: 20px;">Нет данных по ремонту</td></tr>`;
        }

        let html = '';

        repairsList.forEach((repair, index) => {
            const repairType = repair.repair_type_name || repair.type || 'Ремонт';
            const docNum = repair.doc_number || '';
            const docDate = repair.doc_date ? new Date(repair.doc_date).toLocaleDateString('ru-RU') : '';
            const mileage = repair.mileage ? ` | ${repair.mileage} км` : '';
            const groupId = `repair-group-${repair.id || index}`;
            
            let calculatedTotal = 0;
            if (repair.items && repair.items.length > 0) {
                repair.items.forEach(item => {
                    const itemSum = Number(item.total_sum || item.sum || (Number(item.quantity || item.qty || 1) * Number(item.price || 0)) || 0);
                    calculatedTotal += itemSum;
                });
            } else {
                calculatedTotal = Number(repair.total_cost || repair.sum || 0);
            }
            const costVal = calculatedTotal.toFixed(2);
            
            html += `
                <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #dee2e6; border-bottom: 2px solid #ced4da; cursor: pointer;" onclick="toggleRepairGroup('${groupId}', this)">
                    <td colspan="9" style="padding: 7px 10px; color: #333333; font-size: 13px;">
                        <i class="fas fa-minus-square toggle-icon" style="color: #495057; margin-right: 6px;"></i>
                        <span style="color: #212529;">${repairType} ${docNum} от ${docDate}</span> 
                        <span style="color: #6c757d; font-weight: normal; margin: 0 6px;">|</span> 
                        <span style="color: #495057;">${repair.category || 'Плановый'}</span> 
                        <span style="color: #6c757d; font-weight: normal; margin: 0 6px;">|</span> 
                        <span style="color: #d97706;">Итого: ${costVal} руб.${mileage}</span>
                    </td>
                </tr>
            `;

            if (repair.items && repair.items.length > 0) {
                repair.items.forEach(item => {
                    const price = Number(item.price || 0).toFixed(2);
                    const sum = Number(item.total_sum || item.sum || (Number(item.quantity || item.qty || 1) * Number(item.price || 0))).toFixed(2);
                    const qty = item.quantity || item.qty || '';
                    
                    html += `
                        <tr class="${groupId}" style="background-color: #ffffff;">
                            <td style="padding-left: 25px;">${item.article || ''}</td>
                            <td>${item.code || ''}</td>
                            <td>${item.name || ''}</td>
                            <td style="text-align: center;">${qty}</td>
                            <td style="text-align: center;">${item.unit || 'шт'}</td>
                            <td style="text-align: right;">${price}</td>
                            <td style="text-align: right;">${sum}</td>
                            <td>${item.description || ''}</td>
                            <td>${item.doc_source || item.contractor || ''}</td>
                        </tr>
                    `;
                });
            } else {
                html += `
                    <tr class="${groupId}" style="background-color: #ffffff;">
                        <td colspan="2"></td>
                        <td colspan="5" style="color: #333;">${repair.description || '—'}</td>
                        <td></td>
                        <td style="color: #555;">${repair.contractor || ''}</td>
                    </tr>
                `;
            }
        });

        if (typeof window.toggleRepairGroup === 'undefined') {
            window.toggleRepairGroup = function(groupId, headerRow) {
                const rows = document.querySelectorAll(`.${groupId}`);
                const icon = headerRow.querySelector('.toggle-icon');
                if (rows.length === 0) return;

                const isHidden = rows[0].style.display === 'none';
                rows.forEach(row => {
                    row.style.display = isHidden ? '' : 'none';
                });

                if (isHidden) {
                    icon.classList.remove('fa-plus-square');
                    icon.classList.add('fa-minus-square');
                } else {
                    icon.classList.remove('fa-minus-square');
                    icon.classList.add('fa-plus-square');
                }
            };
        }

        return html;
    }
},
car_general: {
    title: 'Общая',
    columns: [
        { field: 'date', label: 'Дата', width: '100px', align: 'center' },
        { field: 'name', label: 'Наименование', width: '250px' },
        { field: 'qty', label: 'Кол-во', width: '70px', align: 'center' },
        { field: 'unit', label: 'Ед.изм', width: '70px', align: 'center' },
        { field: 'price', label: 'Цена РУБ', width: '90px', align: 'right' },
        { field: 'sum', label: 'Сумма РУБ', width: '90px', align: 'right' },
        { field: 'description', label: 'Описание' },
        { field: 'document', label: 'Документ', width: '250px' }
    ],
    render: (itemsList) => {
        if (!Array.isArray(itemsList) || itemsList.length === 0) {
            return `<tr><td colspan="8" style="text-align: center; color: #888; padding: 20px;">Нет общих данных по машине</td></tr>`;
        }

        const monthsMap = {};
        const monthNames = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];

        itemsList.forEach(item => {
            const dateObj = new Date(item.operational_date || Date.now());
            const monthName = monthNames[dateObj.getMonth()];
            const year = dateObj.getFullYear();
            const groupKey = `${monthName} ${year}`; 

            if (!monthsMap[groupKey]) {
                monthsMap[groupKey] = { items: [], totalSum: 0 };
            }

            const itemSum = Number(item.sum || 0);
            monthsMap[groupKey].items.push(item);
            monthsMap[groupKey].totalSum += itemSum;
        });

        let html = '';
        let groupIndex = 0;

        Object.keys(monthsMap).forEach(monthKey => {
            const group = monthsMap[monthKey];
            const groupId = `general-group-${groupIndex++}`;
            const monthTotal = group.totalSum.toFixed(2);

            html += `
                <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #dee2e6; border-bottom: 2px solid #ced4da; cursor: pointer;" onclick="toggleGeneralGroup('${groupId}', this)">
                    <td colspan="8" style="padding: 7px 10px; color: #333333; font-size: 13px; text-transform: none;">
                        <i class="fas fa-minus-square toggle-icon" style="color: #495057; margin-right: 6px;"></i>
                        <span style="color: #212529;">${monthKey}</span> 
                        <span style="color: #6c757d; font-weight: normal; margin: 0 6px;">|</span> 
                        <span style="color: #d97706;">Итого за месяц: ${monthTotal} руб.</span>
                    </td>
                </tr>
            `;

            group.items.forEach(item => {
                const itemDate = item.operational_date ? new Date(item.operational_date).toLocaleDateString('ru-RU') : '';
                const price = item.price ? Number(item.price).toFixed(2) : '';
                const sum = item.sum ? Number(item.sum).toFixed(2) : '';
                const qty = item.qty || '';

                html += `
                    <tr class="${groupId}" style="background-color: #ffffff;">
                        <td style="text-align: center;">${itemDate}</td>
                        <td>${item.name || ''}</td>
                        <td style="text-align: center;">${qty}</td>
                        <td style="text-align: center;">${item.unit || ''}</td>
                        <td style="text-align: right;">${price}</td>
                        <td style="text-align: right;">${sum}</td>
                        <td>${item.description || ''}</td>
                        <td>${item.document || ''}</td>
                    </tr>
                `;
            });
        });

        if (typeof window.toggleGeneralGroup === 'undefined') {
            window.toggleGeneralGroup = function(groupId, headerRow) {
                const rows = document.querySelectorAll(`.${groupId}`);
                const icon = headerRow.querySelector('.toggle-icon');
                if (rows.length === 0) return;

                const isHidden = rows[0].style.display === 'none';
                rows.forEach(row => {
                    row.style.display = isHidden ? '' : 'none';
                });

                if (isHidden) {
                    icon.classList.remove('fa-plus-square');
                    icon.classList.add('fa-minus-square');
                } else {
                    icon.classList.remove('fa-minus-square');
                    icon.classList.add('fa-plus-square');
                }
            };
        }

        return html;
    }
},
realizations: {
    title: 'Реализация',
    columns: [
        { field: 'doc_number', label: '№ документа', width: '110px' },
        { 
            field: 'doc_date', 
            label: 'Дата', 
            type: 'datetime-local', 
            width: '160px',
            value: () => {
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            }
        },
        { field: 'customer_id', label: 'Покупатель', width: '150px', ref: 'customers' },
        { field: 'sklad_id', label: 'Склад', width: '130px', ref: 'skladi' },
        { field: 'mol_id', label: 'МОЛ', width: '130px', ref: 'mol' },
        // Слева: Гос. номер (поиск идет по нему благодаря кастомному отображению в ref)
        { field: 'car_id', label: 'Гос. номер', width: '120px', ref: 'customer_cars', formatRef: (car) => car.gos_number || car.car_number || `ID #${car.id}` },
        // Справа: Марка авто (ссылается на тот же справочник, но выводит марку/модель)
        { field: 'car_id', label: 'Марка авто', width: '140px', ref: 'customer_cars', formatRef: (car) => `${car.brand || ''} ${car.model || ''}`.trim() || '—' },
        { field: 'description', label: 'Описание' },
        { field: 'sum_parts', label: 'Запчасти', width: '90px', insert: false, update: false, readonly: true, align: 'right' },
        { field: 'sum_work', label: 'Работа', width: '90px', insert: false, update: false, readonly: true, align: 'right' },
        { field: 'sum_total', label: 'Всего', width: '90px', insert: false, update: false, readonly: true, align: 'right' },
        { field: 'fact_date', label: 'Дата факт', width: '110px', type: 'datetime-local' },
        { field: 'is_posted', label: 'Проведен', width: '90px' }
    ],
    render: (item) => {
        const formatOnlyDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        };

        const sumPartsVal = item.sum_parts ? Number(item.sum_parts).toFixed(2) : '0.00';
        const sumWorkVal = item.sum_work ? Number(item.sum_work).toFixed(2) : '0.00';
        const sumTotalVal = item.sum_total ? Number(item.sum_total).toFixed(2) : '0.00';
        const postedText = item.is_posted ? 'Да' : 'Нет';

        // Достаем значения для раздельных ячеек таблицы
        const gosNumber = item.car_number || item.gos_number || (item.car && (item.car.gos_number || item.car.car_number)) || '—';
        const carBrandModel = `${item.car_brand || (item.car && item.car.brand) || ''} ${item.car_model || (item.car && item.car.model) || ''}`.trim() || item.car_display_name || '—';

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatOnlyDate(item.doc_date)}</td>
            <td>${item.customer_name || item.customer_id || '—'}</td>
            <td>${item.sklad_name || item.sklad_id || '—'}</td>
            <td>${item.mol_name || item.mol_id || '—'}</td>
            <td><b>${gosNumber}</b></td>
            <td>${carBrandModel}</td>
            <td>${item.description || ''}</td>
            <td style="text-align: right;">${sumPartsVal}</td>
            <td style="text-align: right;">${sumWorkVal}</td>
            <td style="text-align: right; font-weight: bold;">${sumTotalVal}</td>
            <td>${formatOnlyDate(item.fact_date)}</td>
            <td>${postedText}</td>
        `;
    }
},
realization_items: {
    title: 'Спецификация реализации',
    columns: [
        // Добавляем поле выбора запчасти со ссылкой на справочник
        { field: 'zaphasti_id', label: 'Запчасть', ref: 'zaphasti', table: false },
        
        { field: 'article', label: 'Артикул', width: '90px', table: true },
        { field: 'code', label: 'Код', width: '80px', table: true },
        { field: 'name', label: 'Наименование', width: '180px', table: true },
        { field: 'quantity', label: 'Кол-во', width: '70px', type: 'number', table: true },
        { field: 'unit', label: 'Ед. изм', width: '60px', type: 'text', table: true },
        { field: 'purchase_price', label: 'Закупка', width: '90px', type: 'number', table: true },
        { field: 'retail_price', label: 'Розница', width: '90px', type: 'number', table: true },
        { field: 'price', label: 'Реализация', width: '95px', type: 'number', table: true },
        { field: 'discount', label: 'Скидка', width: '80px', type: 'text', table: true },
        { field: 'total_rub', label: 'Сумма', width: '85px', table: true },
        { field: 'description', label: 'Описание', width: '130px', type: 'textarea', table: true },
        { field: 'income_document_id', label: 'Док. прихода', width: '110px', type: 'text', table: true }
    ],
    
    render: (item) => {
        if (!item) return '';

        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const totalSum = Number(item.total_rub) || (qty * price);
        
        const purchasePrice = Number(item.purchase_price || 0).toFixed(2);
        const retailPrice = Number(item.retail_price || 0).toFixed(2);
        const realizationPrice = price.toFixed(2);
        
        const article = item.article || '—';
        const code = item.code || '—';
        const name = item.name || '—';
        const unit = item.unit || 'шт';
        const discountText = item.discount || '';
        
        // Меняем здесь: берем готовый текст из бэкенда (income_document), а не ID
        const incomeDoc = item.income_document || '—';

        return `
            <td>${article}</td>
            <td>${code}</td>
            <td><b>${name}</b></td>
            <td style="text-align: right;">${qty}</td>
            <td style="text-align: center;">${unit}</td>
            <td style="text-align: right;">${purchasePrice}</td>
            <td style="text-align: right;">${retailPrice}</td>
            <td style="text-align: right; color: #2563eb; font-weight: 500;">${realizationPrice}</td>
            <td>${discountText}</td>
            <td style="text-align: right; font-weight: bold;">${Number(totalSum).toFixed(2)}</td>
            <td>${item.description || ''}</td>
            <td>${incomeDoc}</td>
        `;
    }
},
realization_works: {
    title: 'Спецификация услуг',
    columns: [
        // Поле выбора услуги со ссылкой на справочник vidy_rabot (в самой таблице не выводится, нужно для модалки добавления)
        { field: 'vidy_rabot_id', label: 'Услуга', ref: 'vidy_rabot', table: false },
        
        { field: 'name', label: 'Наименование', width: '220px', table: true },
        { field: 'quantity', label: 'Кол-во', width: '80px', type: 'number', table: true },
        { field: 'retail_price', label: 'Розница', width: '90px', type: 'number', table: true },
        { field: 'price', label: 'Реализация', width: '95px', type: 'number', table: true },
        { field: 'discount', label: 'Скидка', width: '100px', type: 'text', table: true },
        { field: 'total_rub', label: 'Сумма РУБ', width: '85px', table: true },
        { field: 'description', label: 'Описание', width: '130px', type: 'textarea', table: true }
    ],
    
    render: (item) => {
        if (!item) return '';

        const qty = Number(item.quantity) || 1;
        const retailPrice = Number(item.retail_price || 0).toFixed(2);
        const realizationPrice = Number(item.price || 0).toFixed(2);
        const totalSum = Number(item.total_rub || 0).toFixed(2);
        
        const name = item.name || '—';
        const discountText = item.discount || '';

        return `
            <td><b>${name}</b></td>
            <td style="text-align: right;">${qty}</td>
            <td style="text-align: right;">${retailPrice}</td>
            <td style="text-align: right; color: #2563eb; font-weight: 500;">${realizationPrice}</td>
            <td>${discountText}</td>
            <td style="text-align: right; font-weight: bold;">${totalSum}</td>
            <td>${item.description || ''}</td>
        `;
    }
},

money_receipts_by_sklad: {
    title: 'Аналитика продаж по складам',
    columns: [
        { field: 'sklad_name', label: 'Склад', width: '220px' },
        { field: 'total_orders', label: 'Заказов', width: '80px', align: 'center' },
        { field: 'total_qty', label: 'Кол-во (шт)', width: '90px', align: 'right' },
        { field: 'parts_sum', label: 'Запчасти', width: '110px', align: 'right' },
        { field: 'works_sum', label: 'Услуги', width: '110px', align: 'right' },
        { field: 'total_realization_sum', label: 'Общая', width: '120px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'debt_sum', label: 'Долг', width: '110px', align: 'right' }
    ],
    render: (item) => {
        const totalQty = Number(item.total_qty || 0).toFixed(2);
        const partsSum = Number(item.parts_sum || 0).toFixed(2);
        const worksSum = Number(item.works_sum || 0).toFixed(2);
        const realizationSum = Number(item.total_realization_sum || 0).toFixed(2);
        const totalPaid = Number(item.total_paid || 0).toFixed(2);
        const debtSumNum = Number(item.debt_sum || item.total_debt || 0);
        const debtSum = debtSumNum.toFixed(2);

        return `
            <td><span style="color: #0284c7; font-weight: bold; font-size: 14px;">${item.sklad_name || 'Основной склад'}</span></td>
            <td style="text-align: center;">${item.total_orders || 0}</td>
            <td style="text-align: right;">${totalQty}</td>
            <td style="text-align: right; color: #4b5563;">${partsSum}</td>
            <td style="text-align: right; color: #0284c7;">${worksSum}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a; font-size: 14px;">+${realizationSum}</td>
            <td style="text-align: right; color: #16a34a; font-weight: bold;">${totalPaid}</td>
            <td style="text-align: right; font-weight: bold; color: ${debtSumNum > 0 ? '#dc2626' : '#6b7280'};">${debtSum}</td>
        `;
    }
},

money_receipts: {
    title: 'Список продаж (реализаций)',
    columns: [
        { field: 'doc_number', label: '№ Документа', width: '100px' },
        { field: 'date', label: 'Дата', width: '100px' },
        { field: 'counterparty_name', label: 'Покупатель', width: '160px' },
        { field: 'sklad_name', label: 'Склад', width: '120px' },
        { field: 'parts_sum', label: 'Сумма зап.', width: '105px', align: 'right' },
        { field: 'works_sum', label: 'Сумма усл.', width: '105px', align: 'right' },
        { field: 'total_realization_sum', label: 'Сумма', width: '110px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'debt_sum', label: 'Долг', width: '110px', align: 'right' },
        { field: 'actions', label: 'Действие', width: '100px', align: 'center' }
    ],
    render: (item) => {
        const partsSum = Number(item.parts_sum || 0).toFixed(2);
        const worksSum = Number(item.works_sum || 0).toFixed(2);
        const sum = Number(item.total_realization_sum || 0).toFixed(2);
        const totalPaidNum = Number(item.total_paid || 0);
        const formattedPaid = totalPaidNum.toFixed(2);
        const debtSumNum = Number(item.debt_sum || item.total_debt || 0);
        const debtSum = debtSumNum.toFixed(2);
        const formattedDate = item.date ? new Date(item.date).toLocaleDateString() : '—';
        const docTitle = item.doc_number || item.id;

        // Если есть оплата, делаем сумму кликабельной для просмотра истории, иначе просто выводим текст
        const paidHtml = totalPaidNum > 0 
            ? `<span onclick="openIncomePaymentHistory('${item.id}', '${docTitle}')" style="color: #16a34a; font-weight: bold; cursor: pointer; text-decoration: underline; text-decoration-style: dotted;" title="Посмотреть историю поступлений">${formattedPaid} </span>`
            : `<span style="color: #16a34a; font-weight: bold;">${formattedPaid}</span>`;

        // Если долг погашен (меньше или равен 0), выводим текст «Оплачено», иначе кнопку «Оплатить»
        const actionHtml = debtSumNum <= 0 
            ? `<span style="color: #16a34a; font-weight: 600; font-size: 12px;">Оплачено</span>`
            : `<button type="button" onclick="openIncomePaymentDrawer('${item.id}', '${debtSum}', '${docTitle}')" 
                style="background: #16a34a; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                Оплатить
              </button>`;

        return `
            <td><b>№ ${docTitle}</b></td>
            <td><span style="color: #4b5563;">${formattedDate}</span></td>
            <td>${item.counterparty_name || 'Розничный покупатель'}</td>
            <td><span style="color: #0284c7; font-weight: 500;">${item.sklad_name || '—'}</span></td>
            <td style="text-align: right;">${partsSum}</td>
            <td style="text-align: right; color: #0284c7;">${worksSum}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">+${sum} </td>
            <td style="text-align: right;">${paidHtml}</td>
            <td style="text-align: right; font-weight: bold; color: ${debtSumNum > 0 ? '#dc2626' : '#6b7280'};">
                ${debtSum} 
            </td>
            <td style="text-align: center;">
                ${actionHtml}
            </td>
        `;
    }
},

income_payments: {
    title: 'История всех поступлений',
    columns: [
        { field: 'payment_date', label: 'Дата оплаты', width: '130px' },
        { field: 'doc_number', label: '№ Документа', width: '120px' },
        { field: 'counterparty_name', label: 'Покупатель', width: '180px' },
        { field: 'amount', label: 'Сумма оплаты', width: '120px', align: 'right' },
        { field: 'comment', label: 'Комментарий', width: '250px' }
    ],
    render: (item) => {
        const amount = Number(item.amount || 0).toFixed(2);
        const date = item.payment_date ? new Date(item.payment_date).toLocaleDateString() : '—';

        return `
            <td><span style="color: #4b5563;">${date}</span></td>
            <td><b>№ ${item.doc_number || item.parent_id}</b></td>
            <td>${item.counterparty_name || '—'}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">+${amount}</td>
            <td style="color: #6b7280; font-size: 13px;">${item.comment || '—'}</td>
        `;
    }
},

money_receipts_detail: {
    title: 'Детализация: купленные товары и услуги',
    columns: [
        { field: 'doc_number', label: 'Документ', width: '100px' },
        { field: 'product_code', label: 'Код / Тип', width: '90px' },
        { field: 'product_name', label: 'Наименование товара / услуги', width: '240px' },
        { field: 'quantity', label: 'Кол-во', width: '80px', align: 'center' },
        { field: 'purchase_price', label: 'Закупка (шт)', width: '110px', align: 'right' },
        { field: 'retail_price', label: 'Розница (шт)', width: '110px', align: 'right' },
        { field: 'final_unit_price', label: 'Цена со скидкой', width: '120px', align: 'right' },
        { field: 'total_rub', label: 'Итого сумма', width: '120px', align: 'right' }
    ],
    render: (item) => {
        const qty = Number(item.quantity || 0).toFixed(2);
        const purchase = Number(item.purchase_price || 0).toFixed(2);
        const retail = Number(item.retail_price || 0).toFixed(2);
        const finalPrice = Number(item.final_unit_price || 0).toFixed(2);
        const total = Number(item.total_rub || 0).toFixed(2);

        // Если это услуга, можно сделать красивую визуализацию кода или подкрасить строку
        const isWork = item.item_type === 'work';
        const codeDisplay = isWork ? '<span style="color: #0284c7; font-weight: 600;">Услуга</span>' : (item.product_code || '—');

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${codeDisplay}</td>
            <td><b>${item.item_name || item.product_name || '—'}</b></td>
            <td style="text-align: center;">${qty}</td>
            <td style="text-align: right; color: #666;">${purchase} </td>
            <td style="text-align: right; text-decoration: line-through; color: #999;">${retail} </td>
            <td style="text-align: right; color: #0284c7; font-weight: 500;">${finalPrice} </td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">+${total} </td>
        `;
    }
},

money_receipts_works_detail: {
    title: 'Детализация: оказанные услуги и работы',
    columns: [
        { field: 'doc_number', label: 'Документ', width: '100px' },
        { field: 'work_name', label: 'Наименование услуги', width: '220px' },
        { field: 'quantity', label: 'Кол-во', width: '70px', align: 'center' },
        { field: 'retail_price', label: 'Розница', width: '100px', align: 'right' },
        { field: 'final_unit_price', label: 'Реализация', width: '100px', align: 'right' },
        { field: 'discount_label', label: 'Скидка', width: '110px', align: 'center' },
        { field: 'total_rub', label: 'Сумма РУБ', width: '110px', align: 'right' },
        { field: 'description', label: 'Описание', width: '150px' }
    ],
    render: (item) => {
        const qty = Number(item.quantity || 0).toFixed(2);
        const retail = Number(item.retail_price || 0).toFixed(2);
        const finalPrice = Number(item.final_unit_price || 0).toFixed(2);
        const total = Number(item.total_rub || 0).toFixed(2);
        const discountText = item.discount_label || 'Розница (0%)';
        const desc = item.description || '';

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td><b>${item.work_name || '—'}</b></td>
            <td style="text-align: center;">${qty}</td>
            <td style="text-align: right; text-decoration: line-through; color: #999;">${retail}</td>
            <td style="text-align: right; color: #0055ea; font-weight: 500;">${finalPrice}</td>
            <td style="text-align: center; color: #555; font-size: 11px;">${discountText}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">${total}</td>
            <td style="color: #666; font-style: italic;">${desc}</td>
        `;
    }
},



expenses_by_sklad: {
    title: 'Аналитика расходов (закупок) по складам',
    columns: [
        { field: 'sklad_name', label: 'Склад', width: '200px' },
        { field: 'total_receipts', label: 'Закупок', width: '70px', align: 'center' },
        { field: 'total_qty', label: 'Кол-во (шт)', width: '80px', align: 'right' },
        { field: 'total_expense_sum', label: 'Сумма закупки', width: '120px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '120px', align: 'right' },
        { field: 'total_debt', label: 'Долг', width: '120px', align: 'right' }
    ],
    render: (item) => {
        const totalQty = Number(item.total_qty || 0).toFixed(2);
        const expenseSum = Number(item.total_expense_sum || 0).toFixed(2);
        const totalPaid = Number(item.total_paid || 0).toFixed(2);
        const totalDebt = Number(item.total_debt || 0).toFixed(2);

        return `
            <td><span style="color: #d97706; font-weight: bold; font-size: 14px;">${item.sklad_name || 'Основной склад'}</span></td>
            <td style="text-align: center;">${item.total_receipts || 0}</td>
            <td style="text-align: right;">${totalQty}</td>
            <td style="text-align: right; font-weight: bold; color: #dc2626;">-${expenseSum} </td>
            <td style="text-align: right; color: #16a34a; font-weight: bold;">${totalPaid} </td>
            <td style="text-align: right; font-weight: bold; color: ${Number(totalDebt) > 0 ? '#dc2626' : '#6b7280'};">
                ${totalDebt} 
            </td>
        `;
    }
},

expenses_by_suppliers: {
    title: 'Аналитика закупленных товаров по поставщикам',
    columns: [
        { field: 'postavhik_name', label: 'Поставщик', width: '180px' },
        { field: 'sklad_name', label: 'Склад поступления', width: '120px' },
        { field: 'total_receipts', label: 'Закупок', width: '60px', align: 'center' },
        { field: 'total_qty', label: 'Кол-во', width: '70px', align: 'right' },
        { field: 'total_expense_sum', label: 'Сумма затрат', width: '110px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'total_debt', label: 'Долг', width: '110px', align: 'right' }
    ],
    render: (item) => {
        const totalQty = Number(item.total_qty || 0).toFixed(2);
        const expenseSum = Number(item.total_expense_sum || 0).toFixed(2);
        const totalPaid = Number(item.total_paid || 0).toFixed(2);
        const totalDebt = Number(item.total_debt || 0).toFixed(2);

        return `
            <td><b>${item.postavhik_name || 'Основной поставщик'}</b></td>
            <td><span style="color: #0284c7; font-weight: 500;">${item.sklad_name || '—'}</span></td>
            <td style="text-align: center;">${item.total_receipts || 0}</td>
            <td style="text-align: right;">${totalQty}</td>
            <td style="text-align: right; font-weight: bold; color: #dc2626;">-${expenseSum} </td>
            <td style="text-align: right; color: #16a34a; font-weight: bold;">${totalPaid} </td>
            <td style="text-align: right; font-weight: bold; color: ${Number(totalDebt) > 0 ? '#dc2626' : '#6b7280'};">
                ${totalDebt} 
            </td>
        `;
    }
},
expense_items: {
    title: 'Детали закупленных позиций',
    columns: [
        { field: 'part_name', label: 'Наименование запчасти', width: '250px' },
        { field: 'article', label: 'Артикул', width: '130px' },
        { field: 'quantity', label: 'Кол-во', width: '80px', align: 'right' },
        { field: 'purchase_price', label: 'Цена закупки', width: '110px', align: 'right' },
        { field: 'total_rub', label: 'Сумма', width: '120px', align: 'right' }
    ],
    render: (item) => {
        const qty = Number(item.quantity || 0).toFixed(2);
        const price = Number(item.purchase_price || 0).toFixed(2);
        const total = Number(item.total_rub || 0).toFixed(2);

        return `
            <td><b>${item.part_name || item.name || 'Запчасть'}</b></td>
            <td><span style="color: #6b7280; font-family: monospace;">${item.article || '—'}</span></td>
            <td style="text-align: right; font-weight: 500;">${qty}</td>
            <td style="text-align: right; color: #4b5563;">${price} </td>
            <td style="text-align: right; font-weight: bold; color: #dc2626;">${total} </td>
        `;
    }
},

expenses_by_receipts: {
    title: 'Список накладных (документов прихода)',
    columns: [
        { field: 'doc_number', label: '№ Документа', width: '120px' },
        { field: 'date', label: 'Дата', width: '110px' },
        { field: 'postavhik_name', label: 'Поставщик', width: '160px' },
        { field: 'sklad_name', label: 'Склад', width: '120px' },
        { field: 'total_qty', label: 'Кол-во', width: '70px', align: 'right' },
        { field: 'total_expense_sum', label: 'Сумма', width: '110px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'debt_sum', label: 'Долг', width: '110px', align: 'right' },
        { field: 'actions', label: 'Действие', width: '100px', align: 'center' }
    ],
    render: (item) => {
        const qty = Number(item.total_qty || 0).toFixed(2);
        const sum = Number(item.total_expense_sum || 0).toFixed(2);
        const totalPaidNum = Number(item.total_paid || 0);
        const formattedPaid = totalPaidNum.toFixed(2);
        const debtSumNum = Number(item.debt_sum || 0);
        const debtSum = debtSumNum.toFixed(2);
        const formattedDate = item.date ? new Date(item.date).toLocaleDateString() : '—';
        const docTitle = item.doc_number || item.id;

        // Если есть оплата, делаем сумму кликабельной для просмотра истории, иначе просто выводим текст
        const paidHtml = totalPaidNum > 0 
            ? `<span onclick="openPaymentHistory('${item.id}', '${docTitle}')" style="color: #16a34a; font-weight: bold; cursor: pointer; text-decoration: underline; text-decoration-style: dotted;" title="Посмотреть историю оплат">${formattedPaid} </span>`
            : `<span style="color: #16a34a; font-weight: bold;">${formattedPaid}</span>`;

        // Если долг погашен (меньше или равен 0), выводим текст «Оплачено», иначе кнопку «Оплатить»
        const actionHtml = debtSumNum <= 0 
            ? `<span style="color: #16a34a; font-weight: 600; font-size: 12px;">Оплачено</span>`
            : `<button type="button" onclick="openPaymentDrawer('${item.id}', '${debtSum}', '${docTitle}')" 
                style="background: #16a34a; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                Оплатить
            </button>`;

        return `
            <td><b>№ ${docTitle}</b></td>
            <td><span style="color: #4b5563;">${formattedDate}</span></td>
            <td>${item.postavhik_name || '—'}</td>
            <td><span style="color: #0284c7; font-weight: 500;">${item.sklad_name || '—'}</span></td>
            <td style="text-align: right;">${qty}</td>
            <td style="text-align: right; font-weight: bold; color: #dc2626;">-${sum} </td>
            <td style="text-align: right;">${paidHtml}</td>
            <td style="text-align: right; font-weight: bold; color: ${debtSumNum > 0 ? '#dc2626' : '#6b7280'};">
                ${debtSum} 
            </td>
            <td style="text-align: center;">
                ${actionHtml}
            </td>
        `;
    }
},

expense_payments: {
    title: 'История всех оплат',
    columns: [
        { field: 'payment_date', label: 'Дата оплаты', width: '130px' },
        { field: 'doc_number', label: '№ Накладной', width: '120px' },
        { field: 'postavhik_name', label: 'Поставщик', width: '180px' },
        { field: 'amount', label: 'Сумма оплаты', width: '120px', align: 'right' },
        { field: 'comment', label: 'Комментарий', width: '250px' }
    ],
    render: (item) => {
        const amount = Number(item.amount || 0).toFixed(2);
        const date = item.payment_date ? new Date(item.payment_date).toLocaleDateString() : '—';

        return `
            <td><span style="color: #4b5563;">${date}</span></td>
            <td><b>№ ${item.doc_number || item.parent_id}</b></td>
            <td>${item.postavhik_name || '—'}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">+${amount}</td>
            <td style="color: #6b7280; font-size: 13px;">${item.comment || '—'}</td>
        `;
    }
}

}












function getConfig(entity) {
    if (!entity || entity === 'undefined') {
        console.warn('⚠️ [getConfig] Внимание! Попытка получить конфиг для пустой сущности (undefined). Вызов из:', new Error().stack);
    }

    if (tableConfig[entity]) {
        return tableConfig[entity];
    }
    
    return {
        title: 'Данные',
        columns: [
            { field: 'name', label: 'Наименование' }
        ],
        render: (item) => `
            <td><b>${item.name || item.title || 'Запись #' + item.id}</b></td>
        `
    };
}

function getOrCreateDrawer() {
    let drawer = document.getElementById('entity-drawer');
    let backdrop = document.getElementById('entity-drawer-backdrop');

    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'entity-drawer-backdrop';
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px);
            z-index: 999; opacity: 0; transition: opacity 0.3s ease;
            pointer-events: none;
        `;
        backdrop.onclick = closeDrawer; 
        document.body.appendChild(backdrop);
    }

    if (!drawer) {
        drawer = document.createElement('div');
        drawer.id = 'entity-drawer';
        drawer.style.cssText = `
            position: fixed; top: 0; right: -440px; width: 420px; height: 100%;
            background: #ffffff; box-shadow: -10px 0 30px rgba(0, 0, 0, 0.12);
            z-index: 1000; transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex; flex-direction: column; padding: 24px;
            box-sizing: border-box; overflow-y: auto; font-family: inherit;
        `;
        document.body.appendChild(drawer);
    }

    return drawer;
}








function openDrawer() {
    const drawer = getOrCreateDrawer();
    const backdrop = document.getElementById('entity-drawer-backdrop');
    
    drawer.style.right = '0px';
    if (backdrop) {
        backdrop.style.opacity = '1';
        backdrop.style.pointerEvents = 'auto';
    }
}

function closeDrawer() {
    const drawer = document.getElementById('entity-drawer');
    const backdrop = document.getElementById('entity-drawer-backdrop');
    
    if (drawer) {
        drawer.style.right = '-440px';
    }
    if (backdrop) {
        backdrop.style.opacity = '0';
        backdrop.style.pointerEvents = 'none';
    }

}


async function openEntityForm(entity, item = null, parentId = null) {
    console.log("🚀 openEntityForm вызвана для сущности:", entity, "item:", item);
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    // ИСПРАВЛЕНИЕ: если объект item пустой, но в него передали id: null или id: undefined, 
    // либо он вообще не передан — считаем это созданием новой записи. 
    // Если вы кликаете «Создать», убедитесь, что передаете item = null (а не объект вроде { id: null }).
    if (!item || item.id === null || item.id === undefined || item.id === '') {
        let nextId = 1;
        let prefix = 'Р-';

        if (entity === 'tehosmotr') {
            prefix = 'ТО-';
        } else if (entity === 'autostrahovanie') {
            prefix = 'АС-';
        } else if (entity === 'accidents') {
            prefix = 'ДТП-';
        } else if (entity === 'realizations' || entity === 'realization_items' || entity === 'realization_works') {
            prefix = 'РЛ-';
        } else if (entity === 'moves' || entity === 'move_items') {
            prefix = 'ПМ-';
        } else if (entity === 'receipts' || entity === 'receipt_items') {
            prefix = 'ПР-';
        }

        try {
            const response = await fetch(`/api/${entity}`);
            if (response.ok) {
                const records = await response.json();
                if (records.length > 0) {
                    const maxId = Math.max(...records.map(r => r.id || 0));
                    nextId = maxId + 1;
                }
            } else {
                console.warn(`Сервер вернул не OK при автонумерации: ${response.status}`);
            }
        } catch (e) {
            console.error('Не удалось получить список для автонумерации', e);
        }

        // Принудительно создаем новый чистый объект без id, чтобы форма знала, что это создание
        item = { 
            id: null,
            doc_number: `${prefix}${nextId}`,
            is_posted: false 
        };

        if (entity === 'realization_items') {
            item.currency = 'Рубль ПМР';
        } else if (entity === 'receipt_items') {
            item.currency = 'Рубль ПМР';
        }

        config.columns.forEach(col => {
            if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
                item[col.field] = currentDateTime;
            }
        });

        if (entity === 'tehosmotr') {
            item.autoservice = 'Евроавтотест';
        }
    } else {
        if (entity === 'realization_items' && !item.currency) {
            item.currency = 'Рубль ПМР';
        } else if (entity === 'receipt_items' && !item.currency) {
            item.currency = 'Рубль ПМР';
        }
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    if (entity === 'postavhik_contacts' && parentId) {
        html += `<input type="hidden" name="postavhik_id" value="${parentId}">`;
    } else if (entity === 'customer_contacts' && parentId) {
        html += `<input type="hidden" name="customer_id" value="${parentId}">`;
    } else if (entity === 'car_details' && parentId) {
        html += `<input type="hidden" name="car_id" value="${parentId}">`;
    } else if (entity === 'moves') {
        // Оставляем пустым для шапки перемещений, поля выводятся через columns
    } else if (entity === 'move_items' && parentId) {
        html += `<input type="hidden" name="move_id" value="${parentId}">`;
    } else if (entity === 'repair_items' && parentId) {
        html += `<input type="hidden" name="repair_id" value="${parentId}">`;
    } else if (entity === 'receipt_items' && parentId) {
        html += `<input type="hidden" name="receipt_id" value="${parentId}">`;
    }

    async function renderField(col) {
        if (col.field === 'id' || col.field === 'dtp_id' || col.field === 'counterparty_id' || col.field === 'postavhik_id' || col.field === 'realization_id' || col.field === 'move_id' || col.field === 'repair_id' || col.field === 'receipt_id') return '';
        if (col.field === 'car_id' && parentId) return '';
        if (col.insert === false) return '';
        if ((col.update === false || col.edit === false) && item && item.id) return '';
        if (entity === 'users' && col.field === 'password_hash' && item && item.id) return '';

        if (entity === 'realization_items') {
            const allowedFields = ['zaphasti_id', 'quantity', 'price', 'description'];
            if (!allowedFields.includes(col.field)) {
                return '';
            }
        }

        if (entity === 'receipt_items') {
            const allowedFields = ['receipt_id', 'zaphasti_id', 'quantity', 'price', 'currency', 'description'];
            if (!allowedFields.includes(col.field)) {
                return '';
            }
        }

        if (entity === 'realization_works') {
            const allowedFields = ['vidy_rabot_id', 'quantity', 'price', 'description'];
            if (!allowedFields.includes(col.field)) {
                return '';
            }
        }

        if (entity === 'move_items') {
            const allowedFields = ['zaphasti_id', 'quantity', 'description'];
            if (!allowedFields.includes(col.field)) {
                return '';
            }
        }

        let val = '';
        if (item) {
            const possibleKeys = [
                col.field, 
                col.field.replace('_id', ''), 
                col.field + '_id',
                col.ref,
                col.ref ? col.ref.slice(0, -1) : ''
            ];

            for (const k of possibleKeys) {
                if (k && item[k] !== undefined && item[k] !== null && item[k] !== '') {
                    val = item[k];
                    break;
                }
            }

            if (val && typeof val === 'object' && val.id !== undefined) {
                val = val.id;
            }
        }

        if (entity === 'realization_items' && col.field === 'currency' && !val) {
            val = 'Рубль ПМР';
        } else if (entity === 'receipt_items' && col.field === 'currency' && !val) {
            val = 'Рубль ПМР';
        }

        let inputHtml = '';
        let fieldReadonly = col.readonly;
        if (isPosted && col.field !== 'is_posted' && col.field !== 'fact_date') {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');
            let optionsHtml = `<option value="">-- Не выбрано --</option>`;

            statusItems.forEach(st => {
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                optionsHtml += `<option value="${st.id}" ${selected}>${st.name}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.ref) {
            const referenceName = col.ref;
            let refItems = [];

            if (referenceName === 'customer_cars') {
                const targetCustomerId = (item && item.customer_id) ? item.customer_id : null;
                if (targetCustomerId) {
                    try {
                        const carRes = await fetch(`/api/customer_cars?customer_id=${targetCustomerId}`);
                        if (carRes.ok) refItems = await carRes.json();
                    } catch (e) {
                        console.error('Ошибка загрузки машин покупателя при открытии:', e);
                    }
                } else if (item && item.car_id) {
                    try {
                        const carRes = await fetch(`/api/customer_cars`);
                        if (carRes.ok) {
                            const allCars = await carRes.json();
                            refItems = allCars;
                        }
                    } catch (e) {
                        console.error('Ошибка загрузки списка машин:', e);
                    }
                }
            } else {
                refItems = await fetchReferenceData(referenceName);
            }

            let optionsHtml = `<option value="">-- Не выбрано --</option>`;

            refItems.forEach(refItem => {
                let displayName = '';
                if (referenceName === 'customer_cars' || referenceName === 'cars') {
                    const gos = refItem.gos_number || refItem.car_number || '';
                    const mdl = refItem.model || refItem.car_model || '';
                    const brd = refItem.brand || refItem.car_brand || '';
                    if (brd || mdl || gos) {
                        displayName = `${brd} ${mdl} (${gos})`.trim();
                    } else {
                        displayName = `Авто #${refItem.id}`;
                    }
                } else {
                    if (referenceName === 'zaphasti') {
                        const art = refItem.article ? `[${refItem.article}] ` : '';
                        const nm = refItem.name || refItem.title || '';
                        displayName = `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                    } else if (referenceName === 'mol') {
                        displayName = refItem.user_fio || refItem.name || refItem.login || (refItem.description && !refItem.description.includes('#') ? refItem.description : '') || `МОЛ #${refItem.id}`;
                    } else {
                        displayName = refItem.user_fio || refItem.name || refItem.login || refItem.name_full || refItem.title || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                    }
                }

                const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
            });

            let extraAttributes = '';
            if (col.field === 'car_id') extraAttributes = 'id="car-select"';
            else if (col.field === 'customer_id') extraAttributes = 'id="customer-select"';
            else if (col.field === 'zaphasti_id') extraAttributes = 'id="zaphasti-select"';
            else if (col.field === 'vidy_rabot_id') extraAttributes = 'id="vidy-rabot-select"';
            else if (col.field === 'warehouse_from_id' || col.field === 'warehouse_id' || col.field === 'skald_id') extraAttributes = `id="${col.field}" class="warehouse-select"`;
            else if (col.field === 'warehouse_to_id') extraAttributes = 'id="warehouse_to_id" class="warehouse-select"';
            else if (col.field === 'mol_from_id' || col.field === 'mol_to_id' || col.field === 'mol_id') extraAttributes = `id="${col.field}" class="mol-select"`;

            inputHtml = `<select name="${col.field}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
            let formattedVal = '';
            if (col.field === 'fact_date' && !val && isPosted) {
                val = currentDateTime;
            }

            if (val) {
                const d = new Date(val);
                if (!isNaN(d)) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    formattedVal = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            }
            inputHtml = `<input type="datetime-local" name="${col.field}" value="${formattedVal}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else {
            const inputType = (col.field === 'password_hash') ? 'password' : 'text';
            inputHtml = `<input type="${inputType}" name="${col.field}" value="${val}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        }

        return `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label}:
                ${inputHtml}
            </label>
        `;
    }

    const carCol = config.columns.find(c => c.field === 'car_id');
    const molCol = config.columns.find(c => c.field === 'mol_id' || c.field === 'mol_from_id');
    const warehouseCol = config.columns.find(c => c.field === 'warehouse_id' || c.field === 'skald_id');

    if (entity === 'realizations' && warehouseCol && molCol) {
        for (const col of config.columns) {
            const allowedRealizationsFields = ['doc_number', 'is_posted', 'fact_date', 'customer_id', 'warehouse_id', 'skald_id', 'mol_id', 'car_id', 'description'];
            if (!allowedRealizationsFields.includes(col.field)) continue;

            if (col.field === 'warehouse_id' || col.field === 'skald_id' || col.field === 'mol_id') continue;
            html += await renderField(col);

            if (col.field === 'doc_number' || col.field === 'date' || col.field === 'customer_id') {
                html += await renderField(warehouseCol);
                html += await renderField(molCol);
            }
        }
    } else if (entity === 'repairs' && carCol && warehouseCol && molCol) {
        for (const col of config.columns) {
            if (col.field === 'car_id' || col.field === 'mol_id' || col.field === 'mol_from_id' || col.field === 'warehouse_id' || col.field === 'skald_id') continue;
            html += await renderField(col);

            if (col.field === 'doc_number' || col.field === 'date' || col.field === 'customer_id') {
                html += await renderField(carCol);
                html += await renderField(warehouseCol);
                html += await renderField(molCol);
            }
        }
    } else if (entity === 'repairs' && carCol && molCol) {
        for (const col of config.columns) {
            if (col.field === 'car_id' || col.field === 'mol_id' || col.field === 'mol_from_id') continue;
            html += await renderField(col);

            if (col.field === 'doc_number' || col.field === 'date' || col.field === 'customer_id') {
                html += await renderField(carCol);
                html += await renderField(molCol);
            }
        }
    } else if (entity === 'autostrahovanie' && carCol) {
        for (const col of config.columns) {
            if (col.field === 'car_id') continue;
            html += await renderField(col);
            
            if (col.field === 'end_date' || col.field === 'next_date' || col.field.includes('end') || col.field.includes('next')) {
                html += await renderField(carCol);
            }
        }
    } else {
        for (const col of config.columns) {
            if (col.field === 'car_id') continue; 

            if (col.field === 'autoservice' && carCol) {
                html += await renderField(carCol);
            }

            html += await renderField(col);

            if (col.field === 'customer_id' && carCol && entity !== 'tehosmotr' && entity !== 'autostrahovanie' && entity !== 'repairs') {
                html += await renderField(carCol);
            }
        }

        if (carCol && !config.columns.some(c => c.field === 'autoservice') && !config.columns.some(c => c.field === 'customer_id') && entity !== 'repairs') {
            if (entity !== 'autostrahovanie' && entity !== 'tehosmotr') {
                html += await renderField(carCol);
            }
        }
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    <button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>
                    ${item && item.id ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    const customerSelect = formElement.querySelector('#customer-select');
    const carSelect = formElement.querySelector('#car-select');
    const zaphastiSelect = formElement.querySelector('#zaphasti-select');
    const vidyRabotSelect = formElement.querySelector('#vidy-rabot-select');

    const warehouseMolPairs = [
        { warehouse: formElement.querySelector('[name="warehouse_from_id"]'), mol: formElement.querySelector('[name="mol_from_id"]') },
        { warehouse: formElement.querySelector('[name="warehouse_to_id"]'), mol: formElement.querySelector('[name="mol_to_id"]') },
        { warehouse: formElement.querySelector('[name="warehouse_id"]'), mol: formElement.querySelector('[name="mol_id"]') },
        { warehouse: formElement.querySelector('[name="skald_id"]'), mol: formElement.querySelector('[name="mol_id"]') }
    ];

    warehouseMolPairs.forEach(({ warehouse, mol }) => {
        if (!warehouse || !mol) return;

        async function filterMols(isUserChange = false) {
            const selectedWarehouseId = warehouse.value;
            const currentMolValue = mol.value;

            try {
                const [molRes, usersRes] = await Promise.all([
                    fetch('/api/mol'),
                    fetch('/api/mol_users')
                ]);

                if (!molRes.ok) return;
                const mols = await molRes.json();
                const users = usersRes.ok ? await usersRes.json() : [];

                const usersMap = {};
                users.forEach(u => {
                    usersMap[u.id] = u.name || u.login || u.description || `Пользователь #${u.id}`;
                });

                mol.innerHTML = '<option value="">-- Не выбрано --</option>';

                let isCurrentStillValid = false;

                mols.forEach(m => {
                    if (!selectedWarehouseId || String(m.warehouse_id) === String(selectedWarehouseId)) {
                        const option = document.createElement('option');
                        option.value = m.id;
                        const userName = usersMap[m.user_id] || m.description || `МОЛ #${m.id}`;
                        option.textContent = userName;

                        if (String(m.id) === String(currentMolValue)) {
                            option.selected = true;
                            isCurrentStillValid = true;
                        }
                        mol.appendChild(option);
                    }
                });

                if (isUserChange && !isCurrentStillValid) {
                    mol.value = '';
                }
            } catch (err) {
                console.error('Ошибка при фильтрации МОЛ:', err);
            }
        }

        warehouse.addEventListener('change', () => {
            filterMols(true);
        });

        if (warehouse.value) {
            filterMols(false);
        }
    });

    if (zaphastiSelect) {
        zaphastiSelect.addEventListener('change', async () => {
            const selectedZaphastiId = zaphastiSelect.value;
            if (!selectedZaphastiId) return;

            try {
                const response = await fetch(`/api/zaphasti/${selectedZaphastiId}`);
                if (response.ok) {
                    const itemData = await response.json();
                    const priceInput = formElement.querySelector('[name="price"]');
                    const targetPrice = itemData.price !== undefined ? itemData.price : (itemData.sale_price !== undefined ? itemData.sale_price : itemData.retail_price);

                    if (priceInput && targetPrice !== undefined && !priceInput.value) {
                        priceInput.value = targetPrice;
                    }
                }
            } catch (err) {
                console.error('Ошибка при автозаполнении данных запчасти:', err);
            }
        });
    }

    if (vidyRabotSelect) {
        vidyRabotSelect.addEventListener('change', async () => {
            const selectedWorkId = vidyRabotSelect.value;
            if (!selectedWorkId) return;

            const priceInput = formElement.querySelector('[name="price"]');
            if (priceInput && priceInput.value.trim() !== '') {
                return; 
            }

            try {
                const response = await fetch(`/api/vidy_rabot/${selectedWorkId}`);
                if (response.ok) {
                    const workData = await response.json();
                    const targetPrice = workData.price !== undefined ? workData.price : workData.retail_price;

                    if (priceInput && targetPrice !== undefined) {
                        priceInput.value = targetPrice;
                    }
                }
            } catch (err) {
                console.error('Ошибка при автозаполнении данных услуги:', err);
            }
        });
    }

    if (customerSelect && carSelect) {
        customerSelect.addEventListener('change', async () => {
            const selectedCustomerId = customerSelect.value;
            const currentCarValue = carSelect.value;

            carSelect.innerHTML = '<option value="">-- Не выбрано --</option>';
            if (!selectedCustomerId) return;

            try {
                const response = await fetch(`/api/customer_cars?customer_id=${selectedCustomerId}`);
                if (!response.ok) return;
                const cars = await response.json();

                cars.forEach(car => {
                    const gos = car.gos_number || car.car_number || '';
                    const mdl = car.model || car.car_model || '';
                    const brd = car.brand || car.car_brand || '';
                    let displayName = (brd || mdl || gos) ? `${brd} ${mdl} (${gos})`.trim() : `Авто #${car.id}`;

                    const option = document.createElement('option');
                    option.value = car.id;
                    option.textContent = displayName;

                    if (String(car.id) === String(currentCarValue)) {
                        option.selected = true;
                    }
                    carSelect.appendChild(option);
                });
            } catch (err) {
                console.error('Ошибка при запросе машин покупателя:', err);
            }
        });
    }

    const isPostedSelect = formElement.querySelector('[name="is_posted"]');
    const factDateInput = formElement.querySelector('[name="fact_date"]');

    if (isPostedSelect && factDateInput) {
        isPostedSelect.addEventListener('change', () => {
            if ((isPostedSelect.value === 'true' || isPostedSelect.value === '1') && !factDateInput.value) {
                factDateInput.value = currentDateTime;
            } else if (isPostedSelect.value === 'false' || isPostedSelect.value === '0') {
                factDateInput.value = '';
            }
        });
    }

    const deleteBtn = drawer.querySelector('#delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal(
                'Подтверждение удаления',
                'Вы уверены, что хотите удалить эту запись?',
                async () => {
                    const currentUserId = localStorage.getItem('currentUserId') || '';

                    try {
                        const response = await fetch(`/api/${entity}/${item.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': currentUserId
                            }
                        });

                        if (response.ok) {
                            closeDrawer();
                            showAppNotification('Запись успешно удалена', 'success');

                            const detailEntities = [
                                'realization_items', 'realization_works', 'move_items', 'repair_items', 'receipt_items', 'accident_invoices', 
                                'accident_payments', 'accident_events', 'accident_items', 
                                'entity_contacts', 
                                'counterparty_contacts', 'postavhik_contacts', 'customer_contacts',
                                'car_details', 'customer_cars'
                            ];
                            if (detailEntities.includes(entity) && parentId) {
                                loadDetailData(entity, parentId);
                            } else {
                                refreshData();
                            }
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            showAppNotification(errData.error || 'Ошибка при удалении записи', 'error');
                        }
                    } catch (err) {
                        showAppNotification('Ошибка соединения с сервером', 'error');
                    }
                }
            );
        });
    }

    let isSubmitting = false;

    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (isSubmitting) return; 
        isSubmitting = true;

        const saveButton = formElement.querySelector('#save-btn');
        if (saveButton) saveButton.disabled = true;

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        if (data.is_posted !== undefined && data.is_posted !== '') {
            data.is_posted = data.is_posted === 'true' || data.is_posted === true || data.is_posted === '1' || data.is_posted === 1;
        }

        if (entity === 'realization_items' && parentId) {
            data.realization_id = parentId;
        } else if (entity === 'realization_works' && parentId) {
            data.realization_id = parentId;
        } else if (entity === 'move_items' && parentId) {
            data.move_id = parentId;
        } else if (entity === 'repair_items' && parentId) {
            data.repair_id = parentId;
        } else if (entity === 'receipt_items' && parentId) {
            data.receipt_id = parentId;
        } else if ((entity === 'accident_invoices' || entity === 'accident_payments' || entity === 'accident_events' || entity === 'accident_items') && parentId) {
            data.dtp_id = parentId;
        } else if (entity === 'counterparty_contacts' && parentId) {
            data.counterparty_id = parentId;
        } else if (entity === 'postavhik_contacts' && parentId) {
            data.postavhik_id = parentId;
        } else if (entity === 'customer_contacts' && parentId) {
            data.customer_id = parentId; 
        } else if (entity === 'car_details' && parentId) {
            data.car_id = parentId;
        } else if (entity === 'customer_cars' && parentId) {
            data.customer_id = parentId;
        } else if (entity === 'entity_contacts') {
            if (parentId && typeof parentId === 'object') {
                data.entity_id = parentId.entity_id || parentId.id;
                data.entity_type = parentId.entity_type || window.currentEntity || window.activeEntity || 'customers';
            } else if (parentId) {
                data.entity_id = parentId;
                data.entity_type = window.currentEntity || window.activeEntity || 'customers';
            }

            if (!data.entity_type || data.entity_type === 'entity_contacts') {
                data.entity_type = window.currentEntity || window.activeEntity || 'customers';
            }
        }

        try {
            const isEdit = item && item.id;
            const url = isEdit ? `/api/${entity}/${item.id}` : `/api/${entity}`;
            const method = isEdit ? 'PUT' : 'POST';
            const currentUserId = localStorage.getItem('currentUserId') || '';

            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': currentUserId
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                closeDrawer();
                showAppNotification('Данные успешно сохранены', 'success');

                const detailEntities = [
                    'realization_items', 'realization_works', 'move_items', 'repair_items', 'receipt_items', 'accident_invoices', 
                    'accident_payments', 'accident_events', 'accident_items', 
                    'entity_contacts', 
                    'counterparty_contacts', 'postavhik_contacts', 'customer_contacts',
                    'car_details', 'customer_cars'
                ];
                if (detailEntities.includes(entity) && parentId) {
                    loadDetailData(entity, parentId);
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                isSubmitting = false;
                if (saveButton) saveButton.disabled = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            isSubmitting = false;
            if (saveButton) saveButton.disabled = false;
        }
    });
}


async function openReceiptForm(entity, item = null) {
    // Умная проверка: если первый аргумент это не объект записи (например строка 'receipts'),
    // то смотрим на второй аргумент (item), либо сбрасываем в null, если передали пустяки.
    if (entity && typeof entity === 'object' && (entity.id !== undefined || entity.doc_number)) {
        item = entity;
    } else if (!item || (typeof item === 'object' && !item.id && !item.doc_number)) {
        // Если item передан как строка/пустой, но entity оказался объектом
        if (entity && typeof entity === 'object') {
            item = entity;
        }
    }

    const config = getConfig('receipts');
    const drawer = getOrCreateDrawer();
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (!item || !item.id) {
        let nextId = 1;
        const prefix = 'ПР-';

        try {
            const response = await fetch('/api/receipts');
            if (response.ok) {
                const records = await response.json();
                if (records.length > 0) {
                    const maxId = Math.max(...records.map(r => r.id || 0));
                    nextId = maxId + 1;
                }
            } else {
                console.warn(`Сервер вернул не OK при автонумерации приходов: ${response.status}`);
            }
        } catch (e) {
            console.error('Не удалось получить список приходов для автонумерации', e);
        }

        item = { 
            doc_number: `${prefix}${nextId}`,
            is_posted: false,
            fact_date: currentDateTime
        };
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать приход' : 'Добавить приход'}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="receipts" data-item-id="${item && item.id ? item.id : ''}">
    `;

    for (const col of config.columns) {
        if (col.field === 'id' || col.insert === false) continue;
        if ((col.update === false || col.edit === false) && item && item.id) continue;

        let val = '';
        if (item) {
            const possibleKeys = [col.field, col.field.replace('_id', ''), col.field + '_id', col.ref];
            for (const k of possibleKeys) {
                if (k && item[k] !== undefined && item[k] !== null && item[k] !== '') {
                    val = item[k];
                    break;
                }
            }
            if (val && typeof val === 'object' && val.id !== undefined) {
                val = val.id;
            }
        }

        let inputHtml = '';
        let fieldReadonly = col.readonly;
        if (isPosted && col.field !== 'is_posted' && col.field !== 'fact_date') {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');
            let optionsHtml = `<option value="">-- Не выбрано --</option>`;
            
            statusItems.forEach(st => {
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                optionsHtml += `<option value="${st.id}" ${selected}>${st.name}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.ref) {
            const refItems = await fetchReferenceData(col.ref);
            let optionsHtml = `<option value="">-- Не выбрано --</option>`;
            
            refItems.forEach(refItem => {
                let displayName = '';
                if (col.ref === 'cars') {
                    const gos = refItem.gos_number || refItem.car_number || '';
                    const mdl = refItem.model || refItem.car_model || '';
                    displayName = (gos && mdl) ? `${gos} (${mdl})` : (gos || mdl || `Запись #${refItem.id}`);
                } else {
                    displayName = refItem.name || refItem.title || refItem.user_fio || refItem.login || refItem.name_full || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                }

                const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
            let formattedVal = '';
            if (col.field === 'fact_date' && !val && isPosted) {
                val = currentDateTime;
            }

            if (val) {
                const d = new Date(val);
                if (!isNaN(d)) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    formattedVal = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            }
            inputHtml = `<input type="datetime-local" name="${col.field}" value="${formattedVal}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else {
            inputHtml = `<input type="text" name="${col.field}" value="${val}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        }

        html += `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label}:
                ${inputHtml}
            </label>
        `;
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    <button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>
                    ${item && item.id ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    const isPostedSelect = formElement.querySelector('[name="is_posted"]');
    const factDateInput = formElement.querySelector('[name="fact_date"]');
    
    if (isPostedSelect && factDateInput) {
        isPostedSelect.addEventListener('change', () => {
            if ((isPostedSelect.value === 'true' || isPostedSelect.value === '1') && !factDateInput.value) {
                factDateInput.value = currentDateTime;
            } else if (isPostedSelect.value === 'false' || isPostedSelect.value === '0') {
                factDateInput.value = '';
            }
        });
    }

    if (formElement) {
        const pairs = [
            { warehouse: formElement.querySelector('[name="warehouse_from_id"]'), mol: formElement.querySelector('[name="mol_from_id"]') },
            { warehouse: formElement.querySelector('[name="warehouse_to_id"]'), mol: formElement.querySelector('[name="mol_to_id"]') },
            { warehouse: formElement.querySelector('[name="warehouse_id"]'), mol: formElement.querySelector('[name="mol_id"]') }
        ];

        pairs.forEach(({ warehouse, mol }) => {
            if (!warehouse || !mol) return;

            async function filterMols(isUserChange = false) {
                const selectedWarehouseId = warehouse.value;
                // Сохраняем текущее выбранное значение МОЛ, если оно было
                const currentMolValue = mol.value;

                try {
                    const [molRes, usersRes] = await Promise.all([
                        fetch('/api/mol'),
                        fetch('/api/mol_users')
                    ]);

                    if (!molRes.ok) return;
                    const mols = await molRes.json();
                    const users = usersRes.ok ? await usersRes.json() : [];

                    const usersMap = {};
                    users.forEach(u => {
                        usersMap[u.id] = u.name || u.login || u.description || `Пользователь #${u.id}`;
                    });

                    mol.innerHTML = '<option value="">-- Не выбрано --</option>';

                    let isCurrentStillValid = false;

                    mols.forEach(m => {
                        if (!selectedWarehouseId || String(m.warehouse_id) === String(selectedWarehouseId)) {
                            const option = document.createElement('option');
                            option.value = m.id;
                            option.textContent = m.user_fio || usersMap[m.user_id] || m.description || `МОЛ #${m.id}`;

                            if (String(m.id) === String(currentMolValue)) {
                                option.selected = true;
                                isCurrentStillValid = true;
                            }
                            mol.appendChild(option);
                        }
                    });

                    // Если пользователь сам сменил склад и старый МОЛ не принадлежит этому складу, сбрасываем его
                    if (isUserChange && !isCurrentStillValid) {
                        mol.value = '';
                    }
                } catch (err) {
                    console.error('Ошибка при фильтрации МОЛ:', err);
                }
            }

            warehouse.addEventListener('change', () => {
                // Передаем true, чтобы при ручном изменении склада старый неподходящий МОЛ сбрасывался
                filterMols(true);
            });

            // При инициализации формы просто подтягиваем список под выбранный склад без сброса
            if (warehouse.value) {
                filterMols(false);
            }
        });
    }

    const deleteBtn = drawer.querySelector('#delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal(
                'Подтверждение удаления',
                'Вы уверены, что хотите удалить этот приход?',
                async () => {
                    const currentUserId = localStorage.getItem('currentUserId') || '';
                    try {
                        const response = await fetch(`/api/receipts/${item.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': currentUserId
                            }
                        });

                        if (response.ok) {
                            closeDrawer();
                            showAppNotification('Приход успешно удален', 'success');
                            refreshData();
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            showAppNotification(errData.error || 'Ошибка при удалении прихода', 'error');
                        }
                    } catch (err) {
                        showAppNotification('Ошибка соединения с сервером', 'error');
                    }
                }
            );
        });
    }

    let isSubmitting = false;

    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (isSubmitting) return;
        isSubmitting = true;

        const saveButton = formElement.querySelector('#save-btn');
        if (saveButton) saveButton.disabled = true;

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        if (data.is_posted !== undefined && data.is_posted !== '') {
            data.is_posted = data.is_posted === 'true' || data.is_posted === true || data.is_posted === '1' || data.is_posted === 1;
        }

        try {
            const isEdit = item && item.id;
            const url = isEdit ? `/api/receipts/${item.id}` : `/api/receipts`;
            const method = isEdit ? 'PUT' : 'POST';
            const currentUserId = localStorage.getItem('currentUserId') || '';

            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': currentUserId
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                closeDrawer();
                showAppNotification('Приход успешно сохранен', 'success');
                refreshData();
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении прихода', 'error');
                isSubmitting = false; 
                if (saveButton) saveButton.disabled = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            isSubmitting = false;
            if (saveButton) saveButton.disabled = false;
        }
    });
}

async function openMoveForm(entity, item = null, parentId = null) {
    console.log('[openMoveForm] СТАРТ: открытие формы для entity:', entity, { item, parentId });

    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (!item || !item.id) {
        let nextId = 1;
        let prefix = 'ПМ-';

        try {
            const response = await fetch(`/api/${entity}`);
            if (response.ok) {
                const records = await response.json();
                if (records.length > 0) {
                    const maxId = Math.max(...records.map(r => r.id || 0));
                    nextId = maxId + 1;
                }
            } else {
                console.warn(`Сервер вернул не OK при автонумерации: ${response.status}`);
            }
        } catch (e) {
            console.error('Не удалось получить список для автонумерации', e);
        }

        item = { 
            doc_number: `${prefix}${nextId}`,
            is_posted: false 
        };

        if (entity === 'move_items') {
            item.currency = 'Рубль ПМР';
            if (parentId) {
                item.move_id = parentId;
            }
        }

        config.columns.forEach(col => {
            if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
                item[col.field] = currentDateTime;
            }
        });
    } else {
        if (entity === 'move_items') {
            if (!item.currency) {
                item.currency = 'Рубль ПМР';
            }
            if (parentId && !item.move_id) {
                item.move_id = parentId;
            }
        }
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    if (entity === 'move_items') {
        const activeMoveId = parentId || (item ? item.move_id : '');
        html += `<input type="hidden" name="move_id" value="${activeMoveId}">`;
        html += `<input type="hidden" name="currency" value="Рубль ПМР">`;
    }

    for (const col of config.columns) {
        if (col.field === 'id' || col.field === 'move_id' || col.field === 'currency') continue;
        if (col.insert === false) continue;
        if ((col.update === false || col.edit === false) && item && item.id) continue;

        if (entity === 'move_items') {
            const allowedFields = ['zaphasti_id', 'quantity', 'description'];
            if (!allowedFields.includes(col.field)) {
                continue;
            }
        }

        let val = '';
        if (item) {
            const possibleKeys = [
                col.field, 
                col.field.replace('_id', ''), 
                col.field + '_id',
                col.ref,
                col.ref ? col.ref.slice(0, -1) : ''
            ];

            for (const k of possibleKeys) {
                if (k && item[k] !== undefined && item[k] !== null && item[k] !== '') {
                    val = item[k];
                    break;
                }
            }

            if (val && typeof val === 'object' && val.id !== undefined) {
                val = val.id;
            }
        }

        let inputHtml = '';
        let fieldReadonly = col.readonly;
        if (isPosted && col.field !== 'is_posted' && col.field !== 'fact_date') {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');
            let optionsHtml = `<option value="">-- Не выбрано --</option>`;

            statusItems.forEach(st => {
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                optionsHtml += `<option value="${st.id}" ${selected}>${st.name}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.ref) {
            const referenceName = col.ref;
            let refItems = await fetchReferenceData(referenceName);

            let optionsHtml = `<option value="">-- Не выбрано --</option>`;

            refItems.forEach(refItem => {
                let displayName = '';
                if (referenceName === 'zaphasti') {
                    const art = refItem.article ? `[${refItem.article}] ` : '';
                    const nm = refItem.name || refItem.title || '';
                    displayName = `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                } else {
                    displayName = refItem.user_fio || refItem.name || refItem.login || refItem.name_full || refItem.title || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                }

                const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
            });

            const extraAttributes = (col.field === 'zaphasti_id' ? 'id="zaphasti-select"' : '');
            inputHtml = `<select name="${col.field}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
            let formattedVal = '';
            if (col.field === 'fact_date' && !val && isPosted) {
                val = currentDateTime;
            }

            if (val) {
                const d = new Date(val);
                if (!isNaN(d)) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    formattedVal = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            }
            inputHtml = `<input type="datetime-local" name="${col.field}" value="${formattedVal}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else {
            inputHtml = `<input type="text" name="${col.field}" value="${val}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        }

        html += `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label}:
                ${inputHtml}
            </label>
        `;
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    <button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>
                    ${item && item.id ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    const isPostedSelect = formElement.querySelector('[name="is_posted"]');
    const factDateInput = formElement.querySelector('[name="fact_date"]');

    if (isPostedSelect && factDateInput) {
        isPostedSelect.addEventListener('change', () => {
            if ((isPostedSelect.value === 'true' || isPostedSelect.value === '1') && !factDateInput.value) {
                factDateInput.value = currentDateTime;
            } else if (isPostedSelect.value === 'false' || isPostedSelect.value === '0') {
                factDateInput.value = '';
            }
        });
    }

    if (formElement) {
        const pairs = [
            { warehouse: formElement.querySelector('[name="warehouse_from_id"]'), mol: formElement.querySelector('[name="mol_from_id"]') },
            { warehouse: formElement.querySelector('[name="warehouse_to_id"]'), mol: formElement.querySelector('[name="mol_to_id"]') },
            { warehouse: formElement.querySelector('[name="warehouse_id"]'), mol: formElement.querySelector('[name="mol_id"]') },
            { warehouse: formElement.querySelector('[name="sklad_id"]'), mol: formElement.querySelector('[name="mol_id"]') }
        ];

        pairs.forEach(({ warehouse, mol }) => {
            if (!warehouse || !mol) return;

            async function filterMols() {
                const selectedWarehouseId = warehouse.value;
                const currentMolValue = mol.value;

                try {
                    const [molRes, usersRes] = await Promise.all([
                        fetch('/api/mol'),
                        fetch('/api/mol_users')
                    ]);

                    if (!molRes.ok) return;
                    const mols = await molRes.json();
                    const users = usersRes.ok ? await usersRes.json() : [];

                    const usersMap = {};
                    users.forEach(u => {
                        usersMap[u.id] = u.name || u.login || u.description || `Пользователь #${u.id}`;
                    });

                    mol.innerHTML = '<option value="">-- Не выбрано --</option>';

                    mols.forEach(m => {
                        if (!selectedWarehouseId || String(m.warehouse_id) === String(selectedWarehouseId)) {
                            const option = document.createElement('option');
                            option.value = m.id;
                            const userName = usersMap[m.user_id] || m.description || `МОЛ #${m.id}`;
                            option.textContent = userName;

                            if (String(m.id) === String(currentMolValue)) {
                                option.selected = true;
                            }
                            mol.appendChild(option);
                        }
                    });
                } catch (err) {
                    console.error('Ошибка при фильтрации МОЛ:', err);
                }
            }

            warehouse.addEventListener('change', () => {
                mol.value = '';
                filterMols();
            });

            if (warehouse.value) {
                filterMols();
            }
        });
    }

    const deleteBtn = drawer.querySelector('#delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal(
                'Подтверждение удаления',
                'Вы уверены, что хотите удалить эту запись?',
                async () => {
                    const currentUserId = localStorage.getItem('currentUserId') || '';

                    try {
                        const response = await fetch(`/api/${entity}/${item.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': currentUserId
                            }
                        });

                        if (response.ok) {
                            closeDrawer();
                            showAppNotification('Запись успешно удалена', 'success');

                            if (entity === 'move_items' && parentId) {
                                loadDetailData(entity, parentId);
                            } else {
                                refreshData();
                            }
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            showAppNotification(errData.error || 'Ошибка при удалении записи', 'error');
                        }
                    } catch (err) {
                        showAppNotification('Ошибка соединения с сервером', 'error');
                    }
                }
            );
        });
    }

    let isSubmitting = false;

    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (isSubmitting) return; 
        isSubmitting = true;

        const saveButton = formElement.querySelector('#save-btn');
        if (saveButton) saveButton.disabled = true;

        const formData = new FormData(e.target);
        
        const rawEntries = Array.from(formData.entries());
        console.group('[DEBUG FORM SUBMIT] Содержимое FormData по полям:');
        rawEntries.forEach(([key, val]) => {
            console.log(`%c[Field] ${key}:`, 'color: #0066cc; font-weight: bold;', val);
        });
        console.groupEnd();

        const data = Object.fromEntries(formData.entries());
        console.log('[SUBMIT] Собрано в объект (Object.fromEntries):', data);

        if (data.is_posted !== undefined && data.is_posted !== '') {
            data.is_posted = data.is_posted === 'true' || data.is_posted === true || data.is_posted === '1' || data.is_posted === 1;
        }

        if (entity === 'move_items') {
            const currentParentId = parentId || formElement.getAttribute('data-parent-id');
            console.log('[SUBMIT] Проверка move_id:', { parentIdArg: parentId, attrParentId: formElement.getAttribute('data-parent-id'), resolved: currentParentId });
            
            if (currentParentId) {
                data.move_id = currentParentId;
            }
            
            if (data.zaphasti && !data.zaphasti_id) {
                data.zaphasti_id = data.zaphasti;
            }

            data.currency = 'Рубль ПМР';
        }

        console.log('[SUBMIT] Итоговый JSON для отправки на сервер (data):', data);

        try {
            const isEdit = item && item.id;
            const url = isEdit ? `/api/${entity}/${item.id}` : `/api/${entity}`;
            const method = isEdit ? 'PUT' : 'POST';
            const currentUserId = localStorage.getItem('currentUserId') || '';

            console.log(`[SUBMIT] Отправка запроса: ${method} ${url}`);

            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': currentUserId
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                console.log('[SUBMIT] Ответ сервера: Успешно (200-299)');
                closeDrawer();
                showAppNotification('Данные успешно сохранены', 'success');

                if (entity === 'move_items' && parentId) {
                    loadDetailData(entity, parentId);
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error(`[SUBMIT ERROR] Сервер вернул ошибку ${response.status}:`, errData);
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                isSubmitting = false; 
                if (saveButton) saveButton.disabled = false;
            }
        } catch (err) {
            console.error('[SUBMIT EXCEPTION] Сетевая или программная ошибка при отправке:', err);
            showAppNotification('Ошибка соединения с сервером', 'error');
            isSubmitting = false;
            if (saveButton) saveButton.disabled = false;
        }
    });
}

async function openRepairForm(item = null, parentId = null) {
    console.log('[openRepairForm] СТАРТ. item:', item, 'parentId:', parentId);

    const entity = 'repair_items';
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (!item || !item.id) {
        let nextId = 1;
        let prefix = 'РЕМ-';

        try {
            console.log(`[openRepairForm] Запрос автонумерации для /api/${entity}`);
            const response = await fetch(`/api/${entity}`);
            if (response.ok) {
                const records = await response.json();
                if (records.length > 0) {
                    const maxId = Math.max(...records.map(r => r.id || 0));
                    nextId = maxId + 1;
                }
            } else {
                console.warn(`Сервер вернул не OK при автонумерации: ${response.status}`);
            }
        } catch (e) {
            console.error('Не удалось получить список для автонумерации', e);
        }

        item = { 
            doc_number: `${prefix}${nextId}`,
            is_posted: false 
        };

        config.columns.forEach(col => {
            if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
                item[col.field] = currentDateTime;
            }
        });
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    const currentRepairId = parentId || (item ? item.repair_id : '') || '';
    html += `<input type="hidden" name="repair_id" value="${currentRepairId}">`;

    async function renderField(col) {
        if (col.field === 'id') return '';
        if (col.field === 'repair_id') return '';

        if (col.insert === false) return '';
        if ((col.update === false || col.edit === false) && item && item.id) return '';
        
        let val = '';
        if (item) {
            const possibleKeys = [
                col.field, 
                col.field.replace('_id', ''), 
                col.field + '_id',
                col.ref,
                col.ref ? col.ref.slice(0, -1) : ''
            ];

            for (const k of possibleKeys) {
                if (k && item[k] !== undefined && item[k] !== null && item[k] !== '') {
                    val = item[k];
                    break;
                }
            }

            if (val && typeof val === 'object' && val.id !== undefined) {
                val = val.id;
            }
        }

        let inputHtml = '';
        let fieldReadonly = col.readonly;
        if (isPosted && col.field !== 'is_posted' && col.field !== 'fact_date') {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.ref) {
            const referenceName = col.ref;
            console.log(`[openRepairForm] Загрузка справочника для поля ${col.field}:`, referenceName);
            let refItems = await fetchReferenceData(referenceName);

            let optionsHtml = `<option value="">-- Не выбрано --</option>`;

            refItems.forEach(refItem => {
                let displayName = '';
                if (referenceName === 'zaphasti') {
                    const art = refItem.article ? `[${refItem.article}] ` : '';
                    const nm = refItem.name || refItem.title || '';
                    displayName = `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                } else if (referenceName === 'customer_cars' || referenceName === 'cars') {
                    const gos = refItem.gos_number || refItem.car_number || '';
                    const mdl = refItem.model || refItem.car_model || '';
                    const brd = refItem.brand || refItem.car_brand || '';
                    displayName = (brd || mdl || gos) ? `${brd} ${mdl} (${gos})`.trim() : `Авто #${refItem.id}`;
                } else {
                    displayName = refItem.name || refItem.title || (`Запись #${refItem.id}`);
                }

                const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
            });

            const extraAttributes = (col.field === 'zaphast_id' || col.field === 'zaphasti_id') ? 'id="zaphasti-select"' : '';
            const fieldNameForSelect = (col.field === 'zaphasti_id') ? 'zaphast_id' : col.field;
            inputHtml = `<select name="${fieldNameForSelect}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else {
            inputHtml = `<input type="text" name="${col.field}" value="${val}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        }

        return `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label}:
                ${inputHtml}
            </label>
        `;
    }

    // Переставляем поля местами: находим поле автомобиля (car_id) и МОЛ, чтобы выстроить нужном порядке
    const columns = [...config.columns];
    const carColIndex = columns.findIndex(c => c.field === 'car_id');
    const molColIndex = columns.findIndex(c => c.field === 'mol_id' || c.field === 'mol');

    if (carColIndex !== -1 && molColIndex !== -1 && carColIndex > molColIndex) {
        const [carCol] = columns.splice(carColIndex, 1);
        columns.splice(molColIndex, 0, carCol);
    }

    for (const col of columns) {
        html += await renderField(col);
    }

    let currentPriceVal = item && item.price !== undefined ? item.price : '';
    html += `<input type="hidden" name="price" id="hidden-price-input" value="${currentPriceVal}">`;

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    <button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>
                    ${item && item.id ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    const zaphastiSelect = formElement.querySelector('#zaphasti-select');
    const quantityInput = formElement.querySelector('[name="quantity"]');
    const hiddenPriceInput = formElement.querySelector('#hidden-price-input');

    if (zaphastiSelect) {
        zaphastiSelect.addEventListener('change', async () => {
            const selectedZaphastiId = zaphastiSelect.value;
            console.log('[zaphastiSelect change] Выбран ID запчасти:', selectedZaphastiId);
            if (!selectedZaphastiId) return;

            try {
                let warehouseId = null;
                if (parentId) {
                    const repairRes = await fetch(`/api/repairs/${parentId}`);
                    if (repairRes.ok) {
                        const repairData = await repairRes.json();
                        warehouseId = repairData.warehouse_id || repairData.sklads_id || repairData.warehouse || null;
                    }
                }

                let queryUrl = `/api/warehouse_stock?zaphasti_id=${selectedZaphastiId}`;
                if (warehouseId) {
                    queryUrl += `&warehouse_id=${warehouseId}`;
                }

                const stockRes = await fetch(queryUrl);
                if (stockRes.ok) {
                    const stockData = await stockRes.json();
                    let availableQty = 0;
                    let autoPrice = 0;

                    if (Array.isArray(stockData)) {
                        availableQty = stockData.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                        if (stockData.length > 0) {
                            autoPrice = stockData[0].price !== undefined ? stockData[0].price : 0;
                        }
                    } else if (stockData && typeof stockData === 'object') {
                        availableQty = stockData.quantity !== undefined ? Number(stockData.quantity) : 0;
                        autoPrice = stockData.price !== undefined ? stockData.price : 0;
                    }

                    if (quantityInput) {
                        const currentEnteredQty = Number(quantityInput.value) || 1;
                        if (currentEnteredQty > availableQty) {
                            showAppNotification(`Внимание! На складе доступно всего ${availableQty} шт.`, 'warning');
                        }
                    }

                    if (hiddenPriceInput) {
                        hiddenPriceInput.value = autoPrice;
                    }
                } else {
                    const response = await fetch(`/api/zaphasti/${selectedZaphastiId}`);
                    if (response.ok) {
                        const itemData = await response.json();
                        const targetPrice = itemData.price !== undefined ? itemData.price : (itemData.sale_price !== undefined ? itemData.sale_price : itemData.retail_price);
                        if (hiddenPriceInput && targetPrice !== undefined) {
                            hiddenPriceInput.value = targetPrice;
                        }
                    }
                }
            } catch (err) {
                console.error('Ошибка при автозаполнении цены и проверки остатков запчасти:', err);
            }
        });
    }

    const deleteBtn = drawer.querySelector('#delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal(
                'Подтверждение удаления',
                'Вы уверены, что хотите удалить эту запись?',
                async () => {
                    const currentUserId = localStorage.getItem('currentUserId') || '';

                    try {
                        const response = await fetch(`/api/${entity}/${item.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': currentUserId
                            }
                        });

                        if (response.ok) {
                            closeDrawer();
                            showAppNotification('Запись успешно удалена', 'success');

                            if (parentId) {
                                loadDetailData(entity, parentId);
                            } else {
                                refreshData();
                            }
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            showAppNotification(errData.error || 'Ошибка при удалении записи', 'error');
                        }
                    } catch (err) {
                        showAppNotification('Ошибка соединения с сервером', 'error');
                    }
                }
            );
        });
    }

    let isSubmitting = false;

    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();

        if (isSubmitting) return; 
        isSubmitting = true;

        const saveButton = formElement.querySelector('#save-btn');
        if (saveButton) saveButton.disabled = true;

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        if (parentId) {
            data.repair_id = parentId;
        }

        if (data.zaphasti_id !== undefined && data.zaphast_id === undefined) {
            data.zaphast_id = data.zaphasti_id;
            delete data.zaphasti_id;
        }

        console.group('[Form Submit] Отправка данных на сервер');
        console.log('Entity:', entity);
        console.log('Parent ID (argument):', parentId);
        console.log('Item ID (if editing):', item && item.id ? item.id : 'NEW');
        console.log('FormData entries:');
        for (let pair of formData.entries()) {
            console.log(`  %c${pair[0]}%c:`, 'color: #2563eb; font-weight: bold;', 'color: inherit;', pair[1]);
        }
        console.log('Итоговый объект data для JSON.stringify:', data);
        console.groupEnd();

        try {
            const isEdit = item && item.id;
            const url = isEdit ? `/api/${entity}/${item.id}` : `/api/${entity}`;
            const method = isEdit ? 'PUT' : 'POST';
            const currentUserId = localStorage.getItem('currentUserId') || '';

            console.log(`[Form Submit] Выполняется ${method} запрос на ${url}`);

            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': currentUserId
                },
                body: JSON.stringify(data)
            });

            console.log(`[Form Submit] Ответ сервера статус:`, response.status, response.statusText);

            if (response.ok) {
                const responseBody = await response.json().catch(() => ({}));
                console.log('[Form Submit] Успешный ответ сервера:', responseBody);

                closeDrawer();
                showAppNotification('Данные успешно сохранены', 'success');

                if (parentId) {
                    loadDetailData(entity, parentId);
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error('[Form Submit] Ошибка от сервера (не OK):', response.status, errData);
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                isSubmitting = false; 
                if (saveButton) saveButton.disabled = false;
            }
        } catch (err) {
            console.error('[Form Submit] Исключение сети или кода во время fetch:', err);
            showAppNotification('Ошибка соединения с сервером', 'error');
            isSubmitting = false;
            if (saveButton) saveButton.disabled = false;
        }
    });
}
async function openRealizationForm(entity, item = null) {
    console.log("🚀 openRealizationForm вызвана. Аргументы:", {
        entityType: typeof entity,
        entityValue: entity,
        itemType: typeof item,
        itemValue: item,
        stack: new Error().stack
    });

    if (entity && typeof entity === 'object' && (entity.id !== undefined || entity.doc_number)) {
        item = entity;
        console.log("⚠️ Первый аргумент оказался объектом item, переназначили:", item);
    } else if (!item || (typeof item === 'object' && !item.id && !item.doc_number)) {
        if (entity && typeof entity === 'object') {
            item = entity;
            console.log("⚠️ item был пустым, взяли entity как item:", item);
        }
    }

    const config = getConfig('realizations');
    console.log("📋 Конфиг для 'realizations':", config);
    if (!config) {
        console.error("❌ ОШИБКА: getConfig('realizations') вернул undefined или null! Проверьте имя сущности.");
    }

    const drawer = getOrCreateDrawer();
    console.log("🗄️ Элемент drawer получен:", drawer);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (!item || !item.id) {
        console.log("➕ Режим создания новой записи (нет item или item.id)");
        let nextId = 1;
        const prefix = 'РЛ-';

        try {
            const response = await fetch('/api/realizations');
            console.log("📡 Ответ запроса автонумерации /api/realizations:", response.status);
            if (response.ok) {
                const records = await response.json();
                console.log("📦 Полученные записи для автонумерации:", records);
                if (records.length > 0) {
                    const numericIds = records.map(r => {
                        if (r.doc_number && typeof r.doc_number === 'string') {
                            const match = r.doc_number.match(/\d+$/);
                            if (match) return parseInt(match[0], 10);
                        }
                        return r.id || 0;
                    });
                    const maxId = Math.max(...numericIds, 0);
                    nextId = maxId + 1;
                }
            } else {
                console.warn(`⚠️ Сервер вернул не OK при автонумерации реализаций: ${response.status}`);
            }
        } catch (e) {
            console.error('❌ Не удалось получить список реализаций для автонумерации:', e);
        }

        item = { 
            doc_number: `${prefix}${nextId}`,
            doc_date: currentDateTime,
            is_posted: false,
            fact_date: currentDateTime
        };
        console.log("✨ Сформирован новый item по умолчанию:", item);
    } else {
        console.log("✏️ Режим редактирования существующей записи, ID:", item.id);
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);
    console.log("🔒 Флаг isPosted:", isPosted);

    // Вспомогательная функция загрузки машин покупателя
    async function loadCarsForCustomer(customerId, targetCarSelect, preselectedCarId = null) {
        console.log("🚗 [loadCarsForCustomer] Загрузка для customerId:", customerId, "предопределенная машина:", preselectedCarId);
        targetCarSelect.innerHTML = '<option value="">-- Не выбрано --</option>';
        if (!customerId) return;

        try {
            const fetchUrl = `/api/customer_cars?customer_id=${customerId}`;
            const response = await fetch(fetchUrl);
            if (!response.ok) return;
            const cars = await response.json();
            console.log("📦 [loadCarsForCustomer] Получен список машин:", cars);

            cars.forEach(car => {
                const gos = car.gos_number || car.car_number || '';
                const mdl = car.model || car.car_model || '';
                const brd = car.brand || car.car_brand || '';
                let displayName = (brd || mdl || gos) ? `${brd} ${mdl} (${gos})`.trim() : `Авто #${car.id}`;

                const option = document.createElement('option');
                option.value = car.id;
                option.textContent = displayName;

                if (preselectedCarId && String(car.id) === String(preselectedCarId)) {
                    option.selected = true;
                }
                targetCarSelect.appendChild(option);
            });
        } catch (err) {
            console.error('❌ [loadCarsForCustomer] Ошибка при запросе машин покупателя:', err);
        }
    }

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать реализацию' : 'Добавить: Реализация'}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="realizations" data-item-id="${item && item.id ? item.id : ''}">
    `;

    async function renderField(col) {
        console.log("⚙️ Рендерим поле:", col?.field);
        if (!col || col.field === 'id' || col.insert === false) return '';
        if ((col.update === false || col.edit === false) && item && item.id) return '';

        let val = '';
        if (item) {
            const possibleKeys = [col.field, col.field.replace('_id', ''), col.field + '_id', col.ref];
            for (const k of possibleKeys) {
                if (k && item[k] !== undefined && item[k] !== null && item[k] !== '') {
                    val = item[k];
                    break;
                }
            }
            if (val && typeof val === 'object' && val.id !== undefined) {
                val = val.id;
            }
        }

        let inputHtml = '';
        let fieldReadonly = col.readonly;
        if (isPosted && col.field !== 'is_posted' && col.field !== 'fact_date') {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');
            let optionsHtml = `<option value="">-- Не выбрано --</option>`;
            
            statusItems.forEach(st => {
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                optionsHtml += `<option value="${st.id}" ${selected}>${st.name}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.ref) {
            let refItems = [];
            if (col.ref === 'customer_cars' || col.field === 'car_id') {
                const targetCustomerId = item ? (item.customer_id || item.customer?.id || item.customer) : null;
                console.log("🚗 [DEBUG CARS] Рендеринг машин. Найден targetCustomerId:", targetCustomerId, "Полный item:", item);
                
                if (targetCustomerId) {
                    try {
                        const fetchUrl = `/api/customer_cars?customer_id=${targetCustomerId}`;
                        console.log("📡 [DEBUG CARS] Отправляем запрос:", fetchUrl);
                        const carRes = await fetch(fetchUrl);
                        console.log("📥 [DEBUG CARS] Статус ответа:", carRes.status);
                        if (carRes.ok) {
                            refItems = await carRes.json();
                            console.log("📦 [DEBUG CARS] Полученные машины для покупателя:", refItems);
                        }
                    } catch (e) {
                        console.error('❌ [DEBUG CARS] Ошибка загрузки машин покупателя:', e);
                    }
                } else {
                    console.log("⚠️ [DEBUG CARS] targetCustomerId не найден или пустой. Список машин оставлен пустым.");
                    refItems = [];
                }
            } else {
                refItems = await fetchReferenceData(col.ref);
            }

            let optionsHtml = `<option value="">-- Не выбрано --</option>`;
            
            refItems.forEach(refItem => {
                let displayName = '';
                if (col.formatRef && typeof col.formatRef === 'function') {
                    displayName = col.formatRef(refItem);
                } else if (col.ref === 'cars' || col.ref === 'customer_cars' || col.field === 'car_id') {
                    const gos = refItem.gos_number || refItem.car_number || '';
                    const mdl = refItem.model || refItem.car_model || '';
                    const brd = refItem.brand || refItem.car_brand || '';
                    if (brd || mdl || gos) {
                        displayName = `${brd} ${mdl} (${gos})`.trim();
                    } else {
                        displayName = `Авто #${refItem.id}`;
                    }
                } else {
                    displayName = refItem.name || refItem.title || refItem.user_fio || refItem.login || refItem.name_full || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                }

                const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
            });

            let extraAttributes = '';
            if (col.field === 'customer_id') extraAttributes = 'id="customer-select"';
            else if (col.field === 'car_id') extraAttributes = 'id="car-select"';
            else if (col.field === 'warehouse_id' || col.field === 'skald_id' || col.field === 'sklad_id') extraAttributes = `name="${col.field}" id="warehouse_id"`;
            else if (col.field === 'mol_id' || col.field === 'mol_from_id') extraAttributes = `name="${col.field}" id="mol_id"`;

            inputHtml = `<select name="${col.field}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
            let formattedVal = '';
            if (col.field === 'fact_date' && !val && isPosted) {
                val = currentDateTime;
            }

            if (val) {
                const d = new Date(val);
                if (!isNaN(d)) {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    formattedVal = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
            }
            inputHtml = `<input type="datetime-local" name="${col.field}" value="${formattedVal}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else {
            inputHtml = `<input type="text" name="${col.field}" value="${val}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        }

        return `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label}:
                ${inputHtml}
            </label>
        `;
    }

    try {
        if (config && config.columns) {
            const docNumCol = config.columns.find(c => c.field === 'doc_number');
            const docDateCol = config.columns.find(c => c.field === 'doc_date');

            if (docNumCol) html += await renderField(docNumCol);
            if (docDateCol) html += await renderField(docDateCol);

            const sellerCol = config.columns.find(c => c.field === 'seller_id' || c.field === 'seller' || c.field === 'user_id');
            if (sellerCol) html += await renderField(sellerCol);

            const customerCol = config.columns.find(c => c.field === 'customer_id');
            if (customerCol) html += await renderField(customerCol);

            const carIdCols = config.columns.filter(c => c.field === 'car_id');
            const primaryCarCol = carIdCols[0]; 
            if (primaryCarCol) html += await renderField(primaryCarCol);

            const skippedFields = ['doc_number', 'doc_date', 'seller_id', 'seller', 'user_id', 'customer_id', 'car_id', 'id'];
            for (const col of config.columns) {
                if (skippedFields.includes(col.field)) continue;
                try {
                    html += await renderField(col);
                } catch (fieldErr) {
                    console.error(`💥 Ошибка при рендере поля ${col.field}:`, fieldErr);
                }
            }
        } else {
            console.error("❌ config.columns не найден!");
        }
    } catch (renderErr) {
        console.error("💥 ОШИБКА ВНУТРИ ЦИКЛА РЕНДЕРИНГА ПОЛЕЙ:", renderErr);
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    <button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>
                    ${item && item.id ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    const customerSelect = formElement.querySelector('#customer-select');
    const carSelect = formElement.querySelector('#car-select');

    if (customerSelect && carSelect) {
        customerSelect.addEventListener('change', async () => {
            const selectedCustomerId = customerSelect.value;
            const currentCarValue = carSelect.value;
            console.log("🔄 [DEBUG CHANGE] Пользователь изменил покупателя в селекте. Новый ID:", selectedCustomerId);
            await loadCarsForCustomer(selectedCustomerId, carSelect, currentCarValue);
        });
    }

    if (formElement) {
        const warehouseMolPairs = [
            { 
                warehouse: formElement.querySelector('[name="warehouse_from_id"]') || formElement.querySelector('[name="skald_from_id"]') || formElement.querySelector('[name="sklad_from_id"]'), 
                mol: formElement.querySelector('[name="mol_from_id"]') 
            },
            { 
                warehouse: formElement.querySelector('[name="warehouse_to_id"]') || formElement.querySelector('[name="skald_to_id"]') || formElement.querySelector('[name="sklad_to_id"]'), 
                mol: formElement.querySelector('[name="mol_to_id"]') 
            },
            { 
                warehouse: formElement.querySelector('[name="warehouse_id"]') || formElement.querySelector('[name="skald_id"]') || formElement.querySelector('[name="sklad_id"]'), 
                mol: formElement.querySelector('[name="mol_id"]') 
            }
        ];

        warehouseMolPairs.forEach(({ warehouse, mol }) => {
            if (!warehouse || !mol) return;

            const updateMolOptions = async (isUserChange = false) => {
                const selectedWarehouseId = warehouse.value;
                const currentMolValue = item && !isUserChange ? (item.mol_id || item.mol?.id || item.mol || mol.value) : mol.value;
                console.log("🔄 [DEBUG WAREHOUSE] Обновление МОЛ для склада ID:", selectedWarehouseId, "Текущий МОЛ:", currentMolValue);

                try {
                    const [molRes, usersRes] = await Promise.all([
                        fetch('/api/mol'),
                        fetch('/api/mol_users').catch(() => ({ ok: false }))
                    ]);

                    if (!molRes.ok) return;
                    const mols = await molRes.json();
                    const users = usersRes.ok ? await usersRes.json() : [];

                    const usersMap = {};
                    users.forEach(u => {
                        usersMap[u.id] = u.name || u.login || u.description || `Пользователь #${u.id}`;
                    });

                    const activeMolVal = isUserChange ? '' : currentMolValue;

                    mol.innerHTML = '<option value="">-- Не выбрано --</option>';
                    let isCurrentStillValid = false;

                    mols.forEach(m => {
                        const mWarehouseId = m.warehouse_id || m.skald_id || m.sklad_id;
                        const matchesWarehouse = !selectedWarehouseId || 
                            (mWarehouseId && String(mWarehouseId) === String(selectedWarehouseId)) ||
                            (Array.isArray(m.warehouses) && m.warehouses.some(wId => String(wId) === String(selectedWarehouseId))) ||
                            (Array.isArray(m.skalds) && m.skalds.some(sId => String(sId) === String(selectedWarehouseId))) ||
                            (Array.isArray(m.sklads) && m.sklads.some(sId => String(sId) === String(selectedWarehouseId)));

                        if (matchesWarehouse) {
                            const option = document.createElement('option');
                            option.value = m.id;
                            option.textContent = m.user_fio || usersMap[m.user_id] || m.name || m.description || `МОЛ #${m.id}`;

                            if (String(m.id) === String(activeMolVal)) {
                                option.selected = true;
                                isCurrentStillValid = true;
                            }
                            mol.appendChild(option);
                        }
                    });

                    if (isUserChange && !isCurrentStillValid) {
                        mol.value = '';
                    } else if (!isUserChange && isCurrentStillValid) {
                        mol.value = activeMolVal;
                    }
                    console.log("✅ [DEBUG WAREHOUSE] Список МОЛ успешно обновлен. Выбрано значение:", mol.value);
                } catch (err) {
                    console.error('❌ [DEBUG WAREHOUSE] Ошибка при обновлении списка МОЛ для склада:', err);
                }
            };

            warehouse.addEventListener('change', () => {
                console.log("🔄 [DEBUG WAREHOUSE] Склад изменен пользователем на ID:", warehouse.value);
                updateMolOptions(true);
            });

            if (warehouse.value) {
                console.log("🚀 [DEBUG WAREHOUSE] Склад уже заполнен при открытии, подгружаем МОЛ для ID:", warehouse.value);
                updateMolOptions(false);
            } else {
                console.log("⚠️ [DEBUG WAREHOUSE] Склад не выбран при открытии формы, подгружаем все МОЛ по умолчанию.");
                updateMolOptions(false);
            }
        });
    }

    const isPostedSelect = formElement.querySelector('[name="is_posted"]');
    const factDateInput = formElement.querySelector('[name="fact_date"]');
    
    if (isPostedSelect && factDateInput) {
        isPostedSelect.addEventListener('change', () => {
            if ((isPostedSelect.value === 'true' || isPostedSelect.value === '1') && !factDateInput.value) {
                factDateInput.value = currentDateTime;
            } else if (isPostedSelect.value === 'false' || isPostedSelect.value === '0') {
                factDateInput.value = '';
            }
        });
    }

    const deleteBtn = drawer.querySelector('#delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal(
                'Подтверждение удаления',
                'Вы уверены, что хотите удалить эту реализацию?',
                async () => {
                    const currentUserId = localStorage.getItem('currentUserId') || '';
                    try {
                        const response = await fetch(`/api/realizations/${item.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': currentUserId
                            }
                        });

                        if (response.ok) {
                            closeDrawer();
                            showAppNotification('Реализация успешно удалена', 'success');
                            refreshData();
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            showAppNotification(errData.error || 'Ошибка при удалении реализации', 'error');
                        }
                    } catch (err) {
                        showAppNotification('Ошибка соединения с сервером', 'error');
                    }
                }
            );
        });
    }

    let isSubmitting = false;

    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log("📤 Отправка формы 'realizations' перехвачена");
        
        if (isSubmitting) return;
        isSubmitting = true;

        const saveButton = formElement.querySelector('#save-btn');
        if (saveButton) saveButton.disabled = true;

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        console.log("📦 Данные формы перед обработкой:", data);

        if (data.is_posted !== undefined && data.is_posted !== '') {
            data.is_posted = data.is_posted === 'true' || data.is_posted === true || data.is_posted === '1' || data.is_posted === 1;
        }

        try {
            const isEdit = item && item.id;
            const url = isEdit ? `/api/realizations/${item.id}` : `/api/realizations`;
            const method = isEdit ? 'PUT' : 'POST';
            const currentUserId = localStorage.getItem('currentUserId') || '';

            console.log(`🚀 Отправка запроса [${method}] на ${url} с данными:`, data);

            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'x-user-id': currentUserId
                },
                body: JSON.stringify(data)
            });

            console.log("📥 Ответ сервера на сохранение:", response.status);

            if (response.ok) {
                closeDrawer();
                showAppNotification('Реализация успешно сохранена', 'success');
                refreshData();
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error("❌ Ошибка от сервера при сохранении:", errData);
                showAppNotification(errData.error || 'Ошибка при сохранении реализации', 'error');
                isSubmitting = false; 
                if (saveButton) saveButton.disabled = false;
            }
        } catch (err) {
            console.error("❌ Ошибка соединения при сохранении:", err);
            showAppNotification('Ошибка соединения с сервером', 'error');
            isSubmitting = false;
            if (saveButton) saveButton.disabled = false;
        }
    });
}


// Динамически создаем модальное окно для просмотрщика картинок на весь экран при клике на любую картинку в таблице
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'IMG' && e.target.closest('td')) {
        // Предотвращаем стандартное поведение (скачивание, переход по ссылкам и т.д.)
        e.preventDefault();
        e.stopPropagation();

        const img = e.target;
        if (img.src) {
            // Проверяем, создано ли уже модальное окно, если нет — создаем
            let modal = document.getElementById('image-viewer-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'image-viewer-modal';
                modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); display: flex; justify-content: center; align-items: center; z-index: 9999; cursor: pointer;';
                modal.innerHTML = `
                    <div style="position: relative; max-width: 90%; max-height: 90%;">
                        <img id="modal-image-content" style="width: 100%; height: auto; max-height: 90vh; border-radius: 8px; object-fit: contain; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                        <span style="position: absolute; top: -40px; right: 0; color: white; font-size: 32px; font-weight: bold; cursor: pointer;">&times;</span>
                    </div>
                `;
                document.body.appendChild(modal);

                // Закрытие по клику на фон или крестик
                modal.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }

            // Подставляем картинку и показываем модальное окно
            const modalImg = modal.querySelector('#modal-image-content');
            modalImg.src = img.src;
            modal.style.display = 'flex';
        }
    }
});

async function openCarDetailsForm(entity, item = null, parentId = null) {
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();
    
    const now = new Date();
    const currentDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (!item) item = {};

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item.id ? 'Редактировать' : 'Добавить'}: ${config.title || 'Документ / Фото'}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="car-details-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}">
    `;

    // Корректно подставляем скрытый инпут в зависимости от сущности
    if (parentId) {
        if (entity === 'accident_images') {
            html += `<input type="hidden" name="accident_id" value="${parentId}">`;
        } else {
            html += `<input type="hidden" name="car_id" value="${parentId}">`;
        }
    }

    for (const col of config.columns) {
        if (col.field === 'id' || col.field === 'car_id' || col.field === 'accident_id') continue;
        if (col.insert === false) continue;

        let val = item[col.field] || '';
        let inputHtml = '';

        // Добавлено распознавание image_url и image для корректного отображения кнопки выбора файла
        if (col.type === 'file' || col.field === 'file' || col.field === 'photo' || col.field === 'image' || col.field === 'image_url' || col.field.includes('file') || col.field.includes('photo') || col.field.includes('image')) {
            inputHtml = `<input type="file" name="photo" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">`;
        } else if (col.type === 'datetime-local' || col.field.includes('date')) {
            inputHtml = `<input type="datetime-local" name="${col.field}" value="${val || currentDateTime}" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">`;
        } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; resize: vertical;">${val}</textarea>`;
        } else {
            inputHtml = `<input type="text" name="${col.field}" value="${val}" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">`;
        }

        html += `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label || col.field}:
                ${inputHtml}
            </label>
        `;
    }

    html += `
        <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
            <button type="submit" id="save-car-detail-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Сохранить</button>
            ${item.id ? `<button type="button" id="delete-car-detail-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Удалить</button>` : ''}
            <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
        </div>
    </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    const formElement = drawer.querySelector('#car-details-form');

    const deleteBtn = drawer.querySelector('#delete-car-detail-btn');
    if (deleteBtn && item.id) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal('Удаление', 'Удалить эту запись?', async () => {
                const res = await fetch(`/api/${entity}/${item.id}`, {
                    method: 'DELETE',
                    headers: { 'x-user-id': localStorage.getItem('currentUserId') || '' }
                });
                if (res.ok) {
                    closeDrawer();
                    showAppNotification('Успешно удалено', 'success');
                    if (parentId) loadDetailData(entity, parentId);
                    else refreshData();
                } else {
                    showAppNotification('Ошибка удаления', 'error');
                }
            });
        });
    }

    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();
        const saveBtn = formElement.querySelector('#save-car-detail-btn');
        if (saveBtn) saveBtn.disabled = true;

        const formData = new FormData(e.target);
        
        if (parentId) {
            if (entity === 'accident_images' && !formData.get('accident_id')) {
                formData.set('accident_id', parentId);
            } else if (entity !== 'accident_images' && !formData.get('car_id')) {
                formData.set('car_id', parentId);
            }
        }

        try {
            const isEdit = item && item.id;
            const url = isEdit ? `/api/${entity}/${item.id}` : `/api/${entity}`;
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'x-user-id': localStorage.getItem('currentUserId') || ''
                },
                body: formData
            });

            if (response.ok) {
                closeDrawer();
                showAppNotification('Сохранено успешно', 'success');
                if (parentId) {
                    loadDetailData(entity, parentId);
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка сохранения', 'error');
                if (saveBtn) saveBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveBtn) saveBtn.disabled = false;
        }
    });
}


function openAccidentImageForm(entity, item = null, parentId = null) {
    const drawer = getOrCreateDrawer();
    
    const now = new Date();
    const currentDateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (!item) item = {};

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item.id ? 'Редактировать' : 'Добавить'}: Изображение ДТП</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="accident-image-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}">
    `;

    if (parentId) {
        html += `<input type="hidden" name="accident_id" value="${parentId}">`;
    }

    html += `
        <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
            Дата загрузки:
            <input type="datetime-local" name="created_at" value="${item.created_at ? item.created_at.slice(0, 16) : currentDateTime}" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
        </label>
    `;

    html += `
        <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
            Изображение:
            ${item.image_url ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Текущий файл: <a href="${item.image_url}" target="_blank">посмотреть</a></div>` : ''}
            <input type="file" name="image_url" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
        </label>
    `;

    html += `
        <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
            Описание:
            <textarea name="description" rows="4" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; resize: vertical;">${item.description || ''}</textarea>
        </label>
    `;

    html += `
        <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
            <button type="submit" id="save-accident-img-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Сохранить</button>
            ${item.id ? `<button type="button" id="delete-accident-img-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Удалить</button>` : ''}
            <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
        </div>
    </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    const formElement = drawer.querySelector('#accident-image-form');

    const deleteBtn = drawer.querySelector('#delete-accident-img-btn');
    if (deleteBtn && item.id) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal('Удаление', 'Удалить это изображение?', async () => {
                const res = await fetch(`/api/accident_images/${item.id}`, {
                    method: 'DELETE',
                    headers: { 'x-user-id': localStorage.getItem('currentUserId') || '' }
                });
                if (res.ok) {
                    closeDrawer();
                    showAppNotification('Успешно удалено', 'success');
                    if (parentId) loadDetailData('accident_images', parentId);
                } else {
                    showAppNotification('Ошибка удаления', 'error');
                }
            });
        });
    }

    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();
        const saveBtn = formElement.querySelector('#save-accident-img-btn');
        if (saveBtn) saveBtn.disabled = true;

        const formData = new FormData(e.target);
        if (parentId && !formData.get('accident_id')) {
            formData.set('accident_id', parentId);
        }

        try {
            const isEdit = item && item.id;
            const url = isEdit ? `/api/accident_images/${item.id}` : `/api/accident_images`;
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'x-user-id': localStorage.getItem('currentUserId') || ''
                },
                body: formData
            });

            if (response.ok) {
                closeDrawer();
                showAppNotification('Сохранено успешно', 'success');
                if (parentId) {
                    loadDetailData('accident_images', parentId);
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка сохранения', 'error');
                if (saveBtn) saveBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveBtn) saveBtn.disabled = false;
        }
    });
}



// Функция удаления выбранной сущности
function deleteSelectedEntity() {
    if (!selectedItem) {
        showAppNotification('Пожалуйста, выберите строку для удаления (кликните один раз на строку в таблице).', 'warning');
        return;
    }

    showConfirmModal(
        'Подтверждение удаления',
        `Вы уверены, что хотите удалить запись с ID: ${selectedItem.id}?`,
        async () => {
            const currentUserId = localStorage.getItem('currentUserId') || '';

            try {
                const response = await fetch(`/api/${currentEntity}/${selectedItem.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': currentUserId 
                    }
                });

                const resultData = await response.json().catch(() => ({}));

                if (response.ok) {
                    selectedItem = null;
                    showAppNotification('Запись успешно удалена', 'success');
                    
                    const specialEntities = [
                        'car_details', 'receipt_items', 'move_items', 'accident_invoices', 
                        'accident_payments', 'accident_events', 'accident_items', 
                        'repair_items', 'repair_works'
                    ];

                    if (specialEntities.includes(currentEntity) && typeof parentId !== 'undefined' && parentId) {
                        loadDetailData(currentEntity, parentId);
                    } else {
                        refreshData();
                    }
                } else {
                    showAppNotification(resultData.error || 'Ошибка при удалении записи', 'error');
                }
            } catch (err) {
                console.error('Ошибка соединения при удалении:', err);
                showAppNotification('Ошибка соединения с сервером', 'error');
            }
        }
    );
}
function editSelectedEntity() {
    if (!selectedItem) {
        showAppNotification('Пожалуйста, выберите строку для изменения (кликните один раз на строку в таблице).', 'warning');
        return;
    }

    if (currentEntity === 'receipts' && typeof openReceiptForm === 'function') {
        openReceiptForm(selectedItem);
    } else if (currentEntity === 'moves' && typeof openMovementForm === 'function') {
        openMovementForm(selectedItem);
    } else if (currentEntity === 'realizations' && typeof openRealizationForm === 'function') {
        openRealizationForm(currentEntity, selectedItem); // или просто openRealizationForm(selectedItem), в зависимости от того, сколько аргументов принимает ваша функция
    } else {
        openEntityForm(currentEntity, selectedItem);
    }
}


// Универсальная функция открытия формы добавления или изменения в зависимости от текущей сущности
function openActiveEntityForm(action, item = null) {
    // Определяем текущую сущность (если это редактирование, берем активную строку/раздел)
    const entity = action === 'edit' ? (typeof getSelectedEntityName === 'function' ? getSelectedEntityName() : currentEntity) : currentEntity;

    // Распределяем в зависимости от выбранного раздела (документа или справочника)
    switch (entity) {
        case 'Приход':
        case 'receipts':
            if (typeof openReceiptForm === 'function') {
                openReceiptForm(item);
            } else {
                openEntityForm(entity, item);
            }
            break;
            
        case 'Перемещение':
        case 'moves':
            if (typeof openMovementForm === 'function') {
                openMovementForm(item);
            } else {
                openEntityForm(entity, item);
            }
            break;

        case 'Реализация':
        case 'realizations':
            if (typeof openRealizationForm === 'function') {
                openRealizationForm(item);
            } else {
                openEntityForm(entity, item);
            }
            break;
            
        default:
            // Для остальных справочников используем стандартную универсальную форму
            if (typeof openEntityForm === 'function') {
                openEntityForm(entity, item);
            } else {
                console.error('Функция openEntityForm не найдена');
            }
            break;
    }
}





document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-msg');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const result = await response.json();

        // 🔍 ЛОГ: Посмотрим, что вообще пришло от сервера при логине
        console.log("🟢 [ОТВЕТ СЕРВЕРА ПРИ ЛОГИНЕ]:", result);

        if (response.ok && result.success) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('currentUser', login);
            
            // Универсальный поиск ID (проверяем все возможные варианты ответа бэкенда)
            const userId = result.user?.id || result.id || result.userId || null;

            if (userId) {
                localStorage.setItem('currentUserId', userId);
                console.log("✅ [УСПЕХ] ID пользователя успешно сохранен в localStorage:", userId);
            } else {
                console.warn("⚠️ [ВНИМАНИЕ] Сервер пустил пользователя, но НЕ передал его ID! Проверьте, что возвращает /api/login");
            }

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'flex';

            loadData('users', 'Пользователи');

            if (typeof checkRemindersOnStart === 'function') {
                checkRemindersOnStart();
            }

        } else {
            errorDiv.style.display = 'block';
            errorDiv.innerText = result.message || 'Ошибка входа';
        }
    } catch (err) {
        console.error("❌ Ошибка при отправке формы входа:", err);
        errorDiv.style.display = 'block';
        errorDiv.innerText = 'Ошибка соединения с сервером';
    }
});

function logout() {
    localStorage.clear(); 
    location.reload();
}



async function refreshData() {
    console.log('🔄 [refreshData] Запуск обновления. currentEntity:', currentEntity, 'selectedItem:', selectedItem);
    console.trace('🔍 [refreshData] Стек вызовов (кто вызвал refreshData):');

    const activeLink = document.querySelector('.nav-link.active');
    const title = activeLink ? activeLink.innerText : 'Данные';
    
    await loadData(currentEntity, title);

    if (selectedItem) {
        console.log('📌 [refreshData] Есть выбранный элемент (selectedItem):', selectedItem);

        if (currentEntity === 'receipts' && selectedItem.id) {
            loadDetailData('receipt_items', selectedItem.id);
        } else if (currentEntity === 'moves' && selectedItem.id) {
            loadDetailData('move_items', selectedItem.id);
        } else if (currentEntity === 'cars' && selectedItem.id) {
            loadDetailData('car_details', selectedItem.id);
        } else if (currentEntity === 'car_cards' && selectedItem.id) {
            const activeTabBtn = document.querySelector('#tabs-for-cars button.active, #tabs-for-cars .car-tab-btn.active');
            if (activeTabBtn) {
                const detailEntity = activeTabBtn.getAttribute('data-tab') || 'tehosmotr';
                loadDetailData(detailEntity, selectedItem.id); 
            }
        } else if (currentEntity === 'accidents' && selectedItem.id) {
            const activeTabBtn = document.querySelector('#tabs-for-accidents button.active, #tabs-for-accidents .accident-tab-btn.active');
            const detailEntity = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : (typeof currentAccidentSubTab !== 'undefined' ? currentAccidentSubTab : 'accident_invoices');
            loadDetailData(detailEntity, selectedItem.id);
        } else if (currentEntity === 'repairs' && selectedItem.id) {
            const activeTabBtn = document.querySelector('#tabs-for-repairs button.active, #tabs-for-repairs .repair-tab-btn.active');
            const detailEntity = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : (typeof currentRepairSubTab !== 'undefined' ? currentRepairSubTab : 'repair_items');
            loadDetailData(detailEntity, selectedItem.id);
        } else if (currentEntity === 'realizations' && selectedItem.id) {
            const activeTabBtn = document.querySelector('#tabs-for-realizations button.active, #tabs-for-realizations .realization-tab-btn.active');
            const detailEntity = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'realization_items';
            loadDetailData(detailEntity, selectedItem.id);
        } else if (currentEntity === 'customers' && selectedItem.id) {
            const activeTabBtn = document.querySelector('#tabs-for-customers button.active, #tabs-for-customers .customer-tab-btn.active');
            const detailEntity = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : (typeof currentCustomerSubTab !== 'undefined' ? currentCustomerSubTab : 'customer_contacts');
            loadDetailData(detailEntity, selectedItem.id);
        } else if (currentEntity === 'stock_balances') {
            const zId = selectedItem.zaphasti_id || selectedItem.id;
            const wId = selectedItem.warehouse_id || selectedItem.sklad_id || selectedItem.id_sklad || selectedItem.warehouseId;
            loadDetailData('stock_batches', { zaphasti_id: zId, warehouse_id: wId });
        } else if (currentEntity === 'stock_movement') {
            loadDetailData('part_movement_details', selectedItem);
        } else if (currentEntity === 'money_receipts' || currentEntity === 'money_receipts_by_sklad') {
            const activeTabBtn = document.querySelector('#tabs-for-money-receipts button.active, #tabs-for-money-receipts .money-receipt-tab-btn.active');
            const detailEntity = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'money_receipts_detail';
            
            // Если выбран конкретный документ реализации, передаем его realization_id, чтобы не терять контекст
            if (selectedItem.realization_id || (currentEntity === 'money_receipts' && selectedItem.id)) {
                loadDetailData(detailEntity, {
                    customer_id: selectedItem.customer_id,
                    sklad_id: selectedItem.sklad_id,
                    realization_id: selectedItem.realization_id || selectedItem.id,
                });
            } else {
                const targetSkladId = selectedItem.sklad_id || window.currentSkladId || '';
                const payload = {
                    customer_id: selectedItem.customer_id || selectedItem.id,
                    sklad_id: targetSkladId
                };
                loadDetailData(detailEntity, payload);
            }
        }
        // Старые ветки expenses_* отсюда полностью удалены и готовы к замене на новую изолированную логику.
    } else {
        console.log('⚠️ [refreshData] selectedItem пустой (null/undefined)');
    }
}


function showAppNotification(message, type = 'info') {
    let container = document.getElementById('app-notifications-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'app-notifications-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColors = { success: '#d1e7dd', error: '#f8d7da', warning: '#fff3cd', info: '#cff4fc' };
    const textColors = { success: '#0f5132', error: '#842029', warning: '#664d03', info: '#055160' };

    toast.style.cssText = `
        padding: 12px 20px; 
        background-color: ${bgColors[type] || bgColors.info}; 
        color: ${textColors[type] || textColors.info}; 
        border-radius: 8px; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        font-size: 14px; 
        font-family: inherit;
        opacity: 0; 
        transition: opacity 0.3s ease-in-out;
    `;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function showConfirmModal(title, text, onConfirm) {
    const existingModal = document.getElementById('custom-confirm-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'custom-confirm-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; 
        align-items: center; z-index: 10000; backdrop-filter: blur(2px);
    `;

    modal.innerHTML = `
        <div style="background: #fff; padding: 24px; border-radius: 12px; width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-family: inherit;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #333;">${title}</h3>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.5;">${text}</p>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="modal-btn-cancel" style="padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Отмена</button>
                <button id="modal-btn-ok" style="padding: 8px 16px; background: #dc3546; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Удалить</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modal-btn-cancel').onclick = () => modal.remove();
    document.getElementById('modal-btn-ok').onclick = () => {
        modal.remove();
        if (typeof onConfirm === 'function') onConfirm();
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}


async function loadWarehousesForFilter() {
    try {
        const select = document.getElementById('filter-warehouse');
        if (!select) return;

        if (select.options.length > 1) return;

        const response = await fetch('/api/skladi');
        if (!response.ok) throw new Error('Ошибка загрузки складов');
        
        const warehouses = await response.json();

        select.innerHTML = '<option value="">-- Все склады --</option>';

        warehouses.forEach(wh => {
            const option = document.createElement('option');
            option.value = wh.id || wh.warehouse_id || wh.sklad_id;
            option.textContent = wh.name || wh.title || wh.sklad_name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Не удалось загрузить список складов для фильтра:', err);
    }
}


async function loadMolsForFilter() {
    try {
        const select = document.getElementById('filter-mol');
        if (!select) return;

        if (select.options.length > 1) return;

        const response = await fetch('/api/mol');
        if (!response.ok) throw new Error('Ошибка загрузки МОЛ');
        
        const mols = await response.json();

        select.innerHTML = '<option value="">-- Все МОЛ --</option>';

        mols.forEach(mol => {
            const option = document.createElement('option');
            option.value = mol.id || mol.mol_id;
            option.textContent = mol.user_fio || mol.name || mol.fio || mol.title;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Не удалось загрузить список МОЛ для фильтра:', err);
    }
}

async function applyFilters() {
    if (currentEntity !== 'stock_balances') return;

    const dateVal = document.getElementById('filter-date')?.value || '';
    const warehouseId = document.getElementById('filter-warehouse')?.value || '';
    const molId = document.getElementById('filter-mol')?.value || '';

    const params = new URLSearchParams();
    if (dateVal) params.append('date', dateVal);
    if (warehouseId) params.append('warehouse_id', warehouseId);
    if (molId) params.append('mol_id', molId);

    try {
        const response = await fetch(`/api/stock_balances?${params.toString()}`);
        if (!response.ok) throw new Error('Ошибка фильтрации');

        currentItems = await response.json();
        const config = getConfig('stock_balances');
        
        const tbody = document.getElementById('table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        currentItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.id = item.id || '';
            tr.style.cursor = 'pointer';
            tr.innerHTML = config.render(item);

            tr.onclick = () => {
                selectedItem = item;
                const zId = item.zaphasti_id || item.id;
                const wId = item.warehouse_id || item.sklad_id || item.id_sklad || item.warehouseId;
                loadDetailData('stock_batches', { zaphasti_id: zId, warehouse_id: wId });
            };
            tbody.appendChild(tr);
        });

        const rowCountEl = document.getElementById('row-count');
        if (rowCountEl) {
            rowCountEl.innerText = `Раздел: Остатки запчастей | Найдено строк: ${currentItems.length}`;
        }

        if (currentItems.length > 0) {
            selectedItem = currentItems[0];
            const zId = currentItems[0].zaphasti_id || currentItems[0].id;
            const wId = currentItems[0].warehouse_id || currentItems[0].sklad_id || currentItems[0].id_sklad || currentItems[0].warehouseId;

            loadDetailData('stock_batches', { 
                zaphasti_id: zId, 
                warehouse_id: wId 
            });
        } else {
            selectedItem = null;
            // Передаем 'stock_batches', чтобы emptyDetailBody знала, для какой сущности очищать детальную панель
            emptyDetailBody('stock_batches'); 
        }

    } catch (err) {
        console.error('Ошибка применения фильтров:', err);
    }
}

async function loadWarehousesForMovement() {
    try {
        const select = document.getElementById('movement-warehouse');
        if (!select) return;
        if (select.options.length > 1) return;

        const response = await fetch('/api/skladi');
        if (!response.ok) throw new Error('Ошибка загрузки складов');
        
        const warehouses = await response.json();
        select.innerHTML = '<option value="">-- Все склады --</option>';

        warehouses.forEach(wh => {
            const option = document.createElement('option');
            option.value = wh.id || wh.warehouse_id || wh.sklad_id;
            option.textContent = wh.name || wh.title || wh.sklad_name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Не удалось загрузить список складов для движения:', err);
    }
}


async function loadMolsForMovement() {
    try {
        const select = document.getElementById('movement-mol');
        if (!select) return;
        if (select.options.length > 1) return;

        const response = await fetch('/api/mol');
        if (!response.ok) throw new Error('Ошибка загрузки МОЛ');
        
        const mols = await response.json();
        select.innerHTML = '<option value="">-- Все МОЛ --</option>';

        mols.forEach(mol => {
            const option = document.createElement('option');
            option.value = mol.id || mol.mol_id;
            option.textContent = mol.user_fio || mol.name || mol.fio || mol.title;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Не удалось загрузить список МОЛ для движения:', err);
    }
}


async function applyMovementFilters() {
    if (currentEntity !== 'stock_movement') return;

    const startDateVal = document.getElementById('movement-start-date')?.value || '';
    const endDateVal = document.getElementById('movement-end-date')?.value || '';
    const warehouseId = document.getElementById('movement-warehouse')?.value || '';
    const molId = document.getElementById('movement-mol')?.value || '';

    const params = new URLSearchParams();
    if (startDateVal) params.append('start_date', startDateVal);
    if (endDateVal) params.append('end_date', endDateVal);
    if (warehouseId) params.append('warehouse_id', warehouseId);
    if (molId) params.append('mol_id', molId);

    try {
        let url = `/api/stock_movement`;
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка фильтрации движения запчастей');

        currentItems = await response.json();
        const config = getConfig('stock_movement');
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';

        currentItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.id = item.id || '';
            tr.style.cursor = 'pointer';
            tr.innerHTML = config.render(item);

            tr.onclick = () => {
                selectedItem = item;
                loadDetailData('part_movement_details', item);
            };
            tbody.appendChild(tr);
        });

        document.getElementById('row-count').innerText = `Раздел: Движение запчастей | Найдено строк: ${currentItems.length}`;

        if (currentItems.length > 0) {
            selectedItem = currentItems[0];
            loadDetailData('part_movement_details', selectedItem);
        } else {
            emptyDetailBody();
        }

    } catch (err) {
        console.error('Ошибка применения фильтров движения:', err);
    }
}


async function loadData(entity, title, customParams = {}) {
    console.log(`🚀 [loadData] СТАРТ загрузки сущности: "${entity}", заголовок: "${title}", customParams:`, customParams);

    currentEntity = entity;
    selectedItem = null;
    const config = getConfig(entity);

    const filterPanel = document.getElementById('parts-filter-panel');
    if (filterPanel) {
        if (entity === 'stock_balances') {
            filterPanel.style.display = 'flex';
            loadWarehousesForFilter(); 
            loadMolsForFilter();      
        } else {
            filterPanel.style.display = 'none';
        }
    }

    const movementFilterPanel = document.getElementById('movement-filter-panel');
    if (movementFilterPanel) {
        if (entity === 'stock_movement') {
            movementFilterPanel.style.display = 'flex';
            loadWarehousesForMovement(); 
            loadMolsForMovement();      
        } else {
            movementFilterPanel.style.display = 'none';
        }
    }

    const btnAdd = document.getElementById('btn-add');
    const btnEdit = document.getElementById('btn-edit');
    const btnDelete = document.getElementById('btn-delete');

    if (btnAdd && btnEdit && btnDelete) {
        if (entity === 'car_cards' || entity === 'cars_summary' || entity === 'stock_balances' || entity === 'stock_movement') {
            btnAdd.style.display = 'none';
            btnEdit.style.display = 'none';
            btnDelete.style.display = 'none';
        } else if (entity === 'expenses_by_receipts') {
            // Для расходов по поставщикам (накладных): показываем Добавить, скрываем Изменить и Удалить
            btnAdd.style.display = 'inline-block';
            btnEdit.style.display = 'none';
            btnDelete.style.display = 'none';
        } else {
            btnAdd.style.display = 'inline-block';
            btnEdit.style.display = 'inline-block';
            btnDelete.style.display = 'inline-block';
        }
    }

    const detailContainer = document.getElementById('detail-container');
    const detailToolbar = document.getElementById('detail-toolbar');

    if (detailContainer) {
        if (entity === 'receipts' || entity === 'moves' || entity === 'cars' || entity === 'car_cards' || entity === 'accidents' || entity === 'repairs' || entity === 'stock_balances' || entity === 'stock_movement' || entity === 'postavhik' || entity === 'counterparties' || entity === 'customers' || entity === 'realizations' || entity === 'expenses_by_receipts') {
            detailContainer.style.display = 'flex'; 

            if (detailToolbar) {
                if (entity === 'car_cards' || entity === 'stock_balances' || entity === 'stock_movement') {
                    detailToolbar.style.display = 'none';
                } else {
                    detailToolbar.style.display = 'flex';
                }
            }
        } else {
            detailContainer.style.display = 'none'; 
        }
    }

    try {
        let url = `/api/${entity}`;
        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(customParams)) {
            if (value !== undefined && value !== '') {
                params.append(key, value);
            }
        }

        if (entity === 'stock_balances') {
            const startDateVal = document.getElementById('filter-start-date')?.value || document.getElementById('filter-date')?.value || '';
            const endDateVal = document.getElementById('filter-end-date')?.value || '';
            const warehouseId = document.getElementById('filter-warehouse')?.value || '';
            const molId = document.getElementById('filter-mol')?.value || '';

            if (startDateVal) params.append('start_date', startDateVal);
            if (endDateVal) params.append('end_date', endDateVal);
            if (warehouseId) params.append('warehouse_id', warehouseId);
            if (molId) params.append('mol_id', molId);
        } else if (entity === 'stock_movement') {
            const startDateVal = document.getElementById('movement-start-date')?.value || '';
            const endDateVal = document.getElementById('movement-end-date')?.value || '';
            const warehouseId = document.getElementById('movement-warehouse')?.value || '';
            const molId = document.getElementById('movement-mol')?.value || '';

            if (startDateVal) params.append('start_date', startDateVal);
            if (endDateVal) params.append('end_date', endDateVal);
            if (warehouseId) params.append('warehouse_id', warehouseId);
            if (molId) params.append('mol_id', molId);
        }

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        console.log(`🌐 [loadData] Отправляем запрос на fetch: ${url}`);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Ошибка сервера');

        currentItems = await response.json();
        console.log(`📦 [loadData] Данные получены для ${entity}. Количество строк: ${currentItems.length}`, currentItems);

        const headerTr = document.getElementById('table-headers');
        const tbody = document.getElementById('table-body');

        tbody.innerHTML = '';

        const thead = headerTr.closest('thead');
        let filterRow = document.getElementById('table-filter-row');

        if (entity === 'car_cards') {
            if (filterRow) {
                filterRow.remove();
            }
        } else {
            if (!filterRow) {
                filterRow = document.createElement('tr');
                filterRow.id = 'table-filter-row';
                thead.insertBefore(filterRow, headerTr);
            } else {
                thead.insertBefore(filterRow, headerTr);
            }

            const visibleColumnsForFilter = config.columns.filter(col => col.table !== false);

            filterRow.innerHTML = visibleColumnsForFilter.map(col => {
                let styleAttr = col.style ? `style="${col.style} padding: 4px;"` : (col.width ? `style="width: ${col.width}; padding: 4px;"` : 'style="padding: 4px;"');
                if (col.style && col.style.includes('display: none')) {
                    return `<th style="display: none; padding: 4px;"></th>`;
                }
                return `
                    <th ${styleAttr}>
                        <input type="text" 
                               data-column="${col.field}" 
                               oninput="filterTable()" 
                               placeholder="Фильтр..."
                               style="width: 100%; padding: 4px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                    </th>
                `;
            }).join('');
        }

        const visibleColumns = config.columns.filter(col => col.table !== false);

        let headersHtml = visibleColumns.map(col => {
            let styleAttr = col.style ? `style="${col.style}"` : (col.width ? `style="width: ${col.width};"` : '');
            let refAttr = col.ref ? `data-ref="${col.ref}"` : '';
            return `<th ${styleAttr} data-field="${col.field}" ${refAttr}>${col.label}</th>`;
        }).join('');

        headerTr.innerHTML = headersHtml;

        currentItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.id = item.id || item.postavhik_id || '';
            tr.style.cursor = 'pointer';
            tr.innerHTML = config.render(item);

            tr.onclick = () => {
                selectedItem = item;
                console.log(`👆 [КЛИК В ТАБЛИЦЕ] Сущность: ${entity}`, { selectedItem, customParams });

                tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
                tr.classList.add('selected-row');

                if (entity === 'stock_balances') {
                    const zId = item.zaphasti_id || item.id;
                    const wId = item.warehouse_id || item.sklad_id || item.id_sklad || item.warehouseId;

                    loadDetailData('stock_batches', { 
                        zaphasti_id: zId, 
                        warehouse_id: wId 
                    });
                } else if (entity === 'stock_movement') {
                    loadDetailData('part_movement_details', item);
                } else if (entity === 'receipts') {
                    loadDetailData('receipt_items', item.id);
                } else if (entity === 'moves') {
                    loadDetailData('move_items', item.id);
                } else if (entity === 'realizations') {
                    const activeTabBtn = document.querySelector('#tabs-for-realizations button.active');
                    const detailEntity = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'realization_items';
                    loadDetailData(detailEntity, item.id);
                } else if (entity === 'cars') {
                    loadDetailData('car_details', item.id);
                } else if (entity === 'postavhik') {
                    loadDetailData('postavhik_contacts', item.id);
                } else if (entity === 'counterparties') {
                    loadDetailData('counterparty_contacts', item.id);
                } else if (entity === 'customers') {
                    const activeSubTab = typeof currentCustomerSubTab !== 'undefined' && currentCustomerSubTab ? currentCustomerSubTab : 'customer_contacts';
                    loadDetailData(activeSubTab, item.id);
                }
            };

            tbody.appendChild(tr);
        });

        document.getElementById('row-count').innerText = `Раздел: ${title} | Всего строк: ${currentItems.length}`;

        const carTabsBar = document.getElementById('car-tabs-bar');
        const tabsForCars = document.getElementById('tabs-for-cars');
        const tabsForAccidents = document.getElementById('tabs-for-accidents');
        const tabsForRepairs = document.getElementById('tabs-for-repairs');
        const tabsForCustomers = document.getElementById('tabs-for-customers');
        const tabsForRealizations = document.getElementById('tabs-for-realizations');

        if (carTabsBar) {
            if (tabsForCars) tabsForCars.style.display = 'none';
            if (tabsForAccidents) tabsForAccidents.style.display = 'none';
            if (tabsForRepairs) tabsForRepairs.style.display = 'none';
            if (tabsForCustomers) tabsForCustomers.style.display = 'none';
            if (tabsForRealizations) tabsForRealizations.style.display = 'none';

            if (entity === 'car_cards') {
                carTabsBar.style.display = 'flex';
                if (tabsForCars) tabsForCars.style.display = 'flex';
                selectedItem = null;
                if (typeof emptyDetailBody === 'function') emptyDetailBody(entity);
            } else if (entity === 'accidents') {
                carTabsBar.style.display = 'flex';
                if (tabsForAccidents) tabsForAccidents.style.display = 'flex';
                selectedItem = null;
                if (typeof emptyDetailBody === 'function') emptyDetailBody(entity);
            } else if (entity === 'repairs') {
                carTabsBar.style.display = 'flex';
                if (tabsForRepairs) tabsForRepairs.style.display = 'flex';
                selectedItem = null;
                if (typeof emptyDetailBody === 'function') emptyDetailBody(entity);
            } else if (entity === 'realizations') {
                carTabsBar.style.display = 'flex';
                if (tabsForRealizations) tabsForRealizations.style.display = 'flex';
                selectedItem = null;
                if (typeof emptyDetailBody === 'function') emptyDetailBody(entity);
            } else if (entity === 'customers') {
                carTabsBar.style.display = 'flex';
                if (tabsForCustomers) tabsForCustomers.style.display = 'flex';
                selectedItem = null;
                if (typeof emptyDetailBody === 'function') emptyDetailBody(entity);
            } else {
                carTabsBar.style.display = 'none';
                selectedItem = null;
                if (typeof emptyDetailBody === 'function') emptyDetailBody(entity);
            }
        }

    } catch (err) {
        console.error('❌ [loadData ОШИБКА] Ошибка загрузки данных для ' + entity, err);
        currentItems = [];
        document.getElementById('row-count').innerText = `Раздел: ${title} (нет данных на сервере)`;
    }
}



async function openPaymentHistory(receiptId, docNumber) {
    const drawer = getOrCreateDrawer();
    
    // Показываем прелоадер в шторке пока грузим данные
    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">История оплат: накладная № ${docNumber}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>
        <div style="text-align: center; color: #666; padding: 20px;">Загрузка истории...</div>
    `;
    openDrawer();

    try {
        // Запрашиваем историю платежей для этой накладной с бэкенда
        let response = await fetch(`/api/expenses_by_receipts/${receiptId}/payments`);
        if (!response.ok) throw new Error('Не удалось загрузить историю');
        
        let payments = await response.json();

        if (!payments || payments.length === 0) {
            drawer.querySelector('div:last-child').innerHTML = 'По этой накладной еще не было оплат.';
            return;
        }

        let rowsHtml = payments.map(p => {
            // Исправлено с p.payment_date на p.date в соответствии со структурой базы данных
            const pDate = p.date ? new Date(p.date).toLocaleDateString() : '—';
            const pAmount = Number(p.amount || 0).toFixed(2);
            const pComment = p.comment || '—';
            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; color: #4b5563;">${pDate}</td>
                    <td style="padding: 10px; font-weight: bold; color: #16a34a; text-align: right;">+${pAmount} </td>
                    <td style="padding: 10px; color: #6b7280; font-size: 13px;">${pComment}</td>
                </tr>
            `;
        }).join('');

        drawer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 16px; color: #333;">История оплат: накладная № ${docNumber}</h3>
                <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left;">
                        <th style="padding: 8px; color: #374151;">Дата</th>
                        <th style="padding: 8px; color: #374151; text-align: right;">Сумма</th>
                        <th style="padding: 8px; color: #374151;">Комментарий</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div style="margin-top: 20px;">
                <button type="button" onclick="closeDrawer()" style="width: 100%; background: #e5e7eb; color: #374151; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Закрыть</button>
            </div>
        `;

    } catch (err) {
        console.error(err);
        drawer.querySelector('div:last-child').innerHTML = '<span style="color: #dc2626;">Ошибка при загрузке истории платежей</span>';
    }
}

function openPaymentDrawer(receiptId, debtSum, docNumber) {
    const drawer = getOrCreateDrawer();
    
    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">Оплата накладной № ${docNumber}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>

        <form id="pay-form" onsubmit="submitPayment(event, '${receiptId}')" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
                <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px;">Сумма (Долг: ${debtSum} )</label>
                <input type="number" step="0.01" id="payment-amount" value="${debtSum}" required
                    style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
            </div>

            <div>
                <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px;">Комментарий</label>
                <textarea id="payment-comment" placeholder="Примечание к платежу..." 
                    style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; resize: vertical; min-height: 60px;"></textarea>
            </div>

            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button type="submit" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 500;">Сохранить</button>
                <button type="button" onclick="closeDrawer()" style="flex: 1; background: #e5e7eb; color: #374151; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Отмена</button>
            </div>
        </form>
    `;

    openDrawer();
}

async function submitPayment(event, receiptId) {
    event.preventDefault();
    
    const payload = {
        amount: parseFloat(document.getElementById('payment-amount').value),
        comment: document.getElementById('payment-comment').value
    };

    try {
        // Стучимся на твой существующий бэкенд-эндпоинт с ID накладной в строке
        let response = await fetch(`/api/expenses_by_receipts/${receiptId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            closeDrawer();
            showAppNotification('Платёж успешно сохранен', 'success');
            if (typeof loadTableData === 'function') loadTableData();
        } else {
            const errData = await response.json().catch(() => ({}));
            showAppNotification(errData.error || 'Ошибка при сохранении платежа', 'error');
        }
    } catch (err) {
        console.error('Ошибка сети:', err);
        showAppNotification('Не удалось отправить данные на сервер', 'error');
    }
}

// ==========================================
// 2. ФУНКЦИЯ ЗАГРУЗКИ ГЛАВНЫХ ДАННЫХ РАСХОДОВ (С ПОЛНЫМИ ЛОГАМИ)
// ==========================================
async function loadExpenseMainData(entity = 'expenses_by_sklad', parentId = '') {
    console.log(`💰 [loadExpenseMainData] НАЧАЛО. entity="${entity}", parentId:`, parentId);

    let fetchUrl = '';
    let currentExpenseView = entity;

    const detailContainer = document.getElementById('detail-container');
    const mainTableBody = document.getElementById('table-body');
    const mainHeaderTr = document.getElementById('table-headers');

    const btnAdd = document.getElementById('btn-add');
    const btnEdit = document.getElementById('btn-edit');
    const btnDelete = document.getElementById('btn-delete');

    if (currentExpenseView === 'expenses_by_sklad' || currentExpenseView === 'expenses') {
        currentExpenseView = 'expenses_by_sklad';
        window.currentSkladId = null;
        window.currentPostavhikId = null;
        window.currentReceiptId = null;

        fetchUrl = `/api/expenses_by_sklad`;
        console.log(`📂 [View: expenses_by_sklad] Установлен URL: ${fetchUrl}`);

        if (detailContainer) detailContainer.style.display = 'none';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    } 
    else if (currentExpenseView === 'expenses_by_suppliers') {
        let skladId = parentId && typeof parentId === 'object' ? (parentId.sklad_id || parentId.warehouse_id || parentId.id) : parentId;
        if (skladId) window.currentSkladId = skladId;
        window.currentPostavhikId = null;
        window.currentReceiptId = null;

        fetchUrl = `/api/expenses_by_suppliers${window.currentSkladId ? '?sklad_id=' + window.currentSkladId : ''}`;
        console.log(`📂 [View: expenses_by_suppliers] sklad_id=${window.currentSkladId}, URL: ${fetchUrl}`);

        if (detailContainer) detailContainer.style.display = 'none';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    } 
    else if (currentExpenseView === 'expenses_by_receipts') {
        let postavhikId = parentId && typeof parentId === 'object' ? (parentId.postavhik_id || parentId.id) : parentId;
        if (postavhikId) window.currentPostavhikId = postavhikId;
        window.currentReceiptId = null;

        let skladId = window.currentSkladId || '';
        let currentPostavhik = window.currentPostavhikId || '';

        fetchUrl = `/api/expenses_by_receipts?postavhik_id=${currentPostavhik}${skladId ? '&sklad_id=' + skladId : ''}`;
        console.log(`📂 [View: expenses_by_receipts] postavhik_id=${currentPostavhik}, sklad_id=${skladId}, URL: ${fetchUrl}`);

        if (detailContainer) detailContainer.style.display = 'none';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    } 
    else if (currentExpenseView === 'expense_items') {
        let receiptId = parentId && typeof parentId === 'object' ? (parentId.receipt_id || parentId.id || parentId.document_id) : parentId;
        
        if (receiptId !== undefined && receiptId !== null && receiptId !== '') {
            window.currentReceiptId = receiptId;
        }

        let skladId = window.currentSkladId || '';
        let postavhikId = window.currentPostavhikId || '';
        let currentReceipt = window.currentReceiptId || '';

        fetchUrl = `/api/expense_items?receipt_id=${currentReceipt}&postavhik_id=${postavhikId}&sklad_id=${skladId}`;
        console.log(`📂 [View: expense_items] URL: ${fetchUrl}`);

        currentEntity = currentExpenseView; 
        if (detailContainer) detailContainer.style.display = 'flex';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        loadExpenseDetailTable(fetchUrl);
        return; 
    }

    currentEntity = currentExpenseView;
    console.log(`⚙️ [Config] Инициализация конфигурации для entity: "${currentEntity}"`);

    const config = getConfig(currentEntity);
    if (!config) {
        console.error(`❌ [getConfig] Не найдена конфигурация для сущности: "${currentEntity}"! Проверьте функцию getConfig.`);
    }

    const visibleColumns = config && config.columns ? config.columns.filter(col => col.table !== false) : [];
    const colCount = visibleColumns.length > 0 ? visibleColumns.length : 1;

    if (mainHeaderTr && visibleColumns.length > 0) {
        mainHeaderTr.innerHTML = visibleColumns.map(col => {
            let widthStyle = col.width ? `width: ${col.width};` : '';
            let alignStyle = col.align ? `text-align: ${col.align};` : 'text-align: left;';
            return `<th style="padding: 8px; border-bottom: 2px solid #ddd; ${widthStyle} ${alignStyle}">${col.label}</th>`;
        }).join('');

        const thead = mainHeaderTr.closest('thead');
        let filterRow = document.getElementById('table-filter-row');

        if (!filterRow) {
            filterRow = document.createElement('tr');
            filterRow.id = 'table-filter-row';
            thead.insertBefore(filterRow, mainHeaderTr);
        } else {
            thead.insertBefore(filterRow, mainHeaderTr);
        }

        filterRow.innerHTML = visibleColumns.map(col => {
            let styleAttr = col.style ? `style="${col.style} padding: 4px;"` : (col.width ? `style="width: ${col.width}; padding: 4px;"` : 'style="padding: 4px;"');
            if (col.style && col.style.includes('display: none')) {
                return `<th style="display: none; padding: 4px;"></th>`;
            }
            return `
                <th ${styleAttr}>
                    <input type="text" 
                           data-column="${col.field}" 
                           oninput="filterTable()" 
                           placeholder="Фильтр..."
                           style="width: 100%; padding: 4px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                </th>
            `;
        }).join('');
    }

    try {
        console.log(`🌐 [Fetch] Отправка GET запроса на URL: ${fetchUrl}`);
        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`📥 [Fetch] Ответ получен. Статус: ${response.status} (${response.statusText})`);
        if (!response.ok) throw new Error(`Ошибка загрузки (Статус: ${response.status})`);

        currentItems = await response.json();
        console.log(`📦 [Data] Успешно получено элементов: ${Array.isArray(currentItems) ? currentItems.length : 'не массив'}`, currentItems);

        if (!mainTableBody) {
            console.error('❌ [DOM] Элемент #table-body не найден на странице!');
            return;
        }

        if (!currentItems || currentItems.length === 0) {
            console.warn('⚠️ [Data] Массив данных пуст. Выводим сообщение "Нет данных".');
            mainTableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>`;
            return;
        }

        mainTableBody.innerHTML = '';

        if (currentEntity === 'expenses_by_receipts') {
            console.log('📑 [Group] Рендеринг сгруппированных данных по месяцам (expenses_by_receipts)...');
            const monthNames = [
                "января", "февраля", "марта", "апреля", "мая", "июня", 
                "июля", "августа", "сентября", "октября", "ноября", "декабря"
            ];

            const groups = {};
            currentItems.forEach(item => {
                const rawDate = item.date || item.created_at || item.receipt_date;
                const dateObj = rawDate ? new Date(rawDate) : new Date();
                const month = isNaN(dateObj.getMonth()) ? 0 : dateObj.getMonth();
                const year = isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear();
                
                const key = `${year}-${String(month).padStart(2, '0')}`;
                const title = `${monthNames[month]} ${year} года`;

                if (!groups[key]) {
                    groups[key] = {
                        title: title,
                        totalSum: 0,
                        totalPaid: 0,
                        totalDebt: 0,
                        items: []
                    };
                }

                groups[key].items.push(item);
                groups[key].totalSum += Number(item.total_expense_sum || item.sum || 0);
                groups[key].totalPaid += Number(item.total_paid || 0);
                groups[key].totalDebt += Number(item.debt_sum || 0);
            });

            let groupIndex = 0;
            Object.keys(groups).sort().reverse().forEach(key => {
                const group = groups[key];
                const currentGIdx = groupIndex++;

                const headerTr = document.createElement('tr');
                headerTr.style.background = '#f1f5f9';
                headerTr.style.cursor = 'pointer';
                headerTr.style.fontWeight = 'bold';
                headerTr.innerHTML = `
                    <td colspan="${colCount}" style="padding: 10px; border-top: 2px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                        <span id="icon-${currentGIdx}" style="display:inline-block; width:20px; color:#2563eb;">[-]</span>
                        ${group.title} &nbsp;|&nbsp; 
                        Итого за месяц: <span style="color:#d97706;">${group.totalSum.toFixed(2)} </span> &nbsp;|&nbsp; 
                        Оплачено: <span style="color:#16a34a;">${group.totalPaid.toFixed(2)} </span> &nbsp;|&nbsp; 
                        Долг: <span style="color:#dc2626;">${group.totalDebt.toFixed(2)} </span>
                    </td>
                `;
                mainTableBody.appendChild(headerTr);

                const childRows = [];
                group.items.forEach(item => {
                    const tr = document.createElement('tr');
                    const rowId = item.id || item.receipt_id || '';
                    tr.dataset.id = rowId;
                    tr.style.cursor = 'pointer';
                    tr.className = `group-row-${currentGIdx}`;
                    
                    if (config && typeof config.render === 'function') {
                        tr.innerHTML = config.render(item);
                    } else {
                        console.error('❌ [Config] Функция render не найдена в конфиге для:', currentEntity);
                    }
                    
                    mainTableBody.appendChild(tr);
                    childRows.push(tr);
                });

                headerTr.addEventListener('click', () => {
                    const icon = document.getElementById(`icon-${currentGIdx}`);
                    const isHidden = childRows[0].style.display === 'none';
                    
                    childRows.forEach(tr => {
                        tr.style.display = isHidden ? '' : 'none';
                    });
                    
                    icon.innerText = isHidden ? '[-]' : '[+]';
                });
            });

        } else {
            console.log(`📋 [Render] Обычный рендеринг элементов для сущности: "${currentEntity}"`);
            currentItems.forEach((item, index) => {
                const tr = document.createElement('tr');
                const rowId = item.id || item.receipt_id || item.sklad_id || item.postavhik_id || '';
                
                tr.dataset.id = rowId;
                tr.style.cursor = 'pointer';
                
                if (config && typeof config.render === 'function') {
                    tr.innerHTML = config.render(item);
                } else {
                    console.error(`❌ [Config] У конфигурации сущности "${currentEntity}" отсутствует функция render!`, config);
                }

                mainTableBody.appendChild(tr);
            });
        }
        console.log('✅ [loadExpenseMainData] Рендеринг таблицы успешно завершен.');

    } catch (err) {
        console.error('❌ [loadExpenseMainData ОШИБКА]:', err);
        if (mainTableBody) {
            mainTableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки данных: ${err.message}</td></tr>`;
        }
    }
}

// Функция для нижней таблицы (спецификация запчастей)
async function loadExpenseDetailTable(fetchUrl) {
    console.log(`🔧 [loadExpenseDetailTable] Загрузка детализации по URL: ${fetchUrl}`);
    const detailBody = document.getElementById('detail-body');
    const detailTitle = document.getElementById('detail-title');
    const detailHeaderTr = document.getElementById('detail-headers') || document.querySelector('#detail-container thead tr');
    
    const config = getConfig('expense_items');
    if (detailTitle && config) detailTitle.innerText = config.title;

    if (detailHeaderTr && config && config.columns) {
        detailHeaderTr.innerHTML = config.columns.map(col => {
            let widthStyle = col.width ? `width: ${col.width};` : '';
            let alignStyle = col.align ? `text-align: ${col.align};` : 'text-align: left;';
            return `<th style="padding: 6px; border-bottom: 2px solid #ddd; ${widthStyle} ${alignStyle}">${col.label}</th>`;
        }).join('');
    }

    const colCount = config && config.columns ? config.columns.length : 5;
    if (detailBody) detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Загрузка запчастей...</td></tr>`;

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error('Ошибка загрузки позиций');
        const items = await response.json();
        console.log(`📦 [Detail Data] Получено позиций:`, items);

        if (!detailBody) return;

        if (items.length === 0) {
            detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет запчастей в этой накладной</td></tr>`;
            return;
        }

        detailBody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            if (config && typeof config.render === 'function') {
                tr.innerHTML = config.render(item);
            }
            detailBody.appendChild(tr);
        });
    } catch (err) {
        console.error('❌ [loadExpenseDetailTable ОШИБКА]:', err);
        if (detailBody) {
            detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки спецификации</td></tr>`;
        }
    }
}




async function openIncomePaymentHistory(realizationId, docNumber) {
    const drawer = getOrCreateDrawer();
    
    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">История поступлений: реализация № ${docNumber}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>
        <div style="text-align: center; color: #666; padding: 20px;">Загрузка истории...</div>
    `;
    openDrawer();

    try {
        let response = await fetch(`/api/money_receipts/${realizationId}/payments`);
        if (!response.ok) throw new Error('Не удалось загрузить историю');
        
        let payments = await response.json();

        if (!payments || payments.length === 0) {
            drawer.querySelector('div:last-child').innerHTML = 'По этой реализации еще не было поступлений.';
            return;
        }

        let rowsHtml = payments.map(p => {
            const pDate = p.date ? new Date(p.date).toLocaleDateString() : '—';
            const pAmount = Number(p.amount || 0).toFixed(2);
            const pComment = p.comment || '—';
            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; color: #4b5563;">${pDate}</td>
                    <td style="padding: 10px; font-weight: bold; color: #16a34a; text-align: right;">+${pAmount} </td>
                    <td style="padding: 10px; color: #6b7280; font-size: 13px;">${pComment}</td>
                </tr>
            `;
        }).join('');

        drawer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 16px; color: #333;">История поступлений: реализация № ${docNumber}</h3>
                <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left;">
                        <th style="padding: 8px; color: #374151;">Дата</th>
                        <th style="padding: 8px; color: #374151; text-align: right;">Сумма</th>
                        <th style="padding: 8px; color: #374151;">Комментарий</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div style="margin-top: 20px;">
                <button type="button" onclick="closeDrawer()" style="width: 100%; background: #e5e7eb; color: #374151; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Закрыть</button>
            </div>
        `;

    } catch (err) {
        console.error(err);
        drawer.querySelector('div:last-child').innerHTML = '<span style="color: #dc2626;">Ошибка при загрузке истории поступлений</span>';
    }
}

function openIncomePaymentDrawer(realizationId, debtSum, docNumber) {
    const drawer = getOrCreateDrawer();
    
    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">Оплата реализации № ${docNumber}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>

        <form id="pay-form" onsubmit="submitIncomePayment(event, '${realizationId}')" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
                <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px;">Сумма (Долг: ${debtSum} )</label>
                <input type="number" step="0.01" id="payment-amount" value="${debtSum}" required
                    style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
            </div>

            <div>
                <label style="display: block; font-size: 13px; color: #555; margin-bottom: 6px;">Комментарий</label>
                <textarea id="payment-comment" placeholder="Примечание к платежу..." 
                    style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; resize: vertical; min-height: 60px;"></textarea>
            </div>

            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button type="submit" style="flex: 1; background: #16a34a; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 500;">Сохранить</button>
                <button type="button" onclick="closeDrawer()" style="flex: 1; background: #e5e7eb; color: #374151; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Отмена</button>
            </div>
        </form>
    `;

    openDrawer();
}

async function submitIncomePayment(event, realizationId) {
    event.preventDefault();
    
    const payload = {
        amount: parseFloat(document.getElementById('payment-amount').value),
        comment: document.getElementById('payment-comment').value
    };

    try {
        let response = await fetch(`/api/money_receipts/${realizationId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            closeDrawer();
            showAppNotification('Платёж успешно сохранен', 'success');
            if (typeof loadTableData === 'function') loadTableData();
        } else {
            const errData = await response.json().catch(() => ({}));
            showAppNotification(errData.error || 'Ошибка при сохранении платежа', 'error');
        }
    } catch (err) {
        console.error('Ошибка сети:', err);
        showAppNotification('Не удалось отправить данные на сервер', 'error');
    }
}


async function loadReceiptMainData(entity = 'money_receipts_by_sklad', parentId = '') {
    console.log(`📥 [loadReceiptMainData] entity="${entity}", parentId:`, parentId);

    let fetchUrl = '';
    let currentReceiptView = entity;

    const detailContainer = document.getElementById('detail-container');
    const mainTableBody = document.getElementById('table-body');
    const mainHeaderTr = document.getElementById('table-headers');

    const btnAdd = document.getElementById('btn-add');
    const btnEdit = document.getElementById('btn-edit');
    const btnDelete = document.getElementById('btn-delete');

    // 1 уровень: Склады (отображаем все)
    if (currentReceiptView === 'money_receipts_by_sklad') {
        window.currentSkladId = null;
        window.currentCustomerId = null;
        window.currentRealizationId = null;

        fetchUrl = `/api/money_receipts_by_sklad`;
        if (detailContainer) detailContainer.style.display = 'none';
        
        const tabsBlock = document.getElementById('tabs-for-money-receipts');
        if (tabsBlock) tabsBlock.style.display = 'none';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    } 
    // 2 уровень: Документы (реализации и ремонты) выбранного склада
    else if (currentReceiptView === 'money_receipts') {
        let skladId = parentId && typeof parentId === 'object' ? (parentId.sklad_id || parentId.warehouse_id || parentId.id) : parentId;
        if (skladId) window.currentSkladId = skladId;
        window.currentCustomerId = null;
        window.currentRealizationId = null;

        fetchUrl = `/api/money_receipts${window.currentSkladId ? '?sklad_id=' + window.currentSkladId : ''}`;
        
        if (detailContainer) detailContainer.style.display = 'block';
        
        const tabsBlock = document.getElementById('tabs-for-money-receipts');
        if (tabsBlock) tabsBlock.style.display = 'none';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
    }

    currentEntity = currentReceiptView;

    const config = getConfig(currentEntity);
    const visibleColumns = config && config.columns ? config.columns.filter(col => col.table !== false) : [];
    const colCount = visibleColumns.length > 0 ? visibleColumns.length : 1;

    if (mainHeaderTr && visibleColumns.length > 0) {
        mainHeaderTr.innerHTML = visibleColumns.map(col => {
            let widthStyle = col.width ? `width: ${col.width};` : '';
            let alignStyle = col.align ? `text-align: ${col.align};` : 'text-align: left;';
            return `<th style="padding: 8px; border-bottom: 2px solid #ddd; ${widthStyle} ${alignStyle}">${col.label}</th>`;
        }).join('');

        const thead = mainHeaderTr.closest('thead');
        let filterRow = document.getElementById('table-filter-row');

        if (!filterRow) {
            filterRow = document.createElement('tr');
            filterRow.id = 'table-filter-row';
            thead.insertBefore(filterRow, mainHeaderTr);
        } else {
            thead.insertBefore(filterRow, mainHeaderTr);
        }

        filterRow.innerHTML = visibleColumns.map(col => {
            let styleAttr = col.style ? `style="${col.style} padding: 4px;"` : (col.width ? `style="width: ${col.width}; padding: 4px;"` : 'style="padding: 4px;"');
            if (col.style && col.style.includes('display: none')) {
                return `<th style="display: none; padding: 4px;"></th>`;
            }
            return `
                <th ${styleAttr}>
                    <input type="text" 
                           data-column="${col.field}" 
                           oninput="filterTable()" 
                           placeholder="Фильтр..."
                           style="width: 100%; padding: 4px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                </th>
            `;
        }).join('');
    }

    try {
        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error(`❌ Сервер вернул ошибку [${response.status}]:`, responseText);
            throw new Error(`Ошибка загрузки (Статус: ${response.status})`);
        }

        try {
            currentItems = JSON.parse(responseText);
        } catch (e) {
            console.error('❌ Сервер вернул не JSON, а HTML-страницу:', responseText);
            throw new Error('Ответ сервера не является валидным JSON');
        }

        if (!mainTableBody) return;

        if (currentItems.length === 0) {
            mainTableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>`;
            return;
        }

        mainTableBody.innerHTML = '';

        // Если это уровень документов (money_receipts), группируем по месяцам с итогами
        if (currentReceiptView === 'money_receipts') {
            const getMonthData = (dateStr) => {
                if (!dateStr) return { key: 'unknown', title: 'Без даты' };
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return { key: 'unknown', title: 'Без даты' };
                
                const months = [
                    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
                ];
                const monthName = months[d.getMonth()];
                const year = d.getFullYear();
                return {
                    key: `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    title: `${monthName} ${year} года`
                };
            };

            const groupedByMonth = {};
            currentItems.forEach(item => {
                const m = getMonthData(item.date);
                if (!groupedByMonth[m.key]) {
                    groupedByMonth[m.key] = {
                        title: m.title,
                        items: [],
                        totalSum: 0,
                        totalPaid: 0,
                        totalDebt: 0,
                        totalPartsProfit: 0,  // Реальный плюс по запчастям с учетом оплат
                        totalWorksSum: 0,     // Реальные услуги с учетом оплат
                        totalNetProfit: 0     // Общий реальный плюс с учетом оплат
                    };
                }
                groupedByMonth[m.key].items.push(item);
                
                const realizationSum = Number(item.total_realization_sum || 0);
                const paidSum = Number(item.total_paid || 0);
                
                // Коэффициент оплаты документа (от 0 до 1)
                const payRatio = realizationSum > 0 ? Math.min(paidSum / realizationSum, 1) : 0;

                groupedByMonth[m.key].totalSum += realizationSum;
                groupedByMonth[m.key].totalPaid += paidSum;
                groupedByMonth[m.key].totalDebt += Number(item.debt_sum || item.total_debt || 0);
                
                // Считаем прибыль по запчастям, услугам и общий плюс пропорционально оплате
                const partProfitFull = Number(item.parts_profit || 0);
                const workSumFull = Number(item.works_sum || 0);
                const netProfitFull = Number(item.net_profit || 0);

                groupedByMonth[m.key].totalPartsProfit += Number((partProfitFull * payRatio).toFixed(2));
                groupedByMonth[m.key].totalWorksSum += Number((workSumFull * payRatio).toFixed(2));
                groupedByMonth[m.key].totalNetProfit += Number((netProfitFull * payRatio).toFixed(2));
            });

            const sortedMonthKeys = Object.keys(groupedByMonth).sort().reverse();

            sortedMonthKeys.forEach(monthKey => {
                const group = groupedByMonth[monthKey];

                const headerTr = document.createElement('tr');
                headerTr.style.background = '#f8fafc';
                headerTr.style.fontWeight = 'bold';
                headerTr.style.borderTop = '2px solid #e2e8f0';
                headerTr.style.borderBottom = '1px solid #e2e8f0';

                // Вывод итогов месяца (включая разделение запчастей и услуг)
                headerTr.innerHTML = `
                    <td colspan="${colCount}" style="padding: 10px 12px; cursor: pointer;">
                        <span style="color: #334155; margin-right: 12px;">[-] ${group.title}</span>
                        <span style="color: #64748b; font-weight: normal; margin-right: 12px;">Итого: <b style="color: #0f172a;">${group.totalSum.toFixed(2)}</b></span>
                        <span style="color: #64748b; font-weight: normal; margin-right: 12px;">Оплачено: <b style="color: #16a34a;">${group.totalPaid.toFixed(2)}</b></span>
                        <span style="color: #64748b; font-weight: normal; margin-right: 12px;">Долг: <b style="color: #dc2626;">${group.totalDebt.toFixed(2)}</b></span>
                        <span style="color: #64748b; font-weight: normal; margin-right: 12px;">Плюс запчасти: <b style="color: #0284c7;">${group.totalPartsProfit.toFixed(2)}</b></span>
                        <span style="color: #64748b; font-weight: normal; margin-right: 12px;">Услуги: <b style="color: #7c3aed;">${group.totalWorksSum.toFixed(2)}</b></span>
                        <span style="color: #64748b; font-weight: normal;">Общий плюс: <b style="color: ${group.totalNetProfit >= 0 ? '#16a34a' : '#dc2626'};">${group.totalNetProfit.toFixed(2)}</b></span>
                    </td>
                `;
                
                let isCollapsed = false;
                const rowElements = [];

                headerTr.addEventListener('click', () => {
                    isCollapsed = !isCollapsed;
                    rowElements.forEach(r => r.style.display = isCollapsed ? 'none' : '');
                    const spanTitle = headerTr.querySelector('span');
                    if (spanTitle) {
                        spanTitle.textContent = spanTitle.textContent.replace(isCollapsed ? '[-]' : '[+]', isCollapsed ? '[+]' : '[-]');
                    }
                });

                mainTableBody.appendChild(headerTr);

                group.items.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.dataset.id = item.id || item.sklad_id || item.realization_id || '';
                    tr.style.cursor = 'pointer';
                    tr.innerHTML = config.render(item);

                    tr.addEventListener('click', () => {
                        console.log('🖱️ [Клик на строку верхней таблицы]:', item);
                        document.querySelectorAll('#table-body tr').forEach(r => r.classList.remove('selected-row'));
                        tr.classList.add('selected-row');

                        selectedItem = item;

                        window.currentRealizationId = item.realization_id || item.id;

                        const tabsBlock = document.getElementById('tabs-for-money-receipts');
                        if (tabsBlock) {
                            tabsBlock.style.display = 'flex';
                        }

                        const detailToolbar = document.getElementById('detail-toolbar');
                        if (detailToolbar) {
                            const actionButtons = detailToolbar.querySelectorAll('#btn-add, #btn-edit, #btn-delete, button');
                            actionButtons.forEach(btn => {
                                if (!btn.classList.contains('money-receipt-tab-btn') && !btn.hasAttribute('data-tab')) {
                                    btn.style.display = 'none';
                                }
                            });
                        }

                        document.querySelectorAll('.money-receipt-tab-btn').forEach(btn => {
                            btn.classList.remove('active');
                            if (btn.dataset.tab === 'money_receipts_detail') btn.classList.add('active');
                        });

                        currentMoneyReceiptSubTab = 'money_receipts_detail';

                        const detailEntity = getCurrentDetailEntity();
                        let realizationId = item.realization_id || item.id || '';
                        let customerId = item.customer_id || '';
                        let skladId = item.sklad_id || window.currentSkladId || '';
                        
                        let url = '';
                        if (detailEntity === 'money_receipts_works_detail') {
                            url = `/api/money_receipts_works_detail?realization_id=${realizationId}&customer_id=${customerId}&sklad_id=${skladId}`;
                        } else {
                            url = `/api/money_receipts_detail?realization_id=${realizationId}&customer_id=${customerId}&sklad_id=${skladId}`;
                        }

                        loadReceiptDetailTable(url, detailEntity);
                    });

                    rowElements.push(tr);
                    mainTableBody.appendChild(tr);
                });
            });

        } else {
            // Обычный вывод для 1 уровня (склады) без группировки по месяцам
            currentItems.forEach(item => {
                const tr = document.createElement('tr');
                tr.dataset.id = item.id || item.sklad_id || item.realization_id || '';
                tr.style.cursor = 'pointer';
                tr.innerHTML = config.render(item);

                tr.addEventListener('click', () => {
                    console.log('🖱️ [Клик на строку верхней таблицы]:', item);
                    document.querySelectorAll('#table-body tr').forEach(r => r.classList.remove('selected-row'));
                    tr.classList.add('selected-row');

                    selectedItem = item;

                    if (currentEntity === 'money_receipts_by_sklad') {
                        loadReceiptMainData('money_receipts', item);
                    }
                });

                mainTableBody.appendChild(tr);
            });
        }

    } catch (err) {
        console.error('❌ [loadReceiptMainData ОШИБКА]:', err);
        if (mainTableBody) {
            mainTableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки данных</td></tr>`;
        }
    }
}

async function loadReceiptDetailTable(fetchUrl, subTabName = 'money_receipts_detail') {
    console.log(`🔍 [loadReceiptDetailTable] Запуск загрузки. URL: ${fetchUrl}`);
    
    const detailBody = document.getElementById('detail-body');
    const detailTitle = document.getElementById('detail-title');
    const detailHeaderTr = document.getElementById('detail-headers') || document.querySelector('#detail-container thead tr');
    
    const config = getConfig('money_receipts_detail');
    if (detailTitle && config) detailTitle.innerText = "Спецификация (Запчасти и Услуги)";

    if (detailHeaderTr && config && config.columns) {
        detailHeaderTr.innerHTML = config.columns.map(col => {
            let widthStyle = col.width ? `width: ${col.width};` : '';
            let alignStyle = col.align ? `text-align: ${col.align};` : 'text-align: left;';
            return `<th style="padding: 6px; border-bottom: 2px solid #ddd; ${widthStyle} ${alignStyle}">${col.label}</th>`;
        }).join('');
    }

    const colCount = config && config.columns ? config.columns.length : 8;
    if (detailBody) detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Загрузка позиций...</td></tr>`;

    try {
        const response = await fetch(fetchUrl);
        const responseText = await response.text();

        if (!response.ok) throw new Error('Ошибка загрузки данных');
        const data = JSON.parse(responseText);

        // Универсальное определение массива данных (поддерживает как прямой массив, так и объект с полем items)
        const items = Array.isArray(data) ? data : (data.items || []);

        if (!detailBody) return;
        if (items.length === 0) {
            detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет запчастей и услуг в этой реализации</td></tr>`;
            return;
        }

        detailBody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            
            // Если это услуга (item_type === 'work' или есть признаки работы)
            if (item.item_type === 'work' || item.is_work) {
                tr.style.backgroundColor = '#f8fafc'; // легкая подсветка для услуг
            }
            
            tr.innerHTML = config.render(item);
            detailBody.appendChild(tr);
        });
    } catch (err) {
        console.error('❌ [loadReceiptDetailTable ОШИБКА]:', err);
        if (detailBody) {
            detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки спецификации</td></tr>`;
        }
    }
}

// ==========================================
// КЛИКЕР ДЛЯ ТАБЛИЦЫ (ПРИХОДЫ И РАСХОДЫ)
// ==========================================
const tableBodyForReceipts = document.getElementById('table-body');
if (tableBodyForReceipts) {
    const newTableBody = tableBodyForReceipts.cloneNode(true);
    tableBodyForReceipts.parentNode.replaceChild(newTableBody, tableBodyForReceipts);

    newTableBody.addEventListener('click', async (e) => {
        // Проверяем, относится ли текущая сущность к приходам или расходам
        const allowedEntities = [
            'money_receipts_by_sklad', 
            'money_receipts',
            'expenses_by_sklad', 
            'expenses_by_suppliers', 
            'expenses_by_receipts'
        ];

        // Автоопределение, если currentEntity вдруг пустой или undefined, но открыт раздел расходов
        let activeEntity = typeof currentEntity !== 'undefined' ? currentEntity : window.currentEntity;
        
        if (!allowedEntities.includes(activeEntity)) {
            return;
        }

        const tr = e.target.closest('tr');
        if (!tr) return;

        const id = tr.getAttribute('data-id');

        document.querySelectorAll('#table-body tr').forEach(row => row.style.background = '');
        tr.style.background = '#e2e8f0';

        const rowsArray = Array.from(newTableBody.querySelectorAll('tr'));
        const rowIndex = rowsArray.indexOf(tr);

        let itemsSource = typeof currentItems !== 'undefined' ? currentItems : window.currentItems;

        if (rowIndex >= 0 && itemsSource && itemsSource[rowIndex]) {
            selectedItem = itemsSource[rowIndex];
        } else if (itemsSource) {
            selectedItem = itemsSource.find(i => String(i.id || i.sklad_id || i.realization_id || i.receipt_id || i.postavhik_id) === String(id));
        }
        
        if (typeof window !== 'undefined') {
            window.selectedItem = selectedItem;
            window.selectedDetailItem = null;
        }

        console.log(`📥 [КЛИК] Сущность: "${activeEntity}", ID строки: ${id}`, selectedItem);

        if (!selectedItem) {
            console.error('❌ Не удалось определить selectedItem для строки с ID:', id);
            return;
        }

        // ==========================================
        // ЛОГИКА ДЛЯ ПРИХОДОВ (money_receipts)
        // ==========================================
        if (activeEntity === 'money_receipts_by_sklad') {
            // Кликнули по складу -> открываем список документов (money_receipts) для этого склада
            loadReceiptMainData('money_receipts', selectedItem);
        } else if (activeEntity === 'money_receipts') {
            // Кликнули по конкретной реализации -> подгружаем нижнюю таблицу
            window.currentRealizationId = selectedItem.realization_id || selectedItem.id;
            
            const detailContainer = document.getElementById('detail-container');
            if (detailContainer) detailContainer.style.display = 'block';

            const activeTab = window.currentMoneyReceiptSubTab || 'money_receipts_detail';
            const activeBtn = document.querySelector('#tabs-for-money-receipts .active') || document.querySelector('#tabs-for-money-receipts button');
            
            if (typeof switchMoneyReceiptTab === 'function') {
                switchMoneyReceiptTab(activeTab, activeBtn);
            }
        }

        // ==========================================
        // ЛОГИКА ДЛЯ РАСХОДОВ (expenses)
        // ==========================================
        else if (
            activeEntity === 'expenses_by_sklad' || 
            activeEntity === 'expenses_by_suppliers' || 
            activeEntity === 'expenses_by_receipts'
        ) {
            const carTabsPanel = document.getElementById('car-tabs-panel') || document.getElementById('car-tabs-bar');
            ['tabs-for-cars', 'tabs-for-accidents', 'tabs-for-repairs', 'tabs-for-realizations'].forEach(tabId => {
                const el = document.getElementById(tabId);
                if (el) el.style.display = 'none';
            });
            if (carTabsPanel) carTabsPanel.style.display = 'none';

            const actionButtonsBar = document.querySelector('.action-buttons') || document.getElementById('action-buttons-bar');
            if (actionButtonsBar) actionButtonsBar.style.display = 'none';

            if (activeEntity === 'expenses_by_sklad') {
                if (typeof loadExpenseMainData === 'function') {
                    loadExpenseMainData('expenses_by_suppliers', selectedItem);
                }
            } else if (activeEntity === 'expenses_by_suppliers') {
                if (typeof loadExpenseMainData === 'function') {
                    loadExpenseMainData('expenses_by_receipts', selectedItem);
                }
            } else if (activeEntity === 'expenses_by_receipts') {
                let receiptId = selectedItem.receipt_id || selectedItem.id || id;
                if (receiptId) {
                    window.currentReceiptId = receiptId;
                }

                let skladId = window.currentSkladId || '';
                let postavhikId = window.currentPostavhikId || '';
                let currentReceipt = window.currentReceiptId || '';

                const fetchUrl = `/api/expense_items?receipt_id=${currentReceipt}&postavhik_id=${postavhikId}&sklad_id=${skladId}`;
                
                const detailContainer = document.getElementById('detail-container');
                if (detailContainer) detailContainer.style.display = 'flex';

                if (typeof loadExpenseDetailTable === 'function') {
                    loadExpenseDetailTable(fetchUrl);
                } else {
                    console.error('❌ Функция loadExpenseDetailTable не найдена!');
                }
            }
        }
    });
}




function emptyDetailBody(entity) {
    const detailBody = document.getElementById('detail-body');
    if (!detailBody) return;

    // Получаем конфигурацию для текущей сущности
    const config = getConfig(entity);
    
    // Считаем только те колонки, у которых не стоит table: false
    const visibleColumnsCount = config.columns 
        ? config.columns.filter(col => col.table !== false).length 
        : 1; // Дефолт на случай отсутствия конфига

    detailBody.innerHTML = `<tr><td colspan="${visibleColumnsCount}" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>`;
}

function filterTable() {
    const filterInputs = document.querySelectorAll('#table-filter-row input[data-column]');
    const filters = {};

    filterInputs.forEach(input => {
        const field = input.getAttribute('data-column');
        const val = input.value.trim().toLowerCase();
        if (val) {
            filters[field] = val;
        }
    });

    const rows = document.querySelectorAll('#table-body tr');

    rows.forEach(row => {
        let isVisible = true;
        const id = row.getAttribute('data-id');
        const item = currentItems.find(i => i.id == id);

        if (!item) return;

        for (const field in filters) {
            const cellValue = String(item[field] !== undefined && item[field] !== null ? item[field] : '').toLowerCase();
            
            const cells = Array.from(row.children);
            const config = getConfig(currentEntity);
            const colIndex = config.columns.findIndex(c => c.field === field);
            
            let match = cellValue.includes(filters[field]);
            if (!match && colIndex !== -1 && cells[colIndex]) {
                match = cells[colIndex].textContent.toLowerCase().includes(filters[field]);
            }

            if (!match) {
                isVisible = false;
                break;
            }
        }

        row.style.display = isVisible ? '' : 'none';
    });
}

let selectedDetailItem = null;
let currentDetailItems = []; 

function getCurrentDetailEntity() {
    console.log(`🔍 [getCurrentDetailEntity] Определение детальной сущности для currentEntity: "${currentEntity}"`);

    if (currentEntity === 'moves') {
        const res = 'move_items';
        console.log(`📌 [getCurrentDetailEntity] Результат для moves: ${res}`);
        return res;
    }
    if (currentEntity === 'receipts') {
        const res = 'receipt_items';
        console.log(`📌 [getCurrentDetailEntity] Результат для receipts: ${res}`);
        return res;
    }
    if (currentEntity === 'expenses' || currentEntity === 'expense_items') {
        const res = 'expense_items';
        console.log(`📌 [getCurrentDetailEntity] Результат для expenses/expense_items: ${res}`);
        return res;
    }

    if (currentEntity === 'expenses_by_sklad') {
        const res = ''; 
        console.log(`📌 [getCurrentDetailEntity] Результат для expenses_by_sklad: (пусто)`);
        return res;
    }
    if (currentEntity === 'expenses_by_suppliers') {
        const res = ''; 
        console.log(`📌 [getCurrentDetailEntity] Результат для expenses_by_suppliers: (пусто)`);
        return res;
    }
    if (currentEntity === 'expenses_by_receipts') {
        const res = 'expense_items'; 
        console.log(`📌 [getCurrentDetailEntity] Результат для expenses_by_receipts: ${res}`);
        return res;
    }

    if (currentEntity === 'cars') {
        const res = 'car_details';
        console.log(`📌 [getCurrentDetailEntity] Результат для cars: ${res}`);
        return res;
    }
    if (currentEntity === 'stock_balances') {
        const res = 'stock_batches'; 
        console.log(`📌 [getCurrentDetailEntity] Результат для stock_balances: ${res}`);
        return res;
    }
    if (currentEntity === 'stock_movement') {
        const res = 'part_movement_details'; 
        console.log(`📌 [getCurrentDetailEntity] Результат для stock_movement: ${res}`);
        return res;
    }
    if (currentEntity === 'postavhik') {
        const res = 'postavhik_contacts'; 
        console.log(`📌 [getCurrentDetailEntity] Результат для postavhik: ${res}`);
        return res;
    }
    if (currentEntity === 'counterparties') {
        const res = 'counterparty_contacts'; 
        console.log(`📌 [getCurrentDetailEntity] Результат для counterparties: ${res}`);
        return res;
    }
    if (currentEntity === 'money_receipts_by_sklad') {
        const res = ''; 
        console.log(`📌 [getCurrentDetailEntity] Результат для money_receipts_by_sklad: (пусто)`);
        return res;
    }

    if (currentEntity === 'money_receipts') {
        // 1. Сначала проверяем реальный активный таб в DOM, чтобы не залипать на старой переменной
        const activeTab = document.querySelector('#tabs-for-money-receipts button.active, #tabs-for-money-receipts .active');
        if (activeTab) {
            const dataTab = activeTab.getAttribute('data-tab');
            if (dataTab) {
                console.log(`🔘 [getCurrentDetailEntity:money_receipts] Найден data-tab у активной кнопки: ${dataTab}`);
                if (dataTab === 'realization_works' || dataTab === 'money_receipts_works_detail') return 'money_receipts_works_detail';
                if (dataTab === 'realization_items' || dataTab === 'money_receipts_detail') return 'money_receipts_detail';
                return dataTab;
            }
        }

        // 2. Если в DOM ничего не подсвечено, смотрим на глобальную переменную
        if (typeof currentMoneyReceiptSubTab !== 'undefined' && currentMoneyReceiptSubTab) {
            console.log(`⚙️ [getCurrentDetailEntity:money_receipts] Найдено через currentMoneyReceiptSubTab: ${currentMoneyReceiptSubTab}`);
            if (currentMoneyReceiptSubTab === 'realization_works') return 'money_receipts_works_detail';
            if (currentMoneyReceiptSubTab === 'realization_items') return 'money_receipts_detail';
            return currentMoneyReceiptSubTab;
        }

        if (activeTab) {
            const text = activeTab.innerText.trim().toLowerCase();
            if (text.includes('услуг') || text.includes('работ')) {
                console.log(`📝 [getCurrentDetailEntity:money_receipts] Определено по тексту кнопки (услуг/работ): money_receipts_works_detail`);
                return 'money_receipts_works_detail';
            }
            if (text.includes('запчаст')) {
                console.log(`📝 [getCurrentDetailEntity:money_receipts] Определено по тексту кнопки (запчаст): money_receipts_detail`);
                return 'money_receipts_detail';
            }

            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/(?:loadDetailData|switchMoneyReceiptTab)\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                console.log(`🔗 [getCurrentDetailEntity:money_receipts] Определено по onclick: ${match[1]}`);
                if (match[1] === 'realization_works') return 'money_receipts_works_detail';
                if (match[1] === 'realization_items') return 'money_receipts_detail';
                return match[1];
            }
        }

        const activeText = document.querySelector('#tabs-for-money-receipts button.active')?.innerText || '';
        if (activeText.toLowerCase().includes('услуг') || activeText.toLowerCase().includes('работ')) {
            console.log(`📝 [getCurrentDetailEntity:money_receipts] Определено по запасной проверке текста: money_receipts_works_detail`);
            return 'money_receipts_works_detail';
        }

        console.log(`📌 [getCurrentDetailEntity:money_receipts] Возвращаем дефолтное значение: money_receipts_detail`);
        return 'money_receipts_detail';
    }

    if (currentEntity === 'realizations') {
        const activeTab = document.querySelector('#tabs-for-realizations button.active, #tabs-for-realizations .active');
        if (activeTab) {
            const dataTab = activeTab.getAttribute('data-tab');
            if (dataTab) {
                console.log(`🔘 [getCurrentDetailEntity:realizations] Найден data-tab: ${dataTab}`);
                return dataTab;
            }
        }

        if (typeof currentRealizationSubTab !== 'undefined' && currentRealizationSubTab) {
            console.log(`⚙️ [getCurrentDetailEntity:realizations] Найден currentRealizationSubTab: ${currentRealizationSubTab}`);
            return currentRealizationSubTab;
        }

        if (activeTab) {
            const text = activeTab.innerText.trim().toLowerCase();
            if (text.includes('услуг') || text.includes('работ')) {
                console.log(`📝 [getCurrentDetailEntity:realizations] По тексту -> realization_works`);
                return 'realization_works';
            }
            if (text.includes('запчаст')) {
                console.log(`📝 [getCurrentDetailEntity:realizations] По тексту -> realization_items`);
                return 'realization_items';
            }

            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/(?:loadDetailData|switchRealizationTab)\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                console.log(`🔗 [getCurrentDetailEntity:realizations] По onclick -> ${match[1]}`);
                return match[1];
            }
        }

        const activeText = document.querySelector('#tabs-for-realizations button.active')?.innerText || '';
        if (activeText.toLowerCase().includes('услуг') || activeText.toLowerCase().includes('работ')) {
            return 'realization_works';
        }

        console.log(`📌 [getCurrentDetailEntity:realizations] Дефолт -> realization_items`);
        return 'realization_items'; 
    }

    if (currentEntity === 'customers') {
        const activeTab = document.querySelector('#tabs-for-customers button.active, #tabs-for-customers .active');
        if (activeTab) {
            const dataTab = activeTab.getAttribute('data-tab');
            if (dataTab) return dataTab;
        }

        if (typeof currentCustomerSubTab !== 'undefined' && currentCustomerSubTab) return currentCustomerSubTab;

        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/(?:loadDetailData|switchCustomerTab)\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'customer_contacts'; 
    }

    if (currentEntity === 'accidents') {
        const activeTab = document.querySelector('#tabs-for-accidents button.active, #tabs-for-accidents .active');
        if (activeTab) {
            const dataTab = activeTab.getAttribute('data-tab');
            if (dataTab) return dataTab;
        }

        if (typeof currentAccidentSubTab !== 'undefined' && currentAccidentSubTab) return currentAccidentSubTab;

        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/(?:loadDetailData|switchAccidentTab)\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'accident_invoices'; 
    }

    if (currentEntity === 'repairs') {
        const activeTab = document.querySelector('#tabs-for-repairs button.active, #tabs-for-repairs .active');
        if (activeTab) {
            const dataTab = activeTab.getAttribute('data-tab');
            if (dataTab) return dataTab;
        }

        if (typeof currentRepairSubTab !== 'undefined' && currentRepairSubTab) return currentRepairSubTab;

        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/(?:loadDetailData|switchRepairTab)\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'repair_items'; 
    }

    if (currentEntity === 'car_cards') {
        const activeTab = document.querySelector('#tabs-for-cars button.active, #tabs-for-cars .active');
        if (activeTab) {
            const dataTab = activeTab.getAttribute('data-tab');
            if (dataTab) return dataTab;
        }

        if (typeof currentCarSubTab !== 'undefined' && currentCarSubTab) return currentCarSubTab;

        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/loadDetailData\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'tehosmotr';
    }
    
    console.log(`📌 [getCurrentDetailEntity] Неизвестная сущность "${currentEntity}", возвращаем дефолт: receipt_items`);
    return 'receipt_items';
}


function openDetailForm(mode) {
    if (!selectedItem) {
        showAppNotification('Сначала выберите документ в верхней таблице!', 'warning');
        return;
    }
    
    if (mode === 'edit' && !selectedDetailItem) {
        showAppNotification('Выберите строку в спецификации для изменения!', 'warning');
        return;
    }

    const itemToEdit = mode === 'edit' ? selectedDetailItem : null;
    const detailEntity = getCurrentDetailEntity();
    
    if (detailEntity === 'car_details') {
        openCarDetailsForm(detailEntity, itemToEdit, selectedItem.id);
    } else if (detailEntity === 'accident_images') {
        openAccidentImageForm(detailEntity, itemToEdit, selectedItem.id);
    } else {
        openEntityForm(detailEntity, itemToEdit, selectedItem.id);
    }
}
async function deleteDetailItem() {
    if (!selectedDetailItem) {
        showAppNotification('Выберите строку в спецификации для удаления!', 'warning');
        return;
    }

    showConfirmModal(
        'Подтверждение удаления',
        'Вы уверены, что хотите удалить эту позицию?',
        async () => {
            const detailEntity = getCurrentDetailEntity();

            const currentUserId = localStorage.getItem('currentUserId') || '';

            try {
                const response = await fetch(`/api/${detailEntity}/${selectedDetailItem.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': currentUserId 
                    }
                });

                const resultData = await response.json().catch(() => ({}));

                if (response.ok) {
                    selectedDetailItem = null; 
                    showAppNotification('Позиция успешно удалена', 'success');
                    loadDetailData(detailEntity, selectedItem.id);
                } else {
                    showAppNotification(resultData.error || 'Ошибка при удалении позиции', 'error');
                }
            } catch (err) {
                console.error('Ошибка соединения:', err);
                showAppNotification('Ошибка соединения с сервером', 'error');
            }
        }
    );
}


function showPostConfirmModal(title, text, onConfirm) {
    const existingModal = document.getElementById('custom-post-confirm-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'custom-post-confirm-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; 
        align-items: center; z-index: 10000; backdrop-filter: blur(2px);
    `;

    modal.innerHTML = `
        <div style="background: #fff; padding: 24px; border-radius: 12px; width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-family: inherit;">
            <h3 style="margin: 0 0 10px 0; font-size: 18px; color: #333;">${title}</h3>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.5;">${text}</p>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="post-modal-btn-cancel" style="padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Отмена</button>
                <button id="post-modal-btn-ok" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">Провести</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('post-modal-btn-cancel').onclick = () => modal.remove();
    document.getElementById('post-modal-btn-ok').onclick = () => {
        modal.remove();
        if (typeof onConfirm === 'function') onConfirm();
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}


async function postTehosmotr(id) {
    try {
        const response = await fetch(`/api/tehosmotr/${id}/post`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            showAppNotification('Техосмотр успешно проведен', 'success');
            refreshData();
        } else {
            const err = await response.json().catch(() => ({}));
            showAppNotification(err.error || 'Ошибка при проведении документа', 'error');
        }
    } catch (e) {
        console.error('Ошибка соединения:', e);
        showAppNotification('Ошибка соединения с сервером', 'error');
    }
}


async function postAutostrahovanie(id) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести этот документ страхования?',
        async () => {
            try {
                const response = await fetch(`/api/autostrahovanie/${id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        is_posted: true, 
                        fact_date: new Date().toISOString() 
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Ошибка при проведении документа');
                }

                showAppNotification('Документ страхования успешно проведен', 'success');
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification('Не удалось провести документ: ' + err.message, 'error');
            }
        }
    );
}


async function postMove(moveId) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести это перемещение?',
        async () => {
            try {
                const response = await fetch(`/api/moves/${moveId}/post`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ is_posted: true })
                });

                if (!response.ok) throw new Error('Ошибка при проведении перемещения');

                showAppNotification('Перемещение успешно проведено', 'success');
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification('Не удалось провести перемещение', 'error');
            }
        }
    );
}

async function postReceipt(receiptId) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести этот документ прихода?',
        async () => {
            try {
                const response = await fetch(`/api/receipts/${receiptId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ is_posted: true })
                });

                if (!response.ok) throw new Error('Ошибка при проведении документа');

                showAppNotification('Документ прихода успешно проведен', 'success');
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification('Не удалось провести документ', 'error');
            }
        }
    );
}


const tableBody = document.getElementById('table-body');
if (tableBody) {
    tableBody.addEventListener('click', async (e) => {
        // Если это сейчас расходы — этот общий обработчик не должен вмешиваться (их обрабатывает отдельный кликер)
        if (
            currentEntity === 'expenses_by_sklad' || 
            currentEntity === 'expenses_by_suppliers' || 
            currentEntity === 'expenses_by_receipts'
        ) {
            return;
        }

        const tr = e.target.closest('tr');
        if (!tr) return;
        
        // Отладка
        if (!e.isTrusted) {
            console.warn('⚠️ ВНИМАНИЕ: Сработал программный (искусственный) клик для сущности:', currentEntity);
        }
        
        document.querySelectorAll('#table-body tr').forEach(row => row.style.background = '');
        tr.style.background = '#e2e8f0';

        const id = tr.getAttribute('data-id');
        
        // Универсальный поиск элемента с поддержкой разных вариантов ID
        selectedItem = currentItems.find(i => String(i.id || i.receipt_id || i.sklad_id || i.postavhik_id || i.move_id) === String(id));

        if (!selectedItem) {
            const rowIndex = Array.from(tr.parentNode.children).indexOf(tr);
            if (rowIndex >= 0 && currentItems[rowIndex]) {
                selectedItem = currentItems[rowIndex];
            }
        }
        
        selectedDetailItem = null;  

        console.log(`👆 [КЛИК В ТАБЛИЦЕ] Сущность: "${currentEntity}", ID строки: ${id}`, selectedItem);

        const carTabsPanel = document.getElementById('car-tabs-panel') || document.getElementById('car-tabs-bar');
        const tabsForCars = document.getElementById('tabs-for-cars');
        const tabsForAccidents = document.getElementById('tabs-for-accidents');
        const tabsForRepairs = document.getElementById('tabs-for-repairs'); 
        const tabsForRealizations = document.getElementById('tabs-for-realizations');
        const detailContainer = document.getElementById('detail-container');

        const actionButtonsBar = document.querySelector('.action-buttons') || document.getElementById('action-buttons-bar');
        if (actionButtonsBar) {
            if (
                currentEntity === 'stock_remains' || 
                currentEntity === 'stock' || 
                currentEntity === 'stock_movement' ||
                currentEntity === 'stock_balances' ||
                currentEntity === 'stock_batches' ||
                currentEntity === 'part_movement_details' ||
                currentEntity === 'car_general' ||
                currentEntity === 'car_cards'
            ) {
                actionButtonsBar.style.display = 'none';
            } else {
                actionButtonsBar.style.display = 'flex';
            }
        }

        if (selectedItem) {
            const itemId = selectedItem.id || selectedItem.receipt_id || selectedItem.sklad_id || selectedItem.postavhik_id || id;

            if (currentEntity === 'cars') {
                if (carTabsPanel) carTabsPanel.style.display = 'none';
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (detailContainer) detailContainer.style.display = 'flex';
                loadDetailData('car_details', itemId);
            } else if (currentEntity === 'car_card' || currentEntity === 'car_cards') {
                if (carTabsPanel) carTabsPanel.style.display = 'flex';
                if (tabsForCars) tabsForCars.style.display = 'flex';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (detailContainer) detailContainer.style.display = 'flex';
                
                const activeCarTab = document.querySelector('.car-tab-btn.active') || document.querySelector('.car-tab-btn');
                if (activeCarTab) {
                    const onclickAttr = activeCarTab.getAttribute('onclick');
                    const match = onclickAttr && onclickAttr.match(/'([^']+)'/);
                    if (match && match[1]) {
                        loadDetailData(match[1], itemId);
                    } else {
                        loadDetailData('car_general', itemId);
                    }
                } else {
                    loadDetailData('car_general', itemId);
                }
            } else if (currentEntity === 'accidents') {
                if (carTabsPanel) carTabsPanel.style.display = 'flex';
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'flex';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (detailContainer) detailContainer.style.display = 'flex';

                const activeAccidentTab = document.querySelector('.accident-tab-btn.active') || document.querySelector('.accident-tab-btn');
                const match = activeAccidentTab && activeAccidentTab.getAttribute('onclick')?.match(/'([^']+)'/);
                const subTab = match ? match[1] : 'accident_invoices';
                if (typeof currentAccidentSubTab !== 'undefined') currentAccidentSubTab = subTab;
                loadDetailData(subTab, itemId);
            } else if (currentEntity === 'repairs') {
                if (carTabsPanel) carTabsPanel.style.display = 'flex';
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'flex';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (detailContainer) detailContainer.style.display = 'flex';

                const activeRepairTab = document.querySelector('.repair-tab-btn.active') || document.querySelector('.repair-tab-btn');
                const match = activeRepairTab && activeRepairTab.getAttribute('onclick')?.match(/'([^']+)'/);
                const subTab = match ? match[1] : 'repair_items';
                if (typeof currentRepairSubTab !== 'undefined') currentRepairSubTab = subTab;
                loadDetailData(subTab, itemId);
            } else if (currentEntity === 'realizations') {
                if (carTabsPanel) carTabsPanel.style.display = 'flex';
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'flex';
                if (detailContainer) detailContainer.style.display = 'flex';

                const realizationsTabs = document.getElementById('tabs-for-realizations');
                if (realizationsTabs) realizationsTabs.style.display = 'flex';

                const activeRealizationTab = document.querySelector('#tabs-for-realizations button.active, #tabs-for-realizations .realization-tab-btn.active') || document.querySelector('#tabs-for-realizations button, #tabs-for-realizations .realization-tab-btn');
                const subTabName = activeRealizationTab ? (activeRealizationTab.getAttribute('data-tab') || 'realization_items') : 'realization_items';
                if (typeof currentRealizationSubTab !== 'undefined') currentRealizationSubTab = subTabName;
                loadDetailData(subTabName, itemId);
            } else {
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';

                if (carTabsPanel) {
                    carTabsPanel.style.display = (currentEntity === 'receipts' || currentEntity === 'moves' || currentEntity === 'customers') ? 'flex' : 'none';
                }

                if (currentEntity === 'receipts') {
                    if (detailContainer) detailContainer.style.display = 'flex';
                    loadDetailData('receipt_items', itemId);
                } else if (currentEntity === 'moves') {
                    if (detailContainer) detailContainer.style.display = 'flex';
                    loadDetailData('move_items', itemId);
                } else if (currentEntity === 'postavhik') {
                    if (detailContainer) detailContainer.style.display = 'flex';
                    loadDetailData('postavhik_contacts', itemId);
                } else if (currentEntity === 'counterparties') {
                    if (detailContainer) detailContainer.style.display = 'flex';
                    loadDetailData('counterparty_contacts', itemId);
                } else if (currentEntity === 'customers') {
                    if (detailContainer) detailContainer.style.display = 'flex';
                    loadDetailData('customer_contacts', itemId);
                }
            }
        }
    });
}



tableBody.addEventListener('dblclick', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;

    if (tr.querySelector('td[colspan]')) {
        return;
    }

    const isInsideDetail = e.target.closest('#detail-container') || 
                           e.target.closest('#car-tabs-panel') || 
                           e.target.closest('#car-tabs-bar');
    
    if (isInsideDetail) {
        return; 
    }

    if (
        currentEntity === 'stock_remains' || 
        currentEntity === 'stock' || 
        currentEntity === 'stock_movement' ||
        currentEntity === 'stock_balances' ||
        currentEntity === 'stock_batches' ||
        currentEntity === 'part_movement_details' ||
        currentEntity === 'car_cards' ||
        currentEntity === 'car_general' ||
        currentEntity === 'car_tehosmotr' ||
        currentEntity === 'car_autostrahovanie' ||
        currentEntity === 'car_accidents' ||
        currentEntity === 'dtp_history' ||
        currentEntity === 'repair_history' ||
        currentEntity === 'money_receipts' ||
        currentEntity === 'money_receipts_by_sklad' ||
        currentEntity === 'money_receipts_detail'
    ) {
        return; 
    }

    const id = tr.getAttribute('data-id');
    const item = currentItems.find(i => i.id == id);
    if (item) {
        selectedItem = item;
        if (currentEntity === 'realizations') {
            openRealizationForm(currentEntity, item);
        } else {
            openEntityForm(currentEntity, item);
        }
    }
});
let currentCustomerSubTab = 'customer_contacts';

function switchCustomerTab(tabName, btnElement) {
    currentCustomerSubTab = tabName; 

    const container = document.getElementById('tabs-for-customers');
    if (container) {
        container.querySelectorAll('.customer-tab-btn').forEach(b => b.classList.remove('active'));
    }
    if (btnElement) {
        btnElement.classList.add('active');
    }

    const detailToolbar = document.getElementById('detail-toolbar');
    if (detailToolbar) {
        detailToolbar.style.display = 'flex';
    }

    if (selectedItem && selectedItem.id) {
        loadDetailData(tabName, selectedItem.id);
    } else {
        const detailBody = document.getElementById('detail-body');
        if (detailBody) {
            detailBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #888; padding: 20px;">Выберите покупателя в верхней таблице</td></tr>`;
        }
    }
}

function switchRealizationTab(tabName, btnElement) {
    currentRealizationSubTab = tabName;

    const container = document.getElementById('tabs-for-realizations');
    if (container) {
        container.querySelectorAll('.realization-tab-btn').forEach(btn => btn.classList.remove('active'));
    }
    if (btnElement) {
        btnElement.classList.add('active');
    }

    const detailToolbar = document.getElementById('detail-toolbar');
    if (detailToolbar) {
        detailToolbar.style.display = 'flex';
    }

    if (selectedItem && selectedItem.id) {
        loadDetailData(tabName, selectedItem.id);
    } else {
        const detailBody = document.getElementById('detail-body');
        if (detailBody) {
            detailBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #888; padding: 20px;">Выберите реализацию в верхней таблице</td></tr>`;
        }
    }
}

function switchCarTab(tabName, btnElement) {
    document.querySelectorAll('.car-tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    }

    const detailToolbar = document.getElementById('detail-toolbar');
    if (detailToolbar) {
        detailToolbar.style.display = 'none';
    }

    if (selectedItem && selectedItem.id) {
        loadDetailData(tabName, selectedItem.id);
    }
}

let currentRepairSubTab = 'repair_items';


function switchAccidentTab(tabName, btnElement) {
    currentAccidentSubTab = tabName;

    const container = document.getElementById('tabs-for-accidents');
    if (container) {
        container.querySelectorAll('.accident-tab-btn').forEach(btn => btn.classList.remove('active'));
    }
    if (btnElement) {
        btnElement.classList.add('active');
    }

    const detailToolbar = document.getElementById('detail-toolbar');
    if (detailToolbar) {
        detailToolbar.style.display = 'flex';
    }

    if (selectedItem && selectedItem.id) {
        loadDetailData(tabName, selectedItem.id);
    } else {
        const detailBody = document.getElementById('detail-body');
        if (detailBody) {
            detailBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #888; padding: 20px;">Выберите ДТП в верхней таблице</td></tr>`;
        }
    }
}

function switchRepairTab(tabName, btnElement) {
    currentRepairSubTab = tabName; 

    const container = document.getElementById('tabs-for-repairs');
    if (container) {
        container.querySelectorAll('.repair-tab-btn').forEach(b => b.classList.remove('active'));
    }
    if (btnElement) {
        btnElement.classList.add('active');
    }

    const detailToolbar = document.getElementById('detail-toolbar');
    if (detailToolbar) {
        detailToolbar.style.display = 'flex';
    }

    if (selectedItem && selectedItem.id) {
        loadDetailData(tabName, selectedItem.id);
    } else {
        const detailBody = document.getElementById('detail-body');
        if (detailBody) {
            detailBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #888; padding: 20px;">Выберите ремонт в верхней таблице</td></tr>`;
        }
    }
}
let currentMoneyReceiptSubTab = 'money_receipts_detail';



    const detailBody = document.getElementById('detail-body');

    if (detailBody) {
        detailBody.addEventListener('click', (e) => {
            const tr = e.target.closest('tr');
            if (!tr) return;
            
        document.querySelectorAll('#detail-body tr').forEach(row => row.style.background = '');
        tr.style.background = '#e2e8f0';

        const id = tr.getAttribute('data-id');
        selectedDetailItem = currentDetailItems.find(i => i.id == id);
    });

    detailBody.addEventListener('dblclick', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        
        const id = tr.getAttribute('data-id');
        const item = currentDetailItems.find(i => i.id == id);
        if (item) {
            selectedDetailItem = item;
            openDetailForm('edit'); 
        }
    });
}
async function loadDetailData(entity, parentId) {
    console.log(`🚀 [loadDetailData] СТАРТ загрузки деталей: entity="${entity}", parentId:`, parentId);

    const actionButtonsBar = document.querySelector('.action-buttons') || document.getElementById('action-buttons-bar');
    if (actionButtonsBar) {
        const readOnlyEntities = [
            'stock_movement', 
            'part_movement_details', 
            'stock_batches', 
            'stock_balances', 
            'car_general'
        ];

        if (readOnlyEntities.includes(entity)) {
            actionButtonsBar.style.display = 'none';
        } else {
            actionButtonsBar.style.display = 'flex';
        }
    }

    let activeEntity = entity;
    console.log(`📌 [loadDetailData] activeEntity определен как: "${activeEntity}"`);

    let cleanParentId = parentId;
    const skipObjectCleaning = ['stock_batches', 'part_movement_details'];
    
    if (parentId && typeof parentId === 'object' && !skipObjectCleaning.includes(entity) && !skipObjectCleaning.includes(activeEntity)) {
        cleanParentId = parentId.id || parentId.realization_id || parentId.receipt_id || parentId.customer_id || parentId.car_id || parentId.repair_id || parentId.move_id || parentId.dtp_id || parentId.accident_id || parentId.id_accident || '';
    }
    console.log(`🧹 [loadDetailData] cleanParentId:`, cleanParentId);

    let checkEntity = entity;

    const configCheck = getConfig(checkEntity); 
    const tbodyCheck = document.getElementById('detail-body');
    const visibleColsCheck = configCheck && configCheck.columns ? configCheck.columns.filter(col => col.table !== false) : [];
    const colCountCheck = visibleColsCheck.length > 0 ? visibleColsCheck.length : 1;

    const allowedWithoutId = ['stock_balances'];
    
    const hasValidParam = parentId && (typeof parentId === 'object' || String(parentId).trim() !== '');
    if (!hasValidParam && !allowedWithoutId.includes(entity) && !allowedWithoutId.includes(activeEntity)) {
        console.warn(`⚠️ [loadDetailData] Отменено: нет валидного ID или параметра для сущности "${entity}"`);
        if (tbodyCheck) {
            tbodyCheck.innerHTML = `<tr><td colspan="${colCountCheck}" style="text-align: center; color: #888; padding: 20px;">Выберите элемент в верхней таблице</td></tr>`;
        }
        return;
    }

    const config = getConfig(activeEntity); 
    const tbody = document.getElementById('detail-body');
    const headerTr = document.getElementById('detail-headers'); 
    
    let queryParamName = 'receipt_id';
    let fetchUrl = '';

    if (entity === 'move_items') {
        queryParamName = 'move_id';
    } else if (entity === 'realization_items' || entity === 'realization_payments' || entity === 'realizations' || entity === 'realization_works') {
        queryParamName = 'realization_id';
    } else if (entity === 'repair_items' || entity === 'repair_works') {
        queryParamName = 'repair_id'; 
    } else if (entity === 'accident_invoices' || entity === 'accident_payments' || entity === 'accident_events' || entity === 'accident_items') {
        queryParamName = 'dtp_id'; 
    } else if (entity === 'accident_images') {
        const isCarContext = document.getElementById('detail-title')?.innerText.includes('Автомобиль') || window.currentMainEntity === 'car_details';
        queryParamName = isCarContext ? 'car_id' : 'accident_id'; 
    } else if (entity === 'stock_batches') {
        let zId = parentId && typeof parentId === 'object' ? (parentId.zaphasti_id || parentId.id) : '';
        let wId = parentId && typeof parentId === 'object' ? (parentId.warehouse_id || parentId.sklad_id || parentId.id_sklad) : '';
        
        if (typeof parentId === 'string' && parentId.includes(':')) {
            const parts = parentId.split(':');
            zId = parts[0];
            wId = parts[1];
        }
        fetchUrl = `/api/stock_batches?zaphasti_id=${zId}&warehouse_id=${wId}`;
    } else if (entity === 'part_movement_details') {
        let zId = parentId && typeof parentId === 'object' ? (parentId.zaphasti_id || parentId.id) : '';
        let wId = parentId && typeof parentId === 'object' ? (parentId.warehouse_id || parentId.sklad_id || parentId.id_sklad) : '';
        
        if (typeof parentId === 'string' && parentId.includes(':')) {
            const parts = parentId.split(':');
            zId = parts[0];
            wId = parts[1];
        }

        const startDate = document.getElementById('movement-start-date')?.value || '';
        const endDate = document.getElementById('movement-end-date')?.value || '';

        fetchUrl = `/api/part_movement_details?zaphasti_id=${zId}&warehouse_id=${wId}&start_date=${startDate}&end_date=${endDate}`;
    } else if (entity === 'postavhik_contacts') {
        queryParamName = 'postavhik_id';
    } else if (entity === 'counterparty_contacts') {
        queryParamName = 'counterparty_id';
    } else if (entity === 'customer_contacts' || entity === 'customer_cars') {
        queryParamName = 'customer_id';
    } else if (entity === 'repairs' || entity === 'repair_history' || entity === 'car_general' || entity === 'fuel' || entity === 'insurance' || entity === 'inspections' || entity === 'accidents' || entity === 'wear' || entity === 'tehosmotr' || entity === 'car_autostrahovanie' || entity === 'car_tehosmotr' || entity === 'car_accidents' || entity === 'dtp_history' || entity === 'car_details') {
        queryParamName = 'car_id';
    }

    if (!fetchUrl) {
        if (entity === 'accident_images') {
            const isCarContext = document.getElementById('detail-title')?.innerText.includes('Автомобиль') || window.currentMainEntity === 'car_details';
            if (isCarContext) {
                fetchUrl = `/api/accident_images?car_id=${cleanParentId}`;
            } else {
                fetchUrl = `/api/accident_images?accident_id=${cleanParentId}`;
            }
        } else {
            fetchUrl = `/api/${entity}?${queryParamName}=${cleanParentId}`;
        }
    }
    
    console.log(`🌐 [loadDetailData] Сформированный fetchUrl: ${fetchUrl}`);

    const thead = headerTr ? headerTr.closest('thead') : null;
    
    const existingFilterRow = document.getElementById('detail-filter-row');
    if (existingFilterRow) {
        console.warn(`🧹 [loadDetailData] Найден старый #detail-filter-row. Удаляем его, чтобы избежать наложения инпутов!`);
        existingFilterRow.remove();
    }

    let filterRow = null;
    const visibleColumns = config && config.columns ? config.columns.filter(col => col.table !== false) : [];
    const colCount = visibleColumns.length > 0 ? visibleColumns.length : 1;

    console.log(`📊 [loadDetailData] Колонок для активной сущности "${activeEntity}": ${visibleColumns.length}`, visibleColumns.map(c => c.field));

    if (['car_id', 'dtp_id', 'repair_id', 'accident_id'].includes(queryParamName) && activeEntity !== 'accident_images') {
        if (thead && visibleColumns.length > 0) {
            filterRow = document.createElement('tr');
            filterRow.id = 'detail-filter-row';
            filterRow.innerHTML = visibleColumns.map(col => {
                let widthStyle = col.width ? `width: ${col.width};` : '';
                return `
                    <th style="padding: 4px; border-bottom: 1px solid #ddd; ${widthStyle}">
                        <input type="text" 
                               data-column="${col.field}" 
                               oninput="filterDetailTable()" 
                               style="width: 100%; padding: 4px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                    </th>
                `;
            }).join('');
            thead.insertBefore(filterRow, headerTr);
            console.log(`✅ [loadDetailData] Создан новый #detail-filter-row с ${visibleColumns.length} инпутами.`);
        }
    }

    if (headerTr && visibleColumns.length > 0) {
        headerTr.innerHTML = visibleColumns.map(col => {
            let widthStyle = col.width ? `width: ${col.width};` : '';
            let alignStyle = col.align ? `text-align: ${col.align};` : 'text-align: left;';
            return `<th style="padding: 6px; border-bottom: 1px solid #ddd; ${widthStyle} ${alignStyle}">${col.label}</th>`;
        }).join('');
    }

    try {
        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`Ошибка загрузки деталей (Статус: ${response.status})`);
        
        const items = await response.json();
        console.log(`📦 [loadDetailData] Получены детальные данные для "${activeEntity}". Строк: ${items.length}`, items);
        
        currentDetailItems = items; 
        selectedDetailItem = null;  
        
        const entityTitles = {
            accident_invoices: 'Счета / Расходы',
            accident_payments: 'Выплаты',
            accident_events: 'Хронология событий',
            accident_items: 'Поврежденные элементы',
            accident_images: 'Изображения ДТП',
            repair_items: 'Список запчастей',
            repair_works: 'Виды работ',
            receipt_items: 'Спецификация прихода',
            move_items: 'Спецификация перемещения',
            realization_items: 'Спецификация реализации',
            realization_works: 'Спецификация услуг',
            realization_payments: 'Платежи реализации',
            postavhik_contacts: 'Контакты поставщика',
            counterparty_contacts: 'Контакты контрагента',
            customer_contacts: 'Контакты клиента',
            customer_cars: 'Автомобили клиента',
            car_details: 'Детали автомобиля'
        };
        const prettyEntityName = entityTitles[activeEntity] || entityTitles[entity] || config.title || activeEntity;

        const titleElement = document.getElementById('detail-title');
        if (titleElement) {
            if (queryParamName === 'car_id') {
                titleElement.innerText = `Автомобиль (ID: ${cleanParentId}) — ${prettyEntityName} | Записей: ${items.length}`;
            } else if (['dtp_id', 'accident_id'].includes(queryParamName)) {
                titleElement.innerText = `ДТП (ID: ${cleanParentId}) — ${prettyEntityName} | Записей: ${items.length}`;
            } else if (queryParamName === 'repair_id') {
                titleElement.innerText = `Ремонт (ID: ${cleanParentId}) — ${prettyEntityName} | Записей: ${items.length}`;
            } else if (queryParamName === 'realization_id') {
                titleElement.innerText = `Реализация (ID: ${cleanParentId}) — ${prettyEntityName} | Записей: ${items.length}`;
            } else if (entity === 'stock_batches') {
                titleElement.innerText = `Партии и документы прихода по выбранному складу | Позиций: ${items.length}`;
            } else if (entity === 'part_movement_details') {
                titleElement.innerText = `Детальная история движения запчасти | Операций: ${items.length}`;
            } else if (entity === 'stock_balances') {
                titleElement.innerText = `Остатки запчастей на складах | Позиций: ${items.length}`;
            } else {
                titleElement.innerText = `${prettyEntityName} | Записей: ${items.length}`;
            }
        }
        
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>`;
            return;
        }

        if ((activeEntity === 'repair_history' || activeEntity === 'car_general') && typeof config.render === 'function') {
            tbody.innerHTML = config.render(items);
        } else {
            tbody.innerHTML = '';
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.dataset.id = item.id || '';
                tr.style.cursor = 'pointer';
                tr.innerHTML = config.render(item);

                tr.onclick = () => {
                    selectedDetailItem = item;
                    console.log(`👆 [КЛИК В ДЕТАЛЯХ] Выбрана строка детали:`, selectedDetailItem);

                    tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
                    tr.classList.add('selected-row');
                };

                tbody.appendChild(tr);
            });
        }

    } catch (err) {
        console.error('❌ [loadDetailData ОШИБКА]:', err);
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки данных с сервера</td></tr>`;
    }
}

function filterDetailTable() {
    const filterInputs = document.querySelectorAll('#detail-filter-row input[data-column]');
    const rows = document.querySelectorAll('#detail-body tr');

    rows.forEach(row => {
        if (row.cells.length <= 1) return;

        let isVisible = true;

        filterInputs.forEach((input, index) => {
            const searchText = input.value.trim().toLowerCase();
            if (!searchText) return; 

            const cell = row.cells[index];
            if (cell) {
                const cellText = cell.textContent.toLowerCase();
                if (!cellText.includes(searchText)) {
                    isVisible = false;
                }
            }
        });

        row.style.display = isVisible ? '' : 'none';
    });
}

const navMap = {
    'Пользователи': 'users',
    'Бренды': 'brands',
    'Модели': 'models',
    'Кузов': 'bodies',
    'Склады': 'skladi',
    'Контрагенты': 'counterparties',
    'Поставщики': 'postavhik',
    'Покупатели': 'customers',
    'Тип контрагента': 'counterparty_types',
    'Тип склада': 'type_sklad',
    'Типы складов': 'type_sklad',
    'Автомобили': 'cars',
    'Тип работ': 'type_rabot',
    'Виды работ': 'vidy_rabot',
    'Работы': 'works',
    'Исполнители': 'ispolnitel',
    'Исполнитель': 'ispolnitel',
    'МОЛ': 'mol',
    'Материально ответственные': 'mol',
    'Типы ремонта': 'repair_types',
    'Тип ремонта': 'repair_types',
    'Запчасти': 'zaphasti',
    'Производитель': 'proizvoditel_zaphasti',
    'Группа замещения': 'gryppa_zamehenia',
    'Группа цен': 'gruppa_tsen',
    'Группы цен': 'gruppa_tsen',
    'Топливо': 'toplivo',
    'Ед.измерения': 'ed_izmereniya',
    'Ед. измерения': 'ed_izmereniya',
    'Приход': 'receipts',                        
    'Строки прихода': 'receipt_items',
    'Перемещение': 'moves',
    'Строки перемещения': 'move_items',
    'Техосмотр':'tehosmotr',
    'Автострахование':'autostrahovanie',
    'Карточка авто': 'car_cards',
    'Техосмотр машины': 'car_tehosmotr',
    'Страхование машины': 'car_autostrahovanie',
    'ДТП':'accidents',
    'ДТП история':'car_accidents',
    'Выставить счет': 'accident_invoices',
    'Оплатить счет': 'accident_payments',
    'События': 'accident_events',
    'Ремонт': 'repairs',
    'История ремонта': 'repair_history', 
    'Запчасти ремонта': 'repair_items', 
    'Работы ремонта': 'repair_works', 
    'Тип документа':'doc_types',
    'Общая': 'car_general',
    'Остатки запчастей': 'stock_balances', 
    'Остатки партии':'stock_batches',
    'Пользователи2':'mol_users',
    'Движение запчастей':'stock_movement',
    'Детали двжиения': 'part_movement_details',
    'Контакты покупателей': 'customer_contacts',
    'Автомобили покупателя': 'customer_cars',
    'Контакты поставщиков': 'postavhik_contacts',
    'Контакты контрагентов': 'counterparty_contacts',
    'Детали и фото авто': 'car_details',
    'Изображения ДТП':'accident_images',
    'Скидки на запчасти': 'part_discounts',
    'Скидки на услуги': 'service_discounts',
 'Реализация': 'realizations',
    'Запчасти реализации': 'realization_items',
    'Услуги реализации': 'realization_works',
    'Приходы': 'money_receipts',
    'Детали приходов': 'money_receipts_detail',
    'Аналитика по складам': 'money_receipts_by_sklad',
    'Детали услуг': 'money_receipts_works_detail',
    'Расходы': 'expenses_by_sklad',          // 🔥 Добавили прямое соответствие для главного пункта меню
    'Поставщики по складу': 'expenses_by_suppliers', // Поменяли "Расходы" на точное описание
    'Накладные поставщика': 'expenses_by_receipts',
    'Спецификация расходов': 'expense_items',
    'История всех оплат':'expense_payments'       // Поменяли "Детали расходов" для единообразия
};

function updateFilterPanels(entity) {
    const partsFilter = document.getElementById('parts-filter-panel');
    const movementFilter = document.getElementById('movement-filter-panel');
    const expenseFilter = document.getElementById('expense-filter-panel'); // Если есть отдельная панель для расходов

    if (!partsFilter || !movementFilter) return;

    // Сбрасываем отображение всех панелей
    partsFilter.style.display = 'none';
    movementFilter.style.display = 'none';
    if (expenseFilter) expenseFilter.style.display = 'none';

    // Сохраняем вашу старую логику без изменений
    if (entity === 'stock_balances') {
        partsFilter.style.display = 'flex';
    } else if (entity === 'stock_movement') {
        movementFilter.style.display = 'flex';
    } 
    // Добавляем поддержку расходов, чтобы они не ломали интерфейс
    else if (entity && entity.startsWith('expenses_') || entity === 'expense_items') {
        if (expenseFilter) {
            expenseFilter.style.display = 'flex';
        } else {
            // Если отдельной панели нет, используем partsFilter как универсальную, 
            // либо оставляем скрытой, чтобы инпуты не съезжали
            partsFilter.style.display = 'none'; 
        }
    }
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const text = link.innerText.trim();
        let entity = navMap[text] || text.toLowerCase();
        
        // Если кликнули на Приходы (money_receipts), подменяем на уровень складов
        if (entity === 'money_receipts') {
            entity = 'money_receipts_by_sklad';
        }
        
        updateFilterPanels(entity);

        const detailContainer = document.getElementById('detail-container');
        const carTabsBar = document.getElementById('car-tabs-bar') || document.getElementById('car-tabs-panel'); 
        const tabsForCars = document.getElementById('tabs-for-cars');
        const tabsForAccidents = document.getElementById('tabs-for-accidents');
        const tabsForRepairs = document.getElementById('tabs-for-repairs');
        const tabsForRealizations = document.getElementById('tabs-for-realizations');
        const tabsForMoneyReceipts = document.getElementById('tabs-for-money-receipts');

        const actionButtonsBar = document.querySelector('.action-buttons') || document.getElementById('action-buttons-bar');
        if (actionButtonsBar) {
            const readOnlyMainEntities = [
                'stock_balances', 
                'stock_movement', 
                'money_receipts', 
                'money_receipts_by_sklad', 
                'money_receipts_detail',
                'expenses_by_sklad',
                'expenses_by_suppliers',
                'expenses_by_receipts',
                'expense_items'
            ];
            
            if (readOnlyMainEntities.includes(entity) || entity === 'расходы' || entity === 'expenses') {
                actionButtonsBar.style.setProperty('display', 'none', 'important');
            } else {
                actionButtonsBar.style.setProperty('display', 'flex', 'important');
            }
        }

        if (
            entity === 'receipts' || 
            entity === 'moves' || 
            entity === 'cars' || 
            entity === 'car_cards' || 
            entity === 'accidents' || 
            entity === 'repairs' || 
            entity === 'realizations' || 
            entity === 'money_receipts' || 
            entity === 'money_receipts_by_sklad' ||
            entity === 'stock_balances' || 
            entity === 'stock_movement' || 
            entity === 'postavhik' || 
            entity === 'counterparties' || 
            entity === 'customers'
        ) {
            if (detailContainer) detailContainer.style.display = 'flex';
            
            if (carTabsBar) {
                if (
                    entity === 'car_cards' || 
                    entity === 'accidents' || 
                    entity === 'repairs' || 
                    entity === 'realizations' || 
                    entity === 'money_receipts' || 
                    entity === 'money_receipts_by_sklad'
                ) {
                    carTabsBar.style.display = 'flex';
                } else {
                    carTabsBar.style.display = 'none';
                }
            }

            if (entity === 'car_cards') {
                if (tabsForCars) tabsForCars.style.display = 'flex';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (tabsForMoneyReceipts) tabsForMoneyReceipts.style.display = 'none';
            } else if (entity === 'accidents') {
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'flex';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (tabsForMoneyReceipts) tabsForMoneyReceipts.style.display = 'none';
            } else if (entity === 'repairs') {
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'flex';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (tabsForMoneyReceipts) tabsForMoneyReceipts.style.display = 'none';
            } else if (entity === 'realizations') {
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'flex';
                if (tabsForMoneyReceipts) tabsForMoneyReceipts.style.display = 'none';
            } else if (entity === 'money_receipts' || entity === 'money_receipts_by_sklad') {
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (tabsForMoneyReceipts) tabsForMoneyReceipts.style.display = 'flex';
            } else {
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
                if (tabsForRepairs) tabsForRepairs.style.display = 'none';
                if (tabsForRealizations) tabsForRealizations.style.display = 'none';
                if (tabsForMoneyReceipts) tabsForMoneyReceipts.style.display = 'none';
            }
        } else {
            if (detailContainer) detailContainer.style.display = 'none';
            if (carTabsBar) carTabsBar.style.display = 'none';
        }
        
        // Если выбрали Расходы, запускаем нашу изолированную функцию
        if (text === 'Расходы' || entity === 'расходы' || entity === 'expenses') {
            loadExpenseMainData('expenses_by_sklad');
            return;
        }

        // Если выбрали Приходы, запускаем вашу изолированную функцию уровней складов
        if (text === 'Приходы' || entity === 'money_receipts' || entity === 'money_receipts_by_sklad') {
            loadReceiptMainData('money_receipts_by_sklad');
            return;
        }

        // Для всех остальных разделов вызываем стандартный loadData и сразу подсвечиваем/прогружаем первую строку
        loadData(entity, text, () => {
            const $firstRow = $('#mainTable tbody tr:first-child, .data-table tbody tr:first-child, table tbody tr:first-child').first();
            if ($firstRow.length) {
                $firstRow.trigger('click');
            }
        });
    });
});


document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        if (!content) return;

        const isOpen = content.style.display === 'flex';

        document.querySelectorAll('.accordion-content').forEach(item => {
            item.style.display = 'none';
        });

        if (!isOpen) {
            content.style.display = 'flex';
        }
    });
});











(function() {
    // 1. Внедряем стили для ресайзера
    if (!document.getElementById('auto-table-resizer-style')) {
        const style = document.createElement('style');
        style.id = 'auto-table-resizer-style';
        style.textContent = `
            table { table-layout: auto !important; }
            th, td { position: relative !important; }
            th .resizer, td .resizer {
                position: absolute;
                top: 0;
                right: 0;
                width: 6px;
                height: 100%;
                cursor: col-resize;
                user-select: none;
                z-index: 50;
                background-color: transparent;
            }
            th .resizer:hover, th .resizer.resizing,
            td .resizer:hover, td .resizer.resizing {
                background-color: var(--primary, #2563eb) !important;
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Функция применения ресайзеров с сохранением в localStorage
    function applyTableResizers() {
        // Узнаем текущий раздел (например, по активной ссылке в меню), чтобы сохранять размеры для каждой таблицы отдельно
        const activeLink = document.querySelector('.nav-link.active');
        const sectionKey = activeLink ? activeLink.innerText.trim() : 'global_table';
        const storageKey = `col_widths_${sectionKey}`;

        document.querySelectorAll('table').forEach(table => {
            const rows = Array.from(table.querySelectorAll('tr'));
            let textRowIndex = -1;

            // Находим строку с текстом заголовков
            for (let i = 0; i < rows.length; i++) {
                const cells = rows[i].querySelectorAll('th, td');
                const hasText = Array.from(cells).some(cell => cell.textContent.trim().length > 0 && !cell.querySelector('input'));
                if (hasText) {
                    textRowIndex = i;
                    break;
                }
            }

            if (textRowIndex === -1) return;

            const textRow = rows[textRowIndex];
            const textCells = textRow.querySelectorAll('th, td');

            // Загружаем сохраненные размеры для этого раздела
            const savedWidths = JSON.parse(localStorage.getItem(storageKey) || '{}');

            textCells.forEach((th, colIndex) => {
                // Восстанавливаем сохраненную ширину, если она есть
                if (savedWidths[colIndex]) {
                    th.style.width = savedWidths[colIndex];
                    for (let i = 0; i < textRowIndex; i++) {
                        const upperCell = rows[i].querySelectorAll('th, td')[colIndex];
                        if (upperCell) upperCell.style.width = savedWidths[colIndex];
                    }
                } else if (!th.style.width || th.style.width === 'auto') {
                    const w = th.offsetWidth;
                    if (w > 0) th.style.width = `${w}px`;
                }

                if (th.querySelector('.resizer')) return;

                const resizer = document.createElement('div');
                resizer.classList.add('resizer');
                th.appendChild(resizer);

                let startX = 0;
                let startWidth = 0;

                resizer.addEventListener('mousedown', function (e) {
                    startX = e.clientX;
                    startWidth = th.offsetWidth;
                    resizer.classList.add('resizing');
                    document.body.style.cursor = 'col-resize';

                    function onMouseMove(e) {
                        const dx = e.clientX - startX;
                        const newWidth = Math.max(10, startWidth + dx); // Позволяем сжимать до 10px
                        
                        th.style.width = `${newWidth}px`;

                        // Синхронно меняем верхние строки с фильтрами
                        for (let i = 0; i < textRowIndex; i++) {
                            const upperCell = rows[i].querySelectorAll('th, td')[colIndex];
                            if (upperCell) {
                                upperCell.style.width = `${newWidth}px`;
                            }
                        }
                    }

                    function onMouseUp() {
                        resizer.classList.remove('resizing');
                        document.body.style.cursor = '';
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);

                        // Сохраняем все ширины колонок текущей таблицы в localStorage при отпускании мыши
                        const currentWidths = {};
                        textRow.querySelectorAll('th, td').forEach((cell, idx) => {
                            currentWidths[idx] = cell.style.width;
                        });
                        localStorage.setItem(storageKey, JSON.stringify(currentWidths));
                    }

                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);

                    e.preventDefault();
                    e.stopPropagation();
                });
            });
        });
    }

    // 3. Перехватываем клики по меню (.nav-link), чтобы после загрузки данных применились сохраненные размеры
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            setTimeout(applyTableResizers, 200);
        });
    });

    // 4. Наблюдатель за изменениями DOM на случай динамической перерисовки таблиц
    const observer = new MutationObserver(() => {
        applyTableResizers();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 5. Первичный запуск
    setTimeout(applyTableResizers, 300);
})();


async function checkRemindersOnStart() {
    try {
        const response = await fetch('/api/reminders');
        if (!response.ok) return;
        
        const cars = await response.json();
        if (!cars || cars.length === 0) return;

        let modal = document.getElementById('reminders-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'reminders-modal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 10000;';
            modal.innerHTML = `
                <div style="background: #fff; width: 1050px; max-height: 85vh; border-radius: 8px; box-shadow: 0 5px 25px rgba(0,0,0,0.4); display: flex; flex-direction: column; overflow: hidden; font-family: sans-serif;">
                    <div style="background: #f5f5f5; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd;">
                        <h3 style="margin: 0; font-size: 18px; color: #333;">Напоминания</h3>
                        <button id="close-reminders" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0 5px;">&times;</button>
                    </div>
                    <div style="padding: 10px 20px; background: #fafafa; border-bottom: 1px solid #ddd;">
                        <button onclick="checkRemindersOnStart()" style="padding: 5px 12px; cursor: pointer; font-size: 13px; background: #f8f9fa; color: #333; border: 1px solid #ccc; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px;"><span style="color: #007bff; font-size: 15px;">🔄</span> Обновить</button>
                    </div>
                    <div style="padding: 15px; overflow-y: auto; flex-grow: 1;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead>
                                <tr style="background: #f8f9fa; text-align: center;">
                                    <th style="padding: 5px; border: 1px solid #ccc;"><input type="text" id="filter-gos" placeholder="Фильтр..." style="width: 95%; padding: 5px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;"></th>
                                    <th style="padding: 5px; border: 1px solid #ccc;"><input type="text" id="filter-model" placeholder="Фильтр..." style="width: 95%; padding: 5px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;"></th>
                                    <th style="padding: 5px; border: 1px solid #ccc;"><input type="text" id="filter-pto-curr" placeholder="Фильтр..." style="width: 95%; padding: 5px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;"></th>
                                    <th style="padding: 5px; border: 1px solid #ccc;"><input type="text" id="filter-pto-next" placeholder="Фильтр..." style="width: 95%; padding: 5px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;"></th>
                                    <th style="padding: 5px; border: 1px solid #ccc;"><input type="text" id="filter-ins-curr" placeholder="Фильтр..." style="width: 95%; padding: 5px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;"></th>
                                    <th style="padding: 5px; border: 1px solid #ccc;"><input type="text" id="filter-ins-next" placeholder="Фильтр..." style="width: 95%; padding: 5px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;"></th>
                                    <th style="padding: 5px; border: 1px solid #ccc;"><input type="text" id="filter-desc" placeholder="Фильтр..." style="width: 95%; padding: 5px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;"></th>
                                </tr>
                                <tr style="background: #e9ecef; text-align: center; vertical-align: middle;">
                                    <th style="padding: 10px; border: 1px solid #ccc;" rowspan="2">Гос. номер</th>
                                    <th style="padding: 10px; border: 1px solid #ccc;" rowspan="2">Модель</th>
                                    <th style="padding: 10px; border: 1px solid #ccc;" colspan="2">Дата техосмотра</th>
                                    <th style="padding: 10px; border: 1px solid #ccc;" colspan="2">Дата автострахования</th>
                                    <th style="padding: 10px; border: 1px solid #ccc;" rowspan="2">Описание</th>
                                </tr>
                                <tr style="background: #f1f3f5; text-align: center; vertical-align: middle;">
                                    <th style="padding: 8px; border: 1px solid #ccc;">Текущий</th>
                                    <th style="padding: 8px; border: 1px solid #ccc;">Следующий</th>
                                    <th style="padding: 8px; border: 1px solid #ccc;">Текущий</th>
                                    <th style="padding: 8px; border: 1px solid #ccc;">Следующий</th>
                                </tr>
                            </thead>
                            <tbody id="reminders-tbody"></tbody>
                        </table>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('close-reminders').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filteredCars = cars.filter(car => {
            const ptoCurr = car.pto_current ? new Date(car.pto_current) : null;
            const ptoNext = car.pto_next ? new Date(car.pto_next) : null;
            const insCurr = car.insurance_current ? new Date(car.insurance_current) : null;
            const insNext = car.insurance_next ? new Date(car.insurance_next) : null;

            if (ptoCurr) ptoCurr.setHours(0,0,0,0);
            if (ptoNext) ptoNext.setHours(0,0,0,0);
            if (insCurr) insCurr.setHours(0,0,0,0);
            if (insNext) insNext.setHours(0,0,0,0);

            const ptoExpired = (ptoCurr && ptoCurr < today) || (ptoNext && ptoNext < today);
            const insExpired = (insCurr && insCurr < today) || (insNext && insNext < today);

            return ptoExpired || insExpired;
        });

        if (filteredCars.length === 0) {
            modal.style.display = 'none';
            return;
        }

        const formatDate = (d) => {
            if (!d) return '—';
            const dateObj = new Date(d);
            if (isNaN(dateObj.getTime())) return '—';
            return dateObj.toISOString().split('T')[0].split('-').reverse().join('.');
        };

        const renderTable = (dataToRender) => {
            const tbody = document.getElementById('reminders-tbody');
            tbody.innerHTML = '';

            dataToRender.forEach(car => {
                const tr = document.createElement('tr');

                const ptoCurr = car.pto_current ? new Date(car.pto_current) : null;
                const ptoNext = car.pto_next ? new Date(car.pto_next) : null;
                const insCurr = car.insurance_current ? new Date(car.insurance_current) : null;
                const insNext = car.insurance_next ? new Date(car.insurance_next) : null;

                if (ptoCurr) ptoCurr.setHours(0,0,0,0);
                if (ptoNext) ptoNext.setHours(0,0,0,0);
                if (insCurr) insCurr.setHours(0,0,0,0);
                if (insNext) insNext.setHours(0,0,0,0);

                let isPtoCurrRed = ptoCurr && ptoCurr < today;
                let isPtoNextRed = ptoNext && ptoNext < today;

                let isInsCurrRed = insCurr && insCurr < today;
                let isInsNextRed = insNext && insNext < today;

                tr.innerHTML = `
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">${car.gos_number || '—'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">${car.model_name || '—'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle; background: ${isPtoCurrRed ? '#ffcccc' : 'transparent'}; color: ${isPtoCurrRed ? '#a00' : '#000'}; font-weight: ${isPtoCurrRed ? 'bold' : 'normal'};">${formatDate(car.pto_current)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle; background: ${isPtoNextRed ? '#ffcccc' : 'transparent'}; color: ${isPtoNextRed ? '#a00' : '#000'}; font-weight: ${isPtoNextRed ? 'bold' : 'normal'};">${formatDate(car.pto_next)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle; background: ${isInsCurrRed ? '#ffcccc' : 'transparent'}; color: ${isInsCurrRed ? '#a00' : '#000'}; font-weight: ${isInsCurrRed ? 'bold' : 'normal'};">${formatDate(car.insurance_current)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle; background: ${isInsNextRed ? '#ffcccc' : 'transparent'}; color: ${isInsNextRed ? '#a00' : '#000'}; font-weight: ${isInsNextRed ? 'bold' : 'normal'};">${formatDate(car.insurance_next)}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center; vertical-align: middle;">${car.description || ''}</td>
                `;
                tbody.appendChild(tr);
            });
        };

        renderTable(filteredCars);

        const applyFilters = () => {
            const fGos = document.getElementById('filter-gos').value.toLowerCase();
            const fModel = document.getElementById('filter-model').value.toLowerCase();
            const fPtoCurr = document.getElementById('filter-pto-curr').value.toLowerCase();
            const fPtoNext = document.getElementById('filter-pto-next').value.toLowerCase();
            const fInsCurr = document.getElementById('filter-ins-curr').value.toLowerCase();
            const fInsNext = document.getElementById('filter-ins-next').value.toLowerCase();
            const fDesc = document.getElementById('filter-desc').value.toLowerCase();

            const result = filteredCars.filter(car => {
                const gos = (car.gos_number || '').toLowerCase();
                const model = (car.model_name || '').toLowerCase();
                const ptoCurrStr = formatDate(car.pto_current).toLowerCase();
                const ptoNextStr = formatDate(car.pto_next).toLowerCase();
                const insCurrStr = formatDate(car.insurance_current).toLowerCase();
                const insNextStr = formatDate(car.insurance_next).toLowerCase();
                const desc = (car.description || '').toLowerCase();

                return gos.includes(fGos) &&
                       model.includes(fModel) &&
                       ptoCurrStr.includes(fPtoCurr) &&
                       ptoNextStr.includes(fPtoNext) &&
                       insCurrStr.includes(fInsCurr) &&
                       insNextStr.includes(fInsNext) &&
                       desc.includes(fDesc);
            });

            renderTable(result);
        };

        ['filter-gos', 'filter-model', 'filter-pto-curr', 'filter-pto-next', 'filter-ins-curr', 'filter-ins-next', 'filter-desc'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', applyFilters);
            }
        });

        modal.style.display = 'flex';

    } catch (e) {
        console.error('Ошибка показа напоминаний:', e);
    }
}


