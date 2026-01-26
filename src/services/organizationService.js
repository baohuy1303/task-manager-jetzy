const organizationRepository = require('../repositories/organizationRepository');

class OrganizationService {
  async createOrganization(user, name) {
    // Organizations can only be created during registration
    // Model: 1 admin = 1 organization
    /*
    if (!name) throw new Error('Organization name is required');
    
    // Check for duplicates by this user
    if (user && user.id) {
        const existingInfo = await organizationRepository.findByNameAndCreator(name, user.id);
        if (existingInfo) {
            throw new Error('You have already created an organization with this name');
        }
    }

    const org = await organizationRepository.create(name, user ? user.id : null);
    
    // Auto-link the creator to this organization
    let updatedUser = null;
    if (user && user.id) {
        const userRepository = require('../repositories/userRepository');
        updatedUser = await userRepository.updateOrganization(user.id, org.id);
    }
    
    return { org, user: updatedUser };
    */
    throw new Error('Organizations must be created during registration. Please use POST /auth/register with organization_name.');
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
    if (!org) throw new Error('Organization not found');
    if (user.role !== 'admin' || user.organization_id !== id) throw new Error('Access denied');

    const auditLogRepository = require('../repositories/auditLogRepository');
    const { runTransaction } = require('../../config/db');

    return await runTransaction(async (client) => {
      const result = await organizationRepository.updateStatus(id, 'suspended', client);
      
      await auditLogRepository.create({
        organization_id: id,
        entity_type: 'organization',
        entity_id: id,
        action: 'org_suspended',
        performed_by: user.id,
        metadata: { previous_status: org.status }
      }, client);

      return result;
    });
  }

  async activateOrganization(user, id) {
    const org = await this.getOrganizationById(user, id);
    if (!org) throw new Error('Organization not found');
    if (user.role !== 'admin' && user.organization_id !== id) throw new Error('Access denied');

    const auditLogRepository = require('../repositories/auditLogRepository');
    const { runTransaction } = require('../../config/db');

    return await runTransaction(async (client) => {
      const result = await organizationRepository.updateStatus(id, 'active', client);
      
      await auditLogRepository.create({
        organization_id: id,
        entity_type: 'organization',
        entity_id: id,
        action: 'org_activated',
        performed_by: user.id,
        metadata: { previous_status: org.status }
      }, client);

      return result;
    });
  }
}

module.exports = new OrganizationService();
