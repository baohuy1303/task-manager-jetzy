const { query } = require('../../config/db');

class TaskWorkflowRepository {
  async create({ task_id, from_status, to_status, changed_by }) {
    const text = `
      INSERT INTO task_workflows (task_id, from_status, to_status, changed_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const { rows } = await query(text, [task_id, from_status, to_status, changed_by]);
    return rows[0];
  }
}

module.exports = new TaskWorkflowRepository();
