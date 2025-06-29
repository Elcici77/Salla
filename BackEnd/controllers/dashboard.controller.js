const { pool, query } = require('../db');
const { initializeAPI } = require('../services/salla.service');
const { getAbandonedCartsData } = require('../services/dashboard.service');
const axios = require('axios');

async function getDashboardData(userId, period = 'weekly', merchantId) {
    try {
        // 1. Fetch basic store data
        // 1. جلب بيانات المتجر الأساسية
        const [stores] = await query(
            `SELECT merchant_id, shop_name 
             FROM connected_stores 
             WHERE user_id = ? AND merchant_id = ? LIMIT 1`,
            [userId, merchantId]
        );

        if (!stores || stores.length === 0) {
            return {
                success: true,
                store_name: null,
                stats: {
                    abandoned_carts: 0,
                    carts_value: 0,
                    conversions: 0
                },
                recent_carts: [],
                chartData: { labels: [], values: [] }
            };
        }

        const store = stores[0];

        // 2. جلب الإحصائيات الأساسية
        const [stats] = await query(
            `SELECT 
                (SELECT COUNT(id) FROM abandoned_carts 
                 WHERE user_id = ? AND merchant_id = ? AND status = 'pending') as abandoned_carts,
                
                (SELECT COALESCE(SUM(total), 0) FROM abandoned_carts 
                 WHERE user_id = ? AND merchant_id = ? AND status = 'pending') as carts_value,
                
                (SELECT COUNT(id) FROM conversions 
                 WHERE user_id = ? AND merchant_id = ? AND status = 'completed') as conversions
            `,
            [userId, merchantId, userId, merchantId, userId, merchantId]
        );

        // 3. جلب آخر 5 سلات
        const [carts] = await query(
            `SELECT 
                ac.customer_name,
                ac.customer_phone,
                ac.total,
                ac.products_count,
                ac.status,
                ac.created_at,
                TIMESTAMPDIFF(HOUR, ac.created_at, NOW()) as hours_old
             FROM abandoned_carts ac
             WHERE ac.user_id = ? AND ac.merchant_id = ?
             ORDER BY ac.created_at DESC 
             LIMIT 5`,
            [userId, merchantId]
        );

        // 4. جلب بيانات الرسم البياني
        const chartData = await getAbandonedCartsData([{ user_id: userId, merchant_id: merchantId }], period);

        return {
            success: true,
            store_name: store.shop_name,
            stats: {
                abandoned_carts: stats.abandoned_carts || 0,
                carts_value: stats.carts_value || 0,
                conversions: stats.conversions || 0
            },
            recent_carts: carts || [],
            chartData: chartData.chartData || { labels: [], values: [] }
        };

    } catch (error) {
        console.error('Dashboard data error:', {
            userId,
            merchantId,
            error: error.message,
            stack: error.stack
        });
        return {
            success: true,
            store_name: null,
            stats: {
                abandoned_carts: 0,
                carts_value: 0,
                conversions: 0
            },
            recent_carts: [],
            chartData: { labels: [], values: [] }
        };
    }
}

async function fetchFreshSallaData(merchantId, accessToken, period) {
    try {
        const [cartsResponse] = await Promise.all([
            axios.get(`https://api.salla.dev/admin/v2/abandoned-carts?period=${period}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }).catch(error => {
                console.error('Failed to fetch abandoned carts:', {
                    merchantId,
                    error: error.message,
                    status: error.response?.status
                });
                return { data: { data: [] } };
            })
        ]);

        return {
            carts: cartsResponse.data.data || []
        };
    } catch (error) {
        console.error('fetchFreshSallaData error:', {
            merchantId,
            period,
            error: error.message,
            stack: error.stack
        });
        return {
            carts: []
        };
    }
}

async function updateLocalDatabase(userId, freshData) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
        const now = new Date().toISOString();

        for (const cart of freshData.carts) {
            try {
                if (!cart.merchant_id || !cart.id) {
                    console.warn('Skipping invalid cart:', { cartId: cart.id, merchantId: cart.merchant_id });
                    continue;
                }

                const cartData = {
                    user_id: userId,
                    merchant_id: cart.merchant_id,
                    cart_id: cart.id,
                    customer_name: cart.customer?.name || null,
                    customer_phone: cart.customer?.mobile || null,
                    customer_image: cart.customer?.image || null,
                    total: cart.total || 0,
                    products_count: cart.products?.length || 0,
                    status: cart.status || 'pending',
                    created_at: cart.created_at || now,
                    updated_at: now,
                    last_sync_at: now,
                    salla_updated_at: cart.updated_at || cart.created_at || now
                };

                const [result] = await connection.query(
                    `INSERT INTO abandoned_carts 
                    (user_id, merchant_id, cart_id, customer_name, customer_phone, 
                     customer_image, total, products_count, status,
                     created_at, updated_at, last_sync_at, salla_updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    customer_name = COALESCE(VALUES(customer_name), customer_name),
                    customer_phone = COALESCE(VALUES(customer_phone), customer_phone),
                    customer_image = COALESCE(VALUES(customer_image), customer_image),
                    total = GREATEST(VALUES(total), total),
                    products_count = VALUES(products_count),
                    status = CASE 
                        WHEN VALUES(salla_updated_at) > COALESCE(salla_updated_at, '1970-01-01') 
                        THEN VALUES(status) 
                        ELSE status 
                    END,
                    updated_at = VALUES(updated_at),
                    last_sync_at = VALUES(last_sync_at),
                    salla_updated_at = COALESCE(VALUES(salla_updated_at), salla_updated_at)`,
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
                        cartData.updated_at,
                        cartData.last_sync_at,
                        cartData.salla_updated_at
                    ]
                );

            } catch (error) {
                console.error('Failed to update cart:', {
                    cartId: cart.id,
                    error: error.message,
                    stack: error.stack
                });
            }
        }

        await connection.commit();

    } catch (error) {
        console.error('updateLocalDatabase error:', {
            userId,
            error: error.message,
            stack: error.stack
        });
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function getLocalAbandonedCarts(userId, period, merchantId) {
    try {

        const timeUnit = getValidTimeUnit(period);

        const [carts] = await query(
            `SELECT * FROM abandoned_carts 
             WHERE user_id = ? AND merchant_id = ?
             AND created_at >= DATE_SUB(NOW(), INTERVAL 1 ${timeUnit})`,
            [userId, merchantId]
        );

        return {
            items: carts || [],
            totalValue: carts.reduce((sum, cart) => sum + parseFloat(cart.total || 0), 0)
        };
    } catch (error) {
        console.error('getLocalAbandonedCarts error:', {
            userId,
            period,
            merchantId,
            error: error.message,
            stack: error.stack
        });
        return {
            items: [],
            totalValue: 0
        };
    }
}

function getEmptyDashboardData() {
    return {
        success: true,
        store_name: null,
        stats: {
            abandoned_carts: 0,
            carts_value: 0,
            conversions: 0
        },
        recent_carts: [],
        chartData: {
            labels: [],
            values: []
        }
    };
}

module.exports = {
    getDashboardData,
    fetchFreshSallaData,
    updateLocalDatabase,
    getLocalAbandonedCarts,
    getEmptyDashboardData
};