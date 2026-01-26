const { query } = require('../../config/db');

class UserRepository {
  async create({ organization_id, name, email, password_hash, role }) {
    const text = `
      INSERT INTO users (organization_id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, organization_id, name, email, role, is_active, created_at
    `;
    const values = [organization_id, name, email, password_hash, role];
    const { rows } = await query(text, values);
    return rows[0];
  }

  async update(id, updates, client) {
    const keys = Object.keys(updates);
    if (keys.length === 0) return this.findById(id);

    const allowedUpdates = keys.filter(key => !['id', 'organization_id', 'created_at'].includes(key));
    if (allowedUpdates.length === 0) return this.findById(id);

    const setClause = allowedUpdates.map((key, index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...allowedUpdates.map(key => updates[key])];
    
    const text = `UPDATE users SET ${setClause} WHERE id = $1 RETURNING id, organization_id, name, email, role, is_active, created_at`;
    
    const { rows } = await (client ? client.query(text, values) : query(text, values));
    return rows[0];
  }

  async findByEmail(email) {
    const text = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await query(text, [email]);
    return rows[0];
  }

  async findById(id) {
    const text = 'SELECT id, organization_id, name, email, role, is_active, created_at FROM users WHERE id = $1';
    const { rows } = await query(text, [id]);
    return rows[0];
  }

  async findByOrganization(organization_id, filters = {}) {
     let text = 'SELECT id, organization_id, name, email, role, is_active, created_at FROM users WHERE organization_id = $1';
     const values = [organization_id];
     let paramIndex = 2;

     if (filters.role) {
         text += ` AND role = $${paramIndex++}`;
         values.push(filters.role);
     } else if (filters.roles && filters.roles.length > 0) {
         const placeholders = filters.roles.map((_, i) => `$${paramIndex + i}`).join(', ');
         text += ` AND role IN (${placeholders})`;
         filters.roles.forEach(r => values.push(r));
         paramIndex += filters.roles.length;
     }

     if (filters.is_active !== undefined) {
         text += ` AND is_active = $${paramIndex++}`;
         values.push(filters.is_active);
     } else {
         text += ` AND is_active = true`;
     }

     if (filters.search) {
         text += ` AND name ILIKE $${paramIndex++}`;
         values.push(`%${filters.search}%`);
     }

     if (filters.email) {
         text += ` AND email = $${paramIndex++}`;
         values.push(filters.email);
     }

     // CURSOR CLAUSE
     if (filters.cursor) {
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

  async updateOrganization(id, organization_id, client) {
    const text = 'UPDATE users SET organization_id = $2 WHERE id = $1 RETURNING id, organization_id, name, email, role, is_active, created_at';
    const { rows } = await (client ? client.query(text, [id, organization_id]) : query(text, [id, organization_id]));
    return rows[0];
  }

  async updateProject(id, project_id, client) {
    const text = 'UPDATE users SET project_id = $2 WHERE id = $1 RETURNING id, organization_id, name, email, role, is_active, created_at';
    const { rows } = await (client ? client.query(text, [id, project_id]) : query(text, [id, project_id]));
    return rows[0];
  }

  async deactivate(id, client) {
    const text = 'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, organization_id, name, email, role, is_active, created_at';
    const { rows } = await (client ? client.query(text, [id]) : query(text, [id]));
    return rows[0];
  }

  async activate(id, client) {
    const text = 'UPDATE users SET is_active = true WHERE id = $1 RETURNING id, organization_id, name, email, role, is_active, created_at';
    const { rows } = await (client ? client.query(text, [id]) : query(text, [id]));
    return rows[0];
  }

  async findAdminsByOrganization(organization_id) {
      const text = `SELECT * FROM users WHERE organization_id = $1 AND role = 'admin' AND is_active = true`;
      const { rows } = await query(text, [organization_id]);
      return rows;
  }
}

module.exports = new UserRepository();
