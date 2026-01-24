const Joi = require('joi');

const authSchema = {
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
    organization_id: Joi.string().uuid().allow(null, '').optional(), // Optional for Admin
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('admin', 'manager', 'member').required(),
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
  }),
};

module.exports = {
  authSchema,
  orgSchema,
  userSchema,
  projectSchema,
  taskSchema,
};
