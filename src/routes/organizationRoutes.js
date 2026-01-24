const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const validate = require('../middlewares/validationMiddleware');
const { orgSchema } = require('../validations/schemas');
const { authenticate, authorize, validateOrganizationStatus } = require('../middlewares/authMiddleware');

router.use(authenticate);
router.use(validateOrganizationStatus);

router.post('/', authorize('admin'), validate(orgSchema.create), organizationController.create);
router.get('/:id', organizationController.getById);
router.patch('/:id/suspend', authorize('admin'), organizationController.suspend);
router.patch('/:id/activate', authorize('admin'), organizationController.activate);

module.exports = router;
