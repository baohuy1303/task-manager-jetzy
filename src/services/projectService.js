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

  async getProjectsByOrganization(user, filters = {}) {
    if (!user.organization_id) return { success: true, count: 0, data: [], meta: { has_more: false } };

    const { decodeCursor, buildPaginationResponse } = require('../utils/pagination');
    const limit = parseInt(filters.limit) || 20; // Default lower for projects
    const cursor = decodeCursor(filters.cursor);

    // Admin/Manager: See all in Org with filters + pagination
    if (user.role === 'admin' || user.role === 'manager') {
        const projects = await projectRepository.findByOrganization(user.organization_id, { 
            ...filters, 
            limit, 
            cursor 
        });
        
        return buildPaginationResponse(projects, limit, (item) => ({
            sortValue: item.created_at,
            id: item.id
        }));
    }

    // Member: Simplified Scope - Only see assigned project
    // Pagination technically irrelevant here (1 item), but we should respect format
    if (user.role === 'member') {
        if (!user.project_id) return []; // Access to nothing
        const project = await projectRepository.findById(user.project_id);
        
        if (project && project.organization_id === user.organization_id) {
            return [project];
        }
        return [];
    }
    return buildPaginationResponse([], limit, () => {});
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

    if (project.status === 'archived' && updates.status !== 'active') {
        throw new Error('Cannot modify an archived project');
    }

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
