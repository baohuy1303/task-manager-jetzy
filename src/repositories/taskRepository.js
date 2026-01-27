const { query } = require('../../config/db');

class TaskRepository {
  async create({ project_id, title, description, status, priority, assigned_to, due_date }, client) {
    const text = `
      INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [project_id, title, description, status || 'todo', priority || 'medium', assigned_to, due_date];
    const { rows } = await (client ? client.query(text, values) : query(text, values));
    return rows[0];
  }

  async findById(id, client) {
    const text = 'SELECT * FROM tasks WHERE id = $1 AND is_deleted = false';
    const { rows } = await (client ? client.query(text, [id]) : query(text, [id]));
    return rows[0];
  }

  async findAll({ organization_id, project_id, assigned_to, status, priority, due_before, due_after, is_deleted, search, limit = 50, cursor }, client) {
    let text;
    let values;
    let paramIndex;

    // Optimization: If filtering by assigned_to OR project_id, use direct table lookup
    // We assume the service layer has already verified project ownership if project_id is provided.
    const useDirectLookup = !!(assigned_to || project_id);

    if (useDirectLookup) {
        text = `SELECT * FROM tasks WHERE ${assigned_to ? 'assigned_to = $1' : 'project_id = $1'}`;
        values = [assigned_to || project_id];
        paramIndex = 2;
    } else {
        // Admin/Manager Flow (Broad): Must Join Projects to verify Organization
        text = `
            SELECT t.* 
            FROM tasks t
            JOIN projects p ON t.project_id = p.id
            WHERE p.organization_id = $1
        `;
        values = [organization_id];
        paramIndex = 2;
    }

    if (project_id && assigned_to) {
        // If both are present (e.g. member filtering by project), and we started with assigned_to
        text += ` AND project_id = $${paramIndex++}`;
        values.push(project_id);
    } else if (project_id && !useDirectLookup) {
        // This case occurs if somehow useDirectLookup was false but project_id exists (not possible here but for clarity)
        text += ` AND t.project_id = $${paramIndex++}`;
        values.push(project_id);
    }

    if (search) {
        text += ` AND ${useDirectLookup ? '' : 't.'}title ILIKE $${paramIndex++}`;
        values.push(`%${search}%`);
    }

    if (status) {
        text += ` AND ${useDirectLookup ? '' : 't.'}status = $${paramIndex++}`;
        values.push(status);
    }

    if (priority) {
        text += ` AND ${useDirectLookup ? '' : 't.'}priority = $${paramIndex++}`;
        values.push(priority);
    }

    if (due_before) {
        text += ` AND ${useDirectLookup ? '' : 't.'}due_date <= $${paramIndex++}`;
        values.push(due_before);
    }

    if (due_after) {
        text += ` AND ${useDirectLookup ? '' : 't.'}due_date >= $${paramIndex++}`;
        values.push(due_after);
    }

    // Default to is_deleted = false unless specified
    if (is_deleted !== undefined) {
        text += ` AND ${useDirectLookup ? '' : 't.'}is_deleted = $${paramIndex++}`;
        values.push(is_deleted);
    } else {
        text += ` AND ${useDirectLookup ? '' : 't.'}is_deleted = false`;
    }

    // CURSOR CLAUSE
    if (cursor) {
        // We use date_trunc('milliseconds', ...) to match JS Date precision.
        // This ensures that rows with microseconds (.123456) are treated as equal to the JS cursor (.123),
        // allowing the tuple comparison to correctly fall through to the ID sorting for tie-breaking.
        const createdCol = `${useDirectLookup ? '' : 't.'}created_at`;
        const idCol = `${useDirectLookup ? '' : 't.'}id`;
        
        text += ` AND (date_trunc('milliseconds', ${createdCol}), ${idCol}) < ($${paramIndex++}, $${paramIndex++})`;
        values.push(cursor.sortValue, cursor.id);
    }

    text += ` ORDER BY date_trunc('milliseconds', ${useDirectLookup ? '' : 't.'}created_at) DESC, ${useDirectLookup ? '' : 't.'}id DESC`;
    
    text += ` LIMIT $${paramIndex++}`;
    values.push(limit + 1);

    const { rows } = await (client ? client.query(text, values) : query(text, values));
    return rows;
  }

  async updateStatus(id, status, expectedVersion, client) {
    let text = 'UPDATE tasks SET status = $1, version = version + 1 WHERE id = $2 AND is_deleted = false';
    const values = [status, id];
    
    if (expectedVersion !== undefined) {
        text += ' AND version = $3';
        values.push(expectedVersion);
    }
    
    text += ' RETURNING *';
    const { rows } = await (client ? client.query(text, values) : query(text, values));
    return rows[0];
  }

  async softDelete(id, client) {
    const text = 'UPDATE tasks SET is_deleted = true WHERE id = $1 RETURNING *';
    const { rows } = await (client ? client.query(text, [id]) : query(text, [id]));
    return rows[0];
  }

  async unassignTasks(userId, client) {
     const text = `
        UPDATE tasks 
        SET assigned_to = NULL, version = version + 1
        WHERE assigned_to = $1 AND is_deleted = false
        RETURNING id, title, project_id
     `;
     const { rows } = await (client ? client.query(text, [userId]) : query(text, [userId]));
     return rows;
  }
  

  async update(id, updates, expectedVersion, client) {
      // Dynamic update query builder
      const keys = Object.keys(updates);
      if (keys.length === 0) return this.findById(id, client);
      
      const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ');
      const values = [id, ...Object.values(updates)];
      let paramIndex = values.length + 1;

      let text = `UPDATE tasks SET ${setClause}, version = version + 1 WHERE id = $1 AND is_deleted = false`;
      
      if (expectedVersion !== undefined) {
          text += ` AND version = $${paramIndex}`;
          values.push(expectedVersion);
      }

      text += ' RETURNING *';
      const { rows } = await (client ? client.query(text, values) : query(text, values));
      return rows[0];
  }
}

module.exports = new TaskRepository();
