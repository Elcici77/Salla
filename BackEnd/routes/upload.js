const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('./auth'); // استيراد authenticateToken

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'campaigns');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `media-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'audio/mpeg', 'audio/ogg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('نوع الملف غير مدعوم'), false);
        }
    }
});

router.post('/', authenticateToken, upload.single('media'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'لم يتم رفع ملف' });
        }
        const filePath = `/uploads/campaigns/${req.file.filename}`;
        res.json({
            success: true,
            filename: req.file.filename,
            path: filePath
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ success: false, message: 'حدث خطأ أثناء الرفع' });
    }
});

module.exports = router;