const taskRepository = require('../repositories/taskRepository');
const taskWorkflowRepository = require('../repositories/taskWorkflowRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const projectRepository = require('../repositories/projectRepository');

class TaskService {
  async createTask(user, { project_id, title, description, priority, assigned_to, due_date }) {
    // Verify project access
    const project = await projectRepository.findById(project_id);
    if (!project) throw new Error('Project not found');
    if (project.organization_id !== user.organization_id) throw new Error('Access denied');
    if (project.status === 'archived') throw new Error('Cannot create tasks in an archived project');
    if (assigned_to) {
      const assignedUser = await userRepository.findById(assigned_to);
      if (!assignedUser) throw new Error('User not found');
      if (assignedUser.organization_id !== user.organization_id) throw new Error('Access denied');
    }

    const task = await taskRepository.create({
      project_id,
      title,
      description,
      priority,
      assigned_to,
      due_date
    });

    await auditLogRepository.create({
      organization_id: user.organization_id,
      entity_type: 'task',
      entity_id: task.id,
      action: 'create',
      performed_by: user.id,
      metadata: { title }
    });

    return task;
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
         
         // Member-specific check: They must be assigned to the project they are querying
         if (user.role === 'member' && user.project_id !== filters.project_id) {
             throw new Error('Access denied: You are not assigned to this project');
         }
     }

     // - Can only see assigned to them
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
  async updateTask(user, id, updates) {
      const task = await taskRepository.findById(id);
      if (!task) throw new Error('Task not found');

      const project = await projectRepository.findById(task.project_id);
      if (project.organization_id !== user.organization_id) throw new Error('Access denied');
      if (project.status === 'archived') throw new Error('Cannot update tasks in an archived project');

      const updatedTask = await taskRepository.update(id, updates);

      // Audit Log
      await auditLogRepository.create({
        organization_id: user.organization_id,
        entity_type: 'task',
        entity_id: task.id,
        action: 'update',
        performed_by: user.id,
        metadata: updates
      });

      return updatedTask;
  }

  async updateTaskStatus(user, id, newStatus) {
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

    const updatedTask = await taskRepository.updateStatus(id, newStatus);


    // Record History
    await taskWorkflowRepository.create({
        task_id: id,
        from_status: oldStatus,
        to_status: newStatus,
        changed_by: user.id
    });

    // Audit Log
    await auditLogRepository.create({
      organization_id: user.organization_id,
      entity_type: 'task',
      entity_id: task.id,
      action: 'update_status',
      performed_by: user.id,
      metadata: { from: oldStatus, to: newStatus }
    });

    return updatedTask;
  }

  async deleteTask(user, id) {
    const task = await taskRepository.findById(id);
    if (!task) throw new Error('Task not found');

    const project = await projectRepository.findById(task.project_id);
    if (project.organization_id !== user.organization_id) throw new Error('Access denied');
    if (project.status === 'archived') throw new Error('Cannot delete tasks in an archived project');

    await taskRepository.softDelete(id);

    // Audit Log
    await auditLogRepository.create({
        organization_id: user.organization_id,
        entity_type: 'task',
        entity_id: task.id,
        action: 'delete',
        performed_by: user.id,
        metadata: { title: task.title }
    });
  }
}

module.exports = new TaskService();
