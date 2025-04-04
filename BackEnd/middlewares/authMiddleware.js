const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(403).json({ message: "Access Denied. No token provided." });
    }

    try {
        const secret = process.env.JWT_SECRET || "default_secret";
        const decoded = jwt.verify(token.split(" ")[1], secret); // استخراج التوكن بدون "Bearer"
        req.user = decoded; // تخزين بيانات المستخدم في الطلب
        next(); // المتابعة إلى المسار المحمي
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
};

module.exports = authenticateToken;
