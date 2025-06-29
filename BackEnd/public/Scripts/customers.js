document.addEventListener('DOMContentLoaded', () => {
    // Helper function to show Bootstrap alerts
    const showAlert = (message, type = 'danger') => {
        const alertContainer = document.createElement('div');
        alertContainer.className = `alert alert-${type} alert-dismissible fade show cust-alert`;
        alertContainer.style.position = 'fixed';
        alertContainer.style.top = '20px';
        alertContainer.style.right = '20px';
        alertContainer.style.zIndex = '1050';
        alertContainer.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertContainer);
        setTimeout(() => alertContainer.remove(), 5000);
    };

    // Helper function to check authentication token
    const getAuthToken = () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('يرجى تسجيل الدخول أولاً', 'warning');
            setTimeout(() => window.location.href = '/login.html', 2000);
            return null;
        }
        return token;
    };

    // Fetch Customers
    const fetchCustomers = async (params = {}) => {
        const token = getAuthToken();
        if (!token) return;

        try {
            const query = new URLSearchParams(params).toString();
            const response = await fetch(`/api/customers${query ? `?${query}` : ''}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401) {
                showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                localStorage.removeItem('authToken');
                setTimeout(() => window.location.href = '/login.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `فشل جلب العملاء: ${response.statusText}`);
            }
            const data = await response.json();
            if (!data.success || !Array.isArray(data.data)) {
                console.error('Invalid response format:', data);
                throw new Error('تنسيق استجابة غير متوقع');
            }
            const tbody = document.getElementById('cust-customers-table');
            tbody.innerHTML = '';
            data.data.forEach(customer => {
                tbody.innerHTML += `
                    <tr>
                        <td><input type="checkbox" class="cust-customer-checkbox" value="${customer.id}"></td>
                        <td>${customer.name || '-'}</td>
                        <td>${customer.groups?.join(', ') || '-'}</td>
                        <td>${customer.type || '-'}</td>
                        <td>${customer.city || '-'}</td>
                        <td>${customer.mobile || '-'}</td>
                        <td>${customer.email || '-'}</td>
                        <td>${customer.last_sync_date ? new Date(customer.last_sync_date).toLocaleDateString('ar-EG') : '-'}</td>
                        <td>${new Date(customer.created_at).toLocaleDateString('ar-EG')}</td>
                    </tr>
                `;
            });
            document.getElementById('cust-total-customers').textContent = data.total || 0;
        } catch (error) {
            console.error('Error fetching customers:', error.message, { status: error.response?.status });
            showAlert('حدث خطأ أثناء جلب العملاء: ' + error.message);
        }
    };

    // Create Group
    document.getElementById('cust-create-group').addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;

        const groupName = document.getElementById('cust-group-name').value.trim();
        if (!groupName) {
            showAlert('يرجى إدخال اسم المجموعة');
            return;
        }
        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: groupName })
            });
            if (response.status === 401) {
                showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                localStorage.removeItem('authToken');
                setTimeout(() => window.location.href = '/login.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل إنشاء المجموعة');
            }
            const data = await response.json();
            if (data.success) {
                addGroupCard(data.group);
                const modal = bootstrap.Modal.getInstance(document.getElementById('custNewGroupModal'));
                modal.hide();
                document.getElementById('cust-group-name').value = '';
                showAlert('تم إنشاء المجموعة بنجاح', 'success');
            } else {
                throw new Error(data.message || 'فشل إنشاء المجموعة');
            }
        } catch (error) {
            console.error('Error creating group:', error.message);
            showAlert(`خطأ: ${error.message}`);
        }
    });

    // Add Group Card
    const addGroupCard = (group) => {
        const groupCards = document.getElementById('cust-group-cards');
        groupCards.innerHTML += `
            <div class="col-md-3">
                <div class="cust-card text-center cust-group-card">
                    <div class="cust-card-body">
                        <input type="checkbox" class="form-check-input" id="cust-group-${group.id}">
                        <i class="fas fa-trash cust-delete-group" data-id="${group.id}"></i>
                        <i class="fas fa-users fa-2x mb-2 cust-icon-primary"></i>
                        <h5 class="cust-card-title">${group.name}</h5>
                        <p class="cust-card-text"><span>0</span> عميل</p>
                    </div>
                </div>
            </div>
        `;
    };

    // Delete Group
    document.getElementById('cust-group-cards').addEventListener('click', async (e) => {
        if (e.target.classList.contains('cust-delete-group')) {
            const token = getAuthToken();
            if (!token) return;

            const groupId = e.target.dataset.id;
            try {
                const response = await fetch(`/api/groups/${groupId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.status === 401) {
                    showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                    localStorage.removeItem('authToken');
                    setTimeout(() => window.location.href = '/login.html', 2000);
                    return;
                }
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'فشل حذف المجموعة');
                }
                e.target.closest('.col-md-3').remove();
                showAlert('تم حذف المجموعة بنجاح', 'success');
            } catch (error) {
                console.error('Error deleting group:', error.message);
                showAlert('حدث خطأ أثناء حذف المجموعة: ' + error.message);
            }
        }
    });

    // Import WhatsApp Groups
    document.getElementById('custImportWhatsAppModal').addEventListener('show.bs.modal', async () => {
        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch('/api/whatsapp/groups', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401) {
                showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                localStorage.removeItem('authToken');
                setTimeout(() => window.location.href = '/login.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل جلب مجموعات واتساب');
            }
            const data = await response.json();
            const groupsDiv = document.getElementById('cust-whatsapp-groups');
            groupsDiv.innerHTML = '';
            let groups = data.groups || (data.data && Array.isArray(data.data) ? data.data : []);
            if ((data.success || data.status === 200) && data.connected && Array.isArray(groups)) {
                groups.forEach(group => {
                    groupsDiv.innerHTML += `
                        <div class="form-check">
                            <input type="checkbox" class="form-check-input" id="cust-wagroup-${group.gid}" value="${group.gid}">
                            <label class="form-check-label" for="cust-wagroup-${group.gid}">${group.name}</label>
                        </div>
                    `;
                });
            } else {
                groupsDiv.innerHTML = `<p class="text-danger">${data.message || 'لا يوجد رقم واتساب متصل.'}</p>`;
            }
        } catch (error) {
            console.error('Error fetching WhatsApp groups:', error.message);
            showAlert('حدث خطأ أثناء جلب مجموعات واتساب: ' + error.message);
        }
    });

    // Import WhatsApp Contacts
    document.getElementById('cust-import-whatsapp').addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;

        const selectedGroups = Array.from(document.querySelectorAll('#cust-whatsapp-groups input:checked')).map(input => input.value);
        if (!selectedGroups.length) {
            showAlert('يرجى اختيار مجموعة واحدة على الأقل');
            return;
        }
        try {
            const response = await fetch('/api/whatsapp/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ groupIds: selectedGroups })
            });
            if (response.status === 401) {
                showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                localStorage.removeItem('authToken');
                setTimeout(() => window.location.href = '/login.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل استيراد جهات الاتصال من واتساب');
            }
            fetchCustomers();
            const modal = bootstrap.Modal.getInstance(document.getElementById('custImportWhatsAppModal'));
            modal.hide();
            showAlert('تم استيراد جهات الاتصال بنجاح', 'success');
        } catch (error) {
            console.error('Error importing WhatsApp contacts:', error.message);
            showAlert('حدث خطأ أثناء استيراد جهات الاتصال من واتساب: ' + error.message);
        }
    });

    // Import Excel
    document.getElementById('cust-upload-excel').addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;

        const file = document.getElementById('cust-excel-file').files[0];
        if (!file) {
            showAlert('يرجى اختيار ملف Excel');
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch('/api/customers/import/excel', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (response.status === 401) {
                showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                localStorage.removeItem('authToken');
                setTimeout(() => window.location.href = '/login.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل رفع ملف Excel');
            }
            fetchCustomers();
            const modal = bootstrap.Modal.getInstance(document.getElementById('custImportExcelModal'));
            modal.hide();
            showAlert('تم رفع ملف Excel بنجاح', 'success');
        } catch (error) {
            console.error('Error uploading Excel:', error.message);
            showAlert('حدث خطأ أثناء رفع ملف Excel: ' + error.message);
        }
    });

    // Manual Import
    document.getElementById('cust-import-manual').addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;

        const numbers = document.getElementById('cust-manual-numbers').value.split('\n').filter(num => num.trim());
        if (!numbers.length) {
            showAlert('يرجى إدخال رقم واحد على الأقل');
            return;
        }
        try {
            const response = await fetch('/api/customers/import/manual', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ numbers })
            });
            if (response.status === 401) {
                showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                localStorage.removeItem('authToken');
                setTimeout(() => window.location.href = '/login.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل استيراد الأرقام يدويًا');
            }
            fetchCustomers();
            const modal = bootstrap.Modal.getInstance(document.getElementById('custManualImportModal'));
            modal.hide();
            document.getElementById('cust-manual-numbers').value = '';
            showAlert('تم استيراد الأرقام بنجاح', 'success');
        } catch (error) {
            console.error('Error importing manually:', error.message);
            showAlert('حدث خطأ أثناء استيراد الأرقام يدويًا: ' + error.message);
        }
    });

    // Add Customer
    document.getElementById('cust-add-customer').addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;

        const customer = {
            name: document.getElementById('cust-customer-name').value.trim(),
            phone: document.getElementById('cust-customer-phone').value.trim(),
            email: document.getElementById('cust-customer-email').value.trim(),
            city: document.getElementById('cust-customer-city').value.trim()
        };
        if (!customer.name || !customer.phone) {
            showAlert('الاسم ورقم الجوال مطلوبان');
            return;
        }
        try {
            const response = await fetch('/api/customers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(customer)
            });
            if (response.status === 401) {
                showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                localStorage.removeItem('authToken');
                setTimeout(() => window.location.href = '/login.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل إضافة العميل');
            }
            fetchCustomers();
            const modal = bootstrap.Modal.getInstance(document.getElementById('custNewCustomerModal'));
            modal.hide();
            document.getElementById('cust-customer-name').value = '';
            document.getElementById('cust-customer-phone').value = '';
            document.getElementById('cust-customer-email').value = '';
            document.getElementById('cust-customer-city').value = '';
            showAlert('تم إضافة العميل بنجاح', 'success');
        } catch (error) {
            console.error('Error adding customer:', error.message);
            showAlert('حدث خطأ أثناء إضافة العميل: ' + error.message);
        }
    });

    // Select All Checkboxes
    document.getElementById('cust-select-all').addEventListener('change', (e) => {
        document.querySelectorAll('.cust-customer-checkbox').forEach(cb => cb.checked = e.target.checked);
    });

    // Create Campaign with Selected Customers
    document.getElementById('cust-create-campaign').addEventListener('click', (e) => {
        const selectedCustomers = Array.from(document.querySelectorAll('.cust-customer-checkbox:checked')).map(cb => cb.value);
        if (selectedCustomers.length) {
            localStorage.setItem('selectedCustomers', JSON.stringify(selectedCustomers));
            // تحويل إلى صفحة campaigns.html
            window.location.href = '/campaigns.html';
        } else {
            showAlert('يرجى اختيار عميل واحد على الأقل');
            e.preventDefault();
        }
    });

    // Search
    document.getElementById('cust-search-input').addEventListener('input', (e) => {
        const query = e.target.value.trim();
        fetchCustomers({ search: query });
    });

    // Sort
    document.getElementById('cust-sort-select').addEventListener('change', (e) => {
        const sort = e.target.value;
        fetchCustomers({ sort });
    });

    // Sync Customers
    document.getElementById('cust-sync-customers').addEventListener('click', async () => {
        const token = getAuthToken();
        if (!token) return;

        try {
            const response = await fetch('/api/customers/sync', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.status === 401) {
                showAlert('انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مجددًا', 'warning');
                localStorage.removeItem('authToken');
                setTimeout(() => window.location.href = '/login.html', 2000);
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'فشل مزامنة العملاء');
            }
            fetchCustomers();
            showAlert('تمت المزامنة بنجاح', 'success');
        } catch (error) {
            console.error('Error syncing customers:', error.message);
            showAlert('حدث خطأ أثناء مزامنة العملاء: ' + error.message);
        }
    });

    // Initial Fetch
    fetchCustomers();
});