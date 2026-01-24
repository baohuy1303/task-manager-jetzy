const { query } = require('../../config/db');

class ProjectRepository {
  async create({ organization_id, name, description, status, created_by }) {
    const text = `
      INSERT INTO projects (organization_id, name, description, status, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [organization_id, name, description, status || 'draft', created_by];
    const { rows } = await query(text, values);
    return rows[0];
  }

  async findById(id) {
    const text = 'SELECT * FROM projects WHERE id = $1';
    const { rows } = await query(text, [id]);
    return rows[0];
  }

  async findByOrganization(organization_id, limit = 20, offset = 0) {
    const text = 'SELECT * FROM projects WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    const { rows } = await query(text, [organization_id, limit, offset]);
    return rows;
  }

  async update(id, { name, description, status }) {
    const text = `
      UPDATE projects 
      SET name = COALESCE($2, name), 
          description = COALESCE($3, description), 
          status = COALESCE($4, status)
      WHERE id = $1
      RETURNING *
    `;
    const values = [id, name, description, status];
    const { rows } = await query(text, values);
    return rows[0];
  }
}

module.exports = new ProjectRepository();
