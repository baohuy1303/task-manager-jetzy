const { query } = require('../../config/db');

class ProjectMemberRepository {
  async addMember(projectId, userId, client) {
    const text = `
      INSERT INTO project_members (project_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, project_id) DO NOTHING
      RETURNING *
    `;
    const { rows } = await (client ? client.query(text, [projectId, userId]) : query(text, [projectId, userId]));
    return rows[0];
  }

  async removeMember(projectId, userId, client) {
    const text = 'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 RETURNING *';
    const { rows } = await (client ? client.query(text, [projectId, userId]) : query(text, [projectId, userId]));
    return rows[0];
  }

  async isMember(projectId, userId) {
    const text = 'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2';
    const { rows } = await query(text, [projectId, userId]);
    return !!rows[0];
  }

  async findProjectsByUser(userId) {
    const text = `
        SELECT p.*, pm.assigned_at 
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = $1
        ORDER BY pm.assigned_at DESC
    `;
    const { rows } = await query(text, [userId]);
    return rows;
  }

  async findMembersByProject(projectId, { limit = 50, cursor, include_deactivated = false } = {}) {
      let text = `
        SELECT u.id, u.name, u.email, u.role, pm.assigned_at
        FROM users u
        JOIN project_members pm ON u.id = pm.user_id
        WHERE pm.project_id = $1
      `;
      const values = [projectId];
      let paramIndex = 2;

      if (!include_deactivated) {
          text += ` AND u.is_active = true`;
      }

      // CURSOR CLAUSE
      if (cursor) {
          text += ` AND (date_trunc('milliseconds', pm.assigned_at), u.id) < ($${paramIndex++}, $${paramIndex++})`;
          values.push(cursor.sortValue, cursor.id);
      }

      text += ' ORDER BY pm.assigned_at DESC, u.id DESC';

      // LIMIT
      text += ` LIMIT $${paramIndex++}`;
      values.push(limit + 1);

      const { rows } = await query(text, values);
      return rows;
  }
}

module.exports = new ProjectMemberRepository();
