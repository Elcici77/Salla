const mysql = require('mysql2');

// إنشاء الاتصال بقاعدة البيانات
const db = mysql.createConnection({
    host: 'localhost', // العنوان (إذا كنت تستخدم سيرفر خارجي، ضعه هنا)
    user: 'root',      // اسم المستخدم الخاص بك
    password: '5729053996mM',      // كلمة المرور الخاصة بك 
    database: 'salla' // اسم قاعدة البيانات التي أنشأناها
});

// التحقق من الاتصال
db.connect((err) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
    }
});

// تصدير الاتصال لاستخدامه في الملفات الأخرى
module.exports = db;
