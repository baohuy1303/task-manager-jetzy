const auditLogService = require('../services/auditLogService');

class AuditLogController {
  async getLogs(req, res, next) {
    try {
      const { 
        entity_type, 
        entity_id, 
        action, 
        performed_by, 
        correlation_id,
        start_date, 
        end_date, 
        limit, 
        cursor 
      } = req.query;

      const filters = { 
        entity_type, 
        entity_id, 
        action, 
        performed_by, 
        correlation_id,
        start_date, 
        end_date, 
        limit: limit ? parseInt(limit) : undefined,
        cursor: cursor ? JSON.parse(cursor) : undefined
      };

      const result = await auditLogService.getAuditLogs(req.user, filters);
      res.json(result);
    } catch (error) {
      if (error.message.startsWith('Access denied')) {
        return res.status(403).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
}

module.exports = new AuditLogController();
