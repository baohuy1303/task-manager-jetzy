exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('tasks', {
    version: { type: 'integer', default: 1, notNull: true },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('tasks', 'version');
};
