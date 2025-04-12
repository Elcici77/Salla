const mysql = require('mysql2');

// إنشاء الاتصال الأساسي
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '5729053996mM',
  database: 'salla'
});

// إنشاء نسخة تدعم Promises
const promiseDb = db.promise();

// التحقق من الاتصال
db.connect((err) => {
  if (err) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
  } else {
    console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
  }
});

// تصدير كلا النسختين
module.exports = {
  // للاستخدام مع async/await (في salla.js)
  promise: promiseDb,
  
  // للاستخدام مع Callbacks (في باقي الملفات)
  regular: db
};