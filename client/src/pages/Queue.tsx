import { useState, useEffect } from 'react';
import api from '../services/api';
import { TrashIcon } from '@heroicons/react/24/outline';

interface QueueItem {
  id: number;
  type: 'movie' | 'episode';
  item_name: string;
  subtitle_file: string;
  target_language: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  error?: string;
  created_at: string;
}

function Queue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const response = await api.get('/queue');
      setQueue(response.data);
    } catch (error) {
      console.error('Failed to load queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (id: number, isActive: boolean = false) => {
    try {
      // If it's an active item, first try without force cancel to check
      if (isActive) {
        const confirmCancel = confirm('This will cancel the active translation. Are you sure?');
        if (!confirmCancel) return;

        await api.delete(`/queue/${id}?forceCancel=true`);
      } else {
        await api.delete(`/queue/${id}`);
      }
      loadQueue();
    } catch (error: any) {
      console.error('Failed to remove item:', error);

      // Check if the error indicates an active item needs cancellation
      if (error.response?.data?.requiresCancel) {
        const confirmCancel = confirm('This will cancel the active translation. Are you sure?');
        if (confirmCancel) {
          try {
            await api.delete(`/queue/${id}?forceCancel=true`);
            loadQueue();
          } catch (cancelError) {
            console.error('Failed to cancel and remove:', cancelError);
            alert('Failed to cancel translation');
          }
        }
      } else {
        alert('Failed to remove item from queue');
      }
    }
  };

  const clearQueue = async () => {
    if (confirm('Clear all pending and completed items from queue?')) {
      try {
        await api.delete('/queue');
        loadQueue();
      } catch (error) {
        console.error('Failed to clear queue:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-blue-600 dark:text-blue-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 border-green-300 dark:border-green-600';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 border-red-300 dark:border-red-600';
      default:
        return 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-500';
    }
  };

  if (loading) {
    return <div>Loading queue...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Queue</h2>
        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Clear Queue
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
          <p>Queue is empty</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium">{item.item_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {item.subtitle_file.split('/').pop()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm capitalize">{item.type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm uppercase">{item.target_language}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full border ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.status === 'active' ? (
                      <div className="w-24">
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {item.progress}%
                        </span>
                      </div>
                    ) : (
                      <span className={`text-sm ${getStatusColor(item.status)}`}>
                        {item.status === 'completed'
                          ? '100%'
                          : item.status === 'failed'
                          ? 'Error'
                          : 'Waiting'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => removeItem(item.id, item.status === 'active')}
                      className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                      title={item.status === 'active' ? 'Cancel and remove translation' : 'Remove from queue'}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {queue.some((item) => item.status === 'failed') && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-600 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Failed Items</h3>
          {queue
            .filter((item) => item.status === 'failed')
            .map((item) => (
              <div key={item.id} className="text-sm text-red-500 dark:text-red-300 mb-1">
                {item.item_name}: {item.error || 'Unknown error'}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default Queue;