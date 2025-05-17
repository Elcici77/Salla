function loadNavbarAndSidebar() {
    // تحميل navbar.html
    fetch("navbar.html")
        .then(response => response.text())
        .then(data => {
            document.getElementById("included-navbar").innerHTML = data;

            // الدوال التي يتم استدعاؤها بعد تحميل الـ Navbar
            const tempToken = localStorage.getItem('tempAuthToken');
            if (tempToken) {
                localStorage.setItem('authToken', tempToken);
                localStorage.removeItem('tempAuthToken');
            }

            setupSidebar();
            loadUserData();
            setupStoreConnection();
            loadConnectedStores();
            setupDropdown();
            setupFullpageStoresDropdown();
            updateNavbarProfileImage();

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('connected') === '1') {
                showSuccess('تم ربط المتجر بنجاح!');
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        })
        .catch(error => {
            console.error('Error loading navbar:', error);
        });

    // تحميل sidebar.html وتشغيل sidebar.js
    fetch("sidebar.html")
        .then(response => response.text())
        .then(data => {
            console.log('Sidebar HTML loaded successfully');
            document.getElementById("included-sidebar").innerHTML = data;
            setupSidebar();

            // تحميل وتنفيذ sidebar.js ديناميكيًا
            const script = document.createElement('script');
            script.src = 'Scripts/sidebar.js';
            script.async = true;
            script.onload = () => console.log('sidebar.js loaded successfully');
            script.onerror = () => console.error('Failed to load sidebar.js');
            document.body.appendChild(script);
        })
        .catch(error => {
            console.error('Error loading sidebar:', error);
        });
}

// تشغيل الدالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', loadNavbarAndSidebar);