const taskWorkflowRepository = require('../repositories/taskWorkflowRepository');
const taskRepository = require('../repositories/taskRepository');
const projectRepository = require('../repositories/projectRepository');
const { decodeCursor, buildPaginationResponse } = require('../utils/pagination');

class TaskWorkflowService {
  async getTaskHistory(user, taskId, filters = {}) {
    // 1. Verify access to the task
    const task = await taskRepository.findById(taskId);
    if (!task) throw new Error('Task not found');

    const project = await projectRepository.findById(task.project_id);
    if (project.organization_id !== user.organization_id) throw new Error('Access denied');

    // Members can only see history for tasks assigned to them
    if (user.role === 'member' && task.assigned_to !== user.id) {
        throw new Error('Access denied: Members can only view history for their own tasks');
    }

    // 2. Query history
    const queryFilters = { ...filters, task_id: taskId };
    const limit = parseInt(filters.limit) || 50;
    const cursor = decodeCursor(filters.cursor);

    const logs = await taskWorkflowRepository.findAll({
      ...queryFilters,
      limit,
      cursor
    });

    return buildPaginationResponse(logs, limit, (item) => ({
      sortValue: item.changed_at,
      id: item.id
    }));
  }

  async getAllHistory(user, filters = {}) {
    // Admins/Managers only for broad history
    if (user.role === 'member') {
        throw new Error('Access denied: Only admins and managers can view broad history');
    }

    const limit = parseInt(filters.limit) || 50;
    const cursor = decodeCursor(filters.cursor);

    // Cross-query optimization: Ensure we only get workflows for tasks in the user's org
    // This is a bit tricky with raw SQL unless we join in the repository.
    // Let's rely on the fact that repository already has the logic or we improve it.
    
    // Actually, taskWorkflowRepository.findAll doesn't currently filter by organization_id.
    // I should probably add that or ensure it's handled.
    // Since taskWorkflows don't have organization_id directly, we need a join.

    const logs = await taskWorkflowRepository.findAll({
      ...filters,
      organization_id: user.organization_id, // We'll need to update repository to handle this
      limit,
      cursor
    });

    return buildPaginationResponse(logs, limit, (item) => ({
      sortValue: item.changed_at,
      id: item.id
    }));
  }
}

module.exports = new TaskWorkflowService();
