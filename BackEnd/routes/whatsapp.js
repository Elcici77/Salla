
const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsappController");
const { authenticateToken } = require('./auth');

router.get("/generate-qr", authenticateToken, whatsappController.generateQR);
router.get("/check-status", authenticateToken, whatsappController.checkStatus);
router.get("/get-current-status", authenticateToken, whatsappController.getCurrentStatus);
router.post("/disconnect", authenticateToken, whatsappController.disconnect);
router.post("/save-connection", authenticateToken, whatsappController.saveConnection);

module.exports = router;