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
    statusElement.innerText = message;
    statusElement.className = isError ? "qr-error" : "";
}

function clearIntervals() {
    if (pollInterval) clearInterval(pollInterval);
    if (timerInterval) clearInterval(timerInterval);
}

async function checkExistingConnection() {
    try {
        const response = await axios.get('/api/whatsapp/get-current-status', {
            headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
            timeout: 10000
        });

        if (response.data.success && response.data.connected && response.data.phone && response.data.connected_at) {
            console.log("Connection found, showing account info:", {
                phone: response.data.phone,
                connected_at: response.data.connected_at
            });
            showWhatsAppInfo({
                phone: response.data.phone,
                connected_at: response.data.connected_at
            });
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Connection check failed:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
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
    let attempts = 0, maxAttempts = 60, lastStatus = '';
    pollInterval = setInterval(async () => {
        try {
            attempts++;
            const response = await axios.get(`/api/whatsapp/check-status`, {
                params: { info_url: infoUrl },
                headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
                timeout: 10000
            });

            if (response.data.status === lastStatus && attempts > 10) {
                clearInterval(pollInterval);
                generateQRCode();
                return;
            }
            lastStatus = response.data.status;

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
                clearInterval(pollInterval);
                updateQRStatus(response.data.message || "خطأ في الربط", true);
                return;
            }
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                updateQRStatus("انتهت صلاحية محاولات الربط", true);
                setTimeout(generateQRCode, 3000);
            }
        } catch (error) {
            console.error("Polling Error:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                updateQRStatus("فشل في الاتصال بالخادم", true);
            }
        }
    }, 3000);
}

async function handleSuccessfulConnection(data) {
    document.getElementById("status-msg").innerHTML = `
        <div class="progress-container">
            <div class="progress-bar"></div>
            <span>جارٍ تحضير معلومات الحساب...</span>
        </div>
    `;
    
    setTimeout(async () => {
        try {
            document.getElementById("qr-section").style.opacity = "0";
            setTimeout(async () => {
                document.getElementById("qr-section").style.display = "none";
                const phone = data.phone || (data.wid ? data.wid.split('@')[0].split(':')[0] : 'غير معروف');
                const sessionToken = data.wid ? data.wid.split('@')[0].split(':')[1] || null : null;


                // عرض بطاقة المعلومات
                showWhatsAppInfo({ phone, connected_at: new Date().toLocaleString() });

                // إرسال طلب حفظ البيانات
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
                    console.error("Failed to save connection:", saveResponse.data.message);
                    throw new Error(saveResponse.data.message || "فشل في حفظ البيانات");
                }
                console.log("Connection data saved successfully");
            }, 500);
        } catch (error) {
            console.error("Error in handleSuccessfulConnection:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            document.getElementById("status-msg").innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>${error.response?.data?.message || "حدث خطأ في حفظ معلومات الحساب، لكن الحساب متصل"}</span>
                </div>
            `;
        }
    }, 1500);
}

function showWhatsAppInfo(data) {
    const accountInfo = document.getElementById("account-info");
    const statusText = document.getElementById("status-text");
    const phone = data.phone || "غير معروف";
    const connectedAt = data.connected_at ? new Date(data.connected_at).toLocaleString() : new Date().toLocaleString();

    accountInfo.innerHTML = `
        <div class="connected-account">
            <div class="profile-info">
                <i class="fab fa-whatsapp"></i>
                <div class="details">
                    <p class="phone" id="profile-phone">${phone}</p>
                    <p class="connection-time">متصلة منذ: <span id="connected-at">${connectedAt}</span></p>
                </div>
            </div>
            <button id="disconnect-btn" class="disconnect-btn">
                <i class="fas fa-unlink"></i> فك الربط
            </button>
        </div>
    `;
    accountInfo.style.display = "block";
    statusText.innerText = "متصلة";

    document.getElementById("disconnect-btn").addEventListener("click", async () => {
        try {
            const statusMsg = document.getElementById("status-msg");
            statusMsg.innerHTML = '<div class="loading-spinner"></div> جاري فك الربط...';
            const disconnectResponse = await axios.post('/api/whatsapp/disconnect', {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
                timeout: 10000
            });
            console.log("Disconnect Response:", disconnectResponse.data);
            accountInfo.style.display = "none";
            document.getElementById("qr-section").style.display = "block";
            document.getElementById("qr-section").style.opacity = "1";
            statusMsg.innerText = "تم فك الربط بنجاح";
            statusText.innerText = "غير متصل";
            setTimeout(generateQRCode, 1500);
        } catch (error) {
            console.error("Disconnection error:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status
            });
            document.getElementById("status-msg").innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    فشل في فك الربط: ${error.response?.data?.message || error.message}
                </div>
            `;
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("authToken");
    const qrSection = document.getElementById("qr-section");
    const accountInfo = document.getElementById("account-info");
    const statusText = document.getElementById("status-text");


    if (!token) {
        console.log("No token found, showing QR");
        qrSection.style.display = "block";
        accountInfo.style.display = "none";
        statusText.innerText = "غير متصل";
        generateQRCode();
        return;
    }

    try {
        const isConnected = await checkExistingConnection();
        console.log("Is Connected:", isConnected);
        if (isConnected) {
            console.log("User is connected, showing account info");
            qrSection.style.display = "none";
            accountInfo.style.display = "block";
            statusText.innerText = "متصلة";
        } else {
            console.log("User is not connected, showing QR");
            qrSection.style.display = "block";
            accountInfo.style.display = "none";
            statusText.innerText = "غير متصل";
            generateQRCode();
        }

        const statusMsg = document.getElementById("status-msg");
        statusMsg.innerHTML = '<div class="loading-spinner"></div> جاري فك الربط...';
        const disconnectResponse = await axios.post('/api/whatsapp/disconnect', {}, {
            headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
            timeout: 10000
        });
        if (disconnectResponse.data.success) {
            const accountInfo = document.getElementById("account-info");
            const qrSection = document.getElementById("qr-section");
            const statusText = document.getElementById("status-text");
            accountInfo.style.display = "none";
            qrSection.style.display = "block";
            qrSection.style.opacity = "1";
            statusMsg.innerText = "تم فك الربط بنجاح";
            statusText.innerText = "غير متصل";
            setTimeout(generateQRCode, 1500);
        } else {
            throw new Error(disconnectResponse.data.message || "فشل في فك الربط");
        }

    } catch (error) {
        console.error("Initialization error:", {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        qrSection.style.display = "block";
        accountInfo.style.display = "none";
        statusText.innerText = "غير متصل";
        generateQRCode();
    }

    console.error("Disconnection error:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
    });
    document.getElementById("status-msg").innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            فشل في فك الربط: ${error.response?.data?.message || error.message}
        </div>
    `;
});