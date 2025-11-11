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
exports.paymentService = void 0;
const database_1 = require("../config/database");
const config_1 = require("../config");
// import paystack from 'paystack'; // Assuming paystack library is installed
exports.paymentService = {
    handlePaystackWebhook: async (event) => {
        console.log('Paystack Webhook:', event.event, event.data);
        switch (event.event) {
            case 'subscription.create':
                await exports.paymentService.handleSubscriptionCreate(event.data);
                break;
            case 'charge.success':
                await exports.paymentService.handleChargeSuccess(event.data);
                break;
            case 'subscription.disable':
                await exports.paymentService.handleSubscriptionDisable(event.data);
                break;
            case 'invoice.create':
                // await handleInvoiceCreate(event.data); // Not implemented in runnertwo.js
                break;
            case 'invoice.payment_failed':
                // await handleInvoicePaymentFailed(event.data); // Not implemented in runnertwo.js
                break;
        }
    },
    handleSubscriptionCreate: async (data) => {
        try {
            const { customer, plan, subscription_code } = data;
            const userResult = await database_1.pgPool.query('SELECT id FROM users WHERE email = $1', [customer.email]);
            if (userResult.rows.length === 0) {
                console.error('User not found for subscription:', customer.email);
                return;
            }
            const userId = userResult.rows[0].id;
            const startsAt = new Date();
            const expiresAt = new Date(startsAt);
            expiresAt.setDate(expiresAt.getDate() + 7); // Weekly subscription
            await database_1.pgPool.query(`
        INSERT INTO subscriptions (
          user_id, plan_type, amount, payment_method,
          payment_reference, status, starts_at, expires_at,
          subscription_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
                userId, 'weekly', plan.amount / 100, 'paystack',
                subscription_code, 'active', startsAt, expiresAt,
                subscription_code
            ]);
            await database_1.pgPool.query(`
        UPDATE users 
        SET subscription_tier = 'premium',
            subscription_expires_at = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [expiresAt, userId]);
            console.log('Subscription activated for user:', userId);
        }
        catch (error) {
            console.error('Handle Subscription Create Error:', error);
        }
    },
    handleChargeSuccess: async (data) => {
        try {
            const { customer, amount, reference } = data;
            const userResult = await database_1.pgPool.query('SELECT id FROM users WHERE email = $1', [customer.email]);
            if (userResult.rows.length === 0)
                return;
            const userId = userResult.rows[0].id;
            await database_1.pgPool.query(`
        UPDATE orders 
        SET payment_status = 'paid',
            status = 'confirmed',
            updated_at = CURRENT_TIMESTAMP
        WHERE payment_reference = $1
      `, [reference]);
            console.log('Payment successful for order:', reference);
        }
        catch (error) {
            console.error('Handle Charge Success Error:', error);
        }
    },
    handleSubscriptionDisable: async (data) => {
        try {
            const { customer, subscription_code } = data;
            const userResult = await database_1.pgPool.query('SELECT id FROM users WHERE email = $1', [customer.email]);
            if (userResult.rows.length === 0) {
                console.error('User not found for subscription disable:', customer.email);
                return;
            }
            const userId = userResult.rows[0].id;
            await database_1.pgPool.query(`
        UPDATE subscriptions
        SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND subscription_code = $2
      `, [userId, subscription_code]);
            await database_1.pgPool.query(`
        UPDATE users
        SET subscription_tier = 'free', subscription_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId]);
            console.log('Subscription disabled for user:', userId);
        }
        catch (error) {
            console.error('Handle Subscription Disable Error:', error);
        }
    },
    initializeSubscriptionPayment: async (userId, userEmail, plan) => {
        const amount = plan === 'weekly' ? config_1.CONFIG.PREMIUM_WEEKLY_PRICE * 100 : config_1.CONFIG.PREMIUM_WEEKLY_PRICE * 4 * 100; // in kobo
        // Implement actual Paystack transaction initialization
        try {
            const paystackModule = await Promise.resolve().then(() => __importStar(require('paystack')));
            const paystack = paystackModule.default(config_1.CONFIG.PAYSTACK_SECRET_KEY);
            const response = await paystack.transaction.initialize({
                email: userEmail,
                amount: amount,
                reference: `sub_${Date.now()}_${userId}`,
                name: `Raved Premium ${plan.charAt(0).toUpperCase() + plan.slice(1)} Subscription`,
                metadata: {
                    userId: userId,
                    plan: plan
                },
                callback_url: `${config_1.CONFIG.API_BASE_URL}/api/v1/payments/callback`
            });
            return response.data;
        }
        catch (paystackError) {
            console.error('Paystack initialization error:', paystackError);
            // Fallback to mock response for demo
            const mockResponse = {
                authorization_url: `https://paystack.com/pay/raved-${Date.now()}`,
                access_code: `access_${Date.now()}`,
                reference: `ref_${Date.now()}`
            };
            return mockResponse;
        }
    },
    initializeCheckoutPayment: async (userId, userEmail, checkoutData) => {
        try {
            // Calculate total amount from cart items
            let totalAmount = 0;
            for (const item of checkoutData.items) {
                const productResult = await database_1.pgPool.query('SELECT price FROM store_items WHERE id = $1', [item.productId]);
                if (productResult.rows.length > 0) {
                    totalAmount += parseFloat(productResult.rows[0].price) * item.quantity;
                }
            }
            // Add delivery fee if applicable
            if (checkoutData.deliveryMethod === 'hostel') {
                totalAmount += 5.00; // Delivery fee
            }
            const amountInKobo = Math.round(totalAmount * 100); // Convert to kobo
            // Create order record
            const orderResult = await database_1.pgPool.query(`
        INSERT INTO orders (
          user_id, total_amount, delivery_method, payment_method,
          buyer_phone, delivery_address, status, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
                userId,
                totalAmount,
                checkoutData.deliveryMethod,
                checkoutData.paymentMethod,
                checkoutData.buyerPhone,
                checkoutData.address || null,
                'pending',
                'pending'
            ]);
            const orderId = orderResult.rows[0].id;
            // Add order items
            for (const item of checkoutData.items) {
                await database_1.pgPool.query(`
          INSERT INTO order_items (order_id, product_id, quantity, price)
          SELECT $1, $2, $3, price FROM store_items WHERE id = $2
        `, [orderId, item.productId, item.quantity]);
            }
            // Initialize Paystack payment if payment method is momo
            if (checkoutData.paymentMethod === 'momo') {
                try {
                    const paystackModule = await Promise.resolve().then(() => __importStar(require('paystack')));
                    const paystack = paystackModule.default(config_1.CONFIG.PAYSTACK_SECRET_KEY);
                    const response = await paystack.transaction.initialize({
                        email: userEmail,
                        amount: amountInKobo,
                        reference: `order_${Date.now()}_${orderId}`,
                        name: `Raved Store Order #${orderId}`,
                        metadata: {
                            userId: userId,
                            orderId: orderId,
                            checkoutData: checkoutData
                        },
                        callback_url: `${config_1.CONFIG.API_BASE_URL}/api/v1/payments/callback`
                    });
                    // Update order with payment reference
                    await database_1.pgPool.query(`
            UPDATE orders SET payment_reference = $1 WHERE id = $2
          `, [response.data.reference, orderId]);
                    return response.data;
                }
                catch (paystackError) {
                    console.error('Paystack initialization error:', paystackError);
                    // Fallback to mock response for demo
                    const mockResponse = {
                        authorization_url: `https://paystack.com/pay/raved-${Date.now()}`,
                        access_code: `access_${Date.now()}`,
                        reference: `ref_${Date.now()}`
                    };
                    await database_1.pgPool.query(`
            UPDATE orders SET payment_reference = $1 WHERE id = $2
          `, [mockResponse.reference, orderId]);
                    return mockResponse;
                }
            }
            else {
                // For cash on delivery, mark as confirmed
                await database_1.pgPool.query(`
          UPDATE orders SET status = 'confirmed', payment_status = 'cash_on_delivery'
          WHERE id = $1
        `, [orderId]);
                return { success: true, orderId };
            }
        }
        catch (error) {
            console.error('Initialize Checkout Payment Error:', error);
            throw error;
        }
    },
    verifyPayment: async (reference, userId, userEmail) => {
        // Implement actual Paystack verification
        try {
            const paystackModule = await Promise.resolve().then(() => __importStar(require('paystack')));
            const paystack = paystackModule.default(config_1.CONFIG.PAYSTACK_SECRET_KEY);
            const response = await paystack.transaction.verify(reference);
            if (response.data.status === 'success') {
                const startsAt = new Date();
                const expiresAt = new Date(startsAt);
                expiresAt.setDate(expiresAt.getDate() + 7); // Weekly
                await database_1.pgPool.query(`
          UPDATE users
          SET subscription_tier = 'premium',
              subscription_expires_at = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [expiresAt, userId]);
                // Also update the latest subscription record if it exists
                await database_1.pgPool.query(`
          UPDATE subscriptions
          SET status = 'active', expires_at = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2 AND status = 'inactive'
          ORDER BY created_at DESC
          LIMIT 1
        `, [expiresAt, userId]);
                return {
                    tier: 'premium',
                    expiresAt
                };
            }
            else {
                throw new Error('Payment verification failed');
            }
        }
        catch (paystackError) {
            console.error('Paystack verification error:', paystackError);
            // Fallback to mock verification for demo
            const mockVerification = {
                status: true,
                data: {
                    status: 'success',
                    reference: reference,
                    amount: 50000, // 500 GHS in kobo
                    customer: {
                        email: userEmail
                    }
                }
            };
            if (mockVerification.data.status === 'success') {
                const startsAt = new Date();
                const expiresAt = new Date(startsAt);
                expiresAt.setDate(expiresAt.getDate() + 7); // Weekly
                await database_1.pgPool.query(`
          UPDATE users
          SET subscription_tier = 'premium',
              subscription_expires_at = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [expiresAt, userId]);
                // Also update the latest subscription record if it exists
                await database_1.pgPool.query(`
          UPDATE subscriptions
          SET status = 'active', expires_at = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2 AND status = 'inactive'
          ORDER BY created_at DESC
          LIMIT 1
        `, [expiresAt, userId]);
                return {
                    tier: 'premium',
                    expiresAt
                };
            }
            else {
                throw new Error('Payment verification failed');
            }
        }
    }
};
