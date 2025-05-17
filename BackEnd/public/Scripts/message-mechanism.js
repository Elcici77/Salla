document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("authToken");
    if (!token) {
        alert("يرجى تسجيل الدخول أولاً");
        window.location.href = "login.html";
        return;
    }

    const messagesBody = document.getElementById("messagesBody");
    const selectAll = document.getElementById("selectAll");
    const deleteSelected = document.getElementById("deleteSelected");
    const searchPhone = document.getElementById("searchPhone");
    const statusFilter = document.getElementById("statusFilter");
    const fromDate = document.getElementById("fromDate");
    const toDate = document.getElementById("toDate");
    const applyFilters = document.getElementById("applyFilters");

    let selectedMessages = [];
    let allMessages = [];

    // جلب الرسائل
    async function fetchMessages(filters = {}) {
        try {
            const response = await axios.get("/api/messages/sent-messages", {
                headers: { Authorization: `Bearer ${token}` },
                params: { recipient: filters.receiver },
            });
            if (response.data.success) {
                allMessages = response.data.data;
                applyClientSideFilters(filters);
            } else {
                messagesBody.innerHTML = `<tr><td colspan="6">${response.data.message || "لا توجد رسائل متاحة"}</td></tr>`;
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
            const message = error.response?.data?.message || "فشل في جلب الرسائل";
            messagesBody.innerHTML = `<tr><td colspan="6">${message}</td></tr>`;
        }
    }

    // تصفية الرسائل على جانب العميل
    function applyClientSideFilters(filters) {
        let filteredMessages = [...allMessages];

        // تصفية برقم المرسل إليه (recipient)
        if (filters.receiver) {
            filteredMessages = filteredMessages.filter((msg) =>
                msg.receiver.replace(/^\+/, "").includes(filters.receiver.replace(/^\+/, ""))
            );
        }

        // تصفية الحالة
        if (filters.status) {
            const statusMap = {
                failed: "فشلت",
                sent: "مرسلة",
                delivered: "تم التوصيل",
                pending: "قيد الانتظار",
            };
            const arabicStatus = statusMap[filters.status.toLowerCase()];
            filteredMessages = filteredMessages.filter((msg) => msg.status === arabicStatus);
        }

        // تصفية التاريخ
        if (filters.from_date) {
            filteredMessages = filteredMessages.filter((msg) => new Date(msg.sent_at) >= new Date(filters.from_date));
        }
        if (filters.to_date) {
            filteredMessages = filteredMessages.filter((msg) => new Date(msg.sent_at) <= new Date(`${filters.to_date}T23:59:59`));
        }

        displayMessages(filteredMessages);
    }

    // عرض الرسائل في الجدول
    function displayMessages(messages) {
        messagesBody.innerHTML = "";
        if (messages.length === 0) {
            messagesBody.innerHTML = '<tr><td colspan="6">لا توجد رسائل متاحة</td></tr>';
            return;
        }
        messages.forEach((msg) => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><input type="checkbox" class="message-checkbox" data-id="${msg.id}"></td>
                <td>${msg.sender}</td>
                <td>${msg.receiver}</td>
                <td>${msg.content}</td>
                <td>${msg.status}</td>
                <td>${new Date(msg.sent_at).toLocaleString("ar-EG")}</td>
            `;
            messagesBody.appendChild(row);
        });

        // إضافة مستمع لـ checkboxes
        document.querySelectorAll(".message-checkbox").forEach((checkbox) => {
            checkbox.addEventListener("change", () => {
                selectedMessages = Array.from(document.querySelectorAll(".message-checkbox:checked")).map(
                    (cb) => cb.dataset.id
                );
                deleteSelected.style.display = selectedMessages.length > 0 ? "inline-block" : "none";
            });
        });
    }

    // مستمع لتحديد الكل
    selectAll.addEventListener("change", () => {
        const checkboxes = document.querySelectorAll(".message-checkbox");
        checkboxes.forEach((cb) => (cb.checked = selectAll.checked));
        selectedMessages = selectAll.checked
            ? Array.from(checkboxes).map((cb) => cb.dataset.id)
            : [];
        deleteSelected.style.display = selectedMessages.length > 0 ? "inline-block" : "none";
    });

    // تطبيق الفلاتر
    applyFilters.addEventListener("click", () => {
        const filters = {};
        if (searchPhone.value) filters.receiver = searchPhone.value;
        if (statusFilter.value) filters.status = statusFilter.value;
        if (fromDate.value) filters.from_date = fromDate.value;
        if (toDate.value) filters.to_date = toDate.value;
        fetchMessages(filters);
    });

    // حذف الرسائل المحددة
    deleteSelected.addEventListener("click", async () => {
        if (confirm("هل أنت متأكد من حذف الرسائل المحددة؟")) {
            try {
                await axios.post(
                    "/api/messages/delete-messages",
                    { message_ids: selectedMessages },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                alert("تم حذف الرسائل بنجاح");
                fetchMessages();
                selectedMessages = [];
                deleteSelected.style.display = "none";
            } catch (error) {
                alert("فشل في حذف الرسائل: " + (error.response?.data?.message || error.message));
            }
        }
    });

    // جلب الرسائل عند تحميل الصفحة
    fetchMessages();
});