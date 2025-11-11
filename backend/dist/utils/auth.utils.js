"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyToken = verifyToken;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
// Generate JWT Token
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.CONFIG.JWT_SECRET, { expiresIn: '24h' });
}
// Generate Refresh Token
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.CONFIG.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}
// Verify Token
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.CONFIG.JWT_SECRET);
    }
    catch (error) {
        return null;
    }
}
// Hash Password
async function hashPassword(password) {
    return bcryptjs_1.default.hash(password, 12);
}
// Compare Password
async function comparePassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
