const express = require('express');
const router = express.Router();
const blacklistController = require('../controllers/blacklistController');
const { authenticateToken } = require('./auth');

router.get('/settings', authenticateToken, blacklistController.getSettings);
router.post('/settings', authenticateToken, blacklistController.updateSettings);
router.get('/numbers', authenticateToken, blacklistController.getNumbers);
router.post('/numbers', authenticateToken, blacklistController.addNumber);
router.delete('/numbers/:id', authenticateToken, blacklistController.deleteNumber);
// Webhook endpoint for Zender received messages
router.post('/zender/received', blacklistController.handleWebhook);
module.exports = router;