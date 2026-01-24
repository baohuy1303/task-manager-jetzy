const userRepository = require('../repositories/userRepository');
const organizationService = require('./organizationService');
const bcrypt = require('bcrypt');

class UserService {
  async createUser({ organization_id, name, email, password, role }) {
    // 1. Check if user exists
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // 2. Validate Org Requirement
    if (role !== 'admin' && !organization_id) {
        throw new Error('Organization ID is required for non-admin users');
    }
    
    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const pepper = process.env.PEPPER;
    const passwordHash = await bcrypt.hash(password + pepper, salt);

    // 4. Create User
    const user = await userRepository.create({
      organization_id: organization_id || null, 
      name,
      email,
      password_hash: passwordHash,
      role
    });

    return user;
  }

  async updateUserOrganization(id, organization_id) {
     if (!organization_id) throw new Error('Organization ID required');
     // Verify Org exists
     const orgRepo = require('../repositories/organizationRepository');
     const org = await orgRepo.findById(organization_id);
     if (!org) throw new Error('Organization not found');

     return await userRepository.updateOrganization(id, organization_id);
  }

  async assignProject(adminUser, userId, projectId) {
      const targetUser = await this.getUserById(userId);
      if (adminUser.organization_id !== targetUser.organization_id) throw new Error('Access denied: User is in different organization');
      
      // Verify Project exists and belongs to Org
      if (projectId) {
          const projectRepo = require('../repositories/projectRepository');
          const project = await projectRepo.findById(projectId);
          if (!project) throw new Error('Project not found');
          if (project.organization_id !== adminUser.organization_id) throw new Error('Access denied: Project is in different organization');
      }

      return await userRepository.updateProject(userId, projectId);
  }

  async assignProject(adminUser, userId, projectId) {
      const targetUser = await this.getUserById(userId);
      if (adminUser.organization_id !== targetUser.organization_id) throw new Error('Access denied: User is in different organization');
      
      // Verify Project exists and belongs to Org
      if (projectId) {
          const projectRepo = require('../repositories/projectRepository');
          const project = await projectRepo.findById(projectId);
          if (!project) throw new Error('Project not found');
          if (project.organization_id !== adminUser.organization_id) throw new Error('Access denied: Project is in different organization');
      }

      return await userRepository.updateProject(userId, projectId);
  }

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  async getUsersByOrganization(organization_id, filters = {}) {
    const { decodeCursor, buildPaginationResponse } = require('../utils/pagination');
    const limit = parseInt(filters.limit) || 50;
    const cursor = decodeCursor(filters.cursor);

    const users = await userRepository.findByOrganization(organization_id, {
        ...filters,
        limit,
        cursor
    });

    return buildPaginationResponse(users, limit, (item) => ({
        sortValue: item.created_at,
        id: item.id
    }));
  }
}

module.exports = new UserService();
