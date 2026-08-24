function initTableResizer(table) {
    if (!table) return;
    
    // Обязательно фиксируем таблицу, чтобы колонки держали заданную ширину
    table.style.tableLayout = 'fixed';

    const headerCells = table.querySelectorAll('th');

    headerCells.forEach(th => {
        if (th.querySelector('.resizer')) return;

        // Фиксируем начальную ширину каждого заголовка в пикселях, если её еще нет
        if (!th.style.width) {
            th.style.width = `${th.offsetWidth}px`;
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

            function mouseMoveHandler(e) {
                const dx = e.clientX - startX;
                const newWidth = Math.max(30, startWidth + dx);
                th.style.width = `${newWidth}px`;
            }

            function mouseUpHandler() {
                resizer.classList.remove('resizing');
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            }

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);

            e.preventDefault(); // Предотвращаем выделение текста
        });
    });
}

// Автоматически инициализируем таблицы
const observer = new MutationObserver(() => {
    document.querySelectorAll('table').forEach(table => {
        initTableResizer(table);
    });
});

observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('table').forEach(table => {
        initTableResizer(table);
    });
});