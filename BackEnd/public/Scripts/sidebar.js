document.addEventListener('DOMContentLoaded', () => {
    const badge = document.querySelector('.sidebar-item[href="whatsapp-qr.html"] .badge');
    
    // دالة لتحديث حالة الاتصال
    async function updateWhatsAppStatus() {
        if (!badge) {
            console.warn('WhatsApp badge not found in sidebar');
            return;
        }

        // تعيين حالة التحميل
        badge.textContent = 'جارٍ التحقق...';
        badge.className = 'badge badge-disconnected';

        try {
            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                throw new Error('لم يتم العثور على رمز المصادقة');
            }

            const response = await axios.get('/api/whatsapp/get-current-status', {
                headers: { Authorization: `Bearer ${authToken}` },
                timeout: 5000
            });
            console.log('Sidebar WhatsApp Status Response:', JSON.stringify(response.data, null, 2));

            if (response.data.success && response.data.connected && response.data.phone) {
                badge.textContent = `متصل: ${response.data.phone}`;
                badge.className = 'badge badge-connected';
            } else {
                badge.textContent = 'غير متصل';
                badge.className = 'badge badge-disconnected';
            }
        } catch (error) {
            console.error('Failed to update WhatsApp status in sidebar:', {
                message: error.message,
                response: error.response?.data
            });
            badge.textContent = 'غير متصل';
            badge.className = 'badge badge-disconnected';
        }
    }

    // تشغيل التحقق عند تحميل الصفحة إذا كان هناك رمز مصادقة
    const token = localStorage.getItem('authToken');
    if (token) {
        updateWhatsAppStatus();
    }

    // الاستماع إلى حدث تغيير حالة الواتساب
    window.addEventListener('whatsappStatusChanged', () => {
        console.log('WhatsApp status changed event received');
        if (localStorage.getItem('authToken')) {
            updateWhatsAppStatus();
        }
    });
});