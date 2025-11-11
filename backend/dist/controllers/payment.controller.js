"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentController = void 0;
const payment_service_1 = require("../services/payment.service");
const config_1 = require("../config");
exports.paymentController = {
    handlePaystackWebhook: async (req, res) => {
        try {
            const signature = req.headers['x-paystack-signature'];
            const payload = JSON.stringify(req.body);
            // Verify webhook signature
            if (config_1.CONFIG.PAYSTACK_SECRET_KEY) {
                const crypto = require('crypto');
                const hash = crypto.createHmac('sha512', config_1.CONFIG.PAYSTACK_SECRET_KEY).update(payload).digest('hex');
                if (hash !== signature) {
                    console.error('Invalid webhook signature');
                    return res.status(401).send('Invalid signature');
                }
            }
            await payment_service_1.paymentService.handlePaystackWebhook(req.body);
            res.status(200).send('Webhook processed');
        }
        catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).send('Webhook processing failed');
        }
    },
    initializeSubscriptionPayment: async (req, res) => {
        try {
            const { plan } = req.body;
            const userId = req.user.id;
            const userEmail = req.user.email;
            const paymentDetails = await payment_service_1.paymentService.initializeSubscriptionPayment(userId, userEmail, plan);
            res.json({
                success: true,
                payment: paymentDetails
            });
        }
        catch (error) {
            console.error('Initialize Payment Error:', error);
            res.status(500).json({ error: 'Failed to initialize payment' });
        }
    },
    initializeCheckoutPayment: async (req, res) => {
        try {
            const checkoutData = req.body;
            const userId = req.user.id;
            const userEmail = req.user.email;
            const paymentDetails = await payment_service_1.paymentService.initializeCheckoutPayment(userId, userEmail, checkoutData);
            res.json({
                success: true,
                ...paymentDetails
            });
        }
        catch (error) {
            console.error('Initialize Checkout Payment Error:', error);
            res.status(500).json({ error: error.message });
        }
    },
    verifyPayment: async (req, res) => {
        try {
            const { reference } = req.params;
            const userId = req.user.id;
            const userEmail = req.user.email;
            const subscription = await payment_service_1.paymentService.verifyPayment(reference, userId, userEmail);
            res.json({
                success: true,
                message: 'Payment verified and subscription activated',
                subscription
            });
        }
        catch (error) {
            console.error('Verify Payment Error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
};
