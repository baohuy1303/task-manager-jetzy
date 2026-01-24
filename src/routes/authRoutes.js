const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const validate = require('../middlewares/validationMiddleware');
const { authSchema } = require('../validations/schemas');

router.post('/login', validate(authSchema.login), authController.login);

module.exports = router;
