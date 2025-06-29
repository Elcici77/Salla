document.addEventListener('DOMContentLoaded', async () => {
    // 1. إخفاء بطاقة الترحيب بعد 5 ثوان
    setTimeout(() => {
        const welcomeCard = document.querySelector('.welcome-card');
        if (welcomeCard) welcomeCard.style.display = 'none';
    }, 5000);

    // 2. تهيئة القائمة المنسدلة للمتاجر
    await initStoreSelect();

    // 3. تحميل البيانات الافتراضية
    const storeSelect = document.getElementById('store-select');
    const merchantId = storeSelect && storeSelect.value ? storeSelect.value : '';
    await loadDashboardData('30d', merchantId);

    // 4. إعداد معالج أحداث للأزرار
    setupEventListeners();

    checkVisibility();

});

// دالة لإعداد معالجي الأحداث
function setupEventListeners() {
    // زر التحديث اليدوي
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const storeSelect = document.getElementById('store-select');
            const merchantId = storeSelect ? storeSelect.value : '';
            await loadDashboardData('30d', merchantId);
        });
    }

    // أزرار اختيار الفترة
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const storeSelect = document.getElementById('store-select');
            const merchantId = storeSelect ? storeSelect.value : '';
            await loadDashboardData(this.dataset.period, merchantId);
        });
    });

    // زر مزامنة العملاء
    const syncCustomersBtn = document.getElementById('syncCustomers');
    if (syncCustomersBtn) {
        syncCustomersBtn.addEventListener('click', async () => {
            const storeSelect = document.getElementById('store-select');
            const merchantId = storeSelect ? storeSelect.value : '';
            await syncCustomers(merchantId);
        });
    }

    // زر تحديث العملاء
    const refreshCustomersBtn = document.getElementById('refreshCustomers');
    if (refreshCustomersBtn) {
        refreshCustomersBtn.addEventListener('click', async () => {
            const storeSelect = document.getElementById('store-select');
            const merchantId = storeSelect ? storeSelect.value : '';
            await updateCustomersTable(merchantId);
        });
    }
}

// دالة لتهيئة القائمة المنسدلة للمتاجر
async function initStoreSelect() {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No authentication token found for fetching stores');
            showNotification('يرجى تسجيل الدخول مرة أخرى', 'error');
            window.location.href = '/login.html';
            return;
        }

        const response = await fetchWithRetry('/api/salla/stores', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });


        const rawResponse = await response.text();

        let result;
        try {
            result = rawResponse ? JSON.parse(rawResponse) : { success: false, message: 'استجابة فارغة من الخادم' };
        } catch (jsonError) {
            console.error('Failed to parse /api/salla/stores response:', {
                message: jsonError.message,
                stack: jsonError.stack,
                rawResponse: rawResponse || '[empty]'
            });
            showNotification('استجابة غير صالحة من الخادم', 'error');
            return;
        }

        if (!response.ok) {
            if (response.status === 401) {
                console.log('Token expired, attempting to refresh...');
                await refreshToken();
                return initStoreSelect(); // إعادة المحاولة بعد تجديد التوكن
            }
            showNotification(result.message || `خطأ في جلب المتاجر: ${response.status}`, 'error');
            return;
        }

        if (!result.success || !result.stores) {
            console.warn('Stores fetch not successful:', result);
            showNotification('فشل في جلب قائمة المتاجر. تحقق من ربط المتجر.', 'error');
            return;
        }

        const storeSelect = document.getElementById('store-select');
        if (!storeSelect) {
            console.error('Store select element not found in DOM');
            showNotification('خطأ في واجهة المستخدم: قائمة المتاجر غير موجودة', 'error');
            return;
        }

        storeSelect.innerHTML = '<option value="">اختر متجرًا</option>';
        if (Array.isArray(result.stores) && result.stores.length > 0) {
            result.stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.merchant_id;
                option.textContent = store.shop_name || 'متجر بدون اسم';
                storeSelect.appendChild(option);
            });

            // تحميل البيانات للمتجر الأول تلقائيًا
            storeSelect.value = result.stores[0].merchant_id;
            await syncCustomers(result.stores[0].merchant_id);
            await loadDashboardData('30d', result.stores[0].merchant_id);
        } else {
            showNotification('لا توجد متاجر مربوطة. يرجى ربط متجر جديد.', 'warning');
        }

        // تهيئة Select2
        $(storeSelect).select2({
            placeholder: 'اختر متجرًا',
            allowClear: true,
            width: '100%'
        });

        // تحديث البيانات عند اختيار متجر مع مزامنة تلقائية
        storeSelect.addEventListener('change', async () => {
            const merchantId = storeSelect.value;
            if (merchantId) {
                showLoading(true);
                await syncCustomers(merchantId);
                await loadDashboardData('30d', merchantId);
                await updateCustomersTable(merchantId);
                showLoading(false);
            }
        });

    } catch (error) {
        console.error('Error initializing store select:', {
            message: error.message,
            stack: error.stack
        });
        showNotification(`خطأ في تحميل قائمة المتاجر: ${error.message}`, 'error');
    }
}

// دالة رئيسية لجلب وعرض البيانات
async function loadDashboardData(period = '30d', merchantId = '') {
    try {
        showLoading(true);
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No authentication token found');
            showNotification('يرجى تسجيل الدخول مرة أخرى', 'error');
            window.location.href = '/login.html';
            return;
        }

        // جلب بيانات الـ dashboard
        const url = `/api/dashboard?period=${period}${merchantId ? `&merchant_id=${merchantId}` : ''}`;
        const dashboardResponse = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });


        let data = {};
        if (dashboardResponse.ok) {
            data = await dashboardResponse.json();
        } else {
            if (dashboardResponse.status === 401) {
                await refreshToken();
                return loadDashboardData(period, merchantId); // إعادة المحاولة بعد تجديد التوكن
            }
            const errorData = await dashboardResponse.json();
            console.warn('Dashboard fetch failed:', errorData);
            data = { success: false, message: errorData.message || `HTTP error: ${dashboardResponse.status}` };
        }

        if (data.success) {
            updateStoreInfo(data.store_name || 'لا يوجد متجر مربوط');
            updateDashboardUI(data);
        } else {
            console.error('Dashboard data not successful:', data);
            showNotification(data.message || 'فشل في تحميل بيانات لوحة التحكم. حاول مرة أخرى.', 'error');
        }

        // جلب العملاء دائمًا، حتى لو فشل /api/dashboard
        await updateCustomersTable(merchantId);

    } catch (error) {
        console.error('Dashboard load error:', {
            message: error.message,
            stack: error.stack
        });
        showNotification(`خطأ في تحميل البيانات: ${error.message}`, 'error');
        // محاولة جلب العملاء حتى في حالة الخطأ
        await updateCustomersTable(merchantId);
    } finally {
        showLoading(false);
    }
}

// دالة لجلب البيانات من الخادم
async function fetchDashboardData(period, merchantId = '') {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            throw new Error('No authentication token found');
        }

        const url = `/api/dashboard?period=${period}${merchantId ? `&merchant_id=${merchantId}` : ''}`;
        const response = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                await refreshToken();
                return fetchDashboardData(period, merchantId); // إعادة المحاولة بعد تجديد التوكن
            }
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Fetch dashboard data error:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// دالة لتحديث واجهة المستخدم بالبيانات الجديدة
function updateDashboardUI(data, merchantId = '') {
    if (!data) {
        console.error('No data provided to updateDashboardUI');
        showNotification('لا توجد بيانات لتحديث واجهة المستخدم', 'error');
        return;
    }

    // تحديث البطاقات الإحصائية
    updateStatsCards(data.stats || {});

    // تحديث الرسم البياني
    updateChart(data.chartData || { labels: [], values: [] });

    // تحديث جدول السلات المتروكة
    updateTopCartsTable(data.recent_carts || []);

    // تحديث جدول العملاء
    updateTopCustomersTable(merchantId);

    // تحديث وقت آخر مزامنة
    updateLastSyncTime();
}

// دالة لتحديث البطاقات الإحصائية
function updateStatsCards(stats) {
    console.log('Elements check:', {
        abandonedCarts: document.getElementById('abandonedCarts'),
        conversions: document.getElementById('conversions')
    });
    console.log("Received stats data:", stats); // تسجيل مفصل للبيانات الواردة
    
    if (!stats || typeof stats !== 'object') {
        console.error('Invalid stats data:', stats);
        showNotification('بيانات الإحصائيات غير صالحة', 'error');
        return;
    }

    // 1. تحديث بطاقة إجمالي قيمة السلات المتروكة
    const abandonedCartsElement = document.getElementById('abandonedCarts');
    if (abandonedCartsElement) {
        const cartsValue = parseFloat(stats.carts_value) || 0;
        abandonedCartsElement.textContent = formatCurrency(cartsValue);
        console.log(`Updated abandoned carts value: ${cartsValue}`);

        // تحديث مؤشر الاتجاه (سيتم تحسينه لاحقاً)
        updateTrendIndicator(
            abandonedCartsElement, 
            cartsValue,
            'abandoned_carts_trend'
        );
    }

    // 2. تحديث بطاقة التحويلات الناجحة
    const conversionsElement = document.getElementById('conversions');
    if (conversionsElement) {
        const conversionsCount = parseInt(stats.conversions) || 0;
        conversionsElement.textContent = conversionsCount;
        console.log(`Updated conversions count: ${conversionsCount}`);

        // تحديث مؤشر الاتجاه
        updateTrendIndicator(
            conversionsElement,
            conversionsCount,
            'conversions_trend'
        );
    }

    // دالة مساعدة لتحديث مؤشرات الاتجاه
    function updateTrendIndicator(element, currentValue, storageKey) {
        const trendElement = element?.nextElementSibling?.nextElementSibling;
        if (!trendElement) return;

        // جلب القيمة السابقة من localStorage
        const previousValue = parseFloat(localStorage.getItem(storageKey)) || 0;
        
        // حساب النسبة المئوية للتغير
        let percentage = 0;
        if (previousValue > 0) {
            percentage = ((currentValue - previousValue) / previousValue) * 100;
        }

        // تحديث العرض
        if (percentage > 0) {
            trendElement.innerHTML = `<i class="fas fa-arrow-up"></i> ${Math.round(percentage)}%`;
            trendElement.classList.add('up');
            trendElement.classList.remove('down');
        } else if (percentage < 0) {
            trendElement.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.round(Math.abs(percentage))}%`;
            trendElement.classList.add('down');
            trendElement.classList.remove('up');
        } else {
            trendElement.innerHTML = `<i class="fas fa-minus"></i> 0%`;
            trendElement.classList.remove('up', 'down');
        }

        // حفظ القيمة الحالية للمقارنة لاحقاً
        localStorage.setItem(storageKey, currentValue);
    }
}

// دالة لتحديث الرسم البياني
function updateChart(chartData) {
    if (!chartData || !chartData.labels || !chartData.values || !Array.isArray(chartData.labels) || !Array.isArray(chartData.values)) {
        console.error('Invalid or missing chart data:', chartData);
        showNotification('لا توجد بيانات صالحة لتحديث الرسم البياني', 'error');
        return;
    }

    const ctx = document.getElementById('abandonedCartsChart')?.getContext('2d');
    if (!ctx) {
        console.error('Chart canvas element not found');
        showNotification('خطأ في العثور على عنصر الرسم البياني', 'error');
        return;
    }

    if (!window.abandonedCartsChart) {
        console.log('Initializing new chart instance');
        window.abandonedCartsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'قيمة السلات المتروكة',
                    data: chartData.values,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return formatCurrency(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    } else {
        console.log('Updating existing chart with new data');
        window.abandonedCartsChart.data.labels = chartData.labels;
        window.abandonedCartsChart.data.datasets[0].data = chartData.values;
        window.abandonedCartsChart.update();
    }
}

function updateStoreInfo(storeName) {
    const welcomeCard = document.querySelector('.welcome-card');
    if (welcomeCard) {
        welcomeCard.innerHTML = `
            <h1>مرحبًا بك في ${storeName || 'متجرك'}</h1>
            <p>يمكنك متابعة أداء متجرك من هنا</p>
        `;
    } else {
        console.warn('Welcome card element not found in DOM');
    }
}


// إعدادات الرسم البياني
function getChartOptions() {
    return {
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return formatCurrency(context.raw);
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatCurrency(value);
                    }
                }
            }
        }
    };
}

// دالة لتحديث جدول السلات المتروكة
function updateTopCartsTable(carts) {
    const tbody = document.getElementById('topCartsTable');
    if (!tbody) {
        console.error('Top carts table body not found');
        showNotification('خطأ في تحديث جدول السلات المتروكة: الجدول غير موجود', 'error');
        return;
    }

    tbody.innerHTML = '';

    if (!carts || !Array.isArray(carts) || carts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد بيانات للسلات المتروكة</td></tr>';
        console.log('No cart data available to display');
        return;
    }

    carts.slice(0, 5).forEach(cart => {
        try {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="customer-cell">
                    <div class="customer-info">
                        <div class="customer-name">${cart.customer_name || 'زائر'}</div>
                        ${cart.customer_phone ? `<div class="customer-phone">${cart.customer_phone}</div>` : ''}
                    </div>
                </td>
                <td>${formatDate(cart.created_at) || 'غير معروف'}</td>
                <td>${getCartAge(cart.created_at) || 'غير معروف'}</td>
                <td>${cart.products_count || 0} منتجات</td>
                <td>${formatCurrency(cart.total || 0)}</td>
                <td><span class="status-badge ${cart.status || 'pending'}">${getStatusText(cart.status || 'pending')}</span></td>
            `;
            tbody.appendChild(row);
        } catch (error) {
            console.error('Error rendering cart row:', {
                cart,
                message: error.message,
                stack: error.stack
            });
        }
    });
}

async function updateTopCustomersTable(merchantId = '') {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No authentication token found');
            showNotification('يرجى تسجيل الدخول مرة أخرى', 'error');
            window.location.href = '/login.html';
            return;
        }

        const tbody = document.getElementById('topCustomersTable');
        if (!tbody) {
            console.error('Top customers table body not found');
            showNotification('خطأ في تحديث جدول العملاء: الجدول غير موجود', 'error');
            return;
        }

        tbody.innerHTML = '';

        const url = `/api/dashboard/top-customers${merchantId ? `?merchant_id=${merchantId}` : ''}`;
        const response = await fetchWithRetry(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                console.log('Token expired, attempting to refresh...');
                await refreshToken();
                return updateTopCustomersTable(merchantId);
            }
            console.error('Failed to fetch top customers:', data);
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">خطأ في جلب بيانات العملاء</td></tr>';
            showNotification(data.message || `خطأ في جلب العملاء: ${response.status}`, 'error');
            return;
        }

        if (!data.success || !data.customers || !Array.isArray(data.customers) || data.customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">لا توجد بيانات للعملاء</td></tr>';
            console.log('No top customers data available to display');
            return;
        }

        data.customers.slice(0, 5).forEach(customer => {
            try {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="customer-cell">
                        <div class="customer-info">
                            <div class="customer-name">${customer.name || 'زائر'}</div>
                        </div>
                    </td>
                    <td>${customer.mobile || 'غير متوفر'}</td>
                    <td>${customer.cart_count || 0} سلات</td>
                `;
                tbody.appendChild(row);
            } catch (error) {
                console.error('Error rendering customer row:', {
                    customer,
                    message: error.message,
                    stack: error.stack
                });
            }
        });
    } catch (error) {
        console.error('Failed to update top customers table:', {
            message: error.message,
            stack: error.stack
        });
        const tbody = document.getElementById('topCustomersTable');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">خطأ في تحميل بيانات العملاء</td></tr>';
        }
        showNotification(`فشل في تحميل بيانات العملاء: ${error.message}`, 'error');
    }
}

// دالة لتحديث جدول العملاء
async function updateCustomersTable(merchantId = '') {
    try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            console.error('No auth token for customers fetch');
            showNotification('يرجى تسجيل الدخول مرة أخرى', 'error');
            window.location.href = '/login.html';
            return;
        }

        const table = document.getElementById('customersTable');
        const tableBody = table ? table.querySelector('tbody') : null;
        if (!table || !tableBody) {
            console.error('Customers table or tbody not found in DOM', {
                tableExists: !!table,
                tableBodyExists: !!tableBody
            });
            showNotification('خطأ في واجهة المستخدم: جدول العملاء غير موجود', 'error');
            return;
        }

        const response = await fetchWithRetry(`/api/dashboard/customers${merchantId ? `?merchant_id=${merchantId}` : ''}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });


        const rawResponse = await response.text();
        console.log('Raw response from /api/dashboard/customers:', rawResponse || '[empty response]');

        let data;
        try {
            data = rawResponse ? JSON.parse(rawResponse) : { success: false, message: 'استجابة فارغة من الخادم' };
        } catch (jsonError) {
            console.error('Failed to parse /api/dashboard/customers response as JSON:', {
                message: jsonError.message,
                stack: jsonError.stack,
                rawResponse: rawResponse || '[empty]',
                status: response.status,
                statusText: response.statusText
            });
            showNotification(`استجابة غير صالحة من الخادم`, 'error');
            return;
        }

        if (!response.ok) {
            if (response.status === 401) {
                console.log('Token expired, attempting to refresh...');
                await refreshToken();
                return updateCustomersTable(merchantId);
            }
            showNotification(data.message || `خطأ في جلب العملاء: ${response.status}`, 'error');
            return;
        }

        tableBody.innerHTML = '';

        if (!data.success) {
            console.error('API response not successful:', data);
            tableBody.innerHTML = '<tr><td colspan="6">فشل في جلب بيانات العملاء</td></tr>';
            showNotification(data.message || 'فشل في جلب بيانات العملاء', 'error');
            return;
        }

        if (!data.customers || !Array.isArray(data.customers) || data.customers.length === 0) {
            console.log('No customers returned from /api/dashboard/customers');
            tableBody.innerHTML = '<tr><td colspan="6">لا يوجد عملاء لعرضهم</td></tr>';
            return;
        }

        data.customers.forEach((customer, index) => {
            try {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${customer.name || 'غير متوفر'}</td>
                    <td>${customer.mobile || 'غير متوفر'}</td>
                    <td>${customer.email || 'غير متوفر'}</td>
                    <td>${customer.total_orders || 0}</td>
                    <td>${formatCurrency(customer.total_spent || 0)}</td>
                    <td>${formatDate(customer.last_order_date) || 'غير متوفر'}</td>
                `;
                tableBody.appendChild(row);
            } catch (rowError) {
                console.error(`Failed to render customer ${index + 1}:`, {
                    customer,
                    message: rowError.message,
                    stack: rowError.stack
                });
            }
        });

    } catch (error) {
        console.error('Failed to update customers table:', {
            message: error.message,
            stack: error.stack
        });
        const tableBody = document.querySelector('#customersTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6">خطأ في تحميل بيانات العملاء</td></tr>';
        }
        showNotification(`فشل في تحميل بيانات العملاء: ${error.message}`, 'error');
    }
}

// دالة لمزامنة العملاء
async function syncCustomers(merchantId = '') {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token for sync customers');
        showNotification('يجب تسجيل الدخول أولاً', 'error');
        window.location.href = '/login.html';
        return;
    }
    if (!merchantId) {
        showNotification('يرجى اختيار متجر أولاً', 'error');
        return;
    }

    try {
        const btn = document.getElementById('syncCustomers');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المزامنة...';
        }

        const response = await fetchWithRetry('/api/salla/sync-customers', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ merchant_id: merchantId })
        });


        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                console.log('Token expired, attempting to refresh...');
                await refreshToken();
                return syncCustomers(merchantId); // إعادة المحاولة بعد تجديد التوكن
            } else if (response.status === 400 || response.status === 404) {
                throw new Error(data.message || 'خطأ في إعداد المتجر. يرجى إعادة ربط المتجر.');
            }
            throw new Error(data.message || `HTTP error: ${response.status}`);
        }

        if (data.action === 'reconnect') {
            console.log('Reconnect required:', data.message);
            showNotification(data.message + ' يرجى إعادة ربط المتجر.', 'error');
            setTimeout(() => {
                window.location.href = '/dashboard.html?reconnect=1';
            }, 3000);
            return;
        }

        if (data.success) {
            showNotification(`تم مزامنة ${data.count || 'العديد من'} عميل بنجاح`, 'success');
            await updateCustomersTable(merchantId);
            await loadDashboardData('30d', merchantId); // تحديث جميع بيانات الصفحة بعد المزامنة
        } else {
            throw new Error(data.message || 'فشل في مزامنة العملاء');
        }
    } catch (error) {
        console.error('Sync customers error:', {
            message: error.message,
            stack: error.stack
        });
        showNotification(error.message, 'error');
    } finally {
        const btn = document.getElementById('syncCustomers');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> مزامنة العملاء';
        }
    }
}

// دالة لتجديد التوكن
async function refreshToken() {
    try {
        console.log('Attempting to refresh token...');
        const response = await fetch('/api/auth/refresh-token', {
            method: 'POST',
            credentials: 'include'
        });


        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        if (data.accessToken) {
            localStorage.setItem('authToken', data.accessToken);
            console.log('Token refreshed successfully');
            return data.accessToken;
        } else {
            throw new Error('No access token returned');
        }
    } catch (error) {
        console.error('Failed to refresh token:', {
            message: error.message,
            stack: error.stack
        });
        showNotification('فشل في تحديث الجلسة. يرجى تسجيل الدخول مرة أخرى.', 'error');
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
        throw error;
    }
}

// دالة مساعدة لإعادة المحاولة في حالة فشل الشبكة
async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            if (i < retries - 1 && error.message.includes('network error')) {
                console.warn(`Retrying fetch (${i + 1}/${retries}) for ${url}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
}

// ===== الدوال المساعدة ===== //

function showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.style.display = show ? 'block' : 'none';
    }
}

function showNotification(message, type = 'info', duration = 5000) {
    const notificationContainer = document.getElementById('notification-container') || createNotificationContainer();
    const notifications = notificationContainer.querySelectorAll('.notification');
    const notificationCount = notifications.length;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="close-btn">×</button>
    `;

    // تحديد الموضع الأفقي بناءً على عدد الإشعارات الحالية
    const offset = notificationCount * 320; // 300px عرض الإشعار + 20px هامش
    notification.style.position = 'absolute';
    notification.style.right = `${offset}px`;
    notification.style.top = '20px';
    notification.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

    // إضافة الإشعار إلى الحاوية
    notificationContainer.appendChild(notification);

    // إضافة أنماط CSS للإشعار
    notification.style.cssText += `
        background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
        color: white;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 300px;
        margin: 0 10px;
        opacity: 0;
        transform: translateY(-20px);
    `;

    // إظهار الإشعار بأنيميشن
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 100);

    // إغلاق الإشعار عند النقر على زر الإغلاق
    const closeBtn = notification.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => {
        closeNotification(notification);
    });

    // إغلاق الإشعار تلقائيًا بعد المدة المحددة
    setTimeout(() => {
        closeNotification(notification);
    }, duration);

    // دالة لإغلاق الإشعار مع تحديث مواقع الإشعارات المتبقية
    function closeNotification(element) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
                updateNotificationPositions();
            }
        }, 500);
    }

    // دالة لتحديث مواقع الإشعارات المتبقية
    function updateNotificationPositions() {
        const remainingNotifications = notificationContainer.querySelectorAll('.notification');
        remainingNotifications.forEach((notif, index) => {
            notif.style.right = `${index * 320}px`;
        });
    }

    // دالة لإنشاء حاوية الإشعارات إذا لم تكن موجودة
    function createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            flex-direction: row-reverse;
        `;
        document.body.appendChild(container);
        return container;
    }
}

function updateLastSyncTime() {
    const timeEl = document.getElementById('lastUpdated');
    if (timeEl) {
        timeEl.textContent = `آخر تحديث: ${new Date().toLocaleTimeString('ar-SA')}`;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'غير معروف';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'غير معروف';
        return date.toLocaleDateString('ar-SA');
    } catch (error) {
        console.error('Error formatting date:', dateString, error);
        return 'غير معروف';
    }
}

function getCartAge(createdAt) {
    if (!createdAt) return 'غير معروف';
    try {
        const created = new Date(createdAt);
        if (isNaN(created.getTime())) return 'غير معروف';
        const now = new Date();
        const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'أقل من يوم';
        if (diffDays === 1) return 'يوم واحد';
        return `${diffDays} يوم`;
    } catch (error) {
        console.error('Error calculating cart age:', createdAt, error);
        return 'غير معروف';
    }
}

function formatCurrency(value) {
    try {
        return new Intl.NumberFormat('ar-SA', {
            style: 'currency',
            currency: 'SAR',
            minimumFractionDigits: 0
        }).format(value || 0);
    } catch (error) {
        console.error('Error formatting currency:', value, error);
        return '0 ر.س';
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'قيد الانتظار',
        'recovered': 'تم الاسترداد',
        'failed': 'فشل',
        'expired': 'منتهي'
    };
    return statusMap[status] || status;
}

function checkVisibility() {
    const style1 = window.getComputedStyle(document.getElementById('abandonedCarts'));
    const style2 = window.getComputedStyle(document.getElementById('conversions'));
}