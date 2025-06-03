"use client";
import { useState, useEffect } from 'react';

export default function TestAI() {
  const [connectivityResults, setConnectivityResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const testConnectivity = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai-proxy');
      const data = await response.json();
      setConnectivityResults(data);
    } catch (error) {
      setConnectivityResults({ error: error.message });
    }
    setLoading(false);
  };

  const testAIResponse = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, this is a test message. Please respond briefly.' }
          ]
        }),
      });
      
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: error.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    testConnectivity();
  }, []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">AI Service Connectivity Test</h1>
      
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Endpoint Connectivity</h2>
          <button 
            onClick={testConnectivity}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Connectivity'}
          </button>
          
          {connectivityResults && (
            <div className="mt-4">
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(connectivityResults, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">AI Response Test</h2>
          <button 
            onClick={testAIResponse}
            disabled={loading}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test AI Response'}
          </button>
          
          {testResult && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Response:</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <h3 className="font-medium text-yellow-800 mb-2">Expected Behavior:</h3>
          <ul className="text-yellow-700 text-sm space-y-1">
            <li>• Connectivity test should show which endpoints are available</li>
            <li>• AI response test should return a proper response from the AI service</li>
            <li>• If all endpoints fail, check network connectivity and endpoint configuration</li>
            <li>• 504 errors indicate timeout issues - the AI service is slow or unreachable</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
