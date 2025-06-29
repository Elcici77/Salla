const groupsService = require('../services/groups.service');

exports.createGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { name } = req.body;
        if (!name) throw new Error('يرجى إدخال اسم المجموعة');
        const group = await groupsService.createGroup(userId, name);
        res.json({ success: true, group });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteGroup = async (req, res) => {
    try {
        const userId = req.user.userId;
        const groupId = req.params.id;
        await groupsService.deleteGroup(userId, groupId);
        res.json({ success: true, message: 'تم حذف المجموعة بنجاح' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};