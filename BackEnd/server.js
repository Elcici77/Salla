require("dotenv").config();
const express = require("express");
const bodyParser = require('body-parser');
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const path = require('path');
const app = express();
const PORT = process.env.PORT || 5000;

// استيراد المسارات
const { webhookRouter, mainRouter: sallaRouter } = require('./routes/salla');
const { router: authRouter, authenticateToken } = require('./routes/auth');

// ✅ Middleware CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));

// ✅ ملفات ستاتيك
app.use(express.static(path.join(__dirname, 'public')));

// ✅ جلسات و كوكيز
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

// ✅ تحميل Webhook قبل أي JSON parsing
app.use('/api/salla/webhooks', express.raw({ type: 'application/json' }), webhookRouter);

// ✅ Body Parser عادي لباقي المسارات
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ باقي المسارات
app.use('/api/salla', sallaRouter);
app.use('/api/auth', authRouter);

// ✅ صفحات الـ HTML
app.get("/", (req, res) => {
    res.send("الخادم يعمل...");
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
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

// ✅ Error Handling
app.use((err, req, res, next) => {
    console.error("Global error handler:", err);
    res.status(500).json({ 
        message: "حدث خطأ في الخادم",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ✅ تشغيل السيرفر
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
