const db = require('../db');

class BlacklistService {
    async getSettings(userId) {
        const [settings] = await db.query('SELECT * FROM blacklist_settings WHERE user_id = ?', [userId]);
        return settings[0] || { keywords: '', unsubscribe_message: '' };
    }

    async updateSettings(userId, keywords, unsubscribe_message) {
        const [result] = await db.query(
            'INSERT INTO blacklist_settings (user_id, keywords, unsubscribe_message, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE keywords = ?, unsubscribe_message = ?, updated_at = NOW()',
            [userId, keywords, unsubscribe_message, keywords, unsubscribe_message]
        );
        return result;
    }

    async getNumbers(userId) {
        const [numbers] = await db.query('SELECT id, phone_number FROM blacklist_numbers WHERE user_id = ?', [userId]);
        return numbers;
    }

    async addNumber(userId, phone_number) {
        let cleaned = phone_number.trim().replace(/[^0-9]/g, '');
        if (cleaned.length < 8 || cleaned.length > 15) {
            throw new Error('رقم الهاتف غير صالح. يرجى إدخال رقم مع رمز الدولة (مثال: +201234567890)');
        }

        const [existing] = await db.query(
            'SELECT id FROM blacklist_numbers WHERE user_id = ? AND phone_number = ?',
            [userId, cleaned]
        );
        if (existing.length > 0) {
            throw new Error('الرقم موجود بالفعل في القائمة السوداء');
        }

        const [result] = await db.query(
            'INSERT INTO blacklist_numbers (user_id, phone_number, created_at) VALUES (?, ?, NOW())',
            [userId, cleaned]
        );
        return result;
    }

    async deleteNumber(userId, id) {
        const [result] = await db.query(
            'DELETE FROM blacklist_numbers WHERE id = ? AND user_id = ?',
            [id, userId]
        );
        if (result.affectedRows === 0) throw new Error('الرقم غير موجود أو لا يمكن حذفه');
        return result;
    }
}

module.exports = new BlacklistService();
