const { query } = require('../../config/db');

class TaskWorkflowRepository {
  async create({ task_id, project_id, from_status, to_status, changed_by }, client) {
    const text = `
      INSERT INTO task_workflows (task_id, project_id, from_status, to_status, changed_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const { rows } = await (client ? client.query(text, [task_id, project_id, from_status, to_status, changed_by]) : query(text, [task_id, project_id, from_status, to_status, changed_by]));
    return rows[0];
  }
  async findByTaskId(task_id) {
    const text = 'SELECT * FROM task_workflows WHERE task_id = $1 ORDER BY changed_at DESC';
    const { rows } = await query(text, [task_id]);
    return rows;
  }

  async findAll(filters = {}) {
    let text = `
      SELECT tw.*, u.name as changed_by_name 
      FROM task_workflows tw 
      LEFT JOIN users u ON tw.changed_by = u.id
      JOIN projects p ON tw.project_id = p.id
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (filters.organization_id) {
      text += ` AND p.organization_id = $${paramIndex++}`;
      values.push(filters.organization_id);
    }

    if (filters.task_id) {
      text += ` AND tw.task_id = $${paramIndex++}`;
      values.push(filters.task_id);
    }

    if (filters.changed_by) {
      text += ` AND tw.changed_by = $${paramIndex++}`;
      values.push(filters.changed_by);
    }

    if (filters.from_status) {
      text += ` AND tw.from_status = $${paramIndex++}`;
      values.push(filters.from_status);
    }

    if (filters.to_status) {
      text += ` AND tw.to_status = $${paramIndex++}`;
      values.push(filters.to_status);
    }

    // Cursor Pagination
    if (filters.cursor) {
      // sortValue is changed_at, id is id
      text += ` AND (date_trunc('milliseconds', tw.changed_at), tw.id) < ($${paramIndex++}, $${paramIndex++})`;
      values.push(filters.cursor.sortValue, filters.cursor.id);
    }

    text += " ORDER BY date_trunc('milliseconds', tw.changed_at) DESC, tw.id DESC";

    const limit = filters.limit || 50;
    text += ` LIMIT $${paramIndex++}`;
    values.push(limit + 1);

    const { rows } = await query(text, values);
    return rows;
  }
}

module.exports = new TaskWorkflowRepository();
