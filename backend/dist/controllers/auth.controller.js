"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserLanguagePreferences = exports.refresh = exports.verifySMSTwoFactorCode = exports.sendSMSTwoFactorCode = exports.disableSMSTwoFactor = exports.enableSMSTwoFactor = exports.resetPasswordWithSMS = exports.requestSMSPasswordReset = exports.verifySMSCode = exports.sendSMSVerification = exports.resetPassword = exports.requestPasswordReset = exports.verifyEmail = exports.sendEmailVerification = exports.login = void 0;
const database_1 = require("../config/database");
const auth_utils_1 = require("../utils/auth.utils");
const utils_1 = require("../utils");
const config_1 = require("../config");
const jwt = __importStar(require("jsonwebtoken"));
const email_service_1 = require("../services/email.service");
const sms_service_1 = require("../services/sms.service");
const crypto = __importStar(require("crypto"));
const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.status(400).json({ error: 'Identifier and password are required' });
        }
        // Find user by email, username, or phone
        let userResult;
        if (identifier.includes('@')) {
            // Email login
            userResult = await database_1.pgPool.query('SELECT id, username, email, phone, password_hash, first_name, last_name, sms_two_factor_enabled, phone_verified FROM users WHERE email = $1 AND deleted_at IS NULL', [identifier.toLowerCase()]);
        }
        else if (identifier.startsWith('@')) {
            // Username login
            userResult = await database_1.pgPool.query('SELECT id, username, email, phone, password_hash, first_name, last_name, sms_two_factor_enabled, phone_verified FROM users WHERE username = $1 AND deleted_at IS NULL', [identifier.substring(1)]);
        }
        else {
            // Phone login
            userResult = await database_1.pgPool.query('SELECT id, username, email, phone, password_hash, first_name, last_name, sms_two_factor_enabled, phone_verified FROM users WHERE phone = $1 AND deleted_at IS NULL', [identifier]);
        }
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = userResult.rows[0];
        // Verify password
        const isPasswordValid = await (0, auth_utils_1.comparePassword)(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Check if 2FA is enabled
        if (user.sms_two_factor_enabled && user.phone && user.phone_verified) {
            // Generate 2FA code
            const twoFactorCode = (0, utils_1.generateVerificationCode)();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
            // Store code in Redis
            const codeKey = `login_2fa:${user.id}`;
            await database_1.redis.setex(codeKey, 300, twoFactorCode); // 5 minutes
            // Send SMS 2FA code
            await sms_service_1.smsService.sendTwoFactorCode(user.phone, twoFactorCode);
            return res.json({
                success: true,
                requiresTwoFactor: true,
                userId: user.id,
                message: '2FA code sent to your phone'
            });
        }
        // Generate tokens
        const tokenPayload = {
            userId: user.id,
            username: user.username,
        };
        const token = (0, auth_utils_1.generateToken)(tokenPayload);
        const refreshToken = (0, auth_utils_1.generateRefreshToken)({ userId: user.id });
        // Store refresh token in Redis
        await database_1.redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken);
        // Update last login
        await database_1.pgPool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token,
            refreshToken
        });
    }
    catch (error) {
        console.error('❌ Login Error:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Stack:', error.stack);
        }
        res.status(500).json({ error: 'Failed to login', details: error instanceof Error ? error.message : String(error) });
    }
};
exports.login = login;
const sendEmailVerification = async (req, res) => {
    try {
        const userId = req.user.id;
        // Get user details
        const userResult = await database_1.pgPool.query('SELECT email, first_name, email_verified FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];
        if (user.email_verified) {
            return res.status(400).json({ error: 'Email already verified' });
        }
        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        // Store token in database
        await database_1.pgPool.query(`
            INSERT INTO email_verification_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
                token = EXCLUDED.token,
                expires_at = EXCLUDED.expires_at,
                created_at = CURRENT_TIMESTAMP
        `, [userId, verificationToken, expiresAt]);
        // Send verification email
        await email_service_1.EmailService.sendVerificationEmail(user.email, user.first_name, verificationToken);
        res.json({
            success: true,
            message: 'Verification email sent successfully'
        });
    }
    catch (error) {
        console.error('Send Email Verification Error:', error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
};
exports.sendEmailVerification = sendEmailVerification;
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Verification token required' });
        }
        // Find token in database
        const tokenResult = await database_1.pgPool.query(`
            SELECT user_id, expires_at FROM email_verification_tokens
            WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP
        `, [token]);
        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }
        const { user_id } = tokenResult.rows[0];
        // Update user email verification status
        await database_1.pgPool.query('UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user_id]);
        // Delete used token
        await database_1.pgPool.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);
        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    }
    catch (error) {
        console.error('Verify Email Error:', error);
        res.status(500).json({ error: 'Failed to verify email' });
    }
};
exports.verifyEmail = verifyEmail;
const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        // Find user by email
        const userResult = await database_1.pgPool.query('SELECT id, first_name FROM users WHERE email = $1 AND deleted_at IS NULL', [email.toLowerCase()]);
        if (userResult.rows.length === 0) {
            // Don't reveal if email exists or not for security
            return res.json({
                success: true,
                message: 'If an account with this email exists, a password reset link has been sent.'
            });
        }
        const user = userResult.rows[0];
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        // Store token in database
        await database_1.pgPool.query(`
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
                token = EXCLUDED.token,
                expires_at = EXCLUDED.expires_at,
                used = false,
                created_at = CURRENT_TIMESTAMP
        `, [user.id, resetToken, expiresAt]);
        // Send password reset email
        await email_service_1.EmailService.sendPasswordResetEmail(email, user.first_name, resetToken);
        res.json({
            success: true,
            message: 'If an account with this email exists, a password reset link has been sent.'
        });
    }
    catch (error) {
        console.error('Request Password Reset Error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
};
exports.requestPasswordReset = requestPasswordReset;
const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        // Validate password strength (basic check)
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        // Find token in database
        const tokenResult = await database_1.pgPool.query(`
            SELECT user_id, expires_at FROM password_reset_tokens
            WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP AND used = false
        `, [token]);
        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        const { user_id } = tokenResult.rows[0];
        // Hash new password
        const hashedPassword = await (0, auth_utils_1.hashPassword)(newPassword);
        // Update user password
        await database_1.pgPool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, user_id]);
        // Mark token as used
        await database_1.pgPool.query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);
        // Send SMS notification if user has SMS notifications enabled
        try {
            const userResult = await database_1.pgPool.query('SELECT phone, sms_security_alerts_enabled FROM users WHERE id = $1', [user_id]);
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                if (user.phone && user.sms_security_alerts_enabled) {
                    await sms_service_1.smsService.sendSecurityAlert(user.phone, 'password changed');
                }
            }
        }
        catch (smsError) {
            console.error('Failed to send password change SMS:', smsError);
            // Don't fail the password reset if SMS fails
        }
        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    }
    catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};
exports.resetPassword = resetPassword;
// SMS Verification
const sendSMSVerification = async (req, res) => {
    try {
        const userId = req.user.id;
        // Get user details
        const userResult = await database_1.pgPool.query('SELECT phone, phone_verified, sms_two_factor_enabled FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];
        if (!user.phone) {
            return res.status(400).json({ error: 'No phone number associated with this account' });
        }
        if (user.phone_verified) {
            return res.status(400).json({ error: 'Phone number already verified' });
        }
        // Generate verification code
        const verificationCode = (0, utils_1.generateVerificationCode)();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        // Store code in Redis with expiration
        const codeKey = `sms_verification:${userId}`;
        await database_1.redis.setex(codeKey, 600, verificationCode); // 10 minutes
        // Send SMS
        await sms_service_1.smsService.sendVerificationCode(user.phone, verificationCode);
        res.json({
            success: true,
            message: 'SMS verification code sent successfully'
        });
    }
    catch (error) {
        console.error('Send SMS Verification Error:', error);
        res.status(500).json({ error: 'Failed to send SMS verification code' });
    }
};
exports.sendSMSVerification = sendSMSVerification;
const verifySMSCode = async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Verification code is required' });
        }
        // Get stored code from Redis
        const codeKey = `sms_verification:${userId}`;
        const storedCode = await database_1.redis.get(codeKey);
        if (!storedCode || storedCode !== code) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        // Update user phone verification status
        await database_1.pgPool.query('UPDATE users SET phone_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        // Delete used code
        await database_1.redis.del(codeKey);
        res.json({
            success: true,
            message: 'Phone number verified successfully'
        });
    }
    catch (error) {
        console.error('Verify SMS Code Error:', error);
        res.status(500).json({ error: 'Failed to verify SMS code' });
    }
};
exports.verifySMSCode = verifySMSCode;
// SMS-based Password Reset
const requestSMSPasswordReset = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        // Find user by phone
        const userResult = await database_1.pgPool.query('SELECT id, first_name FROM users WHERE phone = $1 AND deleted_at IS NULL', [phone]);
        if (userResult.rows.length === 0) {
            // Don't reveal if phone exists or not for security
            return res.json({
                success: true,
                message: 'If an account with this phone number exists, a password reset code has been sent.'
            });
        }
        const user = userResult.rows[0];
        // Generate reset code
        const resetCode = (0, utils_1.generateVerificationCode)();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        // Store code in Redis
        const codeKey = `sms_password_reset:${user.id}`;
        await database_1.redis.setex(codeKey, 600, resetCode);
        // Send SMS
        await sms_service_1.smsService.sendPasswordResetCode(phone, resetCode);
        res.json({
            success: true,
            message: 'If an account with this phone number exists, a password reset code has been sent.'
        });
    }
    catch (error) {
        console.error('Request SMS Password Reset Error:', error);
        res.status(500).json({ error: 'Failed to process SMS password reset request' });
    }
};
exports.requestSMSPasswordReset = requestSMSPasswordReset;
const resetPasswordWithSMS = async (req, res) => {
    try {
        const { phone, code, newPassword } = req.body;
        if (!phone || !code || !newPassword) {
            return res.status(400).json({ error: 'Phone, code, and new password are required' });
        }
        // Validate password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        // Find user by phone
        const userResult = await database_1.pgPool.query('SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL', [phone]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }
        const userId = userResult.rows[0].id;
        // Verify code
        const codeKey = `sms_password_reset:${userId}`;
        const storedCode = await database_1.redis.get(codeKey);
        if (!storedCode || storedCode !== code) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }
        // Hash new password
        const hashedPassword = await (0, auth_utils_1.hashPassword)(newPassword);
        // Update user password
        await database_1.pgPool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, userId]);
        // Delete used code
        await database_1.redis.del(codeKey);
        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    }
    catch (error) {
        console.error('Reset Password with SMS Error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};
exports.resetPasswordWithSMS = resetPasswordWithSMS;
// Two-Factor Authentication with SMS
const enableSMSTwoFactor = async (req, res) => {
    try {
        const userId = req.user.id;
        // Get user details
        const userResult = await database_1.pgPool.query('SELECT phone, phone_verified FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];
        if (!user.phone || !user.phone_verified) {
            return res.status(400).json({ error: 'Phone number must be verified before enabling 2FA' });
        }
        // Enable SMS 2FA
        await database_1.pgPool.query('UPDATE users SET sms_two_factor_enabled = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        res.json({
            success: true,
            message: 'SMS two-factor authentication enabled successfully'
        });
    }
    catch (error) {
        console.error('Enable SMS 2FA Error:', error);
        res.status(500).json({ error: 'Failed to enable SMS 2FA' });
    }
};
exports.enableSMSTwoFactor = enableSMSTwoFactor;
const disableSMSTwoFactor = async (req, res) => {
    try {
        const userId = req.user.id;
        // Disable SMS 2FA
        await database_1.pgPool.query('UPDATE users SET sms_two_factor_enabled = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        res.json({
            success: true,
            message: 'SMS two-factor authentication disabled successfully'
        });
    }
    catch (error) {
        console.error('Disable SMS 2FA Error:', error);
        res.status(500).json({ error: 'Failed to disable SMS 2FA' });
    }
};
exports.disableSMSTwoFactor = disableSMSTwoFactor;
const sendSMSTwoFactorCode = async (req, res) => {
    try {
        const { userId } = req.body; // This would come from login attempt
        // Get user details
        const userResult = await database_1.pgPool.query('SELECT phone, sms_two_factor_enabled FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];
        if (!user.sms_two_factor_enabled || !user.phone) {
            return res.status(400).json({ error: 'SMS 2FA not enabled for this account' });
        }
        // Generate 2FA code
        const twoFactorCode = (0, utils_1.generateVerificationCode)();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        // Store code in Redis
        const codeKey = `sms_2fa:${userId}`;
        await database_1.redis.setex(codeKey, 300, twoFactorCode); // 5 minutes
        // Send SMS
        await sms_service_1.smsService.sendTwoFactorCode(user.phone, twoFactorCode);
        res.json({
            success: true,
            message: '2FA code sent successfully'
        });
    }
    catch (error) {
        console.error('Send SMS 2FA Code Error:', error);
        res.status(500).json({ error: 'Failed to send 2FA code' });
    }
};
exports.sendSMSTwoFactorCode = sendSMSTwoFactorCode;
const verifySMSTwoFactorCode = async (req, res) => {
    try {
        const { userId, code } = req.body;
        if (!code) {
            return res.status(400).json({ error: '2FA code is required' });
        }
        // Verify code
        const codeKey = `sms_2fa:${userId}`;
        const storedCode = await database_1.redis.get(codeKey);
        if (!storedCode || storedCode !== code) {
            return res.status(400).json({ error: 'Invalid or expired 2FA code' });
        }
        // Delete used code
        await database_1.redis.del(codeKey);
        // Generate tokens for successful 2FA verification
        const userResult = await database_1.pgPool.query('SELECT id, username, email, first_name, last_name FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];
        const tokenPayload = {
            userId: user.id,
            username: user.username,
        };
        const token = (0, auth_utils_1.generateToken)(tokenPayload);
        const refreshToken = (0, auth_utils_1.generateRefreshToken)({ userId: user.id });
        // Update last login
        await database_1.pgPool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name
            },
            token,
            refreshToken
        });
    }
    catch (error) {
        console.error('Verify SMS 2FA Code Error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA code' });
    }
};
exports.verifySMSTwoFactorCode = verifySMSTwoFactorCode;
// Refresh token handler
const refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken)
            return res.status(400).json({ error: 'Refresh token is required' });
        // Verify refresh token using refresh secret
        const payload = (() => {
            try {
                return jwt.verify(refreshToken, config_1.CONFIG.JWT_REFRESH_SECRET);
            }
            catch (err) {
                return null;
            }
        })();
        if (!payload || !payload.userId)
            return res.status(401).json({ error: 'Invalid refresh token' });
        const userId = payload.userId;
        // Check stored refresh token in Redis
        const stored = await database_1.redis.get(`refresh_token:${userId}`);
        if (!stored || stored !== refreshToken) {
            return res.status(401).json({ error: 'Refresh token expired or invalid' });
        }
        // Get user details
        const userResult = await database_1.pgPool.query('SELECT id, username, email, first_name, last_name FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0)
            return res.status(404).json({ error: 'User not found' });
        const user = userResult.rows[0];
        // Generate new tokens
        const tokenPayload = {
            userId: user.id,
            username: user.username,
        };
        const token = (0, auth_utils_1.generateToken)(tokenPayload);
        const newRefresh = (0, auth_utils_1.generateRefreshToken)({ userId: user.id });
        // Store new refresh token
        await database_1.redis.setex(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, newRefresh);
        res.json({ success: true, token, refreshToken: newRefresh });
    }
    catch (error) {
        console.error('Refresh Error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
};
exports.refresh = refresh;
// Update user language preferences
const updateUserLanguagePreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const { language, dateFormat, currency } = req.body;
        // Validate inputs
        const validLanguages = ['en', 'fr', 'tw', 'ha'];
        const validDateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
        const validCurrencies = ['GHS', 'USD', 'EUR', 'GBP'];
        if (language && !validLanguages.includes(language)) {
            return res.status(400).json({ error: 'Invalid language' });
        }
        if (dateFormat && !validDateFormats.includes(dateFormat)) {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        if (currency && !validCurrencies.includes(currency)) {
            return res.status(400).json({ error: 'Invalid currency' });
        }
        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramIndex = 1;
        if (language !== undefined) {
            updates.push(`language = $${paramIndex++}`);
            values.push(language);
        }
        if (dateFormat !== undefined) {
            updates.push(`date_format = $${paramIndex++}`);
            values.push(dateFormat);
        }
        if (currency !== undefined) {
            updates.push(`currency = $${paramIndex++}`);
            values.push(currency);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid preferences to update' });
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);
        const query = `
            UPDATE users
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING language, date_format, currency
        `;
        const result = await database_1.pgPool.query(query, values);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            success: true,
            message: 'Language preferences updated successfully',
            preferences: result.rows[0]
        });
    }
    catch (error) {
        console.error('Update User Language Preferences Error:', error);
        res.status(500).json({ error: 'Failed to update language preferences' });
    }
};
exports.updateUserLanguagePreferences = updateUserLanguagePreferences;
