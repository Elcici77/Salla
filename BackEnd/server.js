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
const whatsappRoutes = require("./routes/whatsapp");
const dashboardApiRoutes = require('./routes/dashboard.api');
const app = express();
const PORT = process.env.PORT || 5000;

// استيراد المسارات
const { webhookRouter, mainRouter: sallaRouter } = require('./routes/salla');
const { router: authRouter, authenticateToken } = require('./routes/auth');

// تكوين multer لرفع الصور
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'Uploads/profiles');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        if (!req.user || !req.user.userId) {
            return cb(new Error('المستخدم غير مصرح له'));
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + req.user.userId + '-' + uniqueSuffix + ext);
    }
});

const uploadDir = path.join(__dirname, 'Uploads/profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('تم إنشاء مجلد uploads/profiles بنجاح');
}

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('الرجاء تحميل ملف صورة فقط'), false);
        }
    }
});

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.static(path.join(__dirname, 'public')));
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

app.use('/api/salla/webhooks', express.raw({ type: 'application/json' }), webhookRouter);
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/salla', sallaRouter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardApiRoutes);
app.use('/Uploads', express.static(path.join(__dirname, 'Uploads')));
app.use("/api/whatsapp", whatsappRoutes);

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
            const [user] = await query(
                'SELECT profile_picture FROM users WHERE ID = ?',
                [req.user.userId]
            );
            if (!user || user.length === 0) {
                fs.unlinkSync(req.file.path);
                return res.status(404).json({
                    success: false,
                    message: 'المستخدم غير موجود'
                });
            }
            const currentUser = user[0];
            if (currentUser.profile_picture) {
                const oldImagePath = path.join(uploadDir, currentUser.profile_picture);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            await query(
                'UPDATE users SET profile_picture = ? WHERE ID = ?',
                [req.file.filename, req.user.userId]
            );
            res.json({
                success: true,
                message: 'تم رفع الصورة بنجاح',
                filename: req.file.filename,
                profile_url: `/Uploads/profiles/${req.file.filename}`
            });
        } catch (error) {
            console.error('Error uploading avatar:', error);
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({
                success: false,
                message: error.message || 'حدث خطأ أثناء رفع الصورة'
            });
        }
    }
);

app.delete(
    '/api/auth/remove-avatar',
    authenticateToken,
    async (req, res) => {
        try {
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
            if (!currentUser.profile_picture) {
                return res.status(400).json({
                    success: true,
                    message: 'لا توجد صورة لإزالتها'
                });
            }
            const imagePath = path.join(__dirname, 'Uploads', 'profiles', currentUser.profile_picture);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
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

app.put(
    '/api/auth/update-profile',
    authenticateToken,
    async (req, res) => {
        try {
            const { username, phone } = req.body;
            if (!username) {
                return res.status(400).json({
                    success: false,
                    message: 'اسم المستخدم مطلوب'
                });
            }
            if (phone && !/^\+?\d{10,15}$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'رقم الهاتف غير صالح'
                });
            }
            await query(
                'UPDATE users SET username = ?, phone = ? WHERE ID = ?',
                [username, phone || null, req.user.userId]
            );
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

app.use((err, req, res, next) => {
    console.error("Global error handler:", err);
    res.status(500).json({ 
        message: "حدث خطأ في الخادم",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'المسار غير موجود'
    });
});

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