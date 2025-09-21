import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Series from './pages/Series';
import Movies from './pages/Movies';
import Queue from './pages/Queue';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import { useEffect, useState } from 'react';
import api from './services/api';

function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [sonarrEnabled, setSonarrEnabled] = useState(false);
  const [radarrEnabled, setRadarrEnabled] = useState(false);

  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const response = await api.get('/settings');
      setIsConfigured(response.data.isConfigured);
      setSonarrEnabled(!!response.data.sonarrApiKey && !!response.data.sonarrUrl);
      setRadarrEnabled(!!response.data.radarrApiKey && !!response.data.radarrUrl);
    } catch (error) {
      console.error('Failed to check configuration:', error);
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <Layout
            isConfigured={isConfigured}
            sonarrEnabled={sonarrEnabled}
            radarrEnabled={radarrEnabled}
            onConfigChange={checkConfiguration}
          />
        }>
          <Route index element={<Queue />} />
          <Route path="/series" element={<Series />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/settings" element={<Settings onSave={checkConfiguration} />} />
          <Route path="/logs" element={<Logs />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;