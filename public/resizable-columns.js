function initTableResizer(table) {
    if (!table) return;
    const headerCells = table.querySelectorAll('thead tr:last-child th');

    headerCells.forEach(th => {
        // Чтобы не дублировать ресайзер
        if (th.querySelector('.resizer')) return;

        const resizer = document.createElement('div');
        resizer.classList.add('resizer');
        th.appendChild(resizer);

        let x = 0;
        let w = 0;

        resizer.addEventListener('mousedown', function (e) {
            x = e.clientX;
            w = th.offsetWidth;

            resizer.classList.add('resizing');

            function mouseMoveHandler(e) {
                const dx = e.clientX - x;
                th.style.width = `${w + dx}px`;
            }

            function mouseUpHandler() {
                resizer.classList.remove('resizing');
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            }

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });
    });
}

// Автоматически ищем таблицы и вешаем ресайзеры при любых изменениях на странице
const observer = new MutationObserver(() => {
    document.querySelectorAll('table').forEach(table => {
        initTableResizer(table);
    });
});

observer.observe(document.body, { childList: true, subtree: true });

// И при первой загрузке тоже
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('table').forEach(table => {
        initTableResizer(table);
    });
});