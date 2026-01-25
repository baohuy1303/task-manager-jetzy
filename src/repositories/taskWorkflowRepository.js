const { query } = require('../../config/db');

class TaskWorkflowRepository {
  async create({ task_id, from_status, to_status, changed_by }, client) {
    const text = `
      INSERT INTO task_workflows (task_id, from_status, to_status, changed_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const { rows } = await (client ? client.query(text, [task_id, from_status, to_status, changed_by]) : query(text, [task_id, from_status, to_status, changed_by]));
    return rows[0];
  }
}

module.exports = new TaskWorkflowRepository();
