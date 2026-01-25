const { query } = require('../../config/db');

class OrganizationRepository {
  async create(name, created_by) {
    const text = 'INSERT INTO organizations (name, created_by) VALUES ($1, $2) RETURNING *';
    const values = [name, created_by];
    const { rows } = await query(text, values);
    return rows[0];
  }

  async findByNameAndCreator(name, created_by) {
    const text = 'SELECT * FROM organizations WHERE name = $1 AND created_by = $2';
    const { rows } = await query(text, [name, created_by]);
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
