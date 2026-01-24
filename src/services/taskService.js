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

  async getTasksByProject(user, project_id) {
     const project = await projectRepository.findById(project_id);
     if (!project || project.organization_id !== user.organization_id) throw new Error('Access denied');
     
     // Member Restriction: Can only read tasks assigned to them
     if (user.role === 'member') {
        const tasks = await taskRepository.findByProject(project_id);
        return tasks.filter(task => task.assigned_to === user.id && !task.is_deleted);
     }

     return await taskRepository.findByProject(project_id);
  }

  async updateTaskStatus(user, id, newStatus) {
    const task = await taskRepository.findById(id);
    if (!task) throw new Error('Task not found');
    
    // Check Org access (indirectly via project)
    const project = await projectRepository.findById(task.project_id);
    if (project.organization_id !== user.organization_id) throw new Error('Access denied');

    // Member Restriction: Can only update if assigned to them
    if (user.role === 'member' && task.assigned_to !== user.id) {
        throw new Error('Access denied: Members can only update their own tasks');
    }

    // Workflow Logic
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
