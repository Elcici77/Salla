const db = require('../db');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

exports.createAndSendCampaign = async (campaignData) => {
    try {
        const {
            user_id,
            name,
            recipients,
            message,
            media_file_path,
            media_type,
            schedule_date,
            schedule_time_from,
            schedule_time_to,
            interval_seconds
        } = campaignData;

        if (!user_id || !name || !recipients || !message || !schedule_date || !schedule_time_from || !schedule_time_to) {
            throw new Error('جميع الحقول المطلوبة يجب أن تكون ممتلئة');
        }

        // Replace variables in message
        const replaceVariables = (msg, phone) => {
            return msg
                .replace('[customer_phone]', phone || '01234567890')
                .replace('[date_now]', new Date().toLocaleDateString('ar-EG'));
        };

        // Check blacklist numbers
        const [blacklist] = await db.query('SELECT phone_number FROM blacklist_numbers WHERE user_id = ?', [user_id]);
        const blacklistNumbers = blacklist.map(b => b.phone_number);
        const phones = recipients.split(',').map(p => p.trim());
        const blockedNumbers = phones.filter(p => blacklistNumbers.includes(p));

        if (blockedNumbers.length > 0) {
            throw new Error(`لا يمكن إتمام الحملة لوجود الأرقام التالية في القائمة السوداء: ${blockedNumbers.join(', ')}`);
        }

        // Insert into campaigns table
        const [result] = await db.query(`
            INSERT INTO campaigns (user_id, name, recipients, message, media_file_path, media_type, schedule_date, schedule_time_from, schedule_time_to, interval_seconds, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [user_id, name, recipients, message, media_file_path || null, media_type || null, schedule_date, schedule_time_from, schedule_time_to, interval_seconds || 0, 'pending']
        );
        const campaignId = result.insertId;

        console.log(`Campaign inserted with ID: ${campaignId}, User ID: ${user_id}, Status: pending`);

        // Fetch WhatsApp account unique ID
        const [whatsapp] = await db.query('SELECT `unique` FROM user_whatsapp WHERE user_id = ? AND status = ?', [user_id, 'connected']);
        if (!whatsapp.length) throw new Error('لا يوجد حساب واتساب متصل');
        const accountUnique = whatsapp[0].unique;

        // Schedule time calculation
        const now = new Date();
        const [scheduleHour, scheduleMinute] = schedule_time_from.split(':');
        const scheduleTime = new Date(schedule_date);
        scheduleTime.setHours(scheduleHour, scheduleMinute, 0, 0);
        const delayMs = scheduleTime - now;
        if (delayMs < 0) throw new Error('وقت الجدولة يجب أن يكون مستقبليًا');

        // Prepare and send campaign to each recipient
        const sendCampaign = async () => {
            const fullPath = media_file_path ? path.join(__dirname, '..', media_file_path.slice(1)) : null;

            if (media_file_path && !fs.existsSync(fullPath)) {
                throw new Error(`ملف الوسائط غير موجود في المسار: ${fullPath}`);
            }

            for (const phone of phones) {
                const personalizedMessage = replaceVariables(message, phone);
                const form = new FormData();

                form.append('secret', process.env.ZENDER_API_SECRET);
                form.append('account', accountUnique);
                form.append('campaign', name);
                form.append('type', media_file_path ? 'media' : 'text');
                form.append('message', personalizedMessage);
                form.append('recipients', phone);

                if (media_file_path) {
                    form.append('media_file', fs.createReadStream(fullPath));
                }

                try {
                    const response = await axios.post('https://wsalla.com/Install/api/send/whatsapp.bulk', form, {
                        headers: form.getHeaders()
                    });

                    if (response.data.status !== 'success') {
                        console.error(`فشل الإرسال إلى ${phone}:`, response.data);
                    } else {
                        console.log(`تم إرسال الرسالة إلى ${phone}`);
                    }
                } catch (err) {
                    console.error(`خطأ في الإرسال إلى ${phone}:`, err.message);
                }

                await new Promise(resolve => setTimeout(resolve, interval_seconds * 1000));
            }

            await db.query('UPDATE campaigns SET status = ? WHERE id = ?', ['completed', campaignId]);
            console.log(`Campaign ${campaignId} updated to completed`);
        };

        setTimeout(async () => {
            try {
                await sendCampaign();
            } catch (error) {
                console.error('Error sending campaign:', error.message);
                await db.query('UPDATE campaigns SET status = ? WHERE id = ?', ['failed', campaignId]);
                console.log(`Campaign ${campaignId} updated to failed`);
            }
        }, delayMs);

        await db.query('UPDATE campaigns SET status = ? WHERE id = ?', ['scheduled', campaignId]);
        return { id: campaignId, ...campaignData, status: 'scheduled' };

    } catch (error) {
        console.error('Error creating/sending campaign:', error.message, { campaignData });
        throw new Error('فشل إنشاء أو إرسال الحملة: ' + error.message);
    }
};