const organizationRepository = require('../repositories/organizationRepository');

class OrganizationService {
  async createOrganization(name) {
    if (!name) throw new Error('Organization name is required');
    return await organizationRepository.create(name);
  }

  async getOrganizationById(user, id) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new Error('Organization not found');

    // Scoping check
    // If not admin, must match org id
    if (user.role !== 'admin' && user.organization_id !== id) {
        throw new Error('Access denied');
    }
    // Deep Admin restriction (per strict "scoped under org" rule)
    if (user.role === 'admin' && user.organization_id && user.organization_id !== id) {
        throw new Error('Access denied');
    }

    return org;
  }

  async suspendOrganization(user, id) {
    const org = await this.getOrganizationById(user, id);
    return await organizationRepository.updateStatus(id, 'suspended');
  }

  async activateOrganization(user, id) {
    const org = await this.getOrganizationById(user, id);
    return await organizationRepository.updateStatus(id, 'active');
  }
}

module.exports = new OrganizationService();
