const Bull = require('bull');
const { redisConfig, defaultJobOptions } = require('../config/redis');

const emailQueue = new Bull('email-notifications', {
  redis: redisConfig,
  defaultJobOptions: defaultJobOptions,
});

// Event listeners for debugging
emailQueue.on('active', (job) => {
  console.log(`[Queue] Job ${job.id} active: ${job.name}`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`[Queue] Job ${job.id} failed: ${err.message}`);
});

module.exports = emailQueue;
