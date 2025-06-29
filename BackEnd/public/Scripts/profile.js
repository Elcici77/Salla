document.addEventListener('DOMContentLoaded', async () => {
    await loadProfileData(); // تأكد من إتمام التحميل قبل متابعة باقي الإعدادات
    setupFormSubmit();
    setupAvatarUpload();
    setupRemoveAvatar();
    setupPhoneValidation();
    updateNavbarProfileImage();
});


// تحميل بيانات المستخدم
async function loadProfileData() {
    const usernameDisplay = document.getElementById('username-display');
    const profileImg = document.getElementById('profileImage');
    const navbarAvatar = document.querySelector('.user-avatar img');
    const phoneInput = document.getElementById('phone');
    const defaultImage = 'https://via.placeholder.com/150';

    try {
        const token = localStorage.getItem('authToken');
        if (!token) return window.location.href = 'login.html';

        const response = await fetch('http://localhost:5000/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) window.location.href = 'login.html';
            throw new Error(`خطأ في الخادم: ${response.status}`);
        }

        const data = await response.json();
        localStorage.setItem('userData', JSON.stringify(data));
        console.log('بيانات الملف الشخصي:', data);

        // تحديث الحقول
        document.getElementById('username').value = data.username || '';
        document.getElementById('email').value = data.email || '';

        // تهيئة intl-tel-input لحقل الهاتف
        const iti = window.intlTelInput(phoneInput, {
            initialCountry: "auto",
            geoIpLookup: callback => {
                fetch('https://ipinfo.io/json?token=<YOUR_TOKEN>')
                    .then(res => res.json())
                    .then(data => callback(data.country))
                    .catch(() => callback('us'));
            },
            utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@17.0.8/build/js/utils.js"
        });

        // بعد تهيئة intl-tel-input، ضع رقم الهاتف
        if (data.phone) {
            setTimeout(() => {
                iti.setNumber(data.phone);
                phoneInput.dataset.currentValue = iti.getNumber(); // ← هذا السطر مهم
            }, 200);
        }
        

        // تحديث اسم المستخدم في الـ navbar
        if (usernameDisplay) usernameDisplay.textContent = data.username || 'مستخدم';

        // تحديث صورة الملف الشخصي
        if (data.profile_picture) {
            const imageUrl = `http://localhost:5000/uploads/profiles/${data.profile_picture}?${Date.now()}`;
            if (profileImg) profileImg.src = imageUrl;
            if (navbarAvatar) navbarAvatar.src = imageUrl;
        } else {
            if (profileImg) profileImg.src = defaultImage;
            if (navbarAvatar) navbarAvatar.src = defaultImage;
        }

    } catch (err) {
        console.error('خطأ في تحميل البيانات:', err);
        showAlert('error', err.message || 'حدث خطأ أثناء تحميل البيانات');
        if (usernameDisplay) usernameDisplay.textContent = 'ضيف';
        if (profileImg) profileImg.src = defaultImage;
        if (navbarAvatar) navbarAvatar.src = defaultImage;
    }
}


// رفع صورة البروفايل
function setupAvatarUpload() {
    const avatarInput = document.getElementById('avatarInput');
    const profileImage = document.getElementById('profileImage');
    const uploadBtn = document.querySelector('.upload-btn');

    if (!avatarInput || !profileImage || !uploadBtn) return;

    avatarInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const maxSize = 2 * 1024 * 1024; // 2MB

        if (!allowedTypes.includes(file.type)) {
            showAlert('error', 'الصيغة غير مدعومة');
            return;
        }
        if (file.size > maxSize) {
            showAlert('error', 'حجم الصورة يجب أن يكون أقل من 2 ميجابايت');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('error', 'يجب تسجيل الدخول أولاً');
            window.location.href = 'login.html';
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الرفع...';

        try {
            const response = await fetch('http://localhost:5000/api/auth/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'فشل رفع الصورة');

            const imageUrl = `http://localhost:5000/uploads/profiles/${data.filename}?${Date.now()}`;
            
            // تحديث الصورة في صفحة البروفايل
            profileImage.src = imageUrl;
            
            // تحديث الصورة في الـ navbar في الصفحة الحالية
            const navbarAvatar = document.querySelector('.user-avatar img');
            if (navbarAvatar) navbarAvatar.src = imageUrl;
            
            // حفظ بيانات المستخدم المحدثة في localStorage
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            userData.profile_picture = data.filename;
            localStorage.setItem('userData', JSON.stringify(userData));
            
            showAlert('success', 'تم رفع الصورة بنجاح');

        } catch (err) {
            console.error('خطأ أثناء رفع الصورة:', err);
            showAlert('error', err.message || 'حدث خطأ أثناء رفع الصورة');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-camera"></i> تغيير الصورة';
            avatarInput.value = '';
        }
    });
}

// إزالة صورة البروفايل
function setupRemoveAvatar() {
    const removeBtn = document.getElementById('removeAvatarBtn');

    if (!removeBtn) {
        console.warn('زر إزالة الصورة غير موجود');
        return;
    }

    removeBtn.addEventListener('click', async () => {
        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('error', 'يجب تسجيل الدخول أولاً');
            window.location.href = 'login.html';
            return;
        }

        removeBtn.disabled = true;
        removeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الإزالة...';

        try {
            const response = await fetch('http://localhost:5000/api/auth/remove-avatar', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const textResponse = await response.text();

            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (jsonErr) {
                console.error('فشل تحليل JSON:', jsonErr);
                throw new Error('استجابة الخادم غير صالحة');
            }

            if (!response.ok) {
                throw new Error(data.message || `خطأ في الخادم: ${response.status}`);
            }

            const defaultImage = 'https://via.placeholder.com/150';
            const profileImg = document.getElementById('profileImage');
            const navbarAvatar = document.querySelector('.user-avatar img');

            if (profileImg) {
                profileImg.src = defaultImage;
            }
            if (navbarAvatar) {
                navbarAvatar.src = defaultImage;
            }

            showAlert('success', data.message || 'تم إزالة الصورة بنجاح');
            
        } catch (err) {
            console.error('خطأ أثناء إزالة الصورة:', err);
            showAlert('error', err.message || 'حدث خطأ أثناء إزالة الصورة');
        } finally {
            removeBtn.disabled = false;
            removeBtn.innerHTML = '<i class="fas fa-trash"></i> إزالة الصورة';
        }
    });
}

// دالة لعرض التنبيهات
function showAlert(type, message) {
    const div = document.createElement('div');
    div.className = `upload-alert ${type}`;
    div.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    const profileHeader = document.querySelector('.profile-header');
    if (profileHeader) {
        profileHeader.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    } else {
        console.warn('عنصر .profile-header غير موجود، يتم عرض التنبيه في الجسم');
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
}

// تحديث بيانات البروفايل
function setupFormSubmit() {
    const form = document.getElementById('profileForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // الحصول على نسخة من مدخل الهاتف الدولي
        const phoneInput = document.getElementById('phone');
        const iti = window.intlTelInputGlobals.getInstance(phoneInput);
        const phoneNumber = iti.getNumber();
        const currentPhone = phoneInput.dataset.currentValue || '';

        // التحقق من اسم المستخدم
        const username = document.getElementById('username').value.trim();
        if (!username) {
            showAlert('error', 'اسم المستخدم مطلوب');
            return;
        }

        // التحقق من صحة رقم الهاتف
        if (!iti.isValidNumber()) {
            showAlert('error', 'رقم الهاتف غير صالح');
            return;
        }

        // التحقق من تغيير رقم الهاتف وعدم تكراره
        if (phoneNumber !== currentPhone) {
            try {
                const exists = await checkPhoneNumberExists(phoneNumber, currentPhone);
                if (exists) {
                    showAlert('error', 'رقم الهاتف مسجل بالفعل');
                    return;
                }
            } catch (err) {
                console.error('خطأ في التحقق من رقم الهاتف:', err);
                showAlert('error', 'حدث خطأ أثناء التحقق من رقم الهاتف');
                return;
            }
        }

        // التحقق من وجود token
        const token = localStorage.getItem('authToken');
        if (!token) {
            showAlert('error', 'يجب تسجيل الدخول أولاً');
            window.location.href = 'login.html';
            return;
        }

        // إعداد بيانات الإرسال
        const formData = {
            username: username,
            phone: phoneNumber
        };

        try {
            const response = await fetch('http://localhost:5000/api/auth/update-profile', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const textResponse = await response.text();

            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (jsonErr) {
                console.error('فشل تحليل JSON:', jsonErr);
                throw new Error('استجابة الخادم غير صالحة: ' + textResponse.slice(0, 100));
            }

            if (!response.ok) throw new Error(data.message || 'فشل تحديث البيانات');

            // تحديث البيانات المحلية بعد النجاح
            phoneInput.dataset.currentValue = phoneNumber;
            
            // تحديث اسم المستخدم في واجهة المستخدم
            const usernameDisplay = document.getElementById('username-display');
            if (usernameDisplay) usernameDisplay.textContent = data.username;
            
            // عرض رسالة النجاح
            showAlert('success', 'تم تحديث البيانات بنجاح');

            // تحديث بيانات المستخدم في localStorage
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            userData.username = data.username;
            userData.phone = phoneNumber;
            localStorage.setItem('userData', JSON.stringify(userData));

        } catch (err) {
            console.error('خطأ في التحديث:', err);
            showAlert('error', err.message || 'حدث خطأ أثناء تحديث البيانات');
        }
    });
}

// إعداد التحقق من رقم الهاتف
function setupPhoneValidation() {
    const phoneInput = document.getElementById('phone');
    if (!phoneInput) return;

    phoneInput.addEventListener('blur', async function() {
        const iti = window.intlTelInputGlobals.getInstance(phoneInput);
        const phoneNumber = iti.getNumber();
        const currentPhone = this.dataset.currentValue || '';

        const validationMsg = document.getElementById('phone-validation') || createValidationMsg(phoneInput);

        if (!phoneNumber) {
            validationMsg.textContent = 'يرجى إدخال رقم الهاتف';
            validationMsg.style.display = 'block';
            validationMsg.className = 'validation-msg error';
            return;
        }

        if (!iti.isValidNumber()) {
            validationMsg.textContent = 'رقم الهاتف غير صالح';
            validationMsg.style.display = 'block';
            validationMsg.className = 'validation-msg error';
            return;
        }

        try {
            const exists = await checkPhoneNumberExists(phoneNumber, currentPhone);
            if (exists) {
                validationMsg.textContent = 'رقم الهاتف مسجل بالفعل';
                validationMsg.style.display = 'block';
                validationMsg.className = 'validation-msg error';
            } else {
                validationMsg.textContent = 'رقم الهاتف صالح';
                validationMsg.style.display = 'block';
                validationMsg.className = 'validation-msg success';
                setTimeout(() => { validationMsg.style.display = 'none'; }, 2000);
            }
        } catch (err) {
            console.error('خطأ في التحقق من رقم الهاتف:', err);
            validationMsg.textContent = 'حدث خطأ أثناء التحقق من رقم الهاتف';
            validationMsg.style.display = 'block';
            validationMsg.className = 'validation-msg error';
        }
    });
}

// إنشاء عنصر رسالة التحقق إذا لم يكن موجوداً
function createValidationMsg(inputElement) {
    const container = inputElement.parentElement;
    const validationMsg = document.createElement('div');
    validationMsg.id = 'phone-validation';
    validationMsg.className = 'validation-msg';
    container.appendChild(validationMsg);
    return validationMsg;
}

// التحقق من وجود رقم الهاتف في قاعدة البيانات (مع استثناء الرقم الحالي)
async function checkPhoneNumberExists(phoneNumber, currentPhone) {
    if (phoneNumber === currentPhone) return false;

    try {
        const response = await fetch('http://localhost:5000/api/auth/check-phone', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({ phone: phoneNumber })
        });

        const data = await response.json();
        return data.exists;
    } catch (err) {
        console.error('خطأ في التحقق من رقم الهاتف:', err);
        throw err;
    }
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

