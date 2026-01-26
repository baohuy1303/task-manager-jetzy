const errorHandler = (err, req, res, next) => {
  // Log with correlation ID
  console.error(`[${req.correlationId || 'unknown'}] ERROR:`, err.stack);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    request_id: req.correlationId
  });
};

module.exports = errorHandler;
