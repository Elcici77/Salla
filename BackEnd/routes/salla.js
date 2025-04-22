const express = require('express');
const crypto = require('crypto');
const { pool, query } = require('../db');
const { authenticateToken } = require('./auth');
const axios = require('axios');
const qs = require('qs');
const router = express.Router();

const SALLA_CLIENT_ID = process.env.SALLA_CLIENT_ID;
const SALLA_CLIENT_SECRET = process.env.SALLA_CLIENT_SECRET;
const SALLA_REDIRECT_URI = process.env.SALLA_REDIRECT_URI || 'http://localhost:5000/api/salla/callback';

// التحقق من توقيع Webhook
const verifyWebhook = (req, res, next) => {
  const signature = req.headers['x-salla-signature'];
  const secret = process.env.SALLA_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return res.status(403).send('Forbidden');
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).send('Invalid body');
  }

  const hmac = crypto.createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (hmac !== signature) {
    return res.status(403).send('Invalid signature');
  }

  next();
};

// Webhook route
router.post('/webhooks', verifyWebhook, async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString());
    const { event, data } = payload;

    console.log('Webhook event:', event);

    switch (event) {
      case 'order.created':
        console.log('طلب جديد:', data.id);
        break;
      default:
        console.log('حدث غير معالج:', event);
    }

    res.status(200).send('Webhook received');
  } catch (err) {
    console.error('خطأ أثناء معالجة الويب هوك:', err);
    res.status(500).send('Internal Server Error');
  }
});


// في مسار /connect
router.get('/connect', authenticateToken, async (req, res) => {
  try {
      const { userId } = req.user;
      const state = crypto.randomBytes(32).toString('hex');

      await query(
          `INSERT INTO store_connections 
          (user_id, state, status, expires_at) 
          VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
          [userId, state, 'pending']
      );

      // استخدم هذه الصيغة المعدلة
      const authUrl = `https://accounts.salla.sa/oauth2/auth?` +
      `client_id=${process.env.SALLA_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(process.env.SALLA_REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=offline_access` + // ← الصيغة الصحيحة لشركاء سلة
      `&state=${state}` +
      `&approval_prompt=force` +
      `&access_type=offline`;

      res.json({ success: true, authUrl });
  } catch (error) {
      console.error('Connection error:', error);
      res.status(500).json({ 
          success: false, 
          message: 'فشل في إنشاء رابط الربط',
          error: process.env.NODE_ENV === 'development' ? error.message : null
      });
  }
});
// GET /callback - معالجة التحويل
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  try {
    if (error) {
      if (state) {
        await query('UPDATE store_connections SET status = ? WHERE state = ?', ['failed', state]);
      }
      return res.redirect('/dashboard?error=auth_failed&reason=' + encodeURIComponent(error));
    }

    if (!code || !state) {
      return res.redirect('/dashboard?error=invalid_request');
    }

    // 1. تحقق من state في قاعدة البيانات
    const [connections] = await query(
      `SELECT * FROM store_connections 
       WHERE state = ? AND status = 'pending' AND expires_at > NOW() LIMIT 1`,
      [state]
    );

    if (connections.length === 0) {
      return res.redirect('/dashboard?error=invalid_state');
    }

    const connection = connections[0];

    // 2. تبادل الكود مع التوكن
    const tokenResponse = await axios.post('https://accounts.salla.sa/oauth2/token', 
      qs.stringify({
        client_id: process.env.SALLA_CLIENT_ID,
        client_secret: process.env.SALLA_CLIENT_SECRET,
        code,
        redirect_uri: process.env.SALLA_REDIRECT_URI,
        grant_type: 'authorization_code'
      }), 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // 3. طلب معلومات المتجر باستخدام التوكن
    const storeInfo = await axios.get('https://api.salla.dev/admin/v2/store/info', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    // 4. حفظ البيانات
    await query(
      `UPDATE store_connections 
       SET merchant_id = ?, access_token = ?, refresh_token = ?, 
           expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND), status = 'completed' 
       WHERE id = ?`,
      [
        storeInfo.data.data.id,
        access_token,
        refresh_token,
        expires_in || 3600,
        connection.id
      ]
    );

    await query(
      `INSERT INTO connected_stores 
       (user_id, merchant_id, access_token, refresh_token, shop_name) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        connection.user_id,
        storeInfo.data.data.id,
        access_token,
        refresh_token,
        storeInfo.data.data.name
      ]
    );

    return res.redirect('/dashboard.html?connected=1');

  } catch (err) {
    console.error('Full callback error:', {
      message: err.message,
      response: err.response?.data,
      stack: err.stack
    });

    if (state) {
      await query('UPDATE store_connections SET status = ? WHERE state = ?', ['failed', state]);
    }

    const errorMessage = err.response?.data?.error || err.message;
    return res.redirect(`/dashboard?error=server_error&message=${encodeURIComponent(errorMessage)}`);
  }
});


// GET /stores - جلب المتاجر المرتبطة
router.get('/stores', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const [stores] = await query(
      'SELECT * FROM connected_stores WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json({ success: true, stores });
  } catch (error) {
    console.error('Stores error:', error);
    res.status(500).json({ success: false, message: 'فشل في جلب المتاجر المربوطة' });
  }
});

// DELETE /stores/:storeId - فك الربط
router.delete('/stores/:storeId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const storeId = req.params.storeId;

    const [stores] = await query(
      'SELECT * FROM connected_stores WHERE id = ? AND user_id = ?',
      [storeId, userId]
    );

    if (stores.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'المتجر غير موجود أو لا تملك صلاحية فك ربطه'
      });
    }

    await query('DELETE FROM connected_stores WHERE id = ?', [storeId]);

    res.json({ success: true, message: 'تم فك ربط المتجر بنجاح' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ success: false, message: 'فشل في فك ربط المتجر' });
  }
});

module.exports = {
  webhookRouter: router,
  mainRouter: router
};
