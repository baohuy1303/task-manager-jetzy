const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const { authenticate, authorize, validateOrganizationStatus } = require('../middlewares/authMiddleware');

router.use(authenticate);
router.use(validateOrganizationStatus);

// Admin-only endpoint - organization scoping enforced in service layer
router.get('/', authorize('admin'), auditLogController.getLogs);

module.exports = router;
