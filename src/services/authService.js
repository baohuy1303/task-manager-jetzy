const userRepository = require('../repositories/userRepository');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
  async login(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const pepper = process.env.PEPPER;
    const isValidPassword = await bcrypt.compare(password + pepper, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    if (!user.is_active) {
        throw new Error('User account is deactivated');
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  generateToken(user) {
    return jwt.sign(
      { id: user.id, role: user.role, organization_id: user.organization_id, project_id: user.project_id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
  }
}

module.exports = new AuthService();
