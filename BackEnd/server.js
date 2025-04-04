require("dotenv").config();
const express = require("express");
const bodyParser = require('body-parser');
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const db = require('./db'); 
const authRoutes = require('./routes/auth'); // استيراد مسارات المصادقة
const path = require('path');  // لإدارة المسارات بشكل صحيح
const app = express();
const PORT = process.env.PORT || 5000;

// استخدام CORS للسماح بالطلبات القادمة من الواجهة الأمامية على منفذ 3000
app.use(cors({
    origin: "http://localhost:3000", // السماح بالطلبات من هذا العنوان فقط
    credentials: true, // تفعيل إرسال الكوكيز مع الطلبات
}));

// خدمة الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));  // يمكن تعديل المجلد حسب المكان الذي خزنت فيه ملفات HTML و CSS

// تحليل البيانات القادمة من الطلبات
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// إعداد الجلسات
app.use(session({
    secret: process.env.SESSION_SECRET || "mysecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // اجعلها `true` عند استخدام HTTPS
}));

// استخدام مسارات المصادقة
app.use('/api/auth', authRoutes);

// نقطة البداية لاختبار الخادم
app.get("/", (req, res) => {
    res.send("🚀 الخادم يعمل...");
});

// تقديم صفحة التسجيل عند الوصول إلى /register
app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html')); // تأكد من وضع ملف register.html في مجلد public
});

// نقطة اختبار إضافية
app.get('/test', (req, res) => {
    res.json({ message: "✅ اختبار الخادم يعمل!" });
});

// اختبار اتصال قواعد البيانات
app.get("/db-test", (req, res) => {
    db.query("SELECT 1", (err, results) => {
        if (err) {
            console.error("خطأ في الاتصال بقاعدة البيانات:", err);
            return res.status(500).json({ message: "فشل الاتصال بقاعدة البيانات" });
        }
        res.json({ message: "✅ الاتصال بقاعدة البيانات تم بنجاح!" });
    });
});

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});
