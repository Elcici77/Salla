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

    const loadRecipients = async () => {
        const $recipients = $('#camp-recipients');
        if (!$recipients.length) return;
        const selectedCustomers = JSON.parse(localStorage.getItem('selectedCustomers')) || [];
        if (!selectedCustomers.length) {
            showAlert('لا يوجد أرقام مختارة، يرجى اختيار العملاء من صفحة العملاء', 'warning');
            return;
        }
        try {
            const token = getAuthToken();
            if (!token) return;
            const response = await fetch(`/api/customers?ids=${selectedCustomers.join(',')}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('فشل جلب أرقام العملاء');
            const data = await response.json();
            const customerPhones = data.data.map(customer => customer.mobile).filter(phone => phone);
            $recipients.select2({
                placeholder: 'اختر الأرقام',
                width: '100%',
                dropdownCssClass: 'select2-dropdown-white'
            });
            $recipients.empty();
            customerPhones.forEach(phone => {
                const option = new Option(phone, phone, true, true);
                $recipients.append(option).trigger('change');
            });
        } catch (error) {
            console.error('Error loading recipients:', error.message);
            showAlert('حدث خطأ أثناء تحميل الأرقام: ' + error.message);
        }
    };

    document.getElementById('camp-select-all')?.addEventListener('click', () => {
        const $recipients = $('#camp-recipients');
        if ($recipients.length) {
            const allOptions = $recipients.find('option').map((_, el) => el.value).get();
            $recipients.val(allOptions).trigger('change');
        }
    });

    document.getElementById('camp-add-recipient')?.addEventListener('click', () => {
        const $recipients = $('#camp-recipients');
        if ($recipients.length) {
            const phone = prompt('أدخل رقم الهاتف (مثال: 01234567890)');
            if (phone && /^\d{11}$/.test(phone)) {
                const option = new Option(phone, phone, true, true);
                $recipients.append(option).trigger('change');
                showAlert('تم إضافة الرقم بنجاح', 'success');
            } else {
                showAlert('رقم الهاتف غير صالح', 'danger');
            }
        }
    });

    const updatePreview = () => {
        const phone = $('#camp-recipients').val()?.[0] || '01234567890';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateStr = now.toLocaleDateString('ar-EG');

        const textarea = document.getElementById('camp-message');
        const messageRaw = textarea?.value || '';
        const messageProcessed = messageRaw
            .replaceAll('[customer_phone]', phone)
            .replaceAll('[date_now]', dateStr)
            .replace(/\n/g, '<br>');

        const previewContainer = document.getElementById('camp-preview-message');
        const mediaFile = document.getElementById('camp-media-file')?.files[0];

        let mediaHTML = '';
        if (mediaFile) {
            const mediaURL = URL.createObjectURL(mediaFile);
            if (mediaFile.type.startsWith('image/')) {
                mediaHTML = `<img src="${mediaURL}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-top: 10px;" />`;
            } else if (mediaFile.type.startsWith('video/')) {
                mediaHTML = `<video controls style="max-width: 100%; max-height: 200px; margin-top: 10px;">
                                <source src="${mediaURL}" type="${mediaFile.type}">
                             </video>`;
            } else if (mediaFile.type.startsWith('audio/')) {
                mediaHTML = `<audio controls style="width: 100%; margin-top: 10px;">
                                <source src="${mediaURL}" type="${mediaFile.type}">
                             </audio>`;
            }
        }

        previewContainer.innerHTML = `
            <div class="camp-message-bubble">
                <span>${messageProcessed}</span>
                ${mediaHTML}
                <small>${timeStr} <i class="fas fa-check-double"></i></small>
            </div>
        `;

        const previewContact = document.getElementById('camp-preview-contact');
        if (previewContact) {
            previewContact.textContent = `العميل (${phone})`;
        }
    };

    document.getElementById('camp-message')?.addEventListener('input', updatePreview);
    $('#camp-recipients').on('change', updatePreview);
    document.getElementById('camp-media-file')?.addEventListener('change', updatePreview);
    setInterval(updatePreview, 1000);
    updatePreview();

    document.querySelectorAll('[data-variable]').forEach(btn => {
        btn.addEventListener('click', () => {
            const variable = btn.getAttribute('data-variable');
            const textarea = document.getElementById('camp-message');
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + `[${variable}]` + textarea.value.substring(end);
                updatePreview();
            }
        });
    });

    document.getElementById('camp-interval')?.addEventListener('input', (e) => {
        const intervalValue = document.getElementById('camp-interval-value');
        if (intervalValue) intervalValue.textContent = e.target.value;
    });

    document.getElementById('camp-launch')?.addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;

        const $recipients = $('#camp-recipients');
        const recipients = $recipients.length ? $recipients.val() || [] : [];
        if (!recipients.length) {
            showAlert('يرجى اختيار رقم واحد على الأقل');
            return;
        }

        const mediaFile = document.getElementById('camp-media-file')?.files[0];
        let mediaFilePath = null, mediaType = null;
        if (mediaFile) {
            const formData = new FormData();
            formData.append('media', mediaFile);
            try {
                const uploadResponse = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (!uploadResponse.ok) throw new Error('فشل رفع الملف');
                const uploadData = await uploadResponse.json();
                mediaFilePath = uploadData.path;
                mediaType = mediaFile.type.split('/')[0];
            } catch (error) {
                showAlert('فشل رفع الملف: ' + error.message, 'danger');
                return;
            }
        }

        const campaignData = {
            name: document.getElementById('camp-name')?.value.trim() || '',
            recipients: recipients.join(','),
            message: document.getElementById('camp-message')?.value.trim() || '',
            media_file_path: mediaFilePath,
            media_type: mediaType,
            schedule_date: document.getElementById('camp-schedule-date')?.value || '',
            schedule_time_from: document.getElementById('camp-time-from')?.value || '',
            schedule_time_to: document.getElementById('camp-time-to')?.value || '',
            interval_seconds: parseInt(document.getElementById('camp-interval')?.value) || 60
        };

        if (!campaignData.name || !campaignData.message || !campaignData.schedule_date || !campaignData.schedule_time_from || !campaignData.schedule_time_to) {
            showAlert('جميع الحقول المطلوبة يجب أن تكون ممتلئة');
            return;
        }

        try {
            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(campaignData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل إنشاء الحملة');
            }
            showAlert('تم إطلاق الحملة بنجاح', 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error('Error launching campaign:', error.message);
            showAlert('حدث خطأ أثناء إطلاق الحملة: ' + error.message);
        }
    });

    const loadLaunchedCampaigns = async () => {
        const token = getAuthToken();
        if (!token) return;
        try {
            const response = await fetch('/api/campaigns/launched', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('فشل جلب الحملات');
            const data = await response.json();
            const table = document.getElementById('launched-campaigns-table');
            if (!table) return;
            table.innerHTML = '';
            if (data.message && data.data.length === 0) {
                table.innerHTML = '<tr><td colspan="4" class="text-center">لا توجد حملات منفذة حاليًا</td></tr>';
                return;
            }
            data.data.forEach(campaign => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${campaign.name || '-'}</td>
                    <td>${new Date(campaign.created_at).toLocaleDateString('ar-EG')}</td>
                    <td>${campaign.status || '-'}</td>
                `;

                table.appendChild(row);
            });

            document.querySelectorAll('.campaign-actions i').forEach(icon => {
                icon.addEventListener('click', async (e) => {
                    const campaignId = e.target.dataset.id;
                    const action = e.target.dataset.action;
                    const url = action === 'start' ? 'https://wsalla.com/Install/api/remote/start.chats' : 'https://wsalla.com/Install/api/remote/stop.chats';
                    try {
                        const response = await axios.get(url, {
                            params: {
                                secret: process.env.ZENDER_API_SECRET,
                                campaign: campaignId
                            }
                        });
                        if (response.data.status === 'success') {
                            showAlert(`تم ${action === 'start' ? 'تشغيل' : 'إيقاف'} الحملة بنجاح`, 'success');
                            loadLaunchedCampaigns();
                        } else {
                            throw new Error('فشل العملية');
                        }
                    } catch (error) {
                        console.error(`Error ${action}ing campaign ${campaignId}:`, error.message);
                        showAlert(`حدث خطأ أثناء ${action === 'start' ? 'تشغيل' : 'إيقاف'} الحملة: ${error.message}`, 'danger');
                    }
                });
            });
        } catch (error) {
            showAlert('حدث خطأ أثناء جلب الحملات: ' + error.message);
        }
    };

    if (document.getElementById('camp-recipients')) loadRecipients();
    if (document.getElementById('launched-campaigns-table')) loadLaunchedCampaigns();
});
