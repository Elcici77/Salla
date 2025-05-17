const whatsappService = require("../services/customer.service");

// exports.generateQR = async (req, res) => {
//     try {
//         const userId = req.user.userId;
//         console.log("Generating QR for user:", userId);
//         const { qr_url, info_url } = await whatsappService.generateQR(userId);
//         res.json({ success: true, qr_url, info_url });
//     } catch (error) {
//         console.error("Generate QR Error for user:", req.user.userId, { error: error.message });
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

