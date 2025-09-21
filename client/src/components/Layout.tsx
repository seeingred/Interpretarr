import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  FilmIcon,
  TvIcon,
  QueueListIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface LayoutProps {
  isConfigured: boolean;
  sonarrEnabled: boolean;
  radarrEnabled: boolean;
  onConfigChange: () => void;
}

function Layout({ isConfigured, sonarrEnabled, radarrEnabled }: LayoutProps) {
  const location = useLocation();
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await api.get('/version');
        setVersion(response.data.version);
      } catch (error) {
        console.error('Failed to fetch version:', error);
      }
    };
    fetchVersion();
  }, []);

  const navigation = [
    { name: 'Series', href: '/series', icon: TvIcon, enabled: sonarrEnabled },
    { name: 'Movies', href: '/movies', icon: FilmIcon, enabled: radarrEnabled },
    { name: 'Queue', href: '/queue', icon: QueueListIcon, enabled: true },
    { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, enabled: true },
    { name: 'Logs', href: '/logs', icon: DocumentTextIcon, enabled: true },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold">Interpretarr</h1>
              {version && <span className="ml-3 text-xs text-gray-500">v{version}</span>}
            </div>
            {!isConfigured && (
              <div className="flex items-center text-yellow-400">
                <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                <span className="text-sm">Not configured</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 bg-gray-800 min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              const isDisabled = !item.enabled;

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isDisabled
                      ? 'opacity-50 cursor-not-allowed pointer-events-none'
                      : isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">
          <div className="p-8">
            {!isConfigured && location.pathname !== '/settings' && (
              <div className="mb-6 bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-400">
                      Configuration Required
                    </h3>
                    <p className="mt-1 text-sm text-yellow-300">
                      Please configure ai-sub-translator and at least one ARR integration in{' '}
                      <Link to="/settings" className="underline font-medium">
                        Settings
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      <footer className="bg-gray-800 border-t border-gray-700 py-4">
        <div className="px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400">
            Interpretarr - AI-powered subtitle translation for Radarr/Sonarr
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;