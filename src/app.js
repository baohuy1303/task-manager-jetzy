const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middlewares/errorHandler');
const correlationMiddleware = require('./middlewares/correlationMiddleware');

const app = express();

// Correlation ID must be first (before logger)
app.use(correlationMiddleware);

// Configure morgan to include correlation ID
morgan.token('correlation-id', (req) => req.correlationId || 'none');

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('[:correlation-id] :method :url :status - :response-time ms'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check (External)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// versioned routes
const apiRouter = express.Router();
app.use('/api/v1', apiRouter);

apiRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Routes
const organizationRoutes = require('./routes/organizationRoutes');
apiRouter.use('/organizations', organizationRoutes);

const userRoutes = require('./routes/userRoutes');
apiRouter.use('/users', userRoutes);

const authRoutes = require('./routes/authRoutes');
apiRouter.use('/auth', authRoutes);

const projectRoutes = require('./routes/projectRoutes');
apiRouter.use('/projects', projectRoutes);

const taskRoutes = require('./routes/taskRoutes');
apiRouter.use('/tasks', taskRoutes);


// Start Worker
const processEmailJobs = require('./workers/emailWorker');
processEmailJobs();

app.use(errorHandler);

module.exports = app;
