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
exports.requireAdmin = void 0;
const requireAdmin = async (req, res, next) => {
    try {
        // Check if user exists and has admin role
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please log in to access this resource'
            });
        }
        // Check admin role in database
        const { pgPool } = await Promise.resolve().then(() => __importStar(require('../config/database')));
        const adminCheck = await pgPool.query('SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL', [req.user.id]);
        if (adminCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'Account may have been deleted'
            });
        }
        const userRole = adminCheck.rows[0].role;
        // Check if user has admin role
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin privileges required',
                message: 'This action requires administrator access',
                requiredRole: 'admin',
                currentRole: userRole || 'user'
            });
        }
        // Add admin info to request for further processing
        req.adminRole = userRole;
        next();
    }
    catch (error) {
        console.error('Admin Check Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify admin privileges',
            message: 'Please try again later'
        });
    }
};
exports.requireAdmin = requireAdmin;
