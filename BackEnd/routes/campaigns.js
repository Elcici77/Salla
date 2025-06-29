const express = require('express');
const router = express.Router();
const campaignsController = require('../controllers/campaignsController');
const { authenticateToken } = require('./auth');
const db = require('../db'); 

router.post('/', authenticateToken, campaignsController.createCampaign);

router.get('/launched', authenticateToken, async (req, res) => {
    try {
        const userId = typeof req.user?.userId === 'function' ? req.user.userId() : req.user.userId;
        if (!userId) {
            console.error('No userId found in request');
            throw new Error('معرف المستخدم غير موجود');
        }

        console.log(`Fetching campaigns for userId: ${userId}`);

        const result = await db.query(
            'SELECT id, `name`, created_at, status FROM campaigns WHERE user_id = ? AND status IN (?, ?, ?, ?)',
            [userId, 'pending', 'scheduled', 'completed', 'failed']
        );

        const campaigns = result[0]; // استخراج النتائج من الاستعلام

        console.log(`Query result for userId ${userId}:`, campaigns);

        if (campaigns.length === 0) {
            return res.json({ success: true, data: [], message: 'لا توجد حملات منفذة حاليًا' });
        }

        res.json({ success: true, data: campaigns });
    } catch (error) {
        console.error('Error getting launched campaigns:', error.message, { userId: req.user?.userId });
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;