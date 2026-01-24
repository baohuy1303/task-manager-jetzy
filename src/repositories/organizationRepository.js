const { query } = require('../../config/db');

class OrganizationRepository {
  async create(name) {
    const text = 'INSERT INTO organizations (name) VALUES ($1) RETURNING *';
    const { rows } = await query(text, [name]);
    return rows[0];
  }

  async findById(id) {
    const text = 'SELECT * FROM organizations WHERE id = $1';
    const { rows } = await query(text, [id]);
    return rows[0];
  }

  async updateStatus(id, status) {
    const text = 'UPDATE organizations SET status = $1 WHERE id = $2 RETURNING *';
    const { rows } = await query(text, [status, id]);
    return rows[0];
  }
}

module.exports = new OrganizationRepository();
