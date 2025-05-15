const express = require('express');
const { getDashboardData } = require('../controllers/dashboard.controller');
const { authenticateToken } = require('./auth');
const { query, pool } = require('../db');
const whatsappService = require('../services/whatsapp.service');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            console.error('No user authenticated for dashboard request');
            return res.status(401).json({
                success: false,
                error: 'Authentication token is required'
            });
        }

        const { period = 'week', merchant_id } = req.query;
        const data = await getDashboardData(req.user.userId, period, merchant_id);
        
        res.status(200).json({
            success: true,
            store_name: data.store_name || null,
            stats: [data.stats] || [{}],
            recent_carts: data.recent_carts || [],
            chartData: data.chartData || { labels: [], values: [] }
        });
    } catch (error) {
        console.error('Dashboard API error:', {
            userId: req.user?.userId,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: true,
            store_name: null,
            stats: {
                abandoned_carts: 0,
                carts_value: 0,
                conversions: 0
            },
            recent_carts: [],
            chartData: { labels: [], values: [] }
        });
    }
});

router.get('/customers', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { merchant_id } = req.query;
        console.log('Fetching customers for user:', userId, 'Merchant:', merchant_id);

        const [stores] = await query(
            'SELECT merchant_id FROM connected_stores WHERE user_id = ? AND merchant_id = ?',
            [userId, merchant_id]
        );
        if (!stores || !Array.isArray(stores) || stores.length === 0) {
            console.log('No store found for user:', userId, 'Merchant:', merchant_id);
            return res.status(200).json({ success: true, customers: [] });
        }

        const merchantId = stores[0].merchant_id;
        console.log('Fetching customers for merchant:', merchantId);

        const [customers] = await query(
            'SELECT name, mobile, email, total_orders, total_spent, last_order_date FROM customers WHERE merchant_id = ?',
            [merchantId]
        );

        console.log('Customers fetched:', customers || []);
        return res.status(200).json({ success: true, customers: Array.isArray(customers) ? customers : [] });
    } catch (error) {
        console.error('Error fetching customers:', {
            message: error.message,
            stack: error.stack,
            userId: req.user?.userId
        });
        return res.status(500).json({ success: false, message: 'فشل في جلب بيانات العملاء: ' + error.message });
    }
});

router.get('/top-customers', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { merchant_id } = req.query;
        console.log('Fetching top customers for user:', userId, 'Merchant:', merchant_id);

        if (!merchant_id) {
            console.error('Merchant ID is required for top customers');
            return res.status(400).json({ success: false, message: 'Merchant ID is required' });
        }

        const [stores] = await query(
            'SELECT merchant_id FROM connected_stores WHERE user_id = ? AND merchant_id = ?',
            [userId, merchant_id]
        );
        if (!stores || !Array.isArray(stores) || stores.length === 0) {
            console.log('No store found for user:', userId, 'Merchant:', merchant_id);
            return res.status(200).json({ success: true, customers: [] });
        }

        const [customers] = await query(
            `SELECT 
                c.name,
                c.mobile,
                COUNT(ac.id) as cart_count
             FROM customers c
             LEFT JOIN abandoned_carts ac ON c.id = ac.customer_id AND ac.merchant_id = ?
             WHERE c.merchant_id = ?
             GROUP BY c.id, c.name, c.mobile
             ORDER BY cart_count DESC
             LIMIT 5`,
            [merchant_id, merchant_id]
        );

        console.log('Top customers fetched:', customers || []);
        return res.status(200).json({ success: true, customers: Array.isArray(customers) ? customers : [] });
    } catch (error) {
        console.error('Error fetching top customers:', {
            message: error.message,
            stack: error.stack,
            userId: req.user?.userId
        });
        return res.status(500).json({ success: false, message: 'فشل في جلب بيانات العملاء: ' + error.message });
    }
});

// في مسار /abandoned-carts
router.get('/abandoned-carts', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        
        const userId = req.user.userId;
        const { merchant_id, period = 'week' } = req.query; 

        // تحويل الفترة إلى وحدة زمنية صحيحة
        const timeUnit = getValidTimeUnit(period);
        
        // احذف شرط الفترة الزمنية تمابمًا:
        const [carts] = await query(
            `SELECT 
                id, cart_id, customer_name, customer_phone, 
                customer_image, total, products_count, status,
                created_at, last_sync_at
             FROM abandoned_carts 
             WHERE user_id = ? AND merchant_id = ?`,
            [userId, merchant_id]
        );

        res.json({ 
            success: true, 
            data: carts || [] // تأكد من إرجاع مصفوفة حتى لو كانت فارغة
        });
    } catch (error) {
        console.error('Error in abandoned carts API:', {
            error: error.message,
            userId: req.user?.userId,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message
        });
    }
});

// دالة مساعدة لتحويل الفترة إلى وحدة زمنية صالحة
function getValidTimeUnit(period) {
    const periods = {
        'daily': 'DAY',
        'day': 'DAY',
        'weekly': 'WEEK',
        'week': 'WEEK',
        'monthly': 'MONTH',
        'month': 'MONTH',
        'yearly': 'YEAR',
        'year': 'YEAR'
    };
    return periods[period.toLowerCase()] || 'WEEK'; // القيمة الافتراضية WEEK
}

router.post('/abandoned-carts/sync', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const userId = req.user.userId;
        const { merchant_id} = req.body;

        if (!merchant_id) {
            return res.status(400).json({ success: false, message: 'Merchant ID is required' });
        }

        const [stores] = await query(
            'SELECT access_token, refresh_token, token_expiry FROM connected_stores WHERE user_id = ? AND merchant_id = ?',
            [userId, merchant_id]
        );

        if (stores.length === 0) {
            return res.status(404).json({ success: false, message: 'Store not found' });
        }

        const { access_token, refresh_token, token_expiry } = stores[0];
        let sallaApi = new SallaAPI(merchant_id, access_token, refresh_token);

        // Check if token is expired
        if (token_expiry && new Date(token_expiry) < new Date()) {
            console.log('Access token expired, attempting to refresh for merchant:', merchant_id);
            const tokenRefreshed = await sallaApi.refreshAccessToken();
            if (!tokenRefreshed) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Failed to refresh token. Please reconnect the store.',
                    action: 'reconnect'
                });
            }
        }

        // Fetch abandoned carts from Salla API
         // استبدل هذا الجزء:
         const sallaCarts = await sallaApi.getAbandonedCarts();
        
         // بهذا إذا كنت تريد استخدام البيانات المحلية فقط:
        //  const [localCarts] = await query(
        //      `SELECT * FROM abandoned_carts 
        //       WHERE user_id = ? AND merchant_id = ?`,
        //      [userId, merchant_id]
        //  );

        let updatedCount = 0;
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            for (const cart of sallaCarts) {
                const [existing] = await connection.query(
                    'SELECT id FROM abandoned_carts WHERE cart_id = ? AND user_id = ? AND merchant_id = ?',
                    [cart.id, userId, merchant_id]
                );

                const cartData = {
                    user_id: userId,
                    merchant_id: merchant_id,
                    cart_id: cart.id,
                    customer_name: cart.customer?.name || null,
                    customer_phone: cart.customer?.mobile || null,
                    customer_image: cart.customer?.image || null,
                    total: parseFloat(cart.total) || 0,
                    products_count: cart.products_count || 0,
                    status: cart.status || 'pending',
                    created_at: cart.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
                    last_sync_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                };

                if (existing.length === 0) {
                    await connection.query(
                        `INSERT INTO abandoned_carts (
                            user_id, merchant_id, cart_id, customer_name, customer_phone, customer_image,
                            total, products_count, status, created_at, last_sync_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            cartData.user_id,
                            cartData.merchant_id,
                            cartData.cart_id,
                            cartData.customer_name,
                            cartData.customer_phone,
                            cartData.customer_image,
                            cartData.total,
                            cartData.products_count,
                            cartData.status,
                            cartData.created_at,
                            cartData.last_sync_at
                        ]
                    );
                    updatedCount++;
                } else {
                    await connection.query(
                        `UPDATE abandoned_carts
                         SET customer_name = ?, customer_phone = ?, customer_image = ?,
                             total = ?, products_count = ?, status = ?, last_sync_at = ?
                         WHERE cart_id = ? AND user_id = ? AND merchant_id = ?`,
                        [
                            cartData.customer_name,
                            cartData.customer_phone,
                            cartData.customer_image,
                            cartData.total,
                            cartData.products_count,
                            cartData.status,
                            cartData.last_sync_at,
                            cartData.cart_id,
                            cartData.user_id,
                            cartData.merchant_id
                        ]
                    );
                    updatedCount++;
                }
            }

            await connection.commit();
            console.log(`Sync completed successfully:`, { updatedCount });
            res.json({ success: true, message: `Synced ${updatedCount} carts`, data: { updatedCount } });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error syncing abandoned carts:', { 
            userId: req.user?.userId, 
            merchantId: req.body.merchant_id, 
            error: error.message, 
            stack: error.stack 
        });
        if (error.response?.status === 401) {
            return res.status(401).json({ 
                success: false, 
                message: 'Unauthorized: Invalid or expired token. Please reconnect the store.',
                action: 'reconnect'
            });
        }
        if (error.response?.status === 403) {
            return res.status(403).json({ 
                success: false, 
                message: 'Forbidden: Missing required permissions. Please reconnect the store with correct scopes.',
                action: 'reconnect'
            });
        }
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
});

router.get('/local-carts', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { merchant_id } = req.query;

        const [carts] = await query(
            `SELECT 
                id, cart_id, customer_name, customer_phone,
                customer_image, total, products_count, status,
                created_at, last_sync_at
             FROM abandoned_carts
             WHERE user_id = ? AND merchant_id = ?`,
            [userId, merchant_id]
        );

        res.json({ 
            success: true, 
            data: carts || []
        });

    } catch (error) {
        console.error('Error fetching local carts:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch local carts'
        });
    }
});

module.exports = router;