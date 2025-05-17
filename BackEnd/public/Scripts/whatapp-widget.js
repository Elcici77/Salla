document.addEventListener('DOMContentLoaded', async () => {
    const whatsappNumberInput = document.getElementById('whatsapp-number');
    const merchantIdSelect = document.getElementById('merchant-id');
    const iconPositionSelect = document.getElementById('icon-position');
    const welcomeMessageInput = document.getElementById('welcome-message');
    const headerInput = document.getElementById('header');
    const iconSizeInput = document.getElementById('icon-size');
    const iconOffsetInput = document.getElementById('icon-offset');
    const iconLogoInput = document.getElementById('icon-logo');
    const livePreview = document.querySelector('.whatsapp-widget-preview');
    const saveSettingsButton = document.getElementById('save-settings');
    const generateCodeButton = document.getElementById('generate-code');
    const codeOutput = document.getElementById('code-output');
    const errorMessage = document.getElementById('error-message');

    // جلب رقم واتساب الأعمال
    async function loadWhatsAppStatus() {
        try {
            const response = await axios.get('/api/whatsapp/get-current-status', {
                headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (response.data.success && response.data.phone) {
                whatsappNumberInput.value = response.data.phone;
            } else {
                whatsappNumberInput.value = 'لم يتم ربط رقم واتساب';
                saveSettingsButton.disabled = true;
                generateCodeButton.disabled = true;
                errorMessage.textContent = 'يرجى ربط رقم واتساب أولاً من صفحة ربط واتساب.';
            }
        } catch (error) {
            console.error('Failed to fetch WhatsApp status:', error);
            whatsappNumberInput.value = 'خطأ في جلب رقم واتساب';
            saveSettingsButton.disabled = true;
            generateCodeButton.disabled = true;
            errorMessage.textContent = 'حدث خطأ. تواصل مع الدعم.';
        }
    }

    // جلب المتاجر المرتبطة
    async function loadConnectedStores() {
        try {
            const response = await axios.get('/api/salla/stores', {
                headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            });
            merchantIdSelect.innerHTML = '<option value="">اختر متجرًا</option>';
            response.data.stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.merchant_id;
                option.textContent = store.shop_name;
                merchantIdSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to fetch connected stores:', error);
            errorMessage.textContent = 'خطأ في جلب المتاجر. تواصل مع الدعم.';
        }
    }

    // جلب إعدادات الويدجت
    async function loadWidgetSettings() {
        try {
            const response = await axios.get('/api/whatsapp/widget-settings', {
                params: { merchant_id: merchantIdSelect.value },
                headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            });
            if (response.data.settings) {
                const settings = response.data.settings;
                merchantIdSelect.value = settings.merchant_id || '';
                iconPositionSelect.value = settings.icon_position || 'bottom-right';
                welcomeMessageInput.value = settings.welcome_message || 'مرحبًا! كيف يمكننا مساعدتك؟';
                headerInput.value = settings.header || 'تواصل معنا عبر واتساب';
                iconSizeInput.value = settings.icon_size || 60;
                iconOffsetInput.value = settings.icon_offset || 20;
                updateLivePreview();
            }
        } catch (error) {
            console.error('Failed to fetch widget settings:', error);
        }
    }

    // تحديث المعاينة الحية
    function updateLivePreview() {
        const size = iconSizeInput.value || 60;
        livePreview.style.width = `${size}px`;
        livePreview.style.height = `${size}px`;
        if (iconLogoInput.files.length > 0) {
            const reader = new FileReader();
            reader.onload = () => {
                livePreview.innerHTML = `<img src="${reader.result}" style="width: 100%; height: 100%; border-radius: 50%;">`;
            };
            reader.readAsDataURL(iconLogoInput.files[0]);
        } else {
            livePreview.innerHTML = `<i class="fa-brands fa-whatsapp"></i>`;
        }
    }

    iconSizeInput.addEventListener('input', updateLivePreview);
    iconLogoInput.addEventListener('change', updateLivePreview);
    iconPositionSelect.addEventListener('change', updateLivePreview);
    merchantIdSelect.addEventListener('change', loadWidgetSettings);

    // حفظ الإعدادات
    saveSettingsButton.addEventListener('click', async () => {
        if (!merchantIdSelect.value) {
            errorMessage.textContent = 'يرجى اختيار متجر سلة.';
            return;
        }
        const formData = new FormData();
        formData.append('merchant_id', merchantIdSelect.value);
        formData.append('whatsapp_number', whatsappNumberInput.value);
        formData.append('icon_position', iconPositionSelect.value);
        formData.append('welcome_message', welcomeMessageInput.value);
        formData.append('header', headerInput.value);
        formData.append('icon_size', iconSizeInput.value);
        formData.append('icon_offset', iconOffsetInput.value);
        if (iconLogoInput.files.length > 0) {
            formData.append('logo', iconLogoInput.files[0]);
        }

        try {
            const response = await axios.post('/api/whatsapp/widget-settings', formData, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            if (response.data.success) {
                errorMessage.textContent = 'تم حفظ الإعدادات بنجاح!';
                errorMessage.style.color = 'green';
                generateCodeButton.disabled = false;
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            errorMessage.textContent = 'خطأ في حفظ الإعدادات. تواصل مع الدعم.';
        }
    });

    // إنشاء ونسخ كود التضمين
    generateCodeButton.addEventListener('click', () => {
        const whatsappNumber = whatsappNumberInput.value.replace(/\D/g, '');
        const welcomeMessage = encodeURIComponent(welcomeMessageInput.value);
        const iconSize = iconSizeInput.value || 60;
        const iconOffset = iconOffsetInput.value || 20;
        const iconPosition = iconPositionSelect.value;

        const embedCode = `
<div class="whatsapp-widget" style="
    position: fixed;
    ${iconPosition === 'bottom-right' ? 'right: 20px;' : 'left: 20px;'}
    bottom: ${iconOffset}px;
    z-index: 1000;
">
    <a href="https://wa.me/${whatsappNumber}?text=${welcomeMessage}" target="_blank">
        <div style="
            width: ${iconSize}px;
            height: ${iconSize}px;
            background-color: #25D366;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: ${iconSize * 0.6}px;
        ">
            <i class="fa-brands fa-whatsapp"></i>
        </div>
    </a>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
`;

        codeOutput.textContent = embedCode;
        codeOutput.style.display = 'block';
        navigator.clipboard.write(embedCode).then(() => {
            errorMessage.textContent = 'تم نسخ الكود إلى الحافظة!';
            errorMessage.style.color = 'green';
        }).catch(() => {
            errorMessage.textContent = 'فشل نسخ الكود. انسخه يدويًا.';
            errorMessage.style.color = 'red';
        });
    });

    // تحميل البيانات عند بدء الصفحة
    await loadWhatsAppStatus();
    await loadConnectedStores();
    await loadWidgetSettings();
});