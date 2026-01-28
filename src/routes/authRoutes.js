const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middlewares/validationMiddleware');
const { authSchema } = require('../validations/schemas');

const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/register', authLimiter, validate(authSchema.register), authController.register);
router.post('/login', authLimiter, validate(authSchema.login), authController.login);

module.exports = router;
