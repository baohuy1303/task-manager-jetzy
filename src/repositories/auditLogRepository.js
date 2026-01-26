const { query } = require('../../config/db');

class AuditLogRepository {
  async create({ organization_id, entity_type, entity_id, action, performed_by, metadata }, client) {
    const text = `
      INSERT INTO audit_logs (organization_id, entity_type, entity_id, action, performed_by, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [organization_id, entity_type, entity_id, action, performed_by, metadata];
    const { rows } = await (client ? client.query(text, values) : query(text, values));
    return rows[0];
  }

  async findByOrganization(organization_id, filters = {}) {
    let text = 'SELECT * FROM audit_logs WHERE organization_id = $1';
    const values = [organization_id];
    let paramIndex = 2;

    // Entity Type Filter
    if (filters.entity_type) {
      text += ` AND entity_type = $${paramIndex++}`;
      values.push(filters.entity_type);
    }

    // Entity ID Filter
    if (filters.entity_id) {
      text += ` AND entity_id = $${paramIndex++}`;
      values.push(filters.entity_id);
    }

    // Action Filter
    if (filters.action) {
      text += ` AND action = $${paramIndex++}`;
      values.push(filters.action);
    }

    // Performed By Filter
    if (filters.performed_by) {
      text += ` AND performed_by = $${paramIndex++}`;
      values.push(filters.performed_by);
    }

    // Correlation ID Filter (JSONB query)
    if (filters.correlation_id) {
      text += ` AND metadata->>'request_id' = $${paramIndex++}`;
      values.push(filters.correlation_id);
    }

    // Date Range Filters
    if (filters.start_date) {
      text += ` AND created_at >= $${paramIndex++}`;
      values.push(filters.start_date);
    }
    if (filters.end_date) {
      text += ` AND created_at <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    // Cursor Pagination
    if (filters.cursor) {
      text += ` AND (date_trunc('milliseconds', created_at), id) < ($${paramIndex++}, $${paramIndex++})`;
      values.push(filters.cursor.created_at, filters.cursor.id);
    }

    text += " ORDER BY date_trunc('milliseconds', created_at) DESC, id DESC";

    // Limit
    const limit = Math.min(filters.limit || 50, 100);
    text += ` LIMIT $${paramIndex++}`;
    values.push(limit + 1); // Fetch one extra to check if there's more

    const { rows } = await query(text, values);
    return rows;
  }
}

module.exports = new AuditLogRepository();
