const { query } = require('../../config/db');

class ProjectRepository {
  async create({ organization_id, name, description, status, created_by }, client) {
    const text = `
      INSERT INTO projects (organization_id, name, description, status, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [organization_id, name, description, status || 'draft', created_by];
    const { rows } = await (client ? client.query(text, values) : query(text, values));
    return rows[0];
  }

  async findByNameAndCreator(name, created_by) {
    const text = 'SELECT * FROM projects WHERE name = $1 AND created_by = $2';
    const { rows } = await query(text, [name, created_by]);
    return rows[0];
  }

  async findById(id) {
    const text = 'SELECT * FROM projects WHERE id = $1';
    const { rows } = await query(text, [id]);
    return rows[0];
  }

  async findByOrganization(organization_id, filters = {}) {
    let text = 'SELECT * FROM projects WHERE organization_id = $1';
    const values = [organization_id];
    let paramIndex = 2;

    if (filters.status) {
        text += ` AND status = $${paramIndex++}`;
        values.push(filters.status);
    }

    if (filters.search) {
        text += ` AND name ILIKE $${paramIndex++}`;
        values.push(`%${filters.search}%`);
    }

    if (filters.created_by) {
        text += ` AND created_by = $${paramIndex++}`;
        values.push(filters.created_by);
    }
    
    if (filters.created_after) {
        text += ` AND created_at >= $${paramIndex++}`;
        values.push(filters.created_after);
    }

    if (filters.created_before) {
        text += ` AND created_at <= $${paramIndex++}`;
        values.push(filters.created_before);
    }

    // CURSOR CLAUSE
    if (filters.cursor) {
        // cursor = { sortValue: dateString, id: uuid }
        text += ` AND (date_trunc('milliseconds', created_at), id) < ($${paramIndex++}, $${paramIndex++})`;
        values.push(filters.cursor.sortValue, filters.cursor.id);
    }

    text += ' ORDER BY created_at DESC, id DESC';

    // LIMIT
    const limit = filters.limit || 50;
    text += ` LIMIT $${paramIndex++}`;
    values.push(limit + 1);

    const { rows } = await query(text, values);
    return rows;
  }

  async update(id, { name, description, status }, client) {
    const text = `
      UPDATE projects 
      SET name = COALESCE($2, name), 
          description = COALESCE($3, description), 
          status = COALESCE($4, status)
      WHERE id = $1
      RETURNING *
    `;
    const values = [id, name, description, status];
    const { rows } = await (client ? client.query(text, values) : query(text, values));
    return rows[0];
  }
}

module.exports = new ProjectRepository();
