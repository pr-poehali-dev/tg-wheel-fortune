import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/icon';
import func2url from '../../backend/func2url.json';

const API = func2url.files;

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

const Files = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [desc, setDesc] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(API);
      const d = await r.json();
      setFiles(d.files || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          description: desc,
          content_base64: base64,
        }),
      });
      setDesc('');
      await load();
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
  };

  const remove = async (id: number) => {
    await fetch(`${API}?id=${id}`, { method: 'DELETE' });
    await load();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen wheel-bg flex justify-center">
      <div className="w-full max-w-2xl px-4 py-6">
        <header className="flex items-center gap-3 mb-5">
          <Icon name="FolderOpen" size={32} className="text-white" />
          <h1 className="game-title text-3xl font-black text-white">Файлообменник</h1>
        </header>

        <p className="text-white/80 text-sm mb-4">
          Загружайте сюда архивы, структуры папок и документы проекта — разработчик сможет их открыть и прочитать.
        </p>

        {/* Загрузка */}
        <div
          className="rounded-2xl p-4 mb-5"
          style={{ background: 'rgba(0,0,0,0.15)', border: '2px solid rgba(255,255,255,0.25)' }}
        >
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Описание файла (необязательно)"
            className="w-full mb-3 rounded-xl px-4 py-3 text-sm font-semibold outline-none"
            style={{ background: 'rgba(255,255,255,0.9)', color: '#244a96' }}
          />
          <input ref={inputRef} type="file" className="hidden" onChange={onFile} />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="game-tile w-full flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <Icon name={uploading ? 'Loader' : 'Upload'} size={22} className={uploading ? 'animate-spin' : ''} />
            {uploading ? 'Загрузка...' : 'Выбрать и загрузить файл'}
          </button>
        </div>

        {/* Список */}
        <div className="flex flex-col gap-2">
          {loading && <p className="text-white/70 text-center py-4">Загрузка...</p>}
          {!loading && files.length === 0 && (
            <p className="text-white/70 text-center py-8">Пока нет загруженных файлов</p>
          )}
          {files.map((f) => (
            <div
              key={f.id}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.92)' }}
            >
              <Icon name="FileText" size={28} className="text-[#3568c6] shrink-0" />
              <div className="flex-1 min-w-0">
                <a
                  href={f.cdn_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block font-bold text-[#244a96] truncate hover:underline"
                >
                  {f.file_name}
                </a>
                <div className="text-xs text-gray-500">
                  {fmtSize(f.file_size)}
                  {f.description ? ` · ${f.description}` : ''}
                </div>
              </div>
              <button onClick={() => remove(f.id)} className="shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg">
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
