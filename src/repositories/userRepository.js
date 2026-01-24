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

  async findByOrganization(organization_id) {
     const text = 'SELECT id, organization_id, name, email, role, is_active, created_at FROM users WHERE organization_id = $1';
     const { rows } = await query(text, [organization_id]);
     return rows;
  }
}

module.exports = new UserRepository();
