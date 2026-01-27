const taskRepository = require('../repositories/taskRepository');
const taskWorkflowRepository = require('../repositories/taskWorkflowRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const projectRepository = require('../repositories/projectRepository');
const projectMemberRepository = require('../repositories/projectMemberRepository');
const userRepository = require('../repositories/userRepository');
const { runTransaction } = require('../../config/db');
const notificationService = require('./notificationService');

class TaskService {
  async createTask(user, { project_id, title, description, priority, assigned_to, due_date }, correlationId) {
    // Verify project access (Read-only, can be outside transaction or inside. Inside is safer for consistency)
    const project = await projectRepository.findById(project_id);
    if (!project) throw new Error('Project not found');
    if (project.organization_id !== user.organization_id) throw new Error('Access denied');
    if (project.status === 'archived') throw new Error('Cannot create tasks in an archived project');
    if (assigned_to) {
      const assignedUser = await userRepository.findById(assigned_to);
      if (!assignedUser) throw new Error('User not found');
      if (assignedUser.organization_id !== user.organization_id) throw new Error('Access denied');
    }

    const result = await runTransaction(async (client) => {
        const task = await taskRepository.create({
          project_id,
          title,
          description,
          priority,
          assigned_to: assigned_to || user.id,
          due_date
        }, client);

        await auditLogRepository.create({
          organization_id: user.organization_id,
          entity_type: 'task',
          entity_id: task.id,
          action: 'create',
          performed_by: user.id,
          metadata: { 
            title,
            request_id: correlationId
          }
        }, client);

        return task;
    });

    if (assigned_to) {
        notificationService.notifyAssignee(result.id, title, assigned_to, user.id, correlationId);
    }

    return result;
  }

  async getTasks(user, filters = {}) {
     // Enforce Organization Scope
     const queryFilters = { ...filters, organization_id: user.organization_id };

     // Verification: If project_id is provided, ensure it belongs to the user's organization
     if (filters.project_id) {
         const project = await projectRepository.findById(filters.project_id);
         if (!project || project.organization_id !== user.organization_id) {
             throw new Error('Access denied: Project not found or belongs to another organization');
         }
     }
     if (user.role === 'member') {
             queryFilters.assigned_to = user.id;
         }



     const { decodeCursor, buildPaginationResponse } = require('../utils/pagination');
     
     // Pagination Logic
     const limit = parseInt(filters.limit) || 50;
     const cursor = decodeCursor(filters.cursor);
     

     const tasks = await taskRepository.findAll({
         ...queryFilters,
         limit,
         cursor 
     });

     return buildPaginationResponse(tasks, limit, (item) => ({
         sortValue: item.created_at,
         id: item.id
     }));
  }

  async getTaskById(user, id) {
    const task = await taskRepository.findById(id);
    if (!task) throw new Error('Task not found');
    
    const project = await projectRepository.findById(task.project_id);
    if (project.organization_id !== user.organization_id) throw new Error('Access denied');
    
    return task;
  }

  // Full Update (Admin/Manager)
  async updateTask(user, id, updates, expectedVersion, correlationId) {
      const task = await taskRepository.findById(id);
      if (!task) throw new Error('Task not found');

      // We explicitly check if project_id is provided in the update body and if it differs
      if (updates.project_id && updates.project_id !== task.project_id) {
          throw new Error('Access denied: Tasks cannot be moved between projects');
      }

      const oldStatus = task.status;
      const project = await projectRepository.findById(task.project_id);
      if (project.organization_id !== user.organization_id) throw new Error('Access denied');
      if (project.status === 'archived') throw new Error('Cannot update tasks in an archived project');

      // Validate Status Transition (if status is being updated)
      if (updates.status && updates.status !== oldStatus) {
          await this._validateStatusTransition(oldStatus, updates.status, user, task.id, correlationId);
      }

      return await runTransaction(async (client) => {
          // Remove project_id from updates just in case it was passed with the same value
          const cleanUpdates = { ...updates };
          delete cleanUpdates.project_id;

          const updatedTask = await taskRepository.update(id, cleanUpdates, expectedVersion, client);
          
          if (!updatedTask && expectedVersion !== undefined) {
              throw new Error('Conflict: Task has been modified by another user');
          }

          if (updates.status) {
            await taskWorkflowRepository.create({
              task_id: id,
              project_id: task.project_id, // Denormalized for faster history queries
              from_status: oldStatus,
              to_status: updates.status,
              changed_by: user.id
            }, client);
          }

          // Audit Log
          await auditLogRepository.create({
            organization_id: user.organization_id,
            entity_type: 'task',
            entity_id: task.id,
            action: 'update',
            performed_by: user.id,
            metadata: Object.assign({}, updates, { request_id: correlationId })
          }, client);

          return updatedTask;
      });
  }

  async updateTaskStatus(user, id, newStatus, expectedVersion, correlationId) {
    const task = await taskRepository.findById(id);
    if (!task) throw new Error('Task not found');
    
    const project = await projectRepository.findById(task.project_id);
    if (project.organization_id !== user.organization_id) throw new Error('Access denied');
    if (project.status === 'archived') throw new Error('Cannot update tasks in an archived project');

    if (user.role === 'member' && task.assigned_to !== user.id) {
        throw new Error('Access denied: Members can only update their own tasks');
    }
     const oldStatus = task.status;
     if (oldStatus === newStatus) return task;

     await this._validateStatusTransition(oldStatus, newStatus, user, id, correlationId);

    const result = await runTransaction(async (client) => {
        const updatedTask = await taskRepository.updateStatus(id, newStatus, expectedVersion, client);

        if (!updatedTask && expectedVersion !== undefined) {
             throw new Error('Conflict: Task has been modified by another user');
        }

        // Record History
        await taskWorkflowRepository.create({
            task_id: id,
            project_id: task.project_id,
            from_status: oldStatus,
            to_status: newStatus,
            changed_by: user.id
        }, client);

        // Audit Log
        await auditLogRepository.create({
          organization_id: user.organization_id,
          entity_type: 'task',
          entity_id: task.id,
          action: 'update_status',
          performed_by: user.id,
          metadata: { 
            from: oldStatus, 
            to: newStatus,
            request_id: correlationId
          }
        }, client);

        return updatedTask;
    });

    // Post-Transaction Notifications
    if (oldStatus === 'review' && newStatus === 'done') {
        notificationService.notifyManagers(id, task.title, task.project_id, user.id, correlationId);
    }
    
    return result;
  }

  async deleteTask(user, id, correlationId) {
    const task = await taskRepository.findById(id);
    if (!task) throw new Error('Task not found');

    const project = await projectRepository.findById(task.project_id);
    if (project.organization_id !== user.organization_id) throw new Error('Access denied');
    if (project.status === 'archived') throw new Error('Cannot delete tasks in an archived project');

    await runTransaction(async (client) => {
        await taskRepository.softDelete(id, client);

        // Audit Log
        await auditLogRepository.create({
            organization_id: user.organization_id,
            entity_type: 'task',
            entity_id: task.id,
            action: 'delete',
            performed_by: user.id,
            metadata: { 
              title: task.title,
              request_id: correlationId
            }
        }, client);
    });
  }


  async _validateStatusTransition(oldStatus, newStatus, user, taskId, correlationId) {
      const validTransitions = {
          'todo': ['in_progress'],
          'in_progress': ['review', 'todo'],
          'review': ['done', 'in_progress'],
          'done': ['review']
      };

      if (!validTransitions[oldStatus] || !validTransitions[oldStatus].includes(newStatus)) {
          const errorPrefix = `Invalid status transition from ${oldStatus} to ${newStatus}`;
          const errorSuffix = correlationId ? ` (Trace ID: ${correlationId})` : '';
          throw new Error(`${errorPrefix}${errorSuffix}`);
      }
  }
}

module.exports = new TaskService();
