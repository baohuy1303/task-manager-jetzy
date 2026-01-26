const auditLogRepository = require('../repositories/auditLogRepository');

class AuditLogService {
  async getAuditLogs(requestingUser, filters) {
    // 1. Authorization: Admin only
    if (requestingUser.role !== 'admin') {
      throw new Error('Access denied: Only admins can view audit logs');
    }

    // 2. CRITICAL: Scope to organization (Security - cannot access other org's logs)
    const organizationId = requestingUser.organization_id;

    // 3. Query repository with organization scoping
    const logs = await auditLogRepository.findByOrganization(organizationId, filters);

    // 4. Pagination logic
    const limit = Math.min(filters.limit || 50, 100);
    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;

    const nextCursor = hasMore 
      ? { created_at: items[items.length - 1].created_at, id: items[items.length - 1].id }
      : null;

    return {
      success: true,
      data: items,
      meta: {
        has_more: hasMore,
        next_cursor: nextCursor,
        count: items.length
      }
    };
  }
}

module.exports = new AuditLogService();
