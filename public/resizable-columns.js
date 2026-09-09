(function() {
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

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            setTimeout(initResizers, 150);
        });
    });

    const observer = new MutationObserver(() => {
        initResizers();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(initResizers, 200);
})();