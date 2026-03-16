(function () {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    document.documentElement.setAttribute('data-bs-theme', mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', function(e) {
        document.documentElement.setAttribute('data-bs-theme', e.matches ? 'dark' : 'light');
    });
})();
