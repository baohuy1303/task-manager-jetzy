const organizationRepository = require('../repositories/organizationRepository');

class OrganizationService {
  async createOrganization(name) {
    if (!name) throw new Error('Organization name is required');
    return await organizationRepository.create(name);
  }

  async getOrganizationById(id) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new Error('Organization not found');
    return org;
  }

  async suspendOrganization(id) {
    const org = await this.getOrganizationById(id);
    return await organizationRepository.updateStatus(id, 'suspended');
  }

  async activateOrganization(id) {
    const org = await this.getOrganizationById(id);
    return await organizationRepository.updateStatus(id, 'active');
  }
}

module.exports = new OrganizationService();
