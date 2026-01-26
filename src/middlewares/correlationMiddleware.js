const { v4: uuidv4 } = require('uuid');

const correlationMiddleware = (req, res, next) => {
    // Check if client sent a correlation ID, otherwise generate new one
    const correlationId = req.header('X-Correlation-ID') || uuidv4();
    
    // Attach to request for use throughout the application
    req.correlationId = correlationId;
    
    // Send back in response headers so clients can see it
    res.setHeader('X-Correlation-ID', correlationId);
    
    next();
};

module.exports = correlationMiddleware;
