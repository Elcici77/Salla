document.addEventListener('DOMContentLoaded', () => {
    const showAlert = (message, type = 'danger') => {
        const alertContainer = document.createElement('div');
        alertContainer.className = `alert alert-${type} alert-dismissible fade show cust-alert`;
        alertContainer.style.position = 'fixed';
        alertContainer.style.top = '20px';
        alertContainer.style.right = '20px';
        alertContainer.style.zIndex = '1050';
        alertContainer.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
        document.body.appendChild(alertContainer);
        setTimeout(() => alertContainer.remove(), 5000);
    };

    const getAuthToken = () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('يرجى تسجيل الدخول أولاً', 'warning');
            setTimeout(() => window.location.href = '/login.html', 2000);
            return null;
        }
        return token;
    };

    // Load blacklist settings
    const loadBlacklistSettings = async () => {
        const token = getAuthToken();
        if (!token) return;
        try {
            const response = await fetch('/api/blacklist/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('فشل جلب إعدادات الإلغاء');
            const data = await response.json();
            if (data.success) {
                document.getElementById('unsubscribe-keywords').value = data.data.keywords || '';
                document.getElementById('unsubscribe-message').value = data.data.unsubscribe_message || '';
            }
        } catch (error) {
            console.error('Error loading blacklist settings:', error);
            showAlert('حدث خطأ أثناء جلب إعدادات الإلغاء: ' + error.message);
        }
    };

    // Save unsubscribe settings
    document.getElementById('save-unsubscribe-settings').addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;
        const keywords = document.getElementById('unsubscribe-keywords').value.trim();
        const message = document.getElementById('unsubscribe-message').value.trim();
        if (!keywords || !message) {
            showAlert('يرجى ملء جميع الحقول');
            return;
        }
        try {
            const response = await fetch('/api/blacklist/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ keywords, unsubscribe_message: message })
            });
            if (!response.ok) throw new Error('فشل حفظ الإعدادات');
            showAlert('تم حفظ الإعدادات بنجاح', 'success');
        } catch (error) {
            console.error('Error saving unsubscribe settings:', error);
            showAlert('حدث خطأ أثناء حفظ الإعدادات: ' + error.message);
        }
    });

    // Load blacklist numbers
    const loadBlacklistNumbers = async () => {
        const token = getAuthToken();
        if (!token) return;
        try {
            const response = await fetch('/api/blacklist/numbers', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('فشل جلب القائمة السوداء');
            const data = await response.json();
            const container = document.getElementById('blacklist-numbers-container');
            container.innerHTML = '';
            if (data.success && data.data.length > 0) {
                data.data.forEach(number => {
                    const div = document.createElement('div');
                    div.className = 'blacklist-number';
                    div.innerHTML = `
                        <span>${number.phone_number}</span>
                        <i class="fas fa-trash delete-icon" data-id="${number.id}"></i>
                    `;
                    container.appendChild(div);
                });
            } else {
                container.innerHTML = '<p class="text-center">لا توجد أرقام محظورة حاليًا</p>';
            }
        } catch (error) {
            console.error('Error loading blacklist numbers:', error);
            showAlert('حدث خطأ أثناء جلب القائمة السوداء: ' + error.message);
        }
    };

    // Save new number via Modal
    document.getElementById('save-new-number').addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;
        let phoneInput = document.getElementById('new-phone-number').value.trim();

        // Add default country code if not provided
        if (!phoneInput.startsWith('+') && !phoneInput.startsWith('00')) {
            phoneInput = `+20${phoneInput}`; // Default to Egypt (+20)
        }

        // Basic client-side validation
        if (!phoneInput || !/^\+?\d{10,15}$/.test(phoneInput.replace(/\D/g, ''))) {
            showAlert('يرجى إدخال رقم هاتف صالح (10-15 رقمًا مع رمز الدولة، مثال: +201234567890)', 'danger');
            return;
        }

        try {
            const response = await fetch('/api/blacklist/numbers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ phone_number: phoneInput })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل إضافة الرقم');
            }
            showAlert('تم إضافة الرقم بنجاح', 'success');
            document.getElementById('addNumberModal').querySelector('.btn-close').click();
            loadBlacklistNumbers();
        } catch (error) {
            console.error('Error adding blacklist number:', error);
            showAlert('حدث خطأ أثناء إضافة الرقم: ' + error.message);
        }
    });

    // Delete blacklist number
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-icon')) {
            const id = e.target.dataset.id;
            if (confirm('هل أنت متأكد من حذف هذا الرقم؟')) {
                deleteBlacklistNumber(id);
            }
        }
    });

    const deleteBlacklistNumber = async (id) => {
        const token = getAuthToken();
        if (!token) return;
        try {
            const response = await fetch(`/api/blacklist/numbers/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('فشل حذف الرقم');
            showAlert('تم حذف الرقم بنجاح', 'success');
            loadBlacklistNumbers();
        } catch (error) {
            console.error('Error deleting blacklist number:', error);
            showAlert('حدث خطأ أثناء حذف الرقم: ' + error.message);
        }
    };

    // Initial load
    loadBlacklistSettings();
    loadBlacklistNumbers();
});