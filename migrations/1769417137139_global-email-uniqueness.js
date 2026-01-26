exports.shorthands = undefined;

exports.up = (pgm) => {
  // Remove the old unique constraint on (email, organization_id)
  pgm.dropConstraint('users', 'unique_email_org');
  
  // Add new unique constraint on email only (global uniqueness)
  pgm.addConstraint('users', 'unique_email_global', {
    unique: 'email'
  });
};

exports.down = (pgm) => {
  // Reverse: remove global constraint
  pgm.dropConstraint('users', 'unique_email_global');
  
  // Re-add the per-org constraint
  pgm.addConstraint('users', 'unique_email_org', {
    unique: ['email', 'organization_id']
  });
};
