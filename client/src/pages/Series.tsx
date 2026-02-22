import { useState, useEffect } from 'react';
import api from '../services/api';
import TranslateDialog from '../components/TranslateDialog';

interface Series {
  id: number;
  title: string;
  seasonCount: number;
  episodeFileCount: number;
}

interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  filePath?: string;
}

function Series() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [translateDialog, setTranslateDialog] = useState<{
    open: boolean;
    episode?: Episode;
    series?: Series;
  }>({ open: false });

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    try {
      const response = await api.get('/sonarr/series');
      setSeriesList(response.data);
    } catch (error) {
      console.error('Failed to load series:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodes = async (series: Series) => {
    setSelectedSeries(series);
    setEpisodes([]);
    try {
      const response = await api.get(`/sonarr/series/${series.id}/episodes`);
      setEpisodes(response.data);
    } catch (error) {
      console.error('Failed to load episodes:', error);
    }
  };

  const openTranslateDialog = (episode: Episode) => {
    if (!episode.filePath) {
      alert('Episode file not available');
      return;
    }
    setTranslateDialog({
      open: true,
      episode,
      series: selectedSeries!,
    });
  };

  if (loading) {
    return <div>Loading series...</div>;
  }

  if (seriesList.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
        <p>No series available. Check your Sonarr configuration.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Series</h2>

      {!selectedSeries ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seriesList.map((series) => (
            <div
              key={series.id}
              onClick={() => loadEpisodes(series)}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <h3 className="text-lg font-semibold mb-2">{series.title}</h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <p>{series.seasonCount} seasons</p>
                <p>{series.episodeFileCount} episodes</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelectedSeries(null)}
            className="mb-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            ← Back to series
          </button>

          <h3 className="text-xl font-semibold mb-4">{selectedSeries.title}</h3>

          {episodes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
              <p>No episodes with files available</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {Object.entries(
                episodes.reduce((acc, episode) => {
                  const season = `Season ${episode.seasonNumber}`;
                  if (!acc[season]) acc[season] = [];
                  acc[season].push(episode);
                  return acc;
                }, {} as Record<string, Episode[]>)
              )
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([season, seasonEpisodes]) => (
                  <div key={season}>
                    <div className="bg-gray-100 dark:bg-gray-700 px-6 py-3">
                      <h4 className="font-medium">{season}</h4>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {seasonEpisodes.map((episode) => (
                        <div
                          key={episode.id}
                          className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <div>
                            <div className="font-medium">
                              Episode {episode.episodeNumber}: {episode.title}
                            </div>
                            {episode.filePath && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {episode.filePath.split('/').pop()}
                              </div>
                            )}
                          </div>
                          {episode.filePath && (
                            <button
                              onClick={() => openTranslateDialog(episode)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                            >
                              Translate
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {translateDialog.open && translateDialog.episode && (
        <TranslateDialog
          isOpen={translateDialog.open}
          onClose={() => setTranslateDialog({ open: false })}
          videoPath={translateDialog.episode.filePath!}
          itemName={`${translateDialog.series?.title} - S${translateDialog.episode.seasonNumber
            .toString()
            .padStart(2, '0')}E${translateDialog.episode.episodeNumber
            .toString()
            .padStart(2, '0')}: ${translateDialog.episode.title}`}
          itemId={`episode-${translateDialog.episode.id}`}
          itemType="episode"
        />
      )}
    </div>
  );
}

export default Series;