const projectRepository = require('../repositories/projectRepository');
const taskRepository = require('../repositories/taskRepository');
const auditLogRepository = require('../repositories/auditLogRepository');

class ProjectService {
  async createProject(user, { name, description, status }) {
    if (!user.organization_id) throw new Error('User must be part of an organization to create projects');
    
    // 1. Create Project
    const project = await projectRepository.create({
      organization_id: user.organization_id,
      name,
      description,
      status: status || 'draft',
      created_by: user.id
    });

    // 2. Audit Log
    await auditLogRepository.create({
      organization_id: user.organization_id,
      entity_type: 'project',
      entity_id: project.id,
      action: 'create',
      performed_by: user.id,
      metadata: { name }
    });

    return project;
  }

  async getProjectsByOrganization(user) {
    if (!user.organization_id) return [];

    // Admin/Manager: See all in Org
    if (user.role === 'admin' || user.role === 'manager') {
        return await projectRepository.findByOrganization(user.organization_id);
    }

    // Member: Simplified Scope - Only see assigned project
    if (user.role === 'member') {
        if (!user.project_id) return []; // Access to nothing
        const project = await projectRepository.findById(user.project_id);
        
        if (project && project.organization_id === user.organization_id) {
            return [project];
        }
        return [];
    }
    return [];
  }

  async getProjectById(user, id) {
    const project = await projectRepository.findById(id);
    if (!project) return null;

    if (project.organization_id !== user.organization_id) throw new Error('Access denied');

    // Scoping check for member
    if (user.role === 'member') {
        if (user.project_id !== id) {
            throw new Error('Access denied: You are not assigned to this project');
        }
    }

    return project;
  }

  async updateProject(user, id, updates) {
    const project = await projectRepository.findById(id);
    if (!project) throw new Error('Project not found');

    if (project.organization_id !== user.organization_id) throw new Error('Access denied');

    // Audit Log before update
    await auditLogRepository.create({
      organization_id: user.organization_id,
      entity_type: 'project',
      entity_id: id,
      action: 'update',
      performed_by: user.id,
      metadata: updates
    });

    return await projectRepository.update(id, updates);
  }
}

module.exports = new ProjectService();
