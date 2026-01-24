const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate, authorize, requireOrganization } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validationMiddleware');
const { taskSchema } = require('../validations/schemas');

router.use(authenticate);
router.use(requireOrganization); // All task routes require an org

router.post('/', authorize('admin', 'manager'), validate(taskSchema.create), taskController.create);
router.get('/', taskController.getTasks); // Logic inside service checks for Member access
router.get('/:id', taskController.getTaskById); // Logic inside service checks for Member access
router.patch('/:id', authorize('admin', 'manager'), validate(taskSchema.update), taskController.update); // Admin/Manager Full Update
router.patch('/:id/status', validate(taskSchema.updateStatus), taskController.updateStatus); // Members can do this
router.delete('/:id', authorize('admin', 'manager'), taskController.delete);

module.exports = router;
