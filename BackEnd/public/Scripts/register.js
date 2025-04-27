 // Wait for DOM to be fully loaded
 document.addEventListener('DOMContentLoaded', function() {
    // Initialize phone number input
    const phoneInput = document.querySelector("#phone");
    const iti = window.intlTelInput(phoneInput, {
        separateDialCode: true,
        initialCountry: "eg",
        utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
    });
    
    // Toggle password visibility
    window.togglePasswordVisibility = function() {
        const passwordField = document.getElementById("password");
        const confirmField = document.getElementById("confirmPassword");
        const eyeIcon = document.querySelector(".eye-icon");
        
        if (passwordField.type === "password") {
            passwordField.type = "text";
            confirmField.type = "text";
            eyeIcon.src = "icons/view.png";
        } else {
            passwordField.type = "password";
            confirmField.type = "password";
            eyeIcon.src = "icons/eye.png";
        }
    }
    
    // التحقق من صحة البريد الإلكتروني
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // التحقق من صحة كلمة المرور
    function validatePassword(password) {
        const hasMinLength = password.length >= 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*]/.test(password);
        
        // تحديث متطلبات كلمة المرور المرئية
        document.getElementById('length-req').classList.toggle('valid', hasMinLength);
        document.getElementById('uppercase-req').classList.toggle('valid', hasUpperCase);
        document.getElementById('lowercase-req').classList.toggle('valid', hasLowerCase);
        document.getElementById('number-req').classList.toggle('valid', hasNumber);
        document.getElementById('special-req').classList.toggle('valid', hasSpecialChar);
        
        return hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
    }
    
    // التحقق من تطابق كلمة المرور
    function validateConfirmPassword(password, confirmPassword) {
        return password === confirmPassword && password !== '';
    }
    
    // التحقق من صحة رقم الهاتف
    function validatePhoneNumber(phoneNumber) {
        return iti.isValidNumber();
    }
    
    // التحقق من وجود رقم الهاتف في قاعدة البيانات
    async function checkPhoneNumberExists(phoneNumber) {
        try {
            const response = await fetch("http://localhost:5000/api/auth/check-phone", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({ 
                    phone: phoneNumber 
                })
            });
            
            const data = await response.json();
            return data.exists;
        } catch (error) {
            console.error("Error checking phone number:", error);
            return false;
        }
    }
    
    // إضافة مستمعات الأحداث لحقول الإدخال
    document.getElementById('email').addEventListener('blur', function() {
        const email = this.value.trim();
        const validationMsg = document.getElementById('email-validation');
        
        if (email === '') {
            validationMsg.textContent = 'يرجى إدخال البريد الإلكتروني';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
        } else if (!validateEmail(email)) {
            validationMsg.textContent = 'البريد الإلكتروني غير صالح';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
        } else {
            validationMsg.textContent = 'البريد الإلكتروني صالح';
            validationMsg.style.display = 'block';
            validationMsg.classList.add('valid');
            setTimeout(() => { validationMsg.style.display = 'none'; }, 2000);
        }
    });
    
    document.getElementById('password').addEventListener('focus', function() {
        document.getElementById('password-requirements').style.display = 'block';
    });
    
    document.getElementById('password').addEventListener('blur', function() {
        const password = this.value;
        const validationMsg = document.getElementById('password-validation');
        
        if (password === '') {
            validationMsg.textContent = 'يرجى إدخال كلمة المرور';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
            document.getElementById('password-requirements').style.display = 'none';
        } else if (!validatePassword(password)) {
            validationMsg.textContent = 'كلمة المرور ضعيفة';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
        } else {
            validationMsg.textContent = 'كلمة المرور قوية';
            validationMsg.style.display = 'block';
            validationMsg.classList.add('valid');
            setTimeout(() => { 
                validationMsg.style.display = 'none';
                document.getElementById('password-requirements').style.display = 'none';
            }, 2000);
        }
    });
    
    document.getElementById('password').addEventListener('input', function() {
        validatePassword(this.value);
        
        // التحقق من تطابق كلمة المرور عند التغيير
        const confirmPassword = document.getElementById('confirmPassword').value;
        if (confirmPassword !== '') {
            validateConfirmPassword(this.value, confirmPassword);
        }
    });
    
    document.getElementById('confirmPassword').addEventListener('blur', function() {
        const password = document.getElementById('password').value;
        const confirmPassword = this.value;
        const validationMsg = document.getElementById('confirm-validation');
        
        if (confirmPassword === '') {
            validationMsg.textContent = 'يرجى تأكيد كلمة المرور';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
        } else if (!validateConfirmPassword(password, confirmPassword)) {
            validationMsg.textContent = 'كلمة المرور غير متطابقة';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
        } else {
            validationMsg.textContent = 'كلمة المرور متطابقة';
            validationMsg.style.display = 'block';
            validationMsg.classList.add('valid');
            setTimeout(() => { validationMsg.style.display = 'none'; }, 2000);
        }
    });
    
    document.getElementById('phone').addEventListener('blur', async function() {
        const phoneNumber = iti.getNumber();
        const validationMsg = document.getElementById('phone-validation');
        
        if (!phoneNumber) {
            validationMsg.textContent = 'يرجى إدخال رقم الهاتف';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
            return;
        }
        
        if (!validatePhoneNumber(phoneNumber)) {
            validationMsg.textContent = 'رقم الهاتف غير صالح';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
            return;
        }
        
        const phoneExists = await checkPhoneNumberExists(phoneNumber);
        if (phoneExists) {
            validationMsg.textContent = 'رقم الهاتف مسجل بالفعل';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
        } else {
            validationMsg.textContent = 'رقم الهاتف صالح';
            validationMsg.style.display = 'block';
            validationMsg.classList.add('valid');
            setTimeout(() => { validationMsg.style.display = 'none'; }, 2000);
        }
    });
    
    document.getElementById('organization').addEventListener('blur', function() {
        const orgName = this.value.trim();
        const validationMsg = document.getElementById('organization-validation');
        
        if (orgName === '') {
            validationMsg.textContent = 'يرجى إدخال اسم المنظمة';
            validationMsg.style.display = 'block';
            validationMsg.classList.remove('valid');
        } else {
            validationMsg.textContent = 'تم إدخال اسم المنظمة';
            validationMsg.style.display = 'block';
            validationMsg.classList.add('valid');
            setTimeout(() => { validationMsg.style.display = 'none'; }, 2000);
        }
    });
    
    // Handle form submission
    document.getElementById("registerForm").addEventListener("submit", async function(event) {
        event.preventDefault();
        
        // التحقق من جميع الحقول قبل الإرسال
        const username = document.getElementById("organization").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const phone = iti.getNumber();
        
        let isValid = true;
        
        // التحقق من اسم المنظمة
        if (username === '') {
            document.getElementById('organization-validation').style.display = 'block';
            isValid = false;
        }
        
        // التحقق من البريد الإلكتروني
        if (email === '' || !validateEmail(email)) {
            document.getElementById('email-validation').style.display = 'block';
            isValid = false;
        }
        
        // التحقق من كلمة المرور
        if (password === '' || !validatePassword(password)) {
            document.getElementById('password-validation').style.display = 'block';
            document.getElementById('password-requirements').style.display = 'block';
            isValid = false;
        }
        
        // التحقق من تأكيد كلمة المرور
        if (confirmPassword === '' || !validateConfirmPassword(password, confirmPassword)) {
            document.getElementById('confirm-validation').style.display = 'block';
            isValid = false;
        }
        
        // التحقق من رقم الهاتف
        if (!phone || !validatePhoneNumber(phone)) {
            document.getElementById('phone-validation').style.display = 'block';
            isValid = false;
        } else {
            const phoneExists = await checkPhoneNumberExists(phone);
            if (phoneExists) {
                document.getElementById('phone-validation').textContent = 'رقم الهاتف مسجل بالفعل';
                document.getElementById('phone-validation').style.display = 'block';
                isValid = false;
            }
        }
        
        if (!isValid) {
            return;
        }
        
        const registerButton = document.getElementById("registerButton");
        const loading = document.getElementById("loading");
        
        // Show loading state
        registerButton.style.display = "none";
        loading.style.display = "flex";
        loading.style.flexDirection = "column";
        loading.style.alignItems = "center";

        try {
            const response = await fetch("http://localhost:5000/api/auth/register", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({ 
                    username, 
                    email, 
                    password, 
                    phone 
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || "حدث خطأ أثناء التسجيل");
            }

            // Store email for verification page
            localStorage.setItem('userEmail', email);
            
            // Redirect to verification page
            window.location.href = `verify-email.html?email=${encodeURIComponent(email)}`;
            
        } catch (error) {
            console.error("Registration error:", error);
            showError(error.message || "حدث خطأ، يرجى المحاولة مرة أخرى");
        }
        
        function showError(message) {
            alert(message);
            registerButton.style.display = "block";
            loading.style.display = "none";
        }
    });

    // Adjust labels for all input fields
    function setupInputLabels() {
        const inputs = document.querySelectorAll('.input-group input');
        
        inputs.forEach(input => {
            // Initial check
            if (input.value) {
                input.nextElementSibling.classList.add('active');
            }
            
            // Event listeners
            input.addEventListener('focus', function() {
                this.nextElementSibling.classList.add('active');
            });
            
            input.addEventListener('blur', function() {
                if (!this.value) {
                    this.nextElementSibling.classList.remove('active');
                }
            });
            
            input.addEventListener('input', function() {
                if (this.value) {
                    this.nextElementSibling.classList.add('active');
                } else {
                    this.nextElementSibling.classList.remove('active');
                }
            });
        });
    }
    
    // Initialize label animations
    setupInputLabels();
});