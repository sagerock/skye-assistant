console.log('Starting WebSocket debug server...');

const http = require('http');
const { WebSocketServer } = require('ws');

console.log('Creating HTTP server...');
const server = http.createServer((req, res) => {
  console.log('HTTP request received:', req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'WebSocket server running', port: 3010 }));
});

console.log('Creating WebSocket server...');
const wss = new WebSocketServer({ 
  server: server,
  perMessageDeflate: false
});

wss.on('connection', (ws, req) => {
  console.log('NEW WEBSOCKET CONNECTION!');
  
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'WebSocket connection successful!'
  }));
  
  ws.on('message', (message) => {
    console.log('Received:', message.toString());
    ws.send(JSON.stringify({
      type: 'echo',
      message: `Echo: ${message.toString()}`
    }));
  });
  
  ws.on('close', () => {
    console.log('WebSocket closed');
  });
});

const PORT = 3010;

server.listen(PORT, (err) => {
  if (err) {
    console.error('Failed to start:', err);
    return;
  }
  console.log(`✅ WebSocket server running on http://localhost:${PORT}`);
  console.log(`✅ WebSocket endpoint: ws://localhost:${PORT}`);
  console.log('Ready for connections!');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

// Keep the process alive
setInterval(() => {
  console.log('Server still running...');
}, 10000);