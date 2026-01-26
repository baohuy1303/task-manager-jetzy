const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const validate = require('../middlewares/validationMiddleware');
const { userSchema } = require('../validations/schemas');
const { authenticate, authorize, requireOrganization, validateOrganizationStatus } = require('../middlewares/authMiddleware');

router.post('/', validate(userSchema.create), userController.create);

router.use(authenticate);
router.use(validateOrganizationStatus);

// 1. Routes allowed properly WITHOUT Org (e.g. Linking)
router.patch('/:id/organization', authorize('admin'), userController.updateOrganization);

// 2. All other routes REQUIRE Org
router.use(requireOrganization);

// Admin/Manager Project Assignment Route
router.patch('/:id/project', authorize('admin', 'manager'), userController.assignProject);

// User Update Route (Self or Admin)
router.patch('/:id', authorize('admin', 'manager', 'member'), validate(userSchema.update), userController.update);

router.delete('/:id', authorize('admin'), userController.deactivate); 
router.patch('/:id/activate', authorize('admin'), userController.activate);
router.get('/:id', authorize('admin', 'manager', 'member'), userController.getById); 
router.get('/', authorize('admin', 'manager', 'member'), userController.getAll); 

module.exports = router;
