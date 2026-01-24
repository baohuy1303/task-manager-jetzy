const { pool } = require('../../config/db');
const organizationService = require('../services/organizationService');
const userService = require('../services/userService');
const projectService = require('../services/projectService');

const seed = async () => {
  try {
    console.log('Seeding Database...');

    // 1. Create Organization
    console.log('Creating Organization...');
    const org = await organizationService.createOrganization('Jetzy');
    console.log('Organization created:', org.id);

    // 2. Create Admin User
    console.log('Creating Admin User...');
    const admin = await userService.createUser({
      organization_id: org.id,
      name: 'Admin User',
      email: 'admin@jetzy.com',
      password: 'password123',
      role: 'admin'
    });
    console.log('Admin created:', admin.id);

    // 3. Create Project
    console.log('Creating Project...');
    // Mock user object for context
    const userContext = { id: admin.id, role: admin.role, organization_id: org.id };
    const project = await projectService.createProject(userContext, {
      name: 'Project 1',
      description: 'The first project',
      status: 'active'
    });
    console.log('Project created:', project.id);

    console.log('Seeding Complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
