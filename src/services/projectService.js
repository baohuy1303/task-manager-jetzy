const projectRepository = require('../repositories/projectRepository');
const taskRepository = require('../repositories/taskRepository');
const auditLogRepository = require('../repositories/auditLogRepository');
const projectMemberRepository = require('../repositories/projectMemberRepository');
const { runTransaction } = require('../../config/db');

class ProjectService {
  async createProject(user, { name, description, status }, correlationId) {
    if (!user.organization_id) throw new Error('User must be part of an organization to create projects');
    
    // 1. Check for duplicates
    const existingProject = await projectRepository.findByNameAndCreator(name, user.id);
    if (existingProject) {
        throw new Error('You have already created a project with this name');
    }

    // 2. Create Project (Transactional Audit)
    return await runTransaction(async (client) => {
        const project = await projectRepository.create({
          organization_id: user.organization_id,
          name,
          description,
          status: status || 'draft',
          created_by: user.id
        }, client);

        await auditLogRepository.create({
          organization_id: user.organization_id,
          entity_type: 'project',
          entity_id: project.id,
          action: 'create',
          performed_by: user.id,
          metadata: { 
            name,
            request_id: correlationId
          }
        }, client);

        return project;
    });

    
  }

  async getProjectsByOrganization(user, filters = {}) {
    if (!user.organization_id) return { success: true, count: 0, data: [], meta: { has_more: false } };
    if (user.role === 'member') {
        return await projectMemberRepository.findProjectsByUser(user.id);
    }

    const { decodeCursor, buildPaginationResponse } = require('../utils/pagination');
    const limit = parseInt(filters.limit) || 20; // Default lower for projects
    const cursor = decodeCursor(filters.cursor);

    // Admin/Manager: See all in Org with filters + pagination
    if (user.role === 'admin' || user.role === 'manager') {
        let projects;
        if (filters.user_id) {
             const projectMemberRepository = require('../repositories/projectMemberRepository');
             const memberProjects = await projectMemberRepository.findProjectsByUser(filters.user_id);
             projects = memberProjects; 
        } else {
            projects = await projectRepository.findByOrganization(user.organization_id, { 
                ...filters, 
                limit, 
                cursor 
    });
    }

        return buildPaginationResponse(projects, limit, (item) => ({
            sortValue: item.created_at, 
            id: item.id
        }));
    }
    return buildPaginationResponse([], limit, () => {});
  }

  async getProjectById(user, id) {
    const project = await projectRepository.findById(id);
    if (!project) return null;

    if (project.organization_id !== user.organization_id) throw new Error('Access denied');

    // Scoping check for member
    if (user.role === 'member') {
        const isMember = await projectMemberRepository.isMember(id, user.id);
        if (!isMember) {
            throw new Error('Access denied: You are not assigned to this project');
        }
    }

    return project;
  }

  async updateProject(user, id, updates, correlationId) {
    const project = await projectRepository.findById(id);
    if (!project) throw new Error('Project not found');
    if (updates.name) {
        const existingProject = await projectRepository.findByNameAndCreator(updates.name, user.id);
        if (existingProject && existingProject.id !== id) {
            throw new Error('You have already created a project with this name');
        }
    }

    if (project.organization_id !== user.organization_id) throw new Error('Access denied');

    if (project.status === 'archived' && updates.status !== 'active') {
        throw new Error('Cannot modify an archived project');
    }

    // Transactional Update & Audit
    return await runTransaction(async (client) => {
        const updatedProject = await projectRepository.update(id, updates, client);
        
        await auditLogRepository.create({
          organization_id: user.organization_id,
          entity_type: 'project',
          entity_id: id,
          action: 'update',
          performed_by: user.id,
          metadata: Object.assign({}, updates, { request_id: correlationId })
        }, client);

        return updatedProject;
    });
  }
}

module.exports = new ProjectService();
