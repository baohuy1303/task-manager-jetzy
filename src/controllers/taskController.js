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

  async getTaskById(req, res, next) {
    try {
      const { id } = req.params;
      const task = await taskService.getTaskById(req.user, id);
      res.json({ success: true, data: task });
    } catch (error) {
      if (error.message === 'Task not found') return res.status(404).json({ success: false, error: error.message });
      next(error);
    }
  }

  async getTasks(req, res, next) {
    try {
      const { project_id, status, priority, assigned_to, due_before, due_after, limit, cursor } = req.query;
      const filters = { project_id, status, priority, assigned_to, due_before, due_after, limit, cursor };
      
      const response = await taskService.getTasks(req.user, filters);
      res.json(response); // Service now returns formatted { success, meta, data }
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { version, ...updates } = req.body; // Extract version
      const task = await taskService.updateTask(req.user, id, updates, version);
      res.json({ success: true, data: task });
    } catch (error) {
       if (error.message === 'Task not found') return res.status(404).json({ success: false, error: error.message });
       if (error.message.startsWith('Access denied')) return res.status(403).json({ success: false, error: error.message });
       if (error.message.startsWith('Conflict')) return res.status(409).json({ success: false, error: error.message });
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, version } = req.body; // Extract version
      const task = await taskService.updateTaskStatus(req.user, id, status, version);
      res.json({ success: true, data: task });
    } catch (error) {
        if (error.message.startsWith('Invalid status transition')) {
            return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message.startsWith('Conflict')) return res.status(409).json({ success: false, error: error.message });
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
