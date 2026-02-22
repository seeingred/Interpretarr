import { useState, useEffect } from 'react';
import api from '../services/api';
import TranslateDialog from '../components/TranslateDialog';

interface Movie {
  id: number;
  title: string;
  year: number;
  filePath?: string;
}

function Movies() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [translateDialog, setTranslateDialog] = useState<{
    open: boolean;
    movie?: Movie;
  }>({ open: false });

  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    try {
      const response = await api.get('/radarr/movies');
      setMovies(response.data);
    } catch (error) {
      console.error('Failed to load movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const openTranslateDialog = (movie: Movie) => {
    if (!movie.filePath) {
      alert('Movie file not available');
      return;
    }
    setTranslateDialog({ open: true, movie });
  };

  if (loading) {
    return <div>Loading movies...</div>;
  }

  if (movies.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
        <p>No movies available. Check your Radarr configuration.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Movies</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {movies.map((movie) => (
          <div key={movie.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">
              {movie.title} ({movie.year})
            </h3>
            {movie.filePath ? (
              <>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {movie.filePath.split('/').pop()}
                </div>
                <button
                  onClick={() => openTranslateDialog(movie)}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Translate
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">File not available</p>
            )}
          </div>
        ))}
      </div>

      {translateDialog.open && translateDialog.movie && (
        <TranslateDialog
          isOpen={translateDialog.open}
          onClose={() => setTranslateDialog({ open: false })}
          videoPath={translateDialog.movie.filePath!}
          itemName={`${translateDialog.movie.title} (${translateDialog.movie.year})`}
          itemId={`movie-${translateDialog.movie.id}`}
          itemType="movie"
        />
      )}
    </div>
  );
}

export default Movies;