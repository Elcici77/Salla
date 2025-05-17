const messagesService = require("../services/messages.service");

exports.getSentMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const filters = req.query;
        const messages = await messagesService.getSentMessages(userId, filters);
        res.json({ success: true, data: messages });
    } catch (error) {
        console.error("Get Sent Messages Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteMessages = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { message_ids } = req.body;
        await messagesService.deleteMessages(userId, message_ids);
        res.json({ success: true, message: "تم الحذف بنجاح" });
    } catch (error) {
        console.error("Delete Messages Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};