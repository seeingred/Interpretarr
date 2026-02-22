import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

interface TranslateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoPath: string;
  itemName: string;
  itemId: string;
  itemType: 'movie' | 'episode';
}

const POPULAR_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
].sort((a, b) => a.name.localeCompare(b.name));

const ISO_639_MAP: Record<string, string> = {
  eng: 'English', en: 'English',
  spa: 'Spanish', es: 'Spanish',
  fra: 'French', fre: 'French', fr: 'French',
  deu: 'German', ger: 'German', de: 'German',
  ita: 'Italian', it: 'Italian',
  por: 'Portuguese', pt: 'Portuguese',
  rus: 'Russian', ru: 'Russian',
  jpn: 'Japanese', ja: 'Japanese',
  kor: 'Korean', ko: 'Korean',
  zho: 'Chinese', chi: 'Chinese', zh: 'Chinese',
  ara: 'Arabic', ar: 'Arabic',
  hin: 'Hindi', hi: 'Hindi',
  tur: 'Turkish', tr: 'Turkish',
  pol: 'Polish', pl: 'Polish',
  nld: 'Dutch', dut: 'Dutch', nl: 'Dutch',
  swe: 'Swedish', sv: 'Swedish',
  nor: 'Norwegian', no: 'Norwegian',
  dan: 'Danish', da: 'Danish',
  fin: 'Finnish', fi: 'Finnish',
  ces: 'Czech', cze: 'Czech', cs: 'Czech',
  hun: 'Hungarian', hu: 'Hungarian',
  ron: 'Romanian', rum: 'Romanian', ro: 'Romanian',
  tha: 'Thai', th: 'Thai',
  vie: 'Vietnamese', vi: 'Vietnamese',
  ind: 'Indonesian', id: 'Indonesian',
  heb: 'Hebrew', he: 'Hebrew',
  ell: 'Greek', gre: 'Greek', el: 'Greek',
  ukr: 'Ukrainian', uk: 'Ukrainian',
};

interface Subtitle {
  path: string;
  filename: string;
  type?: 'external' | 'embedded';
  streamId?: number;
  language?: string;
}

function TranslateDialog({
  isOpen,
  onClose,
  videoPath,
  itemName,
  itemId,
  itemType,
}: TranslateDialogProps) {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSubtitles();
    }
  }, [isOpen, videoPath]);

  const loadSubtitles = async () => {
    try {
      const response = await api.post('/subtitles/available', { videoPath });
      setSubtitles(response.data);
      if (response.data.length > 0) {
        const firstSub = response.data[0];
        setSelectedSubtitle(
          firstSub.streamId !== undefined ? `stream:${firstSub.streamId}` : firstSub.path
        );
        if (firstSub.language) {
          setSourceLanguage(ISO_639_MAP[firstSub.language] || firstSub.language);
        }
      }
    } catch (error) {
      console.error('Failed to load subtitles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = async () => {
    if (!selectedSubtitle || !targetLanguage) {
      alert('Please select a subtitle file and target language');
      return;
    }

    let subtitleFile: string;
    let streamId: number | undefined;

    // Check if it's an embedded subtitle (format: "stream:12")
    if (selectedSubtitle.startsWith('stream:')) {
      streamId = parseInt(selectedSubtitle.substring(7));
      subtitleFile = videoPath;
    } else {
      // External subtitle file
      subtitleFile = selectedSubtitle;
      streamId = undefined;
    }

    setAdding(true);

    const queueData = {
      type: itemType,
      item_id: itemId,
      item_name: itemName,
      subtitle_file: subtitleFile,
      subtitle_stream_id: streamId,
      source_language: sourceLanguage || undefined,
      target_language: targetLanguage,
    };

    console.log('Sending to queue:', queueData);
    console.log('Selected subtitle:', selectedSubtitle);
    console.log('Parsed stream ID:', streamId);

    try {
      await api.post('/queue', queueData);
      onClose();
    } catch (error) {
      console.error('Failed to add to queue:', error);
      alert('Failed to add to queue');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex justify-between items-center"
                >
                  Translate Subtitle
                  <button
                    onClick={onClose}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{itemName}</p>

                  {loading ? (
                    <p>Loading subtitles...</p>
                  ) : subtitles.length === 0 ? (
                    <p className="text-yellow-600 dark:text-yellow-400">
                      No subtitle files found for this video
                    </p>
                  ) : (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                          Select Subtitle File
                        </label>
                        <select
                          value={selectedSubtitle}
                          onChange={(e) => {
                            setSelectedSubtitle(e.target.value);
                            const sub = subtitles.find(s =>
                              s.streamId !== undefined ? `stream:${s.streamId}` === e.target.value : s.path === e.target.value
                            );
                            if (sub?.language) {
                              setSourceLanguage(ISO_639_MAP[sub.language] || sub.language);
                            } else {
                              setSourceLanguage('');
                            }
                          }}
                          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {subtitles.map((subtitle) => (
                            <option
                              key={subtitle.streamId !== undefined ? `stream-${subtitle.streamId}` : subtitle.path}
                              value={subtitle.streamId !== undefined ? `stream:${subtitle.streamId}` : subtitle.path}
                            >
                              {subtitle.filename}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                          Source Language
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">(optional)</span>
                        </label>
                        <input
                          type="text"
                          list="source-languages"
                          value={sourceLanguage}
                          onChange={(e) => setSourceLanguage(e.target.value)}
                          placeholder="Auto-detect"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <datalist id="source-languages">
                          {POPULAR_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.name}>
                              {lang.name}
                            </option>
                          ))}
                        </datalist>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                          Target Language
                        </label>
                        <input
                          type="text"
                          list="languages"
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          placeholder="Enter language code (e.g., en, es, fr)"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <datalist id="languages">
                          {POPULAR_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                              {lang.name}
                            </option>
                          ))}
                        </datalist>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Popular: {POPULAR_LANGUAGES.map((l) => l.code).join(', ')}
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3">
                        <button
                          onClick={onClose}
                          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-md text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddToQueue}
                          disabled={adding}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {adding ? 'Adding...' : 'Add to Queue'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default TranslateDialog;