(function () {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
    }

    var mq = window.matchMedia('(max-width: 900px)');
    function closeSidebar() { document.body.classList.remove('sidebar-open'); }

    function initMenu() {
        var toolbar = document.querySelector('.toolbar');
        var sidebar = document.querySelector('.sidebar');
        if (!toolbar || !sidebar || document.getElementById('mobile-menu-btn')) return;

        var btn = document.createElement('button');
        btn.id = 'mobile-menu-btn';
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.setAttribute('aria-label', 'Меню');
        btn.textContent = '☰';
        btn.addEventListener('click', function () {
            document.body.classList.toggle('sidebar-open');
        });
        toolbar.insertBefore(btn, toolbar.firstChild);

        var backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.addEventListener('click', closeSidebar);
        document.body.appendChild(backdrop);

        sidebar.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () { if (mq.matches) closeSidebar(); });
        });

        var onChange = function (e) { if (!e.matches) closeSidebar(); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    var deferredPrompt = null;
    function showInstall() {
        var sidebar = document.querySelector('.sidebar');
        if (!sidebar || document.getElementById('install-app-btn')) return;
        var b = document.createElement('div');
        b.id = 'install-app-btn';
        b.className = 'install-link';
        b.textContent = '⬇ Установить приложение';
        b.addEventListener('click', async function () {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            try { await deferredPrompt.userChoice; } catch (e) {}
            deferredPrompt = null;
            b.remove();
        });
        sidebar.appendChild(b);
    }
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault(); deferredPrompt = e; showInstall();
    });
    window.addEventListener('appinstalled', function () {
        var b = document.getElementById('install-app-btn'); if (b) b.remove();
    });
    // Список «Плотность» открывается поверх панели, а не внутри неё (чтобы прокрутка панели его не обрезала)
    document.addEventListener('click', function (e) {
        if (!mq.matches || !e.target.closest || !e.target.closest('#density-select-container')) return;
        var inp = document.getElementById('density-select-input');
        var dd = document.getElementById('density-select-dropdown');
        if (!inp || !dd) return;
        var r = inp.getBoundingClientRect();
        dd.style.position = 'fixed';
        dd.style.top = r.bottom + 'px';
        dd.style.left = r.left + 'px';
        dd.style.right = 'auto';
        dd.style.width = Math.max(r.width, 150) + 'px';
    }, true);

    // Крутим панель пальцем — список закрывается
    document.addEventListener('scroll', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('toolbar')) {
            var dd = document.getElementById('density-select-dropdown');
            if (dd) dd.style.display = 'none';
        }
    }, true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMenu);
    else initMenu();
})();