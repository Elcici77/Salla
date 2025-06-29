const express = require('express');
const router = express.Router();
const customersController = require('../controllers/customersController');
const { authenticateToken } = require('./auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Get customers (with search and sort)
router.get('/', authenticateToken, customersController.getCustomers);

// Add new customer
 router.post('/', authenticateToken, customersController.createCustomer);

// Sync customers
router.post('/sync', authenticateToken, customersController.syncCustomers);

// Import customers from Excel
router.post('/import/excel', authenticateToken, upload.single('file'), customersController.importExcel);

// Import customers manually
router.post('/import/manual', authenticateToken, customersController.importManual);

module.exports = router;