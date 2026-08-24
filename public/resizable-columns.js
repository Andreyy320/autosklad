function initTableResizer(table) {
    const headerCells = table.querySelectorAll('th');

    headerCells.forEach(th => {
        // Чтобы случайно не добавить второй ресайзер на ту же колонку
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

// Инициализация для всех существующих и динамических таблиц на странице
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('table').forEach(table => {
        initTableResizer(table);
    });

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                document.querySelectorAll('table').forEach(table => {
                    initTableResizer(table);
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
});