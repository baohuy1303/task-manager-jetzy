const express = require('express');
const router = express.Router();
const taskWorkflowController = require('../controllers/taskWorkflowController');
const { authenticate, authorize, requireOrganization, validateOrganizationStatus } = require('../middlewares/authMiddleware');

router.use(authenticate);
router.use(validateOrganizationStatus);
router.use(requireOrganization);

// Task-specific history (rbac handled in service for members)
router.get('/tasks/:taskId/history', taskWorkflowController.getTaskHistory);

// Broad history (Admin/Manager only)
router.get('/history', authorize('admin', 'manager'), taskWorkflowController.getAllHistory);

module.exports = router;
