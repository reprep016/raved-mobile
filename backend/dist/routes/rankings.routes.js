"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rankings_controller_1 = require("../controllers/rankings.controller");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Get rankings
router.get('/', rankings_controller_1.rankingsController.getRankings);
exports.default = router;
