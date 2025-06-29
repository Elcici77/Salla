const express = require('express');
const crypto = require('crypto');
const { pool, query } = require('../db');
const { SallaAPI } = require('../services/salla.service');
const { authenticateToken } = require('./auth');
const axios = require('axios');
const qs = require('qs');
const router = express.Router();

const SALLA_CLIENT_ID = process.env.SALLA_CLIENT_ID;
const SALLA_CLIENT_SECRET = process.env.SALLA_CLIENT_SECRET;
const SALLA_REDIRECT_URI = process.env.SALLA_REDIRECT_URI || 'http://localhost:5000/api/salla/callback';

if (!SALLA_CLIENT_ID || !SALLA_CLIENT_SECRET || !SALLA_REDIRECT_URI) {
    console.error('Missing required environment variables for Salla OAuth');
    throw new Error('SALLA_CLIENT_ID, SALLA_CLIENT_SECRET, and SALLA_REDIRECT_URI must be set in .env');
}

const verifyWebhook = (req, res, next) => {
    const signature = req.headers['x-salla-signature'];
    const secret = process.env.SALLA_WEBHOOK_SECRET;

    if (!signature || !secret) {
        console.error('Webhook verification failed: Missing signature or secret');
        return res.status(403).send('Forbidden');
    }

    if (!Buffer.isBuffer(req.body)) {
        console.error('Webhook verification failed: Invalid body');
        return res.status(400).send('Invalid body');
    }

    const hmac = crypto.createHmac('sha256', secret)
        .update(req.body)
        .digest('hex');

    if (hmac !== signature) {
        console.error('Webhook verification failed: Invalid signature');
        return res.status(403).send('Invalid signature');
    }

    next();
};

router.post('/webhooks', verifyWebhook, async (req, res) => {
    try {
        const payload = JSON.parse(req.body.toString());
        console.log('Webhook payload:', JSON.stringify(payload, null, 2));
        const { event, data } = payload;

        console.log('Webhook event received:', event);

        switch (event) {
            case 'order.created':
                
                await handleOrderCreated(data);
                await handleCustomerData(data.customer, data.merchant_id);
                break;
                
            case 'order.updated':
                if (data.status === 'delivered') {
                    await handleOrderCompleted(data);
                }
                break;

            case 'app.installed':
                await handleAppInstalled(data);
                break;

            case 'customer.created':
                await handleCustomerData(data, data.merchant_id);
                break;
                
            default:
                console.log('Unhandled event type:', event);
        }

        res.status(200).send('Webhook processed successfully');
    } catch (err) {
        console.error('Webhook processing error:', {
            message: err.message,
            stack: err.stack,
            payload: req.body.toString()
        });
        res.status(500).send('Internal Server Error');
    }
});

async function handleOrderCreated(orderData) {
    try {
        if (!orderData.customer?.mobile) {
            console.log('Order has no customer mobile:', orderData.id);
            return;
        }

        const [cart] = await query(
            `SELECT id, user_id, merchant_id 
             FROM abandoned_carts 
             WHERE customer_phone = ? 
             AND user_id IS NOT NULL
             ORDER BY created_at DESC LIMIT 1`,
            [orderData.customer.mobile]
        );

        if (!cart) {
            console.log('No abandoned cart found for customer:', orderData.customer.mobile);
            return;
        }

        if (!cart.user_id) {
            console.error('Cart found but has no user_id:', cart.id);
            return;
        }

        await query(
            `INSERT INTO conversions 
             (user_id, cart_id, merchant_id, order_id, order_amount, status)
             VALUES (?, ?, ?, ?, ?, 'completed')`,
            [
                cart.user_id,
                cart.id,
                cart.merchant_id,
                orderData.id,
                orderData.amount || 0
            ]
        );
        console.log(`Conversion recorded for order ${orderData.id}`);
    } catch (error) {
        console.error('Failed to handle order creation:', {
            error: error.message,
            orderData: orderData
        });
        throw error;
    }
}

async function handleAppInstalled(storeData) {
    try {
        console.log('Starting app installation for store:', storeData.id);

        const [store] = await query(
            `SELECT access_token, refresh_token 
             FROM connected_stores 
             WHERE merchant_id = ? LIMIT 1`,
            [storeData.id]
        );

        if (!store) {
            console.log('No store found in database for merchant:', storeData.id, 'Skipping token verification.');
            return true;
        }

        if (store.access_token) {
            const isValid = await verifyTokenBasic(store.access_token);
            if (!isValid) {
                console.warn('Invalid access token for store:', storeData.id);
                return false;
            }
            console.log('Token verified successfully for store:', storeData.id);
        } else {
            console.log('No access token to verify for store:', storeData.id);
        }

        console.log('App installed successfully for store:', storeData.id);
        return true;
    } catch (error) {
        console.error('App installation handler failed:', {
            error: error.message,
            storeId: storeData?.id,
            stack: error.stack
        });
        return false;
    }
}

async function verifyTokenBasic(token) {
    if (!token) {
        console.error('No token provided for verification');
        return false;
    }

    try {
        const response = await axios.get('https://api.salla.dev/admin/v2/store/info', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: 5000
        });

        return response.data.data?.id ? true : false;
    } catch (error) {
        console.error('Token verification failed:', {
            status: error.response?.status,
            error: error.message
        });
        return false;
    }
}

async function handleCustomerData(customer, merchantId) {
    if (!customer || !customer.id) {
        console.error('Invalid customer data:', customer);
        return;
    }

    try {
        console.log('Updating customer:', {
            merchantId,
            customerId: customer.id,
            name: customer.name,
            mobile: customer.mobile,
            email: customer.email
        });

        const [result] = await query(
            `INSERT INTO customers 
             (merchant_id, customer_id, name, mobile, email, last_order_date)
             VALUES (?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
             name = COALESCE(VALUES(name), name),
             mobile = COALESCE(VALUES(mobile), mobile),
             email = COALESCE(VALUES(email), email),
             total_orders = total_orders + 1,
             last_order_date = NOW()`,
            [
                merchantId,
                customer.id,
                customer.name || null,
                customer.mobile || null,
                customer.email || null
            ]
        );

        console.log('Customer update result:', {
            affectedRows: result.affectedRows,
            changedRows: result.changedRows
        });
    } catch (error) {
        console.error('Failed to update customer:', {
            error: error.message,
            sql: error.sql,
            customer
        });
        throw error;
    }
}

async function verifyStoredTokens(merchantId) {
    const [store] = await query(
        `SELECT access_token, refresh_token 
         FROM connected_stores 
         WHERE merchant_id = ? LIMIT 1`,
        [merchantId]
    );

    if (!store || !store.access_token) {
        throw new Error('No tokens found in database');
    }

    return {
        accessToken: store.access_token,
        refreshToken: store.refresh_token
    };
}

router.post('/sync-customers', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('Starting customer sync for user:', userId);

        const [stores] = await query('SELECT * FROM connected_stores WHERE user_id = ?', [userId]);
        if (!stores.length) {
            console.log('No stores found for user:', userId);
            return res.status(404).json({ success: false, message: 'لم يتم العثور على متاجر مربوطة' });
        }

        const store = stores[0];
        console.log('Store found:', {
            merchantId: store.merchant_id,
            shopName: store.shop_name,
            hasAccessToken: !!store.access_token,
            hasRefreshToken: !!store.refresh_token
        });

        if (!store.access_token) {
            console.error('No access token found for store:', store.merchant_id);
            return res.status(400).json({ 
                success: false, 
                message: 'لا يوجد توكن وصول للمتجر. يرجى إعادة ربط المتجر.',
                action: 'reconnect'
            });
        }

        if (store.token_expiry && new Date(store.token_expiry) < new Date()) {
            console.log('Access token expired, attempting to refresh for store:', store.merchant_id);
            try {
                const tokenResponse = await axios.post('https://accounts.salla.sa/oauth2/token', {
                    client_id: process.env.SALLA_CLIENT_ID,
                    client_secret: process.env.SALLA_CLIENT_SECRET,
                    refresh_token: store.refresh_token,
                    grant_type: 'refresh_token'
                });

                const { access_token, refresh_token, expires_in } = tokenResponse.data;
                await query(
                    'UPDATE connected_stores SET access_token = ?, refresh_token = ?, token_expiry = ?, updated_at = NOW() WHERE merchant_id = ?',
                    [access_token, refresh_token, new Date(Date.now() + (expires_in || 3600) * 1000), store.merchant_id]
                );
                store.access_token = access_token;
                store.refresh_token = refresh_token;
                store.token_expiry = new Date(Date.now() + (expires_in || 3600) * 1000);
                console.log('Token refreshed successfully for store:', store.merchant_id);
            } catch (refreshError) {
                console.error('Failed to refresh token:', {
                    error: refreshError.message,
                    response: refreshError.response?.data
                });
                return res.status(401).json({ 
                    success: false, 
                    message: 'فشل في تجديد توكن الوصول. يرجى إعادة ربط المتجر.',
                    action: 'reconnect'
                });
            }
        }

        let allCustomers = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            console.log(`Fetching customers from Salla API for store: ${store.merchant_id}, page: ${page}`);
            const response = await axios.get('https://api.salla.dev/admin/v2/customers', {
                params: { page },
                headers: { 
                    'Authorization': `Bearer ${store.access_token}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            if (!response.data.success || !response.data.data) {
                console.error('Invalid API response:', response.data);
                return res.status(500).json({ 
                    success: false, 
                    message: 'استجابة غير صالحة من واجهة برمجة تطبيقات سلة'
                });
            }

            allCustomers = allCustomers.concat(response.data.data);
            hasMore = !!response.data.pagination?.links?.next_page_url;
            page++;
        }

        console.log('Total customers fetched:', allCustomers.length);

        let updatedCount = 0;
        for (const customer of allCustomers) {
            const name = customer.first_name && customer.last_name 
                ? `${customer.first_name} ${customer.last_name}`
                : customer.first_name || customer.last_name || 'غير متوفر';

            const customerData = {
                merchantId: store.merchant_id,
                customerId: customer.id,
                name,
                mobile: customer.mobile || null,
                email: customer.email || null
            };
            console.log('Updating customer:', customerData);

            const [result] = await query(
                `INSERT INTO customers 
                (merchant_id, customer_id, name, mobile, email, total_orders, total_spent, last_order_date) 
                VALUES (?, ?, ?, ?, ?, 0, 0.00, NULL) 
                ON DUPLICATE KEY UPDATE 
                name = VALUES(name), 
                mobile = VALUES(mobile), 
                email = VALUES(email), 
                updated_at = NOW()`,
                [customerData.merchantId, customerData.customerId, customerData.name, customerData.mobile, customerData.email]
            );
            console.log('Customer update result:', result);
            updatedCount++;
        }

        console.log('Customer sync completed successfully:', { updatedCount });
        res.json({ 
            success: true, 
            message: 'تمت مزامنة العملاء بنجاح', 
            count: updatedCount 
        });
    } catch (error) {
        console.error('Customer sync error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });

        if (error.response?.status === 403) {
            return res.status(403).json({ 
                success: false, 
                message: 'توكن الوصول غير مخول للوصول إلى بيانات العملاء. يرجى إعادة ربط المتجر.',
                action: 'reconnect'
            });
        } else if (error.response?.status === 429) {
            return res.status(429).json({ 
                success: false, 
                message: 'تم تجاوز حد الطلبات إلى واجهة برمجة تطبيقات سلة. حاول مرة أخرى لاحقًا.'
            });
        }

        res.status(500).json({ 
            success: false, 
            message: `فشل في مزامنة العملاء: ${error.message}` 
        });
    }
});

router.get('/connect', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.userId) {
            console.error('No user authenticated for connect request', {
                headers: req.headers,
                authHeader: req.headers['authorization']
            });
            return res.status(401).json({
                success: false,
                message: 'Authentication token is required'
            });
        }

        console.log('Connect request received for user:', {
            userId: req.user.userId,
            username: req.user.username
        });

        if (!SALLA_CLIENT_ID || !SALLA_CLIENT_SECRET || !SALLA_REDIRECT_URI) {
            console.error('Missing OAuth configuration', {
                clientId: SALLA_CLIENT_ID,
                clientSecret: SALLA_CLIENT_SECRET ? '[REDACTED]' : null,
                redirectUri: SALLA_REDIRECT_URI
            });
            return res.status(500).json({
                success: false,
                message: 'Server configuration error. Contact support.'
            });
        }

        const { userId } = req.user;
        const state = crypto.randomBytes(32).toString('hex');

        await query(
            `DELETE FROM store_connections 
             WHERE user_id = ? 
             AND status IN ('pending', 'failed')`,
            [userId]
        );

        await query(
            `INSERT INTO store_connections 
            (user_id, state, status, expires_at) 
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
            [userId, state, 'pending']
        );

        const scopes = ['offline_access'];

        const authUrl = `https://accounts.salla.sa/oauth2/auth?` +
            `client_id=${SALLA_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(SALLA_REDIRECT_URI)}&` +
            `response_type=code&` +
            `scope=${scopes.join(' ')}&` +
            `state=${state}&` +
            `approval_prompt=force&` +
            `access_type=offline`;

        res.json({ success: true, authUrl });
    } catch (error) {
        console.error('Connect error:', {
            userId: req.user?.userId,
            error: error.message,
            stack: error.stack,
            headers: req.headers
        });
        res.status(500).json({
            success: false,
            message: 'فشل في إنشاء رابط الربط. تحقق من الاتصال بالإنترنت أو حاول لاحقًا.',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

router.get('/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        console.error('OAuth error from Salla:', { error, state, query: req.query });
        if (state) {
            try {
                await query(
                    `UPDATE store_connections 
                     SET status = 'failed', 
                         error_message = ?, 
                         updated_at = NOW()
                     WHERE state = ?`,
                    [error, state]
                );
            } catch (dbError) {
                console.error('Failed to update connection status:', {
                    error: dbError.message,
                    stack: dbError.stack
                });
            }
        }
        const errorMessage = encodeURIComponent(error);
        return res.redirect(`/dashboard.html?error=auth_failed&reason-auth_failed&reason=${errorMessage}`);
    }

    if (!code || !state) {
        console.warn('Missing code or state parameter:', { code, state });
        return res.redirect('/dashboard.html?error=invalid_request');
    }

    try {
        const [connections] = await query(
            `SELECT * FROM store_connections 
             WHERE state = ? 
             AND status = 'pending' 
             AND expires_at > NOW() 
             LIMIT 1`,
            [state]
        );

        if (connections.length === 0) {
            console.error('Invalid or expired state:', state);
            return res.redirect('/dashboard.html?error=invalid_state');
        }

        const connection = connections[0];

        const tokenResponse = await axios.post(
            'https://accounts.salla.sa/oauth2/token',
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
                },
                timeout: 10000
            }
        ).catch(err => {
            console.error('Token exchange failed:', {
                error: err.message,
                response: err.response?.data,
                status: err.response?.status
            });
            throw new Error(`Failed to exchange code for token: ${err.message}`);
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;
        if (!access_token || !refresh_token) {
            console.error('Missing tokens in token response:', tokenResponse.data);
            throw new Error('No access_token or refresh_token received from Salla');
        }

        const storeInfo = await axios.get('https://api.salla.dev/admin/v2/store/info', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Accept': 'application/json'
            },
            timeout: 5000
        }).catch(err => {
            console.error('Failed to fetch store info:', {
                error: err.message,
                response: err.response?.data,
                status: err.response?.status
            });
            throw new Error(`Failed to fetch store info: ${err.message}`);
        });

        const merchantId = storeInfo.data.data.id;
        const shopName = storeInfo.data.data.name;
        console.log('Fetched store info:', { merchantId, shopName });

        const [existingStore] = await query(
            `SELECT user_id FROM connected_stores WHERE merchant_id = ?`,
            [merchantId]
        );
        if (existingStore.length > 0 && existingStore[0].user_id !== connection.user_id) {
            await query(
                `UPDATE store_connections 
                 SET status = 'failed', 
                     error_message = 'المتجر مربوط بحساب آخر', 
                     updated_at = NOW()
                 WHERE id = ?`,
                [connection.id]
            );
            return res.redirect('/dashboard.html?error=store_already_connected&message=' + encodeURIComponent('المتجر مربوط بحساب آخر. يرجى اختيار متجر آخر أو التواصل مع الدعم.'));
        }

        const dbConnection = await pool.getConnection();
        await dbConnection.beginTransaction();

        try {
            await dbConnection.query(
                `UPDATE store_connections 
                 SET merchant_id = ?, 
                     status = 'completed', 
                     error_message = NULL, 
                     updated_at = NOW()
                 WHERE id = ?`,
                [merchantId, connection.id]
            );
            console.log('Updated store_connections for connection:', connection.id);

            await dbConnection.query(
                `INSERT INTO connected_stores 
                 (user_id, merchant_id, access_token, refresh_token, shop_name, token_expiry, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE
                 access_token = VALUES(access_token),
                 refresh_token = VALUES(refresh_token),
                 shop_name = VALUES(shop_name),
                 token_expiry = VALUES(token_expiry),
                 updated_at = NOW()`,
                [
                    connection.user_id,
                    merchantId,
                    access_token,
                    refresh_token,
                    shopName,
                    new Date(Date.now() + (expires_in || 3600) * 1000)
                ]
            );
            console.log('Saved store data to connected_stores:', { merchantId });

            await dbConnection.commit();
            console.log('Database transaction committed successfully for merchant:', merchantId);

            return res.redirect(`/dashboard.html?connected=1&merchant_id=${merchantId}`);
        } catch (dbError) {
            await dbConnection.rollback();
            console.error('Database transaction failed:', {
                error: dbError.message,
                stack: dbError.stack,
                sql: dbError.sql
            });
            throw new Error(`Failed to save store data: ${dbError.message}`);
        } finally {
            dbConnection.release();
        }
    } catch (err) {
        console.error('Callback processing failed:', {
            error: err.message,
            stack: err.stack,
            code,
            state,
            response: err.response?.data
        });

        if (state) {
            try {
                await query(
                    `UPDATE store_connections 
                     SET status = 'failed', 
                         error_message = ?, 
                         updated_at = NOW()
                     WHERE state = ?`,
                    [err.message, state]
                );
            } catch (dbError) {
                console.error('Failed to update failed status:', {
                    error: dbError.message,
                    stack: dbError.stack
                });
            }
        }

        const errorMessage = encodeURIComponent(
            err.response?.data?.error?.message || 
            err.message || 
            'Unknown error'
        );
        return res.redirect(`/dashboard.html?error=server_error&message=${errorMessage}`);
    }
});

router.get('/stores', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        console.log(`Fetching stores for userId: ${userId}`);
        const [stores] = await query(
            'SELECT * FROM connected_stores WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        console.log('Stores fetched from connected_stores:', stores);
        res.json({ success: true, stores });
    } catch (error) {
        console.error('Stores error:', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'فشل في جلب المتاجر المربوطة' });
    }
});

router.delete('/stores/:storeId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const storeId = req.params.storeId;

        console.log(`Attempting to disconnect storeId: ${storeId} for userId: ${userId}`);
        const [stores] = await query(
            'SELECT * FROM connected_stores WHERE id = ? AND user_id = ?',
            [storeId, userId]
        );

        if (stores.length === 0) {
            console.warn(`Store not found or unauthorized: storeId: ${storeId}, userId: ${userId}`);
            return res.status(404).json({
                success: false,
                message: 'المتجر غير موجود أو لا تملك صلاحية فك ربطه'
            });
        }

        const dbConnection = await pool.getConnection();
        await dbConnection.beginTransaction();

        try {
            await dbConnection.query(
                'DELETE FROM connected_stores WHERE id = ? AND user_id = ?',
                [storeId, userId]
            );

            await dbConnection.query(
                'DELETE FROM store_connections WHERE user_id = ? AND merchant_id = ?',
                [userId, stores[0].merchant_id]
            );

            await dbConnection.commit();
            console.log('Store disconnected successfully:', { storeId, userId });

            res.json({ success: true, message: 'تم فك ربط المتجر بنجاح' });
        } catch (dbError) {
            await dbConnection.rollback();
            console.error('Disconnect error:', {
                error: dbError.message,
                stack: dbError.stack
            });
            throw new Error('Failed to disconnect store');
        } finally {
            dbConnection.release();
        }
    } catch (error) {
        console.error('Disconnect error:', {
            userId: req.user.userId,
            storeId: req.params.storeId,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ success: false, message: 'فشل في فك ربط المتجر' });
    }
});

module.exports = {
    webhookRouter: router,
    mainRouter: router
};