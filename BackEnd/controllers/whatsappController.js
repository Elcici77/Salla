const whatsappService = require("../services/whatsapp.service");

exports.generateQR = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log("Generating QR for user:", userId);
        const { qr_url, info_url } = await whatsappService.generateQR(userId);
        res.json({ success: true, qr_url, info_url });
    } catch (error) {
        console.error("Generate QR Error for user:", req.user.userId, { error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.checkStatus = async (req, res) => {
    try {
        const { info_url } = req.query;
        if (!info_url) {
            return res.status(400).json({ success: false, message: "رابط المعلومات مطلوب" });
        }
        const result = await whatsappService.checkStatus(info_url);
        console.log("Check Status Response:", JSON.stringify(result, null, 2));
        switch (result.status) {
            case 'connected':
                return res.json({ success: true, status: 'connected', data: result });
            case 'pending':
                return res.status(202).json({ success: true, status: 'pending', message: 'جارٍ انتظار الربط...' });
            default:
                return res.status(500).json({ success: false, message: result.message || 'خطأ في التحقق من الحالة' });
        }
    } catch (error) {
        console.error("Check Status Error:", { error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCurrentStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log("Getting current status for user:", userId);
        const status = await whatsappService.getCurrentStatus(userId);
        console.log("Get Current Status Response for user:", userId, JSON.stringify(status, null, 2));
        res.json(status);
    } catch (error) {
        console.error("Get Current Status Error for user:", req.user.userId, { error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.disconnect = async (req, res) => {
    try {
        const userId = req.user.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "يجب تسجيل الدخول أولاً" });
        }
        console.log("Disconnecting for user:", userId);
        await whatsappService.disconnect(userId);
        res.json({ success: true, message: "تم فصل الحساب بنجاح" });
    } catch (error) {
        console.error("Disconnect Error for user:", req.user.userId, { error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.saveConnection = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { token, phone, wid, info_url, qr_url, unique } = req.body;
        console.log("Save Connection Request for user:", userId, JSON.stringify(req.body, null, 2));
        if (!wid || !phone) {
            return res.status(400).json({ success: false, message: "معرّف الواتساب (wid) ورقم الهاتف مطلوبان" });
        }
        await whatsappService.saveConnection(userId, { token, phone, wid, info_url, qr_url, unique });
        res.json({ success: true });
    } catch (error) {
        console.error("Save Connection Error for user:", req.user.userId, { error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};