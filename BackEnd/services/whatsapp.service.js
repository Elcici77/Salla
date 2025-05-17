const axios = require("axios");
const db = require("../db");

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
            console.log("Generate QR Response for user:", userId, JSON.stringify(response.data, null, 2));
            if (!response.data?.data?.qrimagelink) {
                throw new Error("رابط QR غير موجود في الاستجابة");
            }
            return {
                qr_url: response.data.data.qrimagelink,
                info_url: response.data.data.infolink,
                qr_string: response.data.data.qrstring
            };
        } catch (error) {
            console.error("Generate QR Error for user:", userId, { message: error.message, response: error.response?.data });
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
            console.log("Check Status Response:", JSON.stringify(response.data, null, 2));

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
            console.error("Check Status Error:", { message: error.message, response: error.response?.data });
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
            console.log("Raw Query Result for user:", userId, JSON.stringify(result, null, 2));

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

            console.log("Disconnect Connection Found for user:", userId, JSON.stringify(connection, null, 2));

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
                    secret: secret.slice(0, 8) + "...", // إخفاء جزء من secret للأمان
                    unique: connection.unique
                });

                while (attempts < maxAttempts && !zenderSuccess) {
                    try {
                        console.log(`Attempt ${attempts + 1}/${maxAttempts} to delete Zender account for user: ${userId}, unique: ${connection.unique}`);
                        const response = await axios.get("https://wsalla.com/Install/api/delete/wa.account", {
                            params: {
                                secret,
                                unique: connection.unique
                            },
                            timeout: 20000, // زيادة المهلة إلى 20 ثانية
                            validateStatus: status => status >= 200 && status < 500 // قبول الاستجابات غير 5xx
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
            console.log("Database Delete Result for user:", userId, JSON.stringify(deleteResult, null, 2));

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
            console.log("Existing Phone Check Result for user:", userId, JSON.stringify(result, null, 2));

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
            console.log("Raw Query Result for user:", userId, JSON.stringify(result, null, 2));

            let connection;
            if (Array.isArray(result) && result.length > 0 && !Array.isArray(result[0])) {
                connection = result[0];
            } else if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
                connection = result[0].length > 0 ? result[0][0] : null;
            } else if (result && result.rows && Array.isArray(result.rows) && result.rows.length > 0) {
                connection = result.rows[0];
            } else {
                console.log("No connection found for user:", userId);
                return { success: true, connected: false, user_id: userId };
            }

            if (!connection) {
                console.log("No valid connection data found for user:", userId);
                return { success: true, connected: false, user_id: userId };
            }

            console.log("Get Current Status Result for user:", userId, JSON.stringify(connection, null, 2));

            console.log("Connection details for user:", userId, {
                phone: connection.phone,
                status: connection.status,
                connected_at: connection.connected_at,
                connected_at_type: typeof connection.connected_at,
                is_connected_at_valid: !!connection.connected_at
            });

            const isConnected = connection.status === 'connected' && !!connection.phone && connection.connected_at != null;
            console.log("Connection status for user:", userId, "isConnected:", isConnected);

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

  

    
}

module.exports = new WhatsappService();