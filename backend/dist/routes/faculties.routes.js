"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const faculties_controller_1 = require("../controllers/faculties.controller");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Get all faculties
router.get('/', faculties_controller_1.facultiesController.getFaculties);
// Get faculty stats
router.get('/:facultyId/stats', faculties_controller_1.facultiesController.getFacultyStats);
exports.default = router;
