const userRepository = require('../repositories/userRepository');
const organizationService = require('./organizationService');
const taskRepository = require('../repositories/taskRepository');
const bcrypt = require('bcrypt');
const projectMemberRepository = require('../repositories/projectMemberRepository');

class UserService {
  async deactivateUser(adminUser, targetUserId) {
    // 1. Verify Permission (Admin only)
    if (adminUser.role !== 'admin') {
        throw new Error('Access denied: Only admins can deactivate users');
    }

    // 2. Verify Target User exists and belongs to same Org
    const targetUser = await this.getUserById(targetUserId);
    if (targetUser.organization_id !== adminUser.organization_id) {
        throw new Error('Access denied: User is in different organization');
    }

    // 3. Deactivate User
    const deactivatedUser = await userRepository.deactivate(targetUserId);

    // 4. Reassign Tasks
    // Logic: Tasks assigned to this user are moved to the creator of their respective projects.
    const reassignedTasks = await taskRepository.reassignTasksToProjectCreator({ old_assigned_to: targetUserId });

    return {
        user: deactivatedUser,
        reassignedTasksCount: reassignedTasks.length
    };
  }

  async reactivateUser(adminUser, targetUserId) {
      if (adminUser.role !== 'admin') {
          throw new Error('Access denied: Only admins can reactivate users');
      }

      const targetUser = await this.getUserById(targetUserId);
      if (targetUser.organization_id !== adminUser.organization_id) {
          throw new Error('Access denied: User is in different organization');
      }

      return await userRepository.activate(targetUserId);
  }

  
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
     const user = await userRepository.findById(id);
     if (!org) throw new Error('Organization not found');
     if (user.organization_id !== organization_id) throw new Error('User is in different organization');

     return await userRepository.updateOrganization(id, organization_id);
  }

  async assignProject(adminUser, userId, projectId, action = 'assign') {
      const targetUser = await this.getUserById(userId);
      if (adminUser.role === 'manager' && targetUser.role === 'manager') {
          throw new Error('Access denied: Managers cannot assign themselves to projects');
      }
      if (targetUser.role === 'admin') throw new Error('Admins cannot be assigned to projects');
      if (adminUser.organization_id !== targetUser.organization_id) throw new Error('Access denied: User is in different organization');
      
      // Verify Project exists and belongs to Org
      if (projectId) {
          const projectRepo = require('../repositories/projectRepository');
          const project = await projectRepo.findById(projectId);
          if (!project) throw new Error('Project not found');
          if (project.organization_id !== adminUser.organization_id) throw new Error('Access denied: Project is in different organization');
          const alreadyHasProject = await projectMemberRepository.findProjectsByUser(userId);
          if (action === 'remove') {
            if (alreadyHasProject.length === 0) {
                throw new Error('User does not have a project assigned');
            }
              return await projectMemberRepository.removeMember(projectId, userId);
          }
          if (alreadyHasProject.length > 0) {
              throw new Error('User already has a project assigned, remove the old one, and reassign');
          }
          return await projectMemberRepository.addMember(projectId, userId);
      }
      return null;
  }



  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  async getUsersByOrganization(user, filters = {}) {
    // Note: 'user' is now the full user object, not just organization_id
    const organization_id = user.organization_id;
    const { decodeCursor, buildPaginationResponse } = require('../utils/pagination');
    const limit = parseInt(filters.limit) || 50;
    const cursor = decodeCursor(filters.cursor);

    let users;
    
    if (filters.project_id) {
        // Security Check: If requesting user is a member, they must be part of the project
        if (user.role === 'member') {
            const isMember = await projectMemberRepository.isMember(filters.project_id, user.id);
            if (!isMember) {
                throw new Error('Access denied: You are not a member of this project');
            }
        }

        users = await projectMemberRepository.findMembersByProject(filters.project_id, { limit, cursor });
    } else {
        users = await userRepository.findByOrganization(organization_id, {
            ...filters,
            limit,  
            cursor
        });
    }

    return buildPaginationResponse(users, limit, (item) => ({
        sortValue: filters.project_id ? item.assigned_at : item.created_at,
        id: item.id
    }));
  }
}

module.exports = new UserService();
