import { useEffect, useState } from 'react';

type FFmpegStatus =
  | { state: 'idle' }
  | { state: 'downloading'; progress: number }
  | { state: 'ready'; path: string }
  | { state: 'error'; message: string };

function FFmpegNotification() {
  const [status, setStatus] = useState<FFmpegStatus | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource('/api/ffmpeg/status');

    eventSource.onmessage = (event) => {
      const data: FFmpegStatus = JSON.parse(event.data);
      setStatus(data);

      if (data.state === 'downloading') {
        setVisible(true);
      } else if (data.state === 'ready') {
        setVisible(true);
        setTimeout(() => setVisible(false), 3000);
      } else if (data.state === 'error') {
        setVisible(true);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  if (!visible || !status) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      {status.state === 'downloading' && (
        <div className="bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-medium">Downloading FFmpeg...</span>
          </div>
          <div className="w-full bg-blue-400 rounded-full h-1.5">
            <div
              className="bg-white h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(status.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs mt-1 opacity-80">{Math.round(status.progress * 100)}%</p>
        </div>
      )}

      {status.state === 'ready' && (
        <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <span className="text-sm font-medium">FFmpeg ready</span>
        </div>
      )}

      {status.state === 'error' && (
        <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium">FFmpeg download failed</p>
          <p className="text-xs mt-1 opacity-80">{status.message}</p>
          <button
            onClick={() => setVisible(false)}
            className="text-xs underline mt-1 opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default FFmpegNotification;
