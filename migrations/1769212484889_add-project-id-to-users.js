exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.addColumn('users', {
        project_id: { type: 'uuid', references: 'projects(id)', onDelete: 'SET NULL' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('users', 'project_id');
};
