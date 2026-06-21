import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import func2url from '../../backend/func2url.json';

const API = func2url.files;
const CHUNK_API = (func2url as Record<string, string>)['files-chunk'];
const CHUNK_SIZE = 4 * 1024 * 1024;
const MAX_SIZE = 50 * 1024 * 1024;

interface FileItem {
  id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  cdn_url: string;
  description: string;
  created_at: string;
}

const fmtSize = (b: number) => {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} КБ`;
  return `${(b / 1024 / 1024).toFixed(1)} МБ`;
};

const sliceToBase64 = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });

const post = async (url: string, data: object) => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await r.json();
  if (!r.ok || json.error) throw new Error(json.error || `HTTP ${r.status}`);
  return json;
};

const Files = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [desc, setDesc] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(API);
      const d = await r.json();
      setFiles(d.files || []);
      setError('');
    } catch (e) {
      setError(`Ошибка соединения: ${e}`);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const upload = async (file: File) => {
    setUploading(true);
    setError('');
    setProgress(0);

    if (file.size > MAX_SIZE) {
      setError('Файл слишком большой. Максимум 50 МБ.');
      setUploading(false);
      return;
    }

    try {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      setStatus('Инициализирую...');
      setProgress(2);
      const { session_id } = await post(CHUNK_API, {
        action: 'init',
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        total_chunks: totalChunks,
      });

      for (let i = 0; i < totalChunks; i++) {
        const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const b64 = await sliceToBase64(slice);
        setStatus(`Отправляю часть ${i + 1} из ${totalChunks}...`);
        setProgress(5 + Math.round(((i + 1) / totalChunks) * 80));
        await post(CHUNK_API, {
          action: 'chunk',
          session_id,
          chunk_index: i,
          content_base64: b64,
        });
      }

      setStatus('Сохраняю файл...');
      setProgress(90);
      await post(CHUNK_API, {
        action: 'finish',
        session_id,
        description: desc,
        file_size: file.size,
      });

      setProgress(100);
      setStatus('');
      setDesc('');
      await load();
    } catch (e) {
      setError(`Ошибка загрузки: ${e}`);
      setStatus('');
      setProgress(0);
    }
    setUploading(false);
  };

  const remove = async (id: number) => {
    await fetch(`${API}?id=${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <div className="min-h-screen wheel-bg flex justify-center">
      <div className="w-full max-w-2xl px-4 py-6">
        <header className="flex items-center gap-3 mb-3">
          <Icon name="FolderOpen" size={32} className="text-white" />
          <h1 className="game-title text-3xl font-black text-white">Файлообменник</h1>
        </header>

        <p className="text-white/80 text-sm mb-4">
          Загружайте архивы и документы проекта (до 50 МБ). Разработчик откроет и прочитает их.
        </p>

        {error && (
          <div className="mb-3 rounded-xl px-4 py-3 text-sm font-bold text-white"
            style={{ background: 'rgba(230,57,70,0.85)' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="rounded-2xl p-4 mb-5"
          style={{ background: 'rgba(0,0,0,0.15)', border: '2px solid rgba(255,255,255,0.25)' }}>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Описание файла (необязательно)"
            className="w-full mb-3 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#244a96' }}
          />
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="game-tile w-full flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <Icon name={uploading ? 'Loader' : 'Upload'} size={22} className={uploading ? 'animate-spin' : ''} />
            {uploading ? (status || 'Загрузка...') : 'Выбрать и загрузить файл'}
          </button>

          {uploading && progress > 0 && (
            <div className="mt-3">
              <div className="rounded-full overflow-hidden h-3" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#4CB944,#7ED957)' }} />
              </div>
              <p className="text-white/70 text-xs mt-1 text-center">{progress}%</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {loading && <p className="text-white/70 text-center py-4">Загрузка списка...</p>}
          {!loading && files.length === 0 && !error && (
            <p className="text-white/70 text-center py-8">Пока нет загруженных файлов</p>
          )}
          {files.map((f) => (
            <div key={f.id} className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.92)' }}>
              <Icon name="FileArchive" size={28} className="text-[#3568c6] shrink-0" />
              <div className="flex-1 min-w-0">
                <a href={f.cdn_url} target="_blank" rel="noreferrer"
                  className="block font-bold text-[#244a96] truncate hover:underline">
                  {f.file_name}
                </a>
                <div className="text-xs text-gray-500">
                  {fmtSize(f.file_size)}{f.description ? ` · ${f.description}` : ''} · {new Date(f.created_at).toLocaleString('ru-RU')}
                </div>
              </div>
              <button onClick={() => remove(f.id)}
                className="shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <Icon name="Trash2" size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Files;
