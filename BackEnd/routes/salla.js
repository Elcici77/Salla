const express = require('express');
const crypto = require('crypto');
const { promise: db } = require('../db');
const { authenticateToken } = require('./auth');

// 🔄 Router واحد لكل شيء
const router = express.Router();

// ✅ Middleware للتحقق من التوقيع
const verifyWebhook = (req, res, next) => {
  const signature = req.headers['x-salla-signature'];
  const secret = process.env.SALLA_WEBHOOK_SECRET;

  if (!signature || !secret) {
    console.error('❌ توقيع أو سر غير موجود');
    return res.status(403).send('Forbidden');
  }

  if (!Buffer.isBuffer(req.body)) {
    console.error('❌ body is not a buffer!');
    return res.status(400).send('Invalid body');
  }

  const hmac = crypto.createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (hmac !== signature) {
    console.error('❌ التوقيع غير متطابق');
    return res.status(403).send('Invalid signature');
  }

  next();
};

// ✅ Webhook route
router.post(
  '/webhooks',
  verifyWebhook, // لاحظ حذف express.raw هنا لأنه موجود في server.js
  async (req, res) => {
    try {
      const payload = JSON.parse(req.body.toString());
      const { event, data } = payload;

      console.log('📦 Webhook event:', event);

      // معالجة أنواع الأحداث
      switch (event) {
        case 'order.created':
          console.log('🛒 طلب جديد:', data.id);
          // هنا تقدر تضيف الكود لتخزين الطلب أو إرساله لواتساب... إلخ
          break;
        default:
          console.log('📭 حدث غير معالج:', event);
      }

      res.status(200).send('Webhook received');
    } catch (err) {
      console.error('🔥 خطأ أثناء معالجة الويب هوك:', err);
      res.status(500).send('Internal Server Error');
    }
  }
);

// ✅ مسار الربط مع سلة
router.post('/connect', authenticateToken, async (req, res) => {
  const { userId } = req.user;

  const [result] = await db.query(
    `INSERT INTO store_connections (user_id) VALUES (?)`,
    [userId]
  );

  const authUrl = `https://salla.sa/oauth2/authorize?client_id=${process.env.SALLA_CLIENT_ID}&state=${result.insertId}`;

  res.json({
    success: true,
    authUrl,
    message: 'تم إنشاء رابط الربط مع سلة'
  });
});

// ✅ مسار جلب المتاجر المتصلة
router.get('/stores', authenticateToken, async (req, res) => {
  const { userId } = req.user;

  const [stores] = await db.query(
    `SELECT * FROM connected_stores WHERE user_id = ?`,
    [userId]
  );

  res.json({
    success: true,
    stores
  });
});

module.exports = {
  webhookRouter: router,
  mainRouter: router
};
