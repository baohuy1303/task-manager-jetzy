const Bull = require('bull');
const { redisConfig, defaultJobOptions } = require('../config/redis');

const emailQueue = new Bull('email-notifications', {
  redis: redisConfig,
  defaultJobOptions: defaultJobOptions,
});

// Event listeners for debugging


module.exports = emailQueue;
