const userService = require('../services/userService');

class UserController {
  async create(req, res, next) {
    try {
      const { organization_id, name, email, password, role } = req.body;
      // TODO: Add Joi validation here
      const user = await userService.createUser({ organization_id, name, email, password, role });
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      if (error.message === 'Email already exists in this organization') {
        return res.status(409).json({ success: false, error: error.message });
      }
      if (error.message === 'Organization not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
  
  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const user = await userService.updateUser(req.user, id, updates);
      res.json({ success: true, data: user });
    } catch (error) {
       if (error.message.startsWith('Access denied')) {
        return res.status(403).json({ success: false, error: error.message });
      }
      if (error.message === 'User not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);
      
      // Privacy Masking (Consistent with getAll)
      if (req.user.role === 'member' && user.id !== req.user.id) {
          user.project_id = undefined;
      }

      res.json({ success: true, data: user });
    } catch (error) {
       if (error.message === 'User not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async updateOrganization(req, res, next) {
    try {
      const { id } = req.params;
      const { organization_id } = req.body;
      const updated = await userService.updateUserOrganization(id, organization_id);
      res.json({ success: true, data: updated });
    } catch (error) {
      if (error.message === 'Organization ID required') {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.message === 'Organization not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async deactivate(req, res, next) {
    try {
      const { id } = req.params;
      const result = await userService.deactivateUser(req.user, id);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error.message.startsWith('Access denied')) {
        return res.status(403).json({ success: false, error: error.message });
      }
       if (error.message === 'User not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async activate(req, res, next) {
    try {
      const { id } = req.params;
      const result = await userService.reactivateUser(req.user, id);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error.message.startsWith('Access denied')) {
        return res.status(403).json({ success: false, error: error.message });
      }
       if (error.message === 'User not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async assignProject(req, res, next) {
    try {
      const { id } = req.params;
      const { project_id, action } = req.body;
      const updated = await userService.assignProject(req.user, id, project_id, action);
      res.json({ success: true, data: updated });
    } catch (error) {
      if (error.message === 'Project not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message.startsWith('Access denied')) {
        return res.status(403).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
  async getAll(req, res, next) {
    try {
      const { role, is_active, project_id, search, limit, cursor } = req.query;
      const filters = { role, is_active, project_id, search, limit, cursor };

      const response = await userService.getUsersByOrganization(req.user, filters);
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
