const customersService = require('../services/customers.service');
const xlsx = require('xlsx');

exports.getCustomers = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error('معرف المستخدم غير موجود');
        const params = {
            search: req.query.search,
            sort: req.query.sort,
            ids: req.query.ids ? req.query.ids.split(',').map(id => parseInt(id)) : null
        };
        const customers = await customersService.getCustomers(userId, params);
        res.json({ success: true, data: customers.data, total: customers.total });
    } catch (error) {
        console.error('Error getting customers:', error.message, { userId: req.user?.userId });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCustomer = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error('معرف المستخدم غير موجود');
        const customerData = {
            user_id: userId,
            name: req.body.name || null,
            phone: req.body.phone || null,
            email: req.body.email || null,
            city: req.body.city || null
        };
        await customersService.addCustomer(customerData);
        res.json({ success: true, customer: customerData });
    } catch (error) {
        console.error('Error creating customer:', error.message, { userId: req.user?.userId, body: req.body });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.importExcel = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error('معرف المستخدم غير موجود');
        if (!req.file) throw new Error('الملف مطلوب');
        await customersService.importExcel(userId, req.file);
        res.json({ success: true });
    } catch (error) {
        console.error('Error importing Excel:', error.message, { userId: req.user?.userId });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.importManual = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error('معرف المستخدم غير موجود');
        const { numbers } = req.body;
        if (!numbers || !Array.isArray(numbers)) throw new Error('الأرقام مطلوبة');
        await customersService.importManual(userId, numbers);
        res.json({ success: true });
    } catch (error) {
        console.error('Error importing manually:', error.message, { userId: req.user?.userId });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.syncCustomers = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error('معرف المستخدم غير موجود');
        await customersService.syncCustomers(userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error syncing customers:', error.message, { userId: req.user?.userId });
        res.status(500).json({ success: false, message: error.message });
    }
};