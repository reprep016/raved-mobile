import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { requireAdmin } from '../middleware/admin.middleware';
import { authenticate, requirePremium } from '../middleware/auth.middleware';

const router = Router();

// User analytics routes (require authentication, premium for advanced)
router.get('/user', authenticate, analyticsController.getUserAnalytics.bind(analyticsController));
router.get('/store', authenticate, requirePremium, analyticsController.getStoreAnalytics.bind(analyticsController));
router.post('/track', authenticate, analyticsController.trackEvent.bind(analyticsController));

// Admin analytics routes (all require admin authentication)
router.get('/admin/dashboard', authenticate, requireAdmin, analyticsController.getDashboardOverview.bind(analyticsController));
router.get('/admin/realtime', authenticate, requireAdmin, analyticsController.getRealtimeMetrics.bind(analyticsController));

// User activity endpoints
router.get('/admin/users/:userId/activity', authenticate, requireAdmin, analyticsController.getUserActivityHistory.bind(analyticsController));

// Report generation endpoints
router.post('/admin/reports/generate', authenticate, requireAdmin, analyticsController.generateReport.bind(analyticsController));
router.get('/admin/reports', authenticate, requireAdmin, analyticsController.getReports.bind(analyticsController));

// A/B Testing endpoints
router.post('/admin/ab-tests', authenticate, requireAdmin, analyticsController.createABTest.bind(analyticsController));
router.get('/admin/ab-tests/:testName/variant', authenticate, requireAdmin, analyticsController.getABTestVariant.bind(analyticsController));
router.post('/admin/ab-tests/:testName/results', authenticate, requireAdmin, analyticsController.trackABTestResult.bind(analyticsController));
router.get('/admin/ab-tests/:testName/results', authenticate, requireAdmin, analyticsController.getABTestResults.bind(analyticsController));

// Advanced analytics endpoints
router.post('/admin/query', authenticate, requireAdmin, analyticsController.runCustomQuery.bind(analyticsController));
router.get('/admin/export', authenticate, requireAdmin, analyticsController.exportAnalyticsData.bind(analyticsController));

export default router;