const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const validate = require('../middlewares/validationMiddleware');
const { userSchema } = require('../validations/schemas');
const { authenticate, authorize, requireOrganization } = require('../middlewares/authMiddleware');

router.post('/', validate(userSchema.create), userController.create);

router.use(authenticate);

// 1. Routes allowed properly WITHOUT Org (e.g. Linking)
router.patch('/:id/organization', authorize('admin'), userController.updateOrganization);

// 2. All other routes REQUIRE Org
router.use(requireOrganization);

// Admin/Manager Project Assignment Route
router.patch('/:id/project', authorize('admin', 'manager'), userController.assignProject);
router.get('/:id', authorize('admin', 'manager'), userController.getById); // This was previously line 11
router.get('/', authorize('admin', 'manager', 'member'), userController.getAll); // This was line 16
router.patch('/:id/project', authorize('admin', 'manager'), userController.assignProject); // This was line 19

module.exports = router;
