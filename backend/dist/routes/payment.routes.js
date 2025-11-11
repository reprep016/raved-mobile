"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const payment_controller_1 = require("../controllers/payment.controller");
const router = (0, express_1.Router)();
// Paystack webhook handler
router.post('/webhooks/paystack', payment_controller_1.paymentController.handlePaystackWebhook);
// Initialize payment for subscription
router.post('/subscriptions/initialize', auth_middleware_1.authenticate, payment_controller_1.paymentController.initializeSubscriptionPayment);
// Initialize checkout payment
router.post('/initialize-checkout', auth_middleware_1.authenticate, payment_controller_1.paymentController.initializeCheckoutPayment);
// Verify payment
router.get('/payments/verify/:reference', auth_middleware_1.authenticate, payment_controller_1.paymentController.verifyPayment);
exports.default = router;
