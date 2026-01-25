exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.addColumn('organizations', {
        created_by: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' }
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('organizations', 'created_by');
};
