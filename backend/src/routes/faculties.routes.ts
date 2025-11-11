import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { facultiesController } from '../controllers/faculties.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all faculties
router.get('/', facultiesController.getFaculties);

// Get faculty stats
router.get('/:facultyId/stats', facultiesController.getFacultyStats);

export default router;

