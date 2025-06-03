"use client";
import { useState } from 'react';

export default function DiagnosticPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [testMessage, setTestMessage] = useState("Hello, this is a timeout test message.");

  const runDiagnostics = async () => {
    setLoading(true);
    setResults(null);
    
    const diagnostics = {};
    
    try {
      // Test 1: Health Check
      console.log("Running health check...");
      const healthStart = Date.now();
      const healthResponse = await fetch('/api/health');
      const healthData = await healthResponse.json();
      diagnostics.health = {
        duration: Date.now() - healthStart,
        status: healthResponse.status,
        data: healthData
      };
    } catch (error) {
      diagnostics.health = {
        error: error.message,
        status: 'failed'
      };
    }

    try {
      // Test 2: AI Proxy Health
      console.log("Testing AI proxy health...");
      const proxyHealthStart = Date.now();
      const proxyHealthResponse = await fetch('/api/ai-proxy');
      const proxyHealthData = await proxyHealthResponse.json();
      diagnostics.proxyHealth = {
        duration: Date.now() - proxyHealthStart,
        status: proxyHealthResponse.status,
        data: proxyHealthData
      };
    } catch (error) {
      diagnostics.proxyHealth = {
        error: error.message,
        status: 'failed'
      };
    }    try {
      // Test 3: AI Response Test
      console.log("Testing AI response...");
      const aiStart = Date.now();
      
      // Create timeout signal with fallback
      const createTimeoutSignal = (timeoutMs) => {
        if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
          return AbortSignal.timeout(timeoutMs);
        }
        const controller = new AbortController();
        setTimeout(() => controller.abort(), timeoutMs);
        return controller.signal;
      };
      
      const aiResponse = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: testMessage }
          ]
        }),
        signal: createTimeoutSignal(30000), // 30 second timeout
      });
      
      const aiData = await aiResponse.json();
      diagnostics.aiResponse = {
        duration: Date.now() - aiStart,
        status: aiResponse.status,
        data: aiData
      };
    } catch (error) {
      diagnostics.aiResponse = {
        error: error.message,
        status: 'failed',
        isTimeout: error.name === 'TimeoutError' || error.message.includes('timeout')
      };
    }

    setResults(diagnostics);
    setLoading(false);
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusColor = (test) => {
    if (test.error) return 'text-red-600 bg-red-50';
    if (test.status === 200 || test.status === 'healthy') return 'text-green-600 bg-green-50';
    return 'text-yellow-600 bg-yellow-50';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">AI Proxy Diagnostics</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Message:
            </label>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Enter test message for AI response..."
            />
          </div>
          
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Running Diagnostics...' : 'Run Full Diagnostics'}
          </button>
        </div>

        {results && (
          <div className="space-y-6">
            {/* Health Check Results */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">System Health Check</h3>
              <div className={`p-4 rounded-md ${getStatusColor(results.health)}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Overall Health</span>
                  <span>{results.health.duration ? formatDuration(results.health.duration) : 'Failed'}</span>
                </div>
                {results.health.error && (
                  <p className="mt-2 text-sm">Error: {results.health.error}</p>
                )}
                {results.health.data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">View Details</summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(results.health.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>

            {/* AI Proxy Health Results */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">AI Proxy Health</h3>
              <div className={`p-4 rounded-md ${getStatusColor(results.proxyHealth)}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Proxy Health</span>
                  <span>{results.proxyHealth.duration ? formatDuration(results.proxyHealth.duration) : 'Failed'}</span>
                </div>
                {results.proxyHealth.error && (
                  <p className="mt-2 text-sm">Error: {results.proxyHealth.error}</p>
                )}
                {results.proxyHealth.data && (
                  <div className="mt-2 text-sm">
                    <p>Available Endpoints: {results.proxyHealth.data.availableEndpoints}/{results.proxyHealth.data.totalEndpoints}</p>
                    <details className="mt-1">
                      <summary className="cursor-pointer font-medium">View Endpoint Details</summary>
                      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                        {JSON.stringify(results.proxyHealth.data.endpoints, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>

            {/* AI Response Test Results */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">AI Response Test</h3>
              <div className={`p-4 rounded-md ${getStatusColor(results.aiResponse)}`}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">AI Response</span>
                  <span>{results.aiResponse.duration ? formatDuration(results.aiResponse.duration) : 'Failed'}</span>
                </div>
                {results.aiResponse.error && (
                  <div className="mt-2 text-sm">
                    <p>Error: {results.aiResponse.error}</p>
                    {results.aiResponse.isTimeout && (
                      <p className="mt-1 font-medium text-red-700">
                        ⚠️ This appears to be a timeout error (504 Gateway Timeout)
                      </p>
                    )}
                  </div>
                )}
                {results.aiResponse.data && (
                  <div className="mt-2 text-sm">
                    {results.aiResponse.data.response && (
                      <div className="mb-2">
                        <p className="font-medium">Response:</p>
                        <p className="bg-gray-100 p-2 rounded italic">
                          {results.aiResponse.data.response}
                        </p>
                      </div>
                    )}
                    {results.aiResponse.data.tokenUsage && (
                      <p>Tokens Used: {results.aiResponse.data.tokenUsage.total_tokens}</p>
                    )}
                    {results.aiResponse.data.isError && (
                      <p className="text-red-600 font-medium">⚠️ Response contains error flag</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-4">Troubleshooting Recommendations</h3>
              <ul className="text-yellow-700 space-y-2">
                <li>• If health checks pass but AI responses fail, check your AI_API_KEY environment variable</li>
                <li>• If you see 504 timeout errors, the AI endpoints may be slow or overloaded</li>
                <li>• Response times over 10 seconds indicate potential performance issues</li>
                <li>• Check Vercel function logs for detailed error information</li>
                <li>• Consider reducing message length if timeouts persist</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
