const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool, query } = require('../db');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const router = express.Router();

require('dotenv').config();

// Middleware setup
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

/**
 * تحقق من صحة رقم الهاتف باستخدام libphonenumber-js
 * @param {string} phone - رقم الهاتف المدخل
 * @param {string} countryCode - كود الدولة الافتراضي (مثال: 'EG' لمصر)
 * @returns {boolean} - هل الرقم صحيح أم لا
 */
function validatePhoneNumber(phone, countryCode = 'EG') {
    try {
        const phoneNumber = parsePhoneNumberFromString(phone, countryCode);
        
        if (!phoneNumber) {
            return false;
        }
        
        return phoneNumber.isValid();
    } catch (error) {
        console.error('Phone validation error:', error);
        return false;
    }
}

/**
 * الحصول على معلومات مفصلة عن رقم الهاتف
 * @param {string} phone - رقم الهاتف المدخل
 * @param {string} countryCode - كود الدولة الافتراضي
 * @returns {object} - معلومات الرقم أو null إذا كان غير صالح
 */
function getPhoneNumberInfo(phone, countryCode = 'EG') {
    try {
        const phoneNumber = parsePhoneNumberFromString(phone, countryCode);
        
        if (!phoneNumber || !phoneNumber.isValid()) {
            return null;
        }
        
        return {
            isValid: true,
            country: phoneNumber.country,
            countryCallingCode: phoneNumber.countryCallingCode,
            nationalNumber: phoneNumber.nationalNumber,
            formatInternational: phoneNumber.formatInternational(),
            formatNational: phoneNumber.formatNational(),
            type: phoneNumber.getType()
        };
    } catch (error) {
        console.error('Phone info error:', error);
        return null;
    }
}

/**
 * التحقق من قوة كلمة المرور
 * @param {string} password - كلمة المرور المدخلة
 * @returns {object} - نتيجة التحقق مع التفاصيل
 */
function validatePasswordStrength(password) {
    const requirements = {
        minLength: password.length >= 8,
        hasUpperCase: /[A-Z]/.test(password),
        hasLowerCase: /[a-z]/.test(password),
        hasNumber: /[0-9]/.test(password),
        hasSpecialChar: /[!@#$%^&*]/.test(password)
    };
    
    const isValid = Object.values(requirements).every(Boolean);
    
    return {
        isValid,
        requirements,
        strength: isValid ? 'strong' : 
                 (password.length >= 6 ? 'medium' : 'weak')
    };
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        // لا ترفض الشهادات غير الموثوقة
        rejectUnauthorized: false
      }
});

// إرسال بريد التحقق
async function sendVerificationEmail(email, verificationCode) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'رمز التحقق من حسابك',
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center;">
                    <h2 style="color: #3498db;">تأكيد البريد الإلكتروني</h2>
                    <p>رمز التحقق الخاص بك هو:</p>
                    <div style="font-size: 24px; font-weight: bold; margin: 20px 0; padding: 10px; background: #f4f4f4;">
                        ${verificationCode}
                    </div>
                    <p>هذا الرمز مكون من 4 أرقام وصالح لمدة 10 دقائق فقط</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send verification email');
    }
}

// Middleware المصادقة
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'يجب تقديم توكن المصادقة' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT Error:', {
                name: err.name,
                message: err.message,
                expiredAt: err.expiredAt
            });
            return res.status(403).json({ message: 'توكن غير صالح أو منتهي الصلاحية' });
        }
        
        req.user = {
            userId: decoded.userId,
            username: decoded.username
        };
        next();
    });
}

/**
 * @route POST /api/auth/check-phone
 * @desc التحقق من وجود رقم الهاتف في قاعدة البيانات
 * @access عام
 */
router.post('/check-phone', async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ 
            exists: false,
            message: "رقم الهاتف مطلوب" 
        });
    }

    try {
        // البحث عن رقم الهاتف في قاعدة البيانات
        const [users] = await query("SELECT * FROM users WHERE phone = ?", [phone]);
        
        return res.status(200).json({ 
            exists: users.length > 0,
            message: users.length > 0 ? "رقم الهاتف مسجل بالفعل" : "رقم الهاتف متاح"
        });

    } catch (error) {
        console.error('Error checking phone number:', error);
        return res.status(500).json({ 
            exists: false,
            message: "خطأ في التحقق من رقم الهاتف" 
        });
    }
});

/**
 * @route POST /api/auth/check-email
 * @desc التحقق من وجود البريد الإلكتروني في قاعدة البيانات
 * @access عام
 */
router.post('/check-email', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ 
            exists: false,
            message: "البريد الإلكتروني مطلوب" 
        });
    }

    try {
        // التحقق من صيغة البريد الإلكتروني أولاً
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                exists: false,
                message: "صيغة البريد الإلكتروني غير صالحة" 
            });
        }

        // البحث عن البريد الإلكتروني في قاعدة البيانات
        const [users] = await query("SELECT * FROM users WHERE email = ?", [email]);
        
        return res.status(200).json({ 
            exists: users.length > 0,
            message: users.length > 0 
                ? "البريد الإلكتروني مسجل في نظامنا" 
                : "البريد الإلكتروني غير مسجل"
        });

    } catch (error) {
        console.error('Error checking email:', error);
        return res.status(500).json({ 
            exists: false,
            message: "خطأ في التحقق من البريد الإلكتروني" 
        });
    }
});

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
    const { username, email, password, phone, countryCode = 'EG' } = req.body;

    // التحقق من الحقول المطلوبة
    if (!username || !email || !password || !phone) {
        return res.status(400).json({ 
            success: false,
            message: "جميع الحقول مطلوبة" 
        });
    }

    try {
        // التحقق من صحة البريد الإلكتروني
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false,
                message: "صيغة البريد الإلكتروني غير صالحة" 
            });
        }

        // التحقق من قوة كلمة المرور باستخدام الدالة الجديدة
        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.isValid) {
            return res.status(400).json({
                success: false,
                message: "كلمة المرور ضعيفة",
                requirements: {
                    minLength: "يجب أن تكون 8 أحرف على الأقل",
                    hasUpperCase: "يجب أن تحتوي على حرف كبير واحد على الأقل",
                    hasLowerCase: "يجب أن تحتوي على حرف صغير واحد على الأقل",
                    hasNumber: "يجب أن تحتوي على رقم واحد على الأقل",
                    hasSpecialChar: "يجب أن تحتوي على حرف خاص (!@#$%^&*)"
                },
                missingRequirements: Object.entries(passwordCheck.requirements)
                    .filter(([_, met]) => !met)
                    .map(([req]) => req)
            });
        }

        // التحقق من صحة رقم الهاتف باستخدام الدالة الجديدة
        if (!validatePhoneNumber(phone, countryCode)) {
            const phoneInfo = parsePhoneNumberFromString(phone, countryCode);
            return res.status(400).json({ 
                success: false,
                message: "رقم الهاتف غير صالح",
                suggestion: phoneInfo ? `هل تقصد ${phoneInfo.formatInternational()}؟` : null
            });
        }

        // التحقق من وجود البريد الإلكتروني
        const [existingEmails] = await query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingEmails.length > 0) {
            return res.status(409).json({ 
                success: false,
                message: "البريد الإلكتروني مستخدم بالفعل",
                suggestion: "هل نسيت كلمة المرور؟ يمكنك استعادتها من صفحة تسجيل الدخول"
            });
        }

        // التحقق من وجود رقم الهاتف
        const [existingPhones] = await query("SELECT * FROM users WHERE phone = ?", [phone]);
        if (existingPhones.length > 0) {
            return res.status(409).json({ 
                success: false,
                message: "رقم الهاتف مستخدم بالفعل",
                suggestion: "إذا كان هذا رقمك، حاول تسجيل الدخول بدلاً من التسجيل"
            });
        }

        // تشفير كلمة المرور
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
        const now = new Date();

        // إضافة المستخدم الجديد
        const [result] = await query(
            "INSERT INTO users (username, email, password, phone, verification_code, is_verified, last_code_sent) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [username, email, hashedPassword, phone, verificationCode, false, now]
        );

        // إنشاء توكن
        const token = jwt.sign(
            { 
                userId: result.insertId,
                username: username
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: '1h' }
        );

        // إرسال بريد التحقق
        await sendVerificationEmail(email, verificationCode);

        return res.status(201).json({
            success: true,
            message: "تم التسجيل بنجاح. يرجى التحقق من بريدك الإلكتروني.",
            token,
            userId: result.insertId,
            userInfo: {
                username,
                email,
                phone: parsePhoneNumberFromString(phone, countryCode)?.formatInternational()
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            success: false,
            message: "خطأ في الخادم",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
            systemSuggestion: "يرجى المحاولة مرة أخرى بعد قليل أو التواصل مع الدعم الفني"
        });
    }
});

// التحقق من البريد الإلكتروني
router.post('/verify-email', async (req, res) => {
    const { email, verificationCode } = req.body;

    
    try {
        // 1. البحث عن المستخدم - استعلام معدل
        const [users] = await query(
            "SELECT * FROM users WHERE email = ?", 
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: "المستخدم غير موجود" });
        }

        const user = users[0];

        // 2. تسجيل البيانات للتصحيح
        console.log('الكود المدخل:', verificationCode);
        console.log('الكود في DB:', user.verification_code);
        console.log('نوع الكود في DB:', typeof user.verification_code);

        // 3. المقارنة كـ Strings
        if (user.verification_code !== verificationCode.toString()) {
            return res.status(400).json({ 
                message: "رمز التحقق غير صحيح",
                debug: {
                    received: verificationCode,
                    expected: user.verification_code,
                    types: {
                        received: typeof verificationCode,
                        expected: typeof user.verification_code
                    }
                }
            });
        }

        // التحقق من انتهاء صلاحية الرمز (15 دقائق)
        const codeSentTime = new Date(user.last_code_sent || user.created_at);
        const currentTime = new Date();
        const diffInMinutes = (currentTime - codeSentTime) / (1000 * 60);

        if (diffInMinutes > 15) {
            return res.status(400).json({ message: "انتهت صلاحية رمز التحقق" });
        }

        // تحديث حالة التحقق
        await query("UPDATE users SET is_verified = true WHERE email = ?", [email]);

        return res.status(200).json({ message: "تم التحقق من البريد الإلكتروني بنجاح" });

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({ message: "خطأ في الخادم" });
    }
});


// تسجيل الدخول
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await query("SELECT * FROM users WHERE email = ?", [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
        }

        const user = users[0];
        console.log('User from DB:', user);

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
        }

        if (!user.is_verified) {
            return res.status(403).json({ 
                message: "لم يتم التحقق من البريد الإلكتروني",
                needsVerification: true
            });
        }

        // إنشاء التوكن
        const token = jwt.sign(
            {
                userId: user.ID || user.id,
                username: user.username
            },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: '1h' }
        );

        console.log('Generated Token for User:', {
            userId: user.ID || user.id,
            username: user.username
        });

        return res.json({
            message: "تم تسجيل الدخول بنجاح",
            token,
            user: {
                id: user.ID || user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ 
            message: "خطأ في الخادم",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// إعادة إرسال رمز التحقق
router.post('/resend-code', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "البريد الإلكتروني مطلوب" });
    }

    try {
        // التحقق من وجود المستخدم
        const [user] = await query("SELECT * FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "البريد الإلكتروني غير موجود" });
        }

        if (user.is_verified) {
            return res.status(400).json({ message: "تم التحقق من البريد الإلكتروني مسبقًا" });
        }

        // إنشاء رمز جديد
        const newCode = Math.floor(1000 + Math.random() * 9000).toString();
        const now = new Date();

        // تحديث الرمز ووقت الإرسال
        await query(
            "UPDATE users SET verification_code = ?, last_code_sent = ? WHERE email = ?",
            [newCode, now, email]
        );

        // إرسال البريد الإلكتروني
        await sendVerificationEmail(email, newCode);

        return res.status(200).json({ 
            message: "تم إعادة إرسال رمز التحقق بنجاح"
        });

    } catch (error) {
        console.error('Resend error:', error);
        return res.status(500).json({ 
            message: "فشل إعادة إرسال رمز التحقق"
        });
    }
});

/**
 * @route POST /forgot-password
 * @desc إرسال رمز استعادة كلمة المرور
 * @access عام
 */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    // التحقق من إدخال البريد الإلكتروني
    if (!email) {
        return res.status(400).json({ 
            success: false,
            message: "البريد الإلكتروني مطلوب"
        });
    }

    try {
        // التحقق من صيغة البريد الإلكتروني
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false,
                message: "صيغة البريد الإلكتروني غير صالحة"
            });
        }

        // البحث عن المستخدم في قاعدة البيانات
        const [users] = await query("SELECT * FROM users WHERE email = ?", [email]);
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "لا يوجد حساب مرتبط بهذا البريد الإلكتروني"
            });
        }

        const user = users[0];

        // التحقق من وقت آخر إرسال (منع الإرسال المتكرر)
        const lastSent = new Date(user.last_code_sent || 0);
        const now = new Date();
        const diffMinutes = (now - lastSent) / (1000 * 60);

        if (diffMinutes < 2) { // انتظر دقيقتين بين كل إرسال
            return res.status(429).json({
                success: false,
                message: "يجب الانتظار دقيقتين قبل إعادة المحاولة"
            });
        }

        // إنشاء رمز استعادة (6 أرقام)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // صلاحية ساعة واحدة

        // تحديث بيانات المستخدم في قاعدة البيانات
        await query(
            "UPDATE users SET reset_code = ?, reset_token = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 1 HOUR), last_code_sent = NOW() WHERE email = ?",
            [resetCode, resetToken, email]
        );

        // إرسال البريد الإلكتروني
        await sendPasswordResetEmail(email, resetCode);

        return res.status(200).json({
            success: true,
            message: "تم إرسال رمز الاستعادة إلى بريدك الإلكتروني",
            token: resetToken // لإستخدامه في الصفحة التالية
        });

    } catch (error) {
        console.error('خطأ في استعادة كلمة المرور:', error);
        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء محاولة استعادة كلمة المرور"
        });
    }
});;

// دالة إرسال بريد الاستعادة
async function sendPasswordResetEmail(email, resetCode) {
    try {
        const mailOptions = {
            from: `"دعم واتس سلة" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'استعادة كلمة المرور - واتس سلة',
            html: `
                <div style="font-family: 'Arial', sans-serif; text-align: right; direction: rtl; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="https://yourdomain.com/logo.png" alt="شعار واتس سلة" style="height: 60px;">
                    </div>
                    <h2 style="color: #34C435;">استعادة كلمة المرور</h2>
                    <p>مرحباً،</p>
                    <p>لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.</p>
                    <p>رمز الاستعادة الخاص بك هو:</p>
                    <div style="font-size: 24px; font-weight: bold; margin: 20px 0; padding: 15px; background: #f5f5f5; text-align: center; letter-spacing: 5px; color: #333;">
                        ${resetCode}
                    </div>
                    <p style="color: #888;">هذا الرمز صالح لمدة ساعة واحدة فقط.</p>
                    <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد أو التواصل مع الدعم الفني.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} واتس سلة. جميع الحقوق محفوظة.</p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`تم إرسال بريد استعادة كلمة المرور إلى: ${email}`, info.messageId);
        return true;
    } catch (error) {
        console.error('خطأ في إرسال البريد الإلكتروني:', error);
        throw new Error('فشل إرسال بريد الاستعادة');
    }
}

// Route محمية للاختبار
router.get('/protected', authenticateToken, async (req, res) => {
    try {
        const [user] = await query("SELECT ID, username, email FROM users WHERE ID = ?", [req.user.userId]);
        
        if (!user) {
            return res.status(404).json({ message: "المستخدم غير موجود" });
        }

        res.json({ 
            message: "تم الوصول إلى المسار المحمي بنجاح",
            user
        });
    } catch (error) {
        console.error('Protected route error:', error);
        res.status(500).json({ message: "خطأ في الخادم" });
    }
});

// clean expired tokens every one hour
async function cleanupExpiredTokens() {
    try {
        await query(
            "UPDATE users SET reset_code = NULL, reset_token = NULL, reset_token_expiry = NULL WHERE reset_token_expiry < ?",
            [Date.now()]
        );
    } catch (error) {
        console.error('Error cleaning up expired tokens:', error);
    }
}

// تشغيل التنظيف كل ساعة
setInterval(cleanupExpiredTokens, 3600000);

/**
 * @route POST /verify-reset-code
 * @desc التحقق من رمز إعادة التعيين
 * @access عام
 */
router.post('/verify-reset-code', async (req, res) => {
    const { email, resetCode } = req.body;

    if (!email || !resetCode) {
        return res.status(400).json({
            success: false,
            message: "البريد الإلكتروني ورمز التحقق مطلوبان"
        });
    }

    try {
        // استعلام معدل للتحقق من الصلاحية
        const [users] = await query(
            "SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_token_expiry > NOW()",
            [email, resetCode]
        );

        if (users.length === 0) {
            // تسجيل تفاصيل الخطأ للتصحيح
            const [dbUser] = await query(
                "SELECT reset_code, reset_token_expiry FROM users WHERE email = ?",
                [email]
            );
            
            console.log('تفاصيل الخطأ:', {
                email,
                providedCode: resetCode,
                dbCode: dbUser[0]?.reset_code,
                dbExpiry: dbUser[0]?.reset_token_expiry,
                currentTime: new Date()
            });
            
            return res.status(400).json({
                success: false,
                message: "رمز التحقق غير صحيح أو منتهي الصلاحية"
            });
        }

        // إنشاء توكن مؤقت لإعادة التعيين
        const tempToken = jwt.sign(
            { email, resetCode },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        return res.status(200).json({
            success: true,
            message: "تم التحقق من رمز الاستعادة بنجاح",
            tempToken
        });

    } catch (error) {
        console.error('خطأ في التحقق من رمز الاستعادة:', error);
        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء التحقق من رمز الاستعادة"
        });
    }
});;

/**
 * @route POST /reset-password
 * @desc تحديث كلمة المرور
 * @access عام
 */
router.post('/reset-password', async (req, res) => {
    const { email, resetCode, newPassword, tempToken } = req.body;

    if (!email || !resetCode || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "جميع الحقول مطلوبة"
        });
    }

    try {
        // التحقق من التوكن المؤقت إذا تم إرساله
        if (tempToken) {
            jwt.verify(tempToken, process.env.JWT_SECRET, (err) => {
                if (err) {
                    return res.status(401).json({
                        success: false,
                        message: "انتهت صلاحية جلسة الاستعادة، يرجى البدء من جديد"
                    });
                }
            });
        }

        // التحقق من قوة كلمة المرور الجديدة
        const passwordCheck = validatePasswordStrength(newPassword);
        if (!passwordCheck.isValid) {
            return res.status(400).json({
                success: false,
                message: "كلمة المرور الجديدة ضعيفة",
                requirements: passwordCheck.requirements
            });
        }

        // التحقق من رمز الاستعادة أولاً
        const [users] = await query(
            "SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_token_expiry > NOW()",
            [email, resetCode]
        );

        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                message: "رمز التحقق غير صحيح أو منتهي الصلاحية"
            });
        }

        // تشفير كلمة المرور الجديدة
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // تحديث كلمة المرور وإزالة رمز الاستعادة
        await query(
            "UPDATE users SET password = ?, reset_code = NULL, reset_token = NULL, reset_token_expiry = NULL WHERE email = ?",
            [hashedPassword, email]
        );

        // إرسال بريد التأكيد
        await sendPasswordChangeConfirmation(email);

        return res.status(200).json({
            success: true,
            message: "تم تحديث كلمة المرور بنجاح"
        });

    } catch (error) {
        console.error('خطأ في إعادة تعيين كلمة المرور:', error);
        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء إعادة تعيين كلمة المرور"
        });
    }
});

// دالة إرسال تأكيد تغيير كلمة المرور
async function sendPasswordChangeConfirmation(email) {
    try {
        const mailOptions = {
            from: `"دعم واتس سلة" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'تم تغيير كلمة المرور بنجاح - واتس سلة',
            html: `
                <div style="font-family: 'Arial', sans-serif; text-align: right; direction: rtl; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="logo.png" alt="شعار واتس سلة" style="height: 60px;">
                    </div>
                    <h2 style="color: #34C435;">تم تغيير كلمة المرور</h2>
                    <p>مرحباً،</p>
                    <p>تم تغيير كلمة المرور الخاصة بحسابك بنجاح.</p>
                    <p>إذا لم تقم بهذا التغيير، يرجى التواصل مع الدعم الفني فوراً.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999;">© ${new Date().getFullYear()} واتس سلة. جميع الحقوق محفوظة.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`تم إرسال تأكيد تغيير كلمة المرور إلى: ${email}`);
    } catch (error) {
        console.error('خطأ في إرسال بريد التأكيد:', error);
    }
}

router.get('/user-info', authenticateToken, async (req, res) => {
    try {
        console.log('Requested User ID:', req.user.userId); // سجل ID المستخدم المطلوب
        
        const [user] = await query(
            "SELECT id, username, email FROM users WHERE id = ?", 
            [req.user.userId]
        );
        
        if (!user) {
            console.error('User not found in database for ID:', req.user.userId);
            return res.status(404).json({ 
                success: false,
                message: "المستخدم غير موجود" 
            });
        }

        console.log('User data from DB:', user); // سجل بيانات المستخدم من قاعدة البيانات
        
        res.json({
            success: true,
            user: {
                id: user[0].ID,
                username: user[0].username,
                email: user[0].email
            }
        });

    } catch (error) {
        console.error('Error in /user-info:', error);
        res.status(500).json({ 
            success: false,
            message: "خطأ في الخادم" 
        });
    }
});
// Route للاختبار
router.get('/test', (req, res) => {
    res.json({ message: "مسارات المصادقة تعمل بشكل صحيح!" });
});

// معالج الأخطاء
router.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: "حدث خطأ غير متوقع" });
});

module.exports = {
    router,
    authenticateToken
};