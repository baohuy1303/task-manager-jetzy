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

    const organizationRepository = require('../repositories/organizationRepository');
    
    if (user.organization_id) {
        const org = await organizationRepository.findById(user.organization_id);
        if (org && org.status === 'suspended' && user.role !== 'admin') {
            throw new Error('Organization is suspended');
        }
    }

    if (!user.is_active) {
        throw new Error('User account is deactivated');
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  async register(name, email, password, organizationName, correlationId) {
    // 1. Check if user already exists (global email uniqueness)
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    const { runTransaction } = require('../../config/db');
    const auditLogRepository = require('../repositories/auditLogRepository');

    return await runTransaction(async (client) => {
      // 2. Hash password with pepper
      const salt = await bcrypt.genSalt(10);
      const pepper = process.env.PEPPER;
      const passwordHash = await bcrypt.hash(password + pepper, salt);

      // 3. Create organization first
      const organizationRepository = require('../repositories/organizationRepository');
      const org = await organizationRepository.create(organizationName, null, client);

      // 4. Create admin user with organization_id
      const user = await userRepository.create({
        organization_id: org.id,
        name,
        email,
        password_hash: passwordHash,
        role: 'admin'
      }, client);

      // 5. Audit Log (Transactional)
      await auditLogRepository.create({
        organization_id: org.id,
        entity_type: 'user',
        entity_id: user.id,
        action: 'user_registered',
        performed_by: user.id,
        metadata: { 
          org_name: organizationName,
          email: email,
          request_id: correlationId
        }
      }, client);

      // 6. Generate token (includes org_id)
      const token = this.generateToken(user);
      return { user, organization: org, token };
    });
  }

  generateToken(user) {
    return jwt.sign(
      { id: user.id, role: user.role, organization_id: user.organization_id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
  }
}

module.exports = new AuthService();
