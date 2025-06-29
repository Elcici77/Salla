const axios = require("axios");
const db = require("../db");
const customersService = require('./customers.service');

class WhatsappService {
    async generateQR(userId) {
        try {
            const response = await axios.get("https://wsalla.com/Install/api/create/wa.link", {
                params: {
                    secret: process.env.ZENDER_SECRET || "bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f",
                    sid: process.env.ZENDER_SID || 1
                },
                timeout: 10000
            });
            if (!response.data?.data?.qrimagelink) {
                throw new Error("رابط QR غير موجود في الاستجابة");
            }
            return {
                qr_url: response.data.data.qrimagelink,
                info_url: response.data.data.infolink,
                qr_string: response.data.data.qrstring
            };
        } catch (error) {
            throw new Error("فشل في توليد رمز QR: " + error.message);
        }
    }

    async checkStatus(infoUrl) {
        try {
            const token = infoUrl.split('token=')[1];
            const response = await axios.get("https://wsalla.com/Install/api/get/wa.info", {
                params: { token },
                timeout: 30000,
                validateStatus: () => true
            });

            if (response.data.status === 301 || response.data.data === false) {
                return { status: 'pending' };
            }
            if (response.data?.data?.wid) {
                const widParts = response.data.data.wid.split('@')[0].split(':');
                return {
                    status: 'connected',
                    phone: widParts[0],
                    wid: response.data.data.wid,
                    unique: response.data.data.unique || null,
                    info_url: infoUrl
                };
            }
            return { status: 'error', message: 'تنسيق استجابة غير معروف' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    async disconnect(userId) {
        try {
            await db.query("START TRANSACTION");

            // استرجاع بيانات الاتصال
            const result = await db.query(
                "SELECT token, phone, `unique`, status, wid FROM user_whatsapp WHERE user_id = ? FOR UPDATE",
                [userId]
            );

            // التعامل مع هيكليات نتائج قاعدة البيانات المختلفة
            let connection;
            if (Array.isArray(result) && result.length > 0 && !Array.isArray(result[0])) {
                connection = result[0];
            } else if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                connection = result[0].length > 0 ? result[0][0] : null;
            } else if (result && result.rows && Array.isArray(result.rows) && result.rows.length > 0) {
                connection = result.rows[0];
            } else {
                console.log("No connection found for user:", userId);
                await db.query("ROLLBACK");
                throw new Error("لا يوجد حساب واتساب مربوط");
            }

            if (!connection) {
                await db.query("ROLLBACK");
                throw new Error("لا يوجد حساب واتساب مربوط");
            }

            // محاولة حذف الحساب من Zender إذا كان هناك unique ID
            if (connection.unique && typeof connection.unique === 'string' && connection.unique.length > 0) {
                let attempts = 0;
                const maxAttempts = 3;
                let zenderSuccess = false;
                const secret = process.env.ZENDER_SECRET || "bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f";
                console.log(`Zender API parameters for user: ${userId}`, {
                    secret: secret.slice(0, 8) + "...",
                    unique: connection.unique
                });

                while (attempts < maxAttempts && !zenderSuccess) {
                    try {
                        const response = await axios.get("https://wsalla.com/Install/api/delete/wa.account", {
                            params: {
                                secret,
                                unique: connection.unique
                            },
                            timeout: 20000,
                            validateStatus: status => status >= 200 && status < 500
                        });
                        console.log("Zender Delete Account Response for user:", userId, JSON.stringify(response.data, null, 2));

                        if (response.data && response.data.success === true) {
                            zenderSuccess = true;
                            console.log(`Zender account deleted successfully for user: ${userId}`);
                        } else {
                            console.warn(`Zender API returned non-success response for user: ${userId}:`, {
                                status: response.status,
                                data: response.data,
                                message: response.data.message || "No message provided"
                            });
                        }
                    } catch (zenderError) {
                        console.warn(`Zender delete attempt ${attempts + 1}/${maxAttempts} failed for user: ${userId}:`, {
                            message: zenderError.message,
                            status: zenderError.response?.status,
                            data: zenderError.response?.data,
                            errorDetails: zenderError.response?.data?.message || "No error message provided"
                        });
                    }
                    attempts++;
                    if (!zenderSuccess && attempts < maxAttempts) {
                        console.log(`Retrying Zender delete after 2 seconds for user: ${userId}`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                if (!zenderSuccess) {
                    console.warn(`Failed to delete Zender account after ${maxAttempts} attempts for user: ${userId}. Proceeding with database deletion.`);
                }
            } else {
                console.warn(`Invalid or missing unique ID for user: ${userId}, unique: ${connection.unique}. Skipping Zender API call.`);
            }

            // حذف السجل من قاعدة البيانات
            const [deleteResult] = await db.query(
                "DELETE FROM user_whatsapp WHERE user_id = ?",
                [userId]
            );

            if (deleteResult.affectedRows === 0) {
                await db.query("ROLLBACK");
                throw new Error("فشل حذف السجل من قاعدة البيانات");
            }

            await db.query("COMMIT");
            console.log("Disconnected successfully for user:", userId);
            return true;
        } catch (error) {
            await db.query("ROLLBACK");
            console.error("Disconnect Error for user:", userId, {
                error: error.message,
                response: error.response?.data
            });
            throw new Error("فشل في فك الربط: " + error.message);
        }
    }

    async saveConnection(userId, connectionData) {
        try {
            if (!connectionData.wid || !connectionData.phone) {
                throw new Error("معرّف الواتساب (wid) ورقم الهاتف مطلوبان");
            }
            const widParts = connectionData.wid.split('@')[0].split(':');
            const phone = widParts[0];
            const token = widParts[1] || null;

            const result = await db.query(
                "SELECT user_id, status FROM user_whatsapp WHERE phone = ? AND user_id != ?",
                [phone, userId]
            );

            let existingPhone;
            if (Array.isArray(result) && result.length > 0 && !Array.isArray(result[0])) {
                existingPhone = result[0];
            } else if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                existingPhone = result[0].length > 0 ? result[0][0] : null;
            } else if (result && result.rows && Array.isArray(result.rows) && result.rows.length > 0) {
                existingPhone = result.rows[0];
            }

            if (existingPhone) {
                console.log("Existing phone found for user:", userId, {
                    userId: existingPhone.user_id,
                    phone,
                    status: existingPhone.status
                });
                throw new Error("لا يمكن ربط هذا الرقم، موجود في حساب آخر");
            }

            console.log("Saving to DB for user:", userId, JSON.stringify(connectionData, null, 2));
            await db.query(
                `INSERT INTO user_whatsapp 
                    (user_id, token, phone, status, connected_at, info_url, qr_url, wid, \`unique\`)
                 VALUES (?, ?, ?, 'connected', NOW(), ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    token = VALUES(token), phone = VALUES(phone), status = VALUES(status),
                    connected_at = VALUES(connected_at), info_url = VALUES(info_url),
                    qr_url = VALUES(qr_url), wid = VALUES(wid), \`unique\` = VALUES(\`unique\`)`,
                [
                    userId,
                    token,
                    phone,
                    connectionData.info_url,
                    connectionData.qr_url || null,
                    connectionData.wid,
                    connectionData.unique || null
                ]
            );
            console.log("Connection saved successfully for user:", userId);
            return true;
        } catch (error) {
            console.error("Save Connection Error for user:", userId, { connectionData, error: error.message });
            throw new Error(error.message);
        }
    }

    async getCurrentStatus(userId) {
        try {
            console.log("Fetching current status for user:", userId);
            const result = await db.query(
                "SELECT phone, status, connected_at, token, wid, `unique` FROM user_whatsapp WHERE user_id = ? ORDER BY connected_at DESC LIMIT 1",
                [userId]
            );

            let connection;
            if (Array.isArray(result) && result.length > 0 && !Array.isArray(result[0])) {
                connection = result[0];
            } else if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                connection = result[0].length > 0 ? result[0][0] : null;
            } else if (result && result.rows && Array.isArray(result.rows) && result.rows.length > 0) {
                connection = result.rows[0];
            } else {
                return { success: true, connected: false, user_id: userId };
            }

            if (!connection) {
                return { success: true, connected: false, user_id: userId };
            }
            const isConnected = connection.status === 'connected' && !!connection.phone && connection.connected_at != null;

            return {
                success: true,
                connected: isConnected,
                user_id: userId,
                phone: isConnected ? connection.phone : null,
                connected_at: isConnected ? connection.connected_at : null,
                token: isConnected ? connection.token : null,
                wid: isConnected ? connection.wid : null,
                unique: isConnected ? connection.unique : null
            };
        } catch (error) {
            console.error("Get Current Status Error for user:", userId, { error: error.message });
            throw new Error("فشل في استرجاع حالة الاتصال: " + error.message);
        }
    }

    async getWhatsAppStatus(userId) {
        const status = await this.getCurrentStatus(userId);
        return {
            phone: status.phone,
            status: status.connected ? 'connected' : 'disconnected'
        };
    }

    async getConnectedStore(userId, merchantId) {
        const [rows] = await db.query(
            'SELECT merchant_id, shop_name FROM connected_stores WHERE user_id = ? AND merchant_id = ?',
            [userId, merchantId]
        );
        return rows[0];
    }

    async getWhatsAppGroups(userId) {
        try {
            const [connections] = await db.query(
                'SELECT `unique` FROM user_whatsapp WHERE user_id = ? AND status = ?',
                [userId, 'connected']
            );
            if (!connections.length) throw new Error('لا يوجد رقم واتساب متصل');

            const unique = connections[0].unique;
            const response = await axios.get("https://wsalla.com/Install/api/get/wa.groups", {
                params: {
                    secret: process.env.ZENDER_SECRET || "bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f",
                    unique,
                    sid: process.env.ZENDER_SID || 1
                },
                timeout: 10000
            });
            return response.data.data || [];
        } catch (error) {
            console.error("Get WhatsApp Groups Error for user:", userId, {
                message: error.message,
                response: error.response?.data
            });
            throw new Error('فشل جلب مجموعات واتساب: ' + (error.response?.data?.message || error.message));
        }
    }

    async importWhatsAppContacts(userId, groupIds) {
        try {
            const [connections] = await db.query(
                'SELECT `unique` FROM user_whatsapp WHERE user_id = ? AND status = ?',
                [userId, 'connected']
            );
            if (!connections.length) throw new Error('لا يوجد رقم واتساب متصل');

            const unique = connections[0].unique;
            for (const gid of groupIds) {
                const response = await axios.get("https://wsalla.com/Install/api/get/wa.group.contacts", {
                    params: {
                        secret: process.env.ZENDER_SECRET || "bb49eddbbba84ddffd1c6a2731a64d3b1ac9658f",
                        unique,
                        gid,
                        sid: process.env.ZENDER_SID || 1
                    },
                    timeout: 10000
                });
                const contacts = response.data.contacts || response.data.data || [];
                const numbers = contacts.map(contact => contact.phone).filter(phone => phone);
                if (numbers.length) {
                    await customersService.importManual(userId, numbers);
                }
            }
        } catch (error) {
            console.error("Import WhatsApp Contacts Error for user:", userId, {
                message: error.message,
                response: error.response?.data
            });
            throw new Error('فشل استيراد جهات الاتصال: ' + (error.response?.data?.message || error.message));
        }
    }
}

module.exports = new WhatsappService();