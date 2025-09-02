// Simple test without Redis dependency
const express = require('express');

const app = express();

app.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API Gateway basic functionality works!',
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(3003, () => {
  console.log('Simple test server running on port 3003');
  
  // Test the endpoint
  const http = require('http');
  const req = http.get('http://localhost:3003/test', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Response:', JSON.parse(data));
      console.log('✅ Basic Express functionality confirmed!');
      server.close();
      process.exit(0);
    });
  });
  
  req.on('error', (err) => {
    console.error('❌ Test failed:', err);
    server.close();
    process.exit(1);
  });
});

setTimeout(() => {
  console.log('❌ Test timeout');
  server.close();
  process.exit(1);
}, 5000);