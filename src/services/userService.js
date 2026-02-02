const userRepository = require('../repositories/userRepository');
const organizationService = require('./organizationService');
const taskRepository = require('../repositories/taskRepository');
const bcrypt = require('bcrypt');
const projectMemberRepository = require('../repositories/projectMemberRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const { runTransaction } = require('../../config/db');

class UserService {
  async deactivateUser(adminUser, targetUserId, correlationId) {
    if (adminUser.role !== 'admin') {
        throw new Error('Access denied: Only admins can deactivate users');
    }

    const targetUser = await this.getUserById(targetUserId);
    if (targetUser.organization_id !== adminUser.organization_id) {
        throw new Error('Access denied: User is in different organization');
    }

    // Prevent self-deactivation
    if (adminUser.id === targetUserId) {
        throw new Error('Access denied: Admins cannot deactivate themselves');
    }

    const result = await runTransaction(async (client) => {
        const deactivatedUser = await userRepository.deactivate(targetUserId, client);
        const unassignedTasks = await taskRepository.unassignTasks(targetUserId, client);
        
        await auditLogRepository.create({
              organization_id: adminUser.organization_id,
              entity_type: 'user',
              entity_id: targetUserId,
              action: 'deactivate',
              performed_by: adminUser.id,
              metadata: { 
                unassigned_tasks: unassignedTasks.length,
                request_id: correlationId
              }
        }, client);

        return {
            user: deactivatedUser,
            unassignedTasks,
            unassignedTasksCount: unassignedTasks.length
        };
    });

    // Queue notifications
    if (targetUser.role === 'member' && result.unassignedTasksCount === 0) {
        return { 
        user: result.user, 
        unassignedTasksCount: result.unassignedTasksCount 
    };
    }
    const notificationService = require('./notificationService');
    notificationService.notifyDeactivation(result.user, result.unassignedTasks, adminUser.id, correlationId).catch(err => {
         console.error('[UserService] Failed to queue deactivation notifications:', err);
    });

    return { 
        user: result.user, 
        unassignedTasksCount: result.unassignedTasksCount 
    };
  }

  async reactivateUser(adminUser, targetUserId, correlationId) {
      if (adminUser.role !== 'admin') {
          throw new Error('Access denied: Only admins can reactivate users');
      }

      const targetUser = await this.getUserById(targetUserId);
      if (targetUser.organization_id !== adminUser.organization_id) {
          throw new Error('Access denied: User is in different organization');
      }

      return await runTransaction(async (client) => {
          const activatedUser = await userRepository.activate(targetUserId, client);
          
           await auditLogRepository.create({
              organization_id: adminUser.organization_id,
              entity_type: 'user',
              entity_id: targetUserId,
              action: 'activate',
              performed_by: adminUser.id,
              metadata: { request_id: correlationId }
          }, client);
          
          return activatedUser;
      });
  }

  
  async createUser(creatorUser, { organization_id, name, email, password, role }, correlationId) {
    // 1. Validate that organization_id is provided (required)
    if (!organization_id) {
      throw new Error('Organization ID is required');
    }

    // 2. Validate that creator's organization matches the target organization
    if (creatorUser.organization_id !== organization_id) {
      throw new Error('Access denied: You can only create users in your own organization');
    }

    // 3. Check if user exists (global email uniqueness)
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    // 4. Validate that organization exists
    const orgRepo = require('../repositories/organizationRepository');
    const org = await orgRepo.findById(organization_id);
    if (!org) {
      throw new Error('Organization not found');
    }
    
    // 5. Hash Password
    const salt = await bcrypt.genSalt(10);
    const pepper = process.env.PEPPER;
    const passwordHash = await bcrypt.hash(password + pepper, salt);

    return await runTransaction(async (client) => {
      // 6. Create User
      const user = await userRepository.create({
        organization_id,
        name,
        email,
        password_hash: passwordHash,
        role
      }, client);

      // 7. Audit Log (Transactional)
      await auditLogRepository.create({
        organization_id: organization_id,
        entity_type: 'user',
        entity_id: user.id,
        action: 'user_created',
        performed_by: creatorUser.id,
        metadata: { 
          role,
          email: email,
          request_id: correlationId
        }
      }, client);

      return user;
    });
  }

  async updateUser(requestingUser, targetUserId, updates, correlationId) {
      // 1. Fetch Target User
      const targetUser = await this.getUserById(targetUserId);
      if (targetUser.organization_id !== requestingUser.organization_id) {
          throw new Error('Access denied: User is in different organization');
      }

      // 2. Permission Logic
      const isSelf = requestingUser.id === targetUserId;
      const isAdmin = requestingUser.role === 'admin';

      if (!isSelf && !isAdmin) {
          // Managers and Members cannot update others
          throw new Error('Access denied: You cannot update other users');
      }

      if (isSelf && !isAdmin) {
          // Self update restrictions
          if (updates.role) {
              throw new Error('Access denied: You cannot allow to update your own role');
          }
          if (updates.is_active !== undefined || updates.organization_id) {
               throw new Error('Access denied: restricted fields');
          }
      }

      // 3. Prepare Updates
      const cleanUpdates = { ...updates };
      
      // organization_id is immutable - explicitly reject attempts to change it
      if (updates.organization_id && updates.organization_id !== targetUser.organization_id) {
          throw new Error('Access denied: organization_id cannot be changed');
      }
      
      // Prevent accidental Org update via this route
      delete cleanUpdates.organization_id; 
      delete cleanUpdates.id;

      if (cleanUpdates.password) {
          const salt = await bcrypt.genSalt(10);
          const pepper = process.env.PEPPER;
          cleanUpdates.password_hash = await bcrypt.hash(cleanUpdates.password + pepper, salt);
          delete cleanUpdates.password;
      }

      // 4. Update (Transactional Audit)
      return await runTransaction(async (client) => {
          const oldRole = targetUser.role;
          const updatedUser = await userRepository.update(targetUserId, cleanUpdates, client); 
          
          let action = 'update';
          let metadata = Object.keys(updates);
          
          if (cleanUpdates.role && cleanUpdates.role !== oldRole) {
              action = 'role_change';
              metadata = { from: oldRole, to: cleanUpdates.role };
          }

          await auditLogRepository.create({
              organization_id: requestingUser.organization_id,
              entity_type: 'user',
              entity_id: targetUserId,
              action: action,
              performed_by: requestingUser.id,
              metadata: Object.assign({}, metadata, { request_id: correlationId })
          }, client);

          return updatedUser;
      });
  }

  /*async updateUserOrganization(id, organization_id) {
     if (!organization_id) throw new Error('Organization ID required');
     // Verify Org exists
     const orgRepo = require('../repositories/organizationRepository');
     const org = await orgRepo.findById(organization_id);
     const user = await userRepository.findById(id);
     if (!org) throw new Error('Organization not found');
     if (user.organization_id !== organization_id) throw new Error('User is in different organization');

     return await userRepository.updateOrganization(id, organization_id);
  }*/

  async assignProject(adminUser, userId, projectId, action = 'assign', correlationId) {
      const targetUser = await this.getUserById(userId);
      
      // Permission Check: Manager can ONLY assign to Members
      if (adminUser.role === 'manager' && targetUser.role !== 'member') {
          throw new Error('Access denied: Managers can only assign projects to members');
      }
      
      if (targetUser.role === 'admin') throw new Error('Admins cannot be assigned to projects');
      if (adminUser.organization_id !== targetUser.organization_id) throw new Error('Access denied: User is in different organization');
      
      // Verify Project exists and belongs to Org
      if (projectId) {
          const projectRepo = require('../repositories/projectRepository');
          const project = await projectRepo.findById(projectId);
          if (!project) throw new Error('Project not found');
          if (project.organization_id !== adminUser.organization_id) throw new Error('Access denied: Project is in different organization');
          
          return await runTransaction(async (client) => {
              const alreadyHasProject = await projectMemberRepository.findProjectsByUser(userId); // Read can optionally be outside tx, but inside is fine
              
              if (action === 'remove') {
                if (alreadyHasProject.length === 0) {
                    throw new Error('User does not have a project assigned');
                }
                const result = await projectMemberRepository.removeMember(projectId, userId, client);
                
                await auditLogRepository.create({
                    organization_id: adminUser.organization_id,
                    entity_type: 'user',
                    entity_id: userId,
                    action: 'remove_project',
                    performed_by: adminUser.id,
                    metadata: { 
                      project_id: projectId,
                      request_id: correlationId
                    }
                }, client);
                
                return result;
              }
              
              // Restriction: Members can only be in one project at a time
              if (targetUser.role === 'member' && alreadyHasProject.length > 0) {
                  throw new Error('User already has a project assigned, remove the old one, and reassign');
              }

              const result = await projectMemberRepository.addMember(projectId, userId, client);
              
               await auditLogRepository.create({
                    organization_id: adminUser.organization_id,
                    entity_type: 'user',
                    entity_id: userId,
                    action: 'assign_project',
                    performed_by: adminUser.id,
                    metadata: { 
                      project_id: projectId,
                      request_id: correlationId
                    }
                }, client);
                
                return result;
          });
      }
      return null;
  }



  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  async getUsersByOrganization(user, filters = {}) {
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
