const organizationService = require('../services/organizationService');

class OrganizationController {
  async create(req, res, next) {
    try {
      const { name } = req.body;
      const org = await organizationService.createOrganization(name);
      res.status(201).json({ success: true, data: org });
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
      const org = await organizationService.getOrganizationById(id);
      res.json({ success: true, data: org });
    } catch (error) {
      if (error.message === 'Organization not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      next(error);
    }
  }

  async suspend(req, res, next) {
    try {
      const { id } = req.params;
      const org = await organizationService.suspendOrganization(id);
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
      const org = await organizationService.activateOrganization(id);
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
