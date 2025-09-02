const http = require('http');

// Simple test to verify the server can start and respond
const testServer = async () => {
  console.log('Testing API Gateway...');
  
  // Start the server
  const { createApp } = require('./dist/app');
  const app = createApp();
  
  const server = app.listen(3002, () => {
    console.log('Test server started on port 3002');
    
    // Test health endpoint
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/v1/health',
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Health check response:', JSON.parse(data));
        console.log('✅ API Gateway is working correctly!');
        server.close();
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Test failed:', err);
      server.close();
    });
    
    req.end();
  });
};

testServer().catch(console.error);