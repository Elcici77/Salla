require("dotenv").config();
const express = require("express");
const bodyParser = require('body-parser');
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('./db'); 
const app = express();
const PORT = process.env.PORT || 5000;

// استيراد المسارات
const { webhookRouter, mainRouter: sallaRouter } = require('./routes/salla');
const { router: authRouter, authenticateToken } = require('./routes/auth');

// تكوين multer لرفع الصور
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads/profiles');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // تأكد من أن req.user موجود من خلال middleware المصادقة
        if (!req.user || !req.user.userId) {
            return cb(new Error('المستخدم غير مصرح له'));
        }
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + req.user.userId + '-' + uniqueSuffix + ext);
    }
});

  
  // تأكد من وجود مجلد uploads
const uploadDir = path.join(__dirname, 'uploads/profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('تم إنشاء مجلد uploads/profiles بنجاح');
}

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('الرجاء تحميل ملف صورة فقط'), false);
        }
    }
});

//  Middleware CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));

//  ملفات ستاتيك
app.use(express.static(path.join(__dirname, 'public')));

//  جلسات و كوكيز
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || "mysecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

//  تحميل Webhook قبل أي JSON parsing
app.use('/api/salla/webhooks', express.raw({ type: 'application/json' }), webhookRouter);

// Body Parser عادي لباقي المسارات
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// باقي المسارات
app.use('/api/salla', sallaRouter);
app.use('/api/auth', authRouter);

// إعداد static files لخدمة ملفات الصور
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// مسار رفع صورة البروفايل
app.post(
    '/api/auth/upload-avatar',
    authenticateToken,
    upload.single('avatar'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'الرجاء اختيار صورة صالحة'
                });
            }

            // جلب بيانات المستخدم الحالية
            const [user] = await query(
                'SELECT profile_picture FROM users WHERE ID = ?',
                [req.user.userId]
            );

            if (!user || user.length === 0) {
                fs.unlinkSync(req.file.path); // حذف الصورة المرفوعة
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود'
                });
            }

            const currentUser = user[0];

            // حذف الصورة القديمة إذا كانت موجودة
            if (currentUser.profile_picture) {
                const oldImagePath = path.join(uploadDir, currentUser.profile_picture);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            // تحديث قاعدة البيانات باسم الملف الجديد
            await query(
                'UPDATE users SET profile_picture = ? WHERE ID = ?',
                [req.file.filename, req.user.userId]
            );

            res.json({
                success: true,
                message: 'تم رفع الصورة بنجاح',
                filename: req.file.filename,
                profile_url: `/uploads/profiles/${req.file.filename}`
            });
        } catch (error) {
            console.error('Error uploading avatar:', error);
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path); // حذف الصورة في حالة الخطأ
            }
            res.status(500).json({
                success: false,
                message: error.message || 'حدث خطأ أثناء رفع الصورة'
            });
        }
    }
);

// مسار إزالة صورة البروفايل
app.delete(
    '/api/auth/remove-avatar',
    authenticateToken,
    async (req, res) => {
        try {
            // جلب بيانات المستخدم الحالية
            const [user] = await query(
                'SELECT profile_picture FROM users WHERE ID = ?',
                [req.user.userId]
            );

            if (!user || user.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود'
                });
            }

            const currentUser = user[0];

            // التحقق مما إذا كانت هناك صورة لإزالتها
            if (!currentUser.profile_picture) {
                return res.status(400).json({
                    success: true,
                    message: 'لا توجد صورة لإزالتها'
                });
            }

            // حذف الصورة من المجلد
            const imagePath = path.join(__dirname, 'Uploads', 'profiles', currentUser.profile_picture);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            // تحديث قاعدة البيانات بإزالة اسم الملف
            await query(
                'UPDATE users SET profile_picture = NULL WHERE ID = ?',
                [req.user.userId]
            );

            res.json({
                success: true,
                message: 'تم إزالة الصورة بنجاح'
            });
        } catch (error) {
            console.error('Error removing avatar:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء إزالة الصورة'
            });
        }
    }
);

// مسار تحديث بيانات الملف الشخصي
app.put(
    '/api/auth/update-profile',
    authenticateToken,
    async (req, res) => {
        try {
            const { username, phone } = req.body;

            // التحقق من البيانات المدخلة
            if (!username) {
                return res.status(400).json({
                    success: false,
                    message: 'اسم المستخدم مطلوب'
                });
            }

            // التحقق من صحة رقم الهاتف إذا تم تقديمه
            if (phone && !/^\+?\d{10,15}$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'رقم الهاتف غير صالح'
                });
            }

            // تحديث قاعدة البيانات
            await query(
                'UPDATE users SET username = ?, phone = ? WHERE ID = ?',
                [username, phone || null, req.user.userId]
            );

            // جلب البيانات المحدثة
            const [updatedUser] = await query(
                'SELECT username, phone FROM users WHERE ID = ?',
                [req.user.userId]
            );

            if (!updatedUser || updatedUser.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود'
                });
            }

            res.json({
                success: true,
                message: 'تم تحديث البيانات بنجاح',
                username: updatedUser[0].username,
                phone: updatedUser[0].phone
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({
                success: false,
                message: 'حدث خطأ أثناء تحديث البيانات'
            });
        }
    }
);

//  صفحات الـ HTML
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'HomePage.html'));
});

app.get("/home", (req,res) => {
    res.sendFile(path.join(__dirname, 'public', 'HomePage.html'));
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// مسار لجلب بيانات البروفايل
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const [user] = await query(
            "SELECT ID, username, email, phone, profile_picture FROM users WHERE ID = ?",
            [req.user.userId]
        );
        
        if (!user || user.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'المستخدم غير موجود' 
            });
        }
        
        res.json({
            success: true,
            id: user[0].ID,
            username: user[0].username,
            email: user[0].email,
            phone: user[0].phone,
            profile_picture: user[0].profile_picture
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ 
            success: false,
            message: 'حدث خطأ في السيرفر' 
        });
    }
});

app.get("/verify-email", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'verify-email.html'));
});

app.get("/forgot-password", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forget-password.html'));
});

app.get("/reset-password", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.get("/dashboard", authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get("/profile", authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
//  Error Handling
app.use((err, req, res, next) => {
    console.error("Global error handler:", err);
    res.status(500).json({ 
        message: "حدث خطأ في الخادم",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

//  تشغيل السيرفر
const server = app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});
