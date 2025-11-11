"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const subscriptions_controller_1 = require("../controllers/subscriptions.controller");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Get subscription plans
router.get('/plans', subscriptions_controller_1.subscriptionsController.getPlans);
// Get user subscription status
router.get('/status', subscriptions_controller_1.subscriptionsController.getSubscriptionStatus);
exports.default = router;
