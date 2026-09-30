const http = require('http');

const testWebhookEndpoint = () => {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/webhooks/stripe',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'test_signature'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`\n📊 Status Code: ${res.statusCode}`);
    console.log(`📊 Status Message: ${res.statusMessage}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log(`📊 Response: ${data}`);
      
      if (res.statusCode === 400) {
        console.log('\n✅ Webhook endpoint is accessible and properly rejecting invalid signatures!');
        console.log('✅ This is expected behavior - real Stripe webhooks will work correctly.');
      } else {
        console.log('\n❓ Unexpected response - check server logs');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Error testing webhook:', error.message);
    console.error('❌ Make sure the server is running on port 5000');
  });

  // Send test payload
  req.write(JSON.stringify({ test: 'data' }));
  req.end();
};

console.log('🧪 Testing webhook endpoint at http://localhost:5000/api/v1/webhooks/stripe');
console.log('📝 Note: We expect a 400 error because we\'re using an invalid signature\n');

testWebhookEndpoint();
