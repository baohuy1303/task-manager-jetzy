const taskRepository = require('../repositories/taskRepository');
const taskWorkflowRepository = require('../repositories/taskWorkflowRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const projectRepository = require('../repositories/projectRepository');
const projectMemberRepository = require('../repositories/projectMemberRepository');
const userRepository = require('../repositories/userRepository');
const { runTransaction } = require('../../config/db');

class TaskService {
  async createTask(user, { project_id, title, description, priority, assigned_to, due_date }) {
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

    return await runTransaction(async (client) => {
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
          metadata: { title }
        }, client);

        return task;
    });
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
  async updateTask(user, id, updates, expectedVersion) {
      const task = await taskRepository.findById(id);
      const oldStatus = task.status;
      if (!task) throw new Error('Task not found');

      const project = await projectRepository.findById(task.project_id);
      if (project.organization_id !== user.organization_id) throw new Error('Access denied');
      if (project.status === 'archived') throw new Error('Cannot update tasks in an archived project');

      return await runTransaction(async (client) => {
          const updatedTask = await taskRepository.update(id, updates, expectedVersion, client);
          
          if (!updatedTask && expectedVersion !== undefined) {
              // Check if failure was due to version mismatch or just not found (already handled)
              throw new Error('Conflict: Task has been modified by another user');
          }

          if (updates.status) {
            await taskWorkflowRepository.create({
            task_id: id,
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
            metadata: updates
          }, client);

          return updatedTask;
      });
  }

  async updateTaskStatus(user, id, newStatus, expectedVersion) {
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

    // Validate Transitions
    const validTransitions = {
        'todo': ['in_progress'],
        'in_progress': ['review', 'todo'],
        'review': ['done', 'in_progress'],
        'done': ['review', 'in_progress']
    };

    if (!validTransitions[oldStatus].includes(newStatus)) {
        throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
    }

    return await runTransaction(async (client) => {
        const updatedTask = await taskRepository.updateStatus(id, newStatus, expectedVersion, client);

        if (!updatedTask && expectedVersion !== undefined) {
             throw new Error('Conflict: Task has been modified by another user');
        }

        // Record History
        await taskWorkflowRepository.create({
            task_id: id,
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
          metadata: { from: oldStatus, to: newStatus }
        }, client);

        return updatedTask;
    });
  }

  async deleteTask(user, id) {
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
            metadata: { title: task.title }
        }, client);
    });
  }
}

module.exports = new TaskService();
