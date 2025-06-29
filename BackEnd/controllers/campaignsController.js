const campaignsService = require('../services/campaigns.service');
const db = require('../db');

exports.createCampaign = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error('معرف المستخدم غير موجود');

        // Check if WhatsApp is connected
        const [whatsapp] = await db.query('SELECT * FROM user_whatsapp WHERE user_id = ? AND status = ?', [userId, 'connected']);
        if (!whatsapp.length) throw new Error('يجب ربط حساب واتساب أولاً');

        const campaignData = {
            user_id: userId,
            name: req.body.name,
            recipients: req.body.recipients,
            message: req.body.message,
            media_file_path: req.body.media_file_path || null,
            media_url: req.body.media_url || null,
            media_type: req.body.media_type || null,
            document_url: req.body.document_url || null,
            document_type: req.body.document_type || null,
            schedule_date: req.body.schedule_date,
            schedule_time_from: req.body.schedule_time_from,
            schedule_time_to: req.body.schedule_time_to,
            interval_seconds: req.body.interval_seconds || 60
        };
        const campaign = await campaignsService.createAndSendCampaign(campaignData); // Use createAndSendCampaign
        res.json({ success: true, campaign });
    } catch (error) {
        console.error('Error creating campaign:', error.message, { userId: req.user?.userId });
        res.status(500).json({ success: false, message: error.message });
    }
};

