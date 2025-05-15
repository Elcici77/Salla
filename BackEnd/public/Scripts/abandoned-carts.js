// تحويل الوقت إلى تنسيق "منذ وقت"
function timeSince(date) {
    const now = new Date();
    const seconds = Math.floor((now - new Date(date)) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return `منذ ${interval} سنوات`;
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return `منذ ${interval} أشهر`;
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return `منذ ${interval} أيام`;
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return `منذ ${interval} ساعات`;
    interval = Math.floor(seconds / 60);
    if (interval > 1) return `منذ ${interval} دقائق`;
    return `منذ لحظات`;
}

// ترجمة حالة السلة إلى نص عربي
function getStatusText(status) {
    switch (status) {
        case 'pending': return 'معلقة';
        case 'recovered': return 'تم الاسترداد';
        case 'failed': return 'فشل';
        case 'expired': return 'منتهية';
        default: return 'غير معروف';
    }
}

// إظهار إشعار
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container') || document.createElement('div');
    if (!container.id) {
        container.id = 'notification-container';
        document.body.appendChild(container);
    }

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="close-btn" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(notification);

    setTimeout(() => notification.remove(), 5000);
}

// إظهار رسالة نجاح
function showSuccess(message) {
    showNotification(message, 'success');
}

// إظهار رسالة خطأ
function showError(message) {
    showNotification(message, 'error');
}

// بيانات السلات (للحفاظ على البيانات الأصلية أثناء البحث)
let allCarts = [];

// تحميل المتاجر المرتبطة
async function loadStores() {
    const select = document.getElementById('store-select');
    const token = localStorage.getItem('authToken');

    if (!token) {
        showError('يجب تسجيل الدخول أولاً');
        window.location.href = 'login.html';
        return;
    }

    try {
        console.log('Fetching stores from /api/salla/stores with token:', token);
        const response = await fetch('/api/salla/stores', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch stores, status:', response.status, 'statusText:', response.statusText);
            if (response.status === 401) {
                showError('جلسة غير صالحة. يرجى تسجيل الدخول مجددًا.');
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`فشل جلب المتاجر: ${response.statusText}`);
        }

        const jsonResponse = await response.json();
        console.log('Stores API response:', jsonResponse);

        if (!jsonResponse.success || !Array.isArray(jsonResponse.stores)) {
            console.error('Invalid stores data:', jsonResponse);
            throw new Error('فشل جلب المتاجر: بيانات غير صالحة');
        }

        const stores = jsonResponse.stores;

        if (stores.length === 0) {
            console.warn('No stores found for user');
            showError('لا توجد متاجر مربوطة. يرجى ربط متجر من إعدادات الحساب.');
            select.innerHTML = '<option value="">لا توجد متاجر</option>';
            return;
        }

        select.innerHTML = '<option value="">اختر متجرًا</option>';
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.merchant_id;
            option.textContent = store.shop_name || `متجر تجريبي (${store.merchant_id})`;
            select.appendChild(option);
        });

        $('#store-select').select2({
            placeholder: 'اختر متجرًا',
            dir: 'rtl',
            width: '100%'
        });

        if (stores.length === 1) {
            select.value = stores[0].merchant_id;
            $('#store-select').trigger('change.select2');
            loadAbandonedCarts();
        }

        $('#store-select').on('change', () => {
            console.log('Selected merchant_id:', select.value);
            loadAbandonedCarts();
        });
    } catch (error) {
        console.error('خطأ في جلب المتاجر:', error);
        showError('حدث خطأ أثناء جلب المتاجر. يرجى المحاولة لاحقًا أو ربط متجر جديد.');
        select.innerHTML = '<option value="">فشل جلب المتاجر</option>';
    }
}

// تحميل بيانات السلات المتروكة
async function loadAbandonedCarts(searchQuery = '') {
    const tbody = document.getElementById('carts-table-body');
    const emptyState = document.getElementById('empty-state');
    const selectedActions = document.getElementById('selected-actions');
    
    // ===== بيانات تجريبية - يمكن حذفها لاحقاً =====
    const testCarts = [
        {
            id: 1,
            cart_id: 'test-001',
            customer_name: 'محمد أحمد',
            customer_phone: '0512345678',
            customer_image: null,
            total: 150.99,
            products_count: 3,
            status: 'pending',
            created_at: new Date().toISOString(),
            last_sync_at: new Date().toISOString()
        },
        {
            id: 2,
            cart_id: 'test-002',
            customer_name: 'أحمد خالد',
            customer_phone: '0587654321',
            customer_image: null,
            total: 75.50,
            products_count: 2,
            status: 'pending',
            created_at: new Date(Date.now() - 86400000).toISOString(), // منذ يوم
            last_sync_at: new Date().toISOString()
        }
    ];
    // ===== نهاية البيانات التجريبية =====

    // ===== كود تجريبي - بداية =====
    tbody.innerHTML = '<tr><td colspan="11">جار التحميل (وضع تجريبي)...</td></tr>';
    
    try {
        // استخدام البيانات التجريبية مباشرة
        allCarts = [...testCarts];
        
        const filteredCarts = searchQuery
            ? allCarts.filter(cart =>
                (cart.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                cart.cart_id?.toLowerCase().includes(searchQuery.toLowerCase())))
            : allCarts;

        tbody.innerHTML = '';
        
        if (filteredCarts.length === 0) {
            emptyState.style.display = 'flex';
            selectedActions.style.display = 'none';
            tbody.innerHTML = '<tr><td colspan="11">لا توجد سلات متروكة في الوقت الحالي (وضع تجريبي)</td></tr>';
            return;
        }

        emptyState.style.display = 'none';
        selectedActions.style.display = 'none';
        
        filteredCarts.forEach(cart => {
            const row = document.createElement('tr');
            const createdAt = new Date(cart.created_at);
            const ageInHours = Math.floor((new Date() - createdAt) / (1000 * 60 * 60));
            
            row.innerHTML = `
                <td><input type="checkbox" class="cart-checkbox" data-id="${cart.id}"></td>
                <td class="customer-cell">
                    ${cart.customer_image ? `<img src="${cart.customer_image}" class="customer-img" alt="صورة العميل">` : ''}
                    <div class="customer-info">
                        <span class="customer-name">${cart.customer_name || 'غير معروف'}</span>
                        ${cart.customer_phone ? `<span class="customer-phone">${cart.customer_phone}</span>` : ''}
                    </div>
                </td>
                <td><a href="#" class="checkout-link" target="_blank">إكمال الشراء</a></td>
                <td>${timeSince(cart.last_sync_at)}</td>
                <td>${createdAt.toLocaleTimeString('ar-SA')}</td>
                <td>${ageInHours} ساعة</td>
                <td>${cart.products_count} منتج</td>
                <td>${cart.total.toFixed(2)} ر.س</td>
                <td><span class="status-badge status-${cart.status}">${getStatusText(cart.status)}</span></td>
                <td>لا</td>
                <td>
                    <button class="action-button" onclick="sendTestReminder('${cart.id}')">
                        <i class="fas fa-paper-plane"></i> إرسال تذكير
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        setupCheckboxes();
        
    } catch (error) {
        console.error('خطأ في الوضع التجريبي:', error);
        tbody.innerHTML = '<tr><td colspan="11">فشل التحميل (وضع تجريبي)</td></tr>';
        emptyState.style.display = 'flex';
    }
    // ===== كود تجريبي - نهاية =====

    /* ===== الكود الأصلي - مؤقتاً معطل =====
    const token = localStorage.getItem('authToken');
    const merchantId = document.getElementById('store-select').value;

    if (!token) {
        showError('يجب تسجيل الدخول أولاً');
        window.location.href = 'login.html';
        return;
    }

    if (!merchantId) {
        showError('يرجى اختيار متجر أولاً');
        tbody.innerHTML = '';
        emptyState.style.display = 'flex';
        selectedActions.style.display = 'none';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="11">جار التحميل...</td></tr>';

    try {
        console.log(`Fetching abandoned carts for merchant_id: ${merchantId}`);
        const response = await fetch(`/api/dashboard/abandoned-carts?merchant_id=${merchantId}`, { 
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch abandoned carts, status:', response.status, 'statusText:', response.statusText);
            if (response.status === 401) {
                showError('غير مخول. يرجى تسجيل الدخول مجددًا.');
                window.location.href = 'login.html';
                return;
            }
            if (response.status === 403) {
                showError('صلاحيات غير كافية. يرجى إعادة ربط المتجر.');
                return;
            }
            if (response.status === 404) {
                showError('السلات المتروكة غير متاحة حاليًا. يرجى التحقق من إعدادات المتجر.');
                tbody.innerHTML = '<tr><td colspan="11">لا توجد سلات متروكة متاحة</td></tr>';
                emptyState.style.display = 'flex';
                selectedActions.style.display = 'none';
                return;
            }
            throw new Error(`فشل جلب السلات المتروكة: ${response.statusText}`);
        }

        const { success, data, message } = await response.json();
        console.log('Abandoned carts API response:', { success, data, message });

        if (!success) {
            throw new Error(message || 'فشل جلب السلات المتروكة');
        }

        allCarts = data || [];
        const filteredCarts = searchQuery
            ? allCarts.filter(cart =>
                  (cart.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  cart.cart_id?.toLowerCase().includes(searchQuery.toLowerCase()))
              )
            : allCarts;

        tbody.innerHTML = '';
        if (filteredCarts.length === 0) {
            emptyState.style.display = 'flex';
            selectedActions.style.display = 'none';
            tbody.innerHTML = '<tr><td colspan="11">لا توجد سلات متروكة في الوقت الحالي</td></tr>';
            return;
        }

        emptyState.style.display = 'none';
        selectedActions.style.display = 'none';
        filteredCarts.forEach(cart => {
            const row = document.createElement('tr');
            const createdAt = new Date(cart.created_at);
            const ageInHours = Math.floor((new Date() - createdAt) / (1000 * 60 * 60));
            row.innerHTML = `
                <td><input type="checkbox" class="cart-checkbox" data-id="${cart.id}"></td>
                <td class="customer-cell">
                    ${cart.customer_image ? `<img src="${cart.customer_image}" class="customer-img" alt="صورة العميل">` : ''}
                    <div class="customer-info">
                        <span class="customer-name">${cart.customer_name || 'غير معروف'}</span>
                        ${cart.customer_phone ? `<span class="customer-phone">${cart.customer_phone}</span>` : ''}
                    </div>
                </td>
                <td><a href="https://salla.sa/checkout/${cart.cart_id}" class="checkout-link" target="_blank">إكمال الشراء</a></td>
                <td>${cart.last_sync_at ? timeSince(cart.last_sync_at) : 'غير معروف'}</td>
                <td>${createdAt.toLocaleTimeString('ar-SA')}</td>
                <td>${ageInHours} ساعة</td>
                <td>${cart.products_count} منتج</td>
                <td>${cart.total.toFixed(2)} ر.س</td>
                <td><span class="status-badge status-${cart.status}">${getStatusText(cart.status)}</span></td>
                <td>${cart.status === 'recovered' ? 'نعم' : 'لا'}</td>
                <td>
                    <button class="action-button" onclick="sendReminder('${cart.id}', '${cart.customer_phone}', '${cart.cart_id}')">
                        <i class="fas fa-paper-plane"></i> إرسال تذكير
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        setupCheckboxes();
    } catch (error) {
        console.error('خطأ في جلب السلات:', error);
        showError(error.message || 'حدث خطأ أثناء جلب السلات المتروكة. يرجى المحاولة لاحقًا.');
        tbody.innerHTML = '<tr><td colspan="11">فشل التحميل</td></tr>';
        emptyState.style.display = 'flex';
        selectedActions.style.display = 'none';
    }
    ===== نهاية الكود الأصلي ===== */
}

// دالة مساعدة للوضع التجريبي
function sendTestReminder(cartId) {
    showSuccess(`تم إرسال تذكير تجريبي للسلة ${cartId}`);
}

// إعداد مربعات الاختيار
function setupCheckboxes() {
    const selectAll = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('.cart-checkbox');
    const selectedActions = document.getElementById('selected-actions');
    const selectedCount = document.getElementById('selected-count');

    selectAll.addEventListener('change', () => {
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll.checked;
        });
        updateSelectedActions();
    });

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            selectAll.checked = allChecked;
            updateSelectedActions();
        });
    });

    function updateSelectedActions() {
        const selectedCheckboxes = document.querySelectorAll('.cart-checkbox:checked');
        const count = selectedCheckboxes.length;
        selectedCount.textContent = `تم تحديد ${count} ${count === 1 ? 'عميل' : 'عملاء'}`;
        selectedActions.style.display = count > 0 ? 'block' : 'none';
        document.getElementById('actions-menu').style.display = 'none';
    }
}

// إظهار/إخفاء قائمة الإجراءات
function toggleActionsMenu() {
    const menu = document.getElementById('actions-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// البحث في السلات
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        loadAbandonedCarts(searchInput.value.trim());
    });
}

// مزامنة السلات المتروكة
async function syncAbandonedCarts() {
    const token = localStorage.getItem('authToken');
    const merchantId = document.getElementById('store-select').value;

    if (!token) {
        showError('يجب تسجيل الدخول أولاً');
        window.location.href = 'login.html';
        return;
    }

    if (!merchantId) {
        showError('يرجى اختيار متجر أولاً');
        return;
    }

    try {
        const response = await fetch('/api/dashboard/abandoned-carts/sync', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ merchant_id: merchantId })
        });

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'فشل جلب السلات المحلية');
        }

        showSuccess(`تم جلب ${data.data.updatedCount} سلة محلية بنجاح`);
        loadAbandonedCarts(); // إعادة تحميل البيانات
        
    } catch (error) {
        console.error('خطأ في المزامنة:', error);
        showError(error.message || 'حدث خطأ أثناء جلب السلات المحلية');
    }
}

// إرسال تذكير فردي
async function sendReminder(cartId, phone, cartIdStr) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showError('يجب تسجيل الدخول أولاً');
        window.location.href = 'login.html';
        return;
    }

    if (!phone) {
        showError('رقم الهاتف غير متوفر لهذه السلة.');
        return;
    }

    try {
        const response = await fetch('/api/dashboard/abandoned-carts/reminder', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cart_id: cartId, phone, cart_id_str: cartIdStr })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'فشل إرسال التذكير');
        }

        showSuccess(`تم إرسال تذكير للسلة ${cartIdStr} بنجاح`);
    } catch (error) {
        console.error('خطأ في إرسال التذكير:', error);
        showError(error.message || 'حدث خطأ أثناء إرسال التذكير');
    }
}

// إرسال تذكيرات جماعية
async function sendBulkReminders() {
    const selectedCheckboxes = document.querySelectorAll('.cart-checkbox:checked');
    const token = localStorage.getItem('authToken');
    if (!token) {
        showError('يجب تسجيل الدخول أولاً');
        window.location.href = 'login.html';
        return;
    }

    if (selectedCheckboxes.length === 0) {
        showError('لم يتم تحديد أي عملاء');
        return;
    }

    try {
        const selectedCarts = Array.from(selectedCheckboxes).map(cb => {
            const cart = allCarts.find(c => c.id == cb.dataset.id);
            return { id: cart.id, phone: cart.customer_phone, cart_id: cart.cart_id };
        });

        const response = await fetch('/api/dashboard/abandoned-carts/bulk-reminders', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ carts: selectedCarts })
        });

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'فشل إرسال التذكيرات');
        }

        showSuccess(`تم إرسال تذكيرات لـ ${selectedCarts.length} عملاء بنجاح`);
        document.getElementById('actions-menu').style.display = 'none';
    } catch (error) {
        console.error('خطأ في إرسال التذكيرات:', error);
        showError(error.message || 'حدث خطأ أثناء إرسال التذكيرات');
    }
}

// تصدير إلى Excel
function exportToExcel() {
    const selectedCheckboxes = document.querySelectorAll('.cart-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        showError('لم يتم تحديد أي سلات للتصدير');
        return;
    }

    const selectedCarts = Array.from(selectedCheckboxes).map(cb => {
        const cart = allCarts.find(c => c.id == cb.dataset.id);
        return {
            'رقم السلة': cart.cart_id,
            'اسم العميل': cart.customer_name || 'غير معروف',
            'الهاتف': cart.customer_phone || 'غير متوفر',
            'الإجمالي': cart.total,
            'عدد المنتجات': cart.products_count,
            'الحالة': getStatusText(cart.status),
            'تاريخ الإنشاء': new Date(cart.created_at).toLocaleString('ar-SA')
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(selectedCarts);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'السلات المتروكة');
    XLSX.writeFile(workbook, 'السلات_المتروكة.xlsx');
}

// حذف السلات المحددة
async function deleteSelected() {
    const selectedCheckboxes = document.querySelectorAll('.cart-checkbox:checked');
    const token = localStorage.getItem('authToken');
    
    if (selectedCheckboxes.length === 0) {
        showError('لم يتم تحديد أي سلات للحذف');
        return;
    }

    if (!confirm('هل أنت متأكد من حذف السلات المحددة؟')) return;

    try {
        const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
        
        const response = await fetch('/api/abandoned-carts/delete', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cart_ids: selectedIds })
        });

        const result = await response.json();
        
        if (!result.success) throw new Error(result.message);
        
        showSuccess(`تم حذف ${selectedIds.length} سلة بنجاح`);
        loadAbandonedCarts(); // إعادة تحميل البيانات
    } catch (error) {
        showError(`فشل الحذف: ${error.message}`);
    }
}

// تهيئة الصفحة
window.addEventListener('load', () => {
    loadStores();
    setupSearch();
});