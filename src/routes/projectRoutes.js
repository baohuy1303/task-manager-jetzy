const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate, authorize, requireOrganization, validateOrganizationStatus } = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validationMiddleware');
const { projectSchema } = require('../validations/schemas');

router.use(authenticate); 
router.use(validateOrganizationStatus);
router.use(requireOrganization); // All project routes require an org

router.post('/', authorize('admin', 'manager'), validate(projectSchema.create), projectController.create);
router.get('/', projectController.getProjects);
router.get('/:id', projectController.getById);
router.patch('/:id', authorize('admin', 'manager'), validate(projectSchema.update), projectController.update);

module.exports = router;
