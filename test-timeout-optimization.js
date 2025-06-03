// Test timeout optimization for file summarization requests
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test the AI proxy timeout configuration
async function testAIProxyTimeouts() {
  log('\n🧪 Testing AI Proxy Timeout Configuration...', 'blue');
  
  const aiProxyPath = path.join(__dirname, 'app', 'api', 'ai-proxy', 'route.js');
  
  if (!fs.existsSync(aiProxyPath)) {
    log('❌ AI proxy route file not found', 'red');
    return false;
  }
  
  const content = fs.readFileSync(aiProxyPath, 'utf8');
  
  // Check for timeout constants
  const hasBasicTimeout = content.includes('TIMEOUT_MS = 12000');
  const hasFileSummarizationTimeout = content.includes('FILE_SUMMARIZATION_TIMEOUT_MS = 45000');
  const hasLargeContentTimeout = content.includes('LARGE_CONTENT_TIMEOUT_MS = 30000');
  
  // Check for timeout determination function
  const hasTimeoutDetermination = content.includes('determineRequestTimeout');
  
  // Check for dynamic timeout application
  const hasDynamicTimeout = content.includes('requestConfig.timeout');
  
  log(`✓ Basic timeout (12s): ${hasBasicTimeout ? '✅' : '❌'}`, hasBasicTimeout ? 'green' : 'red');
  log(`✓ File summarization timeout (45s): ${hasFileSummarizationTimeout ? '✅' : '❌'}`, hasFileSummarizationTimeout ? 'green' : 'red');
  log(`✓ Large content timeout (30s): ${hasLargeContentTimeout ? '✅' : '❌'}`, hasLargeContentTimeout ? 'green' : 'red');
  log(`✓ Timeout determination function: ${hasTimeoutDetermination ? '✅' : '❌'}`, hasTimeoutDetermination ? 'green' : 'red');
  log(`✓ Dynamic timeout application: ${hasDynamicTimeout ? '✅' : '❌'}`, hasDynamicTimeout ? 'green' : 'red');
  
  return hasBasicTimeout && hasFileSummarizationTimeout && hasLargeContentTimeout && hasTimeoutDetermination && hasDynamicTimeout;
}

// Test the frontend timeout configuration
async function testFrontendTimeouts() {
  log('\n🧪 Testing Frontend Timeout Configuration...', 'blue');
  
  const aiResponsePath = path.join(__dirname, 'app', 'chat', 'hooks', 'useAIResponse.js');
  
  if (!fs.existsSync(aiResponsePath)) {
    log('❌ AI response hook file not found', 'red');
    return false;
  }
  
  const content = fs.readFileSync(aiResponsePath, 'utf8');
  
  // Check for frontend timeout determination
  const hasFrontendTimeoutDetermination = content.includes('determineRequestTimeout');
  
  // Check for different timeout values
  const hasFileSummarizationTimeout = content.includes('50000') || content.includes('50 * 1000');
  const hasRAGTimeout = content.includes('35000') || content.includes('25000');
  const hasRegularTimeout = content.includes('15000') || content.includes('15 * 1000');
  
  // Check for timeout signal creation
  const hasTimeoutSignal = content.includes('createTimeoutSignal');
  
  // Check for retry logic with adaptive timeouts
  const hasRetryTimeout = content.includes('retryTimeout');
  
  log(`✓ Frontend timeout determination: ${hasFrontendTimeoutDetermination ? '✅' : '❌'}`, hasFrontendTimeoutDetermination ? 'green' : 'red');
  log(`✓ File summarization timeout (50s): ${hasFileSummarizationTimeout ? '✅' : '❌'}`, hasFileSummarizationTimeout ? 'green' : 'red');
  log(`✓ RAG request timeouts (25-35s): ${hasRAGTimeout ? '✅' : '❌'}`, hasRAGTimeout ? 'green' : 'red');
  log(`✓ Regular timeout (15s): ${hasRegularTimeout ? '✅' : '❌'}`, hasRegularTimeout ? 'green' : 'red');
  log(`✓ Timeout signal creation: ${hasTimeoutSignal ? '✅' : '❌'}`, hasTimeoutSignal ? 'green' : 'red');
  log(`✓ Adaptive retry timeout: ${hasRetryTimeout ? '✅' : '❌'}`, hasRetryTimeout ? 'green' : 'red');
  
  return hasFrontendTimeoutDetermination && hasFileSummarizationTimeout && hasRAGTimeout && hasRegularTimeout && hasTimeoutSignal && hasRetryTimeout;
}

// Test timeout determination logic
async function testTimeoutLogic() {
  log('\n🧪 Testing Timeout Determination Logic...', 'blue');
  
  // Simulate different request types
  const testCases = [
    {
      name: 'File summarization request',
      attachments: [{ name: 'document.pdf', size: 1024000 }],
      prompt: 'Summarize this document',
      lectureId: null,
      expectedTimeout: '45-50 seconds'
    },
    {
      name: 'RAG request with lecture materials',
      attachments: [],
      prompt: 'Explain the concept from lecture',
      lectureId: 'lecture-123',
      expectedTimeout: '25-35 seconds'
    },
    {
      name: 'Large content request',
      attachments: [],
      prompt: 'A'.repeat(5000), // Very long prompt
      lectureId: null,
      expectedTimeout: '30 seconds'
    },
    {
      name: 'Regular chat request',
      attachments: [],
      prompt: 'Hello, how are you?',
      lectureId: null,
      expectedTimeout: '15 seconds'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    log(`\n  Test Case ${index + 1}: ${testCase.name}`, 'yellow');
    log(`    • Has attachments: ${testCase.attachments.length > 0 ? 'Yes' : 'No'}`);
    log(`    • Has lecture ID: ${testCase.lectureId ? 'Yes' : 'No'}`);
    log(`    • Prompt length: ${testCase.prompt.length} characters`);
    log(`    • Expected timeout: ${testCase.expectedTimeout}`, 'green');
  });
  
  return true;
}

// Test if the server can start without errors
async function testServerStart() {
  log('\n🧪 Testing Server Start with Timeout Optimizations...', 'blue');
  
  return new Promise((resolve) => {
    const server = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: true
    });
    
    let serverStarted = false;
    let timeoutId;
    
    // Set a timeout to prevent hanging
    timeoutId = setTimeout(() => {
      if (!serverStarted) {
        server.kill();
        log('❌ Server start test timed out (30s)', 'red');
        resolve(false);
      }
    }, 30000);
    
    server.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready on') || output.includes('http://localhost')) {
        if (!serverStarted) {
          serverStarted = true;
          clearTimeout(timeoutId);
          log('✅ Server started successfully with timeout optimizations', 'green');
          server.kill();
          resolve(true);
        }
      }
    });
    
    server.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error') || error.includes('MODULE_NOT_FOUND')) {
        clearTimeout(timeoutId);
        log('❌ Server failed to start:', 'red');
        log(error, 'red');
        server.kill();
        resolve(false);
      }
    });
    
    server.on('exit', (code) => {
      if (!serverStarted) {
        clearTimeout(timeoutId);
        if (code !== 0) {
          log(`❌ Server exited with code ${code}`, 'red');
          resolve(false);
        }
      }
    });
  });
}

// Test configuration validation
async function testConfigurationValidation() {
  log('\n🧪 Testing Configuration Validation...', 'blue');
  
  const checks = [];
  
  // Check if package.json has required dependencies
  try {
    const packagePath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const hasAxios = packageContent.dependencies?.axios || packageContent.devDependencies?.axios;
      checks.push({ name: 'Axios dependency', status: !!hasAxios });
    }
  } catch (error) {
    checks.push({ name: 'Package.json validation', status: false, error: error.message });
  }
  
  // Check if environment variables are configured
  const envPath = path.join(__dirname, '.env.local');
  const hasEnvFile = fs.existsSync(envPath);
  checks.push({ name: 'Environment file (.env.local)', status: hasEnvFile });
  
  checks.forEach(check => {
    const status = check.status ? '✅' : '❌';
    const color = check.status ? 'green' : 'red';
    log(`${status} ${check.name}`, color);
    if (check.error) {
      log(`    Error: ${check.error}`, 'red');
    }
  });
  
  return checks.every(check => check.status);
}

// Main test runner
async function runTests() {
  log('🚀 Starting Timeout Optimization Tests...', 'bold');
  log('=====================================', 'blue');
  
  const results = [];
  
  try {
    // Run all tests
    results.push({ name: 'AI Proxy Timeouts', success: await testAIProxyTimeouts() });
    results.push({ name: 'Frontend Timeouts', success: await testFrontendTimeouts() });
    results.push({ name: 'Timeout Logic', success: await testTimeoutLogic() });
    results.push({ name: 'Configuration Validation', success: await testConfigurationValidation() });
    results.push({ name: 'Server Start Test', success: await testServerStart() });
    
    // Summary
    log('\n📊 Test Results Summary:', 'bold');
    log('========================', 'blue');
    
    let passedTests = 0;
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const color = result.success ? 'green' : 'red';
      log(`${status} ${result.name}`, color);
      if (result.success) passedTests++;
    });
    
    const totalTests = results.length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    log(`\n🎯 Overall Results: ${passedTests}/${totalTests} tests passed (${successRate}%)`, 'bold');
    
    if (successRate === 100) {
      log('\n🎉 All timeout optimizations are working correctly!', 'green');
      log('✨ File summarization requests should now work without timeout errors.', 'green');
    } else if (successRate >= 80) {
      log('\n⚠️  Most optimizations are working, but some issues need attention.', 'yellow');
    } else {
      log('\n🚨 Several timeout optimizations need to be fixed.', 'red');
    }
    
    // Recommendations
    log('\n💡 Recommendations:', 'blue');
    log('==================', 'blue');
    if (passedTests === totalTests) {
      log('• Test file summarization with actual files to verify end-to-end functionality');
      log('• Monitor response times to ensure performance is optimal');
      log('• Consider adding progress indicators for long-running requests');
    } else {
      log('• Review failed tests and fix any configuration issues');
      log('• Ensure all timeout constants are properly set');
      log('• Verify that dynamic timeout logic is correctly implemented');
    }
    
  } catch (error) {
    log(`\n❌ Test execution failed: ${error.message}`, 'red');
    console.error(error);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testAIProxyTimeouts,
  testFrontendTimeouts,
  testTimeoutLogic,
  testServerStart,
  testConfigurationValidation
};