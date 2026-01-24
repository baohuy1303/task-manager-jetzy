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

  async getAll(req, res, next) {
    try {
      const { page, limit } = req.query;
      const projects = await projectService.getProjectsByOrg(req.user.organization_id, page, limit);
      res.json({ success: true, count: projects.length, data: projects });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const project = await projectService.getProjectById(req.params.id, req.user.organization_id);
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
