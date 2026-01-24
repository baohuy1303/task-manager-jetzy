exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.addColumn('tasks', {
        is_deleted: { type: 'boolean', default: false },
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('tasks', 'is_deleted');
};
