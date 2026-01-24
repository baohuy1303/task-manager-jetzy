const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const validate = require('../middlewares/validationMiddleware');
const { userSchema } = require('../validations/schemas');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

router.post('/', validate(userSchema.create), userController.create);

router.use(authenticate);
router.get('/:id', authorize('admin', 'manager'), userController.getById);

// Admin Link Route
router.patch('/:id/organization', authorize('admin'), userController.updateOrganization);

// Admin/Manager Project Assignment Route
router.patch('/:id/project', authorize('admin', 'manager'), userController.assignProject);

module.exports = router;
