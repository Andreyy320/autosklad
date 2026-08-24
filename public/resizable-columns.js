function initTableResizer(table) {
    if (!table) return;

    // Ищем строку с заголовками, где есть реальный текст (исключая строки с инпутами-фильтрами)
    const headerRows = table.querySelectorAll('thead tr, tr');
    let targetRow = null;

    for (let row of headerRows) {
        const ths = row.querySelectorAll('th, td');
        let hasTextHeader = Array.from(ths).some(cell => cell.textContent.trim().length > 0 && !cell.querySelector('input'));
        if (hasTextHeader) {
            targetRow = row;
            break;
        }
    }

    if (!targetRow) {
        targetRow = table.querySelector('thead tr') || table.querySelector('tr');
    }

    if (!targetRow) return;

    const headerCells = targetRow.querySelectorAll('th, td');

    headerCells.forEach(th => {
        if (th.querySelector('.resizer')) return;

        // Фиксируем исходную ширину ячейки в пикселях
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

window.makeTablesResizable = function() {
    document.querySelectorAll('table').forEach(table => {
        initTableResizer(table);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    window.makeTablesResizable();
});

const observer = new MutationObserver((mutations) => {
    let hasTables = false;
    mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeName === 'TABLE' || (node.querySelectorAll && node.querySelectorAll('table').length > 0)) {
                    hasTables = true;
                }
            });
        }
    });
    if (hasTables) {
        window.makeTablesResizable();
    }
});

observer.observe(document.body, { childList: true, subtree: true });

window.makeTablesResizable();