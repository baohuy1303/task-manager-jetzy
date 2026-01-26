require('dotenv').config();

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 1000,    // Keep last 1000 failed jobs
};

module.exports = {
  redisConfig,
  defaultJobOptions,
};
