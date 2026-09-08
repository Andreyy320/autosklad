(function() {
    // Автоматические стили для ресайзера
    if (!document.getElementById('persistent-resizer-style')) {
        const style = document.createElement('style');
        style.id = 'persistent-resizer-style';
        style.textContent = `
            table { table-layout: auto !important; }
            th { position: relative !important; }
            th .resizer {
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
            th .resizer:hover, th .resizer.resizing {
                background-color: #2563eb !important;
            }
        `;
        document.head.appendChild(style);
    }

    function initResizers() {
        // Узнаем текущий активный раздел, чтобы сохранять ширину персонально для каждой вкладки
        const activeLink = document.querySelector('.nav-link.active');
        const sectionKey = activeLink ? activeLink.innerText.trim() : 'default_table';

        document.querySelectorAll('table').forEach(table => {
            const rows = table.querySelectorAll('tr');
            let textRow = null;

            for (let row of rows) {
                const cells = row.querySelectorAll('th, td');
                const hasText = Array.from(cells).some(cell => cell.textContent.trim().length > 0 && !cell.querySelector('input'));
                if (hasText) {
                    textRow = row;
                    break;
                }
            }

            if (!textRow) return;

            textRow.querySelectorAll('th, td').forEach((th, index) => {
                if (th.querySelector('.resizer')) return;

                // Восстанавливаем сохраненную ширину из localStorage, если она была
                const savedWidths = JSON.parse(localStorage.getItem(`col_widths_${sectionKey}`) || '{}');
                if (savedWidths[index]) {
                    th.style.width = savedWidths[index];
                } else if (!th.style.width || th.style.width === 'auto') {
                    const w = th.offsetWidth;
                    if (w > 0) th.style.width = `${w}px`;
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

                    function onMouseMove(e) {
                        const dx = e.clientX - startX;
                        const newW = `${Math.max(30, startWidth + dx)}px`;
                        th.style.width = newW;
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
                        localStorage.setItem(`col_widths_${sectionKey}`, JSON.stringify(currentWidths));
                    }

                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);

                    e.preventDefault();
                    e.stopPropagation();
                });
            });
        });
    }

    // Слушаем клики по меню, чтобы при переключении разделов заново инициализировать таблицы
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            // Даем время функции loadData отрисовать новую таблицу
            setTimeout(initResizers, 150);
        });
    });

    // Также следим за изменениями DOM на случай динамической подгрузки данных
    const observer = new MutationObserver(() => {
        initResizers();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Первичный запуск при загрузке
    setTimeout(initResizers, 200);
})();