console.log('Testing basic Node.js server...');

const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`Request received: ${req.method} ${req.url}`);
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Node.js server!');
});

const PORT = 3008;

server.listen(PORT, () => {
  console.log(`Simple test server running on port ${PORT}`);
  console.log(`Test with: curl http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});