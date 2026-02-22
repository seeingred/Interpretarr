import { useState, useEffect } from 'react';
import api from '../services/api';

interface SettingsProps {
  onSave: () => void;
}

interface SettingsData {
  geminiApiKey: string;
  geminiModel: string;
  batchSize: string;
  sonarrApiKey: string;
  sonarrUrl: string;
  radarrApiKey: string;
  radarrUrl: string;
}

function Settings({ onSave }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>({
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
    batchSize: '50',
    sonarrApiKey: '',
    sonarrUrl: '',
    radarrApiKey: '',
    radarrUrl: '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings({
        geminiApiKey: response.data.geminiApiKey || '',
        geminiModel: response.data.geminiModel || 'gemini-2.0-flash',
        batchSize: response.data.batchSize || '50',
        sonarrApiKey: response.data.sonarrApiKey || '',
        sonarrUrl: response.data.sonarrUrl || '',
        radarrApiKey: response.data.radarrApiKey || '',
        radarrUrl: response.data.radarrUrl || '',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleChange = (field: keyof SettingsData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setSettings({ ...settings, [field]: e.target.value });
  };

  const handleBlur = async (field: keyof SettingsData) => {
    setSaving(true);
    setMessage('');

    try {
      await api.put('/settings', { [field]: settings[field] });
      setMessage('Settings saved');
      onSave();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Failed to save settings');
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-8">
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Translation Engine</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Gemini API Key</label>
              <input
                type="password"
                value={settings.geminiApiKey}
                onChange={handleChange('geminiApiKey')}
                onBlur={() => handleBlur('geminiApiKey')}
                placeholder="Enter Gemini API key"
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Get a free API key from Google AI Studio</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Gemini Model</label>
              <select
                value={settings.geminiModel}
                onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                onBlur={() => handleBlur('geminiModel')}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All models have a free tier available</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Batch Size</label>
              <input
                type="number"
                value={settings.batchSize}
                onChange={handleChange('batchSize')}
                onBlur={() => handleBlur('batchSize')}
                placeholder="50"
                min="10"
                max="200"
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Number of subtitles per translation batch (default: 50)</p>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">ARR Integration</h3>
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium mb-3">Sonarr</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">URL</label>
                  <input
                    type="text"
                    value={settings.sonarrUrl}
                    onChange={handleChange('sonarrUrl')}
                    onBlur={() => handleBlur('sonarrUrl')}
                    placeholder="http://host.docker.internal:8989"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">API Key</label>
                  <input
                    type="password"
                    value={settings.sonarrApiKey}
                    onChange={handleChange('sonarrApiKey')}
                    onBlur={() => handleBlur('sonarrApiKey')}
                    placeholder="Enter Sonarr API key"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-md font-medium mb-3">Radarr</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">URL</label>
                  <input
                    type="text"
                    value={settings.radarrUrl}
                    onChange={handleChange('radarrUrl')}
                    onBlur={() => handleBlur('radarrUrl')}
                    placeholder="http://host.docker.internal:7878"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">API Key</label>
                  <input
                    type="password"
                    value={settings.radarrApiKey}
                    onChange={handleChange('radarrApiKey')}
                    onBlur={() => handleBlur('radarrApiKey')}
                    placeholder="Enter Radarr API key"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {message && (
          <div className={`text-sm ${saving ? 'text-blue-500 dark:text-blue-400' : 'text-green-500 dark:text-green-400'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;