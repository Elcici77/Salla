const express = require('express');
const router = express.Router();
const groupsController = require('../controllers/groupsController');
const { authenticateToken } = require('./auth');

// Create group
router.post('/', authenticateToken, groupsController.createGroup);

// Delete group
router.delete('/:id', authenticateToken, groupsController.deleteGroup);

module.exports = router;