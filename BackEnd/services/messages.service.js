const axios = require("axios");
const db = require("../db");

class MessagesService {
    async getSentMessages(userId, filters = {}) {
        try {
            // جلب رقم الهاتف من user_whatsapp
            const [userResult] = await db.query(
                "SELECT phone FROM user_whatsapp WHERE user_id = ? AND status = 'connected' LIMIT 1",
                [userId]
            );
            if (!userResult[0]?.phone) {
                throw new Error("هذا الحساب غير مربوط برقم واتساب");
            }
            const senderPhone = userResult[0].phone;

            // جلب الرسائل من Zender API
            const response = await axios.get("https://wsalla.com/Install/api/get/wa.sent", {
                params: {
                    secret: process.env.ZENDER_SECRET || "bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f",
                    limit: filters.limit || 10,
                    page: filters.page || 1,
                    receiver: filters.receiver || undefined,
                    status: filters.status || undefined,
                    from_date: filters.from_date || undefined,
                    to_date: filters.to_date || undefined,
                    sender: senderPhone,
                },
            });

            if (response.data.status !== 200) {
                console.error("Zender API Response:", response.data);
                throw new Error(`فشل في جلب الرسائل: ${response.data.message || "خطأ غير معروف"}`);
            }

            // تصفية الرسائل لتظهر فقط من رقم المستخدم
            const statusMap = {
                failed: "فشلت",
                sent: "مرسلة",
                delivered: "تم التوصيل",
                pending: "قيد الانتظار",
            };

            return response.data.data
                .filter((msg) => {
                    const apiSender = msg.account ? msg.account.replace(/^\+/, "") : "";
                    return apiSender === senderPhone || msg.account === `+${senderPhone}`;
                })
                .map((msg) => ({
                    id: msg.id,
                    sender: msg.account,
                    receiver: msg.recipient,
                    content: msg.message,
                    status: statusMap[msg.status] || "غير معروف",
                    sent_at: new Date(msg.created * 1000).toISOString(),
                }));
        } catch (error) {
            console.error("Get Sent Messages Error:", error);
            throw new Error("فشل في جلب الرسائل: " + error.message);
        }
    }

    async deleteMessages(userId, messageIds) {
        try {
            // التحقق من وجود حساب واتساب مربوط
            const [userResult] = await db.query(
                "SELECT phone FROM user_whatsapp WHERE user_id = ? AND status = 'connected' LIMIT 1",
                [userId]
            );
            if (!userResult[0]?.phone) {
                throw new Error("هذا الحساب غير مربوط برقم واتساب");
            }
            const senderPhone = userResult[0].phone;

            // التحقق من أن الرسائل تخص رقم الهاتف
            const response = await axios.get("https://wsalla.com/Install/api/get/wa.sent", {
                params: {
                    secret: process.env.ZENDER_SECRET || "bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f",
                    sender: senderPhone,
                },
            });
            if (response.data.status !== 200) {
                throw new Error(`فشل في التحقق من الرسائل: ${response.data.message || "خطأ غير معروف"}`);
            }
            const validIds = response.data.data
                .filter((msg) => {
                    const apiSender = msg.account ? msg.account.replace(/^\+/, "") : "";
                    return (apiSender === senderPhone || msg.account === `+${senderPhone}`) && messageIds.includes(String(msg.id));
                })
                .map((msg) => String(msg.id));
            if (validIds.length !== messageIds.length) {
                throw new Error("بعض الرسائل غير متاحة أو لا تخص هذا الحساب");
            }

            // حذف الرسائل واحدة تلو الأخرى
            for (const id of messageIds) {
                const deleteResponse = await axios.get("https://wsalla.com/Install/api/delete/wa.sent", {
                    params: {
                        secret: process.env.ZENDER_SECRET || "bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f",
                        id,
                    },
                });
                if (deleteResponse.data.status !== 200) {
                    throw new Error(`فشل في حذف الرسالة ${id}: ${deleteResponse.data.message || "خطأ غير معروف"}`);
                }
            }
            return true;
        } catch (error) {
            console.error("Delete Messages Error:", error);
            throw new Error("فشل في حذف الرسائل: " + error.message);
        }
    }
}

module.exports = new MessagesService();