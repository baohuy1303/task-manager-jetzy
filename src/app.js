const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
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


// Error Handling
app.use(errorHandler);

module.exports = app;
