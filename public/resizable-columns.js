function initTableResizer(table) {
    if (!table) return;
    const headerCells = table.querySelectorAll('thead tr:last-child th');

    headerCells.forEach(th => {
        if (th.querySelector('.resizer')) return;

        // Убедимся, что у th задана начальная ширина в пикселях, если её не было
        if (!th.style.width && th.offsetWidth) {
            th.style.width = `${th.offsetWidth}px`;
        }

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
                const newWidth = Math.max(50, w + dx); // Минимальная ширина 50px
                th.style.width = `${newWidth}px`;
            }

            function mouseUpHandler() {
                resizer.classList.remove('resizing');
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            }

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            
            // Предотвращаем выделение текста во время перетаскивания
            e.preventDefault();
        });
    });
}

// Следим за изменениями таблицы в DOM и инициализируем ресайзеры
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