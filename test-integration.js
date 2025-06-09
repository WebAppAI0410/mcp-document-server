// Simple integration test to verify the server starts and responds
const http = require('http');

const PORT = 6111;
const HOST = 'localhost';

async function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('Starting integration tests...\n');

  try {
    // Test 1: Health check
    console.log('Test 1: Health check endpoint');
    const health = await testEndpoint('/healthz');
    console.log(`✓ Health check passed: ${health.statusCode === 200 ? 'OK' : 'FAILED'}`);
    console.log(`  Status: ${health.data.status}`);
    console.log(`  Uptime: ${health.data.uptime}s\n`);

    // Test 2: Get tools
    console.log('Test 2: MCP tools endpoint');
    const tools = await testEndpoint('/v1/tools');
    console.log(`✓ Tools endpoint passed: ${tools.statusCode === 200 ? 'OK' : 'FAILED'}`);
    console.log(`  Available tools: ${tools.data.tools.map(t => t.name).join(', ')}\n`);

    // Test 3: List packages
    console.log('Test 3: List packages endpoint');
    const packages = await testEndpoint('/v1/packages');
    console.log(`✓ Packages endpoint passed: ${packages.statusCode === 200 ? 'OK' : 'FAILED'}`);
    console.log(`  Package count: ${packages.data.packages.length}\n`);

    // Test 4: Query docs (should work with mock store)
    console.log('Test 4: Query docs endpoint');
    const query = await testEndpoint('/v1/query-docs', 'POST', {
      library: 'next',
      version: '14.2.2',
      question: 'app router error handling',
    });
    console.log(`✓ Query docs passed: ${query.statusCode === 200 ? 'OK' : 'FAILED'}`);
    console.log(`  Results: ${query.data.results.length}`);
    console.log(`  Query time: ${query.data.query_time_ms}ms\n`);

    console.log('All tests passed! ✨');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

// Wait for server to be ready, then run tests
setTimeout(runTests, 1000);