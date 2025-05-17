const express = require("express");
const router = express.Router();
const messagesController = require("../controllers/messagesController");
const { authenticateToken } = require('./auth');


router.get("/sent-messages", authenticateToken, messagesController.getSentMessages);
router.post("/delete-messages", authenticateToken, messagesController.deleteMessages);

module.exports = router;