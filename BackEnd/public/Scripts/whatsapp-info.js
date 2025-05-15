async function checkExistingConnection(attempt = 1, maxAttempts = 3) {
    try {
        const token = localStorage.getItem("authToken");
        console.log(`Checking existing connection (attempt ${attempt}/${maxAttempts}), token:`, token ? "exists" : "missing");
        const response = await axios.get('/api/whatsapp/get-current-status', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });
        console.log("Check Existing Connection Response:", JSON.stringify(response.data, null, 2));

        if (!response.data.success || !response.data.connected) {
            if (attempt < maxAttempts) {
                console.log(`No valid connection found, retrying (${attempt + 1}/${maxAttempts})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await checkExistingConnection(attempt + 1, maxAttempts);
            }
            console.log("No valid connection found after max attempts, redirecting to QR page");
            updateStatusMessage("...لا يوجد حساب واتساب متصل، يتم إعادة التوجيه إلى صفحة ربط الحساب", true);
            setTimeout(() => {
                window.location.href = 'whatsapp-qr.html';
            }, 4000);
            return null;
        }
        console.log("Connection found:", {
            user_id: response.data.user_id,
            phone: response.data.phone,
            connected_at: response.data.connected_at,
            wid: response.data.wid,
            unique: response.data.unique
        });
        return {
            phone: response.data.phone,
            connected_at: new Date(response.data.connected_at).toLocaleString()
        };
    } catch (error) {
        console.error(`Connection check failed (attempt ${attempt}/${maxAttempts}):`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        if (attempt < maxAttempts) {
            console.log(`Retrying connection check (${attempt + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await checkExistingConnection(attempt + 1, maxAttempts);
        }
        updateStatusMessage(
            error.response?.data?.message || 
            "تعذر التحقق من حالة الاتصال، يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني",
            true
        );

        window.dispatchEvent(new Event('whatsappStatusChanged'));

        setTimeout(() => {
            window.location.href = 'whatsapp-qr.html';
        }, 4000);
        return null;
    }
}

function updateStatusMessage(message, isError = false) {
    const statusElement = document.getElementById("status-msg");
    const sanitizedMessage = message && typeof message === 'string' ? message : "حدث خطأ غير معروف، يرجى المحاولة لاحقًا";
    statusElement.innerText = sanitizedMessage;
    statusElement.className = isError ? "error-message" : "";
}

function showWhatsAppInfo(data) {
    document.getElementById("profile-phone").innerText = data.phone || "غير معروف";
    document.getElementById("connected-at").innerText = data.connected_at || new Date().toLocaleString();
}

async function disconnectAccount() {
    try {
        updateStatusMessage("...جاري فك الربط");
        const response = await axios.post('/api/whatsapp/disconnect', {}, {
            headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
            timeout: 10000
        });
        console.log("Disconnect Response:", JSON.stringify(response.data, null, 2));
        if (response.data.success) {
            updateStatusMessage("تم فك الربط بنجاح");

            window.dispatchEvent(new Event('whatsappStatusChanged'));

            setTimeout(() => {
                window.location.href = 'whatsapp-qr.html';
            }, 1500);
        } else {
            throw new Error(response.data.message || "فشل في فك الربط");
        }
    } catch (error) {
        console.error("Disconnection error:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        updateStatusMessage(error.response?.data?.message || "فشل في فك الربط", true);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("authToken");
    console.log("DOMContentLoaded triggered | Token:", token ? "exists" : "missing");

    if (!token) {
        console.log("No token found | Redirecting to QR page");
        updateStatusMessage("يرجى تسجيل الدخول لرؤية معلومات الحساب", true);
        setTimeout(() => {
            window.location.href = 'whatsapp-qr.html';
        }, 4000);
        return;
    }

    const connectionData = await checkExistingConnection();
    if (connectionData) {
        showWhatsAppInfo(connectionData);
        const disconnectBtn = document.getElementById("disconnect-btn");
        disconnectBtn.addEventListener("click", disconnectAccount);
    }
});