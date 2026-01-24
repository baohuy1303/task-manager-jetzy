const authService = require('../services/authService');

class AuthController {
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
      }

      const { user, token } = await authService.login(email, password);
      
      // Don't send password_hash back
      const userResponse = { ...user };
      delete userResponse.password_hash;

      return res.json({ success: true, data: { user: userResponse, token } });
    } catch (error) {
       if (error.message === 'Invalid email or password' || error.message === 'User account is deactivated') {
        return res.status(401).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
}

module.exports = new AuthController();
