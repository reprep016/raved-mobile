"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.themeController = void 0;
const theme_service_1 = require("../services/theme.service");
exports.themeController = {
    getThemes: async (req, res) => {
        try {
            const isPremium = req.user.subscription_tier === 'premium';
            const themes = await theme_service_1.themeService.getThemes(isPremium);
            res.json({ success: true, themes });
        }
        catch (error) {
            console.error('Get Themes Error:', error);
            res.status(500).json({ error: 'Failed to get themes' });
        }
    },
    getUserTheme: async (req, res) => {
        try {
            const userId = req.user.id;
            const userTheme = await theme_service_1.themeService.getUserTheme(userId);
            const autoTheme = await theme_service_1.themeService.getAutoTheme(userId);
            const systemTheme = await theme_service_1.themeService.getSystemTheme();
            res.json({
                success: true,
                theme: {
                    themeId: userTheme.themeId,
                    darkMode: userTheme.darkMode,
                    autoTheme,
                    systemTheme
                }
            });
        }
        catch (error) {
            console.error('Get User Theme Error:', error);
            res.status(500).json({ error: 'Failed to get user theme' });
        }
    },
    setUserTheme: async (req, res) => {
        try {
            const { themeId } = req.body;
            const userId = req.user.id;
            const isPremiumUser = req.user.subscription_tier === 'premium';
            const updatedThemeId = await theme_service_1.themeService.setUserTheme(userId, themeId, isPremiumUser);
            res.json({ success: true, message: 'Theme updated successfully', themeId: updatedThemeId });
        }
        catch (error) {
            console.error('Set Theme Error:', error);
            if (error.message.includes('Invalid theme') || error.message.includes('Premium subscription required')) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to set theme' });
        }
    },
    setUserDarkMode: async (req, res) => {
        try {
            const darkMode = Boolean(req.body.darkMode);
            const userId = req.user.id;
            if (typeof darkMode !== 'boolean') {
                return res.status(400).json({ error: 'darkMode must be a boolean value' });
            }
            const updatedDarkMode = await theme_service_1.themeService.setUserDarkMode(userId, darkMode);
            res.json({ success: true, message: 'Dark mode preference updated successfully', darkMode: updatedDarkMode });
        }
        catch (error) {
            console.error('Set Dark Mode Error:', error);
            res.status(500).json({ error: 'Failed to set dark mode preference' });
        }
    },
    getSystemTheme: async (req, res) => {
        try {
            const isNight = await theme_service_1.themeService.getSystemTheme();
            res.json({ success: true, systemTheme: isNight });
        }
        catch (error) {
            console.error('Get System Theme Error:', error);
            res.status(500).json({ error: 'Failed to get system theme' });
        }
    },
    getAutoTheme: async (req, res) => {
        try {
            const userId = req.user.id;
            const autoTheme = await theme_service_1.themeService.getAutoTheme(userId);
            res.json({ success: true, autoTheme });
        }
        catch (error) {
            console.error('Get Auto Theme Error:', error);
            res.status(500).json({ error: 'Failed to get auto theme' });
        }
    }
};
