const db = require('../db');

exports.getCustomers = async (userId, { search, sort, ids }) => {
    try {
        let query = 'SELECT * FROM whatsapp_customers WHERE user_id = ?';
        const params = [userId];

        if (ids && ids.length) {
            query += ' AND id IN (?)';
            params.push(ids);
        } else if (search) {
            query += ' AND (mobile LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (sort === 'latest') {
            query += ' ORDER BY created_at DESC';
        } else if (sort === 'oldest') {
            query += ' ORDER BY created_at ASC';
        }

        const [rows] = await db.query(query, params);
        return { data: rows, total: rows.length };
    } catch (error) {
        console.error('Error getting customers:', error.message, { userId, search, sort, ids });
        throw new Error('فشل جلب العملاء: ' + error.message);
    }
};

exports.addCustomer = async (customerData) => {
    try {
        const { user_id, name, phone, email, city } = customerData;
        if (!user_id) throw new Error('معرف المستخدم مطلوب');
        if (!phone) throw new Error('رقم الهاتف مطلوب');
        const query = `
            INSERT INTO whatsapp_customers (user_id, name, mobile, email, city, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await db.query(query, [user_id, name || null, phone, email || null, city || null]);
        return { id: result.insertId, user_id, name, phone, email, city };
    } catch (error) {
        console.error('Error adding customer:', error.message, { customerData });
        throw new Error('فشل إضافة العميل: ' + error.message);
    }
};

exports.syncCustomers = async (userId) => {
    try {
        const query = 'UPDATE whatsapp_customers SET last_sync_date = NOW() WHERE user_id = ?';
        await db.query(query, [userId]);
    } catch (error) {
        console.error('Error syncing customers:', error.message, { userId });
        throw new Error('فشل مزامنة العملاء: ' + error.message);
    }
};

exports.importExcel = async (userId, data) => {
    try {
        for (const row of data) {
            const { name, phone, email, city } = row;
            if (phone) {
                const query = `
                    INSERT INTO whatsapp_customers (user_id, name, mobile, email, city, created_at)
                    VALUES (?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE name = ?, email = ?, city = ?
                `;
                await db.query(query, [userId, name || null, phone, email || null, city || null, name || null, email || null, city || null]);
            }
        }
    } catch (error) {
        console.error('Error importing Excel:', error.message, { userId });
        throw new Error('فشل استيراد ملف Excel: ' + error.message);
    }
};

exports.importManual = async (userId, numbers) => {
    try {
        for (const phone of numbers) {
            if (phone) {
                const query = `
                    INSERT INTO whatsapp_customers (user_id, mobile, created_at)
                    VALUES (?, ?, NOW())
                    ON DUPLICATE KEY UPDATE mobile = ?
                `;
                await db.query(query, [userId, phone, phone]);
            }
        }
    } catch (error) {
        console.error('Error importing manually:', error.message, { userId });
        throw new Error('فشل الاستيراد اليدوي: ' + error.message);
    }
};