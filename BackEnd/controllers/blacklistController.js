const blacklistService = require('../services/blacklist.service');
const axios = require('axios');
const FormData = require('form-data');
const db = require('../db');

exports.getSettings = async (req, res) => {
    try {
        const settings = await blacklistService.getSettings(req.user.userId);
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error('Error in getSettings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { keywords, unsubscribe_message } = req.body;
        await blacklistService.updateSettings(req.user.userId, keywords, unsubscribe_message);
        res.json({ success: true, message: 'تم الحفظ بنجاح' });
    } catch (error) {
        console.error('Error in updateSettings:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getNumbers = async (req, res) => {
    try {
        const numbers = await blacklistService.getNumbers(req.user.userId);
        res.json({ success: true, data: numbers });
    } catch (error) {
        console.error('Error in getNumbers:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addNumber = async (req, res) => {
    try {
        const { phone_number } = req.body;
        await blacklistService.addNumber(req.user.userId, phone_number);
        res.json({ success: true, message: 'تم الإضافة بنجاح' });
    } catch (error) {
        console.error('Error in addNumber:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteNumber = async (req, res) => {
    try {
        await blacklistService.deleteNumber(req.user.userId, req.params.id);
        res.json({ success: true, message: 'تم الحذف بنجاح' });
    } catch (error) {
        console.error('Error in deleteNumber:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.handleWebhook = async (req, res) => {
    try {
        const { secret, type, data } = req.body;
        console.log('Webhook Payload:', JSON.stringify(req.body, null, 2));

        if (!secret || secret !== process.env.ZENDER_WEBHOOK_SECRET) {
            throw new Error('معرف Webhook غير صالح');
        }

        if (type !== 'whatsapp') {
            return res.json({ success: true, message: 'تم تجاهل الطلب: ليس من نوع WhatsApp' });
        }

        const { wid, phone, message } = data;
        if (!wid || !phone || !message) {
            throw new Error('بيانات الـ Webhook غير مكتملة');
        }

        let whatsapp = [];
        if (wid.includes('@')) {
            [whatsapp] = await db.query(
                'SELECT user_id, `unique` FROM user_whatsapp WHERE wid = ? AND status = ?',
                [wid, 'connected']
            );
        } else {
            const onlyDigits = wid.replace(/\D/g, '');
            [whatsapp] = await db.query(
                'SELECT user_id, `unique` FROM user_whatsapp WHERE wid LIKE CONCAT("%", ?, "%") AND status = ?',
                [onlyDigits, 'connected']
            );
        }

        if (!whatsapp.length) {
            console.error('No matching WhatsApp account found for wid:', wid);
            throw new Error('حساب واتساب غير متصل');
        }

        const userId = whatsapp[0].user_id;
        const accountUnique = whatsapp[0].unique;

        const settings = await blacklistService.getSettings(userId);
        const keywords = settings.keywords ? settings.keywords.split(',').map(k => k.trim().toLowerCase()) : [];

        const incomingMessage = message.trim().toLowerCase();
        const isExactMatch = keywords.some(k => incomingMessage === k);

        if (isExactMatch) {
            let cleaned = phone.trim().replace(/[^0-9]/g, '');
            if (cleaned.length < 8 || cleaned.length > 15) {
                throw new Error('رقم الهاتف غير صالح. يرجى إدخال رقم مع رمز الدولة (مثال: +201234567890)');
            }

            // تحقق إن كان الرقم موجودًا مسبقًا
            const [existing] = await db.query(
                'SELECT id FROM blacklist_numbers WHERE user_id = ? AND phone_number = ?',
                [userId, cleaned]
            );

            if (existing.length > 0) {
                console.log(`الرقم ${cleaned} موجود بالفعل في البلاك ليست - لن يتم إرسال رسالة تأكيد`);
                return res.json({ success: true, message: 'الرقم موجود بالفعل في القائمة السوداء' });
            }

            // أرسل رسالة التأكيد أولًا
            const form = new FormData();
            form.append('secret', process.env.ZENDER_API_SECRET);
            form.append('account', accountUnique);
            form.append('recipient', cleaned);
            form.append('type', 'text');
            form.append('message', settings.unsubscribe_message || 'تم إلغاء اشتراكك بنجاح.');

            try {
                const response = await axios.post('https://wsalla.com/Install/api/send/whatsapp', form, {
                    headers: form.getHeaders()
                });

                console.log('تم إرسال رسالة الإلغاء:', response.data);

                // بعد نجاح الإرسال أضف الرقم للبلاك ليست
                await blacklistService.addNumber(userId, cleaned);

                console.log(`تمت إضافة ${cleaned} إلى البلاك ليست بعد الإرسال`);
            } catch (sendError) {
                console.error('فشل إرسال رسالة التأكيد:', sendError.response?.data || sendError.message);
                throw new Error('فشل إرسال رسالة تأكيد الإلغاء. لم يتم إضافة الرقم.');
            }
        }

        res.json({ success: true, message: 'تم معالجة الرسالة بنجاح' });
    } catch (error) {
        console.error('Error in handleWebhook:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};


