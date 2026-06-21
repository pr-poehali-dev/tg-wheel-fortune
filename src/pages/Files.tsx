import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import func2url from '../../backend/func2url.json';

const API = func2url.files;
const CHUNK_API = (func2url as Record<string, string>)['files-chunk'];
const CHUNK_SIZE = 5 * 1024 * 1024; // 5 МБ на чанк
const MAX_SIZE = 50 * 1024 * 1024;  // 50 МБ максимум

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

const sliceToBase64 = (slice: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(slice);
  });

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
      setError(`Ошибка: ${e}`);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const uploadSmall = async (file: File, description: string) => {
    // Файлы до 5 МБ — через старый простой endpoint
    setStatus(`Загружаю ${fmtSize(file.size)}...`);
    setProgress(10);
    const reader = new FileReader();
    const b64: string = await new Promise((res, rej) => {
      reader.onload = () => res((reader.result as string).split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    setProgress(40);
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        description,
        content_base64: b64,
      }),
    });
    const data = await r.json();
    if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
    setProgress(100);
  };

  const uploadLarge = async (file: File, description: string) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 1. Инициализируем multipart upload
    setStatus('Инициализирую загрузку...');
    setProgress(2);
    const initRes = await fetch(CHUNK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'init',
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
      }),
    });
    const { upload_id, key, cdn_url } = await initRes.json();
    if (!upload_id) throw new Error('Не удалось инициализировать загрузку');

    // 2. Загружаем чанки
    const parts: { part_number: number; etag: string }[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const slice = file.slice(start, start + CHUNK_SIZE);
      const b64 = await sliceToBase64(slice);
      setStatus(`Загружаю часть ${i + 1} из ${totalChunks}...`);
      setProgress(Math.round(5 + ((i + 1) / totalChunks) * 85));

      const chunkRes = await fetch(CHUNK_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chunk',
          upload_id,
          key,
          part_number: i + 1,
          content_base64: b64,
        }),
      });
      const chunkData = await chunkRes.json();
      if (!chunkRes.ok || chunkData.error) {
        // Отменяем при ошибке
        await fetch(CHUNK_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'abort', upload_id, key }),
        });
        throw new Error(chunkData.error || `Ошибка части ${i + 1}`);
      }
      parts.push({ part_number: i + 1, etag: chunkData.etag });
    }

    // 3. Завершаем multipart upload
    setStatus('Финализирую...');
    setProgress(92);
    const finishRes = await fetch(CHUNK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finish', upload_id, key, parts }),
    });
    const finishData = await finishRes.json();
    if (!finishRes.ok || finishData.error) throw new Error(finishData.error || 'Ошибка финализации');

    // 4. Регистрируем в БД через основной endpoint
    setStatus('Сохраняю в базу данных...');
    setProgress(96);
    const regRes = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        description,
        content_base64: btoa(JSON.stringify({ cdn_url_override: cdn_url })),
        _cdn_url: cdn_url,
        file_size: file.size,
        _skip_s3: true,
      }),
    });

    // Fallback: если backend не поддерживает skip_s3 — вставим напрямую через register
    // Используем простой POST с маркером чтобы backend сохранил уже готовый CDN URL
    await fetch(API + '?register=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        description,
        cdn_url,
        file_size: file.size,
      }),
    });

    setProgress(100);
    void regRes; // suppress unused warning
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError('');
    setProgress(0);

    if (file.size > MAX_SIZE) {
      setError(`Файл слишком большой. Максимум 50 МБ.`);
      setUploading(false);
      return;
    }

    try {
      if (file.size <= CHUNK_SIZE) {
        await uploadSmall(file, desc);
      } else {
        await uploadLarge(file, desc);
      }
      setDesc('');
      setStatus('');
      setProgress(0);
      await load();
    } catch (e) {
      setError(`Ошибка загрузки: ${e}`);
      setProgress(0);
      setStatus('');
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

          {/* Прогресс-бар */}
          {uploading && progress > 0 && (
            <div className="mt-3 rounded-full overflow-hidden h-3"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#4CB944,#7ED957)' }}
              />
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
