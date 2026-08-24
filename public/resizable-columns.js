function initTableResizer(table) {
    if (!table) return;
    
    // Проверяем в консоли, для какой таблицы сработал скрипт
    console.log('Инициализация ресайзера для таблицы:', table);

    const headerCells = table.querySelectorAll('th');
    console.log('Найдено заголовков (th):', headerCells.length);

    headerCells.forEach((th, index) => {
        // Если ресайзер уже есть, не создаем его заново
        if (th.querySelector('.resizer')) return;

        // Принудительно задаем начальную ширину, если её нет
        if (!th.style.width || th.style.width === 'auto') {
            const currentWidth = th.offsetWidth;
            if (currentWidth > 0) {
                th.style.width = `${currentWidth}px`;
            }
        }

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

            function mouseMoveHandler(e) {
                const dx = e.clientX - startX;
                const newWidth = Math.max(30, startWidth + dx);
                th.style.width = `${newWidth}px`;
            }

            function mouseUpHandler() {
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                
                window.removeEventListener('mousemove', mouseMoveHandler);
                window.removeEventListener('mouseup', mouseUpHandler);
            }

            window.addEventListener('mousemove', mouseMoveHandler);
            window.addEventListener('mouseup', mouseUpHandler);

            e.preventDefault();
            e.stopPropagation();
        });
    });
}

// Функция глобального сканирования всех таблиц на странице
window.makeTablesResizable = function() {
    document.querySelectorAll('table').forEach(table => {
        initTableResizer(table);
    });
};

// Автоматический запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    window.makeTablesResizable();
});

// Периодический или мутационный перехват для динамических таблиц
const observer = new MutationObserver((mutations) => {
    let hasNewTables = false;
    mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeName === 'TABLE' || (node.querySelectorAll && node.querySelectorAll('table').length > 0)) {
                    hasNewTables = true;
                }
            });
        }
    });
    if (hasNewTables) {
        window.makeTablesResizable();
    }
});

observer.observe(document.body, { childList: true, subtree: true });