const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Minimal server is working!' }));
});

const PORT = 3004;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Minimal server running on http://127.0.0.1:${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});