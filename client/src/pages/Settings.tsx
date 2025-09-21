import { useState, useEffect } from 'react';
import api from '../services/api';

interface SettingsProps {
  onSave: () => void;
}

interface SettingsData {
  aiSubTranslatorUrl: string;
  aiSubTranslatorApiKey: string;
  sonarrApiKey: string;
  sonarrUrl: string;
  radarrApiKey: string;
  radarrUrl: string;
}

function Settings({ onSave }: SettingsProps) {
  const [settings, setSettings] = useState<SettingsData>({
    aiSubTranslatorUrl: '',
    aiSubTranslatorApiKey: '',
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
        aiSubTranslatorUrl: response.data.aiSubTranslatorUrl || '',
        aiSubTranslatorApiKey: response.data.aiSubTranslatorApiKey || '',
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
    e: React.ChangeEvent<HTMLInputElement>
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
        <section className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">ai-sub-translator</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Server URL
              </label>
              <input
                type="text"
                value={settings.aiSubTranslatorUrl}
                onChange={handleChange('aiSubTranslatorUrl')}
                onBlur={() => handleBlur('aiSubTranslatorUrl')}
                placeholder="http://host.docker.internal:9090"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <input
                type="password"
                value={settings.aiSubTranslatorApiKey}
                onChange={handleChange('aiSubTranslatorApiKey')}
                onBlur={() => handleBlur('aiSubTranslatorApiKey')}
                placeholder="Enter API key"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </section>

        <section className="bg-gray-800 rounded-lg p-6">
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
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {message && (
          <div className={`text-sm ${saving ? 'text-blue-400' : 'text-green-400'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;