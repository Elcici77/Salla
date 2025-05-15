const axios = require('axios');
const { query } = require('../db');

async function reauthenticateStore(merchantId) {
    try {
        // 1. احذف السجلات القديمة
        await query(
            `DELETE FROM connected_stores 
             WHERE merchant_id = ?`,
            [merchantId]
        );

        // 2. أعد توجيه المستخدم لإعادة المصادقة
        return false; // سيحتاج لإعادة الربط

    } catch (error) {
        console.error('Reauthentication failed:', error);
        throw error;
    }
}

async function verifyTokenBasic(token) {
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
        console.error('Token verification failed:', error.message);
        return false;
    }
}

module.exports = {
    reauthenticateStore,
    verifyTokenBasic
};