let currentEntity = 'users';


// Сохранение загруженных элементов текущей таблицы в памяти
let currentItems = [];

// Выбранный в данный момент элемент (для работы кнопок «Изменить» / «Удалить»)
let selectedItem = null;

// Кэш для справочников (связанных таблиц)
const referenceDataCache = {};

// Функция всегда берет актуальные данные с сервера в реальном времени без кэша
async function fetchReferenceData(refEntity) {
    try {
        const response = await fetch(`http://localhost:5000/api/${refEntity}`);
        if (response.ok) {
            const data = await response.json();
            return data; // Всегда свежие данные с бэкенда!
        }
    } catch (err) {
        console.error(`Ошибка загрузки справочника ${refEntity}:`, err);
    }
    return [];
}

// 1. Конфигурация колонок и шаблонов строк для всех таблиц
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
            { field: 'discount_parts', label: 'Скидка зап.', width: '90px' },
            { field: 'discount_services', label: 'Скидка усл.', width: '90px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.type_name || '—'}</b></td>
            <td><b>${item.name_full || ''}</b></td>
            <td>${item.name_short || ''}</td>
            <td>${item.discount_parts || ''}</td>
            <td>${item.discount_services || ''}</td>
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
            { field: 'user_id', label: 'ФИО (Пользователь)', ref: 'users' },
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

        // Если документ не проведен, показываем кнопку "Провести"
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
        { field: 'currency', label: 'Валюта', width: '100px' },
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

        // Служебные поля (sum_rub остается только для чтения, а fact_date и is_posted теперь доступны в форме)
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
        
        // Генерация статуса с кнопкой быстрой проводки
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

        // Служебные поля
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
        
        // Красиво объединяем Гос номер и Модель в одну ячейку, чтобы не ломать верстку
        let carDisplay = '—';
        if (item.car_number && item.car_model) {
            carDisplay = `<b>${item.car_number}</b> <span style="color: #666; font-size: 0.9em;">(${item.car_model})</span>`;
        } else if (item.car_number) {
            carDisplay = `<b>${item.car_number}</b>`;
        } else if (item.car_model) {
            carDisplay = item.car_model;
        }

        // Кнопка быстрой проводки
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
},autostrahovanie: {
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

        // Служебные поля
        { field: 'fact_date', label: 'Дата факт', width: '160px', insert: false, readonly: true },
        { field: 'is_posted', label: 'Проведен', width: '120px', ref: 'statuses', insert: false }
    ],
    render: (item) => {
        const formatDT = (dateStr, includeTime = true) => {
            if (!dateStr) return '—';
            // Исправление: если строка содержит время (например, '2026-08-19T14:35'), 
            // парсим напрямую или извлекаем с сохранением часов, избегая сброса в 00:00
            let d = new Date(dateStr);
            if (isNaN(d)) return '—';

            // Если в исходной строке есть время, но стандартный Date сдвинул его/обнулил, 
            // используем локальные компоненты даты:
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            
            if (!includeTime) return `${day}.${month}.${year}`;
            
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        };

        const sumVal = Number(item.sum || 0).toFixed(2);
        
        // Красиво объединяем Гос номер и Модель в одну ячейку
        let carDisplay = '—';
        if (item.car_number && item.car_model) {
            carDisplay = `<b>${item.car_number}</b> <span style="color: #666; font-size: 0.9em;">(${item.car_model})</span>`;
        } else if (item.car_number) {
            carDisplay = `<b>${item.car_number}</b>`;
        } else if (item.car_model) {
            carDisplay = item.car_model;
        }

        // Кнопка быстрой проводки для автострахования
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
    readonly: true, // <--- Добавляем этот флаг
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
        // Удобная функция для отображения даты (только день.месяц.год)
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
    // Если твой движок поддерживает атрибуты строки, передаем ID через них:
    rowAttributes: (item) => {
        return `data-zaphasti-id="${item.id || ''}" data-warehouse-id="${item.warehouse_id || ''}"`;
    },
    render: (item) => {
        // Защита, если вдруг пришел пустой элемент
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
        // Форматируем дату красиво, если она приходит из БД
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

// 2. Конфигурация для нижней таблицы партий (обязательно нужна, чтобы нижняя таблица не падала)
// ==================== Конфигурация для нижней таблицы партий ====================
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
        { field: 'currency', label: 'Валюта', width: '80px', align: 'center' }
    ],
    render: (item) => {
        if (!item) return '';
        // Форматируем дату, если она приходит из бд
        let formattedDate = item.doc_date ? new Date(item.doc_date).toLocaleDateString('ru-RU') : '';
        return `
            <td>${item.artikul || ''}</td>
            <td style="text-align: center;">${item.code || ''}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.document_name || ''}</td>
            <td style="text-align: center;">${formattedDate}</td>
            <td>${item.description || ''}</td>
            <td style="text-align: right; font-weight: bold; color: #0044cc;">${item.qty !== undefined ? item.qty : 0}</td>
            <td style="text-align: center;">${item.unit || 'шт'}</td>
            <td style="text-align: right;">${item.purchase_price !== undefined ? item.purchase_price : 0}</td>
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
        // Приход
        { field: 'income_qty', label: 'Кол-во', width: '60px', align: 'right' },
        { field: 'income_sum', label: 'Сумма', width: '80px', align: 'right' },
        // Расход
        { field: 'outcome_qty', label: 'Кол-во', width: '60px', align: 'right' },
        { field: 'outcome_sum', label: 'Сумма', width: '80px', align: 'right' },
        // Остаток на конец
        { field: 'end_qty', label: 'Кол-во', width: '60px', align: 'right' },
        { field: 'end_sum', label: 'Сумма', width: '80px', align: 'right' },
        // Описание
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
        // Функция форматирования даты в ДД.ММ.ГГГГ
        const formatOnlyDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        };

        const sumVal = Number(item.sum || 0).toFixed(2);
        
        // Формируем красивую строку «Техосмотр ТО2104 от 10.01.2026»
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
        
        // Формируем красивую строку «Автострахование AC3546 от 05.03.2026»
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
        // Принудительная подстановка текущей даты и времени через стандартный генератор строки
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

        // Проверяем: если Счет больше Выплачено, подсвечиваем ячейку «Выплачено» красным
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
        // Исправлено с total_sum на sum в соответствии с вашей структурой БД
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
},repair_items: {
    title: 'Список запчастей в ремонте',
    columns: [
        { field: 'zaphast_id', label: 'Запчасть', width: '0px', ref: 'zaphasti', insert: true, table: false },
        { field: 'article', label: 'Артикул', width: '110px', insert: false, table: true },
        { field: 'code', label: 'Код', width: '100px', insert: false, table: true },
        { field: 'name', label: 'Наименование', width: '220px', insert: false, table: true },
        { field: 'quantity', label: 'Кол-во', width: '80px', insert: true, table: true },
        { field: 'unit', label: 'Ед. изм', width: '70px', insert: false, table: true },
        { field: 'price', label: 'Цена за штуку', width: '90px', insert: true, table: true },
        { field: 'total', label: 'Сумма', width: '90px', insert: false, table: true },
        { field: 'description', label: 'Описание', width: '150px', insert: true, table: true },
        { field: 'receipt_id', label: 'Документ прихода', width: '150px', ref: 'receipts', insert: true, table: true },
        
        // В самом конце, с флагом скрытия для таблицы
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
            
            // Считаем общую сумму по всем вложенным элементам (запчастям и работам)
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
            
            // 1. Красивая и аккуратная строка-шапка группы (в едином стиле с вкладкой "Общая")
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

            // 2. Вложенные строки
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

        // Глобальная функция сворачивания
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

        // Группируем элементы по месяцам и годам
        const monthsMap = {};
        const monthNames = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];

        itemsList.forEach(item => {
            const dateObj = new Date(item.operational_date || Date.now());
            const monthName = monthNames[dateObj.getMonth()];
            const year = dateObj.getFullYear();
            const groupKey = `${monthName} ${year}`; // Например: "августа 2026"

            if (!monthsMap[groupKey]) {
                monthsMap[groupKey] = { items: [], totalSum: 0 };
            }

            const itemSum = Number(item.sum || 0);
            monthsMap[groupKey].items.push(item);
            monthsMap[groupKey].totalSum += itemSum;
        });

        let html = '';
        let groupIndex = 0;

        // Рендерим сгруппированные данные
        Object.keys(monthsMap).forEach(monthKey => {
            const group = monthsMap[monthKey];
            const groupId = `general-group-${groupIndex++}`;
            const monthTotal = group.totalSum.toFixed(2);

            // 1. Аккуратная, чистая плажка месяца (гармонирует с интерфейсом и отлично читается)
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

            // 2. Строки записей внутри этого месяца
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

        // Глобальная функция сворачивания для вкладки "Общая"
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
}
}







// Функция безопасного получения конфига
function getConfig(entity) {
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

// ==================== УПРАВЛЕНИЕ БОКОВОЙ ПАНЕЛЬЮ (DRAWER) ====================
function getOrCreateDrawer() {
    let drawer = document.getElementById('entity-drawer');
    let backdrop = document.getElementById('entity-drawer-backdrop');

    // Создаем полупрозрачную подложку (backdrop) для затемнения фона, если её еще нет
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'entity-drawer-backdrop';
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px);
            z-index: 999; opacity: 0; transition: opacity 0.3s ease;
            pointer-events: none;
        `;
        backdrop.onclick = closeDrawer; // Клик по фону закрывает панель
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
    
    // Плавное появление
    drawer.style.right = '0px';
    if (backdrop) {
        backdrop.style.opacity = '1';
        backdrop.style.pointerEvents = 'auto';
    }
}

function closeDrawer() {
    const drawer = document.getElementById('entity-drawer');
    const backdrop = document.getElementById('entity-drawer-backdrop');
    
    // Плавное скрытие
    if (drawer) {
        drawer.style.right = '-440px';
    }
    if (backdrop) {
        backdrop.style.opacity = '0';
        backdrop.style.pointerEvents = 'none';
    }
}

// Открытие панели для создания новой или редактирования существующей записи
async function openEntityForm(entity, item = null, parentId = null) {
    // ЛОГИРОВАНИЕ ДЛЯ ПРОВЕРКИ ПЕРЕКЛЮЧАТЕЛЯ И КНОПКИ ДОБАВЛЕНИЯ:
    console.log("=== openEntityForm вызван ===");
    console.log("Переданная сущность (entity):", entity);
    console.log("Переданный parentId:", parentId);
    console.log("Переданный объект item:", item);

    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();
    
    // Текущая дата и время для автозаполнения
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    // Достаем токен для запросов с авторизацией
    const token = localStorage.getItem('token');

    // Автогенерация номера документа и подстановка текущей даты для новой записи
    if (!item || !item.id) {
        let nextId = 1;
        let prefix = 'ДОК-';

        if (entity === 'receipts') {
            prefix = 'ПР-';
        } else if (entity === 'moves' || entity === 'move_items' || entity === 'sklad_movements') {
            prefix = 'ПМ-';
        } else if (entity === 'tehosmotr') {
            prefix = 'ТО-';
        } else if (entity === 'autostrahovanie') {
            prefix = 'АС-';
        } else if (entity === 'accidents') {
            prefix = 'ДТП-';
        } else if (entity === 'repairs' || entity === 'repair_items' || entity === 'repair_works') {
            prefix = 'РЕМ-';
        }

        try {
            console.log(`Запрос для автонумерации по адресу: http://localhost:5000/api/${entity}`);
            const response = await fetch(`http://localhost:5000/api/${entity}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`Ответ автонумерации для ${entity}: статус`, response.status);
            if (response.ok) {
                const records = await response.json();
                console.log(`Получено записей для ${entity}:`, records.length);
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

        // Базовый объект с номером и статусом проведения
        item = { 
            doc_number: `${prefix}${nextId}`,
            is_posted: false // Новые документы по умолчанию не проведены
        };

        // ДИНАМИЧЕСКИ заполняем текущей датой ВСЕ поля, которые содержат 'date' или '_at' либо имеют тип datetime-local
        config.columns.forEach(col => {
            if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
                item[col.field] = currentDateTime;
            }
        });

        // Если это техосмотр, сразу прописываем автосервис по умолчанию
        if (entity === 'tehosmotr') {
            item.autoservice = 'Евроавтотест';
        }
    }

    // Проверяем, проведен ли документ (если это редактирование)
    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);
    console.log("Статус проведения документа (isPosted):", isPosted);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    for (const col of config.columns) {
        if (col.field === 'id' || col.field === 'dtp_id' || col.field === 'move_id' || col.field === 'repair_id') continue;
        if (col.insert === false) continue;
        if ((col.update === false || col.edit === false) && item && item.id) continue;
        
        // СКРЫВАЕМ поле «Документ прихода» (receipt_id) при добавлении/редактировании в repair_items
        if (entity === 'repair_items' && col.field === 'receipt_id') continue;

        // СКРЫВАЕМ поле пароля (password_hash) при РЕДАКТИРОВАНИИ существующего пользователя
        if (entity === 'users' && col.field === 'password_hash' && item && item.id) continue;
        
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

        // Специальная обработка для поля статуса проведения (is_posted)
        if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');
            let optionsHtml = `<option value="">-- Не выбрано --</option>`;
            
            statusItems.forEach(st => {
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                optionsHtml += `<option value="${st.id}" ${selected}>${st.name}</option>`;
            });

            inputHtml = `
                <select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">
                    ${optionsHtml}
                </select>
            `;
        } else if (col.ref || col.field === 'receipt_id') {
            const referenceName = col.ref || (col.field === 'receipt_id' ? 'receipts' : '');
            const refItems = await fetchReferenceData(referenceName);
            let optionsHtml = `<option value="">-- Не выбрано --</option>`;
            
            refItems.forEach(refItem => {
                let displayName = '';
                if (referenceName === 'cars') {
                    const gos = refItem.gos_number || refItem.car_number || '';
                    const mdl = refItem.model || refItem.car_model || '';
                    if (gos && mdl) {
                        displayName = `${gos} (${mdl})`;
                    } else {
                        displayName = gos || mdl || `Запись #${refItem.id}`;
                    }
                } else {
                    displayName = refItem.user_fio || refItem.name || refItem.login || refItem.name_full || refItem.title || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                }

                const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
            });

            inputHtml = `
                <select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">
                    ${optionsHtml}
                </select>
            `;
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
            // Если это поле пароля, используем type="password" для безопасности ввода
            const inputType = (col.field === 'password_hash') ? 'password' : 'text';
            inputHtml = `<input type="${inputType}" name="${col.field}" value="${val}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
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
                <button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">✔️ Сохранить</button>
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
            console.log("Изменился статус проведения (is_posted):", isPostedSelect.value);
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

            async function filterMols() {
                const selectedWarehouseId = warehouse.value;
                const currentMolValue = mol.value;
                console.log(`Фильтрация МОЛ для склада ID: ${selectedWarehouseId}`);

                try {
                    const [molRes, usersRes] = await Promise.all([
                        fetch('http://localhost:5000/api/mol', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }),
                        fetch('http://localhost:5000/api/users', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                    ]);

                    if (!molRes.ok) {
                        console.error('Ошибка загрузки справочника МОЛ, статус:', molRes.status);
                        return;
                    }
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
                    console.log(`Удаление записи ${entity} с ID: ${item.id}`);
                    try {
                        const response = await fetch(`http://localhost:5000/api/${entity}/${item.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        console.log(`Ответ удаления, статус:`, response.status);

                        if (response.ok) {
                            closeDrawer();
                            showAppNotification('Запись успешно удалена', 'success');
                            if ((entity === 'receipt_items' || entity === 'move_items' || entity === 'accident_invoices' || entity === 'accident_payments' || entity === 'accident_events' || entity === 'accident_items' || entity === 'repair_items' || entity === 'repair_works') && parentId) {
                                loadDetailData(entity, parentId);
                            } else {
                                refreshData();
                            }
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            console.error('Ошибка при удалении на сервере:', errData);
                            showAppNotification(errData.error || 'Ошибка при удалении записи', 'error');
                        }
                    } catch (err) {
                        console.error('Ошибка соединения при удалении:', err);
                        showAppNotification('Ошибка соединения с сервером', 'error');
                    }
                }
            );
        });
    }

    let isSubmitting = false;

    formElement.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (isSubmitting) {
            console.warn("Попытка повторной отправки заблокирована!");
            return; 
        }
        isSubmitting = true;

        const saveButton = formElement.querySelector('#save-btn');
        if (saveButton) saveButton.disabled = true;

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        if (data.is_posted !== undefined && data.is_posted !== '') {
            data.is_posted = data.is_posted === 'true' || data.is_posted === true || data.is_posted === '1' || data.is_posted === 1;
        }

        if (entity === 'receipt_items' && parentId) {
            data.receipt_id = parentId;
        } else if (entity === 'move_items' && parentId) {
            data.move_id = parentId; 
        } else if ((entity === 'accident_invoices' || entity === 'accident_payments' || entity === 'accident_events' || entity === 'accident_items') && parentId) {
            data.dtp_id = parentId;
        } else if ((entity === 'repair_items' || entity === 'repair_works') && parentId) {
            data.repair_id = parentId;
        }

        console.log("Что отправляем на бэкенд:", data);

        try {
            const isEdit = item && item.id;
            const url = isEdit 
                ? `http://localhost:5000/api/${entity}/${item.id}` 
                : `http://localhost:5000/api/${entity}`;
            
            const method = isEdit ? 'PUT' : 'POST';
            console.log(`Отправка запроса [${method}] на адрес: ${url}`);

            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // <--- Передаем токен для прохождения проверки verifyToken
                },
                body: JSON.stringify(data)
            });

            console.log(`Ответ сервера при сохранении, статус:`, response.status);

            if (response.ok) {
                closeDrawer();
                showAppNotification('Данные успешно сохранены', 'success');
                if ((entity === 'receipt_items' || entity === 'move_items' || entity === 'accident_invoices' || entity === 'accident_payments' || entity === 'accident_events' || entity === 'accident_items' || entity === 'repair_items' || entity === 'repair_works') && parentId) {
                    loadDetailData(entity, parentId);
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                console.error('Ошибка сохранения от сервера:', errData);
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                isSubmitting = false; 
                if (saveButton) saveButton.disabled = false;
            }
        } catch (err) {
            console.error('Ошибка соединения при отправке формы:', err);
            showAppNotification('Ошибка соединения с сервером', 'error');
            isSubmitting = false;
            if (saveButton) saveButton.disabled = false;
        }
    });
}
// ==================== РЕДАКТИРОВАНИЕ ВЫБРАННОЙ СУЩНОСТИ ====================
function editSelectedEntity() {
    if (!selectedItem) {
        // Используем красивое уведомление вместо стандартного alert
        showAppNotification('Пожалуйста, выберите строку для изменения (кликните на строку в таблице).', 'warning');
        return;
    }
    openEntityForm(currentEntity, selectedItem);
}

// ==================== УДАЛЕНИЕ ВЫБРАННОЙ СУЩНОСТИ ====================
async function deleteSelectedEntity() {
    if (!selectedItem) {
        showAppNotification('Пожалуйста, выберите строку для удаления (кликните на строку в таблице).', 'warning');
        return;
    }

    // Показываем красивое модальное окно подтверждения вместо стандартного confirm()
    showConfirmModal(
        'Подтверждение удаления', 
        `Вы действительно хотите удалить запись с ID: ${selectedItem.id}?`, 
        async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/${currentEntity}/${selectedItem.id}`, {
                    method: 'DELETE'
                });

                // Читаем JSON-ответ сервера при любом исходе
                const resultData = await response.json().catch(() => ({}));

                if (response.ok) {
                    selectedItem = null;
                    showAppNotification('Запись успешно удалена', 'success');
                    refreshData();
                } else {
                    // Отображаем причину ошибки от бэкенда в красивом уведомлении
                    showAppNotification(resultData.error || 'Ошибка при удалении записи', 'error');
                }
            } catch (err) {
                console.error('Ошибка соединения:', err);
                showAppNotification('Ошибка соединения с сервером', 'error');
            }
        }
    );
}

document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-msg');

    try {
        const response = await fetch('http://localhost:5000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const result = await response.json();

        if (response.ok) {
            // СОХРАНЯЕМ ТОКЕН В БРАУЗЕРЕ
            localStorage.setItem('token', result.token);

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'flex';
            loadData('users', 'Пользователи');
        } else {
            errorDiv.style.display = 'block';
            errorDiv.innerText = result.message || 'Ошибка входа';
        }
    } catch (err) {
        errorDiv.style.display = 'block';
        errorDiv.innerText = 'Ошибка соединения с сервером';
    }
});

function logout() {
    // ОЧИЩАЕМ ТОКЕН ПРИ ВЫХОДЕ
    localStorage.removeItem('token');
    location.reload();
}

async function refreshData() {
    // 1. Получаем название текущего активного раздела
    const activeLink = document.querySelector('.nav-link.active');
    const title = activeLink ? activeLink.innerText : 'Данные';
    
    // 2. Перезагружаем верхнюю таблицу
    await loadData(currentEntity, title);

    // 3. ЕСЛИ ЕСТЬ ВЫБРАННАЯ СТРОКА И НИЖНЯЯ ТАБЛИЦА (СПЕЦИФИКАЦИЯ) — ОБНОВЛЯЕМ И ЕЁ ТОЖЕ!
    if (selectedItem) {
        // Проверяем, какой тип сущности сейчас открыт внизу и подтягиваем свежие детали
        if (currentEntity === 'receipts' && selectedItem.id) {
            loadDetailData('receipt_items', selectedItem.id);
        } else if (currentEntity === 'moves' && selectedItem.id) {
            loadDetailData('move_items', selectedItem.id);
        } else if (currentEntity === 'car_cards' && selectedItem.id) {
            // Если внизу открыты вкладки машины, обновляем активную вкладку (например, техосмотр или запчасти)
            const activeTabBtn = document.querySelector('#tabs-for-cars button.active');
            if (activeTabBtn) {
                // Определяем какую вкладку перезагрузить по её классу или атрибуту
                // Или просто вызываем функцию обновления текущих деталей по ID машины
                loadDetailData('tehosmotr', selectedItem.id); // замените на вашу логику активной вкладки
            }
        } else if (currentEntity === 'accidents' && selectedItem.id) {
            loadDetailData('accident_invoices', selectedItem.id);
        } else if (currentEntity === 'repairs' && selectedItem.id) {
            loadDetailData('repair_items', selectedItem.id);
        } else if (currentEntity === 'stock_balances') {
            const zId = selectedItem.zaphasti_id || selectedItem.id;
            const wId = selectedItem.warehouse_id || selectedItem.sklad_id || selectedItem.id_sklad || selectedItem.warehouseId;
            loadDetailData('stock_batches', { zaphasti_id: zId, warehouse_id: wId });
        } else if (currentEntity === 'stock_movement') {
            loadDetailData('part_movement_details', selectedItem);
        }
    }

    console.log("Данные успешно обновлены без перезагрузки страницы!");
}






// Функция для всплывающих уведомлений (вместо alert)
function showAppNotification(message, type = 'info') {
    // Проверяем, есть ли готовый контейнер для тостов/уведомлений, если нет — создаем на лету
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

// Функция для красивого подтверждения действия (вместо confirm)
function showConfirmModal(title, text, onConfirm) {
    // Удаляем старое модальное окно, если оно есть
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














// ==================== ЗАГРУЗКА СКЛАДОВ В ФИЛЬТР ====================
async function loadWarehousesForFilter() {
    try {
        const select = document.getElementById('filter-warehouse');
        if (!select) return;

        // Если склады уже загружены (есть больше одного пункта), не запрашиваем повторно
        if (select.options.length > 1) return;

        // Используем эндпоинт для складов
        const response = await fetch('http://localhost:5000/api/skladi');
        if (!response.ok) throw new Error('Ошибка загрузки складов');
        
        const warehouses = await response.json();

        // Очищаем и оставляем дефолтный пункт
        select.innerHTML = '<option value="">-- Все склады --</option>';

        // Заполняем список
        warehouses.forEach(wh => {
            const option = document.createElement('option');
            // ID склада (пробуем разные варианты полей, которые могут быть в базе)
            option.value = wh.id || wh.warehouse_id || wh.sklad_id;
            // Название склада
            option.textContent = wh.name || wh.title || wh.sklad_name;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Не удалось загрузить список складов для фильтра:', err);
    }
}


// ==================== ЗАГРУЗКА МОЛОВ В ФИЛЬТР ====================
async function loadMolsForFilter() {
    try {
        const select = document.getElementById('filter-mol');
        if (!select) return;

        // Если МОЛы уже загружены (есть больше одного пункта), не запрашиваем повторно
        if (select.options.length > 1) return;

        // Эндпоинт для МОЛов исправлен на /api/mol (соответствует твоему роутеру)
        const response = await fetch('http://localhost:5000/api/mol');
        if (!response.ok) throw new Error('Ошибка загрузки МОЛ');
        
        const mols = await response.json();

        // Очищаем и оставляем дефолтный пункт
        select.innerHTML = '<option value="">-- Все МОЛ --</option>';

        // Заполняем список
        mols.forEach(mol => {
            const option = document.createElement('option');
            // ID МОЛ
            option.value = mol.id || mol.mol_id;
            // ФИО или название МОЛ (с учетом JOIN из бэкенда: user_fio или name)
            option.textContent = mol.user_fio || mol.name || mol.fio || mol.title;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Не удалось загрузить список МОЛ для фильтра:', err);
    }
}


// ==================== ФУНКЦИЯ ПРИМЕНЕНИЯ ФИЛЬТРОВ ====================
async function applyFilters() {
    if (currentEntity !== 'stock_balances') return;

    const dateVal = document.getElementById('filter-date')?.value || '';
    const warehouseId = document.getElementById('filter-warehouse')?.value || '';
    const molId = document.getElementById('filter-mol')?.value || '';

    // Формируем query-строку для отправки на сервер
    const params = new URLSearchParams();
    if (dateVal) params.append('date', dateVal);
    if (warehouseId) params.append('warehouse_id', warehouseId);
    if (molId) params.append('mol_id', molId);

    try {
        const response = await fetch(`http://localhost:5000/api/stock_balances?${params.toString()}`);
        if (!response.ok) throw new Error('Ошибка фильтрации');

        currentItems = await response.json();
        const config = getConfig('stock_balances');
        
        // Перерисовываем таблицу с новыми данными
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';

        currentItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.id = item.id || '';
            tr.style.cursor = 'pointer';
            tr.innerHTML = config.render(item);

            tr.onclick = () => {
                selectedItem = item;
                const zId = item.zaphasti_id || item.id;
                // Поддерживаем все варианты полей складов из твоего кода
                const wId = item.warehouse_id || item.sklad_id || item.id_sklad || item.warehouseId;
                loadDetailData('stock_batches', { zaphasti_id: zId, warehouse_id: wId });
            };
            tbody.appendChild(tr);
        });

        document.getElementById('row-count').innerText = `Раздел: Остатки запчастей | Найдено строк: ${currentItems.length}`;

        // Обновляем нижнюю табличку (партии) для первой строки отфильтрованного списка
        if (currentItems.length > 0) {
            selectedItem = currentItems[0];
            const zId = currentItems[0].zaphasti_id || currentItems[0].id;
            const wId = currentItems[0].warehouse_id || currentItems[0].sklad_id || currentItems[0].id_sklad || currentItems[0].warehouseId;

            loadDetailData('stock_batches', { 
                zaphasti_id: zId, 
                warehouse_id: wId 
            });
        } else {
            emptyDetailBody();
        }

    } catch (err) {
        console.error('Ошибка применения фильтров:', err);
    }
}


// ==================== ЗАГРУЗКА СКЛАДОВ ДЛЯ ДВИЖЕНИЯ ЗАПЧАСТЕЙ ====================
async function loadWarehousesForMovement() {
    try {
        const select = document.getElementById('movement-warehouse');
        if (!select) return;
        if (select.options.length > 1) return;

        const response = await fetch('http://localhost:5000/api/skladi');
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

// ==================== ЗАГРУЗКА МОЛОВ ДЛЯ ДВИЖЕНИЯ ЗАПЧАСТЕЙ ====================
async function loadMolsForMovement() {
    try {
        const select = document.getElementById('movement-mol');
        if (!select) return;
        if (select.options.length > 1) return;

        const response = await fetch('http://localhost:5000/api/mol');
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

// ==================== ФУНКЦИЯ ПРИМЕНЕНИЯ ФИЛЬТРОВ ДВИЖЕНИЯ ====================
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
        let url = `http://localhost:5000/api/stock_movement`;
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
// ==================== ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ ====================
async function loadData(entity, title) {
    currentEntity = entity;
    selectedItem = null;
    const config = getConfig(entity);

    // --- УПРАВЛЕНИЕ ВИДИМОСТЬЮ ПАНЕЛИ ФИЛЬТРОВ ДЛЯ ОСТАТКОВ ---
    const filterPanel = document.getElementById('parts-filter-panel');
    if (filterPanel) {
        if (entity === 'stock_balances') {
            filterPanel.style.display = 'flex';
            loadWarehousesForFilter(); // Автоматически загружает склады для остатков
            loadMolsForFilter();      // Автоматически загружает МОЛы для остатков
        } else {
            filterPanel.style.display = 'none';
        }
    }

    // --- УПРАВЛЕНИЕ ВИДИМОСТЬЮ НОВОЙ ПАНЕЛИ ФИЛЬТРОВ ДЛЯ ДВИЖЕНИЯ ЗАПЧАСТЕЙ ---
    const movementFilterPanel = document.getElementById('movement-filter-panel');
    if (movementFilterPanel) {
        if (entity === 'stock_movement') {
            movementFilterPanel.style.display = 'flex';
            loadWarehousesForMovement(); // Автоматически загружает склады для движения
            loadMolsForMovement();      // Автоматически загружает МОЛы для движения
        } else {
            movementFilterPanel.style.display = 'none';
        }
    }

    // --- НАДЕЖНОЕ СКРЫТИЕ ВЕРХНИХ КНОПОК ПО ID ---
    const btnAdd = document.getElementById('btn-add');
    const btnEdit = document.getElementById('btn-edit');
    const btnDelete = document.getElementById('btn-delete');

    if (btnAdd && btnEdit && btnDelete) {
        if (entity === 'car_cards' || entity === 'cars_summary' || entity === 'stock_balances' || entity === 'stock_movement') {
            btnAdd.style.display = 'none';
            btnEdit.style.display = 'none';
            btnDelete.style.display = 'none';
        } else {
            btnAdd.style.display = 'inline-block';
            btnEdit.style.display = 'inline-block';
            btnDelete.style.display = 'inline-block';
        }
    }
 
    // --- УПРАВЛЕНИЕ ВИДИМОСТЬЮ НИЖНЕЙ ПАНЕЛИ И КНОПОК СПЕЦИФИКАЦИИ ---
    const detailContainer = document.getElementById('detail-container');
    const detailToolbar = document.getElementById('detail-toolbar');

    if (detailContainer) {
        if (entity === 'receipts' || entity === 'moves' || entity === 'car_cards' || entity === 'accidents' || entity === 'repairs' || entity === 'stock_balances' || entity === 'stock_movement') {
            detailContainer.style.display = 'flex'; 

            // Скрываем нижние кнопки для car_cards, stock_balances и stock_movement
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
        // СОБИРАЕМ ПАРАМЕТРЫ ИЗ ФИЛЬТРОВ В ЗАВИСИМОСТИ ОТ РАЗДЕЛА
        let url = `http://localhost:5000/api/${entity}`;
        const params = new URLSearchParams();

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

        // Достаем токен авторизации из памяти браузера
        const token = localStorage.getItem('token');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Передаем пропуск серверу
            }
        });

        if (!response.ok) throw new Error('Ошибка сервера');
        
        currentItems = await response.json();
        const headerTr = document.getElementById('table-headers');
        const tbody = document.getElementById('table-body');
        
        tbody.innerHTML = '';
        
        const thead = headerTr.closest('thead');
        
        // 1. Создаем или находим строку для поиска НАВЕРХУ (перед заголовками)
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
                               style="width: 100%; padding: 4px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                    </th>
                `;
            }).join('');
        }

        const visibleColumns = config.columns.filter(col => col.table !== false);

        // 2. Формируем строку названий колонок
        let headersHtml = visibleColumns.map(col => {
            let styleAttr = col.style ? `style="${col.style}"` : (col.width ? `style="width: ${col.width};"` : '');
            let refAttr = col.ref ? `data-ref="${col.ref}"` : '';
            return `<th ${styleAttr} data-field="${col.field}" ${refAttr}>${col.label}</th>`;
        }).join('');

        headerTr.innerHTML = headersHtml;

        // Рендерим строки данных
        currentItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.dataset.id = item.id || '';
            tr.style.cursor = 'pointer';
            tr.innerHTML = config.render(item);

            tr.onclick = () => {
                selectedItem = item;

                // 📌 Убираем подсветку со всех остальных строк и подсвечиваем текущую
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
                    // 📌 ДЛЯ ДВИЖЕНИЯ ЗАПЧАСТЕЙ: передаем объект выбранной строки целиком
                    loadDetailData('part_movement_details', item);
                } else if (entity === 'receipts') {
                    loadDetailData('receipt_items', item.id);
                } else if (entity === 'moves') {
                    loadDetailData('move_items', item.id);
                }
            };

            tbody.appendChild(tr);
        });

        document.getElementById('row-count').innerText = `Раздел: ${title} | Всего строк: ${currentItems.length}`;

        // Управление вкладками внизу
        const carTabsBar = document.getElementById('car-tabs-bar');
        const tabsForCars = document.getElementById('tabs-for-cars');
        const tabsForAccidents = document.getElementById('tabs-for-accidents');
        const tabsForRepairs = document.getElementById('tabs-for-repairs');

        if (carTabsBar) {
            if (tabsForCars) tabsForCars.style.display = 'none';
            if (tabsForAccidents) tabsForAccidents.style.display = 'none';
            if (tabsForRepairs) tabsForRepairs.style.display = 'none';

            if (entity === 'car_cards') {
                carTabsBar.style.display = 'flex';
                if (tabsForCars) tabsForCars.style.display = 'flex';
                
                if (currentItems.length > 0) {
                    selectedItem = currentItems[0];
                    const activeId = currentItems[0].id;
                    const firstBtn = tabsForCars.querySelector('button');
                    if (firstBtn) {
                        tabsForCars.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        firstBtn.classList.add('active');
                    }
                    loadDetailData('tehosmotr', activeId);
                } else {
                    emptyDetailBody();
                }
            } else if (entity === 'accidents') {
                carTabsBar.style.display = 'flex';
                if (tabsForAccidents) tabsForAccidents.style.display = 'flex';
                
                if (currentItems.length > 0) {
                    selectedItem = currentItems[0];
                    const activeId = currentItems[0].id;
                    const firstBtn = tabsForAccidents.querySelector('button');
                    if (firstBtn) {
                        tabsForAccidents.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        firstBtn.classList.add('active');
                    }
                    loadDetailData('accident_invoices', activeId);
                } else {
                    emptyDetailBody();
                }
            } else if (entity === 'repairs') {
                carTabsBar.style.display = 'flex';
                if (tabsForRepairs) tabsForRepairs.style.display = 'flex';
                
                if (currentItems.length > 0) {
                    selectedItem = currentItems[0];
                    const activeId = currentItems[0].id;
                    
                    const firstBtn = tabsForRepairs.querySelector('button');
                    if (firstBtn) {
                        tabsForRepairs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        firstBtn.classList.add('active');
                    }
                    
                    loadDetailData('repair_items', activeId);
                } else {
                    emptyDetailBody();
                }
            } else if (entity === 'stock_balances') {
                carTabsBar.style.display = 'none';
                
                if (currentItems.length > 0) {
                    selectedItem = currentItems[0];
                    const zId = currentItems[0].zaphasti_id || currentItems[0].id;
                    const wId = currentItems[0].warehouse_id || currentItems[0].sklad_id || currentItems[0].id_sklad || currentItems[0].warehouseId;

                    loadDetailData('stock_batches', { 
                        zaphasti_id: zId, 
                        warehouse_id: wId 
                    });
                } else {
                    emptyDetailBody();
                }
            } else if (entity === 'stock_movement') {
                carTabsBar.style.display = 'none';
                
                if (currentItems.length > 0) {
                    selectedItem = currentItems[0];
                    // 📌 ДЛЯ ДВИЖЕНИЯ ЗАПЧАСТЕЙ передаем объект первой строки целиком
                    loadDetailData('part_movement_details', selectedItem);
                } else {
                    emptyDetailBody();
                }
            } else {
                carTabsBar.style.display = 'none';
                
                if (currentItems.length > 0 && (entity === 'receipts' || entity === 'moves')) {
                    selectedItem = currentItems[0];
                    const activeId = currentItems[0].id;
                    const detailEntity = entity === 'receipts' ? 'receipt_items' : 'move_items';
                    loadDetailData(detailEntity, activeId);
                } else {
                    emptyDetailBody();
                }
            }
        }

    } catch (err) {
        console.error('Ошибка загрузки данных для ' + entity, err);
        currentItems = [];
        document.getElementById('row-count').innerText = `Раздел: ${title} (нет данных на сервере)`;
    }
}

function emptyDetailBody() {
    const detailBody = document.getElementById('detail-body');
    if (detailBody) detailBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>';
}

// ==================== ФУНКЦИЯ ФИЛЬТРАЦИИ ТАБЛИЦЫ ====================
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

// Глобальная переменная для хранения выбранной строки в спецификации снизу
let selectedDetailItem = null;
let currentDetailItems = []; // Массив для хранения элементов нижней таблицы

// Функции для управления элементами спецификации в нижней таблице
// Определяем, какая дочерняя сущность соответствует текущему документу
function getCurrentDetailEntity() {
    if (currentEntity === 'moves') {
        return 'move_items';
    }
    if (currentEntity === 'receipts') {
        return 'receipt_items';
    }
    if (currentEntity === 'stock_balances') {
        return 'stock_batches'; // Для остатков запчастей нижняя таблица показывает партии
    }
    if (currentEntity === 'stock_movement') {
        return 'part_movement_details'; // Для движения запчастей нижняя таблица показывает детальную историю
    }
    if (currentEntity === 'accidents') {
        // Сначала проверяем глобальное состояние
        if (typeof currentAccidentSubTab !== 'undefined' && currentAccidentSubTab) return currentAccidentSubTab;

        // Определяем активную вкладку для ДТП
        const activeTab = document.querySelector('#tabs-for-accidents button.active');
        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick') || '';
            // Извлекаем название сущности из вызова loadDetailData или switchAccidentTab
            const match = onclickAttr.match(/(?:loadDetailData|switchAccidentTab)\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'accident_invoices'; // по умолчанию для ДТП
    }
    if (currentEntity === 'repairs') {
        // Сначала проверяем глобальное состояние для ремонта
        if (typeof currentRepairSubTab !== 'undefined' && currentRepairSubTab) return currentRepairSubTab;

        // Определяем активную вкладку для Ремонта
        const activeTab = document.querySelector('#tabs-for-repairs button.active');
        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/(?:loadDetailData|switchRepairTab)\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'repair_items'; // по умолчанию для ремонта (запчасти / товары)
    }
    if (currentEntity === 'car_cards') {
        // Сначала проверяем глобальное состояние для машин
        if (typeof currentCarSubTab !== 'undefined' && currentCarSubTab) return currentCarSubTab;

        // Определяем активную вкладку для Машин
        const activeTab = document.querySelector('#tabs-for-cars button.active');
        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/loadDetailData\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'tehosmotr'; // по умолчанию для машин
    }
    return 'receipt_items';
}


// ==================== УПРАВЛЕНИЕ ФОРМОЙ ДЕТАЛЕЙ (СПЕЦИФИКАЦИИ) ====================
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
    
    openEntityForm(detailEntity, itemToEdit, selectedItem.id);
}

// ==================== УДАЛЕНИЕ СТРОКИ СПЕЦИФИКАЦИИ ====================
async function deleteDetailItem() {
    if (!selectedDetailItem) {
        showAppNotification('Выберите строку в спецификации для удаления!', 'warning');
        return;
    }

    // Красивое модальное окно подтверждения вместо стандартного confirm()
    showConfirmModal(
        'Подтверждение удаления',
        'Вы уверены, что хотите удалить эту позицию?',
        async () => {
            const detailEntity = getCurrentDetailEntity();

            try {
                const response = await fetch(`http://localhost:5000/api/${detailEntity}/${selectedDetailItem.id}`, {
                    method: 'DELETE'
                });

                // Пытаемся прочитать JSON ответа для возможного вывода ошибки бэкенда
                const resultData = await response.json().catch(() => ({}));

                if (response.ok) {
                    selectedDetailItem = null; // Сбрасываем выбор после удаления
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


// Специальная модалка подтверждения именно для проведения документов (с синей кнопкой «Провести»)
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


// 1. Проведение техосмотра (у него изначально не было confirm, оставляем как было, но с тостами)
async function postTehosmotr(id) {
    try {
        const response = await fetch(`http://localhost:5000/api/tehosmotr/${id}/post`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
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


// 2. Проведение автострахования
async function postAutostrahovanie(id) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести этот документ страхования?',
        async () => {
            try {
                // Отправляем запрос на ваш универсальный PUT /:entity/:id
                const response = await fetch(`http://localhost:5000/api/autostrahovanie/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        is_posted: true, 
                        fact_date: new Date().toISOString() // Записываем текущую дату факта
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Ошибка при проведении документа');
                }

                showAppNotification('Документ страхования успешно проведен', 'success');
                // Перезагружаем таблицу автострахования на экране (через refreshData для надежности)
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification('Не удалось провести документ: ' + err.message, 'error');
            }
        }
    );
}


// 3. Проведение перемещения
async function postMove(moveId) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести это перемещение?',
        async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/moves/${moveId}/post`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_posted: true })
                });

                if (!response.ok) throw new Error('Ошибка при проведении перемещения');

                showAppNotification('Перемещение успешно проведено', 'success');
                // Перезагружаем таблицу перемещений
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification('Не удалось провести перемещение', 'error');
            }
        }
    );
}


// 4. Проведение прихода
async function postReceipt(receiptId) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести этот документ прихода?',
        async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/receipts/${receiptId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_posted: true })
                });

                if (!response.ok) throw new Error('Ошибка при проведении документа');

                showAppNotification('Документ прихода успешно проведен', 'success');
                // Перезагружаем данные таблицы прихода, чтобы обновить экран
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification('Не удалось провести документ', 'error');
            }
        }
    );
}



// ==================== ОБРАБОТЧИКИ КЛИКОВ ПО ВЕРХНЕЙ ТАБЛИЦЕ ====================
const tableBody = document.getElementById('table-body');

tableBody.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    
    document.querySelectorAll('#table-body tr').forEach(row => row.style.background = '');
    tr.style.background = '#e2e8f0';

    const id = tr.getAttribute('data-id');
    selectedItem = currentItems.find(i => i.id == id);
    selectedDetailItem = null; // Сбрасываем выбор внизу при смене строки

    // Управление отображением вкладок нижней панели
    const carTabsPanel = document.getElementById('car-tabs-panel') || document.getElementById('car-tabs-bar');
    const tabsForCars = document.getElementById('tabs-for-cars');
    const tabsForAccidents = document.getElementById('tabs-for-accidents');
    const tabsForRepairs = document.getElementById('tabs-for-repairs'); 
    const detailContainer = document.getElementById('detail-container');

    // 📌 Скрываем/показываем верхние кнопки «Добавить/Изменить/Удалить» для отчетов и нередактируемых разделов
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
        if (currentEntity === 'cars' || currentEntity === 'car_card' || currentEntity === 'car_cards') {
            // Если это карточка автомобиля — показываем общую панель и вкладки авто
            if (carTabsPanel) carTabsPanel.style.display = 'flex';
            if (tabsForCars) tabsForCars.style.display = 'flex';
            if (tabsForAccidents) tabsForAccidents.style.display = 'none';
            if (tabsForRepairs) tabsForRepairs.style.display = 'none';
            if (detailContainer) detailContainer.style.display = 'flex';
            
            const activeCarTab = document.querySelector('.car-tab-btn.active') || document.querySelector('.car-tab-btn');
            if (activeCarTab) {
                const onclickAttr = activeCarTab.getAttribute('onclick');
                const match = onclickAttr && onclickAttr.match(/'([^']+)'/);
                if (match && match[1]) {
                    loadDetailData(match[1], selectedItem.id);
                }
            }
        } else if (currentEntity === 'accidents') {
            // Если это ДТП — показываем панель и вкладки для ДТП
            if (carTabsPanel) carTabsPanel.style.display = 'flex';
            if (tabsForCars) tabsForCars.style.display = 'none';
            if (tabsForAccidents) tabsForAccidents.style.display = 'flex';
            if (tabsForRepairs) tabsForRepairs.style.display = 'none';
            if (detailContainer) detailContainer.style.display = 'flex';

            const activeAccidentTab = document.querySelector('.accident-tab-btn.active') || document.querySelector('.accident-tab-btn');
            if (activeAccidentTab) {
                const onclickAttr = activeAccidentTab.getAttribute('onclick');
                const match = onclickAttr && onclickAttr.match(/'([^']+)'/);
                if (match && match[1]) {
                    if (typeof currentAccidentSubTab !== 'undefined') currentAccidentSubTab = match[1];
                    loadDetailData(match[1], selectedItem.id);
                } else {
                    if (typeof currentAccidentSubTab !== 'undefined') currentAccidentSubTab = 'accident_invoices';
                    loadDetailData('accident_invoices', selectedItem.id);
                }
            } else {
                if (typeof currentAccidentSubTab !== 'undefined') currentAccidentSubTab = 'accident_invoices';
                loadDetailData('accident_invoices', selectedItem.id);
            }
        } else if (currentEntity === 'repairs') {
            // Если это Ремонт — показываем панель и вкладки для Ремонта
            if (carTabsPanel) carTabsPanel.style.display = 'flex';
            if (tabsForCars) tabsForCars.style.display = 'none';
            if (tabsForAccidents) tabsForAccidents.style.display = 'none';
            if (tabsForRepairs) tabsForRepairs.style.display = 'flex';
            if (detailContainer) detailContainer.style.display = 'flex';

            const activeRepairTab = document.querySelector('.repair-tab-btn.active') || document.querySelector('.repair-tab-btn');
            if (activeRepairTab) {
                const onclickAttr = activeRepairTab.getAttribute('onclick');
                const match = onclickAttr && onclickAttr.match(/'([^']+)'/);
                if (match && match[1]) {
                    if (typeof currentRepairSubTab !== 'undefined') currentRepairSubTab = match[1];
                    loadDetailData(match[1], selectedItem.id);
                } else {
                    if (typeof currentRepairSubTab !== 'undefined') currentRepairSubTab = 'repair_items';
                    loadDetailData('repair_items', selectedItem.id);
                }
            } else {
                if (typeof currentRepairSubTab !== 'undefined') currentRepairSubTab = 'repair_items';
                loadDetailData('repair_items', selectedItem.id);
            }
        } else {
            // Скрываем панели специфичных подвкладок для обычных документов/справочников
            if (tabsForCars) tabsForCars.style.display = 'none';
            if (tabsForAccidents) tabsForAccidents.style.display = 'none';
            if (tabsForRepairs) tabsForRepairs.style.display = 'none';
            if (carTabsPanel) carTabsPanel.style.display = (currentEntity === 'receipts' || currentEntity === 'moves') ? 'flex' : 'none';

            // Подгружаем состав в нижнюю таблицу в зависимости от текущего раздела
            if (currentEntity === 'receipts') {
                loadDetailData('receipt_items', selectedItem.id);
            } else if (currentEntity === 'moves') {
                loadDetailData('move_items', selectedItem.id);
            }
        }
    }
});

// ==================== ОБРАБОТЧИКИ КЛИКОВ ПО ТАБЛИЦАМ ====================
tableBody.addEventListener('dblclick', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;

    // 📌 ЖЕЛЕЗНАЯ ЗАЩИТА: Блокируем двойной клик, если:
    // 1. Это любая строка с colspan (шапка месяца, шапка ремонта, сообщения "нет данных")
    if (tr.querySelector('td[colspan]')) {
        return;
    }

    // 2. Клик произошел внутри нижней панели автомобиля / отчетов / историй
    const isInsideDetail = e.target.closest('#detail-container') || 
                           e.target.closest('#car-tabs-panel') || 
                           e.target.closest('#car-tabs-bar');
    
    if (isInsideDetail) {
        return; // Нижние вкладки (Общая, Ремонт машины, Техосмотр и т.д.) теперь полностью нередактируемые!
    }

    // 3. Текущая сущность входит в список запрещенных для редактирования
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
        currentEntity === 'repair_history'
    ) {
        return; 
    }

    const id = tr.getAttribute('data-id');
    const item = currentItems.find(i => i.id == id);
    if (item) {
        selectedItem = item;
        openEntityForm(currentEntity, item);
    }
});

// ФУНКЦИЯ ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК В КАРТОЧКЕ АВТОМОБИЛЯ
function switchCarTab(tabName, btnElement) {
    document.querySelectorAll('.car-tab-btn').forEach(btn => btn.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    }

    // СКРЫВАЕМ КНОПКИ ВНИЗУ В РЕЖИМЕ КАРТОЧКИ АВТО (согласно старой логике)
    const detailToolbar = document.getElementById('detail-toolbar');
    if (detailToolbar) {
        detailToolbar.style.display = 'none';
    }

    if (selectedItem && selectedItem.id) {
        loadDetailData(tabName, selectedItem.id);
    }
}

// Переменная для хранения текущей вкладки ремонта (по аналогии с ДТП)
let currentRepairSubTab = 'repair_items';



function switchAccidentTab(tabName, btnElement) {
    // ЗАПОМИНАЕМ ТЕКУЩУЮ СУЩНОСТЬ ВКЛАДКИ
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

// Функция переключения вкладок ремонта (поправлена по аналогии с ДТП)
function switchRepairTab(tabName, btnElement) {
    currentRepairSubTab = tabName; // Запоминаем текущую вкладку ремонта

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



    // РЕАЛИЗАЦИЯ ДЛЯ НИЖНЕЙ ТАБЛИЦЫ: Выделение одним кликом и редактирование двойным кликом
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
            openDetailForm('edit'); // Двойной клик открывает форму редактирования строки спецификации
        }
    });
}
/// ==================== ФУНКЦИЯ ЗАГРУЗКИ ДЕТАЛЕЙ (НИЖНЯЯ ТАБЛИЦА) ====================
async function loadDetailData(entity, parentId) {
    // 📌 Управление видимостью панели кнопок: скрываем для отчетов, остатков и движений
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

    const config = getConfig(entity); 
    const tbody = document.getElementById('detail-body');
    const headerTr = document.getElementById('detail-headers'); // Шапка нижней таблицы
    
    // Определяем правильное имя параметра для запроса в зависимости от сущности
    let queryParamName = 'receipt_id';
    let fetchUrl = '';

    if (entity === 'move_items') {
        queryParamName = 'move_id';
    } else if (entity === 'repair_items' || entity === 'repair_works') {
        queryParamName = 'repair_id'; // Для запчастей и работ ремонта передаем ID ремонта
    } else if (entity === 'accident_invoices' || entity === 'accident_payments' || entity === 'accident_events' || entity === 'accident_items') {
        queryParamName = 'dtp_id'; // Для дочерних таблиц ДТП передаем ID конкретного ДТП
    } else if (entity === 'stock_batches') {
        // 📌 ДЛЯ ПАРТИЙ ОСТАТКОВ ЗАПЧАСТЕЙ: берем ID запчасти и подстраховываемся со всеми вариантами склада
        let zId = parentId && typeof parentId === 'object' ? (parentId.zaphasti_id || parentId.id) : '';
        let wId = parentId && typeof parentId === 'object' ? (parentId.warehouse_id || parentId.sklad_id || parentId.id_sklad) : '';
        
        if (typeof parentId === 'string' && parentId.includes(':')) {
            const parts = parentId.split(':');
            zId = parts[0];
            wId = parts[1];
        }
        fetchUrl = `http://localhost:5000/api/stock_batches?zaphasti_id=${zId}&warehouse_id=${wId}`;
    } else if (entity === 'part_movement_details') {
        // 📌 ДЛЯ ДЕТАЛИЗАЦИИ ДВИЖЕНИЯ ЗАПЧАСТЕЙ: берем zaphasti_id, warehouse_id и фильтры дат из шапки движения
        let zId = parentId && typeof parentId === 'object' ? (parentId.zaphasti_id || parentId.id) : '';
        let wId = parentId && typeof parentId === 'object' ? (parentId.warehouse_id || parentId.sklad_id || parentId.id_sklad) : '';
        
        if (typeof parentId === 'string' && parentId.includes(':')) {
            const parts = parentId.split(':');
            zId = parts[0];
            wId = parts[1];
        }

        // Берём даты из фильтров раздела «Движение запчастей»
        const startDate = document.getElementById('movement-start-date')?.value || '';
        const endDate = document.getElementById('movement-end-date')?.value || '';

        fetchUrl = `http://localhost:5000/api/part_movement_details?zaphasti_id=${zId}&warehouse_id=${wId}&start_date=${startDate}&end_date=${endDate}`;
    } else if (entity === 'repairs' || entity === 'repair_history' || entity === 'car_general' || entity === 'fuel' || entity === 'insurance' || entity === 'inspections' || entity === 'accidents' || entity === 'wear' || entity === 'tehosmotr' || entity === 'car_autostrahovanie' || entity === 'car_tehosmotr' || entity === 'car_accidents' || entity === 'dtp_history') {
        queryParamName = 'car_id';
    }

    // Если URL не был сформирован индивидуально выше, формируем стандартный
    if (!fetchUrl) {
        fetchUrl = `http://localhost:5000/api/${entity}?${queryParamName}=${parentId}`;
    }
    
    // 🔍 ЛОГИРУЕМ ПЕРЕД ОТПРАВКОЙ ЗАПРОСА
    console.log(`📡 [loadDetailData] Запрос сущности: "${entity}"`, { parentId, queryParamName, fetchUrl });
    
    const thead = headerTr ? headerTr.closest('thead') : null;
    let filterRow = document.getElementById('detail-filter-row');

    // Фильтруем колонки, исключая те, у которых table: false
    const visibleColumns = config && config.columns ? config.columns.filter(col => col.table !== false) : [];

    // 📌 ПОИСК ДЛЯ МАШИН, ДТП И РЕМОНТОВ
    if (queryParamName === 'car_id' || queryParamName === 'dtp_id' || queryParamName === 'repair_id') {
        if (thead && visibleColumns.length > 0) {
            if (!filterRow) {
                filterRow = document.createElement('tr');
                filterRow.id = 'detail-filter-row';
                thead.insertBefore(filterRow, headerTr);
            } else {
                thead.insertBefore(filterRow, headerTr);
            }

            filterRow.style.display = ''; // Показываем строку поиска
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
        }
    } else {
        // Если это Приход, Перемещение, Партии остатков или Движение запчастей — скрываем строку поиска внизу
        if (filterRow) {
            filterRow.style.display = 'none';
        }
    }

    // 📌 УПРАВЛЕНИЕ ШАПКОЙ ТАБЛИЦЫ (ДИНАМИЧЕСКАЯ ИЛИ ВОЗВРАТ К СТАНДАРТНОЙ)
    if (headerTr && visibleColumns.length > 0) {
        headerTr.innerHTML = visibleColumns.map(col => {
            let widthStyle = col.width ? `width: ${col.width};` : '';
            let alignStyle = col.align ? `text-align: ${col.align};` : 'text-align: left;';
            return `<th style="padding: 6px; border-bottom: 1px solid #ddd; ${widthStyle} ${alignStyle}">${col.label}</th>`;
        }).join('');
    }

    try {
        // Достаем сохраненный токен авторизации
        const token = localStorage.getItem('token');

        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Передаем токен для доступа к деталям
            }
        });

        if (!response.ok) throw new Error(`Ошибка загрузки деталей (Статус: ${response.status})`);
        
        const items = await response.json();
        
        // 🔍 ЛОГИРУЕМ УСПЕШНЫЙ ОТВЕТ С СЕРВЕРА
        console.log(`📥 [loadDetailData] Успешный ответ для "${entity}":`, items);

        currentDetailItems = items; 
        selectedDetailItem = null;  
        
        // 📌 Карта красивых названий подразделов для аккуратного отображения пользователю
        const entityTitles = {
            accident_invoices: 'Счета / Расходы',
            accident_payments: 'Выплаты',
            accident_events: 'Хронология событий',
            accident_items: 'Поврежденные элементы',
            repair_items: 'Список запчастей',
            repair_works: 'Виды работ',
            receipt_items: 'Спецификация прихода',
            move_items: 'Спецификация перемещения'
        };
        const prettyEntityName = entityTitles[entity] || config.title || entity;

        // Динамический заголовок в зависимости от раздела (красивый и понятный)
        const titleElement = document.getElementById('detail-title');
        if (titleElement) {
            if (queryParamName === 'car_id') {
                titleElement.innerText = `Автомобиль (ID: ${parentId}) — ${prettyEntityName} | Записей: ${items.length}`;
            } else if (queryParamName === 'dtp_id') {
                titleElement.innerText = `ДТП (ID: ${parentId}) — ${prettyEntityName} | Записей: ${items.length}`;
            } else if (queryParamName === 'repair_id') {
                titleElement.innerText = `Ремонт (ID: ${parentId}) — ${prettyEntityName} | Записей: ${items.length}`;
            } else if (entity === 'stock_batches') {
                titleElement.innerText = `Партии и документы прихода по выбранному складу | Позиций: ${items.length}`;
            } else if (entity === 'part_movement_details') {
                titleElement.innerText = `Детальная история движения запчасти | Операций: ${items.length}`;
            } else if (entity === 'stock_balances') {
                titleElement.innerText = `Остатки запчастей на складах | Позиций: ${items.length}`;
            } else {
                titleElement.innerText = `${prettyEntityName} (Документ №${parentId}) | Позиций: ${items.length}`;
            }
        }
        
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>`;
            return;
        }

        // 📌 Рендеринг с поддержкой кастомной структуры (для истории ремонта и общей вкладки)
        if ((entity === 'repair_history' || entity === 'car_general') && typeof config.render === 'function') {
            tbody.innerHTML = config.render(items);
        } else {
            // Очищаем и заполняем нижнюю таблицу с добавлением обработчика клика и подсветки
            tbody.innerHTML = '';
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.dataset.id = item.id || '';
                tr.style.cursor = 'pointer';
                tr.innerHTML = config.render(item);

                tr.onclick = () => {
                    selectedDetailItem = item;

                    // 📌 Снимаем подсветку со всех строк нижней таблицы и подсвечиваем текущую кликнутую
                    tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
                    tr.classList.add('selected-row');
                };

                tbody.appendChild(tr);
            });
        }

    } catch (err) {
        console.error('❌ [loadDetailData] Ошибка:', err);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки данных с сервера</td></tr>`;
    }
}

// ==================== НАДЕЖНЫЙ ПОИСК ПО НИЖНЕЙ ТАБЛИЦЕ ====================
function filterDetailTable() {
    const filterInputs = document.querySelectorAll('#detail-filter-row input[data-column]');
    const rows = document.querySelectorAll('#detail-body tr');

    rows.forEach(row => {
        // Пропускаем строки-заглушки (если нет данных)
        if (row.cells.length <= 1) return;

        let isVisible = true;

        filterInputs.forEach((input, index) => {
            const searchText = input.value.trim().toLowerCase();
            if (!searchText) return; // Если в инпуте пусто — не фильтруем по нему

            // Берем ячейку по её порядковому номеру в строке
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
    'История ремонта': 'repair_history', // Добавили для вкладки repair_history
    'Запчасти ремонта': 'repair_items', // Добавь эту строку
    'Работы ремонта': 'repair_works', // Добавили работы
    'Тип документа':'doc_types',
    'Общая': 'car_general',
    'Остатки запчастей': 'stock_balances', // Добавили экран остатков
    'Остатки партии':'stock_batches',
    'Движение запчастей':'stock_movement',
    'Детали двжиения': 'part_movement_details'
    // Добавили общую сводную вкладку
};


// ==========================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ФИЛЬТРОВ
// ==========================================
function updateFilterPanels(entity) {
    const partsFilter = document.getElementById('parts-filter-panel');
    const movementFilter = document.getElementById('movement-filter-panel');

    if (!partsFilter || !movementFilter) return;

    // Сбрасываем обе панели по умолчанию
    partsFilter.style.display = 'none';
    movementFilter.style.display = 'none';

    // Включаем нужную в зависимости от сущности
    if (entity === 'stock_balances') {
        partsFilter.style.display = 'flex';
    } else if (entity === 'stock_movement') {
        movementFilter.style.display = 'flex';
    }
}

// ==========================================
// ОСНОВНОЙ КОД НАВИГАЦИИ И СОБЫТИЙ
// ==========================================
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const text = link.innerText.trim();
        const entity = navMap[text] || text.toLowerCase();
        
        // Управление панелями фильтров (Остатки / Движение запчастей)
        updateFilterPanels(entity);

        // Управление видимостью нижней панели
        const detailContainer = document.getElementById('detail-container');
        const carTabsBar = document.getElementById('car-tabs-bar'); // Панель вкладок внизу
        const tabsForCars = document.getElementById('tabs-for-cars');
        const tabsForAccidents = document.getElementById('tabs-for-accidents');

        // 📌 Управляем видимостью кнопок действий в нижней панели (Добавить / Изменить / Удалить)
        const actionButtonsBar = document.querySelector('.action-buttons') || document.getElementById('action-buttons-bar');
        if (actionButtonsBar) {
            // Сущности, для которых в главном меню или внизу не нужны кнопки управления
            const readOnlyMainEntities = ['stock_balances', 'stock_movement'];
            
            if (readOnlyMainEntities.includes(entity)) {
                actionButtonsBar.style.setProperty('display', 'none', 'important');
            } else {
                // Для receipts, moves, car_cards, accidents возвращаем показ (если это не специфическая вкладка)
                actionButtonsBar.style.setProperty('display', 'flex', 'important');
            }
        }

        // Условие отображения нижней панели и её вкладок
        if (entity === 'receipts' || entity === 'moves' || entity === 'car_cards' || entity === 'accidents' || entity === 'stock_balances' || entity === 'stock_movement') {
            if (detailContainer) detailContainer.style.display = 'flex';
            
            // Управляем отображением самой панели и переключаем наборы кнопок в зависимости от сущности
            if (carTabsBar) carTabsBar.style.display = 'flex';

            if (entity === 'car_cards') {
                if (tabsForCars) tabsForCars.style.display = 'flex';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
            } else if (entity === 'accidents') {
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'flex';
            } else {
                // Для receipts, moves, stock_balances и stock_movement нижняя панель есть, но кастомные подвкладки не нужны
                if (tabsForCars) tabsForCars.style.display = 'none';
                if (tabsForAccidents) tabsForAccidents.style.display = 'none';
            }
        } else {
            if (detailContainer) detailContainer.style.display = 'none';
            if (carTabsBar) carTabsBar.style.display = 'none';
        }
        
        loadData(entity, text);
    });
});

// ==========================================
// КЛАССИЧЕСКИЙ АККОРДЕОН (один открыт, остальные закрываются)
// ==========================================
document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        if (!content) return;

        // Проверяем, открыт ли текущий раздел в данный момент
        const isOpen = content.style.display === 'flex';

        // 1. Сначала скрываем/закрываем абсолютно все разделы меню
        document.querySelectorAll('.accordion-content').forEach(item => {
            item.style.display = 'none';
        });

        // 2. Если нажатый раздел был закрыт, открываем его. 
        // (Если был открыт — он закроется, оставляя всё меню свернутым, что и создает правильный эффект аккордеона)
        if (!isOpen) {
            content.style.display = 'flex';
        }
    });
});