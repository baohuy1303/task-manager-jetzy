const Joi = require('joi');

const authSchema = {
  register: Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    organization_name: Joi.string().min(3).required(),
    // role and organization_id are NOT accepted
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
};

const orgSchema = {
  create: Joi.object({
    name: Joi.string().min(3).required(),
  }),
};

const userSchema = {
  create: Joi.object({
    organization_id: Joi.string().uuid().required(), // Now required - admin only route
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('admin', 'manager', 'member').required(),
  }),
  update: Joi.object({
      name: Joi.string().min(2).optional(),
      email: Joi.string().email().optional(),
      password: Joi.string().min(6).optional(),
      role: Joi.string().valid('admin', 'manager', 'member').optional(),
  }),
};

const projectSchema = {
  create: Joi.object({
    name: Joi.string().min(3).required(),
    description: Joi.string().optional(),
    status: Joi.string().valid('draft', 'active', 'archived').default('draft'),
  }),
  update: Joi.object({
      name: Joi.string().min(3).optional(),
      description: Joi.string().optional(),
      status: Joi.string().valid('draft', 'active', 'archived').optional(),
  }),
};

const taskSchema = {
  create: Joi.object({
    project_id: Joi.string().uuid().required(),
    title: Joi.string().required(),
    description: Joi.string().optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
    assigned_to: Joi.string().uuid().optional(),
    due_date: Joi.date().iso().optional(),
  }),
  updateStatus: Joi.object({
      status: Joi.string().valid('todo', 'in_progress', 'review', 'done').required(),
      version: Joi.number().required()
  }),
  update: Joi.object({
      title: Joi.string().optional(),
      description: Joi.string().optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      due_date: Joi.date().iso().optional(),
      assigned_to: Joi.string().uuid().optional(),
      version: Joi.number().required(),
      status: Joi.string().valid('todo', 'in_progress', 'review', 'done').optional(),
  }),
};

module.exports = {
  authSchema,
  orgSchema,
  userSchema,
  projectSchema,
  taskSchema,
};
