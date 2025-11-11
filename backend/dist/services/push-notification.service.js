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
exports.PushNotificationService = void 0;
const admin = __importStar(require("firebase-admin"));
const database_1 = require("../config/database");
class PushNotificationService {
    static initialize() {
        if (this.initialized)
            return;
        try {
            // Initialize Firebase Admin SDK
            const serviceAccount = {
                type: "service_account",
                project_id: process.env.FIREBASE_PROJECT_ID,
                private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                client_id: process.env.FIREBASE_CLIENT_ID,
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
            };
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID
            });
            this.initialized = true;
            console.log('Firebase Admin SDK initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize Firebase Admin SDK:', error);
        }
    }
    static async sendPushNotification(userId, title, body, data) {
        try {
            // Get user's device tokens
            const result = await database_1.pgPool.query('SELECT token, platform FROM device_tokens WHERE user_id = $1 AND active = true', [userId]);
            if (result.rows.length === 0) {
                console.log(`No active device tokens found for user ${userId}`);
                return;
            }
            const tokens = result.rows.map(row => row.token);
            // Send notifications individually (Firebase Admin SDK v11+ doesn't have sendMulticast)
            const promises = tokens.map(token => {
                const message = {
                    token,
                    notification: {
                        title,
                        body,
                    },
                    data: data || {},
                };
                return admin.messaging().send(message);
            });
            const results = await Promise.allSettled(promises);
            let successCount = 0;
            const failedTokens = [];
            results.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    successCount++;
                }
                else {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.log(`Push notification sent to ${successCount} devices for user ${userId}`);
            // Handle failed tokens (remove invalid ones)
            if (failedTokens.length > 0) {
                await this.removeInvalidTokens(failedTokens);
            }
        }
        catch (error) {
            console.error('Error sending push notification:', error);
        }
    }
    static async sendNotificationToMultipleUsers(userIds, title, body, data) {
        const promises = userIds.map(userId => this.sendPushNotification(userId, title, body, data));
        await Promise.allSettled(promises);
    }
    static async removeInvalidTokens(tokens) {
        try {
            await database_1.pgPool.query('UPDATE device_tokens SET active = false WHERE token = ANY($1)', [tokens]);
            console.log(`Removed ${tokens.length} invalid device tokens`);
        }
        catch (error) {
            console.error('Error removing invalid tokens:', error);
        }
    }
    static async getUserTokens(userId) {
        try {
            const result = await database_1.pgPool.query('SELECT token FROM device_tokens WHERE user_id = $1 AND active = true', [userId]);
            return result.rows.map(row => row.token);
        }
        catch (error) {
            console.error('Error getting user tokens:', error);
            return [];
        }
    }
}
exports.PushNotificationService = PushNotificationService;
PushNotificationService.initialized = false;
