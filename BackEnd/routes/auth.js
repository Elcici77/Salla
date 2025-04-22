const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool, query } = require('../db');
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

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
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

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
    const { username, email, password, phone } = req.body;

    if (!username || !email || !password || !phone) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
    }

    try {
        // التحقق من وجود البريد الإلكتروني
        const [existingUsers] = await query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "البريد الإلكتروني مستخدم بالفعل" });
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

        console.log('Token created with userId:', result.insertId);

        // إرسال بريد التحقق
        await sendVerificationEmail(email, verificationCode);

        return res.status(201).json({
            message: "تم التسجيل بنجاح. يرجى التحقق من بريدك الإلكتروني.",
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            message: "خطأ في الخادم",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// أضف هذه الدوال في ملف auth.js

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
        // البحث عن المستخدم في قاعدة البيانات
        const [user] = await query("SELECT * FROM users WHERE email = ?", [email]);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "لا يوجد حساب مرتبط بهذا البريد الإلكتروني"
            });
        }

        // إنشاء رمز استعادة (6 أرقام)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = Date.now() + 3600000; // صلاحية ساعة واحدة

        // تحديث بيانات المستخدم في قاعدة البيانات
        await query(
            "UPDATE users SET reset_code = ?, reset_token_expiry = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE email = ?",
            [resetCode, email]
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
});

// دالة إرسال بريد الاستعادة
async function sendPasswordResetEmail(email, resetCode) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'استعادة كلمة المرور',
            html: `
                <div style="font-family: 'HONORSansArabicUI-DB', sans-serif; text-align: right; direction: rtl;">
                    <h2 style="color: #007BFF;">استعادة كلمة المرور</h2>
                    <p>لقد تلقيت طلبًا لإعادة تعيين كلمة المرور الخاصة بحسابك.</p>
                    <p>رمز الاستعادة الخاص بك هو:</p>
                    <div style="font-size: 24px; font-weight: bold; margin: 20px 0; padding: 10px; background: #f5f5f5; text-align: center;">
                        ${resetCode}
                    </div>
                    <p>هذا الرمز صالح لمدة ساعة واحدة فقط.</p>
                    <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log('تم إرسال بريد استعادة كلمة المرور إلى:', email);
    } catch (error) {
        console.error('خطأ في إرسال البريد الإلكتروني:', error);
        throw error;
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

    try {
        // استعلام معدل للتحقق من الصلاحية
        const [user] = await query(
            "SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_token_expiry > NOW()",
            [email, resetCode]
        );

        if (!user) {
            // إضافة سجلات للتصحيح
            const [dbUser] = await query(
                "SELECT reset_code, reset_token_expiry FROM users WHERE email = ?",
                [email]
            );
            console.log('رمز التحقق في DB:', dbUser.reset_code);
            console.log('وقت الانتهاء في DB:', dbUser.reset_token_expiry);
            console.log('الوقت الحالي:', new Date());
            
            return res.status(400).json({
                success: false,
                message: "رمز التحقق غير صحيح أو منتهي الصلاحية"
            });
        }

        return res.status(200).json({
            success: true,
            message: "تم التحقق من رمز الاستعادة بنجاح"
        });

    } catch (error) {
        console.error('خطأ في التحقق من رمز الاستعادة:', error);
        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء التحقق من رمز الاستعادة"
        });
    }
});

/**
 * @route POST /reset-password
 * @desc تحديث كلمة المرور
 * @access عام
 */
router.post('/reset-password', async (req, res) => {
    const { email, resetCode, newPassword } = req.body;

    try {
        // التحقق من رمز الاستعادة أولاً
        const [user] = await query(
            "SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_token_expiry > ?",
            [email, resetCode, Date.now()]
        );

        if (!user) {
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