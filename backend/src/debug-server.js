console.log('Starting debug server...');

const http = require('http');

const server = http.createServer((req, res) => {
  console.log('HTTP request received');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Debug server working!');
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

server.on('listening', () => {
  console.log('Server is listening on port 3009');
  console.log('Test with: curl http://localhost:3009');
});

console.log('About to listen on port 3009...');
server.listen(3009, () => {
  console.log('Listen callback executed');
});

console.log('Listen command executed');

setTimeout(() => {
  console.log('Server should be running by now...');
}, 2000);