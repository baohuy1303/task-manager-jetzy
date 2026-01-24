exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createIndex('tasks', ['assigned_to']);
};

exports.down = (pgm) => {
    pgm.dropIndex('tasks', ['assigned_to']);
};
