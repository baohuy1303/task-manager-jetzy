const projectService = require('../services/projectService');

class ProjectController {
  async create(req, res, next) {
    try {
      const { name, description, status } = req.body;
      const project = await projectService.createProject(req.user, { name, description, status });
      res.status(201).json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }

  async getProjects(req, res, next) {
    try {
      const { status, search, created_by, created_after, created_before, limit, cursor, user_id } = req.query;
      const filters = { status, search, created_by, created_after, created_before, limit, cursor, user_id };
      
      const response = await projectService.getProjectsByOrganization(req.user, filters);
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const project = await projectService.getProjectById(req.user, req.params.id);
      res.json({ success: true, data: project });
    } catch (error) {
       if (error.message === 'Project not found') return res.status(404).json({success: false, error: 'Project not found'});
       if (error.message === 'Access denied') return res.status(403).json({success: false, error: 'Access denied'});
      next(error);
    }
  }

    async update(req, res, next) {
    try {
      const project = await projectService.updateProject(req.user, req.params.id, req.body);
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProjectController();
