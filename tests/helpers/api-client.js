const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

async function apiCall(method, endpoint, data = null, token = null, customCorrelationId = null) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (customCorrelationId) headers['X-Correlation-ID'] = customCorrelationId;

  try {
    const response = await axios({
      method,
      url: `${API_URL}${endpoint}`,
      data,
      headers,
      validateStatus: () => true // Don't throw on any status
    });

    const correlationId = response.headers['x-correlation-id'];
    const isSuccess = response.status >= 200 && response.status < 300;

    // Log request
    const statusColor = isSuccess ? colors.green : colors.red;
    console.log(`${colors.gray}[${correlationId}]${colors.reset} ${statusColor}${method} ${endpoint} → ${response.status}${colors.reset}`);

    return {
      success: isSuccess,
      data: response.data,
      status: response.status,
      correlationId,
      error: !isSuccess ? response.data?.error : null
    };
  } catch (error) {
    console.log(`${colors.red}✗ ${method} ${endpoint} → ERROR${colors.reset}`);
    console.log(`${colors.red}  ${error.message}${colors.reset}`);
    
    return {
      success: false,
      error: error.message,
      status: 0,
      correlationId: null
    };
  }
}

module.exports = { apiCall };
