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

  async register(req, res, next) {
    try {
      const { name, email, password, organization_name } = req.body;
      
      if (!name || !email || !password || !organization_name) {
        return res.status(400).json({ 
          success: false, 
          error: 'Name, email, password, and organization_name are required' 
        });
      }

      const { user, organization, token } = await authService.register(
        name, email, password, organization_name
      );
      
      // Don't send password_hash back
      const userResponse = { ...user };
      delete userResponse.password_hash;

      return res.status(201).json({ 
        success: true, 
        data: { 
          user: userResponse,
          organization,
          token 
        } 
      });
    } catch (error) {
      if (error.message === 'Email already exists') {
        return res.status(409).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
}

module.exports = new AuthController();
