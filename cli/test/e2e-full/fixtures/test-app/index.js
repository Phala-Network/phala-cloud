const http = require('http');

const PORT = process.env.PORT || 3000;
const BUILD_VERSION = process.env.BUILD_VERSION || '1.0.0';
const TEST_ENV_VAR = process.env.TEST_ENV_VAR || 'default';

const server = http.createServer((req, res) => {
  // CORS headers for testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));
  } else if (req.url === '/version') {
    res.writeHead(200);
    res.end(JSON.stringify({
      version: BUILD_VERSION,
      env: TEST_ENV_VAR,
      node: process.version
    }));
  } else if (req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({
      message: 'Phala Cloud E2E Test App',
      version: BUILD_VERSION,
      endpoints: [
        '/health',
        '/version',
        '/'
      ]
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Test app listening on port ${PORT}`);
  console.log(`Build version: ${BUILD_VERSION}`);
  console.log(`Test env var: ${TEST_ENV_VAR}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
