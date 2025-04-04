const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db'); // Make sure this is properly configured
const router = express.Router();

require('dotenv').config(); // Load environment variables

// Middleware setup
router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Utility function to send verification email
// Update the sendVerificationEmail function in auth.js
async function sendVerificationEmail(email, verificationCode) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'رمز التحقق من حسابك',
            html: `
                    <div style="font-family: Arial, sans-serif; text-align: center;">
                        <h2 style="color: #3498db;">تأكيد البريد الإلكتروني</h2>
                        <p>رمز التحقق الخاص بك هو:</p>
                        <div style="font-size: 24px; font-weight: bold; margin: 20px 0; padding: 10px; background: #f4f4f4;">
                            ${verificationCode}
                        </div>
                        <p>هذا الرمز مكون من ${verificationCode.length} أرقام وصالح لمدة 10 دقائق فقط</p>
                    </div>
                `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send verification email');
    }
}

// Database query helper function
function queryDatabase(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) {
                console.error('Database error:', err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || "default_secret", (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Routes

/**
 * @route POST /register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
    const { username, email, password, phone } = req.body;

    // Input validation
    if (!username || !email || !password || !phone) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        // Check if email already exists
        const existingUsers = await queryDatabase("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "Email already in use" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        // لإنشاء رمز مكون من 4 أرقام
        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

        // Insert new user
        const result = await queryDatabase(
            "INSERT INTO users (username, email, password, phone, verification_code, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
            [username, email, hashedPassword, phone, verificationCode, false]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId: result.insertId },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: '1h' }
        );

        // Send verification email (don't block response if this fails)
        sendVerificationEmail(email, verificationCode)
            .catch(err => console.error('Email sending failed:', err));

        return res.status(201).json({
            message: "User registered successfully. Please check your email for verification.",
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route POST /verify-email
 * @desc Verify user's email with the code sent
 * @access Public
 */
router.post('/verify-email', async (req, res) => {
    const { email, verificationCode } = req.body;

    try {
        // Find user
        const [user] = await queryDatabase(
            "SELECT * FROM users WHERE email = ?", 
            [email]
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if already verified
        if (user.is_verified) {
            return res.status(200).json({ message: "Email already verified" });
        }

        // Check verification code
        if (user.verification_code !== verificationCode) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        // Check if code is expired (10 minutes)
        const codeSentTime = new Date(user.last_code_sent || user.created_at);
        const currentTime = new Date();
        const diffInMinutes = (currentTime - codeSentTime) / (1000 * 60);

        if (diffInMinutes > 15) {
            return res.status(400).json({ message: "Verification code has expired" });
        }

        // Mark as verified
        await queryDatabase(
            "UPDATE users SET is_verified = true WHERE email = ?",
            [email]
        );

        return res.status(200).json({ message: "Email verified successfully" });

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({ message: "Internal server error" });
    }
});


/**
 * @route POST /login
 * @desc Authenticate user and return JWT token
 * @access Public
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    try {
        const users = await queryDatabase("SELECT * FROM users WHERE email = ?", [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = users[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if email is verified
        if (!user.is_verified) {
            return res.status(403).json({ 
                message: "Email not verified. Please check your email for verification code.",
                needsVerification: true
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || "default_secret",
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route GET /protected
 * @desc Test protected route
 * @access Private
 */
router.get('/protected', authenticateToken, async (req, res) => {
    try {
        const users = await queryDatabase("SELECT id, username, email FROM users WHERE id = ?", [req.user.userId]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ 
            message: "Protected route accessed successfully",
            user: users[0]
        });
    } catch (error) {
        console.error('Protected route error:', error);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * @route GET /test
 * @desc Test route
 * @access Public
 */
router.get('/test', (req, res) => {
    res.json({ message: "Authentication routes are working!" });
});

// Error handling middleware
router.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: "An unexpected error occurred" });
});


/**
 * @route POST /resend-code
 * @desc Resend verification code
 * @access Public
 */
router.post('/resend-code', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        // Check if user exists
        const [user] = await queryDatabase("SELECT * FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "Email not found" });
        }

        if (user.is_verified) {
            return res.status(400).json({ message: "Email already verified" });
        }

        // Generate new code
        const newCode = Math.floor(1000 + Math.random() * 9000).toString();
        const now = new Date();

        // Update verification code and timestamp
        await queryDatabase(
            "INSERT INTO users (username, email, password, phone, verification_code, is_verified, last_code_sent) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [username, email, hashedPassword, phone, verificationCode, false, now]
        );

        // Send email
        await sendVerificationEmail(email, newCode);

        return res.status(200).json({ 
            message: "Verification code resent successfully",
            code: newCode // For testing only
        });

    } catch (error) {
        console.error('Resend error:', error);
        return res.status(500).json({ 
            message: "Failed to resend verification code",
            error: error.message
        });
    }
});


module.exports = router;