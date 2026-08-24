function initTableResizer(table) {
    if (!table) return;
    
    const headerCells = table.querySelectorAll('th');

    headerCells.forEach(th => {
        // Защита от повторного добавления ресайзера
        if (th.querySelector('.resizer')) return;

        // Жестко фиксируем текущую ширину столбца в пикселях при старте
        if (!th.style.width || th.style.width === 'auto') {
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
            document.body.style.cursor = 'col-resize'; // Меняем курсор во всем документе при перетаскивании

            function mouseMoveHandler(e) {
                const dx = e.clientX - startX;
                const newWidth = Math.max(30, startWidth + dx); // Минимальная ширина столбца 30px
                th.style.width = `${newWidth}px`;
            }

            function mouseUpHandler() {
                resizer.classList.remove('resizing');
                document.body.style.cursor = ''; // Возвращаем обычный курсор
                
                // Слушатели вешаем на window, чтобы движение не терялось, если курсор ушел за пределы таблицы
                window.removeEventListener('mousemove', mouseMoveHandler);
                window.removeEventListener('mouseup', mouseUpHandler);
            }

            window.addEventListener('mousemove', mouseMoveHandler);
            window.addEventListener('mouseup', mouseUpHandler);

            e.preventDefault(); // Предотвращаем выделение текста в таблице
            e.stopPropagation(); // Останавливаем всплытие
        });
    });
}

// Автоматическая инициализация при загрузке и изменении DOM
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