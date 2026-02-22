import { useState, useEffect, useRef } from 'react';

function Logs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/logs');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  useEffect(() => {
    // Fetch logs on mount
    fetchLogs();
  }, []);

  useEffect(() => {
    // Auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Logs</h2>
        <div className="flex gap-4">
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>
        </div>
      </div>

      <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 h-[600px] overflow-auto">
        <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono">
          {logs.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500">No logs captured...</span>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="hover:bg-gray-200 dark:hover:bg-gray-800">
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </pre>
      </div>
    </div>
  );
}

export default Logs;