const taskService = require('../services/taskService');

class TaskController {
  async create(req, res, next) {
    try {
      const task = await taskService.createTask(req.user, req.body);
      res.status(201).json({ success: true, data: task });
    } catch (error) {
      if (error.message === 'Project not found') return res.status(404).json({ success: false, error: 'Project not found' });
      next(error);
    }
  }

  async getByProject(req, res, next) {
    try {
      const { project_id } = req.query; // ?project_id=...
      if (!project_id) return res.status(400).json({ success: false, error: 'project_id is required' });
      
      const tasks = await taskService.getTasksByProject(req.user, project_id);
      res.json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const task = await taskService.updateTaskStatus(req.user, id, status);
      res.json({ success: true, data: task });
    } catch (error) {
        if (error.message.startsWith('Invalid status transition')) {
            return res.status(400).json({ success: false, error: error.message });
        }
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await taskService.deleteTask(req.user, id);
      res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
      if (error.message === 'Task not found') {
          return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
}

module.exports = new TaskController();
