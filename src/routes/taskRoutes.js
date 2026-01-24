const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validationMiddleware');
const { taskSchema } = require('../validations/schemas');

router.use(authenticate);

router.post('/', authorize('admin', 'manager'), validate(taskSchema.create), taskController.create);
router.get('/', taskController.getByProject); // Logic inside service checks for Member access
router.patch('/:id/status', validate(taskSchema.updateStatus), taskController.updateStatus); // Members can do this
router.delete('/:id', authorize('admin', 'manager'), taskController.delete);

module.exports = router;
