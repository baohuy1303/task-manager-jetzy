exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. CRITICAL: Organization scoping + pagination
  // Most common query pattern: WHERE organization_id = ? ORDER BY created_at DESC
  // This composite index supports both filtering and sorting
  pgm.createIndex('audit_logs', ['organization_id', { name: 'created_at', sort: 'DESC' }], {
    name: 'idx_audit_org_created'
  });

  // 2. IMPORTANT: Entity lookups
  // Common pattern: WHERE entity_type = ? AND entity_id = ?
  // Used for tracing all actions on a specific entity
  pgm.createIndex('audit_logs', ['entity_type', 'entity_id'], {
    name: 'idx_audit_entity'
  });

  // 3. USEFUL: Correlation ID tracing (JSONB expression index)
  // Supports: WHERE metadata->>'request_id' = ?
  // Critical for end-to-end request tracing across services
  pgm.sql(`
    CREATE INDEX idx_audit_correlation 
    ON audit_logs ((metadata->>'request_id'))
  `);
};

exports.down = (pgm) => {
  pgm.dropIndex('audit_logs', ['organization_id', 'created_at'], { 
    name: 'idx_audit_org_created' 
  });
  pgm.dropIndex('audit_logs', ['entity_type', 'entity_id'], { 
    name: 'idx_audit_entity' 
  });
  pgm.sql('DROP INDEX IF EXISTS idx_audit_correlation');
};
