// تسجيل الخروج
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    window.location.href = 'login.html';
}

// التحكم في القائمة المنسدلة
function setupDropdown() {
    const userProfile = document.querySelector('.user-profile'); // تغيير هنا
    const dropdownMenu = userProfile.querySelector('.dropdown-menu');
    const dropdownArrow = userProfile.querySelector('.dropdown-arrow');

    // التفعيل عند النقر على أي جزء في user-profile
    userProfile.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
        dropdownArrow.classList.toggle('rotate');
    });

    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', function() {
        dropdownMenu.classList.remove('show');
        dropdownArrow.classList.remove('rotate');
    });

    // منع إغلاق القائمة عند النقر على عناصرها
    dropdownMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}


// إعداد القائمة الجانبية
function setupSidebar() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    menuToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });

    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// تحميل بيانات المستخدم
async function loadUserData() {
    const usernameDisplay = document.getElementById('username-display');
    if (!usernameDisplay) return console.error('عنصر عرض اسم المستخدم غير موجود!');

    const token = localStorage.getItem('authToken');
    if (!token) {
        usernameDisplay.textContent = 'ضيف';
        window.location.href = 'login.html';
        return;
    }

    // تحقق أولاً من البيانات المخزنة محليًا
    const savedData = localStorage.getItem('userData');
    if (savedData) {
        try {
            const userData = JSON.parse(savedData);
            if (userData?.username) {
                usernameDisplay.textContent = userData.username;
            } else {
                usernameDisplay.textContent = 'ضيف';
            }
        } catch (e) {
            console.warn('تعذر قراءة بيانات المستخدم المخزنة:', e);
        }
    } else {
        usernameDisplay.textContent = 'جار التحميل...';
    }

    // جلب البيانات من السيرفر
    try {
        const response = await fetch('/api/auth/user-info', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`خطأ في الخادم: ${response.status}`);

        const data = await response.json();
        if (data?.user?.username) {
            usernameDisplay.textContent = data.user.username;
            localStorage.setItem('userData', JSON.stringify(data.user));
        } else {
            usernameDisplay.textContent = 'ضيف';
        }

    } catch (error) {
        console.error('فشل تحميل بيانات المستخدم:', error);
        usernameDisplay.textContent = 'ضيف';
    }
}

// عرض رسالة خطأ
function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    document.body.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 3000);
}

// عرض رسالة نجاح
function showSuccess(message) {
    const successElement = document.createElement('div');
    successElement.className = 'success-message';
    successElement.textContent = message;
    document.body.appendChild(successElement);
    setTimeout(() => successElement.remove(), 3000);
}

// تعديل دالة setupStoreConnection
async function setupStoreConnection() {
    const connectBtn = document.getElementById('connectSallaBtn');
    if (!connectBtn) return;

    connectBtn.addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                showError('يجب تسجيل الدخول أولاً');
                return window.location.href = 'login.html';
            }

            // حفظ التوكن في sessionStorage قبل التوجيه
            sessionStorage.setItem('salla_auth_token', token);

            const response = await fetch('/api/salla/connect', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.message);

            window.location.href = data.authUrl;
        } catch (error) {
            console.error('Connection error:', error);
            showError(error.message || 'حدث خطأ أثناء محاولة الربط');
        }
    });
}

// تحميل المتاجر المربوطة
async function loadConnectedStores() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch('/api/salla/stores', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        const storesList = document.getElementById('storesList');
        const emptyState = document.getElementById('emptyState');

        if (!storesList || !emptyState) return;

        storesList.innerHTML = '';

        if (data.success && data.stores?.length > 0) {
            emptyState.style.display = 'none';
            data.stores.forEach(store => {
                const storeElement = document.createElement('div');
                storeElement.className = 'store-card';
                storeElement.innerHTML = `
                    <div class="store-header">
                        <i class="fas fa-store"></i>
                        <h3>${store.shop_name || 'متجر بدون اسم'}</h3>
                    </div>
                    <div class="store-details">
                        <p><i class="fas fa-id-card"></i> <span>${store.merchant_id || 'غير معروف'}</span></p>
                        <p><i class="fas fa-calendar-alt"></i> تم الربط في: ${store.created_at ? new Date(store.created_at).toLocaleDateString() : 'غير معروف'}</p>
                    </div>
                    <button class="disconnect-btn" onclick="disconnectStore('${store.id}', '${store.shop_name || 'هذا المتجر'}')">
                        <i class="fas fa-unlink"></i> فك الربط
                    </button>
                `;
                storesList.appendChild(storeElement);
            });
        } else {
            emptyState.style.display = 'flex';
        }

    } catch (error) {
        console.error('Error loading stores:', error);
        showError('حدث خطأ أثناء جلب المتاجر المربوطة');
    }
}

// فك الربط عن المتجر
async function disconnectStore(storeId, storeName) {
    if (!confirm(`هل أنت متأكد من فك ربط متجر ${storeName}؟`)) return;

    const token = localStorage.getItem('authToken');
    if (!token) {
        showError('يجب تسجيل الدخول أولاً');
        return window.location.href = 'login.html';
    }

    try {
        const response = await fetch(`/api/salla/stores/${storeId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            showSuccess(`تم فك ربط متجر ${storeName} بنجاح`);
            loadConnectedStores();
        } else {
            showError(data.message || 'فشل في فك الربط');
        }

    } catch (error) {
        console.error('Disconnect error:', error);
        showError('حدث خطأ أثناء محاولة فك الربط');
    }
}

// تشغيل الوظائف عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard loaded');
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

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === '1') {
        showSuccess('تم ربط المتجر بنجاح!');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Debugging
    console.log('Initial auth token:', localStorage.getItem('authToken'));
    console.log('Initial user data:', localStorage.getItem('userData'));
});
