const organizationService = require('../services/organizationService');

class OrganizationController {
  async create(req, res, next) {
    try {
      const { name } = req.body;
      const result = await organizationService.createOrganization(req.user, name);
      res.status(201).json({ success: true, data: result.org, linked_user: result.user });
    } catch (error) {
      if (error.message === 'Organization name is required') {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const org = await organizationService.getOrganizationById(req.user, id);
      res.json({ success: true, data: org });
    } catch (error) {
       if (error.message === 'Access denied') return res.status(403).json({ success: false, error: error.message });
      if (error.message === 'Organization not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async suspend(req, res, next) {
    try {
      const { id } = req.params;
      const org = await organizationService.suspendOrganization(req.user, id, req.correlationId);
      res.json({ success: true, message: 'Organization suspended', data: org });
    } catch (error) {
        if (error.message === 'Organization not found') {
            return res.status(404).json({ success: false, error: error.message });
          }
      next(error);
    }
  }

  async activate(req, res, next) {
    try {
      const { id } = req.params;
      const org = await organizationService.activateOrganization(req.user, id, req.correlationId);
      res.json({ success: true, message: 'Organization activated', data: org });
    } catch (error) {
        if (error.message === 'Organization not found') {
            return res.status(404).json({ success: false, error: error.message });
          }
      next(error);
    }
  }
}

module.exports = new OrganizationController();
