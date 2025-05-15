const { query } = require('../db');
const axios = require('axios');
const sallaService = require('./salla.service');

// دالة لتحديد وحدة الفترة الزمنية لاستعلام SQL
function getPeriodInterval(period) {
    switch (period) {
        case 'weekly':
            return 'WEEK';
        case 'monthly':
            return 'MONTH';
        case 'yearly':
            return 'YEAR';
        default:
            return 'WEEK'; // افتراضي: أسبوعي
    }
}

async function getAbandonedCartsData(stores, period = 'weekly') {
    try {
        // جلب البيانات من جدول abandoned_carts بدلاً من السلة مباشرة
        const [carts] = await query(
            `SELECT * FROM abandoned_carts 
             WHERE user_id = ? 
             AND created_at >= DATE_SUB(NOW(), INTERVAL 1 ${getPeriodInterval(period)})`,
            [stores[0].user_id]
        );

        const chartData = processChartData(carts, period);

        return {
            totalValue: carts.reduce((sum, cart) => sum + parseFloat(cart.total), 0),
            chartData
        };

    } catch (error) {
        console.error('Error in getAbandonedCartsData:', error);
        return {
            totalValue: 0,
            chartData: { labels: [], values: [] }
        };
    }
}

function processChartData(carts, period) {
    const daysMap = {
        'الأحد': 0, 'الإثنين': 1, 'الثلاثاء': 2,
        'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6
    };

    const result = Array(7).fill(0);
    
    carts.forEach(cart => {
        const dayIndex = daysMap[new Date(cart.created_at).toLocaleDateString('ar-SA', { weekday: 'long' })];
        result[dayIndex] += parseFloat(cart.total);
    });

    return {
        labels: Object.keys(daysMap),
        values: result
    };
}

async function getMessagesStatsData(stores) {
    try {
        // جلب إحصائيات الرسائل من قاعدة البيانات
        const [stats] = await query(
            `SELECT 
                COUNT(*) as sent,
                SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) as read
             FROM messages
             WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)`,
            [stores[0].user_id]
        );

        const sent = stats[0]?.sent || 0;
        const read = stats[0]?.read || 0;

        return {
            sent,
            read,
            read_rate: sent > 0 ? Math.round((read / sent) * 100) : 0
        };

    } catch (error) {
        console.error('Error in getMessagesStatsData:', error);
        return { sent: 0, read: 0, read_rate: 0 };
    }
}

async function getTopAbandonedCarts(stores, limit = 5) {
    try {
        const [carts] = await query(
            `SELECT * FROM abandoned_carts 
             WHERE user_id = ?
             ORDER BY total DESC
             LIMIT ?`,
            [stores[0].user_id, limit]
        );

        return carts.map(cart => ({
            customer: {
                name: cart.customer_name || 'زائر',
                phone: cart.customer_phone,
                image: cart.customer_image
            },
            created_at: cart.created_at,
            cart_age: getCartAge(cart.created_at),
            products_count: cart.products_count,
            total: cart.total,
            status: cart.status || 'pending'
        }));

    } catch (error) {
        console.error('Error in getTopAbandonedCarts:', error);
        return [];
    }
}

function getCartAge(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} يوم` : 'أقل من يوم';
}

async function getTopCustomers(stores, limit = 5) {
    try {
        const [customers] = await query(
            `SELECT 
                customer_name as name,
                customer_phone as phone,
                customer_image as image,
                COUNT(*) as abandoned_carts_count
             FROM abandoned_carts
             WHERE user_id = ? AND customer_phone IS NOT NULL
             GROUP BY customer_phone
             ORDER BY abandoned_carts_count DESC
             LIMIT ?`,
            [stores[0].user_id, limit]
        );

        return customers.map(customer => ({
            customer: {
                name: customer.name,
                phone: customer.phone,
                image: customer.image
            },
            abandoned_carts_count: customer.abandoned_carts_count
        }));

    } catch (error) {
        console.error('Error in getTopCustomers:', error);
        return [];
    }
}

async function getSuccessfulConversions(userId) {
    try {
        const [result] = await query(
            `SELECT COUNT(*) as count 
             FROM conversions 
             WHERE user_id = ? AND status = 'completed'`,
            [userId]
        );
        return result[0].count || 0;
    } catch (error) {
        console.error('Error in getSuccessfulConversions:', error);
        return 0;
    }
}

async function refreshAbandonedCarts(userId) {
    try {
        const [stores] = await query(
            'SELECT merchant_id, access_token FROM connected_stores WHERE user_id = ?',
            [userId]
        );

        if (stores.length === 0) return;

        const response = await axios.get(`https://api.salla.dev/admin/v2/abandoned-carts`, {
            headers: {
                'Authorization': `Bearer ${stores[0].access_token}`,
                'Content-Type': 'application/json'
            },
            params: { limit: 100 }
        });

        const carts = response.data.data;

        for (const cart of carts) {
            await query(
                `INSERT INTO abandoned_carts 
                (user_id, merchant_id, cart_id, customer_name, customer_phone, customer_image, total, products_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                customer_name = VALUES(customer_name),
                total = VALUES(total),
                products_count = VALUES(products_count)`,
                [
                    userId,
                    stores[0].merchant_id,
                    cart.id,
                    cart.customer?.name,
                    cart.customer?.mobile,
                    cart.customer?.image,
                    cart.total,
                    cart.products?.length || 0
                ]
            );
        }
    } catch (error) {
        console.error('Error refreshing abandoned carts:', error);
    }
}

async function recordConversion(userId, cartId, orderData) {
    try {
        await query(
            `INSERT INTO conversions 
             (user_id, cart_id, merchant_id, order_id, order_amount, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                cartId,
                orderData.merchant_id,
                orderData.order_id,
                orderData.amount,
                'completed'
            ]
        );
        return true;
    } catch (error) {
        console.error('Error recording conversion:', error);
        return false;
    }
}

module.exports = {
    getAbandonedCartsData,
    getMessagesStatsData,
    getTopAbandonedCarts,
    getTopCustomers,
    getSuccessfulConversions,
    refreshAbandonedCarts,
    recordConversion
};