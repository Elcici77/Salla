// دالة لتحديث حالة الاتصال
async function updateWhatsAppStatus() {
    const badge = document.querySelector('.sidebar-item[href="whatsapp-qr.html"] .badge');
    
    if (!badge) {
        console.warn('WhatsApp badge not found in sidebar');
        return;
    }

    badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>جارٍ التحقق...';
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

        if (response.data.success && response.data.connected && response.data.phone) {
            badge.innerHTML = '<i class="fa-solid fa-check-circle"></i>متصل';
            badge.className = 'badge badge-connected';
        } else {
            badge.innerHTML = '<i class="fa-solid fa-times-circle"></i>غير متصل';
            badge.className = 'badge badge-disconnected';
        }
    } catch (error) {
        console.error('Failed to update WhatsApp status in sidebar:', {
            message: error.message,
            response: error.response?.data
        });
        badge.innerHTML = '<i class="fa-solid fa-times-circle"></i>غير متصل';
        badge.className = 'badge badge-disconnected';
    }
}

// تشغيل التحديث عند تحميل السكربت
console.log('sidebar.js initialized');
const authToken = localStorage.getItem('authToken');
if (authToken) {
    updateWhatsAppStatus();
}

// الاستماع إلى حدث تغيير حالة الواتساب
window.addEventListener('whatsappStatusChanged', () => {
    console.log('WhatsApp status changed event received');
    if (localStorage.getItem('authToken')) {
        updateWhatsAppStatus();
    }
});

// إعادة التحقق عند تغيير الرؤية
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && localStorage.getItem('authToken')) {
        console.log('Page became visible, checking WhatsApp status');
        updateWhatsAppStatus();
    }
});