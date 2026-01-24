const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validationMiddleware');
const { projectSchema } = require('../validations/schemas');

router.use(authenticate); // Metadata: all routes require auth

router.post('/', authorize('admin', 'manager'), validate(projectSchema.create), projectController.create);
router.get('/', authorize('admin', 'manager'), projectController.getAll);
router.get('/:id', authorize('admin', 'manager'), projectController.getById);
router.patch('/:id', authorize('admin', 'manager'), validate(projectSchema.update), projectController.update);

module.exports = router;
