const { query } = require('../../config/db');

class TaskRepository {
  async create({ project_id, title, description, status, priority, assigned_to, due_date }) {
    const text = `
      INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [project_id, title, description, status || 'todo', priority || 'medium', assigned_to, due_date];
    const { rows } = await query(text, values);
    return rows[0];
  }

  async findById(id) {
    const text = 'SELECT * FROM tasks WHERE id = $1 AND is_deleted = false';
    const { rows } = await query(text, [id]);
    return rows[0];
  }

  async findByProject(project_id) {
    const text = 'SELECT * FROM tasks WHERE project_id = $1 AND is_deleted = false ORDER BY created_at DESC';
    const { rows } = await query(text, [project_id]);
    return rows;
  }

  async updateStatus(id, status) {
    const text = 'UPDATE tasks SET status = $1 WHERE id = $2 AND is_deleted = false RETURNING *';
    const { rows } = await query(text, [status, id]);
    return rows[0];
  }

  async softDelete(id) {
    const text = 'UPDATE tasks SET is_deleted = true WHERE id = $1 RETURNING *';
    const { rows } = await query(text, [id]);
    return rows[0];
  }

  async update(id, updates) {
       return this.findById(id); 
  }
}

module.exports = new TaskRepository();
