const taskWorkflowService = require('../services/taskWorkflowService');

class TaskWorkflowController {
  async getTaskHistory(req, res, next) {
    try {
      const { taskId } = req.params;
      const filters = req.query;
      const history = await taskWorkflowService.getTaskHistory(req.user, taskId, filters);
      res.json(history);
    } catch (error) {
      if (error.message === 'Task not found') return res.status(404).json({ success: false, error: error.message });
      if (error.message.startsWith('Access denied')) return res.status(403).json({ success: false, error: error.message });
      next(error);
    }
  }

  async getAllHistory(req, res, next) {
    try {
      const filters = req.query;
      const history = await taskWorkflowService.getAllHistory(req.user, filters);
      res.json(history);
    } catch (error) {
      if (error.message.startsWith('Access denied')) return res.status(403).json({ success: false, error: error.message });
      next(error);
    }
  }
}

module.exports = new TaskWorkflowController();
