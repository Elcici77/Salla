const db = require('../db');

exports.createGroup = async (userId, name) => {
    try {
        if (!name) throw new Error('اسم المجموعة مطلوب');
        const query = 'INSERT INTO `groups` (user_id, `name`, created_at) VALUES (?, ?, NOW())';
        const [result] = await db.query(query, [userId, name]);
        if (!result.insertId) throw new Error('فشل إنشاء المجموعة: لا يوجد معرف مُدرج');
        console.log('Group created:', { id: result.insertId, user_id: userId, name });
        return { id: result.insertId, user_id: userId, name, created_at: new Date() };
    } catch (error) {
        console.error('Error creating group:', error.message, { userId, name });
        throw new Error('فشل إنشاء المجموعة: ' + error.message);
    }
};


exports.getGroups = async (userId) => {
    try {
        const query = 'SELECT id, user_id, `name`, created_at FROM `groups` WHERE user_id = ?';
        const [rows] = await db.query(query, [userId]);
        return rows;
    } catch (error) {
        console.error('Error getting groups:', error.message, { userId });
        throw new Error('فشل جلب المجموعات: ' + error.message);
    }
};

exports.deleteGroup = async (userId, groupId) => {
    try {
        const query = 'DELETE FROM `groups` WHERE id = ? AND user_id = ?';
        const [result] = await db.query(query, [groupId, userId]);
        if (result.affectedRows === 0) throw new Error('المجموعة غير موجودة أو لا تملك صلاحية الحذف');
        console.log('Group deleted:', { groupId, userId });
    } catch (error) {
        console.error('Error deleting group:', error.message, { groupId, userId });
        throw new Error('فشل حذف المجموعة: ' + error.message);
    }
};