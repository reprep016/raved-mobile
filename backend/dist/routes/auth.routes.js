"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const router = (0, express_1.Router)();
// Login
router.post('/login', [
    (0, express_validator_1.body)('identifier').notEmpty().withMessage('Identifier is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
], auth_controller_1.login);
// Refresh token
router.post('/refresh', [
    (0, express_validator_1.body)('refreshToken').notEmpty().withMessage('Refresh token is required'),
], auth_controller_1.refresh);
// Email Verification
router.post('/send-verification-email', auth_middleware_1.authenticate, auth_controller_1.sendEmailVerification);
router.post('/verify-email', [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Verification token is required'),
], auth_controller_1.verifyEmail);
// Password Reset
router.post('/forgot-password', [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
], auth_controller_1.requestPasswordReset);
router.post('/reset-password', [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Reset token is required'),
    (0, express_validator_1.body)('newPassword').isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
], auth_controller_1.resetPassword);
// Email Verification (with rate limiting)
router.post('/send-verification-email', auth_middleware_1.authenticate, rate_limit_middleware_1.authRateLimit, auth_controller_1.sendEmailVerification);
router.post('/verify-email', rate_limit_middleware_1.authRateLimit, [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Verification token is required'),
], auth_controller_1.verifyEmail);
// Password Reset (with rate limiting)
router.post('/forgot-password', rate_limit_middleware_1.authRateLimit, [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail(),
], auth_controller_1.requestPasswordReset);
router.post('/reset-password', rate_limit_middleware_1.criticalRateLimit, [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Reset token is required'),
    (0, express_validator_1.body)('newPassword').isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
], auth_controller_1.resetPassword);
// SMS Verification
router.post('/send-sms-verification', auth_middleware_1.authenticate, auth_controller_1.sendSMSVerification);
router.post('/verify-sms-code', auth_middleware_1.authenticate, [
    (0, express_validator_1.body)('code').isLength({ min: 6, max: 6 }).withMessage('Verification code must be 6 digits'),
], auth_controller_1.verifySMSCode);
// SMS Password Reset
router.post('/sms-forgot-password', [
    (0, express_validator_1.body)('phone').matches(/^(\+233|0)[0-9]{9}$/).withMessage('Invalid Ghana phone number format'),
], auth_controller_1.requestSMSPasswordReset);
router.post('/sms-reset-password', [
    (0, express_validator_1.body)('phone').matches(/^(\+233|0)[0-9]{9}$/).withMessage('Invalid Ghana phone number format'),
    (0, express_validator_1.body)('code').isLength({ min: 6, max: 6 }).withMessage('Reset code must be 6 digits'),
    (0, express_validator_1.body)('newPassword').isLength({ min: 8 })
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
], auth_controller_1.resetPasswordWithSMS);
// SMS Two-Factor Authentication
router.post('/enable-sms-2fa', auth_middleware_1.authenticate, auth_controller_1.enableSMSTwoFactor);
router.post('/disable-sms-2fa', auth_middleware_1.authenticate, auth_controller_1.disableSMSTwoFactor);
router.post('/send-sms-2fa-code', [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
], auth_controller_1.sendSMSTwoFactorCode);
router.post('/verify-sms-2fa-code', [
    (0, express_validator_1.body)('userId').notEmpty().withMessage('User ID is required'),
    (0, express_validator_1.body)('code').isLength({ min: 6, max: 6 }).withMessage('2FA code must be 6 digits'),
], auth_controller_1.verifySMSTwoFactorCode);
exports.default = router;
