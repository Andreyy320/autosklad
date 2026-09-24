const _originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
    const isApiCall = typeof url === 'string' && url.startsWith('/api/') && !url.startsWith('/api/login');

    if (isApiCall) {
        const token = localStorage.getItem('token');
        options.headers = {
            ...(options.headers || {}),
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }

    const response = await _originalFetch(url, options);

    if (isApiCall && response.status === 401) {
        console.warn('⚠️ Сессия истекла или недействительна — возврат на экран входа');
    localStorage.removeItem('token');
            location.reload();
    }

    return response;
};

setTimeout(function tryAutoLogin() {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
        const loginScreen = document.getElementById('login-screen');
        const appScreen = document.getElementById('app-screen');
                if (loginScreen && appScreen) {
            loginScreen.style.display = 'none';
            appScreen.style.display = 'flex';
            applyAccessControl();
            if (localStorage.getItem('userRole') === 'admin') {
                loadData('users', 'Пользователи');
            } else {
                loadData('zaphasti', 'Запчасти');
            }
        }
    }
}, 0);

function applyAccessControl() {
    const role = localStorage.getItem('userRole');
    const financeSection = document.getElementById('section-finance');
    const logsSection = document.getElementById('section-logs');
    const employeesLink = document.getElementById('nav-employees');
    const usersLink = document.getElementById('nav-users'); // ← новая строка
    if (role !== 'admin') {
        if (financeSection) financeSection.style.display = 'none';
        if (logsSection) logsSection.style.display = 'none';
        if (employeesLink) employeesLink.style.display = 'none';
        if (usersLink) usersLink.style.display = 'none'; // ← новая строка
    }
}



let currentEntity = 'users';
let currentItems = [];
let selectedItem = null;


const PAGER = {
    entity: null,  
    page: 1,
    limit: 100,
    total: 0,
    search: '',
    filters: {},   
    reload: null,   
    baseUrl: '',   
    baseQuery: '',
    loading: false,
    seq: 0,        
    timer: null
};

function pagerReset(entity) {
    PAGER.entity = entity || null;
    PAGER.page = 1;
    PAGER.total = 0;
    PAGER.search = '';
    PAGER.filters = {};
    clearTimeout(PAGER.timer);
    const searchInput = document.getElementById('pager-search');
    if (searchInput) searchInput.value = '';
}

function pagerSuspend() {
    PAGER.reload = null;
    PAGER.seq++;
    clearTimeout(PAGER.timer);
    const bar = document.getElementById('pager-bar');
    if (bar) bar.style.display = 'none';
}

function pagerParams(params) {
    params.set('page', String(PAGER.page));
    params.set('limit', String(PAGER.limit));
    if (PAGER.search) params.set('search', PAGER.search);
    if (Object.keys(PAGER.filters).length) params.set('filters', JSON.stringify(PAGER.filters));
    return params;
}

async function pagerReadResponse(response, seq) {
    const items = await response.json();
    if (seq !== PAGER.seq) return null;
    const total = parseInt(response.headers.get('X-Total-Count'), 10);
    const page = parseInt(response.headers.get('X-Page'), 10);
    PAGER.total = Number.isFinite(total) ? total : (Array.isArray(items) ? items.length : 0);
    if (Number.isFinite(page)) PAGER.page = page;
    PAGER.loading = false;
    return items;
}

function pagerScheduleReload(delay) {
    clearTimeout(PAGER.timer);
    PAGER.timer = setTimeout(() => { if (PAGER.reload) PAGER.reload(); }, delay);
}

function pagerGo(page) {
    if (!PAGER.reload) return;
    const pages = Math.max(1, Math.ceil(PAGER.total / PAGER.limit));
    const target = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
    if (target === PAGER.page) return;
    PAGER.page = target;
    PAGER.reload();
}

function ensurePagerBar() {
    let bar = document.getElementById('pager-bar');
    if (bar) return bar;

    const host = document.getElementById('pager-container');
    const table = document.getElementById('table-body') ? document.getElementById('table-body').closest('table') : null;
    if (!host && !table) return null;

    const btnStyle = 'padding:3px 9px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;';
    bar = document.createElement('div');
    bar.id = 'pager-bar';
    bar.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 8px;margin:4px 0;font-size:13px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;box-sizing:border-box;';
    bar.innerHTML = `
        <input id="pager-search" type="search" placeholder=" Поиск по всей таблице..." autocomplete="off"
               style="flex:1 1 220px;max-width:380px;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;">
        <span id="pager-info" style="color:#555;margin-left:auto;white-space:nowrap;"></span>
        <button type="button" id="pager-first" title="В начало" style="${btnStyle}">«</button>
        <button type="button" id="pager-prev" title="Назад" style="${btnStyle}">‹</button>
        <span style="white-space:nowrap;">стр.
            <input id="pager-page" type="number" min="1" value="1" style="width:56px;padding:3px 4px;border:1px solid #ccc;border-radius:4px;font-size:13px;">
            из <span id="pager-pages">1</span></span>
        <button type="button" id="pager-next" title="Вперёд" style="${btnStyle}">›</button>
        <button type="button" id="pager-last" title="В конец" style="${btnStyle}">»</button>
        <select id="pager-limit" title="Строк на странице" style="padding:3px 4px;border:1px solid #ccc;border-radius:4px;font-size:13px;">
            <option value="50">50</option><option value="100" selected>100</option>
            <option value="200">200</option><option value="500">500</option>
        </select>`;

    if (host) {
        host.appendChild(bar);
    } else {
        const anchor = table.closest('.table-container, .table-wrapper, .table-responsive') || table.parentElement;
        if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(bar, anchor);
        else table.parentNode.insertBefore(bar, table);
    }

    const searchInput = bar.querySelector('#pager-search');
    searchInput.addEventListener('input', () => {
        PAGER.search = searchInput.value.trim();
        PAGER.page = 1;
        pagerScheduleReload(350);
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(PAGER.timer);
            if (PAGER.reload) PAGER.reload();
        } else if (e.key === 'Escape' && searchInput.value) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
    });
    bar.querySelector('#pager-first').onclick = () => pagerGo(1);
    bar.querySelector('#pager-prev').onclick = () => pagerGo(PAGER.page - 1);
    bar.querySelector('#pager-next').onclick = () => pagerGo(PAGER.page + 1);
    bar.querySelector('#pager-last').onclick = () => pagerGo(Math.ceil(PAGER.total / PAGER.limit));
    const pageInput = bar.querySelector('#pager-page');
    pageInput.addEventListener('change', () => pagerGo(pageInput.value));
    pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') pagerGo(pageInput.value); });
    bar.querySelector('#pager-limit').addEventListener('change', (e) => {
        PAGER.limit = parseInt(e.target.value, 10) || 100;
        PAGER.page = 1;
        if (PAGER.reload) PAGER.reload();
    });
    return bar;
}

function renderPager() {
    const bar = ensurePagerBar();
    if (!bar) return;
    bar.style.display = 'flex';

    const pages = Math.max(1, Math.ceil(PAGER.total / PAGER.limit));
    const from = PAGER.total ? (PAGER.page - 1) * PAGER.limit + 1 : 0;
    const to = Math.min(PAGER.total, PAGER.page * PAGER.limit);

    bar.querySelector('#pager-info').textContent = PAGER.loading
        ? 'Загрузка…'
        : (PAGER.total ? `${from}–${to} из ${PAGER.total}` : 'Ничего не найдено');
    bar.querySelector('#pager-pages').textContent = String(pages);
    const pageInput = bar.querySelector('#pager-page');
    if (document.activeElement !== pageInput) pageInput.value = String(PAGER.page);
    pageInput.max = String(pages);
    bar.querySelector('#pager-limit').value = String(PAGER.limit);

    const atStart = PAGER.page <= 1;
    const atEnd = PAGER.page >= pages;
    bar.querySelector('#pager-first').disabled = atStart;
    bar.querySelector('#pager-prev').disabled = atStart;
    bar.querySelector('#pager-next').disabled = atEnd;
    bar.querySelector('#pager-last').disabled = atEnd;
}

function pagerClientOnlyFilters() {
    if (!currentItems.length) return;
    const fields = Object.keys(PAGER.filters).filter(f => !Object.prototype.hasOwnProperty.call(currentItems[0], f));
    if (!fields.length) return;
    const config = getConfig(currentEntity);
    document.querySelectorAll('#table-body tr').forEach(row => {
        const cells = Array.from(row.children);
        let ok = true;
        for (const f of fields) {
            const idx = config.columns.findIndex(c => c.field === f);
            const cell = idx !== -1 ? cells[idx] : null;
            if (!cell || !cell.textContent.toLowerCase().includes(String(PAGER.filters[f]).toLowerCase())) { ok = false; break; }
        }
        row.style.display = ok ? '' : 'none';
    });
}

async function pagerFetchAllRowsHtml() {
    const params = new URLSearchParams(PAGER.baseQuery);
    params.set('page', '1');
    params.set('limit', 'all');
    if (PAGER.search) params.set('search', PAGER.search);
    if (Object.keys(PAGER.filters).length) params.set('filters', JSON.stringify(PAGER.filters));

    const response = await fetch(`${PAGER.baseUrl}?${params.toString()}`);
    if (!response.ok) throw new Error('Ошибка сервера ' + response.status);
    const items = await response.json();
    const total = parseInt(response.headers.get('X-Total-Count'), 10);
    if (Number.isFinite(total) && total > items.length) {
        alert(`Строк слишком много (${total}). На печать выведены первые ${items.length}. Уточните поиск.`);
    }
    const config = getConfig(currentEntity);
    return items.map(item => `<tr>${config.render(item)}</tr>`).join('');
}

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
            { field: 'role', label: 'Роль', width: '130px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.login}</b></td>
            <td style="display: none;"></td>
            <td>${item.name || ''}</td>
            <td>${item.role === 'admin' ? '<b style="color:#2563eb;">Админ</b>' : 'Сотрудник'}</td>
            <td>${item.description || ''}</td>
        `
    },
        employees: {
        title: 'Сотрудники',
        columns: [
            { field: 'login', label: 'Логин', width: '150px' },
            { field: 'password_hash', label: 'Пароль', style: 'display: none;' },
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'role', label: 'Роль', width: '130px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.login}</b></td>
            <td style="display: none;"></td>
            <td>${item.name || ''}</td>
            <td>${item.role === 'admin' ? '<b style="color:#2563eb;">Админ</b>' : 'Сотрудник'}</td>
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
            { field: 'description', label: 'Описание', width: '150px' }
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
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => `
        <td><span style="color: #334155;">${item.type_name || '—'}</span></td>
        <td><span style="color: #334155;">${item.name_full || ''}</span></td>
        <td><span style="color: #334155;">${item.name_short || ''}</span></td>
        <td><span style="color: #334155;">${item.part_discount_name || '—'}</span></td>
        <td><span style="color: #64748b; font-size: 13px;">${item.description || ''}</span></td>
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
            { field: 'description', label: 'Описание', width: '150px' }
        ],
        render: (item) => `
            <td><b>${item.name || ''}</b></td>
            <td>${item.description || ''}</td>
        `
    },
      skladi: {
        title: 'Вип клиенты',
        columns: [
            { field: 'type_sklad_id', label: 'Тип склада', width: '150px', ref: 'type_sklad' },
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'markup_percent', label: 'Наценка (%)', width: '120px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td>${item.type_name || '—'}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.markup_percent !== null && item.markup_percent !== undefined && item.markup_percent !== '' ? item.markup_percent + '%' : '—'}</td>
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
{ field: 'toplivo_id', label: 'Топливо', ref: 'toplivo', table: false },
            { field: 'year', label: 'Год' },
            { field: 'color', label: 'Цвет' },
             { field: 'vin', label: 'VIN-номер' },
            { field: 'sklad_id', label: 'Вип клиента', ref: 'skladi' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td><b>${item.gos_number || ''}</b></td>
            <td><b>${item.car_model_name || '—'}</b></td>
            <td>${item.body_name || ''}</td>
            <td>${item.engine || ''}</td>
            <td>${item.year || ''}</td>
            <td>${item.color || ''}</td>
                       <td>${item.vin || ''}</td>
            <td><b>${item.sklad_name || '—'}</b></td>
            <td>${item.description || ''}</td>
        `
    },
    car_details: {
        title: 'Детали и фото автомобиля',
        columns: [
            { field: 'date', label: 'Дата', type: 'date' },
            { field: 'title', label: 'Наименование' },
           { field: 'description', label: 'Описание', width: '150px' },
            { field: 'photo_url', label: 'Изображение', type: 'image' }
        ],
        render: (item) => `
            <td>${item.date ? new Date(item.date).toLocaleDateString() : ''}</td>
            <td><b>${item.title || ''}</b></td>
            <td>${item.description || ''}</td>
            <td>
${item.photo_url ? `<img src="${item.photo_url}" alt="Фото" style="width: 280px; height: 120px; object-fit: cover; border-radius: 6px; cursor: pointer;" onclick="openImageLightbox(this.src)" />` : '—'}            </td>
        `
       },

    car_images: {
        title: 'Изображения',
        columns: [
            { field: 'date', label: 'Дата', width: '160px' },
            { field: 'image_url', label: 'Изображение', type: 'image', width: '150px' },
            { field: 'source_label', label: 'Источник', width: '140px' },
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td>${item.date || ''}</td>
            <td>
${item.image_url ? `<img src="${item.image_url}" alt="Фото" style="width: 200px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc; cursor: pointer;" onclick="openImageLightbox(this.src)" />` : '—'}            </td>
            <td>${item.source_label || ''}</td>
            <td>${item.description || ''}</td>
        `
    },
 
    ispolnitel: {
        title: 'Исполнители',
        columns: [
            { field: 'name', label: 'Имя / Название', width: '250px' },
            { field: 'description', label: 'Описание', width: '150px' }
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
            { field: 'description', label: 'Описание', width: '150px' }
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
            { field: 'description', label: 'Описание' }
        ],
        render: (item) => `
            <td>${item.article || ''}</td>
            <td>${item.code || ''}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.proizvoditel_name || '—'}</td>
           <td>${item.ed_izmereniya_name || '—'}</td>
<td>${item.description || ''}</td>
        `
    },
    proizvoditel_zaphasti: {
        title: 'Производитель',
        columns: [
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'description', label: 'Описание', width: '150px' }
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
            { field: 'description', label: 'Описание', width: '150px' }
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
        { field: 'sum_rub', label: 'Сумма РУБ', width: '120px', insert: false, readonly: true },
        { field: 'fact_date', label: 'Дата факт', type: 'datetime-local', width: '160px' },
        { field: 'is_posted', label: 'Проведен', width: '200px', ref: 'statuses' },
        { field: 'description', label: 'Описание', width: '150px' },
        { field: 'is_opening_balance', label: 'Начальный остаток (не учитывать в расходах)', type: 'checkbox', table: false }
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
            <td style="text-align: right; font-weight: bold;">${sumRub}</td>
            <td>${formatDT(item.fact_date)}</td>
                        <td style="overflow: visible; white-space: nowrap; text-overflow: clip;">
                <span style="color: ${isPostedColor}; font-weight: bold;">${isPostedText}</span>
                ${actionButton}
            </td>
            <td>${item.description || ''}</td>
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

        { field: 'sum_rub', label: 'Сумма РУБ', width: '120px', insert: false, readonly: true },
        { field: 'fact_date', label: 'Дата факт', type: 'datetime-local', width: '160px' },
                { field: 'is_posted', label: 'Проведен', width: '200px', ref: 'statuses' },
        { field: 'description', label: 'Описание', width: '150px' }
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
            <td style="text-align: right; font-weight: bold;">${sumRub}</td>
            <td>${formatDT(item.fact_date)}</td>
                       <td style="overflow: visible; white-space: nowrap; text-overflow: clip;">${isPostedHtml}</td>
            <td>${item.description || ''}</td>
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
        { field: 'price', label: 'Цена (закуп)', width: '90px' },
        { field: 'markup_percent', label: 'Наценка, %', width: '80px', insert: false },
        { field: 'currency', label: 'Валюта', width: '100px' },
        { field: 'total_rub', label: 'Сумма', width: '90px', insert: false },
{ field: 'description', label: 'Описание', width: '150px' },
        { field: 'income_document', label: 'Документ прихода', width: '180px', insert: false }
    ],
    render: (item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        const markupPercent = Number(item.markup_percent) || 0;
        
        const calculatedTotal = price * qty * (1 + markupPercent / 100);
        const totalSum = calculatedTotal; 
        
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
            <td style="color: #2e7d32; font-weight: 500;">${markupPercent > 0 ? `+${markupPercent}%` : '0%'}</td>
            <td>${item.currency || 'Рубль ПМР'}</td>
            <td><b>${totalSum.toFixed(2)}</b></td>
            <td>${item.description || ''}</td>
            <td style="color: #000000; font-style: normal;">${incomeDocText}</td>
        `;
    }
    },

       returns: {
        title: 'Возврат запчастей',
        columns: [
            { field: 'doc_number', label: '№ Документа', width: '110px' },
            { field: 'date', label: 'Дата', width: '110px' },
            { field: 'return_type', label: 'Тип', width: '110px' },
            { field: 'sklad_name', label: 'Склад', width: '130px' },
            { field: 'counterparty_name', label: 'Контрагент', width: '160px' },
            { field: 'source_doc_number', label: 'Документ-основание', width: '130px' },
            { field: 'total_sum', label: 'Сумма РУБ', width: '100px', align: 'right' },
            { field: 'fact_date', label: 'Дата факт', width: '140px' },
                        { field: 'is_posted', label: 'Проведен', width: '200px', align: 'center' }
        ],
        render: (item) => {
            const formattedDate = item.date ? new Date(item.date).toLocaleString() : '—';
            const formattedFactDate = item.fact_date ? new Date(item.fact_date).toLocaleString() : '—';
            const sum = Number(item.total_sum || 0).toFixed(2);
            const isPosted = item.is_posted === true || item.is_posted === 'true';
                        const returnTypeLabels = {
                'from_customer': 'От покупателя',
                'from_retail_customer': 'От розничного покупателя',
                'from_repair': 'С ремонта',
                'to_supplier': 'Поставщику'
            };
            const returnTypeLabel = returnTypeLabels[item.return_type] || 'Поставщику';

            return `
                <td><span style="font-weight:600; color:#0f172a;">${item.doc_number || '—'}</span></td>
                <td><span style="color:#475569;">${formattedDate}</span></td>
                <td>
                    <span style="padding:2px 8px; border-radius:4px; font-size:12px; font-weight:600; color:#334155;">                       
                    ${returnTypeLabel}
                    </span>
                </td>
                <td><span style="color:#334155;">${item.sklad_name || '—'}</span></td>
                <td><span style="color:#0f172a;">${item.counterparty_name || '—'}</span></td>
                <td><span style="color:#475569;">${item.source_doc_number || '—'}</span></td>
                <td style="text-align:right; font-weight:600; color:#0f172a;">${sum}</td>
                <td><span style="color:#475569;">${formattedFactDate}</span></td>
                               <td style="text-align:center; overflow: visible; white-space: nowrap; text-overflow: clip;">
                    ${isPosted
                        ? `<span style="color:#16a34a; font-weight:600;">Проведен</span>`
                        : `<span style="color:#94a3b8;">Не проведен</span> <button type="button" onclick="event.stopPropagation(); postReturn(${item.id})" style="background:#16a34a;color:white;border:none;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:12px;margin-left:6px;">Провести</button>`
                    }
                </td>
            `;
        }
    },
        return_items: {
        title: 'Спецификация возврата',
        columns: [
            { field: 'zaphasti_code', label: 'Код', width: '100px' },
            { field: 'zaphasti_name', label: 'Наименование', width: '220px' },
            { field: 'quantity', label: 'Кол-во', width: '90px', align: 'right' },
            { field: 'price_rub', label: 'Цена', width: '100px', align: 'right' },
            { field: 'total_rub', label: 'Сумма', width: '110px', align: 'right' }
        ],
        render: (item) => {
            const qty = Number(item.quantity || 0).toFixed(2);
            const price = Number(item.price_rub || 0).toFixed(2);
            const sum = Number(item.total_rub || 0).toFixed(2);

            return `
                <td><span style="color:#475569;">${item.zaphasti_code || '—'}</span></td>
                <td><span style="color:#0f172a;">${item.zaphasti_name || '—'}</span></td>
                <td style="text-align:right; color:#334155;">${qty}</td>
                <td style="text-align:right; color:#334155;">${price}</td>
                <td style="text-align:right; font-weight:600; color:#0f172a;">${sum}</td>
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
        { field: 'description', label: 'Описание' }
    ],
    render: (item) => {
        return `
            <td>${item.gos_number || ''}</td>
            <td>${item.car_model_name || ''}</td>
            <td>${item.body_name || ''}</td>
            <td>${item.engine_name || ''}</td>
            <td>${item.year || ''}</td>
            <td>${item.color || ''}</td>
            <td>${item.vin || ''}</td>
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
    { field: 'sklad', label: 'Склад', width: '130px' },
    { field: 'mol', label: 'МОЛ', width: '150px' },
    { field: 'qty', label: 'Кол-во', width: '70px', align: 'right' },
    { field: 'unit', label: 'Ед. изм.', width: '70px', align: 'center' },
    { field: 'description', label: 'Описание' }
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
        <td>${item.sklad || 'Основной склад'}</td>
        <td>${item.mol || 'Не назначен'}</td>
        <td style="text-align: right; font-weight: bold; color: #006600; background-color: #e6fcf5;">${item.qty !== undefined ? item.qty : 0}</td>
        <td style="text-align: center;">${item.unit || 'шт'}</td>
        <td>${item.description || ''}</td>
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
        { field: 'supplier_name', label: 'Поставщик', width: '160px' },
        { field: 'qty', label: 'Кол-во', width: '70px', align: 'right' },
        { field: 'unit', label: 'Ед. изм.', width: '60px', align: 'center' },
        { field: 'purchase_price', label: 'Цена закуп.', width: '90px', align: 'right' },
        { field: 'retail_price', label: 'Розн. цена', width: '90px', align: 'right' },
        { field: 'currency', label: 'Валюта', width: '80px', align: 'center' }
    ],
    render: (item) => {
        if (!item) return '';
        let formattedDate = item.doc_date ? new Date(item.doc_date).toLocaleDateString('ru-RU') : '';
        
        let rawPurchasePrice = item.purchase_price !== undefined ? Number(item.purchase_price) : 0;
        let retailPrice = item.retail_price !== undefined ? item.retail_price : (rawPurchasePrice * 1.3).toFixed(2);

        return `
            <td>${item.artikul || ''}</td>
            <td style="text-align: center;">${item.code || ''}</td>
            <td><b>${item.name || ''}</b></td>
            <td>${item.document_name || ''}</td>
            <td style="text-align: center;">${formattedDate}</td>
            <td>${item.supplier_name || ''}</td>
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
            { field: 'name', label: 'Наименование', width: '250px' },
            { field: 'manufacturer', label: 'Производитель', width: '120px' },
            { field: 'sklad', label: 'Склад', width: '120px' },
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
                <td>${item.sklad || ''}</td>
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
        { label: "Дата факт", field: "actual_date", type: 'datetime-local', width: "130px", edit: false },
        { label: "Проведен", field: "is_posted", width: "200px", insert: false, update: false },
       { label: "Описание", field: "description", width: "150px", edit: false }
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
        const accountVal = accountNum.toFixed(2);

        const isUnderpaid = accountNum > paidNum;
        const paidStyle = isUnderpaid 
            ? 'text-align: right; background-color: #f8d7da; color: #842029; font-weight: bold;' 
            : 'text-align: right;';
        const accountStyle = 'text-align: right; color: #2563eb; font-weight: 600;';

        const isPosted = Boolean(item.is_posted);
        const isPostedText = isPosted ? 'Проведен' : 'Не проведен';
        const isPostedColor = isPosted ? 'green' : 'gray';

        const actionButton = !isPosted 
            ? `<button onclick="event.stopPropagation(); postAccident(${item.id})" style="margin-left: 8px; padding: 2px 6px; cursor: pointer; background-color: #28a745; color: white; border: none; border-radius: 3px;">Провести</button>` 
            : '';

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
            <td style="${accountStyle}">${accountVal}</td>
            <td style="${paidStyle}">${paidVal}</td>
            <td>${formatDT(item.actual_date)}</td>
            <td style="overflow: visible; white-space: nowrap; text-overflow: clip;">
                <span style="color: ${isPostedColor}; font-weight: bold;">${isPostedText}</span>
                ${actionButton}
            </td>
            <td>${item.description || ''}</td>
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
        { field: 'description', label: 'Описание', width: '150px' },
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
    accident_images: {
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
${item.image_url ? `<img src="${item.image_url}" alt="Фото ДТП" style="width: 200px; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #ccc; cursor: pointer;" onclick="openImageLightbox(this.src)" />` : '—'}            </td>            <td>${item.description || ''}</td>
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
    { field: 'warehouse_id', label: 'Склад/Сервис', width: '150px', ref: 'skladi' },
    { field: 'customer_id', label: 'Сервис', width: '150px', ref: 'customers', table: false },
    { field: 'mol_id', label: 'МОЛ', width: '130px', ref: 'mol' },
        { field: 'sum', label: 'Сумма', width: '100px', insert: false, update: false, readonly: true, align: 'right' },
        { field: 'fact_date', label: 'Дата факт', width: '160px', type: 'datetime-local' },
              { field: 'is_posted', label: 'Проведен', width: '200px' },
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

      const mileageVal = item.mileage ? Number(item.mileage).toLocaleString('ru-RU') : '—';
const sumVal = item.sum ? Number(item.sum).toFixed(2) : '0.00';

const isServiceDocType = (item.doc_type_name || '').toLowerCase().includes('сервис');
const skladServiceVal = isServiceDocType
    ? (item.service_name || item.customer_id || '—')
    : (item.warehouse_name || item.warehouse_id || '—');

const isPosted = Boolean(item.is_posted);
        const isPostedText = isPosted ? 'Проведен' : 'Не проведен';
        const isPostedColor = isPosted ? 'green' : 'gray';

        const actionButton = !isPosted 
            ? `<button onclick="event.stopPropagation(); postRepair(${item.id})" style="margin-left: 8px; padding: 2px 6px; cursor: pointer; background-color: #28a745; color: white; border: none; border-radius: 3px;">Провести</button>` 
            : '';

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatDT(item.doc_date)}</td>
            <td>${item.doc_type_name || item.doc_type || '—'}</td>
            <td>${item.repair_type_name || item.repair_type || '—'}</td>
            <td>${item.car_number || item.car_id || '—'}</td>
            <td>${item.car_model || '—'}</td>
            <td style="text-align: right;">${mileageVal}</td>
<td>${skladServiceVal}</td>
            <td>${item.mol_name || item.mol_id || '—'}</td>
            <td style="text-align: right; font-weight: bold;">${sumVal}</td>
            <td>${formatDT(item.fact_date)}</td>
                        <td style="overflow: visible; white-space: nowrap; text-overflow: clip;">
                <span style="color: ${isPostedColor}; font-weight: bold;">${isPostedText}</span>
                ${actionButton}
            </td>
            <td>${item.description || ''}</td>
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
        { field: 'price', label: 'Цена за шт.', width: '90px', insert: false, table: true },
        { field: 'total', label: 'Сумма', width: '90px', insert: false, table: true },
        { field: 'description', label: 'Описание', width: '150px', insert: true, table: true },
        { field: 'receipt_id', label: 'Документ прихода', width: '150px', ref: 'receipts', insert: false, table: true },
    ],
    render: (item) => {
        const price = Number(item.price) || 0;
        const qty = Number(item.quantity) || 0;
        
        const totalSum = price * qty;
        
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
        { field: 'vidy_rabot_id', label: 'Работа', width: '220px', ref: 'vidy_rabot', insert: true, table: true },
        { field: 'price', label: 'Стоимость', width: '120px', align: 'right', insert: true, table: true },
        { field: 'description', label: 'Описание', insert: true, table: true }
    ],
    render: (item) => {
        const priceVal = item.price ? Number(item.price).toFixed(2) : '0.00';
        
        return `
            <td>${item.ispolnitel_name || item.ispolnitel_id || '—'}</td>
            <td><b>${item.vidy_rabot_name || item.name || '—'}</b></td>
            <td style="text-align: right;">${priceVal}</td>
            <td>${item.description || ''}</td>
        `;
    }
    },

    repair_history: {
    title: 'Ремонт машины',
    columns: [
        { field: 'article', label: 'Артикул', width: '100px' },
        { field: 'code', label: 'Код', width: '80px' },
        { field: 'name', label: 'Наименование', width: '220px' },
        { field: 'qty', label: 'Кол-во', width: '70px', align: 'center' },
        { field: 'unit', label: 'Ед.изм', width: '70px', align: 'center' },
        { field: 'price', label: 'Цена РУБ', width: '90px', align: 'right' },
        { field: 'sum', label: 'Сумма РУБ', width: '90px', align: 'right' },
        { field: 'description', label: 'Описание', width: '150px' }
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
                        <span style="color: #495057;">${repairType}</span> 
                        <span style="color: #6c757d; font-weight: normal; margin: 0 6px;">|</span> 
                        <span style="color: #0f172a;">Итого: ${costVal} руб.${mileage}</span>
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
    receipts_history: {
    title: 'Запчасти по ремонту',
    columns: [
        { field: 'article', label: 'Артикул', width: '100px' },
        { field: 'code', label: 'Код', width: '80px' },
        { field: 'name', label: 'Наименование', width: '220px' },
        { field: 'qty', label: 'Кол-во', width: '70px', align: 'center' },
        { field: 'unit', label: 'Ед.изм', width: '70px', align: 'center' },
        { field: 'price', label: 'Цена РУБ', width: '90px', align: 'right' },
        { field: 'sum', label: 'Сумма РУБ', width: '90px', align: 'right' },
        { field: 'description', label: 'Описание', width: '150px' }
        { field: 'doc_source', label: 'Документ прихода', width: '200px' }
    ],
    render: (repairsList) => {
        if (!Array.isArray(repairsList) || repairsList.length === 0) {
            return `<tr><td colspan="9" style="text-align: center; color: #888; padding: 20px;">Нет данных по запчастям</td></tr>`;
        }

        let html = '';

        repairsList.forEach((repair, index) => {
            const repairType = repair.repair_type_name || repair.type || 'Ремонт';
            const docNum = repair.doc_number || '';
            const docDate = repair.doc_date ? new Date(repair.doc_date).toLocaleDateString('ru-RU') : '';
            const mileage = repair.mileage ? ` | ${repair.mileage} км` : '';
            const groupId = `receipts-group-${repair.id || index}`;
            
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
                <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #dee2e6; border-bottom: 2px solid #ced4da; cursor: pointer;" onclick="toggleReceiptsGroup('${groupId}', this)">
                    <td colspan="9" style="padding: 7px 10px; color: #333333; font-size: 13px;">
                        <i class="fas fa-minus-square toggle-icon" style="color: #495057; margin-right: 6px;"></i>
                        <span style="color: #212529;">${repairType} ${docNum} от ${docDate}</span> 
                        <span style="color: #6c757d; font-weight: normal; margin: 0 6px;">|</span> 
                        <span style="color: #495057;">${repairType}</span> 
                        <span style="color: #6c757d; font-weight: normal; margin: 0 6px;">|</span> 
                        <span style="color: #0f172a;">Итого запчастей: ${costVal} руб.${mileage}</span>
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
                            <td>${item.doc_source || ''}</td>
                        </tr>
                    `;
                });
            } else {
                html += `
                    <tr class="${groupId}" style="background-color: #ffffff;">
                        <td colspan="2"></td>
                        <td colspan="5" style="color: #888; font-style: italic;">Нет запчастей для этого ремонта</td>
                        <td></td>
                        <td></td>
                    </tr>
                `;
            }
        });

        if (typeof window.toggleReceiptsGroup === 'undefined') {
            window.toggleReceiptsGroup = function(groupId, headerRow) {
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
        { field: 'description', label: 'Описание', width: '150px' }
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
                        <span style="color: #0f172a;">Итого за месяц: ${monthTotal} руб.</span>
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
        { field: 'car_id', label: 'Гос. номер', width: '120px', ref: 'customer_cars', formatRef: (car) => car.gos_number || car.car_number || `ID #${car.id}` },
        { field: 'car_id', label: 'Марка авто', width: '140px', ref: 'customer_cars', formatRef: (car) => `${car.brand || ''} ${car.model || ''}`.trim() || '—' },
        { field: 'sum_parts', label: 'Запчасти', width: '90px', insert: false, update: false, readonly: true, align: 'right' },
        { field: 'sum_work', label: 'Работа', width: '90px', insert: false, update: false, readonly: true, align: 'right' },
        { field: 'sum_total', label: 'Всего', width: '90px', insert: false, update: false, readonly: true, align: 'right' },
        { field: 'fact_date', label: 'Дата факт', width: '160px', type: 'datetime-local' },
                { field: 'is_posted', label: 'Проведен', width: '200px' },
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

        const sumPartsVal = item.sum_parts ? Number(item.sum_parts).toFixed(2) : '0.00';
        const sumWorkVal = item.sum_work ? Number(item.sum_work).toFixed(2) : '0.00';
        const sumTotalVal = item.sum_total ? Number(item.sum_total).toFixed(2) : '0.00';
        
        const isPosted = Boolean(item.is_posted);
        const isPostedText = isPosted ? 'Проведен' : 'Не проведен';
        const isPostedColor = isPosted ? 'green' : 'gray';

        const actionButton = !isPosted 
            ? `<button onclick="event.stopPropagation(); postRealization(${item.id})" style="margin-left: 8px; padding: 2px 6px; cursor: pointer; background-color: #28a745; color: white; border: none; border-radius: 3px;">Провести</button>` 
            : '';

        const gosNumber = item.car_number || item.gos_number || (item.car && (item.car.gos_number || item.car.car_number)) || '—';
        const carBrandModel = `${item.car_brand || (item.car && item.car.brand) || ''} ${item.car_model || (item.car && item.car.model) || ''}`.trim() || item.car_display_name || '—';

        return `
            <td><b>${item.doc_number || ''}</b></td>
            <td>${formatDT(item.doc_date)}</td>
            <td>${item.customer_name || item.customer_id || '—'}</td>
            <td>${item.sklad_name || item.sklad_id || '—'}</td>
            <td>${item.mol_name || item.mol_id || '—'}</td>
            <td><b>${gosNumber}</b></td>
            <td>${carBrandModel}</td>
            <td style="text-align: right;">${sumPartsVal}</td>
            <td style="text-align: right;">${sumWorkVal}</td>
            <td style="text-align: right; font-weight: bold;">${sumTotalVal}</td>
            <td>${formatDT(item.fact_date)}</td>
                       <td style="overflow: visible; white-space: nowrap; text-overflow: clip;">
                <span style="color: ${isPostedColor}; font-weight: bold;">${isPostedText}</span>
                ${actionButton}
            </td>
            <td>${item.description || ''}</td>
        `;
    }
    },
    realization_items: {
    title: 'Спецификация реализации',
    columns: [
        { field: 'zaphasti_id', label: 'Запчасть', ref: 'zaphasti', table: false },
        
        { field: 'article', label: 'Артикул', width: '90px', table: true },
        { field: 'code', label: 'Код', width: '80px', table: true },
        { field: 'name', label: 'Наименование', width: '180px', table: true },
        { field: 'quantity', label: 'Кол-во', width: '70px', type: 'number', table: true },
                { field: 'markup_percent', label: 'Наценка, %', width: '80px', type: 'number', table: true },
        { field: 'is_manual_price', label: 'Указать цену вручную', type: 'checkbox', table: false },
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
        
        const incomeDoc = item.income_document || '—';

        return `
            <td>${article}</td>
            <td>${code}</td>
            <td><b>${name}</b></td>
            <td style="text-align: right;">${qty}</td>
            <td style="text-align: right; color: #16a34a;">${item.markup_percent !== null && item.markup_percent !== undefined ? item.markup_percent + '%' : '—'}</td>
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
            <td><span style="color: #0f172a; font-weight: 500;">${item.sklad_name || 'Основной склад'}</span></td>
            <td style="text-align: center; color: #334155;">${item.total_orders || 0}</td>
            <td style="text-align: right; color: #334155;">${totalQty}</td>
            <td style="text-align: right; color: #334155;">${partsSum}</td>
            <td style="text-align: right; color: #334155;">${worksSum}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${realizationSum}</td>
            <td style="text-align: right; color: #334155;">${totalPaid}</td>
            <td style="text-align: right; color: ${debtSumNum > 0 ? '#991b1b' : '#334155'};">${debtSum}</td>
        `;
    }
    },
    money_receipts_by_customer: {
    title: 'Должники по месяцам',
    columns: [
        { field: 'customer_name', label: 'Покупатель', width: '200px' },
        { field: 'month', label: 'Месяц', width: '120px' },
        { field: 'total_realization_sum', label: 'Сумма', width: '110px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'debt_sum', label: 'Долг', width: '110px', align: 'right' },
        { field: 'actions', label: 'Действие', width: '100px', align: 'center' }
    ],
    render: (item) => {
    const debt = Number(item.debt_sum || 0);
    const monthLabel = new Date(item.month).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    const payFn = item.debtor_type === 'warehouse'
        ? `openWarehouseDebtPaymentDrawer(${item.debtor_id}, '${debt}', '${item.debtor_name}', '${item.month}')`
        : `openCustomerDebtPaymentDrawer(${item.debtor_id}, '${debt}', '${item.debtor_name}', '${item.month}')`;
    return `
        <td><b>${item.debtor_name}</b> ${item.debtor_type === 'warehouse' ? '<span style="font-size:11px;color:#64748b;">(склад)</span>' : ''}</td>
        <td>${monthLabel}</td>
        <td style="text-align:right;">${Number(item.total_realization_sum).toFixed(2)}</td>
        <td style="text-align:right;">${Number(item.total_paid).toFixed(2)}</td>
        <td style="text-align:right; color:#991b1b; font-weight:600;">${debt.toFixed(2)}</td>
        <td style="text-align:center;">
            <button type="button" onclick="event.stopPropagation(); ${payFn}"
                style="background:#16a34a;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;">Оплатить</button>
        </td>
    `;
    }
    },
    money_receipts: {
    title: 'Список документов (продажи и ремонты)',
    columns: [
             { field: 'doc_number', label: '№ Документа', width: '100px' },
        { field: 'date', label: 'Дата', width: '100px' },
        { field: 'counterparty_name', label: 'Покупатель / Склад', width: '180px' },
        { field: 'sklad_name', label: 'Склад', width: '120px' },
        { field: 'parts_sum', label: 'Сумма зап.', width: '105px', align: 'right' },
        { field: 'works_sum', label: 'Сумма усл.', width: '105px', align: 'right' },
        { field: 'total_realization_sum', label: 'Сумма', width: '110px', align: 'right' },
{ field: 'total_returned_sum', label: 'Возврат', width: '100px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'debt_sum', label: 'Долг', width: '110px', align: 'right' },
    ],
    render: (item) => {
        const partsSum = Number(item.parts_sum || 0).toFixed(2);
        const worksSum = Number(item.works_sum || 0).toFixed(2);
               const sum = Number(item.total_realization_sum || 0).toFixed(2);
        const returnedSum = Number(item.total_returned_sum || 0).toFixed(2);
                const totalPaidNum = Number(item.total_paid || 0);
        const formattedPaid = totalPaidNum.toFixed(2);
        const debtSumNum = Number(item.debt_sum || item.total_debt || 0);
        const debtSum = debtSumNum.toFixed(2);
        const formattedDate = item.date ? new Date(item.date).toLocaleDateString() : '—';
        const docTitle = item.doc_number || item.id;

        const isRepair = !item.customer_id || String(docTitle).startsWith('РЕМ');
        
        let counterpartyHtml = '';
        if (isRepair) {
            counterpartyHtml = `<span style="color: #334155; font-weight: 500;" title="Внутренний ремонт автомобиля">${item.counterparty_name || 'Ремонт а/м'}</span>`;
        } else {
            counterpartyHtml = `<span style="color: #334155;">${item.counterparty_name || 'Розничный покупатель'}</span>`;
        }

        const paidHtml = `<span style="color: #334155;">${formattedPaid}</span>`;

               return `
            <td><span style="font-weight: 600; color: #0f172a;"> ${docTitle}</span></td>
            <td><span style="color: #475569;">${formattedDate}</span></td>
            <td>${counterpartyHtml}</td>
            <td><span style="color: #334155;">${item.sklad_name || '—'}</span></td>
            <td style="text-align: right; color: #334155;">${partsSum}</td>
            <td style="text-align: right; color: #334155;">${worksSum}</td>
                       <td style="text-align: right; font-weight: 600; color: #0f172a;">${sum}</td>
            <td style="text-align: right; color: #d97706;">${returnedSum}</td>
            <td style="text-align: right;">${paidHtml}</td>
            <td style="text-align: right; font-weight: 500; color: ${debtSumNum > 0 ? '#991b1b' : '#334155'};">
                ${debtSum}
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
            <td><b>${item.doc_number || item.parent_id}</b></td>
            <td>${item.counterparty_name || '—'}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">${amount}</td>
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

        const isWork = item.item_type === 'work';
        const codeDisplay = isWork 
            ? '<span style="color: #334155; font-weight: 500;">Услуга</span>' 
            : `<span style="color: #475569;">${item.product_code || '—'}</span>`;

        return `
            <td><span style="font-weight: 500; color: #0f172a;">${item.doc_number || ''}</span></td>
            <td>${codeDisplay}</td>
            <td><span style="color: #0f172a;">${item.item_name || item.product_name || '—'}</span></td>
            <td style="text-align: center; color: #334155;">${qty}</td>
            <td style="text-align: right; color: #64748b;">${purchase}</td>
            <td style="text-align: right; text-decoration: line-through; color: #94a3b8;">${retail}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${finalPrice}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${total}</td>
        `;
    }
    },
        money_receipts_by_customers: {
    title: 'Покупатели по месяцам',
    columns: [
        { field: 'counterparty_name', label: 'Покупатель', width: '200px' },
        { field: 'sklad_name', label: 'Склад', width: '140px' },
        { field: 'total_orders', label: 'Заказов', width: '80px', align: 'center' },
        { field: 'total_qty', label: 'Кол-во', width: '80px', align: 'right' },
                { field: 'total_parts_sum', label: 'Запчасти', width: '110px', align: 'right' },
        { field: 'total_works_sum', label: 'Услуги', width: '110px', align: 'right' },
        { field: 'total_sum', label: 'Общая', width: '110px', align: 'right' },
        { field: 'total_returned_sum', label: 'Возврат', width: '100px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'total_debt', label: 'Долг', width: '110px', align: 'right' },
        { field: 'cumulative_debt', label: 'Долг накопительно', width: '120px', align: 'right' },
        { field: 'actions', label: 'Действие', width: '100px', align: 'center' }
    ],
    render: (item) => {
        const qty = Number(item.total_qty || 0).toFixed(2);
        const partsSum = Number(item.total_parts_sum || 0).toFixed(2);
        const worksSum = Number(item.total_works_sum || 0).toFixed(2);
                const totalSum = Number(item.total_sum || 0).toFixed(2);
        const returnedSum = Number(item.total_returned_sum || 0).toFixed(2);
        const totalPaidNum = Number(item.total_paid || 0);
        const totalPaid = totalPaidNum.toFixed(2);
        const totalDebtNum = Number(item.total_debt || 0);
        const totalDebt = totalDebtNum.toFixed(2);
        const cumulativeDebtNum = Number(item.cumulative_debt || 0);
        const cumulativeDebt = cumulativeDebtNum.toFixed(2);

        const paidHtml = totalPaidNum > 0
    ? `<span onclick="openCustomerPaymentHistory('${item.group_key}', '${item.counterparty_name}', '${item.month_str}')" style="cursor: pointer; text-decoration: underline; text-decoration-style: dotted;" title="Посмотреть историю оплат за месяц">${totalPaid}</span>`
    : totalPaid;

        return `
            <td><span style="font-weight: 600; color: #0f172a;">${item.counterparty_name || '—'}</span></td>
            <td><span style="color: #334155;">${item.sklad_name || '—'}</span></td>
            <td style="text-align: center; color: #334155;">${item.total_orders || 0}</td>
            <td style="text-align: right; color: #334155;">${qty}</td>
            <td style="text-align: right; color: #334155;">${partsSum}</td>
            <td style="text-align: right; color: #334155;">${worksSum}</td>
                       <td style="text-align: right; font-weight: 600; color: #0f172a;">${totalSum}</td>
            <td style="text-align: right; color: #d97706;">${returnedSum}</td>
            <td style="text-align: right; color: #334155;">${paidHtml}</td>
                       <td style="text-align: right; font-weight: 500; color: ${totalDebtNum > 0 ? '#991b1b' : '#334155'};">${totalDebt}</td>
            <td style="text-align: right; font-weight: 600; color: ${cumulativeDebtNum > 0 ? '#991b1b' : '#334155'};" title="${totalDebt} (за этот месяц) + ${(cumulativeDebtNum - totalDebtNum).toFixed(2)} (долг с прошлых месяцев)">
                ${cumulativeDebt}
                <div style="font-weight: 400; font-size: 11px; color: #94a3b8;">${totalDebt} + ${(cumulativeDebtNum - totalDebtNum).toFixed(2)}</div>
            </td>            
            <td style="text-align: center;">
              ${cumulativeDebtNum > 0
    ? `<button type="button" onclick="event.stopPropagation(); openReceiptCustomerPaymentDrawer('${item.group_key}', '${cumulativeDebt}', '${item.counterparty_name} (${item.month_str})', '${item.month_str}', '${window.currentSkladId || ''}')" style="background:#16a34a;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;">Оплатить</button>`
    : ''
}
            </td>
        `;
    }
    },

money_receipts_by_customers_totals: {
    title: 'Покупатели — общий долг',
    columns: [
        { field: 'counterparty_name', label: 'Покупатель', width: '200px' },
        { field: 'sklad_name', label: 'Склад', width: '140px' },
        { field: 'total_orders', label: 'Заказов', width: '80px', align: 'center' },
        { field: 'total_sum', label: 'Общая сумма', width: '120px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'total_debt', label: 'Долг (всего)', width: '120px', align: 'right' },
        { field: 'actions', label: 'Действие', width: '110px', align: 'center' }
    ],
    render: (item) => {
        const totalSum = Number(item.total_sum || 0).toFixed(2);
        const totalPaid = Number(item.total_paid || 0).toFixed(2);
        const debtNum = Number(item.total_debt || 0);
        const totalDebt = debtNum.toFixed(2);
        const actionHtml = debtNum <= 0
            ? `<span style="color:#64748b;font-weight:500;font-size:12px;">Оплачено</span>`
            : `<button type="button" onclick="event.stopPropagation(); openReceiptCustomerPaymentDrawer('${item.group_key}', '${totalDebt}', '${item.counterparty_name}', '', '${window.currentSkladId || ''}')" style="background:#16a34a;color:white;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;">Оплатить всё</button>`;
        return `
            <td><span style="font-weight:600;color:#0f172a;">${item.counterparty_name || '—'}</span></td>
            <td><span style="color:#334155;">${item.sklad_name || '—'}</span></td>
            <td style="text-align:center;color:#334155;">${item.total_orders || 0}</td>
            <td style="text-align:right;font-weight:600;color:#0f172a;">${totalSum}</td>
            <td style="text-align:right;color:#334155;">${totalPaid}</td>
            <td style="text-align:right;font-weight:600;color:${debtNum > 0 ? '#991b1b' : '#334155'};">${totalDebt}</td>
            <td style="text-align:center;">${actionHtml}</td>
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
            <td><span style="font-weight: 600; color: #0f172a;">${item.doc_number || ''}</span></td>
            <td><span style="font-weight: 500; color: #0f172a;">${item.work_name || '—'}</span></td>
            <td style="text-align: center; color: #334155;">${qty}</td>
            <td style="text-align: right; text-decoration: line-through; color: #94a3b8;">${retail}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${finalPrice}</td>
            <td style="text-align: center; color: #64748b; font-size: 11px;">${discountText}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${total}</td>
            <td style="color: #64748b; font-style: italic; font-size: 12px;">${desc}</td>
        `;
    }
    },

    expenses_by_sklad: {
    title: 'Аналитика расходов (закупок) по складам',
    columns: [
        { field: 'sklad_name', label: 'Склад', width: '200px' },
        { field: 'total_receipts', label: 'Закупок', width: '70px', align: 'center' },
        { field: 'total_suppliers', label: 'Поставщиков', width: '90px', align: 'center' },
        { field: 'total_expense_sum', label: 'Сумма закупки', width: '120px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '120px', align: 'right' },
        { field: 'total_debt', label: 'Долг', width: '120px', align: 'right' }
    ],
    render: (item) => {
        const totalQty = Number(item.total_qty || 0).toFixed(2);
        const expenseSum = Number(item.total_expense_sum || 0).toFixed(2);
        const totalPaid = Number(item.total_paid || 0).toFixed(2);
        const debtNum = Number(item.total_debt || 0);
        const totalDebt = debtNum.toFixed(2);

        return `
            <td><span style="color: #0f172a; font-weight: 500;">${item.sklad_name || 'Основной склад'}</span></td>
            <td style="text-align: center; color: #334155;">${item.total_receipts || 0}</td>
            <td style="text-align: center; color: #334155;">${item.total_suppliers || 0}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${expenseSum}</td>
            <td style="text-align: right; color: #334155;">${totalPaid}</td>
            <td style="text-align: right; font-weight: 500; color: ${debtNum > 0 ? '#991b1b' : '#334155'};">
                ${totalDebt}
            </td>
        `;
    }
    },
    expenses_by_suppliers: {
    title: 'Поставщик — по месяцам',
    columns: [
        { field: 'month_str', label: 'Месяц', width: '90px' },
        { field: 'sklad_name', label: 'Склад поступления', width: '120px' },
        { field: 'total_receipts', label: 'Закупок', width: '60px', align: 'center' },
        { field: 'total_qty', label: 'Кол-во', width: '70px', align: 'right' },
        { field: 'total_expense_sum', label: 'Закупка за месяц', width: '110px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено за месяц', width: '110px', align: 'right' },
        { field: 'total_debt', label: 'Долг за месяц', width: '110px', align: 'right' },
        { field: 'cumulative_debt', label: 'Долг накопительно', width: '120px', align: 'right' },
        { field: 'actions', label: 'Действие', width: '100px', align: 'center' }
    ],
    render: (item) => {
        const totalQty = Number(item.total_qty || 0).toFixed(2);
        const expenseSum = Number(item.total_expense_sum || 0).toFixed(2);
        const totalPaid = Number(item.total_paid || 0).toFixed(2);
        const debtNum = Number(item.total_debt || 0);
        const totalDebt = debtNum.toFixed(2);
        const cumulativeDebtNum = Number(item.cumulative_debt || 0);
        const cumulativeDebt = cumulativeDebtNum.toFixed(2);

        const prevMonthsAmount = cumulativeDebtNum - debtNum;
        const prevMonthsLabel = prevMonthsAmount >= 0
            ? `${totalDebt} (за этот месяц) + ${prevMonthsAmount.toFixed(2)} (долг с прошлых месяцев)`
            : `${totalDebt} (за этот месяц) − ${Math.abs(prevMonthsAmount).toFixed(2)} (погашено переплатой с прошлых месяцев)`;
        const prevMonthsSubtext = prevMonthsAmount >= 0
            ? `${totalDebt} + ${prevMonthsAmount.toFixed(2)}`
            : `${totalDebt} − ${Math.abs(prevMonthsAmount).toFixed(2)}`;

const actionHtml = cumulativeDebtNum <= 0
    ? `<span style="color: #64748b; font-weight: 500; font-size: 12px;">Оплачено</span>`
    : `<button type="button" onclick="event.stopPropagation(); openPaymentDrawer('${item.postavhik_id}', '${cumulativeDebt}', '${item.postavhik_name} (${item.month_str})', '${item.month_str}')" style="background: #16a34a; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
        Оплатить
      </button>`;

        return `
            <td><span style="font-weight: 600; color: #0f172a;">${item.month_str || '—'}</span></td>
            <td><span style="color: #334155;">${item.sklad_name || '—'}</span></td>
            <td style="text-align: center; color: #334155;">${item.total_receipts || 0}</td>
            <td style="text-align: right; color: #334155;">${totalQty}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${expenseSum}</td>
            <td style="text-align: right; color: #334155;">
                ${Number(item.total_paid || 0) > 0
                    ? `<span onclick="event.stopPropagation(); openSupplierPaymentHistory('${item.postavhik_id}', '${item.postavhik_name}', '${item.month_str}')" style="cursor: pointer; text-decoration: underline; text-decoration-style: dotted;" title="Посмотреть историю оплат">${totalPaid}</span>`
                    : totalPaid
                }
            </td>
            <td style="text-align: right; font-weight: 500; color: ${cumulativeDebtNum > 0 ? '#991b1b' : '#334155'};">
                ${totalDebt}
            </td>
            <td style="text-align: right; font-weight: 600; color: ${cumulativeDebtNum > 0 ? '#991b1b' : '#334155'};" title="${prevMonthsLabel}">
                ${cumulativeDebt}
                <div style="font-weight: 400; font-size: 11px; color: #94a3b8;">${prevMonthsSubtext}</div>
            </td>
            <td style="text-align: center;">
                ${actionHtml}
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
    expenses_by_suppliers_totals: {
    title: 'Поставщики — общий долг',
    columns: [
        { field: 'postavhik_name', label: 'Поставщик', width: '200px' },
        { field: 'total_receipts', label: 'Закупок', width: '70px', align: 'center' },
        { field: 'total_expense_sum', label: 'Сумма закупок', width: '120px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'total_debt', label: 'Долг (всего)', width: '120px', align: 'right' },
        { field: 'actions', label: 'Действие', width: '110px', align: 'center' }
    ],
    render: (item) => {
        const expenseSum = Number(item.total_expense_sum || 0).toFixed(2);
        const returnedSum = Number(item.total_returned_sum || 0).toFixed(2);
        const totalPaid = Number(item.total_paid || 0).toFixed(2);
        const debtNum = Number(item.total_debt || 0);
        const totalDebt = debtNum.toFixed(2);
        const actionHtml = debtNum <= 0
            ? `<span style="color: #64748b; font-weight: 500; font-size: 12px;">Оплачено</span>`
            : `<button type="button" onclick="event.stopPropagation(); openPaymentDrawer('${item.postavhik_id}', '${totalDebt}', '${item.postavhik_name}', '')" style="background: #16a34a; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">
                Оплатить всё
              </button>`;

        return `
            <td><span style="font-weight: 600; color: #0f172a;">${item.postavhik_name || 'Основной поставщик'}</span></td>
            <td style="text-align: center; color: #334155;">${item.total_receipts || 0}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${expenseSum}</td>
            <td style="text-align: right; color: #334155;">${totalPaid}</td>
            <td style="text-align: right; font-weight: 600; color: ${debtNum > 0 ? '#991b1b' : '#334155'};">
                ${totalDebt}
            </td>
            <td style="text-align: center;">
                ${actionHtml}
            </td>
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
        { field: 'total_returned_sum', label: 'Возврат', width: '100px', align: 'right' },
        { field: 'total_paid', label: 'Оплачено', width: '110px', align: 'right' },
        { field: 'debt_sum', label: 'Долг', width: '110px', align: 'right' }
    ],
    render: (item) => {
        const qty = Number(item.total_qty || 0).toFixed(2);
        const sum = Number(item.total_expense_sum || 0).toFixed(2);
        const returnedSum = Number(item.total_returned_sum || 0).toFixed(2);
        const totalPaidNum = Number(item.total_paid || 0);
        const formattedPaid = totalPaidNum.toFixed(2);
        const debtSumNum = Number(item.debt_sum || 0);
        const debtSum = debtSumNum.toFixed(2);
        const formattedDate = item.date ? new Date(item.date).toLocaleDateString() : '—';
        const docTitle = item.doc_number || item.id;

        const paidHtml = `<span style="color: #334155;">${formattedPaid}</span>`;

        return `
            <td><span style="font-weight: 600; color: #0f172a;"> ${docTitle}</span></td>
            <td><span style="color: #475569;">${formattedDate}</span></td>
            <td><span style="color: #0f172a;">${item.postavhik_name || '—'}</span></td>
            <td><span style="color: #334155;">${item.sklad_name || '—'}</span></td>
            <td style="text-align: right; color: #334155;">${qty}</td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${sum}</td>
            <td style="text-align: right; color: #d97706;">${returnedSum}</td>
            <td style="text-align: right;">${paidHtml}</td>
            <td style="text-align: right; font-weight: 500; color: ${debtSumNum > 0 ? '#991b1b' : '#334155'};">
                ${debtSum}
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
            <td><span style="color: #475569;">${date}</span></td>
            <td><span style="font-weight: 600; color: #0f172a;"> ${item.doc_number || item.parent_id}</span></td>
            <td><span style="color: #0f172a;">${item.postavhik_name || '—'}</span></td>
            <td style="text-align: right; font-weight: 600; color: #0f172a;">${amount}</td>
            <td style="color: #64748b; font-size: 13px; font-style: italic;">${item.comment || '—'}</td>
        `;
    }
    }

}


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
        drawer.style.width = '420px';
    }
    if (backdrop) {
        backdrop.style.opacity = '0';
        backdrop.style.pointerEvents = 'none';
    }

}

function formatCarModelLabel(m) {
    const fmtDate = (s) => {
        if (!s) return '';
        const p = String(s).substring(0, 10).split('-');
        return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : '';
    };
    const brand = (m.brand_name || '').trim();
    const name = (m.name || '').trim();
    const title = (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) ? `${brand} ${name}` : name;
    const engineFuel = `${m.engine || ''} ${m.toplivo_name || ''}`.trim();
    const dates = (m.start_date || m.end_date) ? `${fmtDate(m.start_date)} - ${fmtDate(m.end_date)}` : '';
    return [title, m.body_name, engineFuel, dates].filter(Boolean).join(' | ');
}

async function openEntityForm(entity, item = null, parentId = null) {
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    const serverGeneratesDocNumber = ['receipts', 'moves', 'realizations'];

    if (!item || item.id === null || item.id === undefined || item.id === '') {
        if (serverGeneratesDocNumber.includes(entity)) {
            item = {
                id: null,
                doc_number: '(будет присвоен автоматически)',
                is_posted: false
            };
        } else {
            let nextId = 1;
            let prefix = 'Р-';

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
                id: null,
                doc_number: `${prefix}${nextId}`,
                is_posted: false 
            };
        }

     config.columns.forEach(col => {
    if (col.field === 'fact_date') return; 
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

    if (entity === 'postavhik_contacts' && parentId) {
        html += `<input type="hidden" name="postavhik_id" value="${parentId}">`;
    } else if (entity === 'customer_contacts' && parentId) {
        html += `<input type="hidden" name="customer_id" value="${parentId}">`;
    } else if (entity === 'car_details' && parentId) {
        html += `<input type="hidden" name="car_id" value="${parentId}">`;
    } else if (entity === 'moves') {
    } 

    async function renderField(col) {
        if (col.field === 'id' || col.field === 'dtp_id' || col.field === 'counterparty_id' || col.field === 'postavhik_id' || col.field === 'realization_id' || col.field === 'move_id' || col.field === 'repair_id' || col.field === 'receipt_id') return '';
        if (col.field === 'car_id' && parentId) return '';
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

               if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');
            let optionsHtml = `<option value="">-- Не выбрано --</option>`;

            statusItems.forEach(st => {
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                optionsHtml += `<option value="${st.id}" ${selected}>${st.name}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.field === 'role') {
            const isAdminViewer = localStorage.getItem('userRole') === 'admin';
            const currentRole = val || 'employee';
            // Не-админ вообще не может трогать это поле — select будет disabled
            // и браузер просто не отправит его значение при сохранении формы.
            inputHtml = `
                <select name="${col.field}" ${!isAdminViewer ? 'disabled' : ''} style="${controlStyle}">
                    <option value="employee" ${currentRole !== 'admin' ? 'selected' : ''}>Сотрудник</option>
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Админ</option>
                </select>
            `;
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
                if (entity === 'cars' && referenceName === 'models') {
                    window.carModelsById = {};
                    refItems = refItems.map(m => {
                        window.carModelsById[m.id] = m;
                        return { ...m, name: formatCarModelLabel(m) };
                    });
                }
            }

            let extraAttributes = '';
            let customId = '';
            if (col.field === 'car_id') { customId = 'car-select'; extraAttributes = 'id="car-select"'; }
            else if (col.field === 'customer_id') { customId = 'customer-select'; extraAttributes = 'id="customer-select"'; }
            else if (col.field === 'zaphasti_id') { customId = 'zaphasti-select'; extraAttributes = 'id="zaphasti-select"'; }
            else if (col.field === 'vidy_rabot_id') { customId = 'vidy-rabot-select'; extraAttributes = 'id="vidy-rabot-select"'; }
            else if (col.field === 'warehouse_from_id' || col.field === 'warehouse_id' || col.field === 'skald_id') { customId = col.field; extraAttributes = `id="${col.field}" class="warehouse-select"`; }
            else if (col.field === 'warehouse_to_id') { customId = 'warehouse_to_id'; extraAttributes = 'id="warehouse_to_id" class="warehouse-select"'; }
            else if (col.field === 'mol_from_id' || col.field === 'mol_to_id' || col.field === 'mol_id') { customId = col.field; extraAttributes = `id="${col.field}" class="mol-select"`; }

            if (refItems.length > 10 && !fieldReadonly) {
                let selectedDisplayName = '';
                refItems.forEach(refItem => {
                    if (String(refItem.id) === String(val)) {
                        if (referenceName === 'customer_cars' || referenceName === 'cars') {
                            const gos = refItem.gos_number || refItem.car_number || '';
                            const mdl = refItem.model || refItem.car_model || '';
                            const brd = refItem.brand || refItem.car_brand || '';
                            selectedDisplayName = (brd || mdl || gos) ? `${brd} ${mdl} (${gos})`.trim() : `Авто #${refItem.id}`;
                        } else if (referenceName === 'zaphasti') {
                            const art = refItem.article ? `[${refItem.article}] ` : '';
                            const nm = refItem.name || refItem.title || '';
                            selectedDisplayName = `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                        } else if (referenceName === 'mol') {
                            selectedDisplayName = refItem.user_fio || refItem.name || refItem.login || `МОЛ #${refItem.id}`;
                        } else {
                            selectedDisplayName = refItem.user_fio || refItem.name || refItem.login || refItem.name_full || refItem.title || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                        }
                    }
                });

                inputHtml = `
                    <div class="searchable-select-container" style="position: relative;">
                        <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off">
                        <input type="hidden" name="${col.field}" ${extraAttributes} value="${val !== '' && val !== null ? val : ''}">
                        <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                            <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                `;
                refItems.forEach(refItem => {
                    let displayName = '';
                    if (referenceName === 'customer_cars' || referenceName === 'cars') {
                        const gos = refItem.gos_number || refItem.car_number || '';
                        const mdl = refItem.model || refItem.car_model || '';
                        const brd = refItem.brand || refItem.car_brand || '';
                        displayName = (brd || mdl || gos) ? `${brd} ${mdl} (${gos})`.trim() : `Авто #${refItem.id}`;
                    } else if (referenceName === 'zaphasti') {
                        const art = refItem.article ? `[${refItem.article}] ` : '';
                        const nm = refItem.name || refItem.title || '';
                        displayName = `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                    } else if (referenceName === 'mol') {
                        displayName = refItem.user_fio || refItem.name || refItem.login || (refItem.description && !refItem.description.includes('#') ? refItem.description : '') || `МОЛ #${refItem.id}`;
                    } else {
                        displayName = refItem.user_fio || refItem.name || refItem.login || refItem.name_full || refItem.title || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                    }
                    inputHtml += `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                });
                inputHtml += `</div></div>`;
            } else {
                let optionsHtml = `<option value="">-- Не выбрано --</option>`;
                refItems.forEach(refItem => {
                    let displayName = '';
                    if (referenceName === 'customer_cars' || referenceName === 'cars') {
                        const gos = refItem.gos_number || refItem.car_number || '';
                        const mdl = refItem.model || refItem.car_model || '';
                        const brd = refItem.brand || refItem.car_brand || '';
                        displayName = (brd || mdl || gos) ? `${brd} ${mdl} (${gos})`.trim() : `Авто #${refItem.id}`;
                    } else {
                        if (referenceName === 'zaphasti') {
                            const art = refItem.article ? `[${refItem.article}] ` : '';
                            const nm = refItem.name || refItem.title || '';
                            displayName = `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                                              } else if (referenceName === 'mol') {
                            displayName = refItem.user_fio || refItem.name || refItem.login || (refItem.description && !refItem.description.includes('#') ? refItem.description : '') || `МОЛ #${refItem.id}`;
                        } else if (referenceName === 'ed_izmereniya') {
                            displayName = refItem.short_name || refItem.name || `Ед.изм. #${refItem.id}`;
                        } else {
                            displayName = refItem.user_fio || refItem.name || refItem.login || refItem.name_full || refItem.title || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                        }
                    }

                    const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                    optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
                });

                inputHtml = `<select name="${col.field}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
            }
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
        } else if (col.field === 'password_hash') {
            const isEditingExisting = item && item.id;
            const pwPlaceholder = isEditingExisting ? 'Оставьте пустым, чтобы не менять пароль' : '';
            inputHtml = `<input type="password" name="${col.field}" value="" autocomplete="new-password" placeholder="${pwPlaceholder}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
        } else {
            const inputType = 'text';
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
    } else {
        for (const col of config.columns) {
            if (col.field === 'car_id') continue; 

            if (entity === 'cars' && (col.field === 'body' || col.field === 'engine' || col.field === 'toplivo_id')) {
                const hv = (item && item[col.field] != null) ? item[col.field] : '';
                html += `<input type="hidden" name="${col.field}" value="${String(hv).replace(/"/g, '&quot;')}">`;
                continue;
            }

            html += await renderField(col);

            if (entity === 'cars' && col.field === 'model_id') {
                const mv = (item && item.model != null) ? item.model : '';
                html += `<input type="hidden" name="model" value="${String(mv).replace(/"/g, '&quot;')}">`;
            }

            if (col.field === 'customer_id' && carCol && entity !== 'repairs') {
                html += await renderField(carCol);
            }
        }

        if (carCol && !config.columns.some(c => c.field === 'customer_id') && entity !== 'repairs') {
            html += await renderField(carCol);
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

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                if (text.includes(filter) || opt.dataset.id === '') {
                    opt.style.display = 'block';
                } else {
                    opt.style.display = 'none';
                }
            });
        });

               options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    const customerSelect = formElement.querySelector('#customer-select');
    const carSelect = formElement.querySelector('#car-select');
    const zaphastiSelect = formElement.querySelector('#zaphasti-select');
    const vidyRabotSelect = formElement.querySelector('#vidy-rabot-select');

    if (entity === 'cars') {
        const modelField = formElement.querySelector('[name="model_id"]');
        if (modelField) {
            modelField.addEventListener('change', () => {
                const m = (window.carModelsById || {})[modelField.value];
                const setVal = (fieldName, v) => {
                    const el = formElement.querySelector(`[name="${fieldName}"]`);
                    if (el) el.value = (v === undefined || v === null) ? '' : v;
                };
                setVal('model', m ? m.name : '');
                setVal('body', m ? m.body_name : '');
                setVal('engine', m ? `${m.engine || ''} ${m.toplivo_name || ''}`.trim() : '');
                setVal('toplivo_id', m ? m.toplivo_id : '');
            });
        }
    }

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
            const priceInput = formElement.querySelector('[name="price"]');
            
            if (!selectedWorkId) {
                if (priceInput) priceInput.value = '';
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
                                'realization_works', 'accident_invoices', 
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

        let pendingPasswordChange = null;
        if ((entity === 'users' || entity === 'employees') && item && item.id && Object.prototype.hasOwnProperty.call(data, 'password_hash')) {
            const newPasswordValue = (data.password_hash || '').trim();
            delete data.password_hash;
            if (newPasswordValue) {
                if (newPasswordValue.length < 4) {
                    showAppNotification('Пароль должен содержать не менее 4 символов', 'error');
                    if (saveButton) saveButton.disabled = false;
                    isSubmitting = false;
                    return;
                }
                pendingPasswordChange = newPasswordValue;
            }
        }

        if (data.is_posted !== undefined && data.is_posted !== '') {
            data.is_posted = data.is_posted === 'true' || data.is_posted === true || data.is_posted === '1' || data.is_posted === 1;
        }
      else if (entity === 'counterparty_contacts' && parentId) {
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

            if (pendingPasswordChange) {
                const pwResponse = await fetch(`/api/${entity}/${item.id}/change-password`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_password: pendingPasswordChange })
                });
                if (!pwResponse.ok) {
                    const pwErrData = await pwResponse.json().catch(() => ({}));
                    showAppNotification(pwErrData.error || 'Ошибка при смене пароля', 'error');
                    if (saveButton) saveButton.disabled = false;
                    isSubmitting = false;
                    return;
                }
            }

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

                if (!isEdit) {
                    selectedItem = null;
                }

                const detailEntities = [
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
                if (saveButton) saveButton.disabled = false;
                isSubmitting = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveButton) saveButton.disabled = false;
            isSubmitting = false;
        }
    });
}

async function openRealizationWorksForm(item = null, parentId = null) {
    const entity = 'realization_works';
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    if (!item || item.id === null || item.id === undefined || item.id === '') {
        item = { id: null };
    }

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    if (parentId) {
        html += `<input type="hidden" name="realization_id" value="${parentId}">`;
    }

    const allowedFields = ['vidy_rabot_id', 'quantity', 'price', 'description'];

    function formatDisplayName(referenceName, refItem) {
        if (referenceName === 'vidy_rabot') {
            return refItem.name || refItem.title || `Работа #${refItem.id}`;
        }
        return refItem.name || refItem.title || `Запись #${refItem.id}`;
    }

    async function renderField(col) {
        if (!allowedFields.includes(col.field)) return '';
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
        const controlStyle = 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.ref) {
            const referenceName = col.ref;
            const refItems = await fetchReferenceData(referenceName);

            let extraAttributes = '';
            if (col.field === 'vidy_rabot_id') extraAttributes = 'id="vidy-rabot-select"';

            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) {
                    selectedDisplayName = formatDisplayName(referenceName, refItem);
                }
            });

            inputHtml = `
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off">
                    <input type="hidden" name="${col.field}" ${extraAttributes} value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
            `;
            refItems.forEach(refItem => {
                const displayName = formatDisplayName(referenceName, refItem);
                inputHtml += `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
            });
            inputHtml += `</div></div>`;
        } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else if (col.field === 'price' || col.field === 'quantity') {
            inputHtml = `<input type="number" step="0.01" name="${col.field}" value="${val}" style="${controlStyle}">`;
        } else {
            inputHtml = `<input type="text" name="${col.field}" value="${val}" style="${controlStyle}">`;
        }

        return `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label}:
                ${inputHtml}
            </label>
        `;
    }

    for (const col of config.columns) {
        html += await renderField(col);
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

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                if (text.includes(filter) || opt.dataset.id === '') {
                    opt.style.display = 'block';
                } else {
                    opt.style.display = 'none';
                }
            });
        });

        options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    const vidyRabotSelect = formElement.querySelector('#vidy-rabot-select');
    if (vidyRabotSelect) {
        vidyRabotSelect.addEventListener('change', async () => {
            const selectedWorkId = vidyRabotSelect.value;
            const priceInput = formElement.querySelector('[name="price"]');

            if (!selectedWorkId) {
                if (priceInput) priceInput.value = '';
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
            data.realization_id = parentId;
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
                if (parentId) {
                    loadDetailData(entity, parentId);
                            refreshData();

                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                if (saveButton) saveButton.disabled = false;
                isSubmitting = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveButton) saveButton.disabled = false;
            isSubmitting = false;
        }
    });
}

async function openRepairWorksForm(item = null, parentId = null) {
    const entity = 'repair_works';
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    if (!item || item.id === null || item.id === undefined || item.id === '') {
        item = { id: null };
    }

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    if (parentId) {
        html += `<input type="hidden" name="repair_id" value="${parentId}">`;
    }

    const allowedFields = ['ispolnitel_id', 'vidy_rabot_id', 'price', 'description'];

    function formatDisplayName(referenceName, refItem) {
        if (referenceName === 'vidy_rabot') {
            return refItem.name || refItem.title || `Работа #${refItem.id}`;
        }
        if (referenceName === 'ispolnitel') {
            return refItem.name || refItem.title || `Исполнитель #${refItem.id}`;
        }
        return refItem.name || refItem.title || `Запись #${refItem.id}`;
    }

    async function renderField(col) {
        if (!allowedFields.includes(col.field)) return '';
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
        const controlStyle = 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.ref) {
            const referenceName = col.ref;
            const refItems = await fetchReferenceData(referenceName);

            let extraAttributes = '';
            if (col.field === 'vidy_rabot_id') extraAttributes = 'id="vidy-rabot-select"';
            else if (col.field === 'ispolnitel_id') extraAttributes = 'id="ispolnitel-select"';

            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) {
                    selectedDisplayName = formatDisplayName(referenceName, refItem);
                }
            });

            inputHtml = `
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off">
                    <input type="hidden" name="${col.field}" ${extraAttributes} value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
            `;
            refItems.forEach(refItem => {
                const displayName = formatDisplayName(referenceName, refItem);
                inputHtml += `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
            });
            inputHtml += `</div></div>`;
        } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else if (col.field === 'price') {
            inputHtml = `<input type="number" step="0.01" name="${col.field}" value="${val}" style="${controlStyle}">`;
        } else {
            inputHtml = `<input type="text" name="${col.field}" value="${val}" style="${controlStyle}">`;
        }

        return `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label}:
                ${inputHtml}
            </label>
        `;
    }

    for (const col of config.columns) {
        html += await renderField(col);
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

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                if (text.includes(filter) || opt.dataset.id === '') {
                    opt.style.display = 'block';
                } else {
                    opt.style.display = 'none';
                }
            });
        });

        options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    const vidyRabotSelect = formElement.querySelector('#vidy-rabot-select');
    if (vidyRabotSelect) {
        vidyRabotSelect.addEventListener('change', async () => {
            const selectedWorkId = vidyRabotSelect.value;
            const priceInput = formElement.querySelector('[name="price"]');

            if (!selectedWorkId) {
                if (priceInput) priceInput.value = '';
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
                if (parentId) {
                    loadDetailData(entity, parentId);
                            refreshData();

                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                if (saveButton) saveButton.disabled = false;
                isSubmitting = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveButton) saveButton.disabled = false;
            isSubmitting = false;
        }
    });
}

async function openReceiptItemsForm(item = null, parentId = null) {
    const entity = 'receipt_items';
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    if (!item || item.id === null || item.id === undefined || item.id === '') {
        item = {
            id: null,
            currency: 'Рубль ПМР'
        };
    } else {
        if (!item.currency) {
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

    if (parentId) {
        html += `<input type="hidden" name="receipt_id" value="${parentId}">`;
    }

    const allowedFields = ['zaphasti_id', 'quantity', 'price', 'currency', 'description'];

    async function renderField(col) {
        if (!allowedFields.includes(col.field)) return '';
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

        if (col.field === 'currency' && !val) {
            val = 'Рубль ПМР';
        }

        let inputHtml = '';
        let fieldReadonly = col.readonly;
        if (isPosted) {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;'
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.ref) {
            const referenceName = col.ref;
            const refItems = await fetchReferenceData(referenceName);

            let extraAttributes = '';
            if (col.field === 'zaphasti_id') extraAttributes = 'id="zaphasti-select"';

            const formatDisplayName = (refItem) => {
                if (referenceName === 'zaphasti') {
                    const art = refItem.article ? `[${refItem.article}] ` : '';
                    const nm = refItem.name || refItem.title || '';
                    return `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                }
                return refItem.name || refItem.title || `Запись #${refItem.id}`;
            };

            if (refItems.length > 10 && !fieldReadonly) {
                let selectedDisplayName = '';
                refItems.forEach(refItem => {
                    if (String(refItem.id) === String(val)) {
                        selectedDisplayName = formatDisplayName(refItem);
                    }
                });

                inputHtml = `
                    <div class="searchable-select-container" style="position: relative;">
                        <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off">
                        <input type="hidden" name="${col.field}" ${extraAttributes} value="${val !== '' && val !== null ? val : ''}">
                        <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                            <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                `;
                refItems.forEach(refItem => {
                    const displayName = formatDisplayName(refItem);
                    inputHtml += `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                });
                inputHtml += `</div></div>`;
            } else {
                let optionsHtml = `<option value="">-- Не выбрано --</option>`;
                refItems.forEach(refItem => {
                    const displayName = formatDisplayName(refItem);
                    const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                    optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
                });
                inputHtml = `<select name="${col.field}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
            }
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

    for (const col of config.columns) {
        html += await renderField(col);
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    ${!isPosted ? '<button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>' : '<div style="flex: 1; color: #16a34a; font-weight: 600; font-size: 13px; display: flex; align-items: center;">Документ проведен и заблокирован от изменений</div>'}
                    ${item && item.id && !isPosted ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                opt.style.display = (text.includes(filter) || opt.dataset.id === '') ? 'block' : 'none';
            });
        });

        options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    const zaphastiSelect = formElement.querySelector('#zaphasti-select');
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
            data.receipt_id = parentId;
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
                if (parentId) {
                    loadDetailData(entity, parentId);
                    refreshData();
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                if (saveButton) saveButton.disabled = false;
                isSubmitting = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveButton) saveButton.disabled = false;
            isSubmitting = false;
        }
    });
}


async function openMoveItemsForm(item = null, parentId = null) {
    const entity = 'move_items';
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    if (!item || item.id === null || item.id === undefined || item.id === '') {
        item = {
            id: null
        };
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    if (parentId) {
        html += `<input type="hidden" name="move_id" value="${parentId}">`;
    }

    const allowedFields = ['zaphasti_id', 'quantity', 'description'];

    async function renderField(col) {
        if (!allowedFields.includes(col.field)) return '';
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
        if (isPosted) {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;'
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

        if (col.ref) {
            const referenceName = col.ref;
            const refItems = await fetchReferenceData(referenceName);

            let extraAttributes = '';
            if (col.field === 'zaphasti_id') extraAttributes = 'id="zaphasti-select"';

            const formatDisplayName = (refItem) => {
                if (referenceName === 'zaphasti') {
                    const art = refItem.article ? `[${refItem.article}] ` : '';
                    const nm = refItem.name || refItem.title || '';
                    return `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                }
                return refItem.name || refItem.title || `Запись #${refItem.id}`;
            };

            if (refItems.length > 10 && !fieldReadonly) {
                let selectedDisplayName = '';
                refItems.forEach(refItem => {
                    if (String(refItem.id) === String(val)) {
                        selectedDisplayName = formatDisplayName(refItem);
                    }
                });

                inputHtml = `
                    <div class="searchable-select-container" style="position: relative;">
                        <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off">
                        <input type="hidden" name="${col.field}" ${extraAttributes} value="${val !== '' && val !== null ? val : ''}">
                        <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                            <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                `;
                refItems.forEach(refItem => {
                    const displayName = formatDisplayName(refItem);
                    inputHtml += `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                });
                inputHtml += `</div></div>`;
            } else {
                let optionsHtml = `<option value="">-- Не выбрано --</option>`;
                refItems.forEach(refItem => {
                    const displayName = formatDisplayName(refItem);
                    const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                    optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
                });
                inputHtml = `<select name="${col.field}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
            }
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

    for (const col of config.columns) {
        html += await renderField(col);
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    ${!isPosted ? '<button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>' : '<div style="flex: 1; color: #16a34a; font-weight: 600; font-size: 13px; display: flex; align-items: center;">Документ проведен и заблокирован от изменений</div>'}
                    ${item && item.id && !isPosted ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                opt.style.display = (text.includes(filter) || opt.dataset.id === '') ? 'block' : 'none';
            });
        });

        options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    const zaphastiSelect = formElement.querySelector('#zaphasti-select');
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
            data.move_id = parentId;
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
                if (parentId) {
                    loadDetailData(entity, parentId);
                    refreshData();
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                if (saveButton) saveButton.disabled = false;
                isSubmitting = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveButton) saveButton.disabled = false;
            isSubmitting = false;
        }
    });
}

async function openRepairItemsForm(item = null, parentId = null) {
    const entity = 'repair_items';
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    if (!item || item.id === null || item.id === undefined || item.id === '') {
        item = {
            id: null
        };
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    if (parentId) {
        html += `<input type="hidden" name="repair_id" value="${parentId}">`;
    }

    async function renderField(col) {
        if (col.field === 'id' || col.field === 'dtp_id' || col.field === 'counterparty_id' || col.field === 'postavhik_id' || col.field === 'realization_id' || col.field === 'move_id' || col.field === 'repair_id' || col.field === 'receipt_id') return '';
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
            const refItems = await fetchReferenceData(referenceName);
            let extraAttributes = '';

            const formatDisplayName = (refItem) => {
                if (referenceName === 'zaphasti') {
                    const art = refItem.article ? `[${refItem.article}] ` : '';
                    const nm = refItem.name || refItem.title || '';
                    return `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                }
                return refItem.name || refItem.title || `Запись #${refItem.id}`;
            };

            if (refItems.length > 10 && !fieldReadonly) {
                let selectedDisplayName = '';
                refItems.forEach(refItem => {
                    if (String(refItem.id) === String(val)) {
                        selectedDisplayName = formatDisplayName(refItem);
                    }
                });

                inputHtml = `
                    <div class="searchable-select-container" style="position: relative;">
                        <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off">
                        <input type="hidden" name="${col.field}" ${extraAttributes} value="${val !== '' && val !== null ? val : ''}">
                        <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                            <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                `;
                refItems.forEach(refItem => {
                    const displayName = formatDisplayName(refItem);
                    inputHtml += `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                });
                inputHtml += `</div></div>`;
            } else {
                let optionsHtml = `<option value="">-- Не выбрано --</option>`;
                refItems.forEach(refItem => {
                    const displayName = formatDisplayName(refItem);
                    const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                    optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
                });
                inputHtml = `<select name="${col.field}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
            }
        } else if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
            let formattedVal = '';
            if (val) {
                const d = new Date(val);
                if (!isNaN(d)) {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const h = String(d.getHours()).padStart(2, '0');
                    const mm = String(d.getMinutes()).padStart(2, '0');
                    formattedVal = `${y}-${m}-${dd}T${h}:${mm}`;
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

    for (const col of config.columns) {
        html += await renderField(col);
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    ${!isPosted ? '<button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>' : '<div style="flex: 1; color: #16a34a; font-weight: 600; font-size: 13px; display: flex; align-items: center;">Документ проведен и заблокирован от изменений</div>'}
                    ${item && item.id && !isPosted ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                opt.style.display = (text.includes(filter) || opt.dataset.id === '') ? 'block' : 'none';
            });
        });

        options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

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
                if (parentId) {
                    loadDetailData(entity, parentId);
                    refreshData();
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                if (saveButton) saveButton.disabled = false;
                isSubmitting = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveButton) saveButton.disabled = false;
            isSubmitting = false;
        }
    });
}

async function openRealizationItemsForm(item = null, parentId = null) {
    const entity = 'realization_items';
    const config = getConfig(entity);
    const drawer = getOrCreateDrawer();

    if (!item || item.id === null || item.id === undefined || item.id === '') {
        item = {
            id: null,
            currency: 'Рубль ПМР'
        };
    } else {
        if (!item.currency) {
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

    if (parentId) {
        html += `<input type="hidden" name="realization_id" value="${parentId}">`;
    }

const allowedFields = ['zaphasti_id', 'quantity', 'markup_percent', 'is_manual_price', 'price', 'description'];
    async function renderField(col) {
        if (!allowedFields.includes(col.field)) return '';
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

        if (col.field === 'currency' && !val) {
            val = 'Рубль ПМР';
        }
if (col.field === 'markup_percent' && !val) {
    val = 30;
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
            const refItems = await fetchReferenceData(referenceName);

            let extraAttributes = '';
            if (col.field === 'zaphasti_id') extraAttributes = 'id="zaphasti-select"';

            const formatDisplayName = (refItem) => {
                if (referenceName === 'zaphasti') {
                    const art = refItem.article ? `[${refItem.article}] ` : '';
                    const nm = refItem.name || refItem.title || '';
                    return `${art}${nm}`.trim() || `Запчасть #${refItem.id}`;
                }
                return refItem.name || refItem.title || `Запись #${refItem.id}`;
            };

            if (refItems.length > 10 && !fieldReadonly) {
                let selectedDisplayName = '';
                refItems.forEach(refItem => {
                    if (String(refItem.id) === String(val)) {
                        selectedDisplayName = formatDisplayName(refItem);
                    }
                });

                inputHtml = `
                    <div class="searchable-select-container" style="position: relative;">
                        <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off">
                        <input type="hidden" name="${col.field}" ${extraAttributes} value="${val !== '' && val !== null ? val : ''}">
                        <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                            <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                `;
                refItems.forEach(refItem => {
                    const displayName = formatDisplayName(refItem);
                    inputHtml += `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                });
                inputHtml += `</div></div>`;
            } else {
                let optionsHtml = `<option value="">-- Не выбрано --</option>`;
                refItems.forEach(refItem => {
                    const displayName = formatDisplayName(refItem);
                    const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                    optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
                });
                inputHtml = `<select name="${col.field}" ${extraAttributes} ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
            }
                } else if (col.field === 'description') {
            inputHtml = `<textarea name="${col.field}" rows="4" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else if (col.field === 'is_manual_price') {
            const checked = (val === true || val === 'true' || val === 1 || val === '1') ? 'checked' : '';
            inputHtml = `<input type="checkbox" id="manual-price-toggle" name="${col.field}" ${checked} onchange="document.getElementById('price-input').disabled = !this.checked; document.getElementById('price-input').style.background = this.checked ? '#ffffff' : '#f1f5f9';">`;
        } else if (col.field === 'price') {
            const isManualNow = (item && (item.is_manual_price === true || item.is_manual_price === 'true'));
            inputHtml = `<input type="text" id="price-input" name="price" value="${val}" ${!isManualNow ? 'disabled' : ''} style="${controlStyle} ${!isManualNow ? 'background:#f1f5f9;' : ''}">`;
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

    for (const col of config.columns) {
        html += await renderField(col);
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    ${!isPosted ? '<button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>' : '<div style="flex: 1; color: #16a34a; font-weight: 600; font-size: 13px; display: flex; align-items: center;">Документ проведен и заблокирован от изменений</div>'}
                    ${item && item.id && !isPosted ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                opt.style.display = (text.includes(filter) || opt.dataset.id === '') ? 'block' : 'none';
            });
        });

        options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    const zaphastiSelect = formElement.querySelector('#zaphasti-select');
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
            data.realization_id = parentId;
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
                if (parentId) {
                    loadDetailData(entity, parentId);
                    refreshData();
                } else {
                    refreshData();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении данных', 'error');
                if (saveButton) saveButton.disabled = false;
                isSubmitting = false;
            }
        } catch (err) {
            showAppNotification('Ошибка соединения с сервером', 'error');
            if (saveButton) saveButton.disabled = false;
            isSubmitting = false;
        }
    });
}


async function openAccidentForm(entity, item = null, parentId = null) {

    const drawer = getOrCreateDrawer();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const currentDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (entity === 'accidents') {
        const config = getConfig('accidents');

               if (!item || !item.id) {
   
            item = { doc_number: '(будет присвоен автоматически)' };

            config.columns.forEach(col => {
                if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
                    if (!item[col.field]) item[col.field] = currentDateTime;
                }
            });
        }

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
                <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
            </div>
            <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="accidents" data-item-id="${item && item.id ? item.id : ''}">
        `;

        async function renderAccidentField(col) {
            if (col.field === 'id') return '';
            if (col.insert === false && (!item || !item.id)) return '';
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
                if (val && typeof val === 'object' && val.id !== undefined) val = val.id;
            }

            let inputHtml = '';
            const fieldReadonly = col.readonly;
            const controlStyle = fieldReadonly
                ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;'
                : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

                        if (col.ref === 'cars') {
                const refItems = await fetchReferenceData(col.ref);

                const buildDisplayName = (refItem) => {
                    const gos = refItem.gos_number || refItem.car_number || '';
                    const mdl = refItem.model || refItem.car_model || '';
                    return gos ? `${gos}${mdl ? ' (' + mdl + ')' : ''}` : `Авто #${refItem.id}`;
                };

                let selectedDisplayName = '';
                refItems.forEach(refItem => {
                    if (String(refItem.id) === String(val)) {
                        selectedDisplayName = buildDisplayName(refItem);
                    }
                });

                inputHtml = `
                    <div class="searchable-select-container" style="position: relative;">
                        <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off" ${fieldReadonly ? 'disabled' : ''}>
                        <input type="hidden" name="${col.field}" id="accident-car-select" value="${val !== '' && val !== null ? val : ''}">
                        <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                            <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                            ${refItems.map(refItem => `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${buildDisplayName(refItem)}</div>`).join('')}
                        </div>
                    </div>
                `;
            } else if (col.ref) {
                const refItems = await fetchReferenceData(col.ref);
                let optionsHtml = `<option value="">-- Не выбрано --</option>`;

                refItems.forEach(refItem => {
                    const displayName = refItem.name || refItem.title || `Запись #${refItem.id}`;
                    const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                    optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
                });

                inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
            }else if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
                let formattedVal = '';
                if (val) {
                    const d = new Date(val);
                    if (!isNaN(d)) {
                        formattedVal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    }
                }
                inputHtml = `<input type="datetime-local" name="${col.field}" value="${formattedVal}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
            } else if (col.field === 'description') {
                inputHtml = `<textarea name="${col.field}" rows="4" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
            } else if (col.field === 'damage_amount' || col.field === 'account_number' || col.field === 'paid_amount') {
                inputHtml = `<input type="number" step="0.01" name="${col.field}" value="${val}" ${fieldReadonly ? 'readonly' : ''} style="${controlStyle}">`;
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

        for (const col of config.columns) {
            html += await renderAccidentField(col);
        }

        html += `
                    <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                        <button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Сохранить</button>
                        ${item && item.id ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Удалить</button>` : ''}
                        <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                    </div>
                </form>
        `;

        drawer.innerHTML = html;
        drawer.style.right = '0';

        let rawFormElement = drawer.querySelector('#entity-form');
        const formElement = rawFormElement.cloneNode(true);
        rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

        formElement.querySelectorAll('.searchable-select-container').forEach(container => {
            const input = container.querySelector('.searchable-select-input');
            const hiddenInput = container.querySelector('input[type="hidden"]');
            const dropdown = container.querySelector('.searchable-select-dropdown');
            const options = dropdown.querySelectorAll('.searchable-option');

            input.addEventListener('focus', () => {
                dropdown.style.display = 'block';
            });

            input.addEventListener('input', () => {
                const filter = input.value.toLowerCase();
                dropdown.style.display = 'block';
                options.forEach(opt => {
                    const text = opt.textContent.toLowerCase();
                    if (text.includes(filter) || opt.dataset.id === '') {
                        opt.style.display = 'block';
                    } else {
                        opt.style.display = 'none';
                    }
                });
            });

                        options.forEach(opt => {
                opt.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = opt.dataset.id === '' ? '' : opt.textContent;
                    hiddenInput.value = opt.dataset.id;
                    dropdown.style.display = 'none';
                    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                    input.blur();
                });
            });

            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    dropdown.style.display = 'none';
                }
            });
        });

        const deleteBtn = drawer.querySelector('#delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                showConfirmModal('Подтверждение удаления', 'Вы уверены, что хотите удалить это ДТП?', async () => {
                    const currentUserId = localStorage.getItem('currentUserId') || '';
                    try {
                        const response = await fetch(`/api/accidents/${item.id}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId }
                        });
                        if (response.ok) {
                            closeDrawer();
                            showAppNotification('ДТП успешно удалено', 'success');
                            refreshData();
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            showAppNotification(errData.error || 'Ошибка при удалении ДТП', 'error');
                        }
                    } catch (err) {
                        showAppNotification('Ошибка соединения с сервером', 'error');
                    }
                });
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

            try {
                const isEdit = item && item.id;
                const url = isEdit ? `/api/accidents/${item.id}` : `/api/accidents`;
                const method = isEdit ? 'PUT' : 'POST';
                const currentUserId = localStorage.getItem('currentUserId') || '';

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    closeDrawer();
                    showAppNotification('ДТП успешно сохранено', 'success');
                    refreshData();
                } else {
                    const errData = await response.json().catch(() => ({}));
                    showAppNotification(errData.error || 'Ошибка при сохранении ДТП', 'error');
                    isSubmitting = false;
                    if (saveButton) saveButton.disabled = false;
                }
            } catch (err) {
                showAppNotification('Ошибка соединения с сервером', 'error');
                isSubmitting = false;
                if (saveButton) saveButton.disabled = false;
            }
        });

        return; 
    }

    if (entity === 'accident_images') {
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
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                Изображение:
                ${item.image_url ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Текущий файл: <a href="${item.image_url}" target="_blank">посмотреть</a></div>` : ''}
                <input type="file" name="image_url" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box;">
            </label>
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                Описание:
                <textarea name="description" rows="4" style="width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; resize: vertical;">${item.description || ''}</textarea>
            </label>
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
                    headers: { 'x-user-id': localStorage.getItem('currentUserId') || '' },
                    body: formData
                });

                if (response.ok) {
                    closeDrawer();
                    showAppNotification('Сохранено успешно', 'success');
                    if (parentId) loadDetailData('accident_images', parentId);
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

        return; 
    }

    const config = getConfig(entity);

    const fieldSets = {
        accident_invoices: [
            { field: 'invoice_date', label: 'Дата', type: 'datetime-local' },
            { field: 'debtor', label: 'Должник', type: 'text' },
            { field: 'amount', label: 'Сумма', type: 'number' },
            { field: 'description', label: 'Описание', type: 'textarea' }
        ],
        accident_payments: [
            { field: 'payment_date', label: 'Дата', type: 'datetime-local' },
            { field: 'payer', label: 'Плательщик', type: 'text' },
            { field: 'amount', label: 'Сумма', type: 'number' },
            { field: 'description', label: 'Описание', type: 'textarea' }
        ],
        accident_events: [
            { field: 'event_date', label: 'Дата', type: 'datetime-local' },
            { field: 'event_text', label: 'Событие', type: 'textarea' }
        ]
    };

    const fields = fieldSets[entity] || (config.columns || []).map(c => ({
        field: c.field, label: c.label, type: c.type || 'text'
    }));

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    if (parentId) {
        html += `<input type="hidden" name="dtp_id" value="${parentId}">`;
    }

    const controlStyle = 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

    fields.forEach(f => {
        let val = item ? (item[f.field] !== undefined && item[f.field] !== null ? item[f.field] : '') : '';
        let inputHtml = '';

        if (f.type === 'datetime-local') {
            let formattedVal = '';
            if (val) {
                const d = new Date(val);
                if (!isNaN(d)) {
                    formattedVal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }
            } else {
                formattedVal = currentDateTime;
            }
            inputHtml = `<input type="datetime-local" name="${f.field}" value="${formattedVal}" style="${controlStyle}">`;
        } else if (f.type === 'textarea') {
            inputHtml = `<textarea name="${f.field}" rows="4" style="${controlStyle} resize: vertical; font-family: inherit;">${val}</textarea>`;
        } else if (f.type === 'number') {
            inputHtml = `<input type="number" step="0.01" name="${f.field}" value="${val}" style="${controlStyle}">`;
        } else {
            inputHtml = `<input type="text" name="${f.field}" value="${val}" style="${controlStyle}">`;
        }

        html += `
            <label style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${f.label}:
                ${inputHtml}
            </label>
        `;
    });

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    <button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Сохранить</button>
                    ${item && item.id ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    const deleteBtn = drawer.querySelector('#delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal('Подтверждение удаления', 'Вы уверены, что хотите удалить эту запись?', async () => {
                const currentUserId = localStorage.getItem('currentUserId') || '';
                try {
                    const response = await fetch(`/api/${entity}/${item.id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId }
                    });
                    if (response.ok) {
                        closeDrawer();
                        showAppNotification('Запись успешно удалена', 'success');
                        if (parentId) loadDetailData(entity, parentId);
                        else refreshData();
                    } else {
                        const errData = await response.json().catch(() => ({}));
                        showAppNotification(errData.error || 'Ошибка при удалении записи', 'error');
                    }
                } catch (err) {
                    showAppNotification('Ошибка соединения с сервером', 'error');
                }
            });
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
            data.dtp_id = parentId;
        }

        try {
            const isEdit = item && item.id;
            const url = isEdit ? `/api/${entity}/${item.id}` : `/api/${entity}`;
            const method = isEdit ? 'PUT' : 'POST';
            const currentUserId = localStorage.getItem('currentUserId') || '';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
                body: JSON.stringify(data)
            });

                        if (response.ok) {
                const savedDoc = await response.json().catch(() => null);
                closeDrawer();
                showAppNotification('Данные успешно сохранены', 'success');
                if (!isEdit && savedDoc && savedDoc.id) selectedItem = savedDoc;
                if (parentId) loadDetailData(entity, parentId); 
                
                else refreshData();
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

    if (entity && typeof entity === 'object' && (entity.id !== undefined || entity.doc_number)) {
        item = entity;
    } else if (!item || (typeof item === 'object' && !item.id && !item.doc_number)) {
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
      
        item = { 
            doc_number: '(будет присвоен автоматически)',
            is_posted: false,
            date: currentDateTime,     
        };
    } else {
        if (!item.date) {
            item.date = currentDateTime;
        }
        if (!item.fact_date) {
            item.fact_date = currentDateTime;
        }
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать приход' : 'Добавить приход'} ${isPosted ? '<span style="color: green; font-size: 12px; margin-left: 8px;">(Проведен)</span>' : ''}</h3>
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
        
        if (isPosted) {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

               if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');

            let hasItems = false;
            if (item && item.id) {
                try {
                    const itemsRes = await fetch(`/api/receipt_items?receipt_id=${item.id}&page=1&limit=1`);
                    const itemsList = await itemsRes.json();
                    hasItems = Array.isArray(itemsList) && itemsList.length > 0;
                } catch (e) {
                    hasItems = false;
                }
            }

            let optionsHtml = `<option value="">-- Не выбрано --</option>`;

            statusItems.forEach(st => {
                const stIsTrue = String(st.id) === 'true' || st.id === true || st.id === 1 || st.id === '1';
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                const blockOption = stIsTrue && !hasItems;
                optionsHtml += `<option value="${st.id}" ${selected} ${blockOption ? 'disabled' : ''}>${st.name}${blockOption ? ' — нет позиций' : ''}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly && !item.id ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.ref === 'postavhik') {
            const refItems = await fetchReferenceData(col.ref);
            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) {
                    selectedDisplayName = refItem.name || refItem.title || refItem.name_full || `Запись #${refItem.id}`;
                }
            });

            inputHtml = `
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off" ${fieldReadonly ? 'disabled' : ''}>
                    <input type="hidden" name="${col.field}" value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                        ${refItems.map(refItem => {
                            const displayName = refItem.name || refItem.title || refItem.name_full || `Запись #${refItem.id}`;
                            return `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        } else if (col.field === 'warehouse_from_id' || col.field === 'warehouse_to_id' || col.field === 'warehouse_id' || col.field === 'skald_id') {
           
            const refItems = await fetchReferenceData(col.ref);
            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) {
                    selectedDisplayName = refItem.name || refItem.title || refItem.name_full || refItem.description || `Склад #${refItem.id}`;
                }
            });

            inputHtml = `
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off" ${fieldReadonly ? 'disabled' : ''}>
                    <input type="hidden" name="${col.field}" value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                        ${refItems.map(refItem => {
                            const displayName = refItem.name || refItem.title || refItem.name_full || refItem.description || `Склад #${refItem.id}`;
                            return `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                        }).join('')}
                    </div>
                </div>
            `;
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
            if ((col.field === 'fact_date' || col.field === 'date') && !val && (isPosted || !item.id)) {
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
        } else if (col.type === 'checkbox') {
            inputHtml = `<input type="checkbox" name="${col.field}" ${val === true || val === 'true' ? 'checked' : ''} ${fieldReadonly ? 'disabled' : ''}>`;
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
                    ${!isPosted ? '<button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>' : '<div style="flex: 1; color: #16a34a; font-weight: 600; font-size: 13px; display: flex; align-items: center;">Документ проведен и заблокирован от изменений</div>'}
                    ${item && item.id && !isPosted ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Закрыть</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                if (text.includes(filter) || opt.dataset.id === '') {
                    opt.style.display = 'block';
                } else {
                    opt.style.display = 'none';
                }
            });
        });

               options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });


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

    if (formElement && !isPosted) {
        const pairs = [
            { warehouse: formElement.querySelector('[name="warehouse_from_id"]'), mol: formElement.querySelector('[name="mol_from_id"]') },
            { warehouse: formElement.querySelector('[name="warehouse_to_id"]'), mol: formElement.querySelector('[name="mol_to_id"]') },
            { warehouse: formElement.querySelector('[name="warehouse_id"]'), mol: formElement.querySelector('[name="mol_id"]') }
        ];

        pairs.forEach(({ warehouse, mol }) => {
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
                            option.textContent = m.user_fio || usersMap[m.user_id] || m.description || `МОЛ #${m.id}`;

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
        data.is_opening_balance = !!formElement.querySelector('[name="is_opening_balance"]')?.checked;

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
                const savedDoc = await response.json().catch(() => null);
                closeDrawer();
                showAppNotification('Приход успешно сохранен', 'success');
                if (!isEdit && savedDoc && savedDoc.id) {
                    selectedItem = savedDoc;
                }
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

async function openMoveForm(entityOrItem, itemArg = null, parentIdArg = null) {
    let entity, item, parentId;
    if (typeof entityOrItem === 'object' && entityOrItem !== null) {
        item = entityOrItem;
        entity = typeof currentEntity !== 'undefined' ? currentEntity : 'moves';
        parentId = itemArg; 
    } else {
        entity = entityOrItem || (typeof currentEntity !== 'undefined' ? currentEntity : 'moves');
        item = itemArg;
        parentId = parentIdArg;
    }

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
        let docNumberValue = '';

        if (entity === 'moves') {
           
            docNumberValue = '(будет присвоен автоматически)';
        } else {
        
            let nextId = 1;
            const prefix = 'ПМ-';

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

            docNumberValue = `${prefix}${nextId}`;
        }

        item = { 
            doc_number: docNumberValue,
            is_posted: false 
        };

        if (entity === 'move_items') {
            item.currency = 'Рубль ПМР';
            if (parentId) {
                item.move_id = parentId;
            }
        }

        config.columns.forEach(col => {
            if (col.field === 'fact_date') return; 
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

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1 || item.is_posted === '1');

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title} ${isPosted ? '<span style="color: green; font-size: 12px; margin-left: 8px;">(Проведен)</span>' : ''}</h3>
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
        if (isPosted) {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

                            if (col.field === 'is_posted') {
            const isCurrentPosted = val === true || val === 'true' || val === 1 || val === '1';

            let hasItems = false;
            if (item && item.id) {
                try {
                    const itemsRes = await fetch(`/api/move_items?move_id=${item.id}`);
                    const itemsList = await itemsRes.json();
                    hasItems = Array.isArray(itemsList) && itemsList.length > 0;
                } catch (e) {
                    hasItems = false;
                }
            }

            inputHtml = `
                <select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">
                    <option value="false" ${!isCurrentPosted ? 'selected' : ''}>Не проведен</option>
                    <option value="true" ${isCurrentPosted ? 'selected' : ''} ${!hasItems ? 'disabled' : ''}>Проведен${!hasItems ? ' — нет позиций' : ''}</option>
                </select>
            `;
        } else if (col.field === 'warehouse_from_id' || col.field === 'warehouse_to_id' || col.field === 'warehouse_id' || col.field === 'sklad_id') {
           
            const referenceName = col.ref;
            const refItems = await fetchReferenceData(referenceName);

            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) {
                    selectedDisplayName = refItem.user_fio || refItem.name || refItem.login || refItem.name_full || refItem.title || refItem.doc_number || refItem.gos_number || `Склад #${refItem.id}`;
                }
            });

            inputHtml = `
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off" ${fieldReadonly ? 'disabled' : ''}>
                    <input type="hidden" name="${col.field}" value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                        ${refItems.map(refItem => {
                            const displayName = refItem.user_fio || refItem.name || refItem.login || refItem.name_full || refItem.title || refItem.doc_number || refItem.gos_number || `Склад #${refItem.id}`;
                            return `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                        }).join('')}
                    </div>
                </div>
            `;
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
                    ${isPosted 
                        ? `<span style="color: #16a34a; font-size: 13px; font-weight: 500;">Документ проведен и заблокирован от изменений</span>`
                        : `<button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>
                           ${item && item.id ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}`
                    }
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Закрыть</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    
    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                if (text.includes(filter) || opt.dataset.id === '') {
                    opt.style.display = 'block';
                } else {
                    opt.style.display = 'none';
                }
            });
        });

        options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    const isPostedSelect = formElement.querySelector('[name="is_posted"]');
    const factDateInput = formElement.querySelector('[name="fact_date"]');

    if (isPostedSelect && factDateInput) {
        isPostedSelect.addEventListener('change', () => {
            if (isPostedSelect.value === 'true' && !factDateInput.value) {
                factDateInput.value = currentDateTime;
            } else if (isPostedSelect.value === 'false') {
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
        const data = Object.fromEntries(formData.entries());

        if (data.is_posted !== undefined && data.is_posted !== '') {
            data.is_posted = data.is_posted === 'true' || data.is_posted === true || data.is_posted === '1' || data.is_posted === 1;
        }

        if (entity === 'move_items') {
            const currentParentId = parentId || formElement.getAttribute('data-parent-id');
            if (currentParentId) {
                data.move_id = currentParentId;
            }
            if (data.zaphasti && !data.zaphasti_id) {
                data.zaphasti_id = data.zaphasti;
            }
            data.currency = 'Рубль ПМР';
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
                const savedDoc = await response.json().catch(() => null);
                closeDrawer();
                showAppNotification('Данные успешно сохранены', 'success');

                if (!isEdit && savedDoc && savedDoc.id) {
                    selectedItem = savedDoc;
                }

                if (entity === 'move_items' && parentId) {
                    loadDetailData(entity, parentId);
                    refreshData();
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

async function openRepairForm(entityOrItem, itemArg = null, parentIdArg = null) {
    let entity, item, parentId;

    if (typeof entityOrItem === 'object' && entityOrItem !== null) {
        item = entityOrItem;
        entity = typeof currentEntity !== 'undefined' ? currentEntity : 'repairs';
        parentId = itemArg;
    } else {
        entity = entityOrItem || (typeof currentEntity !== 'undefined' ? currentEntity : 'repairs');
        item = itemArg;
        parentId = parentIdArg;
    }

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
        
        item = { 
            doc_number: entity === 'repairs' ? '(будет присвоен автоматически)' : '',
            is_posted: false 
        };

        if (entity === 'repair_items') {
            if (parentId) {
                item.repair_id = parentId;
            }
        }

       config.columns.forEach(col => {
    if (col.field === 'fact_date') return; 
    if (col.type === 'datetime-local' || col.field.includes('date') || col.field.includes('_at')) {
        item[col.field] = currentDateTime;
    }
    });
    } else {
        if (entity === 'repair_items') {
            if (parentId && !item.repair_id) {
                item.repair_id = parentId;
            }
        }
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item && item.id ? 'Редактировать' : 'Добавить'}: ${config.title} ${isPosted ? '<span style="color: green; font-size: 12px; margin-left: 8px;">(Проведен)</span>' : ''}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" style="display: flex; flex-direction: column; gap: 14px;" data-entity="${entity}" data-parent-id="${parentId || ''}" data-item-id="${item && item.id ? item.id : ''}">
    `;

    if (entity === 'repair_items') {
        const activeRepairId = parentId || (item ? item.repair_id : '');
        html += `<input type="hidden" name="repair_id" value="${activeRepairId}">`;
    }

    const columns = [...config.columns];
    
    const carColIndex = columns.findIndex(c => c.field === 'car_id');
    const molColIndex = columns.findIndex(c => c.field === 'mol_id' || c.field === 'mol');

    if (carColIndex !== -1 && molColIndex !== -1 && carColIndex < molColIndex) {
        const [carCol] = columns.splice(carColIndex, 1);
        const newMolIndex = columns.findIndex(c => c.field === 'mol_id' || c.field === 'mol');
        columns.splice(newMolIndex + 1, 0, carCol);
    }

    for (const col of columns) {
        if (col.field === 'id') continue;
        if (col.field === 'repair_id') continue;
        if (col.insert === false) continue;
        if ((col.update === false || col.edit === false) && item && item.id) continue;

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
        
        if (isPosted) {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

                if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');

            let hasItems = false;
            if (item && item.id) {
                try {
                    const itemsRes = await fetch(`/api/repair_items?repair_id=${item.id}`);
                    const itemsList = await itemsRes.json();
                    hasItems = Array.isArray(itemsList) && itemsList.length > 0;
                } catch (e) {
                    hasItems = false;
                }
            }

            let optionsHtml = `<option value="">-- Не выбрано --</option>`;

            statusItems.forEach(st => {
                const stIsTrue = String(st.id) === 'true' || st.id === true || st.id === 1 || st.id === '1';
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                const blockOption = stIsTrue && !hasItems;
                optionsHtml += `<option value="${st.id}" ${selected} ${blockOption ? 'disabled' : ''}>${st.name}${blockOption ? ' — нет позиций' : ''}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
                } else if (col.ref === 'repair_cars' ||  col.ref === 'customer_cars' || col.ref === 'cars') {
            const referenceName = col.ref;
            let refItems = await fetchReferenceData(referenceName);

            const buildDisplayName = (refItem) => {
                const gos = refItem.gos_number || refItem.car_number || '';
                const mdl = refItem.model || refItem.car_model || '';
                const brd = refItem.brand || refItem.car_brand || '';
                return (brd || mdl || gos) ? `${brd} ${mdl} (${gos})`.trim() : `Авто #${refItem.id}`;
            };

            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) {
                    selectedDisplayName = buildDisplayName(refItem);
                }
            });

            inputHtml = `
                                <div class="searchable-select-container" id="car-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder="Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off" ${fieldReadonly ? 'disabled' : ''}>
                    <input type="hidden" name="${col.field}" id="car-select" value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                        ${refItems.map(refItem => `<div class="searchable-option" data-id="${refItem.id}" data-sklad-id="${refItem.sklad_id || refItem.warehouse_id || ''}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${buildDisplayName(refItem)}</div>`).join('')}
                    </div>
                </div>
            `;
        } else if (col.field === 'warehouse_from_id' || col.field === 'warehouse_to_id' || col.field === 'warehouse_id' || col.field === 'sklad_id' || col.field === 'customer_id') {

            const referenceName = col.ref;
            const refItems = await fetchReferenceData(referenceName);
            const fallbackLabel = col.field === 'customer_id' ? 'Сервис' : 'Склад';

            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) {
                    selectedDisplayName = refItem.name || refItem.title || refItem.user_fio || refItem.login || refItem.name_full || refItem.name_short || refItem.doc_number || refItem.gos_number || `${fallbackLabel} #${refItem.id}`;
                }
            });

            inputHtml = `
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off" ${fieldReadonly ? 'disabled' : ''}>
                    <input type="hidden" name="${col.field}" value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                        ${refItems.map(refItem => {
                            const displayName = refItem.name || refItem.title || refItem.user_fio || refItem.login || refItem.name_full || refItem.name_short || refItem.doc_number || refItem.gos_number || `${fallbackLabel} #${refItem.id}`;
                            return `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${displayName}</div>`;
                        }).join('')}
                    </div>
                </div>
            `;
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
                    displayName = refItem.name || refItem.title || refItem.user_fio || refItem.login || refItem.name_full || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
                }

                const selected = (val !== '' && val !== null && String(refItem.id) === String(val)) ? 'selected' : '';
                optionsHtml += `<option value="${refItem.id}" ${selected}>${displayName}</option>`;
            });

            const extraAttributes = (col.field === 'zaphasti_id' ? 'id="zaphasti-select"' : (entity === 'repairs' && col.field === 'doc_type' ? 'id="repair-doctype-select"' : ''));
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

const repairFieldWrapId = (entity === 'repairs' && col.field === 'warehouse_id') ? ' id="repair-warehouse-field"' : ((entity === 'repairs' && col.field === 'customer_id') ? ' id="repair-service-field"' : ((entity === 'repairs' && col.field === 'mol_id') ? ' id="repair-mol-field"' : ''));        html += `
            <label${repairFieldWrapId} style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500; color: #475569; gap: 5px;">
                ${col.label}:
                ${inputHtml}
            </label>
        `;
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7;">
                    ${!isPosted ? '<button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>' : '<div style="flex: 1; color: #16a34a; font-weight: 600; font-size: 13px; display: flex; align-items: center;">Документ проведен и заблокирован от изменений</div>'}
                    ${item && item.id && !isPosted ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);
    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                if (text.includes(filter) || opt.dataset.id === '') {
                    opt.style.display = 'block';
                } else {
                    opt.style.display = 'none';
                }
            });
        });

                options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });
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

    // ВАЖНЫЙ БЛОК: переключение "Склад" <-> "Сервис" в зависимости от Типа документа.
    // Ремонт база -> Склад (как раньше). Ремонт сервис -> Сервис (из Покупателей).
    if (entity === 'repairs') {
    const docTypeSelect = formElement.querySelector('#repair-doctype-select');
    const warehouseFieldWrap = formElement.querySelector('#repair-warehouse-field');
    const serviceFieldWrap = formElement.querySelector('#repair-service-field');
    const molFieldWrap = formElement.querySelector('#repair-mol-field');

    const updateRepairWarehouseServiceVisibility = () => {
        if (!docTypeSelect || !warehouseFieldWrap || !serviceFieldWrap) return;
        const selectedOption = docTypeSelect.options[docTypeSelect.selectedIndex];
        const selectedText = selectedOption ? selectedOption.textContent.toLowerCase() : '';
        const isServiceRepair = selectedText.includes('сервис');

        warehouseFieldWrap.style.display = isServiceRepair ? 'none' : 'flex';
        serviceFieldWrap.style.display = isServiceRepair ? 'flex' : 'none';
        if (molFieldWrap) {
            molFieldWrap.style.display = isServiceRepair ? 'none' : 'flex';
        }
    };

    if (docTypeSelect && !isPosted) {
        docTypeSelect.addEventListener('change', () => {
            const selectedOption = docTypeSelect.options[docTypeSelect.selectedIndex];
            const selectedText = selectedOption ? selectedOption.textContent.toLowerCase() : '';
            const isServiceRepair = selectedText.includes('сервис');

            const fieldToClear = isServiceRepair ? warehouseFieldWrap : serviceFieldWrap;
            if (fieldToClear) {
                const hidden = fieldToClear.querySelector('input[type="hidden"]');
                const visible = fieldToClear.querySelector('.searchable-select-input');
                if (hidden) hidden.value = '';
                if (visible) visible.value = '';

                if (isServiceRepair && hidden) {
                    hidden.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            if (isServiceRepair && molFieldWrap) {
                const molSelect = molFieldWrap.querySelector('select[name="mol_id"]');
                if (molSelect) molSelect.value = '';
            }

            updateRepairWarehouseServiceVisibility();
        });
    }

    updateRepairWarehouseServiceVisibility();
}
    

    if (formElement && !isPosted) {
        const pairs = [
            { warehouse: formElement.querySelector('[name="warehouse_from_id"]'), mol: formElement.querySelector('[name="mol_from_id"]') },
            { warehouse: formElement.querySelector('[name="warehouse_to_id"]'), mol: formElement.querySelector('[name="mol_to_id"]') },
            { warehouse: formElement.querySelector('[name="warehouse_id"]'), mol: formElement.querySelector('[name="mol_id"]') },
            { warehouse: formElement.querySelector('[name="sklad_id"]'), mol: formElement.querySelector('[name="mol_id"]') }
        ];

        pairs.forEach(({ warehouse, mol }) => {
            if (!warehouse || !mol) return;

            async function filterMols(isUserChange = false) {
                const selectedWarehouseId = warehouse.value;
                const currentMolValue = mol.value;
                try {
                    const [molRes, usersRes] = await Promise.all([
                        fetch('/api/mol'),
                        fetch('/api/mol_users')
                    ]);

                    if (!molRes.ok) {
                        console.warn('[filterMols] Ошибка загрузки /api/mol:', molRes.status);
                        return;
                    }
                    const mols = await molRes.json();
                    const users = usersRes.ok ? await usersRes.json() : [];

                    const usersMap = {};
                    users.forEach(u => {
                        usersMap[u.id] = u.name || u.login || u.description || `Пользователь #${u.id}`;
                    });

                    mol.innerHTML = '<option value="">-- Не выбрано --</option>';
                    let isCurrentStillValid = false;

                    mols.forEach(m => {
                        const match = !selectedWarehouseId || String(m.warehouse_id) === String(selectedWarehouseId);
                        if (match) {
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

                const carSelectContainer = formElement.querySelector('#car-select-container');
        const skladForCarSelect = formElement.querySelector('[name="sklad_id"]') || formElement.querySelector('[name="warehouse_id"]');

        if (carSelectContainer && skladForCarSelect) {
            const carHiddenInput = carSelectContainer.querySelector('#car-select');
            const carVisibleInput = carSelectContainer.querySelector('.searchable-select-input');
            const carOptions = carSelectContainer.querySelectorAll('.searchable-option');

            function filterCarOptionsBySklad(isUserChange = false) {
                const selectedSkladId = skladForCarSelect.value;
                let currentCarStillValid = !selectedSkladId;

                carOptions.forEach(opt => {
                    if (opt.dataset.id === '') {
                        opt.style.display = 'block';
                        return;
                    }
                    const match = !selectedSkladId || String(opt.dataset.skladId) === String(selectedSkladId);
                    opt.style.display = match ? 'block' : 'none';
                    if (match && String(opt.dataset.id) === String(carHiddenInput.value)) {
                        currentCarStillValid = true;
                    }
                });

                if (isUserChange && !currentCarStillValid) {
                    carHiddenInput.value = '';
                    carVisibleInput.value = '';
                }
            }

            skladForCarSelect.addEventListener('change', () => filterCarOptionsBySklad(true));

            if (skladForCarSelect.value) {
                filterCarOptionsBySklad(false);
            }
        }
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

                            if (entity === 'repair_items' && parentId) {
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

        if (entity === 'repair_items') {
            const currentParentId = parentId || formElement.getAttribute('data-parent-id');
            if (currentParentId) {
                data.repair_id = currentParentId;
            }
            if (data.zaphasti && !data.zaphasti_id) {
                data.zaphasti_id = data.zaphasti;
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
                const savedDoc = await response.json().catch(() => null);
                closeDrawer();
                showAppNotification('Данные успешно сохранены', 'success');

                if (!isEdit && savedDoc && savedDoc.id) {
                    selectedItem = savedDoc;
                }

                if (entity === 'repair_items' && parentId) {
                    loadDetailData(entity, parentId);
                    refreshData();
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

async function openRealizationForm(entity, item = null) {
    if (entity && typeof entity === 'object' && (entity.id !== undefined || entity.doc_number)) {
        item = entity;
    } else if (!item || (typeof item === 'object' && !item.id && !item.doc_number)) {
        if (entity && typeof entity === 'object') {
            item = entity;
        }
    }

    const config = getConfig('realizations');

    const drawer = getOrCreateDrawer();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

        if (!item || !item.id) {
        item = { 
            doc_number: '(будет присвоен автоматически)',
            doc_date: currentDateTime,
            is_posted: false,
        };
    }

    const isPosted = item && (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1);

    async function loadCarsForCustomer(customerId, targetCarSelect, preselectedCarId = null) {
        targetCarSelect.innerHTML = '<option value="">-- Не выбрано --</option>';
        if (!customerId) return;

        try {
            const fetchUrl = `/api/customer_cars?customer_id=${customerId}`;
            const response = await fetch(fetchUrl);
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

                if (preselectedCarId && String(car.id) === String(preselectedCarId)) {
                    option.selected = true;
                }
                targetCarSelect.appendChild(option);
            });
        } catch (err) {
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
        if (isPosted) {
            fieldReadonly = true;
        }

        const controlStyle = fieldReadonly 
            ? 'width: 100%; padding: 8px 12px; font-size: 13px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; cursor: not-allowed; outline: none;' 
            : 'width: 100%; padding: 8px 12px; font-size: 13px; background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; outline: none; transition: border-color 0.2s, box-shadow 0.2s;';

               if (col.field === 'is_posted') {
            const statusItems = await fetchReferenceData('statuses');

            let hasItems = false;
            if (item && item.id) {
                try {
                    const itemsRes = await fetch(`/api/realization_items?realization_id=${item.id}`);
                    const itemsList = await itemsRes.json();
                    hasItems = Array.isArray(itemsList) && itemsList.length > 0;
                } catch (e) {
                    hasItems = false;
                }
            }

            let optionsHtml = `<option value="">-- Не выбрано --</option>`;
            
            statusItems.forEach(st => {
                const stIsTrue = String(st.id) === 'true' || st.id === true || st.id === 1 || st.id === '1';
                const selected = (val !== '' && val !== null && String(st.id) === String(Boolean(val === true || val === 'true' || val === 1 || val === '1'))) ? 'selected' : '';
                const blockOption = stIsTrue && !hasItems;
                optionsHtml += `<option value="${st.id}" ${selected} ${blockOption ? 'disabled' : ''}>${st.name}${blockOption ? ' — нет позиций' : ''}</option>`;
            });

            inputHtml = `<select name="${col.field}" ${fieldReadonly ? 'disabled' : ''} style="${controlStyle}">${optionsHtml}</select>`;
        } else if (col.field === 'customer_id' && col.ref) {
            const refItems = await fetchReferenceData(col.ref);
            const buildDisplayName = (refItem) => {
                if (col.formatRef && typeof col.formatRef === 'function') return col.formatRef(refItem);
                return refItem.name || refItem.title || refItem.user_fio || refItem.login || refItem.name_full || refItem.doc_number || refItem.gos_number || (`Запись #${refItem.id}`);
            };
            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) selectedDisplayName = buildDisplayName(refItem);
            });
            inputHtml = `
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off" ${fieldReadonly ? 'disabled' : ''}>
                    <input type="hidden" name="${col.field}" id="customer-select" value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                        ${refItems.map(refItem => `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${buildDisplayName(refItem)}</div>`).join('')}
                    </div>
                </div>
            `;
        } else if (col.field === 'warehouse_id' || col.field === 'skald_id' || col.field === 'sklad_id' ||
                   col.field === 'warehouse_from_id' || col.field === 'warehouse_to_id' ||
                   col.field === 'skald_from_id' || col.field === 'skald_to_id' ||
                   col.field === 'sklad_from_id' || col.field === 'sklad_to_id') {
            const refItems = await fetchReferenceData(col.ref);
            const buildWarehouseName = (refItem) => refItem.name || refItem.title || refItem.user_fio || refItem.login || refItem.name_full || refItem.doc_number || refItem.gos_number || `Склад #${refItem.id}`;

            let selectedDisplayName = '';
            refItems.forEach(refItem => {
                if (String(refItem.id) === String(val)) selectedDisplayName = buildWarehouseName(refItem);
            });

            const warehouseExtraId = (col.field === 'warehouse_id' || col.field === 'skald_id' || col.field === 'sklad_id') ? 'id="warehouse_id"' : '';

            inputHtml = `
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" placeholder=" Начните ввод для поиска..." value="${selectedDisplayName}" style="${controlStyle}" autocomplete="off" ${fieldReadonly ? 'disabled' : ''}>
                    <input type="hidden" name="${col.field}" ${warehouseExtraId} value="${val !== '' && val !== null ? val : ''}">
                    <div class="searchable-select-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <div class="searchable-option" data-id="" style="padding: 8px 12px; cursor: pointer; color: #64748b; border-bottom: 1px solid #f1f5f9;">-- Не выбрано --</div>
                        ${refItems.map(refItem => `<div class="searchable-option" data-id="${refItem.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#ffffff'">${buildWarehouseName(refItem)}</div>`).join('')}
                    </div>
                </div>
            `;
        } else if (col.ref) {
            let refItems = [];
            if (col.ref === 'customer_cars' || col.field === 'car_id') {
                const targetCustomerId = item ? (item.customer_id || item.customer?.id || item.customer) : null;
                
                if (targetCustomerId) {
                    try {
                        const fetchUrl = `/api/customer_cars?customer_id=${targetCustomerId}`;
                        const carRes = await fetch(fetchUrl);
                        if (carRes.ok) {
                            refItems = await carRes.json();
                        }
                    } catch (e) {
                    }
                } else {
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
            if (col.field === 'car_id') extraAttributes = 'id="car-select"';
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
                }
            }
        }
    } catch (renderErr) {
    }

    html += `
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #eef2f7; align-items: center;">
                    ${isPosted ? '<span style="color: #0d9488; font-size: 13px; font-weight: 500; flex: 1;">Документ проведен и заблокирован от изменений</span>' : '<button type="submit" id="save-btn" style="flex: 1; background: #2563eb; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Сохранить</button>'}
                    ${item && item.id && !isPosted ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px; transition: background 0.2s;">Удалить</button>` : ''}
                    <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #475569; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Отмена</button>
                </div>
            </form>
    `;

    drawer.innerHTML = html;
    drawer.style.right = '0';

    let rawFormElement = drawer.querySelector('#entity-form');
    const formElement = rawFormElement.cloneNode(true);
    rawFormElement.parentNode.replaceChild(formElement, rawFormElement);

    formElement.querySelectorAll('.searchable-select-container').forEach(container => {
        const input = container.querySelector('.searchable-select-input');
        const hiddenInput = container.querySelector('input[type="hidden"]');
        const dropdown = container.querySelector('.searchable-select-dropdown');
        const options = dropdown.querySelectorAll('.searchable-option');

        input.addEventListener('focus', () => {
            dropdown.style.display = 'block';
        });

        input.addEventListener('input', () => {
            const filter = input.value.toLowerCase();
            dropdown.style.display = 'block';
            options.forEach(opt => {
                const text = opt.textContent.toLowerCase();
                if (text.includes(filter) || opt.dataset.id === '') {
                    opt.style.display = 'block';
                } else {
                    opt.style.display = 'none';
                }
            });
        });

                options.forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.id === '' ? '' : opt.textContent;
                hiddenInput.value = opt.dataset.id;
                dropdown.style.display = 'none';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });

    const customerSelect = formElement.querySelector('#customer-select');
    const carSelect = formElement.querySelector('#car-select');

    if (customerSelect && carSelect) {
        customerSelect.addEventListener('change', async () => {
            const selectedCustomerId = customerSelect.value;
            const currentCarValue = carSelect.value;
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
                } catch (err) {
                }
            };

            warehouse.addEventListener('change', () => {
                updateMolOptions(true);
            });

            if (warehouse.value) {
                updateMolOptions(false);
            } else {
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
            const url = isEdit ? `/api/realizations/${item.id}` : `/api/realizations`;
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
                const savedDoc = await response.json().catch(() => null);
                closeDrawer();
                showAppNotification('Реализация успешно сохранена', 'success');
                if (!isEdit && savedDoc && savedDoc.id) selectedItem = savedDoc;
                refreshData();
            } else {
                const errData = await response.json().catch(() => ({}));
                showAppNotification(errData.error || 'Ошибка при сохранении реализации', 'error');
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
async function openReturnForm(entity, item = null) {
    const drawer = getOrCreateDrawer();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    if (!item || !item.id) {
        item = {
            doc_number: '(будет присвоен автоматически)',
            is_posted: false,
            date: currentDateTime
        };
    }

    const isPosted = item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1;
    const fieldLock = isPosted ? 'disabled' : '';
    const isEdit = !!item.id;

    const initialType = item.move_id ? 'from_customer' : (item.realization_id ? 'from_retail_customer' : (item.repair_id ? 'from_repair' : 'to_supplier'));
    const typeLocked = isPosted; 

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eef2f7; padding-bottom: 12px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${item.id ? 'Редактировать' : 'Добавить'}: Возврат запчастей ${isPosted ? '<span style="color:#16a34a; font-size:12px; margin-left:8px;">(Проведён)</span>' : ''}</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b; padding: 4px; line-height: 1;">&times;</button>
        </div>
        <form id="entity-form" data-entity="returns" data-item-id="${item.id || ''}" style="display: flex; flex-direction: column; gap: 14px;">

            <div>
                <label style="font-size: 13px; color: #475569; display:block; margin-bottom:6px;">Тип возврата *</label>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; ${typeLocked ? 'opacity:0.6;' : 'cursor:pointer;'}">
                        <input type="radio" name="return_type_ui" value="to_supplier" id="return-type-supplier"
                               ${initialType === 'to_supplier' ? 'checked' : ''} ${typeLocked ? 'disabled' : ''}>
                        Поставщику (из прихода)
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; ${typeLocked ? 'opacity:0.6;' : 'cursor:pointer;'}">
                        <input type="radio" name="return_type_ui" value="from_customer" id="return-type-customer"
                               ${initialType === 'from_customer' ? 'checked' : ''} ${typeLocked ? 'disabled' : ''}>
                        От покупателя (по перемещению)
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; ${typeLocked ? 'opacity:0.6;' : 'cursor:pointer;'}">
                        <input type="radio" name="return_type_ui" value="from_retail_customer" id="return-type-retail-customer"
                               ${initialType === 'from_retail_customer' ? 'checked' : ''} ${typeLocked ? 'disabled' : ''}>
                        От покупателя (по реализации)
                    </label>
                    <label style="display:flex; align-items:center; gap:6px; font-size:13px; ${typeLocked ? 'opacity:0.6;' : 'cursor:pointer;'}">
                        <input type="radio" name="return_type_ui" value="from_repair" id="return-type-repair"
                               ${initialType === 'from_repair' ? 'checked' : ''} ${typeLocked ? 'disabled' : ''}>
                        С ремонта
                    </label>
                </div>
            </div>

            <div id="return-supplier-block" style="display:${initialType === 'to_supplier' ? 'block' : 'none'};">
                <label style="font-size: 13px; color: #475569; display:block; margin-bottom:4px;">Приход, из которого возвращаем *</label>
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" id="return-receipt-input" placeholder=" Загрузка приходов..." autocomplete="off" ${fieldLock}
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
                    <input type="hidden" name="receipt_id" id="return-receipt-select" value="${item.receipt_id || ''}">
                    <div class="searchable-select-dropdown" id="return-receipt-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ccc; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"></div>
                </div>
            </div>

            <div id="return-move-block" style="display:${initialType === 'from_customer' ? 'block' : 'none'};">
                <label style="font-size: 13px; color: #475569; display:block; margin-bottom:4px;">Перемещение, по которому возвращаем *</label>
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" id="return-move-input" placeholder=" Загрузка перемещений..." autocomplete="off" ${fieldLock}
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
                    <input type="hidden" name="move_id" id="return-move-select" value="${item.move_id || ''}">
                    <div class="searchable-select-dropdown" id="return-move-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ccc; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"></div>
                </div>
                <div style="font-size:12px; color:#64748b; margin-top:4px;">Товар спишется со склада-получателя и вернётся на ваш склад-источник этого перемещения.</div>
            </div>

            <div id="return-realization-block" style="display:${initialType === 'from_retail_customer' ? 'block' : 'none'};">
                <label style="font-size: 13px; color: #475569; display:block; margin-bottom:4px;">Реализация, по которой возвращаем *</label>
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" id="return-realization-input" placeholder=" Загрузка реализаций..." autocomplete="off" ${fieldLock}
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
                    <input type="hidden" name="realization_id" id="return-realization-select" value="${item.realization_id || ''}">
                    <div class="searchable-select-dropdown" id="return-realization-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ccc; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"></div>
                </div>
                <div style="font-size:12px; color:#64748b; margin-top:4px;">Товар вернётся на склад, с которого была продажа.</div>
            </div>

            <div id="return-repair-block" style="display:${initialType === 'from_repair' ? 'block' : 'none'};">
                <label style="font-size: 13px; color: #475569; display:block; margin-bottom:4px;">Ремонт, с которого возвращаем *</label>
                <div class="searchable-select-container" style="position: relative;">
                    <input type="text" class="searchable-select-input" id="return-repair-input" placeholder=" Загрузка ремонтов..." autocomplete="off" ${fieldLock}
                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
                    <input type="hidden" name="repair_id" id="return-repair-select" value="${item.repair_id || ''}">
                    <div class="searchable-select-dropdown" id="return-repair-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ccc; border-radius: 6px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);"></div>
                </div>
                <div style="font-size:12px; color:#64748b; margin-top:4px;">Запчасть вернётся на склад, с которого была списана в ремонт.</div>
            </div>

            <input type="hidden" name="warehouse_id" id="return-warehouse-id" value="${item.warehouse_id || ''}">
            <input type="hidden" name="supplier_id" id="return-supplier-id" value="${item.supplier_id || ''}">
            <div>
                <label style="font-size: 13px; color: #475569; display:block; margin-bottom:4px;">Дата</label>
                <input type="datetime-local" name="date" value="${item.date || currentDateTime}" ${fieldLock}
                       style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box;">
            </div>
            <div>
                <label style="font-size: 13px; color: #475569; display:block; margin-bottom:4px;">Комментарий</label>
                <textarea name="comment" ${fieldLock} style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; min-height: 60px;">${item.comment || ''}</textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                ${!isPosted ? '<button type="submit" id="save-btn" style="flex: 1; background: #16a34a; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Сохранить</button>' : '<div style="flex: 1; color: #16a34a; font-weight: 600; font-size: 13px; display: flex; align-items: center;">Документ проведен и заблокирован от изменений</div>'}
                ${item.id && !isPosted ? `<button type="button" id="delete-btn" style="background: #ef4444; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">Удалить</button>` : ''}
                <button type="button" onclick="closeDrawer()" style="background: #e2e8f0; color: #334151; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 13px;">${isPosted ? 'Закрыть' : 'Отмена'}</button>
            </div>
        </form>
    `;

    drawer.innerHTML = html;
    openDrawer();

    const supplierBlock = document.getElementById('return-supplier-block');
    const moveBlock = document.getElementById('return-move-block');
    const realizationBlock = document.getElementById('return-realization-block');
    const repairBlock = document.getElementById('return-repair-block');
    document.querySelectorAll('input[name="return_type_ui"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            supplierBlock.style.display = e.target.value === 'to_supplier' ? 'block' : 'none';
            moveBlock.style.display = e.target.value === 'from_customer' ? 'block' : 'none';
            realizationBlock.style.display = e.target.value === 'from_retail_customer' ? 'block' : 'none';
            repairBlock.style.display = e.target.value === 'from_repair' ? 'block' : 'none';

            if (e.target.value !== 'to_supplier') {
                document.getElementById('return-receipt-select').value = '';
                document.getElementById('return-receipt-input').value = '';
            }
            if (e.target.value !== 'from_customer') {
                document.getElementById('return-move-select').value = '';
                document.getElementById('return-move-input').value = '';
            }
            if (e.target.value !== 'from_retail_customer') {
                document.getElementById('return-realization-select').value = '';
                document.getElementById('return-realization-input').value = '';
            }
            if (e.target.value !== 'from_repair') {
                document.getElementById('return-repair-select').value = '';
                document.getElementById('return-repair-input').value = '';
            }
            document.getElementById('return-warehouse-id').value = '';
            document.getElementById('return-supplier-id').value = '';
        });
    });

    try {
        const res = await fetch('/api/receipts');
        if (res.ok) {
            const receipts = await res.json();
            const hiddenInput = document.getElementById('return-receipt-select');
            const searchInput = document.getElementById('return-receipt-input');
            const dropdown = document.getElementById('return-receipt-dropdown');

            const postedReceipts = receipts.filter(r => r.is_posted === true || r.is_posted === 'true');
            searchInput.placeholder = ' Начните ввод для поиска приход...';

            function applyReceipt(r) {
                hiddenInput.value = r ? r.id : '';
                searchInput.value = r ? `${r.doc_number} от ${r.date ? new Date(r.date).toLocaleDateString() : ''}` : '';
                document.getElementById('return-warehouse-id').value = r ? (r.warehouse_id || '') : '';
                document.getElementById('return-supplier-id').value = r ? (r.supplier_id || '') : '';
            }

            function renderDropdown(filterText) {
                const filter = (filterText || '').toLowerCase().trim();
                const matches = postedReceipts.filter(r => {
                    const label = `${r.doc_number} от ${r.date ? new Date(r.date).toLocaleDateString() : ''}`.toLowerCase();
                    return !filter || label.includes(filter);
                });

                dropdown.innerHTML = matches.map(r => `
                    <div class="searchable-option" data-id="${r.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
                        ${r.doc_number} от ${r.date ? new Date(r.date).toLocaleDateString() : ''}
                    </div>
                `).join('') || '<div style="padding: 8px 12px; color: #94a3b8; font-size: 13px;">Ничего не найдено</div>';

                dropdown.querySelectorAll('.searchable-option').forEach(opt => {
                    opt.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const r = postedReceipts.find(x => String(x.id) === opt.dataset.id);
                        applyReceipt(r);
                        dropdown.style.display = 'none';
                        searchInput.blur();
                    });
                });

                dropdown.style.display = 'block';
            }

            searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
            searchInput.addEventListener('input', () => renderDropdown(searchInput.value));
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.searchable-select-container') || !dropdown.contains(e.target) && e.target !== searchInput) {
                    if (e.target !== searchInput) dropdown.style.display = 'none';
                }
            });

            if (item.receipt_id) {
                const preselected = postedReceipts.find(r => String(r.id) === String(item.receipt_id));
                if (preselected) applyReceipt(preselected);
            }
        }
    } catch (err) {
        console.error('Не удалось загрузить список приходов:', err);
    }

    try {
        const res = await fetch('/api/moves');
        if (res.ok) {
            const moves = await res.json();
            const hiddenInput = document.getElementById('return-move-select');
            const searchInput = document.getElementById('return-move-input');
            const dropdown = document.getElementById('return-move-dropdown');

            const postedMoves = moves.filter(m => m.is_posted === true || m.is_posted === 'true');
            searchInput.placeholder = ' Начните ввод для поиска перемещение...';

            function moveLabel(m) {
                const dateStr = m.date ? new Date(m.date).toLocaleDateString() : '';
                return `${m.doc_number} от ${dateStr} (${m.warehouse_from_name || '?'} → ${m.warehouse_to_name || '?'})`;
            }

            function applyMove(m) {
                hiddenInput.value = m ? m.id : '';
                searchInput.value = m ? moveLabel(m) : '';
                document.getElementById('return-warehouse-id').value = m ? (m.warehouse_from_id || '') : '';
                document.getElementById('return-supplier-id').value = '';
            }

            function renderDropdown(filterText) {
                const filter = (filterText || '').toLowerCase().trim();
                const matches = postedMoves.filter(m => moveLabel(m).toLowerCase().includes(filter));

                dropdown.innerHTML = matches.map(m => `
                    <div class="searchable-option" data-id="${m.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
                        ${moveLabel(m)}
                    </div>
                `).join('') || '<div style="padding: 8px 12px; color: #94a3b8; font-size: 13px;">Ничего не найдено</div>';

                dropdown.querySelectorAll('.searchable-option').forEach(opt => {
                    opt.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const m = postedMoves.find(x => String(x.id) === opt.dataset.id);
                        applyMove(m);
                        dropdown.style.display = 'none';
                        searchInput.blur();
                    });
                });

                dropdown.style.display = 'block';
            }

            searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
            searchInput.addEventListener('input', () => renderDropdown(searchInput.value));
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.searchable-select-container') || !dropdown.contains(e.target) && e.target !== searchInput) {
                    if (e.target !== searchInput) dropdown.style.display = 'none';
                }
            });

            if (item.move_id) {
                const preselected = postedMoves.find(m => String(m.id) === String(item.move_id));
                if (preselected) applyMove(preselected);
            }
        }
    } catch (err) {
        console.error('Не удалось загрузить список перемещений:', err);
    }

    try {
        const res = await fetch('/api/realizations');
        if (res.ok) {
            const realizations = await res.json();
            const hiddenInput = document.getElementById('return-realization-select');
            const searchInput = document.getElementById('return-realization-input');
            const dropdown = document.getElementById('return-realization-dropdown');

            const postedRealizations = realizations.filter(r => r.is_posted === true || r.is_posted === 'true');
            searchInput.placeholder = ' Начните ввод для поиска реализацию...';

            function realizationLabel(r) {
                const dateStr = r.doc_date ? new Date(r.doc_date).toLocaleDateString() : '';
                return `${r.doc_number} от ${dateStr} — ${r.customer_name || 'Розничный покупатель'} (${r.sklad_name || '?'})`;
            }

            function applyRealization(r) {
                hiddenInput.value = r ? r.id : '';
                searchInput.value = r ? realizationLabel(r) : '';
                document.getElementById('return-warehouse-id').value = r ? (r.sklad_id || '') : '';
                document.getElementById('return-supplier-id').value = '';
            }

            function renderDropdown(filterText) {
                const filter = (filterText || '').toLowerCase().trim();
                const matches = postedRealizations.filter(r => realizationLabel(r).toLowerCase().includes(filter));

                dropdown.innerHTML = matches.map(r => `
                    <div class="searchable-option" data-id="${r.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
                        ${realizationLabel(r)}
                    </div>
                `).join('') || '<div style="padding: 8px 12px; color: #94a3b8; font-size: 13px;">Ничего не найдено</div>';

                dropdown.querySelectorAll('.searchable-option').forEach(opt => {
                    opt.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const r = postedRealizations.find(x => String(x.id) === opt.dataset.id);
                        applyRealization(r);
                        dropdown.style.display = 'none';
                        searchInput.blur();
                    });
                });

                dropdown.style.display = 'block';
            }

            searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
            searchInput.addEventListener('input', () => renderDropdown(searchInput.value));
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.searchable-select-container') || !dropdown.contains(e.target) && e.target !== searchInput) {
                    if (e.target !== searchInput) dropdown.style.display = 'none';
                }
            });

            if (item.realization_id) {
                const preselected = postedRealizations.find(r => String(r.id) === String(item.realization_id));
                if (preselected) applyRealization(preselected);
            }
        }
    } catch (err) {
        console.error('Не удалось загрузить список реализаций:', err);
    }

    try {
        const res = await fetch('/api/repairs');
        if (res.ok) {
            const repairs = await res.json();
            const hiddenInput = document.getElementById('return-repair-select');
            const searchInput = document.getElementById('return-repair-input');
            const dropdown = document.getElementById('return-repair-dropdown');

            const postedRepairs = repairs.filter(r => r.is_posted === true || r.is_posted === 'true');
            searchInput.placeholder = ' Начните ввод для поиска ремонт...';

            function repairLabel(r) {
                const dateStr = r.doc_date ? new Date(r.doc_date).toLocaleDateString() : '';
                return `${r.doc_number} от ${dateStr} — ${r.car_number || 'авто не указано'} (${r.warehouse_name || '?'})`;
            }

            function applyRepair(r) {
                hiddenInput.value = r ? r.id : '';
                searchInput.value = r ? repairLabel(r) : '';
                document.getElementById('return-warehouse-id').value = r ? (r.warehouse_id || '') : '';
                document.getElementById('return-supplier-id').value = '';
            }

            function renderDropdown(filterText) {
                const filter = (filterText || '').toLowerCase().trim();
                const matches = postedRepairs.filter(r => repairLabel(r).toLowerCase().includes(filter));

                dropdown.innerHTML = matches.map(r => `
                    <div class="searchable-option" data-id="${r.id}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; font-size: 13px;">
                        ${repairLabel(r)}
                    </div>
                `).join('') || '<div style="padding: 8px 12px; color: #94a3b8; font-size: 13px;">Ничего не найдено</div>';

                dropdown.querySelectorAll('.searchable-option').forEach(opt => {
                    opt.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const r = postedRepairs.find(x => String(x.id) === opt.dataset.id);
                        applyRepair(r);
                        dropdown.style.display = 'none';
                        searchInput.blur();
                    });
                });

                dropdown.style.display = 'block';
            }

            searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
            searchInput.addEventListener('input', () => renderDropdown(searchInput.value));
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.searchable-select-container') || !dropdown.contains(e.target) && e.target !== searchInput) {
                    if (e.target !== searchInput) dropdown.style.display = 'none';
                }
            });

            if (item.repair_id) {
                const preselected = postedRepairs.find(r => String(r.id) === String(item.repair_id));
                if (preselected) applyRepair(preselected);
            }
        }
    } catch (err) {
        console.error('Не удалось загрузить список ремонтов:', err);
    }

    const deleteBtn = drawer.querySelector('#delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            showConfirmModal(
                'Подтверждение удаления',
                'Вы уверены, что хотите удалить этот возврат?',
                async () => {
                    const currentUserId = localStorage.getItem('currentUserId') || '';
                    try {
                        const response = await fetch(`/api/returns/${item.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': currentUserId
                            }
                        });

                        if (response.ok) {
                            closeDrawer();
                            showAppNotification('Возврат успешно удалён', 'success');
                            selectedItem = null;
                            refreshData();
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            showAppNotification(errData.error || 'Ошибка при удалении возврата', 'error');
                        }
                    } catch (err) {
                        console.error(err);
                        showAppNotification('Ошибка соединения с сервером', 'error');
                    }
                }
            );
        });
    }

    let isSubmitting = false;
    const entityForm = document.getElementById('entity-form');
    if (entityForm) {
        entityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;
            isSubmitting = true;

            const saveButton = document.getElementById('save-btn');
            if (saveButton) saveButton.disabled = true;

            const form = e.target;
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => { data[key] = value; });
            
            const selectedType = form.querySelector('input[name="return_type_ui"]:checked')?.value
                || (item.move_id ? 'from_customer' : (item.realization_id ? 'from_retail_customer' : (item.repair_id ? 'from_repair' : 'to_supplier')));
            delete data.return_type_ui;

            if (selectedType === 'to_supplier') {
                data.move_id = null;
                data.realization_id = null;
                data.repair_id = null;
                if (!data.receipt_id) {
                    showAppNotification('Выберите приход, из которого делается возврат', 'warning');
                    isSubmitting = false;
                    if (saveButton) saveButton.disabled = false;
                    return;
                }
            } else if (selectedType === 'from_customer') {
                data.receipt_id = null;
                data.realization_id = null;
                data.repair_id = null;
                if (!data.move_id) {
                    showAppNotification('Выберите перемещение, по которому делается возврат', 'warning');
                    isSubmitting = false;
                    if (saveButton) saveButton.disabled = false;
                    return;
                }
            } else if (selectedType === 'from_retail_customer') {
                data.receipt_id = null;
                data.move_id = null;
                data.repair_id = null;
                if (!data.realization_id) {
                    showAppNotification('Выберите реализацию, по которой делается возврат', 'warning');
                    isSubmitting = false;
                    if (saveButton) saveButton.disabled = false;
                    return;
                }
            } else {
                data.receipt_id = null;
                data.move_id = null;
                data.realization_id = null;
                if (!data.repair_id) {
                    showAppNotification('Выберите ремонт, по которому делается возврат', 'warning');
                    isSubmitting = false;
                    if (saveButton) saveButton.disabled = false;
                    return;
                }
            }

            try {
                const isEditReq = item && item.id;
                const url = isEditReq ? `/api/returns/${item.id}` : `/api/returns`;
                const method = isEditReq ? 'PUT' : 'POST';
                const currentUserId = localStorage.getItem('currentUserId') || '';

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'x-user-id': currentUserId },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    closeDrawer();
                    showAppNotification('Документ возврата создан', 'success');
                    if (!isEditReq) selectedItem = null;
                    refreshData();
                } else {
                    const errData = await response.json().catch(() => ({}));
                    showAppNotification(errData.error || 'Ошибка при сохранении', 'error');
                    isSubmitting = false;
                    if (saveButton) saveButton.disabled = false;
                }
            } catch (err) {
                console.error(err);
                showAppNotification('Ошибка соединения с сервером', 'error');
                isSubmitting = false;
                if (saveButton) saveButton.disabled = false;
            }
        });
    }
}

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
    } else if (currentEntity === 'moves' && typeof openMoveForm === 'function') {
        openMoveForm(selectedItem);
    } else if (currentEntity === 'realizations' && typeof openRealizationForm === 'function') {
        openRealizationForm(currentEntity, selectedItem);
    } else if (currentEntity === 'repairs' && typeof openRepairForm === 'function') {
        openRepairForm(selectedItem); 
    } else if (currentEntity === 'accidents' && typeof openAccidentForm === 'function') {
    openAccidentForm('accidents', selectedItem);
    }
     else if (currentEntity === 'returns' && typeof openReturnForm === 'function') {
    openReturnForm('returns', selectedItem);
}
    else {
        openEntityForm(currentEntity, selectedItem);
    }
}

function openActiveEntityForm(action, item = null) {
    const entity = action === 'edit' ? (typeof getSelectedEntityName === 'function' ? getSelectedEntityName() : currentEntity) : currentEntity;

    const actualItem = action === 'add' ? null : item;

    switch (entity) {
        case 'Приход запчастей':
        case 'receipts':
            if (typeof openReceiptForm === 'function') {
                openReceiptForm('receipts', actualItem);
            } else {
                openEntityForm(entity, actualItem);
            }
            break;
            
        case 'Перемещение':
        case 'moves':
            if (typeof openMoveForm === 'function') {
                openMoveForm('moves', actualItem, null);
            } else {
                openEntityForm(entity, actualItem);
            }
            break;
        case 'Возврат запчастей':
        case 'returns':
            if (typeof openReturnForm === 'function') {
                openReturnForm('returns', actualItem);
            } else {
                openEntityForm(entity, actualItem);
            }
            break;
        case 'Реализация':
        case 'realizations':
            if (typeof openRealizationForm === 'function') {
                openRealizationForm('realizations', actualItem);
            } else {
                openEntityForm(entity, actualItem);
            }
            break;

        case 'Ремонт':
        case 'repairs':
            if (typeof openRepairForm === 'function') {
                openRepairForm('repairs', actualItem);
            } else {
                openEntityForm(entity, actualItem);
            }
            break;
         case 'ДТП':
        case 'accidents':
    if (typeof openAccidentForm === 'function') {
        openAccidentForm('accidents', actualItem);
    } else {
        openEntityForm(entity, actualItem);
    }
    break;
    
    
        default:
            if (typeof openEntityForm === 'function') {
                openEntityForm(entity, actualItem);
            } else {
                console.error('Функция openEntityForm не найдена');
            }
            break;
    }
}


async function renderReturnItemsInline(returnDoc) {
    selectedItem = returnDoc;

    const tbody = document.getElementById('detail-body');
    const headerTr = document.getElementById('detail-headers');
    const titleEl = document.getElementById('detail-title');

    const existingFilterRow = document.getElementById('detail-filter-row');
    if (existingFilterRow) existingFilterRow.remove();

    const isMoveReturn = !!returnDoc.move_id;
    const isRealizationReturn = !isMoveReturn && !!returnDoc.realization_id;
    const isRepairReturn = !isMoveReturn && !isRealizationReturn && !!returnDoc.repair_id;

    if (titleEl) {
        titleEl.innerText = isMoveReturn
            ? `Возврат ${returnDoc.doc_number || ''} — позиции из перемещения ${returnDoc.move_doc_number || ''}`
            : isRealizationReturn
                ? `Возврат ${returnDoc.doc_number || ''} — позиции из реализации ${returnDoc.realization_doc_number || ''}`
                : isRepairReturn
                    ? `Возврат ${returnDoc.doc_number || ''} — позиции из ремонта ${returnDoc.repair_doc_number || ''}`
                    : `Возврат ${returnDoc.doc_number || ''} — позиции из прихода ${returnDoc.receipt_doc_number || ''}`;
    }

    const sourceColLabel = isMoveReturn ? 'Кол-во в перемещении' : (isRealizationReturn ? 'Кол-во в реализации' : (isRepairReturn ? 'Кол-во в ремонте' : 'Кол-во в приходе'));

    if (headerTr) {
        headerTr.innerHTML = `
            <th style="padding:6px; border-bottom:1px solid #ddd;">Код</th>
            <th style="padding:6px; border-bottom:1px solid #ddd;">Наименование</th>
            <th style="padding:6px; border-bottom:1px solid #ddd; text-align:right;">${sourceColLabel}</th>
            <th style="padding:6px; border-bottom:1px solid #ddd; text-align:right;">Доступно</th>
            <th style="padding:6px; border-bottom:1px solid #ddd; text-align:right;">Цена</th>
            <th style="padding:6px; border-bottom:1px solid #ddd; text-align:right;">Возврат, шт.</th>
            <th style="padding:6px; border-bottom:1px solid #ddd; text-align:right;">Сумма возврата</th>
            <th style="padding:6px; border-bottom:1px solid #ddd; text-align:center;"></th>
        `;
    }

    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#888; padding:20px;">Загрузка...</td></tr>`;

    const sourceId = isMoveReturn ? returnDoc.move_id : (isRealizationReturn ? returnDoc.realization_id : (isRepairReturn ? returnDoc.repair_id : returnDoc.receipt_id));
    if (!sourceId) {
        const missingLabel = isMoveReturn ? 'документ перемещения' : (isRealizationReturn ? 'документ реализации' : (isRepairReturn ? 'документ ремонта' : 'приход'));
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#dc2626; padding:20px;">У возврата не указан ${missingLabel}</td></tr>`;
        return;
    }

    const idField = isMoveReturn ? 'move_item_id' : (isRealizationReturn ? 'realization_item_id' : (isRepairReturn ? 'repair_item_id' : 'receipt_item_id'));
    const availQueryParam = isMoveReturn ? 'move_id' : (isRealizationReturn ? 'realization_id' : (isRepairReturn ? 'repair_id' : 'receipt_id'));
    const itemTypeAttr = isMoveReturn ? 'move' : (isRealizationReturn ? 'realization' : (isRepairReturn ? 'repair' : 'receipt'));

    try {
        const [availRes, returnedRes] = await Promise.all([
            fetch(`/api/returns/available-items?${availQueryParam}=${sourceId}`),
            fetch(`/api/return_items?return_id=${returnDoc.id}`)
        ]);

        if (!availRes.ok) throw new Error('Не удалось загрузить позиции источника');
        const availableItems = await availRes.json();
        const returnedItems = returnedRes.ok ? await returnedRes.json() : [];

        const returnedByItem = {};
        returnedItems.forEach(ri => { returnedByItem[ri[idField]] = ri; });

        if (availableItems.length === 0) {
            const emptyLabel = isMoveReturn ? 'В этом перемещении нет позиций' : (isRealizationReturn ? 'В этой реализации нет позиций' : (isRepairReturn ? 'В этом ремонте нет позиций' : 'В этом приходе нет позиций'));
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#888; padding:20px;">${emptyLabel}</td></tr>`;
            return;
        }

        const isPosted = returnDoc.is_posted === true || returnDoc.is_posted === 'true';

        const rowsHtml = availableItems.map(i => {
            const itemId = i[idField];
            const existing = returnedByItem[itemId];
            const currentQty = existing ? Number(existing.quantity) : 0;
            const maxQty = Number(i.available_qty) + currentQty;
            const price = Number(i.price_rub) || 0;
            const sum = (currentQty * price).toFixed(2);

            const btnLabel = currentQty > 0 ? 'Изменить' : 'Вернуть';

            return `
                <tr data-item-id="${itemId}" data-return-item-id="${existing ? existing.id : ''}" class="return-row">
                    <td style="padding:6px;">${i.zaphasti_code || '—'}</td>
                    <td style="padding:6px;">${i.zaphasti_name || '—'}</td>
                    <td style="padding:6px; text-align:right;">${Number(i.original_qty).toFixed(2)}</td>
                    <td style="padding:6px; text-align:right; color:#16a34a;">${maxQty.toFixed(2)}</td>
                    <td style="padding:6px; text-align:right;">${price.toFixed(2)}</td>
                    <td style="padding:6px; text-align:right; ${currentQty > 0 ? 'font-weight:600; color:#0f172a;' : 'color:#94a3b8;'}">${currentQty > 0 ? currentQty.toFixed(2) : '—'}</td>
                    <td class="return-row-sum" style="padding:6px; text-align:right; font-weight:600;">${sum}</td>
                    <td style="padding:6px; text-align:center;">
                        <button type="button" class="return-open-drawer-btn"
                                data-item-id="${itemId}"
                                data-item-type="${itemTypeAttr}"
                                data-return-item-id="${existing ? existing.id : ''}"
                                data-code="${i.zaphasti_code || ''}"
                                data-name="${(i.zaphasti_name || '').replace(/"/g, '&quot;')}"
                                data-max="${maxQty}"
                                data-current="${currentQty}"
                                data-price="${price}"
                                ${isPosted ? 'disabled' : ''}
                                style="background:#16a34a; color:#fff; border:none; padding:6px 14px; border-radius:5px; cursor:pointer; font-size:12px; font-weight:600;">                            ${btnLabel}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (tbody) tbody.innerHTML = rowsHtml;

        if (!isPosted) {
            tbody.querySelectorAll('.return-open-drawer-btn').forEach(btn => {
                btn.addEventListener('click', () => openReturnQtyDrawer(btn, returnDoc));
            });
        }
    } catch (err) {
        console.error(err);
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#dc2626; padding:20px;">Ошибка загрузки позиций</td></tr>`;
    }
}


function openReturnQtyDrawer(btn, returnDoc) {
    const itemId = btn.dataset.itemId;
    const itemType = btn.dataset.itemType; 
    const returnItemId = btn.dataset.returnItemId;
    const maxQty = Number(btn.dataset.max) || 0;
    const currentQty = Number(btn.dataset.current) || 0;
    const price = Number(btn.dataset.price) || 0;
    const code = btn.dataset.code;
    const name = btn.dataset.name;

    const drawer = getOrCreateDrawer();
    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">Возврат позиции</h3>
            <button type="button" onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>
        <div style="margin-bottom:16px; padding:12px; background:#f8fafc; border-radius:8px;">
            <div style="font-weight:600; color:#0f172a;">${code} — ${name}</div>
            <div style="font-size:13px; color:#64748b; margin-top:4px;">Доступно к возврату: ${maxQty.toFixed(2)} шт. · Цена: ${price.toFixed(2)} руб.</div>
        </div>
        <div style="margin-bottom:16px;">
            <label style="font-size: 13px; color: #475569; display:block; margin-bottom:4px;">Количество к возврату</label>
            <input type="number" id="return-drawer-qty" min="0" max="${maxQty}" step="0.01" value="${currentQty}"
                   style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size:16px;">
        </div>
        <div style="display: flex; gap: 10px;">
            <button type="button" id="return-drawer-save-btn" style="flex:1; background:#16a34a; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer;">Сохранить</button>
            ${currentQty > 0 ? `<button type="button" id="return-drawer-remove-btn" style="background:#dc2626; color:white; border:none; padding:10px 16px; border-radius:6px; cursor:pointer;">Убрать</button>` : ''}
            <button type="button" onclick="closeDrawer()" style="flex:1; background:#e2e8f0; color:#334151; border:none; padding:10px; border-radius:6px; cursor:pointer;">Отмена</button>
        </div>
    `;
    openDrawer();

    document.getElementById('return-drawer-save-btn').addEventListener('click', async () => {
        const qtyInput = document.getElementById('return-drawer-qty');
        const newQty = Number(qtyInput.value) || 0;

        if (newQty <= 0) {
            showAppNotification('Укажите количество больше нуля (или нажмите «Убрать»)', 'warning');
            return;
        }
        if (newQty > maxQty) {
            showAppNotification(`Максимум можно вернуть ${maxQty.toFixed(2)} шт.`, 'warning');
            return;
        }

        await saveReturnQtyValue({ returnDoc, itemId, itemType, returnItemId, newQty });
    });

    const removeBtn = document.getElementById('return-drawer-remove-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
            await saveReturnQtyValue({ returnDoc, itemId, itemType, returnItemId, newQty: 0 });
        });
    }
}

async function saveReturnQtyValue({ returnDoc, itemId, itemType, returnItemId, newQty }) {
    try {
        let response;
        if (newQty <= 0) {
            if (!returnItemId) { closeDrawer(); return; }
            response = await fetch(`/api/return_items/${returnItemId}`, { method: 'DELETE' });
        } else if (returnItemId) {
            response = await fetch(`/api/return_items/${returnItemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQty })
            });
        } else {
            let body;
            if (itemType === 'move') {
                body = { return_id: returnDoc.id, move_item_id: itemId, quantity: newQty };
            } else if (itemType === 'realization') {
                body = { return_id: returnDoc.id, realization_item_id: itemId, quantity: newQty };
            } else if (itemType === 'repair') {
                body = { return_id: returnDoc.id, repair_item_id: itemId, quantity: newQty };
            } else {
                body = { return_id: returnDoc.id, receipt_item_id: itemId, quantity: newQty };
            }

            response = await fetch('/api/return_items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            showAppNotification(errData.error || 'Ошибка при сохранении возврата', 'error');
            return;
        }

        closeDrawer();
        showAppNotification(newQty <= 0 ? 'Позиция убрана из возврата' : 'Возврат сохранён', 'success');
        renderReturnItemsInline(returnDoc);
        if (typeof refreshData === 'function') refreshData();

    } catch (err) {
        console.error(err);
        showAppNotification('Ошибка соединения с сервером', 'error');
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

        if (response.ok && result.success) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('currentUser', login);
            localStorage.setItem('token', result.token);
            
            const userId = result.user?.id || result.id || result.userId || null;

                        if (userId) {
                localStorage.setItem('currentUserId', userId);
            }

                        localStorage.setItem('userRole', result.user?.role || 'employee');

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'flex';

            applyAccessControl();
            if ((result.user?.role || 'employee') === 'admin') {
                loadData('users', 'Пользователи');
            } else {
                loadData('zaphasti', 'Запчасти');
            }

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
    localStorage.removeItem('token');
        location.reload();
}

async function refreshData() {
    const savedSelectedItem = selectedItem;
    const savedId = savedSelectedItem ? (savedSelectedItem.id || savedSelectedItem.sklad_id || savedSelectedItem.postavhik_id || savedSelectedItem.receipt_id) : null;
    const previousEntity = currentEntity;

    const lockedSkladId = window.currentSkladId;
    const lockedPostavhikId = window.currentPostavhikId;
    const lockedReceiptId = window.currentReceiptId;
    const lockedRealizationId = window.currentRealizationId;
    const lockedRepairId = window.currentRepairId;
      const lockedCustomerId = window.currentCustomerId;
    const lockedDebtorWarehouseId = window.currentDebtorWarehouseId;
       const lockedReceiptsStartDate = window.currentReceiptsStartDate;
    const lockedReceiptsEndDate = window.currentReceiptsEndDate;
    const lockedExpenseMonthStr = window.currentExpenseMonthStr;
       if (previousEntity === 'money_receipts' || previousEntity === 'money_receipts_by_sklad' || previousEntity === 'money_receipts_by_customers_totals' || previousEntity === 'money_receipts_by_customers') {
        let parentParam = '';
        if (previousEntity === 'money_receipts_by_sklad') {
            parentParam = '';
        } else if (previousEntity === 'money_receipts') {
            parentParam = {
                sklad_id: lockedSkladId,
                customer_id: lockedCustomerId,
                debtor_warehouse_id: lockedDebtorWarehouseId,
                start_date: lockedReceiptsStartDate,
                end_date: lockedReceiptsEndDate
            };
        } else if (previousEntity === 'money_receipts_by_customers') {
            parentParam = { group_key: window.currentGroupKey, sklad_id: lockedSkladId };
        } else {
            parentParam = lockedSkladId || savedSelectedItem;
        }
        await loadReceiptMainData(previousEntity, parentParam);
    }
        else if (
        previousEntity === 'expenses_by_sklad' || 
        previousEntity === 'expenses_by_suppliers_totals' ||
        previousEntity === 'expenses_by_suppliers' || 
        previousEntity === 'expenses_by_receipts' || 
        previousEntity === 'expense_items'
    ) {
        let parentParam = '';
        if (previousEntity === 'expenses_by_suppliers_totals') {
            parentParam = lockedSkladId || savedSelectedItem;
        } else if (previousEntity === 'expenses_by_suppliers') {
            parentParam = lockedPostavhikId || savedSelectedItem;
        } else if (previousEntity === 'expenses_by_receipts') {
            parentParam = { postavhik_id: lockedPostavhikId, month_str: lockedExpenseMonthStr || null };
        } else if (previousEntity === 'expense_items') {
            parentParam = lockedReceiptId || savedSelectedItem;
        }
        await loadExpenseMainData(previousEntity, parentParam);
    }
    else {
        const activeLink = document.querySelector('.nav-link.active');
        const title = activeLink ? activeLink.innerText : 'Данные';
        await loadData(previousEntity, title);
    }

            if (savedSelectedItem && savedId) {
        const rows = document.querySelectorAll('#table-body tr');
        let foundRow = null;
        
        rows.forEach(row => {
            row.classList.remove('selected-row');
            if (row.dataset.id == String(savedId)) {
                foundRow = row;
            }
        });

        if (foundRow) {
            foundRow.classList.add('selected-row');
            selectedItem = savedSelectedItem;

            if (previousEntity === 'money_receipts') {
                const detailEntity = typeof getCurrentDetailEntity === 'function' ? getCurrentDetailEntity() : 'money_receipts_detail';
                let realizationId = lockedRealizationId || savedSelectedItem.realization_id || savedSelectedItem.id || '';
                let repairId = lockedRepairId || savedSelectedItem.repair_id || '';
                let customerId = lockedCustomerId || savedSelectedItem.customer_id || '';
                let skladId = savedSelectedItem.sklad_id || lockedSkladId || '';
                
                let url = '';
                if (detailEntity === 'money_receipts_works_detail') {
                    url = `/api/money_receipts_works_detail?realization_id=${realizationId}&repair_id=${repairId}&customer_id=${customerId}&sklad_id=${skladId}`;
                } else {
                    url = `/api/money_receipts_detail?realization_id=${realizationId}&repair_id=${repairId}&customer_id=${customerId}&sklad_id=${skladId}`;
                }
                loadReceiptDetailTable(url, detailEntity);
            }

                        if (previousEntity === 'expense_items') {
                let skladId = lockedSkladId || '';
                let postavhikId = lockedPostavhikId || '';
                let currentReceipt = lockedReceiptId || savedId || '';
                let url = `/api/expense_items?receipt_id=${currentReceipt}&postavhik_id=${postavhikId}&sklad_id=${skladId}`;
                loadExpenseDetailTable(url);
            }

            if (previousEntity === 'realizations') {
                const activeTabBtn = document.querySelector('#tabs-for-realizations button.active');
                const detailEntity = activeTabBtn ? activeTabBtn.getAttribute('data-tab') : 'realization_items';
                loadDetailData(detailEntity, savedSelectedItem.id);
            }
        }
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

function openImageLightbox(url) {
    if (!url) return;
    const existing = document.getElementById('image-lightbox-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'image-lightbox-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        cursor: zoom-out; padding: 20px; box-sizing: border-box;
    `;

    overlay.innerHTML = `
        <img src="${url}" style="max-width: 95%; max-height: 95%; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 30px rgba(0,0,0,0.5);" />
        <button id="image-lightbox-close" style="position: fixed; top: 16px; right: 24px; background: rgba(255,255,255,0.15); color: #fff; border: none; width: 40px; height: 40px; border-radius: 50%; font-size: 22px; cursor: pointer; line-height: 1;">&times;</button>
    `;

    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
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

async function applyFilters(fromPager) {
    if (currentEntity !== 'stock_balances') return;
    if (fromPager !== true) PAGER.page = 1;         
    PAGER.reload = () => applyFilters(true);
    const seq = ++PAGER.seq;

    const dateVal = document.getElementById('filter-date')?.value || '';
    const warehouseId = document.getElementById('filter-warehouse')?.value || '';

    const params = new URLSearchParams();
    if (dateVal) params.append('date', dateVal);
    if (warehouseId) params.append('warehouse_id', warehouseId);
    PAGER.baseUrl = '/api/stock_balances';
    PAGER.baseQuery = params.toString();
    pagerParams(params);

    try {
        const response = await fetch(`/api/stock_balances?${params.toString()}`);
        if (!response.ok) throw new Error('Ошибка фильтрации');

        const pageItems = await pagerReadResponse(response, seq);
        if (pageItems === null) return;
        currentItems = pageItems;
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

    tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
    tr.classList.add('selected-row');

    const detailContainerTarget = document.getElementById('detail-container');
    if (detailContainerTarget) {
        detailContainerTarget.style.display = 'flex';
    }

    const zId = item.zaphasti_id || item.id;
    const wId = item.warehouse_id || item.sklad_id || item.id_sklad || item.warehouseId;
    loadDetailData('stock_batches', { zaphasti_id: zId, warehouse_id: wId, date: dateVal });
    };
            tbody.appendChild(tr);
        });

        const rowCountEl = document.getElementById('row-count');
        if (rowCountEl) {
            rowCountEl.innerText = `Раздел: Остатки запчастей | Найдено строк: ${PAGER.total}`;
        }
        pagerClientOnlyFilters();
        renderPager();

       if (currentItems.length > 0) {
    selectedItem = currentItems[0];

    const detailContainerTarget = document.getElementById('detail-container');
    if (detailContainerTarget) {
        detailContainerTarget.style.display = 'flex';
    }

    const zId = currentItems[0].zaphasti_id || currentItems[0].id;
    const wId = currentItems[0].warehouse_id || currentItems[0].sklad_id || currentItems[0].id_sklad || currentItems[0].warehouseId;

    loadDetailData('stock_batches', { 
        zaphasti_id: zId, 
        warehouse_id: wId,
        date: dateVal 
    });
    } else {
            selectedItem = null;
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


async function applyMovementFilters(fromPager) {
    if (currentEntity !== 'stock_movement') return;
    if (fromPager !== true) PAGER.page = 1;
    PAGER.reload = () => applyMovementFilters(true);
    const seq = ++PAGER.seq;

    const startDateVal = document.getElementById('movement-start-date')?.value || '';
    const endDateVal = document.getElementById('movement-end-date')?.value || '';
    const warehouseId = document.getElementById('movement-warehouse')?.value || '';

    const params = new URLSearchParams();
    if (startDateVal) params.append('start_date', startDateVal);
    if (endDateVal) params.append('end_date', endDateVal);
    if (warehouseId) params.append('warehouse_id', warehouseId);

    try {
        let url = `/api/stock_movement`;
        PAGER.baseUrl = url;
        PAGER.baseQuery = params.toString();
        pagerParams(params);
        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Ошибка фильтрации движения запчастей');

        const pageItems = await pagerReadResponse(response, seq);
        if (pageItems === null) return;
        currentItems = pageItems;
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

        document.getElementById('row-count').innerText = `Раздел: Движение запчастей | Найдено строк: ${PAGER.total}`;
        pagerClientOnlyFilters();
        renderPager();

        if (currentItems.length > 0) {
    selectedItem = currentItems[0];

    const detailContainerTarget = document.getElementById('detail-container');
    if (detailContainerTarget) {
        detailContainerTarget.style.display = 'flex';
    }

    loadDetailData('part_movement_details', selectedItem);
    } else {
            emptyDetailBody();
        }

    } catch (err) {
        console.error('Ошибка применения фильтров движения:', err);
    }
}

async function printMainTable() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Браузер заблокировал окно печати. Разрешите всплывающие окна для этого сайта.');
        return;
    }

    let allRowsHtml = null;
    if (PAGER.reload && PAGER.total > currentItems.length) {   
        try {
            allRowsHtml = await pagerFetchAllRowsHtml();
        } catch (err) {
            printWindow.close();
            alert('Не удалось загрузить все строки для печати: ' + err.message);
            return;
        }
    }

    const titleElement = document.querySelector('.sidebar .nav-link.active') || document.querySelector('.accordion-header span');
    const title = titleElement ? titleElement.innerText.replace('▲', '').replace('▼', '').trim() : 'Отчет по системе';
    
    const thead = document.getElementById('table-headers');
    const tbody = document.getElementById('table-body');

    if (!tbody || !thead) {
        alert('Нечего печатать: таблица не найдена.');
        return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('ru-RU') + ' ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 11px;
                        color: #111;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                    }
                    .print-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: baseline;
                        border-bottom: 2px solid #333;
                        padding-bottom: 6px;
                        margin-bottom: 12px;
                    }
                    .print-header h2 {
                        margin: 0;
                        font-size: 15px;
                        color: #111;
                    }
                    .print-header .print-date {
                        font-size: 11px;
                        color: #555;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th, td {
                        border: 1px solid #bbb;
                        padding: 5px 6px;
                        vertical-align: middle;
                    }
                    th {
                        background-color: #f2f2f2 !important;
                        color: #000;
                        font-weight: bold;
                        text-align: center;
                        font-size: 11px;
                    }
                    
                  
                    th:nth-child(1), td:nth-child(1) { width: 50px; text-align: center; } 
                    th:nth-child(2), td:nth-child(2) { width: 60px; text-align: center; } 
                    th:nth-child(3), td:nth-child(3) { width: auto; }                      
                    th:nth-child(4), td:nth-child(4) { width: 75px; text-align: center; } 
                    th:nth-child(5), td:nth-child(5) { width: 75px; text-align: center; } 
                    th:nth-child(6), td:nth-child(6) { width: auto; }                      
                    th:nth-child(7), td:nth-child(7) { width: 90px; text-align: center; } 
                    th:nth-child(8), td:nth-child(8) { width: 140px; }                     
                    th:nth-child(9), td:nth-child(9) { width: 65px; text-align: right; }  
                    th:nth-child(10), td:nth-child(10) { width: 50px; text-align: center; } 

                    button, .btn, input {
                        display: none !important;
                    }
                    
                    tr {
                        page-break-inside: avoid;
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h2>Отчет: ${title}</h2>
                    <div class="print-date">Дата печати: ${formattedDate}</div>
                </div>
                <table>
                    <thead>
                        <tr>${thead.innerHTML}</tr>
                    </thead>
                    <tbody>
                        ${allRowsHtml !== null ? allRowsHtml : tbody.innerHTML}
                    </tbody>
                </table>
            </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
    }, 250);
}

function printDetailTable() {
    const activeTabBtn = document.querySelector(
        '.car-tab-btn.active, .accident-tab-btn.active, .repair-tab-btn.active, .customer-tab-btn.active, .realization-tab-btn.active'
    );
    const detailTitleEl = document.getElementById('detail-title');
    const title = (activeTabBtn ? activeTabBtn.innerText.trim() : '') || (detailTitleEl ? detailTitleEl.innerText.trim() : 'Отчет');

    const thead = document.getElementById('detail-headers') || document.querySelector('#detail-container thead tr');
    const tbody = document.getElementById('detail-body');

    if (!tbody || !thead) {
        alert('Нечего печатать: таблица не найдена.');
        return;
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('ru-RU') + ' ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
        <html>
            <head>
                <title>${title}</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; background: #fff; }
                    .print-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 12px; }
                    .print-header h2 { margin: 0; font-size: 15px; color: #111; }
                    .print-header .print-date { font-size: 11px; color: #555; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #bbb; padding: 5px 6px; vertical-align: middle; }
                    th { background-color: #f2f2f2 !important; color: #000; font-weight: bold; text-align: center; font-size: 11px; }
                    button, .btn, input { display: none !important; }
                    tr { page-break-inside: avoid; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h2>Отчет: ${title}</h2>
                    <div class="print-date">Дата печати: ${formattedDate}</div>
                </div>
                <table>
                    <thead><tr>${thead.innerHTML}</tr></thead>
                    <tbody>${tbody.innerHTML}</tbody>
                </table>
            </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
}

function ensureDetailPrintButton() {
    const oldBtn = document.getElementById('detail-print-btn');
    if (oldBtn) oldBtn.remove();

    const tabsForCars = document.getElementById('tabs-for-cars');
    const tabsForAccidents = document.getElementById('tabs-for-accidents');
    const activeGroup = [tabsForCars, tabsForAccidents].filter(Boolean).find(el => el.offsetParent !== null);
    if (!activeGroup) return; 

    const outerBar = document.getElementById('car-tabs-bar') || document.getElementById('car-tabs-panel') || activeGroup.parentElement;
    if (!outerBar) return;

    const btn = document.createElement('button');
    btn.id = 'detail-print-btn';
    btn.type = 'button';
    btn.innerText = '🖨️ Печать';
    btn.onclick = printDetailTable;
    btn.style.cssText = 'margin-left: auto; padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px; background: #f7f7f7; cursor: pointer; font-size: 13px; white-space: nowrap;';

    const computedDisplay = getComputedStyle(outerBar).display;
    if (computedDisplay !== 'flex') {
        outerBar.style.display = 'flex';
        outerBar.style.alignItems = 'center';
    }

    outerBar.appendChild(btn);
}

async function loadData(entity, title, customParams = {}, opts = {}) {
    const dataOnly = !!(opts && opts.dataOnly);   
    const sameEntity = (PAGER.entity === entity);
    resetSharedUiForEntity(entity);

    if (!sameEntity) pagerReset(entity);          
    PAGER.entity = entity;
    PAGER.reload = () => loadData(entity, title, customParams, { dataOnly: true });
    const seq = ++PAGER.seq;
    PAGER.loading = true;
    renderPager();

    currentEntity = entity;
    selectedItem = null;
    const config = getConfig(entity);

    window.currentEntityName = entity;
    window.currentEntityTitle = title;

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
            btnAdd.style.display = 'inline-block';
            btnEdit.style.display = 'none';
            btnDelete.style.display = 'none';
        } else if (entity === 'employees' && localStorage.getItem('userRole') !== 'admin') {
            btnAdd.style.display = 'none';
            btnEdit.style.display = 'none';
            btnDelete.style.display = 'none';
        } else {
            btnAdd.style.display = 'inline-block';
            btnEdit.style.display = 'inline-block';
            btnDelete.style.display = 'inline-block';
        }
    }

    const printBtn = document.querySelector('button[onclick="printMainTable()"]');
    if (printBtn) {
        if (entity === 'car_cards' || entity === 'realizations'|| entity === 'stock_balances'|| entity === 'stock_movement' ) {
            printBtn.style.display = 'inline-block';
        } else {
            printBtn.style.display = 'none';
        }
    }

    const detailContainer = document.getElementById('detail-container');
    const detailToolbar = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');

    if (detailContainer) {
        detailContainer.style.display = 'none'; 

        if (detailToolbar) {
            detailToolbar.style.display = 'none';
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
            const balanceDate = document.getElementById('filter-date')?.value || '';

            if (startDateVal) params.append('start_date', startDateVal);
            if (endDateVal) params.append('end_date', endDateVal);
            if (balanceDate) params.append('date', balanceDate);   
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

        PAGER.baseUrl = url;
        PAGER.baseQuery = params.toString();
        pagerParams(params);

        if (params.toString()) {
            url += `?${params.toString()}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Ошибка сервера');

        const pageItems = await pagerReadResponse(response, seq);
        if (pageItems === null) return;  
        currentItems = pageItems;

        const headerTr = document.getElementById('table-headers');
        const tbody = document.getElementById('table-body');

        tbody.innerHTML = '';

        const thead = headerTr.closest('thead');
        let filterRow = document.getElementById('table-filter-row');
        const keepFilterRow = !!(dataOnly && filterRow && filterRow.dataset.entity === entity);

        if (!filterRow) {
            filterRow = document.createElement('tr');
            filterRow.id = 'table-filter-row';
            thead.insertBefore(filterRow, headerTr);
        } else if (filterRow.nextElementSibling !== headerTr) {
            thead.insertBefore(filterRow, headerTr);
        }

        const visibleColumnsForFilter = config.columns.filter(col => col.table !== false);

        if (!keepFilterRow) filterRow.innerHTML = visibleColumnsForFilter.map((col, index) => {
            let styleAttr = col.style ? `style="${col.style} padding: 4px;"` : (col.width ? `style="width: ${col.width}; padding: 4px;"` : 'style="padding: 4px;"');
            if (col.style && col.style.includes('display: none')) {
                return `<th style="display: none; padding: 4px;"></th>`;
            }
            return `
                <th ${styleAttr}>
                    <input type="text" 
                           data-column-index="${index}" 
                           data-column="${col.field}" 
                           oninput="filterTable()" 
                           placeholder="Фильтр..."
                           style="width: 100%; padding: 4px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                </th>
            `;
        }).join('');

        if (!keepFilterRow) {
            filterRow.dataset.entity = entity;
            filterRow.querySelectorAll('input[data-column]').forEach(inp => {
                inp.value = PAGER.filters[inp.getAttribute('data-column')] || '';
            });
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

                tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
                tr.classList.add('selected-row');

                const entitiesWithDetails = ['receipts', 'moves', 'cars', 'car_cards', 'accidents', 'repairs', 'realizations', 'money_receipts', 'stock_movement', 'postavhik', 'counterparties', 'customers', 'expenses_by_receipts', 'stock_balances','returns'];
                if (!entitiesWithDetails.includes(entity)) {
                    return;
                }

                const detailContainerTarget = document.getElementById('detail-container');
                const detailToolbarTarget = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
                
                if (detailContainerTarget) {
                    detailContainerTarget.style.display = 'flex';
                }
                
                if (detailToolbarTarget) {
                    if (entity === 'stock_movement') {
                        detailToolbarTarget.style.display = 'none';
                    } else if (entity === 'car_cards' || entity === 'stock_balances') {
                        detailToolbarTarget.style.display = 'none';
                    } else {
                        detailToolbarTarget.style.display = 'flex';
                    }
                }
                if (entity !== 'receipts') removeDetailPager();
                if (entity === 'stock_balances') {
                    const zId = item.zaphasti_id || item.id;
                    const wId = item.warehouse_id || item.sklad_id || item.id_sklad || item.warehouseId;

                    loadDetailData('stock_batches', { 
                        zaphasti_id: zId, 
                        warehouse_id: wId,
                        date: document.getElementById('filter-date')?.value || ''
                    });
                } else if (entity === 'stock_movement') {
                    loadDetailData('part_movement_details', item);
                } else if (entity === 'receipts') {
                    loadDetailData('receipt_items', item.id);
               } else if (entity === 'moves') {
    loadDetailData('move_items', item.id);
    } else if (entity === 'returns') {
    detailToolbarTarget && (detailToolbarTarget.style.display = 'none'); 
    renderReturnItemsInline(item);
    }
                else if (entity === 'realizations') {
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
    const activeSubTab = getCurrentDetailEntity();
    currentCustomerSubTab = activeSubTab;
    loadDetailData(activeSubTab, item.id);
}
            };

            tbody.appendChild(tr);
        });

        const hasPagerFilter = !!(PAGER.search || Object.keys(PAGER.filters).length);
        document.getElementById('row-count').innerText = `Раздел: ${title} | Всего строк: ${PAGER.total}${hasPagerFilter ? ' (по поиску/фильтру)' : ''}`;
        pagerClientOnlyFilters();
        renderPager();

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

        const autoOpenEntities = ['receipts', 'moves', 'realizations', 'cars', 'postavhik', 'counterparties', 'customers', 'stock_balances', 'stock_movement'];
        if (autoOpenEntities.includes(entity) && currentItems.length > 0) {
            const firstRow = tbody.querySelector('tr');
            if (firstRow) {
                firstRow.click();
            }
        }

    } catch (err) {
        currentItems = [];
        document.getElementById('row-count').innerText = `Раздел: ${title} (нет данных на сервер)`;
        if (seq === PAGER.seq) {
            PAGER.loading = false;
            PAGER.total = 0;
            renderPager();
        }
    }
}


function resetSharedUiForEntity(entity) {
    const printBtn = document.querySelector('button[onclick="printMainTable()"]');
    if (printBtn) {
        const printableEntities = [
            'car_cards', 'realizations', 'stock_balances', 'stock_movement',
            'money_receipts_by_sklad', 'money_receipts',
            'expenses_by_sklad', 'expenses_by_suppliers', 'expenses_by_receipts'
        ];
        printBtn.style.display = printableEntities.includes(entity) ? 'inline-block' : 'none';
    }

    const btnAdd = document.getElementById('btn-add');
    const btnEdit = document.getElementById('btn-edit');
    const btnDelete = document.getElementById('btn-delete');
    const readOnlyMainEntities = [
        'car_cards', 'stock_balances', 'stock_movement',
        'money_receipts_by_sklad', 'money_receipts', 'money_receipts_detail',
        'expenses_by_sklad', 'expenses_by_suppliers', 'expenses_by_receipts', 'expense_items'
    ];
    const isReadOnly = readOnlyMainEntities.includes(entity);
    if (btnAdd) btnAdd.style.display = isReadOnly ? 'none' : 'inline-block';
    if (btnEdit) btnEdit.style.display = isReadOnly ? 'none' : 'inline-block';
    if (btnDelete) btnDelete.style.display = isReadOnly ? 'none' : 'inline-block';

    const btnBack = document.getElementById('btn-back-expense');
    if (btnBack) {
        btnBack.style.display = 'none';
        btnBack.onclick = null;
    }

    ['parts-filter-panel', 'movement-filter-panel']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

    const detailContainer = document.getElementById('detail-container');
    if (detailContainer) detailContainer.style.display = 'none';

    const detailToolbar = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
    if (detailToolbar) detailToolbar.style.display = 'none';

    const carTabsBar = document.getElementById('car-tabs-bar') || document.getElementById('car-tabs-panel');
    if (carTabsBar) carTabsBar.style.display = 'none';

    ['tabs-for-cars', 'tabs-for-accidents', 'tabs-for-repairs', 'tabs-for-customers', 'tabs-for-realizations']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

    const rowCount = document.getElementById('row-count');
    if (rowCount) rowCount.innerText = '';
}
async function openSupplierPaymentHistory(postavhikId, postavhikName, monthStr) {
    const drawer = getOrCreateDrawer();

    const monthLabel = monthStr ? ` — ${monthStr}` : '';

    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">История оплат: ${postavhikName}${monthLabel}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>
        <div style="text-align: center; color: #666; padding: 20px;">Загрузка истории...</div>
    `;
    openDrawer();

    try {
        const monthParam = monthStr ? `?month_str=${monthStr}` : '';
        let response = await fetch(`/api/expenses_by_suppliers/${postavhikId}/payments${monthParam}`);
        if (!response.ok) throw new Error('Не удалось загрузить историю');

        let payments = await response.json();

        if (!payments || payments.length === 0) {
            drawer.querySelector('div:last-child').innerHTML = 'Этому поставщику еще не было оплат.';
            return;
        }

        let rowsHtml = payments.map(p => {
            const pDate = p.date ? new Date(p.date).toLocaleDateString() : '—';
            const rawAmount = Number(p.amount || 0);
            const pAmount = rawAmount.toFixed(2);
            const pDoc = p.doc_number || '—';
            
            const isReturn = rawAmount < 0;
            const amountColor = isReturn ? '#dc2626' : '#16a34a';
            
            let pComment = p.comment || '';
            if (isReturn && !pComment.toLowerCase().includes('возврат')) {
                pComment = pComment ? `Возврат: ${pComment}` : 'Возврат';
            }
            if (!pComment) pComment = '—';

            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; color: #4b5563;">${pDate}</td>
                    <td style="padding: 10px; color: #0f172a;">${pDoc}</td>
                    <td style="padding: 10px; font-weight: bold; color: ${amountColor}; text-align: right;">${pAmount}</td>
                    <td style="padding: 10px; color: #6b7280; font-size: 13px;">${pComment}</td>
                </tr>
            `;
        }).join('');

        drawer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 16px; color: #333;">История оплат: ${postavhikName}${monthLabel}</h3>
                <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left;">
                        <th style="padding: 8px; color: #374151;">Дата</th>
                        <th style="padding: 8px; color: #374151;">Накладная</th>
                        <th style="padding: 8px; color: #374151; text-align: right;">Сумма</th>
                        <th style="padding: 8px; color: #374151;">Комментарий</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div style="margin-top: 20px;">
                <button type="button" onclick="closeDrawer()" style="width: 100%; background: #e2e8f0; color: #334151; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Закрыть</button>
            </div>
        `;

    } catch (err) {
        console.error(err);
        drawer.querySelector('div:last-child').innerHTML = '<span style="color: #dc2626;">Ошибка при загрузке истории платежей</span>';
    }
}

async function openReceiptCustomerPaymentDrawer(groupKey, debtSum, titleLabel, monthStr, skladId) {
    const drawer = getOrCreateDrawer();

       drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 600;">Оплата за месяц: ${titleLabel}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">&times;</button>
        </div>

        <div id="pay-docs-list" style="margin-bottom: 16px; color: #64748b; font-size: 13px;">Загрузка накладных...</div>

        <form id="pay-form" onsubmit="submitReceiptCustomerPayment(event, '${groupKey}', '${monthStr}', '${skladId || ''}')" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
    <label ...>Сумма к оплате (с учётом прошлых месяцев): <span ...>${debtSum}</span></label>
                <input type="number" step="0.01" id="receipt-payment-amount" value="${debtSum}" required
                    style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; color: #0f172a;">
            </div>

            <div>
                <label style="display: block; font-size: 13px; color: #475569; margin-bottom: 6px;">Комментарий</label>
                <textarea id="receipt-payment-comment" placeholder="Примечание к платежу..." 
                    style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical; min-height: 60px; color: #0f172a;"></textarea>
            </div>

            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button type="submit" style="flex: 1; background: #16a34a; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 500;">Сохранить</button>
                <button type="button" onclick="closeDrawer()" style="flex: 1; background: #e2e8f0; color: #334151; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Отмена</button>
            </div>
        </form>
    `;
    openDrawer();

    try {
        const isWarehouseDebtor = String(groupKey).startsWith('wh_');
        const realId = isWarehouseDebtor ? String(groupKey).replace('wh_', '') : groupKey;

     const isPayAll = !monthStr || monthStr === 'undefined' || monthStr === 'null';
    const skladParam = skladId ? `&sklad_id=${skladId}` : '';
    const idParam = isWarehouseDebtor ? `debtor_warehouse_id=${realId}` : `customer_id=${realId}`;
    let requestUrl = `/api/money_receipts?${idParam}${skladParam}`;
    if (!isPayAll) {
    const [year, month] = monthStr.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
    requestUrl += `&end_date=${endDate}`;
    }
        const resp = await fetch(requestUrl);
        const listEl = document.getElementById('pay-docs-list');
        if (!listEl) return;

        if (!resp.ok) {
            listEl.innerHTML = '<span style="color:#dc2626;">Не удалось загрузить список накладных</span>';
            return;
        }

               const data = await resp.json();
        const docs = Array.isArray(data) ? data : (data.rows || []);
        const unpaid = docs.filter(d => Number(d.debt_sum || 0) > 0);

        if (unpaid.length === 0) {
            listEl.innerHTML = '<span>Неоплаченных накладных за этот месяц не найдено.</span>';
            return;
        }

        window._payUnpaidDocs = unpaid;
        window._paySelectedDocIds = [];

                listEl.innerHTML = `
            <label style="display: block; font-size: 13px; color: #475569; margin-bottom: 6px; font-weight: 500;">
                Накладные (необязательно): найдите и выберите конкретные для оплаты.
                Если ничего не выбрано — сумма распределится по всем от старых к новым, как раньше.
            </label>
            <div id="pay-docs-search-block" style="position: relative;">
                <input type="text" id="pay-doc-search-input" placeholder=" Начните ввод для поиска накладной..." autocomplete="off"
                    style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; color: #0f172a;">
                <div id="pay-doc-search-dropdown" style="display: none; position: absolute; z-index: 20; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 6px 6px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.08);"></div>
                <div id="pay-doc-selected-list" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;"></div>
            </div>
        `;

        const searchInput = document.getElementById('pay-doc-search-input');
        const dropdown = document.getElementById('pay-doc-search-dropdown');
        const selectedListEl = document.getElementById('pay-doc-selected-list');

        function renderSelectedChips() {
            selectedListEl.innerHTML = window._paySelectedDocIds.map(did => {
                const d = window._payUnpaidDocs.find(x => String(x.id) === String(did));
                if (!d) return '';
                return `<span style="display: inline-flex; align-items: center; gap: 6px; background: #eff6ff; color: #1d4ed8; border-radius: 4px; padding: 4px 8px; font-size: 12px;">
                    № ${d.doc_number || d.id} (долг ${Number(d.debt_sum || 0).toFixed(2)})
                    <span data-remove-id="${did}" style="cursor: pointer; font-weight: bold;">&times;</span>
                </span>`;
            }).join('');

            selectedListEl.querySelectorAll('[data-remove-id]').forEach(el => {
                el.addEventListener('click', () => {
                    const did = el.getAttribute('data-remove-id');
                    window._paySelectedDocIds = window._paySelectedDocIds.filter(x => String(x) !== String(did));
                    renderSelectedChips();
                });
            });

            const amountInput = document.getElementById('receipt-payment-amount');
            if (amountInput) {
                if (window._paySelectedDocIds.length > 0) {
                    const sum = window._paySelectedDocIds.reduce((acc, did) => {
                        const d = window._payUnpaidDocs.find(x => String(x.id) === String(did));
                        return acc + (d ? Number(d.debt_sum || 0) : 0);
                    }, 0);
                    amountInput.value = sum.toFixed(2);
                } else {
                    amountInput.value = debtSum;
                }
            }
        }

        function renderDropdown(filterText) {
            const filter = (filterText || '').toLowerCase().trim();
            const available = window._payUnpaidDocs.filter(d => {
                const did = String(d.id);
                if (window._paySelectedDocIds.includes(did)) return false;
                const label = `${d.doc_number || d.id}`.toLowerCase();
                return !filter || label.includes(filter);
            });

            if (available.length === 0) {
                dropdown.innerHTML = `<div style="padding: 8px; color: #94a3b8; font-size: 12px;">Ничего не найдено</div>`;
            } else {
                dropdown.innerHTML = available.map(d => `
                    <div class="pay-doc-option" data-id="${d.id}" style="padding: 8px; cursor: pointer; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9;">
                        № ${d.doc_number || d.id} от ${d.date ? new Date(d.date).toLocaleDateString() : '—'} — долг: <b>${Number(d.debt_sum || 0).toFixed(2)}</b>
                    </div>
                `).join('');

                dropdown.querySelectorAll('.pay-doc-option').forEach(opt => {
                    opt.addEventListener('click', () => {
                        const did = opt.getAttribute('data-id');
                        if (!window._paySelectedDocIds.includes(did)) {
                            window._paySelectedDocIds.push(did);
                        }
                        searchInput.value = '';
                        dropdown.style.display = 'none';
                        renderSelectedChips();
                    });
                });
            }

            dropdown.style.display = 'block';
        }

        searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
        searchInput.addEventListener('input', () => renderDropdown(searchInput.value));
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#pay-docs-search-block')) {
                dropdown.style.display = 'none';
            }
        });
    } catch (err) {
        console.error('Ошибка загрузки списка накладных для оплаты:', err);
        const listEl = document.getElementById('pay-docs-list');
        if (listEl) listEl.innerHTML = '<span style="color:#dc2626;">Ошибка загрузки списка накладных</span>';
    }
}

async function submitReceiptCustomerPayment(event, groupKey, monthStr, skladId) {
    event.preventDefault();
    if (window._payBusy) return;
    window._payBusy = true;
    setTimeout(() => { window._payBusy = false; }, 3000);
    const docIds = Array.isArray(window._paySelectedDocIds) ? window._paySelectedDocIds : [];

    const amount = document.getElementById('receipt-payment-amount').value;
    const comment = document.getElementById('receipt-payment-comment').value;

    try {
        let response = await fetch(`/api/money_receipts_by_customers/${groupKey}/pay_month`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount,
                comment,
                month_str: monthStr,
                sklad_id: skladId || null,   
                doc_ids: docIds.length > 0 ? docIds : null
            })
        });

        let result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Ошибка при оплате');

        if (result.warning) {
            showAppNotification(result.warning, 'warning');
        } else {
            showAppNotification('Оплата успешно проведена', 'success');
        }

        closeDrawer();
        loadReceiptMainData(monthStr ? 'money_receipts_by_customers' : 'money_receipts_by_customers_totals', monthStr ? { group_key: groupKey, sklad_id: skladId } : window.currentSkladId);

    } catch (err) {
        console.error(err);
        showAppNotification('Ошибка: ' + err.message, 'error');
    }
}




async function openCustomerPaymentHistory(groupKey, counterpartyName, monthStr) {
    const drawer = getOrCreateDrawer();
    drawer.style.width = '680px';
    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">История оплат: ${counterpartyName} (${monthStr || ''})</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>
        <div style="text-align: center; color: #666; padding: 20px;">Загрузка истории...</div>
    `;
    openDrawer();

    try {
        let response = await fetch(`/api/money_receipts_by_customers/${groupKey}/payments?month_str=${monthStr || ''}`);
        if (!response.ok) throw new Error('Не удалось загрузить историю');

        let payments = await response.json();
        if (!payments || payments.length === 0) {
            drawer.querySelector('div:last-child').innerHTML = 'Этому покупателю еще не было оплат.';
            return;
        }

               let rowsHtml = payments.map(p => {
            const pDate = p.date ? new Date(p.date).toLocaleDateString() : '—';
            const pAmountNum = Number(p.amount || 0);
            const isReturn = p.row_type === 'return' || pAmountNum < 0;
            const pAmount = pAmountNum.toFixed(2);
            const pDoc = p.doc_number || '—';
            const pComment = p.comment || '—';
            const amountColor = isReturn ? '#dc2626' : '#16a34a';
            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; color: #4b5563;">${pDate}</td>
                    <td style="padding: 10px; color: #0f172a;">${pDoc}</td>
                    <td style="padding: 10px; font-weight: bold; color: ${amountColor}; text-align: right;">${pAmount}</td>
                    <td style="padding: 10px; color: #6b7280; font-size: 13px;">${pComment}</td>
                </tr>
            `;
        }).join('');

        drawer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 16px; color: #333;">История оплат: ${counterpartyName}</h3>
                <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb; text-align: left;">
                        <th style="padding: 8px; color: #374151;">Дата</th>
                        <th style="padding: 8px; color: #374151;">Документ</th>
                        <th style="padding: 8px; color: #374151; text-align: right;">Сумма</th>
                        <th style="padding: 8px; color: #374151;">Комментарий</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            <div style="margin-top: 20px;">
                <button type="button" onclick="closeDrawer()" style="width: 100%; background: #e2e8f0; color: #334151; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Закрыть</button>
            </div>
        `;
    } catch (err) {
        console.error(err);
        drawer.querySelector('div:last-child').innerHTML = '<span style="color: #dc2626;">Ошибка при загрузке истории платежей</span>';
    }
}

async function openPaymentDrawer(postavhikId, debtSum, titleLabel, monthStr) {
    const drawer = getOrCreateDrawer();
    const isPayAll = !monthStr || monthStr === 'undefined' || monthStr === 'null';
    const headerLabel = isPayAll ? `Оплата долга поставщику: ${titleLabel}` : `Оплата за месяц: ${titleLabel}`;
    const amountLabel = isPayAll ? 'Общий накопленный долг' : 'Сумма долга за месяц';

    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 600;">${headerLabel}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">&times;</button>
        </div>

        <div id="pay-receipts-list" style="margin-bottom: 16px; color: #64748b; font-size: 13px;">Загрузка накладных...</div>

        <form id="pay-form" onsubmit="submitPayment(event, '${postavhikId}', '${isPayAll ? '' : monthStr}')" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
                <label style="display: block; font-size: 13px; color: #475569; margin-bottom: 6px;">${amountLabel}: <span style="color:rgb(2, 3, 2); font-weight: 600;">${debtSum}</span></label>
                <input type="number" step="0.01" id="payment-amount" value="${debtSum}" required
                    style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; color: #0f172a;">
            </div>

            <div>
                <label style="display: block; font-size: 13px; color: #475569; margin-bottom: 6px;">Комментарий</label>
                <textarea id="payment-comment" placeholder="Примечание к платежу..." 
                    style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical; min-height: 60px; color: #0f172a;"></textarea>
            </div>

            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button type="submit" style="flex: 1; background: #16a34a; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: 500;">Сохранить</button>
                <button type="button" onclick="closeDrawer()" style="flex: 1; background: #e2e8f0; color: #334151; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Отмена</button>
            </div>
        </form>
    `;

    openDrawer();

    try {
        const skladParam = window.currentSkladId ? `&sklad_id=${window.currentSkladId}` : '';
        let fetchUrl = `/api/expenses_by_receipts?postavhik_id=${postavhikId}${skladParam}`;

              if (!isPayAll) {
            const [year, month] = monthStr.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
            fetchUrl += `&end_date=${endDate}`;
        }

        const resp = await fetch(fetchUrl);
        const listEl = document.getElementById('pay-receipts-list');
        if (!listEl) return;

        if (!resp.ok) {
            listEl.innerHTML = '<span style="color:#dc2626;">Не удалось загрузить список накладных</span>';
            return;
        }

        const receipts = await resp.json();
        const unpaid = (Array.isArray(receipts) ? receipts : []).filter(r => Number(r.debt_sum || 0) > 0);

        if (unpaid.length === 0) {
            listEl.innerHTML = isPayAll
                ? '<span>Неоплаченных накладных у этого поставщика не найдено.</span>'
                : '<span>Неоплаченных накладных за этот месяц не найдено.</span>';
            return;
        }
        window._payUnpaidReceipts = unpaid;
        window._paySelectedReceiptIds = [];

        listEl.innerHTML = `
            <label style="display: block; font-size: 13px; color: #475569; margin-bottom: 6px; font-weight: 500;">
                Накладные (необязательно): найдите и выберите конкретные для оплаты.
                Если ничего не выбрано — сумма распределится по всем от старых к новым, как раньше.
            </label>
            <div id="pay-receipts-search-block" style="position: relative;">
                <input type="text" id="pay-receipt-search-input" placeholder=" Начните ввод для поиска накладной..." autocomplete="off"
                    style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; color: #0f172a;">
                <div id="pay-receipt-search-dropdown" style="display: none; position: absolute; z-index: 20; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 6px 6px; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.08);"></div>
                <div id="pay-receipt-selected-list" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;"></div>
            </div>
        `;

        const searchInput = document.getElementById('pay-receipt-search-input');
        const dropdown = document.getElementById('pay-receipt-search-dropdown');
        const selectedListEl = document.getElementById('pay-receipt-selected-list');

        function renderSelectedChips() {
    selectedListEl.innerHTML = window._paySelectedReceiptIds.map(rid => {
        const r = window._payUnpaidReceipts.find(x => String(x.receipt_id || x.id) === String(rid));
        if (!r) return '';
        return `<span style="display: inline-flex; align-items: center; gap: 6px; background: #eff6ff; color: #1d4ed8; border-radius: 4px; padding: 4px 8px; font-size: 12px;">
            № ${r.doc_number || r.id} (долг ${Number(r.debt_sum || 0).toFixed(2)})
            <span data-remove-id="${rid}" style="cursor: pointer; font-weight: bold;">&times;</span>
        </span>`;
    }).join('');

    selectedListEl.querySelectorAll('[data-remove-id]').forEach(el => {
        el.addEventListener('click', () => {
            const rid = el.getAttribute('data-remove-id');
            window._paySelectedReceiptIds = window._paySelectedReceiptIds.filter(x => String(x) !== String(rid));
            renderSelectedChips();
        });
    });
    const amountInput = document.getElementById('payment-amount');
    if (amountInput) {
        if (window._paySelectedReceiptIds.length > 0) {
            const sum = window._paySelectedReceiptIds.reduce((acc, rid) => {
                const r = window._payUnpaidReceipts.find(x => String(x.receipt_id || x.id) === String(rid));
                return acc + (r ? Number(r.debt_sum || 0) : 0);
            }, 0);
            amountInput.value = sum.toFixed(2);
        } else {
            amountInput.value = debtSum;
        }
    }
    }
        function renderDropdown(filterText) {
            const filter = (filterText || '').toLowerCase().trim();
            const available = window._payUnpaidReceipts.filter(r => {
                const rid = String(r.receipt_id || r.id);
                if (window._paySelectedReceiptIds.includes(rid)) return false;
                const label = `${r.doc_number || r.id}`.toLowerCase();
                return !filter || label.includes(filter);
            });

            if (available.length === 0) {
                dropdown.innerHTML = `<div style="padding: 8px; color: #94a3b8; font-size: 12px;">Ничего не найдено</div>`;
            } else {
                dropdown.innerHTML = available.map(r => `
                    <div class="pay-receipt-option" data-id="${r.receipt_id || r.id}" style="padding: 8px; cursor: pointer; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9;">
                        № ${r.doc_number || r.id} от ${r.date ? new Date(r.date).toLocaleDateString() : '—'} — долг: <b>${Number(r.debt_sum || 0).toFixed(2)}</b>
                    </div>
                `).join('');

                dropdown.querySelectorAll('.pay-receipt-option').forEach(opt => {
                    opt.addEventListener('click', () => {
                        const rid = opt.getAttribute('data-id');
                        if (!window._paySelectedReceiptIds.includes(rid)) {
                            window._paySelectedReceiptIds.push(rid);
                        }
                        searchInput.value = '';
                        dropdown.style.display = 'none';
                        renderSelectedChips();
                    });
                });
            }

            dropdown.style.display = 'block';
        }

        searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
        searchInput.addEventListener('input', () => renderDropdown(searchInput.value));
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#pay-receipts-search-block')) {
                dropdown.style.display = 'none';
            }
        });
    } catch (err) {
        console.error('Ошибка загрузки списка накладных для оплаты:', err);
        const listEl = document.getElementById('pay-receipts-list');
        if (listEl) listEl.innerHTML = '<span style="color:#dc2626;">Ошибка загрузки списка накладных</span>';
    }
}




async function submitPayment(event, postavhikId, monthStr) {
    event.preventDefault();
    if (window._payBusy) return;
    window._payBusy = true;
    setTimeout(() => { window._payBusy = false; }, 3000);
    const receiptIds = Array.isArray(window._paySelectedReceiptIds) ? window._paySelectedReceiptIds : [];

    const payload = {
        amount: parseFloat(document.getElementById('payment-amount').value),
        comment: document.getElementById('payment-comment').value,
        month_str: monthStr,
        sklad_id: window.currentSkladId || null,
        receipt_ids: receiptIds.length > 0 ? receiptIds : null
    };

    try {
        let response = await fetch(`/api/expenses_by_suppliers/${postavhikId}/pay_month`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

                               if (response.ok) {
            const result = await response.json().catch(() => ({}));
            closeDrawer();
            if (result.warning) {
                showAppNotification(result.warning, 'warning');
            } else {
                showAppNotification(monthStr ? 'Оплата за месяц успешно сохранена' : 'Оплата долга успешно сохранена', 'success');
            }
            if (typeof loadTableData === 'function') loadTableData();
            if (typeof loadExpenseMainData === 'function' && window._currentExpenseView) {
                loadExpenseMainData(window._currentExpenseView, window._currentExpenseParentId);
            }
        } else {
            const errData = await response.json().catch(() => ({}));
            showAppNotification(errData.error || 'Ошибка при сохранении платежа', 'error');
        }
    } catch (err) {
        console.error('Ошибка сети:', err);
        showAppNotification('Не удалось отправить данные на сервер', 'error');
    }
}

async function loadExpenseDetailTable(fetchUrl) {
  const detailToolbarEl = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
    if (detailToolbarEl) detailToolbarEl.style.display = 'none';
  
    const detailBody = document.getElementById('detail-body');
    const detailTitle = document.getElementById('detail-title');
    const detailHeaderTr = document.getElementById('detail-headers') || document.querySelector('#detail-container thead tr');
    
    const config = getConfig('expense_items');
    if (detailTitle && config) detailTitle.innerText = config.title;

    const visibleColumns = config && config.columns ? config.columns.filter(col => col.table !== false) : [];
    const colCount = visibleColumns.length > 0 ? visibleColumns.length : 5;

    const existingFilterRow = document.getElementById('detail-filter-row');
    if (existingFilterRow) existingFilterRow.remove();

    const existingAlternativeRow = document.getElementById('detail-table-filter-row');
    if (existingAlternativeRow) existingAlternativeRow.remove();

    if (detailHeaderTr && visibleColumns.length > 0) {
        detailHeaderTr.innerHTML = visibleColumns.map(col => {
            let widthStyle = col.width ? `width: ${col.width};` : '';
            let alignStyle = col.align ? `text-align: ${col.align};` : 'text-align: left;';
            return `<th style="padding: 6px; border-bottom: 2px solid #ddd; ${widthStyle} ${alignStyle}">${col.label}</th>`;
        }).join('');
    }

    if (detailBody) detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Загрузка запчастей...</td></tr>`;

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Ошибка загрузки позиций (Статус: ${response.status})`);
        
        const items = await response.json();

        if (!detailBody) return;

        if (!items || items.length === 0) {
            detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет запчастей в этой накладной</td></tr>`;
            return;
        }

        detailBody.innerHTML = '';
        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            if (config && typeof config.render === 'function') {
                tr.innerHTML = config.render(item);
            }
            detailBody.appendChild(tr);
        });

    } catch (err) {
        if (detailBody) {
            detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки спецификации: ${err.message}</td></tr>`;
        }
    }
}


async function loadExpenseMainData(entity = 'expenses_by_sklad', parentId = '') {
    let currentExpenseView = entity;
    resetSharedUiForEntity(entity);
    pagerSuspend();

    window._currentExpenseView = entity;
    window._currentExpenseParentId = parentId;

    const EXPENSE_VIEWS = ['expenses_by_sklad', 'expenses_by_suppliers_totals', 'expenses_by_suppliers', 'expenses_by_receipts', 'expense_items'];
    if (EXPENSE_VIEWS.includes(currentExpenseView)) {
        currentEntity = currentExpenseView;
    }

    let fetchUrl = '';

    const detailContainer = document.getElementById('detail-container');
    const mainTableBody = document.getElementById('table-body');
    const mainHeaderTr = document.getElementById('table-headers');

    const btnAdd = document.getElementById('btn-add');
    const btnEdit = document.getElementById('btn-edit');
    const btnDelete = document.getElementById('btn-delete');
    
    let backBtn = document.getElementById('btn-back-expense') || document.getElementById('btn-back');
    if (!backBtn) {
    }

    if (currentExpenseView === 'expenses_by_sklad' || currentExpenseView === 'expenses') {
        currentExpenseView = 'expenses_by_sklad';
        window.currentSkladId = null;
        window.currentPostavhikId = null;
        window.currentReceiptId = null;

        fetchUrl = `/api/expenses_by_sklad`;

        if (detailContainer) detailContainer.style.display = 'none';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        const backBtnElement = document.getElementById('btn-back-expense');
        if (backBtnElement) backBtnElement.style.display = 'none';
    } 
        else if (currentExpenseView === 'expenses_by_suppliers_totals') {
        let skladId = parentId && typeof parentId === 'object' ? (parentId.sklad_id || parentId.warehouse_id || parentId.id) : parentId;
        if (skladId) window.currentSkladId = skladId;
        window.currentPostavhikId = null;
        window.currentReceiptId = null;

        fetchUrl = `/api/expenses_by_suppliers_totals${window.currentSkladId ? '?sklad_id=' + window.currentSkladId : ''}`;

        if (detailContainer) detailContainer.style.display = 'none';
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        const backBtnElement = document.getElementById('btn-back-expense');
        if (backBtnElement) {
            backBtnElement.style.display = 'inline-block';
            backBtnElement.onclick = () => loadExpenseMainData('expenses_by_sklad');
        }
    }
    else if (currentExpenseView === 'expenses_by_suppliers') {
        let postavhikId = parentId && typeof parentId === 'object' ? (parentId.postavhik_id || parentId.id) : parentId;
        if (postavhikId) window.currentPostavhikId = postavhikId;
        window.currentReceiptId = null;

        let currentPostavhik = window.currentPostavhikId || '';

        fetchUrl = `/api/expenses_by_suppliers?postavhik_id=${currentPostavhik}${window.currentSkladId ? '&sklad_id=' + window.currentSkladId : ''}`;

        if (detailContainer) detailContainer.style.display = 'none';
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        const backBtnElement = document.getElementById('btn-back-expense');
        if (backBtnElement) {
            backBtnElement.style.display = 'inline-block';
            backBtnElement.onclick = () => loadExpenseMainData('expenses_by_suppliers_totals', window.currentSkladId);
        }
    } 
        else if (currentExpenseView === 'expenses_by_receipts') {
        let postavhikId = parentId && typeof parentId === 'object' ? (parentId.postavhik_id || parentId.id) : parentId;
        if (postavhikId) window.currentPostavhikId = postavhikId;
        window.currentReceiptId = null;
        window.currentExpenseMonthStr = (parentId && typeof parentId === 'object' && parentId.month_str) ? parentId.month_str : null;

        let skladId = window.currentSkladId || '';
        let currentPostavhik = window.currentPostavhikId || '';

        fetchUrl = `/api/expenses_by_receipts?postavhik_id=${currentPostavhik}${skladId ? '&sklad_id=' + skladId : ''}`;
        
        if (parentId && typeof parentId === 'object' && parentId.month_str) {
            const [year, month] = parentId.month_str.split('-').map(Number);
            const startDate = `${parentId.month_str}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endDate = `${parentId.month_str}-${String(lastDay).padStart(2, '0')}`;
            fetchUrl += `&start_date=${startDate}&end_date=${endDate}`;
        }

        if (detailContainer) detailContainer.style.display = 'none';
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        const backBtnElement = document.getElementById('btn-back-expense');
        if (backBtnElement) {
            backBtnElement.style.display = 'inline-block';
            backBtnElement.onclick = () => loadExpenseMainData('expenses_by_suppliers', window.currentPostavhikId);
        }
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

        if (detailContainer) detailContainer.style.display = 'flex';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        const backBtnElement = document.getElementById('btn-back-expense');
        if (backBtnElement) {
            backBtnElement.style.display = 'inline-block';
            backBtnElement.onclick = () => loadExpenseMainData('expenses_by_receipts', window.currentPostavhikId);
        }

        loadExpenseDetailTable(fetchUrl);
        return; 
    }

       if (EXPENSE_VIEWS.includes(currentExpenseView)) {
        currentEntity = currentExpenseView;
    }

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

        window.applyExpenseTableFilter = function() {
            const inputs = filterRow.querySelectorAll('input[data-column-index]');
            const tbody = document.getElementById('table-body');
            const groupHeaders = tbody.querySelectorAll('tr[id^="group-header-"]');
            
            if (groupHeaders.length > 0) {
                groupHeaders.forEach((headerTr, gIndex) => {
                    const childRows = tbody.querySelectorAll(`.group-row-${gIndex}`);
                    let visibleChildrenCount = 0;

                    childRows.forEach(row => {
                        let showRow = true;
                        inputs.forEach(input => {
                            const colIdx = parseInt(input.getAttribute('data-column-index'), 10);
                            const filterVal = input.value.toLowerCase().trim();
                            if (!filterVal) return;

                            const cell = row.children[colIdx];
                            if (cell) {
                                const cellText = cell.textContent.toLowerCase();
                                if (!cellText.includes(filterVal)) {
                                    showRow = false;
                                }
                            }
                        });

                        row.style.display = showRow ? '' : 'none';
                        if (showRow) visibleChildrenCount++;
                    });

                    headerTr.style.display = visibleChildrenCount > 0 ? '' : 'none';
                });
            } else {
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    let showRow = true;
                    inputs.forEach(input => {
                        const colIdx = parseInt(input.getAttribute('data-column-index'), 10);
                        const filterVal = input.value.toLowerCase().trim();
                        if (!filterVal) return;

                        const cell = row.children[colIdx];
                        if (cell) {
                            const cellText = cell.textContent.toLowerCase();
                            if (!cellText.includes(filterVal)) {
                                showRow = false;
                            }
                        }
                    });
                    row.style.display = showRow ? '' : 'none';
                });
            }
        };

        filterRow.innerHTML = visibleColumns.map((col, idx) => {
            let styleAttr = col.style ? `style="${col.style} padding: 4px;"` : (col.width ? `style="width: ${col.width}; padding: 4px;"` : 'style="padding: 4px;"');
            if (col.style && col.style.includes('display: none')) {
                return `<th style="display: none; padding: 4px;"></th>`;
            }
            return `
                <th ${styleAttr}>
                    <input type="text" 
                           data-column-index="${idx}" 
                           data-column="${col.field}" 
                           oninput="applyExpenseTableFilter()" 
                           placeholder="Фильтр..."
                           style="width: 100%; padding: 4px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                </th>
            `;
        }).join('');
    }

    try {
        const response = await fetch(fetchUrl, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store'
});

        if (!response.ok) throw new Error(`Ошибка загрузки (Статус: ${response.status})`);

        currentItems = await response.json();

        if (!mainTableBody) {
            return;
        }

        if (!currentItems || currentItems.length === 0) {
            mainTableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>`;
            return;
        }

        mainTableBody.innerHTML = '';

       if (currentEntity === 'expenses_by_receipts') {
    currentItems.forEach((item) => {
        const tr = document.createElement('tr');
        const rowId = item.id || item.receipt_id || '';
        tr.dataset.id = rowId;
        tr.style.cursor = 'pointer';

        if (config && typeof config.render === 'function') {
            tr.innerHTML = config.render(item);
        }

        mainTableBody.appendChild(tr);
    });

} else if (currentEntity === 'expenses_by_suppliers') {
                       let totalSum = 0, totalPaid = 0, totalDebt = 0;
            currentItems.forEach(item => {
totalSum += Number(item.total_expense_sum || 0);
                totalPaid += Number(item.total_paid || 0);
                totalDebt += Number(item.total_debt || 0);
            });

            const summaryTr = document.createElement('tr');
            summaryTr.style.background = '#f1f5f9';
            summaryTr.style.fontWeight = 'bold';
            summaryTr.innerHTML = `
                <td colspan="${colCount}" style="padding: 10px; border-top: 2px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                    Итого &nbsp;|&nbsp; 
                    Сумма закупок: <span style="color:#0f172a;">${totalSum.toFixed(2)}</span> &nbsp;|&nbsp;                 
                    Оплачено: <span style="color:#16a34a;">${totalPaid.toFixed(2)}</span> &nbsp;|&nbsp; 
                    Долг: <span style="color:#dc2626;">${totalDebt.toFixed(2)}</span>
                </td>
            `;
            mainTableBody.appendChild(summaryTr);

            currentItems.forEach(item => {
                const tr = document.createElement('tr');
                const rowId = item.id || item.receipt_id || '';
                tr.dataset.id = rowId;
                tr.style.cursor = 'pointer';

                if (config && typeof config.render === 'function') {
                    tr.innerHTML = config.render(item);
                }

                mainTableBody.appendChild(tr);
            });

               } else {
            currentItems.forEach((item, index) => {
                const tr = document.createElement('tr');
                const rowId = item.id || item.receipt_id || item.sklad_id || item.postavhik_id || '';

                tr.dataset.id = rowId;
                tr.style.cursor = 'pointer';
                
                if (config && typeof config.render === 'function') {
                    tr.innerHTML = config.render(item);
                }

                mainTableBody.appendChild(tr);
            });
        }

    } catch (err) {
        if (mainTableBody) {
            mainTableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки данных: ${err.message}</td></tr>`;
        }
    }
}




async function openIncomePaymentHistory(docId, docNumber, skladId = '') {
    if (skladId === true || skladId === 'true' || skladId === 'undefined' || skladId === 'null') {
        skladId = window.currentSkladId || '';
    }
    const docType = window.currentDocType || 'realization';    
    const drawer = getOrCreateDrawer();
    
    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">История поступлений: ${docNumber}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>
        <div style="text-align: center; color: #666; padding: 20px;">Загрузка истории...</div>
    `;
    openDrawer();

    try {
        const endpointPrefix = docType === 'move' ? 'moves' : 'realizations';
        const targetUrl = `/api/${endpointPrefix}/${docId}/payments?sklad_id=${skladId}`;

        let response = await fetch(targetUrl);
        if (!response.ok) throw new Error('Не удалось загрузить историю');
        
        let payments = await response.json();

        if (!payments || payments.length === 0) {
            drawer.querySelector('div:last-child').innerHTML = 'По этому документу еще не было поступлений.';
            return;
        }

        let rowsHtml = payments.map(p => {
            const pDate = p.date ? new Date(p.date).toLocaleDateString() : '—';
            const pAmount = Number(p.amount || 0).toFixed(2);
            const pComment = p.comment || '—';
            return `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; color: #4b5563;">${pDate}</td>
                    <td style="padding: 10px; font-weight: bold; color: #16a34a; text-align: right;">${pAmount} </td>
                    <td style="padding: 10px; color: #6b7280; font-size: 13px;">${pComment}</td>
                </tr>
            `;
        }).join('');

        drawer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 16px; color: #333;">История поступлений: ${docNumber}</h3>
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
        drawer.querySelector('div:last-child').innerHTML = '<span style="color: #dc2626;">Ошибка при загрузке истории поступлений</span>';
    }
}

function openIncomePaymentDrawer(docId, debtSum, docNumber, skladId = '') {
    if (skladId === true || skladId === 'true' || skladId === 'undefined' || skladId === 'null') {
        skladId = window.currentSkladId || '';
    }
    const docType = window.currentDocType || 'realization';    
    const drawer = getOrCreateDrawer();
    
    drawer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">Оплата документа ${docNumber}</h3>
            <button onclick="closeDrawer()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #888;">&times;</button>
        </div>

        <form id="pay-form" onsubmit="submitIncomePayment(event, '${docId}', '${skladId}')" style="display: flex; flex-direction: column; gap: 16px;">
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


async function submitIncomePayment(event, docId, skladId) {
    event.preventDefault();
        if (window._payBusy) return;
    window._payBusy = true;
    setTimeout(() => { window._payBusy = false; }, 3000);
    if (skladId === true || skladId === 'true' || skladId === 'undefined' || skladId === 'null') {
        skladId = window.currentSkladId || '';
    }
    
    const parsedAmount = parseFloat(document.getElementById('payment-amount').value);
    const commentVal = document.getElementById('payment-comment').value;
    const currentDocType = window.currentDocType || 'realization';

    const payload = {
        amount: parsedAmount,
        comment: commentVal,
        sklad_id: skladId || window.currentSkladId || null,
        doc_type: currentDocType
    };

    const endpointPrefix = currentDocType === 'move' ? 'moves' : 'realizations';
    const targetUrl = `/api/${endpointPrefix}/${docId}/pay`;

    try {
        let response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            let resData = await response.json().catch(() => ({}));
            closeDrawer();
            showAppNotification('Платёж успешно сохранен', 'success');
            
            if (typeof loadTableData === 'function') {
                loadTableData();
            }
        } else {
            const errData = await response.json().catch(() => ({}));
            showAppNotification(errData.error || 'Ошибка при сохранении платежа', 'error');
        }
    } catch (err) {
        showAppNotification('Не удалось отправить данные на сервер', 'error');
    }
}

async function loadReceiptMainData(entity = 'money_receipts_by_sklad', parentId = '') {
    resetSharedUiForEntity(entity);
    pagerSuspend();

    let fetchUrl = '';
    let currentReceiptView = entity;

    const detailContainer = document.getElementById('detail-container');
    const mainTableBody = document.getElementById('table-body');
    const mainHeaderTr = document.getElementById('table-headers');

    const btnAdd = document.getElementById('btn-add');
    const btnEdit = document.getElementById('btn-edit');
    const btnDelete = document.getElementById('btn-delete');

    const btnBackExpense = document.getElementById('btn-back-expense');

    if (currentReceiptView === 'money_receipts_by_sklad') {
        window.currentSkladId = null;
        window.currentCustomerId = null;
        window.currentGroupKey = null;
        window.currentRealizationId = null;
        window.currentRepairId = null;

        fetchUrl = `/api/money_receipts_by_sklad`;
        if (detailContainer) detailContainer.style.display = 'none';
        
        
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        if (btnBackExpense) {
            btnBackExpense.style.display = 'none';
            btnBackExpense.onclick = null;
        }
        }
    else if (currentReceiptView === 'money_receipts_by_customers_totals') {
        let skladId = '';
        if (parentId && typeof parentId === 'object') {
            skladId = parentId.sklad_id || parentId.warehouse_id || parentId.id;
        } else if (parentId) {
            skladId = parentId;
        } else {
            skladId = window.currentSkladId;
        }
        if (skladId) window.currentSkladId = skladId;

        window.currentGroupKey = null;
        window.currentCustomerId = null;
        window.currentRealizationId = null;
        window.currentRepairId = null;

        fetchUrl = `/api/money_receipts_by_customers_totals` + (skladId ? `?sklad_id=${skladId}` : '');

        if (detailContainer) detailContainer.style.display = 'none';
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        if (btnBackExpense) {
            btnBackExpense.style.display = 'inline-block';
            btnBackExpense.onclick = () => {
                loadReceiptMainData('money_receipts_by_sklad', '');
            };
        }
    }
    else if (currentReceiptView === 'money_receipts_by_customers') {
        let groupKey = '';
        if (parentId && typeof parentId === 'object') {
            groupKey = parentId.group_key || '';
        }
        if (groupKey) window.currentGroupKey = groupKey;
        const skladId = window.currentSkladId;

        window.currentCustomerId = null;
        window.currentRealizationId = null;
        window.currentRepairId = null;

        fetchUrl = `/api/money_receipts_by_customers?group_key=${window.currentGroupKey || ''}` + (skladId ? `&sklad_id=${skladId}` : '');

        if (detailContainer) detailContainer.style.display = 'none';
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        if (btnBackExpense) {
            btnBackExpense.style.display = 'inline-block';
            btnBackExpense.onclick = () => {
                loadReceiptMainData('money_receipts_by_customers_totals', window.currentSkladId);
            };
        }
    }
    else if (currentReceiptView === 'money_receipts') {
        let skladId = '';
        let customerId = '';
        let debtorWarehouseId = '';
        let explicitStart = '';
        let explicitEnd = '';

        if (parentId && typeof parentId === 'object') {
            skladId = parentId.sklad_id || parentId.warehouse_id || parentId.id;
            customerId = parentId.customer_id || '';
            debtorWarehouseId = parentId.debtor_warehouse_id || '';
            explicitStart = parentId.start_date || '';
            explicitEnd = parentId.end_date || '';
        } else if (parentId) {
            skladId = parentId;
        } else {
            skladId = window.currentSkladId;
        }

        if (skladId) {
            window.currentSkladId = skladId;
        }

                window.currentCustomerId = customerId || null;
        window.currentDebtorWarehouseId = debtorWarehouseId || null;
        window.currentReceiptsStartDate = explicitStart || null;
        window.currentReceiptsEndDate = explicitEnd || null;
        window.currentRealizationId = null;
        window.currentRepairId = null;

        const detailBodyReset = document.getElementById('detail-body');
        if (detailBodyReset) {
            detailBodyReset.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#888; padding:20px;">Выберите документ в верхней таблице</td></tr>`;
        }
        const detailHeadersReset = document.getElementById('detail-headers');
        if (detailHeadersReset) detailHeadersReset.innerHTML = '';

       

        let queryParams = [];
        if (window.currentSkladId) {
            queryParams.push(`sklad_id=${window.currentSkladId}`);
        }
        if (customerId) {
            queryParams.push(`customer_id=${customerId}`);
        }
        if (debtorWarehouseId) {
            queryParams.push(`debtor_warehouse_id=${debtorWarehouseId}`);
        }
        
                if (explicitStart) queryParams.push(`start_date=${explicitStart}`);
        if (explicitEnd) queryParams.push(`end_date=${explicitEnd}`);

        fetchUrl = `/api/money_receipts` + (queryParams.length > 0 ? `?${queryParams.join('&')}` : '');
        
        if (detailContainer) detailContainer.style.display = 'block';

        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';

        if (btnBackExpense) {
            btnBackExpense.style.display = 'inline-block';
            btnBackExpense.onclick = () => {
                if (window.currentGroupKey) {
                    loadReceiptMainData('money_receipts_by_customers', { group_key: window.currentGroupKey });
                } else if (window.currentSkladId) {
                    loadReceiptMainData('money_receipts_by_customers_totals', window.currentSkladId);
                } else {
                    loadReceiptMainData('money_receipts_by_sklad', '');
                }
            };
        }
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

        window.applyReceiptTableFilter = function() {
            const inputs = filterRow.querySelectorAll('input[data-column-index]');
            const tbody = document.getElementById('table-body');
            const groupHeaders = tbody.querySelectorAll('tr[id^="group-header-"], tr[style*="background: #f8fafc"]');
            
            if (currentReceiptView === 'money_receipts') {
                let rows = tbody.querySelectorAll('tr');
            }

            const activeInputs = Array.from(inputs).map(input => ({
                index: parseInt(input.getAttribute('data-column-index'), 10),
                value: input.value.toLowerCase().trim()
            })).filter(i => i.value !== '');

            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                if (row.style.background && (row.style.background.includes('e2e8f0') || row.style.background.includes('f8fafc'))) {
                    return; 
                }

                let showRow = true;
                activeInputs.forEach(filter => {
                    const cell = row.children[filter.index];
                    if (cell) {
                        const cellText = cell.textContent.toLowerCase();
                        if (!cellText.includes(filter.value)) {
                            showRow = false;
                        }
                    }
                });
                row.style.display = showRow ? '' : 'none';
            });
        };

        filterRow.innerHTML = visibleColumns.map((col, idx) => {
            let styleAttr = col.style ? `style="${col.style} padding: 4px;"` : (col.width ? `style="width: ${col.width}; padding: 4px;"` : 'style="padding: 4px;"');
            if (col.style && col.style.includes('display: none')) {
                return `<th style="display: none; padding: 4px;"></th>`;
            }
            return `
                <th ${styleAttr}>
                    <input type="text" 
                           data-column-index="${idx}" 
                           data-column="${col.field}" 
                           oninput="applyReceiptTableFilter()" 
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
            throw new Error(`Ошибка загрузки (Статус: ${response.status})`);
        }

        let parsedData;
        try {
            parsedData = JSON.parse(responseText);
        } catch (e) {
            throw new Error('Ответ сервера не является валидным JSON');
        }

        let currentItems = [];
        let saldoData = null;

        if (Array.isArray(parsedData)) {
            currentItems = parsedData;
        } else if (parsedData && typeof parsedData === 'object') {
            currentItems = Array.isArray(parsedData.rows) ? parsedData.rows : [];
            saldoData = parsedData.saldo || null;
        }

        window.currentItems = currentItems;

        if (!mainTableBody) return;

        let saldoHeaderHtml = '';
        if (currentReceiptView === 'money_receipts' && saldoData) {
            const sStart = Number(saldoData.saldo_start || 0);
            const sEnd = Number(saldoData.saldo_end || 0);
            const diff = sEnd - sStart;
            const diffFormatted = Math.abs(diff).toFixed(2);
            const isPlus = diff >= 0;

            const sStartStr = sStart.toFixed(2);
            const turnover = Number(saldoData.turnover_period || 0).toFixed(2);
            const sEndStr = sEnd.toFixed(2);

            saldoHeaderHtml = `
                <tr style="background: #e2e8f0; font-weight: bold; border-bottom: 2px solid #cbd5e1;">
                    <td colspan="${colCount}" style="padding: 10px 12px; font-size: 14px;">
                        <span style="color: #334155; margin-right: 20px;">Сальдо на начало: <b style="color: #0f172a;">${sStartStr}</b></span>
                        <span style="color: #334155; margin-right: 20px;">Сальдо на конец: <b style="color: #0f172a;">${sEndStr}</b></span>
                        <span style="color: #334155; margin-right: 20px;">Обороты за период: <b style="color: #0284c7;">${turnover}</b></span>
                        <span style="color: #334155;">Значит в плюсе на: <b style="color: ${isPlus ? '#16a34a' : '#dc2626'};">${isPlus ? '+' : '-'}${diffFormatted}</b></span>
                    </td>
                </tr>
            `;
        }

        if (currentItems.length === 0) {
            mainTableBody.innerHTML = saldoHeaderHtml + `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>`;
            return;
        }

        mainTableBody.innerHTML = saldoHeaderHtml;

        if (currentReceiptView === 'money_receipts_by_customers') {
            const monthNames = [
                "января", "февраля", "марта", "апреля", "мая", "июня",
                "июля", "августа", "сентября", "октября", "ноября", "декабря"
            ];

            const groups = {};
            currentItems.forEach((item) => {
                const key = item.month_str || 'unknown';
                const [yearStr, monthStr] = key.split('-');
                const title = monthNames[parseInt(monthStr, 10) - 1] ? `${monthNames[parseInt(monthStr, 10) - 1]} ${yearStr} года` : key;

                                if (!groups[key]) {
                    groups[key] = { title, items: [], totalSum: 0, totalPaid: 0, totalDebt: 0, totalPartsProfit: 0, totalWorksProfit: 0, totalNetProfit: 0 };
                }
                groups[key].items.push(item);
                groups[key].totalSum += Number(item.total_sum || 0);
                groups[key].totalPaid += Number(item.total_paid || 0);
                groups[key].totalDebt += Number(item.total_debt || 0);
                groups[key].totalPartsProfit += Number(item.total_parts_profit || 0);
                groups[key].totalWorksProfit += Number(item.total_works_sum || 0);
                groups[key].totalNetProfit += (Number(item.total_parts_profit || 0) + Number(item.total_works_sum || 0));
            });

            let groupIndex = 0;
            Object.keys(groups).sort().reverse().forEach(key => {
                const group = groups[key];
                const currentGIdx = groupIndex++;

                const headerTr = document.createElement('tr');
                headerTr.id = `receipt-group-header-${currentGIdx}`;
                headerTr.style.background = '#f1f5f9';
                headerTr.style.cursor = 'pointer';
                headerTr.style.fontWeight = 'bold';
                headerTr.innerHTML = `
                    <td colspan="${colCount}" style="padding: 10px; border-top: 2px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
                        <span id="receipt-icon-${currentGIdx}" style="display:inline-block; width:20px; color:#2563eb;">[-]</span>
                        ${group.title} &nbsp;|&nbsp;
                                              Итого за месяц: <span style="color:#0f172a;">${group.totalSum.toFixed(2)}</span> &nbsp;|&nbsp;
                        Оплачено: <span style="color:#16a34a;">${group.totalPaid.toFixed(2)}</span> &nbsp;|&nbsp;
                        Долг: <span style="color:#dc2626;">${group.totalDebt.toFixed(2)}</span>
                    </td>
                `;
                mainTableBody.appendChild(headerTr);

                const childRows = [];
                group.items.forEach((item) => {
                    const tr = document.createElement('tr');
                    tr.dataset.id = item.group_key || '';
                    tr.style.cursor = 'pointer';
                    if (config && typeof config.render === 'function') {
                        tr.innerHTML = config.render(item);
                    }
                                        tr.addEventListener('click', (e) => {
                        if (e.target.closest('button, [onclick]')) {
                            return;
                        }

                        document.querySelectorAll('#table-body tr').forEach(r => r.classList.remove('selected-row'));
                        tr.classList.add('selected-row');
                        selectedItem = item;
                        if (currentEntity === 'money_receipts_by_customers') {
                            let payload = { sklad_id: window.currentSkladId };
                            if (item.customer_id) payload.customer_id = item.customer_id;
                            if (item.debtor_warehouse_id) payload.debtor_warehouse_id = item.debtor_warehouse_id;
                            if (item.month_str) {
                                const [year, month] = item.month_str.split('-').map(Number);
                                payload.start_date = `${item.month_str}-01`;
                                const lastDay = new Date(year, month, 0).getDate();
                                payload.end_date = `${item.month_str}-${String(lastDay).padStart(2, '0')}`;
                            }
                            loadReceiptMainData('money_receipts', payload);
                        }
                    });
                    mainTableBody.appendChild(tr);
                    childRows.push(tr);
                });

                               const footerTr = document.createElement('tr');
                footerTr.style.background = '#f8fafc';
                footerTr.style.fontWeight = 'bold';
                footerTr.style.borderTop = '1px solid #e2e8f0';
                footerTr.style.borderBottom = '2px solid #cbd5e1';
                                footerTr.innerHTML = `
                    <td colspan="${colCount}" style="padding: 10px 16px;">
                        <div style="display: flex; justify-content: flex-start; align-items: center; flex-wrap: wrap; gap: 24px; font-size: 13px;">
                                                       <span style="color: #475569;">Плюс запчасти: <b style="color: #0f172a; font-weight: 600;">${group.totalPartsProfit.toFixed(2)}</b></span>                    
                            <span style="color: #475569;">Услуги: <b style="color: #0f172a; font-weight: 600;">${group.totalWorksProfit.toFixed(2)}</b></span>
                            <span style="color: #475569;">Общий плюс: <b style="color: ${group.totalNetProfit >= 0 ? '#16a34a' : '#dc2626'}; font-weight: 600;">${group.totalNetProfit.toFixed(2)}</b></span>
                        </div>
                    </td>
                `;
                mainTableBody.appendChild(footerTr);
                childRows.push(footerTr);

                headerTr.addEventListener('click', () => {
                    const icon = document.getElementById(`receipt-icon-${currentGIdx}`);
                    const isHidden = childRows[0].style.display === 'none';
                    childRows.forEach(tr => { tr.style.display = isHidden ? '' : 'none'; });
                    icon.innerText = isHidden ? '[-]' : '[+]';
                });
            });

        } else if (currentReceiptView === 'money_receipts') {
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
            currentItems.forEach((item) => {
                const m = getMonthData(item.date);
                if (!groupedByMonth[m.key]) {
                    groupedByMonth[m.key] = {
                        title: m.title,
                        items: [],
                        totalSum: 0,
                        totalPaid: 0,
                        totalDebt: 0,
                        totalPartsProfit: 0, 
                        totalWorksSum: 0,    
                        totalNetProfit: 0    
                    };
                }
                groupedByMonth[m.key].items.push(item);
                
                let realizationSum = Number(item.total_realization_sum || item.total_sum || item.sum || 0);
                let paidSum = Number(item.total_paid || item.paid || 0);
                let debtSum = Number(item.debt_sum || item.total_debt || item.debt || 0);
                
                let itemPartsProfit = Number(item.parts_profit || 0);
                let itemWorksSum = Number(item.works_sum || item.work_sum || item.services_sum || 0);
                let itemNetProfit = Number(item.net_profit || (itemPartsProfit + itemWorksSum));

                groupedByMonth[m.key].totalSum += realizationSum;
                groupedByMonth[m.key].totalPaid += paidSum;
                groupedByMonth[m.key].totalDebt += debtSum;
                
                groupedByMonth[m.key].totalPartsProfit += itemPartsProfit;
                groupedByMonth[m.key].totalWorksSum += itemWorksSum;
                groupedByMonth[m.key].totalNetProfit += itemNetProfit;
            });

            const sortedMonthKeys = Object.keys(groupedByMonth).sort().reverse();

            let firstDocRow = null;

            sortedMonthKeys.forEach(monthKey => {
                const group = groupedByMonth[monthKey];

                const headerTr = document.createElement('tr');
                headerTr.style.background = '#f8fafc';
                headerTr.style.fontWeight = 'bold';
                headerTr.style.borderTop = '2px solid #e2e8f0';
                headerTr.style.borderBottom = '1px solid #e2e8f0';

                headerTr.innerHTML = `
                    <td colspan="${colCount}" style="padding: 12px 16px; cursor: pointer;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: #e2e8f0; border-radius: 4px; font-size: 12px; color: #475569;" class="collapse-icon">[-]</span>
                                <span style="color: #1e293b; font-size: 15px; font-weight: 600;">${group.title}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 24px; font-size: 13px;">
                                <span style="color: #64748b;">Сумма: <b style="color: #0f172a; font-weight: 600;">${group.totalSum.toFixed(2)}</b></span>
                                <span style="color: #64748b;">Оплачено: <b style="color: #16a34a; font-weight: 600;">${group.totalPaid.toFixed(2)}</b></span>
                                <span style="color: #64748b;">Долг: <b style="color: #dc2626; font-weight: 600;">${group.totalDebt.toFixed(2)}</b></span>
                            </div>
                        </div>
                    </td>
                `;
                
                let isCollapsed = false;
                const rowElements = [];

                mainTableBody.appendChild(headerTr);

                group.items.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.dataset.id = item.id || item.sklad_id || item.realization_id || '';
                    tr.style.cursor = 'pointer';
                    tr.innerHTML = config.render(item);

                    if (!firstDocRow) {
                        firstDocRow = tr;
                    }

                    tr.addEventListener('click', () => {
                        document.querySelectorAll('#table-body tr').forEach(r => r.classList.remove('selected-row'));
                        tr.classList.add('selected-row');

                        selectedItem = item;
                        window.currentRealizationId = item.realization_id || item.id;
                        window.currentRepairId = null;
                        window.currentCustomerId = item.customer_id || '';
                        
                        window.currentDocType = item.doc_type || (item.realization_id ? 'realization' : (item.move_id ? 'move' : 'realization'));

                        const detailToolbar = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
                        if (detailToolbar) {
                            detailToolbar.style.display = 'none';
                        }
                        
                        let detailEntity = typeof getCurrentDetailEntity === 'function' ? getCurrentDetailEntity() : 'money_receipts_detail';
                        
                        let realizationId = window.currentRealizationId || '';
                        let customerId = window.currentCustomerId || '';
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

                const footerTr = document.createElement('tr');
                footerTr.style.background = '#f8fafc';
                footerTr.style.fontWeight = 'bold';
                footerTr.style.borderTop = '1px solid #e2e8f0';
                footerTr.style.borderBottom = '2px solid #cbd5e1';

                               footerTr.innerHTML = `
                    <td colspan="${colCount}" style="padding: 10px 16px;">
                        <div style="display: flex; justify-content: flex-start; align-items: center; flex-wrap: wrap; gap: 24px; font-size: 13px;">
                                                      <span style="color: #475569;">Плюс запчасти: <b style="color: #0f172a; font-weight: 600;">${group.totalPartsProfit.toFixed(2)}</b></span>
                            <span style="color: #475569;">Услуги: <b style="color: #0f172a; font-weight: 600;">${group.totalWorksSum.toFixed(2)}</b></span>
                            <span style="color: #475569;">Общий плюс: <b style="color: ${group.totalNetProfit >= 0 ? '#16a34a' : '#dc2626'}; font-weight: 600;">${group.totalNetProfit.toFixed(2)}</b></span>
                        </div>
                    </td>
                `;
                mainTableBody.appendChild(footerTr);
                rowElements.push(footerTr);

                headerTr.addEventListener('click', () => {
                    isCollapsed = !isCollapsed;
                    rowElements.forEach(r => r.style.display = isCollapsed ? 'none' : '');
                    const collapseIcon = headerTr.querySelector('.collapse-icon');
                    if (collapseIcon) {
                        collapseIcon.textContent = isCollapsed ? '[+]' : '[-]';
                    }
                });
            });

           
            if (firstDocRow) {
                firstDocRow.click();
            }

        } else {
            currentItems.forEach(item => {
                const tr = document.createElement('tr');
                tr.dataset.id = item.id || item.sklad_id || item.realization_id || '';
                tr.style.cursor = 'pointer';
                tr.innerHTML = config.render(item);

                tr.addEventListener('click', () => {
                    document.querySelectorAll('#table-body tr').forEach(r => r.classList.remove('selected-row'));
                    tr.classList.add('selected-row');

                selectedItem = item;
                   if (currentEntity === 'money_receipts_by_sklad') {
                        loadReceiptMainData('money_receipts_by_customers_totals', item);
                    } else if (currentEntity === 'money_receipts_by_customers_totals') {
                        loadReceiptMainData('money_receipts_by_customers', item);
                    } else if (currentEntity === 'money_receipts_by_customers') {
                        let payload = { sklad_id: window.currentSkladId };
                        if (item.customer_id) payload.customer_id = item.customer_id;
                        if (item.debtor_warehouse_id) payload.debtor_warehouse_id = item.debtor_warehouse_id;
                        if (item.month_str) {
                            const [year, month] = item.month_str.split('-').map(Number);
                            payload.start_date = `${item.month_str}-01`;
                            const lastDay = new Date(year, month, 0).getDate();
                            payload.end_date = `${item.month_str}-${String(lastDay).padStart(2, '0')}`;
                        }
                        loadReceiptMainData('money_receipts', payload);
                    }
                });

                mainTableBody.appendChild(tr);
            });
        }

    } catch (err) {
        if (mainTableBody) {
            mainTableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки данных</td></tr>`;
        }
    }
}





let currentDetailController = null;

async function loadReceiptDetailTable(fetchUrl, subTabName = 'money_receipts_detail') {
    if (currentDetailController) {
        currentDetailController.abort();
    }
    currentDetailController = new AbortController();
    
    if (window.currentDocType && !fetchUrl.includes('doc_type=')) {
        const separator = fetchUrl.includes('?') ? '&' : '?';
        fetchUrl = `${fetchUrl}${separator}doc_type=${window.currentDocType}`;
    }
    
       const detailToolbarEl = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
    if (detailToolbarEl) detailToolbarEl.style.display = 'none';

    const existingFilterRow = document.getElementById('detail-filter-row');
    if (existingFilterRow) existingFilterRow.remove();

    const existingAlternativeRow = document.getElementById('detail-table-filter-row');
    if (existingAlternativeRow) existingAlternativeRow.remove();

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
        const response = await fetch(fetchUrl, { signal: currentDetailController.signal });
        const responseText = await response.text();

        if (!response.ok) throw new Error('Ошибка загрузки данных');
        const data = JSON.parse(responseText);

        const items = Array.isArray(data) ? data : (data.items || []);

        if (!detailBody) return;
        if (items.length === 0) {
            detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Нет запчастей и услуг в выбранном документе</td></tr>`;
            return;
        }

        detailBody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            
            if (item.item_type === 'work' || item.is_work) {
                tr.style.backgroundColor = '#f8fafc';
            }
            
            tr.innerHTML = config.render(item);
            detailBody.appendChild(tr);
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            return;
        }
        if (detailBody) {
            detailBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки спецификации</td></tr>`;
        }
    }
}


const tableBodyForReceipts = document.getElementById('table-body');
if (tableBodyForReceipts) {
    if (!tableBodyForReceipts.dataset.listenerAttached) {
        tableBodyForReceipts.dataset.listenerAttached = "true";

        tableBodyForReceipts.addEventListener('click', async (e) => {
            
           const allowedEntities = [
    'money_receipts_by_sklad', 
    'expenses_by_sklad', 
    'expenses_by_suppliers', 
    'expenses_by_receipts','expenses_by_suppliers_totals'
];

            let activeEntity = typeof currentEntity !== 'undefined' ? currentEntity : window.currentEntity;
            
            if (!allowedEntities.includes(activeEntity)) {
                return;
            }

          const tr = e.target.closest('tr');
if (!tr) return;

if (tr.querySelector('[id^="icon-"]') || tr.style.background === 'rgb(241, 245, 249)' || tr.style.background === '#f1f5f9') {
    return;
}

if (e.target.closest('button, [onclick]')) {
    return;
}

            let id = tr.getAttribute('data-id');
            
            if (!id || id === 'null' || id === 'undefined') {
                const targetWithId = tr.querySelector('[data-id]');
                if (targetWithId) {
                    id = targetWithId.dataset.id;
                }
            }

            if (!id || id === 'null' || id === 'undefined') {
                const hiddenInput = tr.querySelector('input[type="hidden"]');
                if (hiddenInput && hiddenInput.value) {
                    id = hiddenInput.value;
                } else {
                    const firstCell = tr.querySelector('td');
                    if (firstCell && !firstCell.querySelector('input')) {
                        const textVal = firstCell.innerText.trim();
                        if (/^\d+$/.test(textVal)) {
                            id = textVal;
                        }
                    }
                }
            }

            document.querySelectorAll('#table-body tr').forEach(row => {
                if (!row.querySelector('[id^="icon-"]')) {
                    row.classList.remove('selected-row');
                    row.style.background = '';
                }
            });
            tr.classList.add('selected-row');

            let itemsSource = typeof currentItems !== 'undefined' ? currentItems : window.currentItems;
            let selectedItem = null;

            if (itemsSource) {
                const listArray = Array.isArray(itemsSource) ? itemsSource : (itemsSource.items || []);
                selectedItem = listArray.find(i => 
                    String(i.id || '') === String(id) || 
                    String(i.realization_id || '') === String(id) || 
                    String(i.sklad_id || '') === String(id) || 
                    String(i.receipt_id || '') === String(id) || 
                    String(i.postavhik_id || '') === String(id)
                );
            }

            if (!selectedItem && id) {
                selectedItem = {
                    id: id,
                    realization_id: id,
                    receipt_id: id,
                    customer_id: window.currentCustomerId || null,
                    sklad_id: window.currentSkladId || null,
                    postavhik_id: window.currentPostavhikId || null
                };
            }
            
            if (typeof window !== 'undefined') {
                window.selectedItem = selectedItem;
                window.selectedDetailItem = null;
            }

            if (!selectedItem) {
                return;
            }

        
                                         if (activeEntity === 'money_receipts_by_sklad') {
                if (typeof loadReceiptMainData === 'function') {
                    loadReceiptMainData('money_receipts_by_customers_totals', selectedItem);
                }
            } else if (activeEntity === 'money_receipts_by_customers_totals') {
                if (typeof loadReceiptMainData === 'function') {
                    loadReceiptMainData('money_receipts_by_customers', selectedItem);
                }
            } else if (activeEntity === 'money_receipts_by_customers') {
                let payload = { sklad_id: window.currentSkladId };
                if (selectedItem.customer_id) payload.customer_id = selectedItem.customer_id;
                if (selectedItem.debtor_warehouse_id) payload.debtor_warehouse_id = selectedItem.debtor_warehouse_id;
                if (selectedItem.month_str) {
                    const [year, month] = selectedItem.month_str.split('-').map(Number);
                    payload.start_date = `${selectedItem.month_str}-01`;
                    const lastDay = new Date(year, month, 0).getDate();
                    payload.end_date = `${selectedItem.month_str}-${String(lastDay).padStart(2, '0')}`;
                }
                loadReceiptMainData('money_receipts', payload);
            } else if (activeEntity === 'money_receipts') {
                window.currentRealizationId = selectedItem.realization_id || selectedItem.id;
                window.currentRepairId = null;
                
                if (selectedItem.customer_id !== undefined) {
                    window.currentCustomerId = selectedItem.customer_id;
                }
                
                const docNumFromItem = String(selectedItem.doc_number || '');
                const rowText = String(tr.innerText || '');

                if (docNumFromItem.includes('ПЕРЕМЕЩЕНИЕ') || rowText.includes('ПЕРЕМЕЩЕНИЕ')) {
                    window.currentDocType = 'move';
                } else {
                    window.currentDocType = 'realization';
                }
                                
                const detailContainer = document.getElementById('detail-container');
                if (detailContainer) detailContainer.style.display = 'block';
                 const detailToolbarEl = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
                if (detailToolbarEl) detailToolbarEl.style.display = 'none';
                const activeTab = window.currentMoneyReceiptSubTab || 'money_receipts_detail';
                
                const detailUrl = `/api/money_receipts_detail?realization_id=${window.currentRealizationId}&customer_id=${window.currentCustomerId || ''}&sklad_id=${window.currentSkladId || ''}`;
                
                if (typeof loadReceiptDetailTable === 'function') {
                    loadReceiptDetailTable(detailUrl, activeTab);
                }
            }

            else if (
    activeEntity === 'expenses_by_sklad' || 
    activeEntity === 'expenses_by_suppliers_totals' || 
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
                    if (typeof loadExpenseMainData === 'function') loadExpenseMainData('expenses_by_suppliers_totals', selectedItem);
                } else if (activeEntity === 'expenses_by_suppliers_totals') {
                    if (typeof loadExpenseMainData === 'function') loadExpenseMainData('expenses_by_suppliers', selectedItem);
                } else if (activeEntity === 'expenses_by_suppliers') {
                    if (typeof loadExpenseMainData === 'function') {
                        let payload = { ...selectedItem };
                        
                        if (selectedItem.month_str) {
                            const [year, month] = selectedItem.month_str.split('-').map(Number);
                            payload.start_date = `${selectedItem.month_str}-01`;
                            const lastDay = new Date(year, month, 0).getDate();
                            payload.end_date = `${selectedItem.month_str}-${String(lastDay).padStart(2, '0')}`;
                        }
                        
                        loadExpenseMainData('expenses_by_receipts', payload);
                    }
                } else if (activeEntity === 'expenses_by_receipts') {
                    let receiptId = selectedItem.receipt_id || selectedItem.id || id;
                    if (receiptId) window.currentReceiptId = receiptId;

                    let skladId = window.currentSkladId || '';
                    let postavhikId = window.currentPostavhikId || '';
                    let currentReceipt = window.currentReceiptId || '';

                    const fetchUrl = `/api/expense_items?receipt_id=${currentReceipt}&postavhik_id=${postavhikId}&sklad_id=${skladId}`;
                    const detailContainer = document.getElementById('detail-container');
                    if (detailContainer) detailContainer.style.display = 'flex';

                    if (typeof loadExpenseDetailTable === 'function') {
                        loadExpenseDetailTable(fetchUrl);
                    }
                }
            }
        });
    }
}


function emptyDetailBody(entity) {
    const detailBody = document.getElementById('detail-body');
    if (!detailBody) return;

    const config = getConfig(entity);
    
    
    const visibleColumnsCount = config.columns 
        ? config.columns.filter(col => col.table !== false).length 
        : 1; 

    detailBody.innerHTML = `<tr><td colspan="${visibleColumnsCount}" style="text-align: center; color: #888; padding: 20px;">Нет данных для отображения</td></tr>`;
}
function filterTable() {
    const filterInputs = document.querySelectorAll('#table-filter-row input[data-column]');

    if (PAGER.reload) {   
        const serverFilters = {};
        filterInputs.forEach(input => {
            const v = input.value.trim();
            if (v) serverFilters[input.getAttribute('data-column')] = v;
        });
        PAGER.filters = serverFilters;
        PAGER.page = 1;
        pagerScheduleReload(350);
        return;
    }

    const filters = {};

    filterInputs.forEach(input => {
        const field = input.getAttribute('data-column');
        const val = input.value.trim().toLowerCase();
        if (val) {
            filters[field] = val;
        }
    });

    const rows = document.querySelectorAll('#table-body tr');

    rows.forEach((row, index) => {
        let isVisible = true;
        const item = currentItems[index]; 

        if (!item) return;

        const cells = Array.from(row.children);
        const config = getConfig(currentEntity);

        for (const field in filters) {
            let match = false;
            
            const itemValue = item[field];
            if (itemValue !== undefined && itemValue !== null) {
                if (String(itemValue).toLowerCase().includes(filters[field])) {
                    match = true;
                }
            }

            if (!match) {
                const colIndex = config.columns.findIndex(c => c.field === field);
                if (colIndex !== -1 && cells[colIndex]) {
                    if (cells[colIndex].textContent.toLowerCase().includes(filters[field])) {
                        match = true;
                    }
                }
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
    if (currentEntity === 'moves') {
        const res = 'move_items';
        return res;
    }
    if (currentEntity === 'returns') {
        const res = 'return_items';
        return res;
    }
    if (currentEntity === 'receipts') {
        const res = 'receipt_items';
        return res;
    }
    if (currentEntity === 'expenses' || currentEntity === 'expense_items') {
        const res = 'expense_items';
        return res;
    }

    if (currentEntity === 'expenses_by_sklad') {
        const res = ''; 
        return res;
    }
    if (currentEntity === 'expenses_by_suppliers') {
        const res = ''; 
        return res;
    }
    if (currentEntity === 'expenses_by_receipts') {
        const res = 'expense_items'; 
        return res;
    }

    if (currentEntity === 'cars') {
        const res = 'car_details';
        return res;
    }
    if (currentEntity === 'stock_balances') {
        const res = 'stock_batches'; 
        return res;
    }
    if (currentEntity === 'stock_movement') {
        const res = 'part_movement_details'; 
        return res;
    }
    if (currentEntity === 'postavhik') {
        const res = 'postavhik_contacts'; 
        return res;
    }
    if (currentEntity === 'counterparties') {
        const res = 'counterparty_contacts'; 
        return res;
    }
    if (currentEntity === 'money_receipts_by_sklad') {
        const res = ''; 
        return res;
    }

    if (currentEntity === 'money_receipts') {
        return 'money_receipts_detail';
    }

    if (currentEntity === 'realizations') {
        const activeTab = document.querySelector('#tabs-for-realizations button.active, #tabs-for-realizations .active');
        if (activeTab) {
            const dataTab = activeTab.getAttribute('data-tab');
            if (dataTab) {
                return dataTab;
            }
        }

        if (typeof currentRealizationSubTab !== 'undefined' && currentRealizationSubTab) {
            return currentRealizationSubTab;
        }

        if (activeTab) {
            const text = activeTab.innerText.trim().toLowerCase();
            if (text.includes('услуг') || text.includes('работ')) {
                return 'realization_works';
            }
            if (text.includes('запчаст')) {
                return 'realization_items';
            }

            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/(?:loadDetailData|switchRealizationTab)\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }

        const activeText = document.querySelector('#tabs-for-realizations button.active')?.innerText || '';
        if (activeText.toLowerCase().includes('услуг') || activeText.toLowerCase().includes('работ')) {
            return 'realization_works';
        }

        return 'realization_items'; 
    }

    if (currentEntity === 'customers') {
        const activeTab = document.querySelector('#tabs-for-customers button.active, #tabs-for-customers .active');
        if (activeTab) {
            const dataTab = activeTab.getAttribute('data-tab');
            if (dataTab) {
                return dataTab;
            }
        }

        if (typeof currentCustomerSubTab !== 'undefined' && currentCustomerSubTab) {
            return currentCustomerSubTab;
        }

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
            if (dataTab) {
                return dataTab;
            }
        }

        if (typeof currentAccidentSubTab !== 'undefined' && currentAccidentSubTab) {
            return currentAccidentSubTab;
        }

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
            if (dataTab) {
                return dataTab;
            }
        }

        if (typeof currentRepairSubTab !== 'undefined' && currentRepairSubTab) {
            return currentRepairSubTab;
        }

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
            if (dataTab) {
                return dataTab;
            }
        }

        if (typeof currentCarSubTab !== 'undefined' && currentCarSubTab) {
            return currentCarSubTab;
        }

        if (activeTab) {
            const onclickAttr = activeTab.getAttribute('onclick') || '';
            const match = onclickAttr.match(/loadDetailData\(['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
        }
        return 'car_details';
    }
    
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

    const detailEntity = getCurrentDetailEntity();

    const readOnlyDetailEntities = ['car_general', 'repair_history', 'receipts_history', 'dtp_history', 'car_accidents', 'car_images'];
        if (readOnlyDetailEntities.includes(detailEntity)) {
        return;
    }

    if (detailEntity === 'accident_images') {
        const detailTitleText = document.getElementById('detail-title')?.innerText || '';
        const isCarContext = detailTitleText.includes('Автомобиль') || window.currentMainEntity === 'car_details';
        
        if (isCarContext) {
            showAppNotification('Фотографии ДТП из карточки автомобиля доступны только для просмотра. Редактирование доступно из карточки самого ДТП.', 'warning');
            return;
        }
    }

    const itemToEdit = mode === 'edit' ? selectedDetailItem : null;

    let parentId = selectedItem.id;
    const currentActiveEntity = typeof activeEntity !== 'undefined' ? activeEntity : window.currentMainEntity;

    if (currentActiveEntity === 'money_receipts' && typeof currentRealizationId !== 'undefined' && currentRealizationId) {
        parentId = currentRealizationId;
    }

      if (detailEntity === 'car_details') {
    openCarDetailsForm(detailEntity, itemToEdit, parentId);
    } else if (
    detailEntity === 'accident_images' ||
    detailEntity === 'accident_invoices' ||
    detailEntity === 'accident_payments' ||
    detailEntity === 'accident_events'
    ) {
    openAccidentForm(detailEntity, itemToEdit, parentId);
    } else if (detailEntity === 'receipt_items') {
        openReceiptItemsForm(itemToEdit, parentId);
    }  else if (detailEntity === 'return_items') {
        openReturnItemsForm(itemToEdit, parentId);
    } else if (detailEntity === 'move_items') {
        openMoveItemsForm(itemToEdit, parentId);
   } else if (detailEntity === 'repair_items') {
    openRepairItemsForm(itemToEdit, parentId);
    } else if (detailEntity === 'repair_works') {
    openRepairWorksForm(itemToEdit, parentId);
    } else if (detailEntity === 'realization_items') {
    openRealizationItemsForm(itemToEdit, parentId);
    } else if (detailEntity === 'realization_works') {
    openRealizationWorksForm(itemToEdit, parentId);
    } else {
        openEntityForm(detailEntity, itemToEdit, parentId);
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
                const response = await fetch(`/api/receipts/${receiptId}/post`, {   
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

async function postReturn(returnId) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести этот документ возврата?',
        async () => {
            try {
                const response = await fetch(`/api/returns/${returnId}/post`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ is_posted: true })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Ошибка при проведении документа');
                }

                showAppNotification('Документ возврата успешно проведён', 'success');
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification(err.message || 'Не удалось провести документ', 'error');
            }
        }
    );
}
async function postRepair(repairId) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести этот документ ремонта?',
        async () => {
            try {
                const response = await fetch(`/api/repairs/${repairId}/post`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ is_posted: true })
                });

                if (!response.ok) throw new Error('Ошибка при проведении документа');

                showAppNotification('Документ ремонта успешно проведен', 'success');
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification('Не удалось провести документ', 'error');
            }
        }
    );
}


async function postRealization(realizationId) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести этот документ реализации?',
        async () => {
            try {
                const response = await fetch(`/api/realizations/${realizationId}/post`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ is_posted: true })
                });

                if (!response.ok) throw new Error('Ошибка при проведении документа');

                showAppNotification('Документ реализации успешно проведен', 'success');
                refreshData();
            } catch (err) {
                console.error(err);
                showAppNotification('Не удалось провести документ', 'error');
            }
        }
    );
}
async function postAccident(accidentId) {
    showPostConfirmModal(
        'Проведение документа',
        'Вы действительно хотите провести этот документ ДТП?',
        async () => {
            try {
                const response = await fetch(`/api/accidents/${accidentId}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ is_posted: true })
                });

                if (!response.ok) throw new Error('Ошибка при проведении документа');

                showAppNotification('Документ ДТП успешно проведен', 'success');
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
        const isInsideDetail = e.target.closest('#detail-container') || 
                               e.target.closest('#car-tabs-panel') || 
                               e.target.closest('#car-tabs-bar');
        if (isInsideDetail) {
            return;
        }

        if (
            currentEntity === 'expenses_by_sklad' || 
            currentEntity === 'expenses_by_suppliers' || 
            currentEntity === 'expenses_by_receipts'
        ) {
            return;
        }

        const tr = e.target.closest('tr');
        if (!tr) {
            return;
        }

        const entitiesWithDetails = [
            'receipts', 
            'moves', 
            'returns',
            'cars', 
            'car_cards', 
            'accidents', 
            'repairs', 
            'realizations', 
            'stock_movement', 
            'postavhik', 
            'counterparties', 
            'customers',
            'expenses_by_receipts'
        ];

        const summaryEntitiesWithoutDetails = [
            'repair_types',
            'money_receipts_by_sklad',
            'expenses_by_sklad',
            'expenses_by_suppliers',
            'stock_balances',
            'расходы',
            'expenses',
            'parts',
            'nomenclature',
            'goods',
            'money_receipts'
        ];

        const shouldLoadDetails = entitiesWithDetails.includes(currentEntity) && !summaryEntitiesWithoutDetails.includes(currentEntity);

        if (!shouldLoadDetails) {
            document.querySelectorAll('#table-body tr').forEach(row => row.style.background = '');
            tr.style.background = '#e2e8f0';
            return;
        }
        
        document.querySelectorAll('#table-body tr').forEach(row => row.style.background = '');
        tr.style.background = '#e2e8f0';

        const id = tr.getAttribute('data-id');
        
        selectedItem = currentItems.find(i => String(i.id || i.receipt_id || i.sklad_id || i.postavhik_id || i.move_id) === String(id));

        if (!selectedItem) {
            return;
        }
        
        selectedDetailItem = null;  

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

                if (detailContainer) detailContainer.style.display = 'flex';

                if (currentEntity === 'receipts') {
    loadDetailData('receipt_items', itemId);
    } else if (currentEntity === 'moves') {
    loadDetailData('move_items', itemId);
    } else if (currentEntity === 'returns') {
    const detailToolbarTarget = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
    if (detailToolbarTarget) detailToolbarTarget.style.display = 'none';
    renderReturnItemsInline(selectedItem);
    } else if (currentEntity === 'postavhik') {
                    loadDetailData('postavhik_contacts', itemId);
                              } else if (currentEntity === 'counterparties') {
                    loadDetailData('counterparty_contacts', itemId);
                } else if (currentEntity === 'customers') {
                    const activeSubTab = getCurrentDetailEntity();
                    currentCustomerSubTab = activeSubTab;
                    loadDetailData(activeSubTab, itemId);
                }
            }

            setTimeout(() => {
                const detailActionButtons = document.getElementById('detail-action-buttons') || document.querySelector('.detail-action-buttons');
                if (detailActionButtons) {
                    detailActionButtons.style.display = 'flex';
                }
            }, 50);
        }
    });
}




const tableBodyForDblClick = document.getElementById('table-body');
if (tableBodyForDblClick) {
    tableBodyForDblClick.addEventListener('dblclick', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) {
            return;
        }

        if (tr.querySelector('td[colspan]')) {
            return;
        }

        const isInsideDetail = e.target.closest('#detail-container') || 
                               e.target.closest('#car-tabs-panel') || 
                               e.target.closest('#car-tabs-bar');
        
        if (isInsideDetail) {
            return; 
        }

        if (typeof activeEntity !== 'undefined' && activeEntity && activeEntity !== currentEntity) {
            return;
        }

        const targetEntity = (typeof activeEntity !== 'undefined' && activeEntity && e.target.closest('#detail-table')) ? activeEntity : currentEntity;

        if (
            targetEntity === 'stock_remains' || 
            targetEntity === 'stock' || 
            targetEntity === 'stock_movement' ||
            targetEntity === 'stock_balances' ||
            targetEntity === 'stock_batches' ||
            targetEntity === 'part_movement_details' ||
            targetEntity === 'car_cards' ||
            targetEntity === 'car_general' ||
            targetEntity === 'car_accidents' ||
            targetEntity === 'dtp_history' ||
            targetEntity === 'receipts_history' ||
            targetEntity === 'repair_history' ||
            targetEntity === 'money_receipts' ||
            targetEntity === 'money_receipts_by_sklad' ||
            targetEntity === 'money_receipts_detail' ||
            targetEntity === 'expenses_by_sklad' || 
            targetEntity === 'expenses_by_suppliers' || 
            targetEntity === 'expenses_by_receipts'
        ) {
            return; 
        }

        const id = tr.getAttribute('data-id');

        const item = currentItems.find(i => String(i.id || i.receipt_id || i.sklad_id || i.postavhik_id || i.move_id) === String(id));
        
        if (item) {
            if (item.is_posted !== undefined) {
                item.is_posted = (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1 || item.is_posted === '1');
            }

            selectedItem = item;

            if (currentEntity === 'realizations') {
                openRealizationForm(currentEntity, item);
            } else if (currentEntity === 'repairs') {
                openRepairForm(currentEntity, item); 
            } else if (currentEntity === 'accidents') {
    openAccidentForm('accidents', item);
            } else if (currentEntity === 'returns' && typeof openReturnForm === 'function') {
      openReturnForm(currentEntity, item);
        }
            else if (currentEntity === 'receipts') {
                openReceiptForm(currentEntity, item);
            } else if (currentEntity === 'moves') {
                openMoveForm(currentEntity, item);
            } else {
                openEntityForm(currentEntity, item);
            }
        }
    });
}

if (tableBody) {
    tableBody.addEventListener('contextmenu', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;

        const isInsideDetail = e.target.closest('#detail-container') || 
                               e.target.closest('#car-tabs-panel') || 
                               e.target.closest('#car-tabs-bar');
        if (isInsideDetail) {
            return; // карточка авто и все её переключатели/детальные таблицы
        }

        const excludedEntities = [
            'expenses_by_sklad',       // касса расходов
            'expenses_by_suppliers', 
            'expenses_by_receipts',
            'money_receipts',          // касса приходов
            'money_receipts_by_sklad',
            'money_receipts_detail',
            'stock_remains',           // остатки запчастей (верх+низ)
            'stock',
            'stock_balances',
            'stock_batches',
            'stock_movement',          // движение запчастей
            'part_movement_details',
            'car_cards',                // карточка авто
            'car_general',
            'car_accidents',
            'dtp_history',
            'receipts_history',
            'repair_history'
        ];

        const targetEntity = (typeof activeEntity !== 'undefined' && activeEntity && e.target.closest('#detail-table')) ? activeEntity : currentEntity;
        if (excludedEntities.includes(targetEntity)) {
            return;
        }

        e.preventDefault();

        const id = tr.getAttribute('data-id');
        const item = currentItems.find(i => String(i.id || i.receipt_id || i.sklad_id || i.postavhik_id || i.move_id) === String(id));
        if (!item) return;

        if (item.is_posted !== undefined) {
            item.is_posted = (item.is_posted === true || item.is_posted === 'true' || item.is_posted === 1 || item.is_posted === '1');
        }
        selectedItem = item;

        document.querySelectorAll('#table-body tr').forEach(r => r.classList.remove('selected-row'));
        tr.classList.add('selected-row');

        showRowContextMenu(e.pageX, e.pageY);
    });
}

function showRowContextMenu(x, y, onEdit, onDelete) {
    const old = document.getElementById('row-context-menu');
    if (old) old.remove();

    const editHandler = typeof onEdit === 'function' ? onEdit : editSelectedEntity;
    const deleteHandler = typeof onDelete === 'function' ? onDelete : deleteSelectedEntity;

    const menu = document.createElement('div');
    menu.id = 'row-context-menu';
    menu.style.cssText = `
        position: absolute; top: ${y}px; left: ${x}px; z-index: 9999;
        background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.12); overflow: hidden; min-width: 160px;
        font-size: 13px; padding: 4px;
    `;
    menu.innerHTML = `
        <div id="ctx-edit" class="ctx-item" style="display:flex; align-items:center; gap:10px; padding: 8px 12px; cursor: pointer; border-radius: 5px; color: #0f172a;">
            <i class="fas fa-pen-to-square" style="color: #0055ea; width: 14px;"></i> Изменить
        </div>
        <div id="ctx-delete" class="ctx-item" style="display:flex; align-items:center; gap:10px; padding: 8px 12px; cursor: pointer; border-radius: 5px; color: #0f172a;">
            <i class="fas fa-trash-can" style="color: #dc2626; width: 14px;"></i> Удалить
        </div>
    `;
    document.body.appendChild(menu);

    menu.querySelectorAll('.ctx-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.style.background = '#f1f5f9');
        el.addEventListener('mouseleave', () => el.style.background = 'transparent');
    });

    menu.querySelector('#ctx-edit').addEventListener('click', () => {
        menu.remove();
        editHandler();
    });
    menu.querySelector('#ctx-delete').addEventListener('click', () => {
        menu.remove();
        deleteHandler();
    });

    const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}
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

    const detailToolbar = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
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

    const detailToolbar = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
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

    const detailToolbar = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
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

    const detailToolbar = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
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

    const detailToolbar = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
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

    // НОВОЕ: контекстное меню (правая кнопка мыши) для строк спецификации —
    // работает только для receipt_items, move_items, repair_items, repair_works,
    // realization_items, realization_works
    detailBody.addEventListener('contextmenu', (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;

        const detailEntity = getCurrentDetailEntity();
        const allowedDetailEntities = [
            'receipt_items',
            'move_items',
            'repair_items',
            'repair_works',
            'realization_items',
            'realization_works'
        ];
        if (!allowedDetailEntities.includes(detailEntity)) {
            return;
        }

        e.preventDefault();

        const id = tr.getAttribute('data-id');
        const item = currentDetailItems.find(i => i.id == id);
        if (!item) return;

        selectedDetailItem = item;

        document.querySelectorAll('#detail-body tr').forEach(row => row.style.background = '');
        tr.style.background = '#e2e8f0';

        showRowContextMenu(e.pageX, e.pageY, () => openDetailForm('edit'), deleteDetailItem);
    });
}

const DETAIL_PAGED = { receipt_items: 'receipt_id' };
const DETAIL_PAGED_TITLES = { receipt_items: 'Спецификация прихода' };
const DETAIL_PAGE = { entity: null, parentId: null, page: 1, limit: 100, total: 0, filters: {}, timer: null, seq: 0 };

function removeDetailPager() {
    clearTimeout(DETAIL_PAGE.timer);
    DETAIL_PAGE.entity = null;
    DETAIL_PAGE.seq++;
    const bar = document.getElementById('detail-pager');
    if (bar) bar.remove();
}

function detailPagerGo(page) {
    if (!DETAIL_PAGE.entity) return;
    const pages = Math.max(1, Math.ceil(DETAIL_PAGE.total / DETAIL_PAGE.limit));
    const target = Math.min(Math.max(1, parseInt(page, 10) || 1), pages);
    if (target === DETAIL_PAGE.page) return;
    DETAIL_PAGE.page = target;
    loadDetailPage(DETAIL_PAGE.entity, DETAIL_PAGE.parentId);
}

function ensureDetailPager() {
    let bar = document.getElementById('detail-pager');
    if (bar) return bar;
    const tbody = document.getElementById('detail-body');
    if (!tbody) return null;
    const table = tbody.closest('table');
    const host = document.getElementById('detail-container') || (table ? table.parentElement : null);
    if (!host) return null;

    const btn = 'padding:2px 9px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;';
    bar = document.createElement('div');
    bar.id = 'detail-pager';
    bar.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;padding:4px 8px;font-size:13px;background:#f7f7f7;border-top:1px solid #ddd;box-sizing:border-box;position:sticky;bottom:0;z-index:2;';
    bar.innerHTML = `
        <span id="dp-info" style="color:#555;margin-right:auto;white-space:nowrap;"></span>
        <button type="button" id="dp-first" title="В начало" style="${btn}">«</button>
        <button type="button" id="dp-prev" title="Назад" style="${btn}">‹</button>
        <span>стр. <input id="dp-page" type="number" min="1" value="1" style="width:56px;padding:2px 4px;border:1px solid #ccc;border-radius:4px;font-size:13px;"> из <span id="dp-pages">1</span></span>
        <button type="button" id="dp-next" title="Вперёд" style="${btn}">›</button>
        <button type="button" id="dp-last" title="В конец" style="${btn}">»</button>
        <select id="dp-limit" title="Строк на странице" style="padding:2px 4px;border:1px solid #ccc;border-radius:4px;font-size:13px;">
            <option value="50">50</option><option value="100">100</option>
            <option value="200">200</option><option value="500">500</option>
        </select>`;
    host.appendChild(bar);

    bar.querySelector('#dp-first').onclick = () => detailPagerGo(1);
    bar.querySelector('#dp-prev').onclick = () => detailPagerGo(DETAIL_PAGE.page - 1);
    bar.querySelector('#dp-next').onclick = () => detailPagerGo(DETAIL_PAGE.page + 1);
    bar.querySelector('#dp-last').onclick = () => detailPagerGo(Math.ceil(DETAIL_PAGE.total / DETAIL_PAGE.limit));
    const pageInput = bar.querySelector('#dp-page');
    pageInput.addEventListener('change', () => detailPagerGo(pageInput.value));
    pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') detailPagerGo(pageInput.value); });
    bar.querySelector('#dp-limit').addEventListener('change', (e) => {
        DETAIL_PAGE.limit = parseInt(e.target.value, 10) || 100;
        DETAIL_PAGE.page = 1;
        loadDetailPage(DETAIL_PAGE.entity, DETAIL_PAGE.parentId);
    });
    return bar;
}

function renderDetailPager() {
    const bar = ensureDetailPager();
    if (!bar) return;
    const pages = Math.max(1, Math.ceil(DETAIL_PAGE.total / DETAIL_PAGE.limit));
    const from = DETAIL_PAGE.total ? (DETAIL_PAGE.page - 1) * DETAIL_PAGE.limit + 1 : 0;
    const to = Math.min(DETAIL_PAGE.total, DETAIL_PAGE.page * DETAIL_PAGE.limit);

    bar.style.display = pages > 1 ? 'flex' : 'none';
    bar.querySelector('#dp-info').textContent = DETAIL_PAGE.total ? `${from}–${to} из ${DETAIL_PAGE.total}` : 'Ничего не найдено';
    bar.querySelector('#dp-pages').textContent = String(pages);
    const pageInput = bar.querySelector('#dp-page');
    if (document.activeElement !== pageInput) pageInput.value = String(DETAIL_PAGE.page);
    pageInput.max = String(pages);
    bar.querySelector('#dp-limit').value = String(DETAIL_PAGE.limit);

    const atStart = DETAIL_PAGE.page <= 1;
    const atEnd = DETAIL_PAGE.page >= pages;
    bar.querySelector('#dp-first').disabled = atStart;
    bar.querySelector('#dp-prev').disabled = atStart;
    bar.querySelector('#dp-next').disabled = atEnd;
    bar.querySelector('#dp-last').disabled = atEnd;
}

async function loadDetailPage(entity, parentId, token, showLoader) {
    const config = getConfig(entity);
    const tbody = document.getElementById('detail-body');
    if (!tbody || !Object.prototype.hasOwnProperty.call(DETAIL_PAGED, entity)) return;

    const myToken = (token === undefined) ? detailLoadToken : token;
    const mySeq = ++DETAIL_PAGE.seq;
    const stale = () => myToken !== detailLoadToken || mySeq !== DETAIL_PAGE.seq;

    const visibleColumns = config && config.columns ? config.columns.filter(col => col.table !== false) : [];
    const colCount = visibleColumns.length > 0 ? visibleColumns.length : 1;

    if (showLoader) {
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">Загрузка...</td></tr>`;
    } else {
        tbody.style.opacity = '0.5';
    }

    try {
        const params = new URLSearchParams();
        params.set(DETAIL_PAGED[entity], parentId);
        params.set('page', String(DETAIL_PAGE.page));
        params.set('limit', String(DETAIL_PAGE.limit));
        if (Object.keys(DETAIL_PAGE.filters).length) params.set('filters', JSON.stringify(DETAIL_PAGE.filters));

        const response = await fetch(`/api/${entity}?${params.toString()}`);
        if (stale()) return;
        if (!response.ok) throw new Error(`Ошибка загрузки деталей (Статус: ${response.status})`);
        const items = await response.json();
        if (stale()) return;

        const total = parseInt(response.headers.get('X-Total-Count'), 10);
        const page = parseInt(response.headers.get('X-Page'), 10);
        DETAIL_PAGE.total = Number.isFinite(total) ? total : items.length;
        if (Number.isFinite(page)) DETAIL_PAGE.page = page;

        currentDetailItems = items;
        selectedDetailItem = null;

        const titleElement = document.getElementById('detail-title');
        if (titleElement) {
            const prettyName = DETAIL_PAGED_TITLES[entity] || (config && config.title) || entity;
            titleElement.innerText = `${prettyName} | Записей: ${DETAIL_PAGE.total}`;
        }

        if (items.length === 0) {
            const hasFilters = Object.keys(DETAIL_PAGE.filters).length > 0;
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: #888; padding: 20px;">${hasFilters ? 'Ничего не найдено' : 'Нет данных для отображения'}</td></tr>`;
        } else {
            const frag = document.createDocumentFragment();
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.dataset.id = item.id || '';
                tr.style.cursor = 'pointer';
                tr.innerHTML = config.render(item);
                tr.onclick = () => {
                    selectedDetailItem = item;
                    tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
                    tr.classList.add('selected-row');
                };
                frag.appendChild(tr);
            });
            tbody.innerHTML = '';
            tbody.appendChild(frag);
        }
        renderDetailPager();
    } catch (err) {
        if (stale()) return;
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки данных с сервера</td></tr>`;
    } finally {
        if (!stale() || !DETAIL_PAGE.entity) tbody.style.opacity = '';
    }
}


function filterDetailTable() {
    const filterRow = document.getElementById('detail-filter-row');
    if (!filterRow) return;
    if (DETAIL_PAGE.entity && Object.prototype.hasOwnProperty.call(DETAIL_PAGED, DETAIL_PAGE.entity)) {
        const serverFilters = {};
        filterRow.querySelectorAll('input[data-column]').forEach(input => {
            const v = input.value.trim();
            if (v) serverFilters[input.dataset.column] = v;
        });
        DETAIL_PAGE.filters = serverFilters;
        DETAIL_PAGE.page = 1;
        clearTimeout(DETAIL_PAGE.timer);
        DETAIL_PAGE.timer = setTimeout(() => loadDetailPage(DETAIL_PAGE.entity, DETAIL_PAGE.parentId), 350);
        return;
    }
    const filterInputs = filterRow.querySelectorAll('input[data-column]');
    const filters = {};

    filterInputs.forEach((input, colIndex) => {
        const val = input.value.trim().toLowerCase();
        if (val) {
            filters[colIndex] = val;
        }
    });

    const tbody = document.getElementById('detail-body');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const hasFilters = Object.keys(filters).length > 0;
    const groupVisible = {};

    rows.forEach(row => {
        if (row.hasAttribute('onclick')) return;

        const cells = row.children;
        let isVisible = true;

        if (hasFilters) {
            for (const colIndex in filters) {
                const cell = cells[colIndex];
                const text = cell ? cell.textContent.toLowerCase() : '';
                if (!text.includes(filters[colIndex])) {
                    isVisible = false;
                    break;
                }
            }
        }

        row.style.display = isVisible ? '' : 'none';

        const groupClass = row.className ? row.className.trim() : '';
        if (groupClass) {
            if (isVisible) groupVisible[groupClass] = true;
            else if (!(groupClass in groupVisible)) groupVisible[groupClass] = false;
        }
    });

    rows.forEach(row => {
        if (!row.hasAttribute('onclick')) return;

        if (!hasFilters) {
            row.style.display = '';
            return;
        }

        const match = (row.getAttribute('onclick') || '').match(/'([^']+)'/);
        const groupId = match ? match[1] : null;
        row.style.display = (groupId && groupVisible[groupId]) ? '' : 'none';
    });
}
let detailLoadToken = 0;

async function loadDetailData(entity, parentId) {
    const myDetailToken = ++detailLoadToken;
    ensureDetailPrintButton();

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

    let cleanParentId = parentId;
    const skipObjectCleaning = ['stock_batches', 'part_movement_details'];
    
    if (parentId && typeof parentId === 'object' && !skipObjectCleaning.includes(entity) && !skipObjectCleaning.includes(activeEntity)) {
        cleanParentId = parentId.id || parentId.realization_id || parentId.receipt_id || parentId.customer_id || parentId.car_id || parentId.repair_id || parentId.move_id || parentId.dtp_id || parentId.accident_id || parentId.id_accident || '';
    }
    let detailSameParent = false;
    const isPagedDetail = Object.prototype.hasOwnProperty.call(DETAIL_PAGED, entity);
    if (isPagedDetail) {
        detailSameParent = DETAIL_PAGE.entity === entity && String(DETAIL_PAGE.parentId) === String(cleanParentId);
        if (!detailSameParent) { DETAIL_PAGE.page = 1; DETAIL_PAGE.filters = {}; }
        DETAIL_PAGE.entity = entity;
        DETAIL_PAGE.parentId = cleanParentId;
        clearTimeout(DETAIL_PAGE.timer);
    } else {
        removeDetailPager();
    }
    let checkEntity = entity;

    const configCheck = getConfig(checkEntity); 
    const tbodyCheck = document.getElementById('detail-body');
    const visibleColsCheck = configCheck && configCheck.columns ? configCheck.columns.filter(col => col.table !== false) : [];
    const colCountCheck = visibleColsCheck.length > 0 ? visibleColsCheck.length : 1;

    const allowedWithoutId = ['stock_balances'];
    
    const hasValidParam = parentId && (typeof parentId === 'object' || String(parentId).trim() !== '');
    if (!hasValidParam && !allowedWithoutId.includes(entity) && !allowedWithoutId.includes(activeEntity)) {
        if (tbodyCheck) {
            tbodyCheck.innerHTML = `<tr><td colspan="${colCountCheck}" style="text-align: center; color: #888; padding: 20px;">Выберите элемент в верхней таблице</td></tr>`;
        }
                removeDetailPager();
        return;
    }

    const config = getConfig(activeEntity); 
    const tbody = document.getElementById('detail-body');
    const headerTr = document.getElementById('detail-headers'); 
    
    let queryParamName = 'receipt_id';
    let fetchUrl = '';

    if (entity === 'move_items') {
    queryParamName = 'move_id';
    } else if (entity === 'return_items') {
    queryParamName = 'return_id';
    } else if (entity === 'expense_items') {
        queryParamName = 'receipt_id';
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
       } else if (entity === 'repairs' || entity === 'repair_history' || entity === 'receipts_history'  || entity === 'car_general' || entity === 'accidents' || entity === 'car_accidents' || entity === 'dtp_history' || entity === 'car_details' || entity === 'car_images') {
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

    const thead = headerTr ? headerTr.closest('thead') : null;
    
    const existingFilterRow = document.getElementById('detail-filter-row');
    if (existingFilterRow) {
        existingFilterRow.remove();
    }

    const visibleColumns = config && config.columns ? config.columns.filter(col => col.table !== false) : [];
    const colCount = visibleColumns.length > 0 ? visibleColumns.length : 1;

    if (thead && headerTr) {
        let filterRow = document.createElement('tr');
        filterRow.id = 'detail-filter-row';
        thead.insertBefore(filterRow, headerTr);

        filterRow.innerHTML = visibleColumns.map(col => {
            return `
                <th style="padding: 4px; border-bottom: 1px solid #ddd;">
                    <input type="text" 
                           data-column="${col.field}" 
                           oninput="filterDetailTable()" 
                           placeholder="Фильтр..."
                           style="width: 100%; padding: 4px; box-sizing: border-box; font-size: 12px; border: 1px solid #ccc; border-radius: 3px;">
                </th>
            `;
        }).join('');
    }

    if (headerTr && visibleColumns.length > 0) {
        headerTr.innerHTML = visibleColumns.map(col => {
            let widthStyle = col.width ? `width: ${col.width};` : '';
            let alignStyle = col.align ? `text-align: ${col.align};` : 'text-align: left;';
            return `<th style="padding: 6px; border-bottom: 1px solid #ddd; ${widthStyle} ${alignStyle}">${col.label}</th>`;
        }).join('');
    }
    if (isPagedDetail) {
        const pagedFilterRow = document.getElementById('detail-filter-row');
        if (pagedFilterRow) {
            pagedFilterRow.querySelectorAll('input[data-column]').forEach(input => {
                const saved = DETAIL_PAGE.filters[input.dataset.column];
                if (saved) input.value = saved;
            });
        }
        await loadDetailPage(entity, cleanParentId, myDetailToken, !detailSameParent);
        return;
    }
            if (activeEntity === 'car_images') {
        const titleElement = document.getElementById('detail-title');
        try {
            const [detailsRes, imagesRes] = await Promise.all([
                fetch(`/api/car_details?car_id=${cleanParentId}`),
                fetch(`/api/accident_images?car_id=${cleanParentId}`)
            ]);
            const detailsItems = detailsRes.ok ? await detailsRes.json() : [];
            const imagesItems = imagesRes.ok ? await imagesRes.json() : [];

            if (myDetailToken !== detailLoadToken) return;

            const merged = [
                ...detailsItems.filter(i => i.photo_url).map(i => ({
                    date: i.date ? new Date(i.date).toLocaleDateString() : '',
                    image_url: i.photo_url,
                    description: i.description || i.title || '',
                    source_label: 'Фото авто',
                    _sortDate: i.date || ''
                })),
                ...imagesItems.map(i => ({
                    date: i.created_at ? new Date(i.created_at).toLocaleDateString() : '',
                    image_url: i.image_url,
                    description: i.description || '',
                    source_label: 'Фото ДТП',
                    _sortDate: i.created_at || ''
                }))
            ].sort((a, b) => new Date(b._sortDate) - new Date(a._sortDate));

            currentDetailItems = merged;
            selectedDetailItem = null;

            if (titleElement) {
                titleElement.innerText = `Автомобиль (ID: ${cleanParentId}) — Изображения | Записей: ${merged.length}`;
            }

            if (merged.length === 0) {
                tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;color:#888;padding:20px;">Нет изображений</td></tr>`;
            } else {
                tbody.innerHTML = '';
                merged.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = config.render(item);
                    tbody.appendChild(tr);
                });
            }
        } catch (err) {
            if (myDetailToken !== detailLoadToken) return;
            tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;color:red;padding:20px;">Ошибка загрузки данных с сервера</td></tr>`;
        }
        return;
    }

    try {
        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

              if (myDetailToken !== detailLoadToken) return;

        if (!response.ok) throw new Error(`Ошибка загрузки деталей (Статус: ${response.status})`);
        
        const items = await response.json();

        if (myDetailToken !== detailLoadToken) return;

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
            expense_items: 'Спецификация расходов по накладной',
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

        if ((activeEntity === 'repair_history' || activeEntity === 'car_general'|| activeEntity === 'receipts_history') && typeof config.render === 'function') {
            tbody.innerHTML = config.render(items);
        } else {
            tbody.innerHTML = '';
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.dataset.id = item.id || '';
                tr.style.cursor = 'pointer';
                
                if (typeof config.render === 'function') {
                    tr.innerHTML = config.render(item);
                } else {
                    const priceVal = item.price ? Number(item.price).toFixed(2) : '0.00';
                    const workNameText = item.vidy_rabot_name || item.work_name || item.vidy_rabot_id || item.work_id || '—';
                    tr.innerHTML = `
                        <td>${item.ispolnitel_name || item.ispolnitel_id || '—'}</td>
                        <td><b>${workNameText}</b></td>
                        <td style="text-align: right;">${priceVal}</td>
                        <td>${item.description || ''}</td>
                    `;
                }

                tr.onclick = () => {
                    selectedDetailItem = item;

                    tbody.querySelectorAll('tr').forEach(row => row.classList.remove('selected-row'));
                    tr.classList.add('selected-row');
                };

                tbody.appendChild(tr);
            });
        }

        } catch (err) {
        if (myDetailToken !== detailLoadToken) return;
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red; padding: 20px;">Ошибка загрузки данных с сервера</td></tr>`;
    }
}

const navMap = {
    'Пользователи': 'users',
    'Бренды': 'brands',
    'Модели': 'models',
    'Кузов': 'bodies',
    'Вип клиенты': 'skladi',
    'Контрагенты': 'counterparties',
    'Поставщики': 'postavhik',
    'Покупатели': 'customers',
    'Тип контрагента': 'counterparty_types',
    'Тип склада': 'type_sklad',
    'Типы складов': 'type_sklad',
    'Автомобили': 'cars',
    'Виды работ': 'vidy_rabot',
    'Исполнители': 'ispolnitel',
    'Исполнитель': 'ispolnitel',
    'МОЛ': 'mol',
    'Материально ответственные': 'mol',
    'Типы ремонта': 'repair_types',
    'Тип ремонта': 'repair_types',
    'Запчасти': 'zaphasti',
    'Производитель': 'proizvoditel_zaphasti',
    'Топливо': 'toplivo',
    'Ед.измерения': 'ed_izmereniya',
    'Ед. измерения': 'ed_izmereniya',
    'Приход запчастей': 'receipts',                        
    'Строки прихода': 'receipt_items',
    'Перемещение': 'moves',
    'Строки перемещения': 'move_items',
    'Карточка авто': 'car_cards',
    'ДТП':'accidents',
    'ДТП история':'car_accidents',
    'Выставить счет': 'accident_invoices',
    'Оплатить счет': 'accident_payments',
    'События': 'accident_events',
    'Ремонт': 'repairs',
    'Возврат запчастей':'returns',
    'Детали возврата':'return_items',
    'История ремонта': 'repair_history', 
    'История запчастей':'receipts_history',
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
    'Касса: поступления': 'money_receipts',
        'Детали приходов': 'money_receipts_detail',
    'Аналитика по складам': 'money_receipts_by_sklad',
    'Детали услуг': 'money_receipts_works_detail',
    'Касса: расходы': 'expenses_by_sklad',          
    'Поставщики по складу': 'expenses_by_suppliers',
    'Накладные поставщика': 'expenses_by_receipts',
    'Спецификация расходов': 'expense_items',
        'Сотрудники': 'employees',
    'История всех оплат':'expense_payments'  
         
};

function updateFilterPanels(entity) {
    const partsFilter = document.getElementById('parts-filter-panel');
    const movementFilter = document.getElementById('movement-filter-panel');

    if (partsFilter) partsFilter.style.display = 'none';
    if (movementFilter) movementFilter.style.display = 'none';

    const currentEntity = String(entity || '');

    if (currentEntity === 'stock_balances') {
        if (partsFilter) {
            partsFilter.style.display = 'flex';
        }
    } else if (currentEntity === 'stock_movement') {
        if (movementFilter) {
            movementFilter.style.display = 'flex';
        }
    }
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        const text = link.innerText.trim();
        
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        let entity = navMap[text] || text.toLowerCase();
        
        if (entity === 'money_receipts' || text === 'Касса: поступления') {
            entity = 'money_receipts_by_sklad';
        }
        
       
        const btnBackExpense = document.getElementById('btn-back-expense');
        if (btnBackExpense) {
            const isMoneySection = (
                 text === 'Касса: поступления' || text === 'Касса: расходы' || 
                entity === 'money_receipts_by_sklad' || 
                entity === 'расходы' || entity === 'expenses' ||
                entity === 'expenses_by_sklad' || entity === 'expenses_by_suppliers' || entity === 'expenses_by_receipts'
            );

            if (isMoneySection) {
                btnBackExpense.style.setProperty('display', 'none', 'important');
                btnBackExpense.onclick = null;
            } else {
                btnBackExpense.style.setProperty('display', 'none', 'important');
                btnBackExpense.onclick = null;
            }
        }

        if (typeof updateFilterPanels === 'function') {
            updateFilterPanels(entity);
        }

        const detailContainer = document.getElementById('detail-container');
        const carTabsBar = document.getElementById('car-tabs-bar') || document.getElementById('car-tabs-panel'); 
        const tabsForCars = document.getElementById('tabs-for-cars');
        const tabsForAccidents = document.getElementById('tabs-for-accidents');
        const tabsForRepairs = document.getElementById('tabs-for-repairs');
        const tabsForRealizations = document.getElementById('tabs-for-realizations');

        const actionButtonsBar = document.querySelector('.action-buttons') || document.getElementById('action-buttons-bar');
        if (actionButtonsBar) {
            const readOnlyMainEntities = [
                'stock_balances', 
                'stock_movement', 
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

        const entitiesWithDetails = [
            'receipts', 
            'moves', 
            'cars', 
            'car_cards', 
            'accidents', 
            'repairs', 
            'realizations', 
            'stock_movement', 
            'postavhik', 
            'counterparties', 
            'customers',
            'expenses_by_receipts',
            'money_receipts'
        ];

        const summaryEntitiesWithoutDetails = [
            'money_receipts_by_sklad',
            'expenses_by_sklad',
            'expenses_by_suppliers',
            'stock_balances',
            'расходы',
            'expenses',
            'parts',           
            'nomenclature',   
            'goods'
        ];

        const isInEntitiesWithDetails = entitiesWithDetails.includes(entity);
        const isInSummaryWithoutDetails = summaryEntitiesWithoutDetails.includes(entity);
        const shouldShowDetails = isInEntitiesWithDetails && !isInSummaryWithoutDetails;

        if (shouldShowDetails) {
            if (detailContainer) detailContainer.style.setProperty('display', 'flex', 'important');
            
            const detailActionButtons = document.getElementById('detail-action-buttons') || document.querySelector('.detail-action-buttons');
            if (detailActionButtons) {
                detailActionButtons.style.setProperty('display', 'flex', 'important');
            }

            if (carTabsBar) {
                if (['car_cards', 'accidents', 'repairs', 'realizations'].includes(entity)) {
                    carTabsBar.style.display = 'flex';
                } else {
                    carTabsBar.style.display = 'none';
                }
            }

            if (tabsForCars) tabsForCars.style.display = (entity === 'car_cards') ? 'flex' : 'none';
            if (tabsForAccidents) tabsForAccidents.style.display = (entity === 'accidents') ? 'flex' : 'none';
            if (tabsForRepairs) tabsForRepairs.style.display = (entity === 'repairs') ? 'flex' : 'none';
            if (tabsForRealizations) tabsForRealizations.style.display = (entity === 'realizations') ? 'flex' : 'none';

        } else {
            if (detailContainer) detailContainer.style.setProperty('display', 'none', 'important');
            if (carTabsBar) carTabsBar.style.setProperty('display', 'none', 'important');
            
            const detailActionButtons = document.getElementById('detail-action-buttons') || document.querySelector('.detail-action-buttons');
            if (detailActionButtons) {
                detailActionButtons.style.setProperty('display', 'none', 'important');
            }
        }
        
        if (text === 'Касса: расходы' || entity === 'расходы' || entity === 'expenses') {
            loadExpenseMainData('expenses_by_sklad');
            return;
        }

        if (entity === 'money_receipts_by_sklad') {
            loadReceiptMainData('money_receipts_by_sklad');
            return;
        }

        pagerReset(entity);
        loadData(entity, text, () => {
            if (shouldShowDetails) {
                const $firstRow = $('#mainTable tbody tr:first-child, .data-table tbody tr:first-child, table tbody tr:first-child').first();
                if ($firstRow.length) {
                    $firstRow.trigger('click');
                }
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



function setDetailToolbarVisible(visible) {
    const el = document.getElementById('detail-toolbar') || document.getElementById('detail-action-buttons');
    if (el) {
        el.style.setProperty('display', visible ? 'flex' : 'none', 'important');
    }
}





(function() {
    if (!document.getElementById('auto-table-resizer-style')) {
        const style = document.createElement('style');
        style.id = 'auto-table-resizer-style';
        style.textContent = `
    table { table-layout: fixed !important; }
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

     function applyTableResizers() {
    const activeLink = document.querySelector('.nav-link.active');
    const sectionKey = activeLink ? activeLink.innerText.trim() : 'global_table';
    const currentUserId = localStorage.getItem('currentUserId') || 'guest';

        document.querySelectorAll('table').forEach(table => {
            if (table.parentElement) {
                table.parentElement.style.overflowX = 'auto';
                table.parentElement.style.maxWidth = '100%';
            }

            const headerRowEl = table.querySelector('thead tr[id]');
            const tableRole = headerRowEl ? headerRowEl.id : 'table';
            const storageKey = `col_widths_${currentUserId}_${sectionKey}_${tableRole}`;
            const rows = Array.from(table.querySelectorAll('tr'));
            let textRowIndex = -1;

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

            const savedWidths = JSON.parse(localStorage.getItem(storageKey) || '{}');

                       textCells.forEach((th, colIndex) => {
                const widthKey = th.dataset.field || colIndex;

                if (savedWidths[widthKey]) {
                    th.style.width = savedWidths[widthKey];
                    for (let i = 0; i < textRowIndex; i++) {
                        const upperCell = rows[i].querySelectorAll('th, td')[colIndex];
                        if (upperCell) upperCell.style.width = savedWidths[widthKey];
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
                        const newWidth = Math.max(10, startWidth + dx); 
                        
                        th.style.width = `${newWidth}px`;

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

                        const currentWidths = {};
                        textRow.querySelectorAll('th, td').forEach((cell, idx) => {
                            const key = cell.dataset.field || idx;
                            currentWidths[key] = cell.style.width;
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

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            setTimeout(applyTableResizers, 200);
        });
    });

    const observer = new MutationObserver(() => {
        applyTableResizers();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(applyTableResizers, 300);
})();



(function() {
    const STORAGE_KEY = 'tableDensityLevel';
       const LEVELS = {
        compact:  { fontSize: 11, padY: 3,  padX: 6  },
        standard: { fontSize: 12, padY: 5,  padX: 8  },
        medium:   { fontSize: 13, padY: 7,  padX: 9  },
        expanded: { fontSize: 13, padY: 9,  padX: 10 },
        wide:     { fontSize: 14, padY: 11, padX: 10 }
    };
    const LABELS = { compact: 'Плотный', standard: 'Стандартный', medium: 'Средний', expanded: 'Расширенный', wide: 'Широкий' };

    function ensureDensityStyleTag() {
        let style = document.getElementById('table-density-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'table-density-style';
            document.head.appendChild(style);
        }
        return style;
    }

    function applyDensity(level) {
        const cfg = LEVELS[level] || LEVELS.standard;
        ensureDensityStyleTag().textContent = `
            #data-table td, #data-table th,
            #detail-table td, #detail-table th {
                font-size: ${cfg.fontSize}px !important;
                padding: ${cfg.padY}px ${cfg.padX}px !important;
            }
        `;
        localStorage.setItem(STORAGE_KEY, level);
              const input = document.getElementById('density-select-input');
        if (input) {
            input.value = LABELS[level] || LABELS.standard;
        }
    }

    function initDensitySelector() {
        const container = document.getElementById('density-select-container');
        const input = document.getElementById('density-select-input');
        const dropdown = document.getElementById('density-select-dropdown');
        if (!container || !input || !dropdown) return;
        if (container.dataset.densityInit) return;
        container.dataset.densityInit = '1';

        input.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        dropdown.querySelectorAll('.density-option').forEach(opt => {
            opt.addEventListener('mouseover', () => { opt.style.background = '#f1f5f9'; });
            opt.addEventListener('mouseout', () => { opt.style.background = '#fff'; });
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                applyDensity(opt.dataset.level);
                dropdown.style.display = 'none';
            });
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) dropdown.style.display = 'none';
        });

        applyDensity(localStorage.getItem(STORAGE_KEY) || 'standard');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDensitySelector);
    } else {
        initDensitySelector();
    }
    const densityObserver = new MutationObserver(() => initDensitySelector());
    densityObserver.observe(document.body, { childList: true, subtree: true });
})();