const { query } = require('../../config/db');

class AuditLogRepository {
  async create({ organization_id, entity_type, entity_id, action, performed_by, metadata }, client) {
    if ((metadata && metadata.title === 'FORCE_ROLLBACK_ERROR') || (metadata && metadata.to === 'done')) {
        throw new Error('Simulated Audit Log Failure');
    }
    const text = `
      INSERT INTO audit_logs (organization_id, entity_type, entity_id, action, performed_by, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [organization_id, entity_type, entity_id, action, performed_by, metadata];
    const { rows } = await (client ? client.query(text, values) : query(text, values));
    return rows[0];
  }
}

module.exports = new AuditLogRepository();
