// تسجيل الخروج
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    window.location.href = 'login.html';
}

// التحكم في القائمة المنسدلة للمستخدم
function setupDropdown() {
    const userProfile = document.getElementById('userProfile') || document.querySelector('.user-profile');
    if (!userProfile) return;

    const dropdownMenu = userProfile.querySelector('.dropdown-menu');
    const dropdownArrow = userProfile.querySelector('.dropdown-arrow');

    // التفعيل عند النقر على أي جزء في user-profile
    userProfile.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
        if (dropdownArrow) dropdownArrow.classList.toggle('rotate');
    });

    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', function() {
        dropdownMenu?.classList.remove('show');
        dropdownArrow?.classList.remove('rotate');
    });

    // منع إغلاق القائمة عند النقر على عناصرها
    dropdownMenu?.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

// التحكم في قائمة المتاجر المنسدلة
function setupStoresDropdown() {
    const connectSallaBtn = document.getElementById('connectSallaBtn');
    const storesDropdown = document.getElementById('storesDropdown');
    const addStoreBtn = document.getElementById('addStoreBtn');

    if (!connectSallaBtn || !storesDropdown) return;

    connectSallaBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        storesDropdown.classList.toggle('show');
    });

    addStoreBtn?.addEventListener('click', function(e) {
        e.stopPropagation();
        setupStoreConnection(); // استخدام الوظيفة الموجودة مسبقًا
    });

    // منع إغلاق القائمة عند النقر داخلها
    storesDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

function updateNavbarProfileImage() {
    const token = localStorage.getItem('authToken');
    const avatarImg = document.querySelector('.user-avatar img');
    const usernameSpan = document.getElementById('username-display');
    const defaultImage = 'https://via.placeholder.com/40';

    if (!token || !avatarImg) return;

    fetch('http://localhost:5000/api/auth/profile', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.profile_picture) {
            avatarImg.src = `http://localhost:5000/uploads/profiles/${data.profile_picture}`;
        } else {
            avatarImg.src = defaultImage;
        }

        if (usernameSpan) {
            usernameSpan.textContent = data.username || 'مستخدم';
        }
    })
    .catch(err => {
        console.error('فشل في تحميل بيانات الـ Navbar:', err);
        avatarImg.src = defaultImage;
    });
}

// إعداد القائمة الجانبية
function setupSidebar() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    menuToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        menuToggle.classList.toggle('active');
        sidebar.classList.toggle('active');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('active');
        menuToggle?.classList.remove('active');
    });

    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            sidebar.classList.remove('active');
            menuToggle?.classList.remove('active');
        });
    });
}

// تحميل بيانات المستخدم
async function loadUserData() {
    const usernameDisplay = document.getElementById('username-display');
    const navbarAvatar = document.querySelector('.user-avatar img');
    const defaultImage = 'https://via.placeholder.com/40';

    if (!usernameDisplay) return console.error('عنصر عرض اسم المستخدم غير موجود!');

    const token = localStorage.getItem('authToken');
    if (!token) {
        usernameDisplay.textContent = 'ضيف';
        if (navbarAvatar) navbarAvatar.src = defaultImage;
        window.location.href = 'login.html';
        return;
    }

    // عرض حالة التحميل
    usernameDisplay.textContent = 'جار التحميل...';
    if (navbarAvatar) navbarAvatar.src = defaultImage;

    try {
        const response = await fetch('/api/auth/user-info', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = 'login.html';
            }
            throw new Error(`خطأ في الخادم: ${response.status}`);
        }

        const data = await response.json();
        if (data?.user?.username) {
            usernameDisplay.textContent = data.user.username;
            
            // تحديث صورة البروفايل في الـ navbar
            if (navbarAvatar && data.user.profile_picture) {
                navbarAvatar.src = `http://localhost:5000/uploads/profiles/${data.user.profile_picture}?${Date.now()}`;
                // حفظ بيانات المستخدم بما فيها الصورة في localStorage
                localStorage.setItem('userData', JSON.stringify(data.user));
            } else if (navbarAvatar) {
                navbarAvatar.src = defaultImage;
            }
        } else {
            usernameDisplay.textContent = 'ضيف';
            if (navbarAvatar) navbarAvatar.src = defaultImage;
        }

    } catch (error) {
        console.error('فشل تحميل بيانات المستخدم:', error);
        usernameDisplay.textContent = 'ضيف';
        if (navbarAvatar) navbarAvatar.src = defaultImage;
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
    const addStoreBtn = document.getElementById('addStoreBtn');
    const addStoreBtnEmpty = document.getElementById('addStoreBtnEmpty');
    
    const handleAddStore = async () => {
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
    };

    if (addStoreBtn) addStoreBtn.addEventListener('click', handleAddStore);
    if (addStoreBtnEmpty) addStoreBtnEmpty.addEventListener('click', handleAddStore);
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
// إنشاء بطاقة متجر
function createStoreCard(store) {
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
            <p><i class="fas fa-sync-alt"></i> آخر مزامنة: منذ ${Math.floor(Math.random() * 24)} ساعة</p>
        </div>
        <button class="disconnect-btn" onclick="disconnectStore('${store.id}', '${store.shop_name || 'هذا المتجر'}')">
            <i class="fas fa-unlink"></i> فك الربط
        </button>
    `;
    return storeElement;
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

// دالة لإعداد القائمة الكاملة للمتاجر
function setupFullpageStoresDropdown() {
    const connectBtn = document.getElementById('connectSallaBtn');
    const storesDropdown = document.getElementById('storesDropdown');
    const addStoreBtn = document.getElementById('addStoreBtn');
    const addStoreBtnEmpty = document.getElementById('addStoreBtnEmpty');

    if (!connectBtn || !storesDropdown) return;

    connectBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        connectBtn.classList.toggle('active');
        storesDropdown.classList.toggle('show');
    });

    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', function() {
        connectBtn.classList.remove('active');
        storesDropdown.classList.remove('show');
    });

    // منع إغلاق القائمة عند النقر داخلها
    storesDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // زر إضافة متجر جديد
    const handleAddStore = () => {
        // هنا نضع كود ربط المتجر الجديد
        setupStoreConnection();
        storesDropdown.classList.remove('show');
        connectBtn.classList.remove('active');
    };

    if (addStoreBtn) addStoreBtn.addEventListener('click', handleAddStore);
    if (addStoreBtnEmpty) addStoreBtnEmpty.addEventListener('click', handleAddStore);
}

