let pollInterval, timerInterval, timeLeft = 400;

function startTimer() {
    timeLeft = 400;
    document.getElementById("qr-expire-timer").innerText = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("qr-expire-timer").innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            generateQRCode();
        }
    }, 1000);
}

function updateQRStatus(message, isError = false) {
    const statusElement = document.getElementById("status-msg");
    const sanitizedMessage = message && typeof message === 'string' ? message : "حدث خطأ غير معروف، يرجى المحاولة لاحقًا";
    statusElement.innerText = sanitizedMessage;
    statusElement.className = isError ? "qr-error" : "";
}

function clearIntervals() {
    if (pollInterval) clearInterval(pollInterval);
    if (timerInterval) clearInterval(timerInterval);
}

async function checkExistingConnection(attempt = 1, maxAttempts = 3) {
    try {
        const token = localStorage.getItem("authToken");
        const response = await axios.get('/api/whatsapp/get-current-status', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });

        if (response.data.success && response.data.connected) {
            console.log("Connection found, redirecting to info page:", {
                user_id: response.data.user_id,
                phone: response.data.phone,
                connected_at: response.data.connected_at,
                wid: response.data.wid,
                unique: response.data.unique
            });
            window.location.href = 'whatsapp-info.html';
            return true;
        } else {
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await checkExistingConnection(attempt + 1, maxAttempts);
            }
            console.log("No valid connection found after max attempts");
            return false;
        }
    } catch (error) {
        console.error(`Connection check failed (attempt ${attempt}/${maxAttempts}):`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await checkExistingConnection(attempt + 1, maxAttempts);
        }
        updateQRStatus("فشل في التحقق من حالة الاتصال، يرجى إعادة المحاولة", true);
        return false;
    }
}

function generateQRCode() {
    clearIntervals();
    updateQRStatus("جاري توليد رمز QR...");
    const qrContainer = document.getElementById("qrContainer");
    qrContainer.innerHTML = '<div class="qr-loading"></div>';

    axios.get("/api/whatsapp/generate-qr", {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
        timeout: 10000
    })
    .then(response => {
        
        if (!response.data.success || !response.data.qr_url) {
            throw new Error(response.data.message || "رابط QR غير صالح أو مفقود");
        }
        const qrImg = document.createElement("img");
        qrImg.src = response.data.qr_url;
        qrImg.alt = "رمز QR";
        qrImg.crossOrigin = "anonymous";
        qrImg.onload = () => {
            console.log("QR Image loaded successfully");
            qrContainer.innerHTML = "";
            qrContainer.appendChild(qrImg);
            updateQRStatus("📱 يرجى مسح الرمز خلال 400 ثانية");
            startTimer();
            pollConnectionStatus(response.data.info_url);
        };
        qrImg.onerror = () => {
            console.error("Failed to load QR image:", response.data.qr_url);
            throw new Error("تعذر تحميل صورة QR");
        };
    })
    .catch(error => {
        console.error("Generate QR Error:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        qrContainer.innerHTML = '<i class="fas fa-exclamation-triangle" style="font-size: 50px; color: #ff4444;"></i>';
        updateQRStatus(error.response?.data?.message || error.message || "فشل في توليد رمز QR", true);
    });
}

async function pollConnectionStatus(infoUrl) {
    let attempts = 0, maxAttempts = 133;
    pollInterval = setInterval(async () => {
        try {
            attempts++;
            const response = await axios.get(`/api/whatsapp/check-status`, {
                params: { info_url: infoUrl },
                headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
                timeout: 10000
            });

            if (response.data.status === 'pending') {
                updateQRStatus("جارٍ انتظار اكتمال الربط...");
                return;
            }
            if (response.data.status === 'connected') {
                clearIntervals();
                handleSuccessfulConnection(response.data.data);
                return;
            }
            if (response.data.status === 'error') {
                clearIntervals();
                updateQRStatus(response.data.message || "خطأ في الربط", true);
                setTimeout(generateQRCode, 3000);
                return;
            }
            if (attempts >= maxAttempts) {
                clearIntervals();
                updateQRStatus("انتهت صلاحية رمز QR", true);
                setTimeout(generateQRCode, 3000);
            }
        } catch (error) {
            console.error("Polling Error:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            if (attempts >= maxAttempts) {
                clearIntervals();
                updateQRStatus("فشل في الاتصال بالخادم", true);
                setTimeout(generateQRCode, 3000);
            }
        }
    }, 3000);
}

async function handleSuccessfulConnection(data) {
    updateQRStatus("...جارٍ تحضير معلومات الحساب");
    try {
        const phone = data.phone || (data.wid ? data.wid.split('@')[0].split(':')[0] : 'غير معروف');
        const sessionToken = data.wid ? data.wid.split('@')[0].split(':')[1] || null : null;


        const saveResponse = await axios.post('/api/whatsapp/save-connection', {
            token: sessionToken,
            phone,
            wid: data.wid,
            unique: data.unique || null,
            info_url: data.info_url,
            qr_url: data.qr_url || null
        }, {
            headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
            timeout: 10000
        });

        if (!saveResponse.data.success) {
            throw new Error(saveResponse.data.message || "فشل في حفظ البيانات");
        }

        // إعادة التحقق من حالة الاتصال بعد الحفظ
        let isConnected = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            isConnected = await checkExistingConnection(attempt, 3);
            if (isConnected) break;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!isConnected) {
            throw new Error("تعذر التحقق من الاتصال بعد حفظ البيانات، قد تكون هناك مشكلة في قاعدة البيانات");
        }

        window.dispatchEvent(new Event('whatsappStatusChanged'));
        clearIntervals();
        setTimeout(() => {
            window.location.href = 'whatsapp-info.html';
        }, 2000);
    } catch (error) {
        console.error("Error in handleSuccessfulConnection:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        clearIntervals();
        updateQRStatus(
            error.message || // استخدام الرسالة الأصلية من saveConnection
            error.response?.data?.message || 
            "تعذر ربط الحساب، يرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني",
            true
        );
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("authToken");
    console.log("DOMContentLoaded triggered, token:", token ? "exists" : "missing");

    if (!token) {
        console.log("No token found, showing QR");
        updateQRStatus("يرجى تسجيل الدخول لربط الحساب", true);
        generateQRCode();
        return;
    }

    const isConnected = await checkExistingConnection();
    if (!isConnected) {
        console.log("User is not connected, showing QR");
        generateQRCode();
    }
});