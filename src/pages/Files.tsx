import { useEffect, useRef, useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import func2url from '../../backend/func2url.json';

const API = func2url.files;
const CHUNK_API = func2url.filechunk;
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

interface UploadTask {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
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

const postJSON = async (url: string, data: object) => {
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
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputFilesRef = useRef<HTMLInputElement>(null);
  const inputFolderRef = useRef<HTMLInputElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  const log = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('ru-RU');
    setLogs(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 200));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    log('Загружаю список файлов...');
    try {
      const r = await fetch(API);
      const d = await r.json();
      setFiles(d.files || []);
      log(`Загружено ${(d.files || []).length} файлов`);
    } catch (e) {
      log(`ОШИБКА загрузки списка: ${e}`);
    }
    setLoading(false);
  }, [log]);

  useEffect(() => { load(); }, [load]);

  const uploadOne = useCallback(async (file: File, taskId: string) => {
    const updateTask = (patch: Partial<UploadTask>) =>
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));

    if (file.size > MAX_SIZE) {
      const msg = `${file.name}: превышен лимит 50 МБ (${fmtSize(file.size)})`;
      updateTask({ status: 'error', error: msg });
      log(`ОШИБКА: ${msg}`);
      return;
    }

    updateTask({ status: 'uploading', progress: 2 });
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    log(`Начинаю загрузку: ${file.name} (${fmtSize(file.size)}, ${totalChunks} частей)`);

    try {
      const { session_id } = await postJSON(CHUNK_API, {
        action: 'init',
        file_name: file.webkitRelativePath || file.name,
        file_type: file.type || 'application/octet-stream',
        total_chunks: totalChunks,
      });
      log(`${file.name}: сессия создана ${session_id.slice(0, 8)}...`);

      for (let i = 0; i < totalChunks; i++) {
        const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const b64 = await sliceToBase64(slice);
        await postJSON(CHUNK_API, { action: 'chunk', session_id, chunk_index: i, content_base64: b64 });
        const pct = 5 + Math.round(((i + 1) / totalChunks) * 85);
        updateTask({ progress: pct });
        log(`${file.name}: часть ${i + 1}/${totalChunks} отправлена`);
      }

      log(`${file.name}: финализирую...`);
      updateTask({ progress: 93 });
      await postJSON(CHUNK_API, { action: 'finish', session_id, file_size: file.size });
      updateTask({ status: 'done', progress: 100 });
      log(`✓ ${file.name} загружен успешно`);
    } catch (e) {
      const msg = String(e);
      updateTask({ status: 'error', error: msg });
      log(`ОШИБКА ${file.name}: ${msg}`);
    }
  }, [log]);

  const startUpload = useCallback(async (fileList: File[]) => {
    if (!fileList.length) return;
    const newTasks: UploadTask[] = fileList.map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.webkitRelativePath || f.name,
      size: f.size,
      status: 'pending',
      progress: 0,
    }));
    setTasks(prev => [...newTasks, ...prev]);
    setShowLogs(true);
    log(`Добавлено файлов в очередь: ${fileList.length}`);

    // Загружаем по одному последовательно
    for (let i = 0; i < fileList.length; i++) {
      await uploadOne(fileList[i], newTasks[i].id);
    }
    await load();
  }, [uploadOne, load, log]);

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    startUpload(files);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) startUpload(files);
  }, [startUpload]);

  const remove = async (id: number) => {
    log(`Удаляю файл id=${id}`);
    await fetch(`${API}?id=${id}`, { method: 'DELETE' });
    await load();
  };

  const busyCount = tasks.filter(t => t.status === 'uploading' || t.status === 'pending').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const errCount = tasks.filter(t => t.status === 'error').length;

  return (
    <div className="min-h-screen wheel-bg flex justify-center relative">
      <div className="w-full max-w-2xl px-4 py-6 pb-24">
        <header className="flex items-center gap-3 mb-2">
          <Icon name="FolderOpen" size={30} className="text-white" />
          <h1 className="game-title text-3xl font-black text-white">Файлообменник</h1>
        </header>
        <p className="text-white/70 text-sm mb-4">До 50 МБ на файл. Поддержка папок и множественного выбора.</p>

        {/* Зона перетаскивания */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="rounded-2xl p-5 mb-4 transition-all"
          style={{
            background: dragging ? 'rgba(76,185,68,0.25)' : 'rgba(0,0,0,0.15)',
            border: `2px dashed ${dragging ? '#4CB944' : 'rgba(255,255,255,0.3)'}`,
          }}
        >
          <div className="flex flex-col items-center gap-3 mb-4 text-white/80">
            <Icon name="CloudUpload" size={40} className={dragging ? 'text-[#4CB944]' : 'text-white/60'} />
            <p className="text-sm font-semibold text-center">
              {dragging ? 'Отпустите файлы' : 'Перетащите файлы или папку сюда'}
            </p>
          </div>

          {/* Скрытые инпуты */}
          <input ref={inputFilesRef} type="file" multiple className="hidden" onChange={onFilesChange} />
          <input
            ref={inputFolderRef} type="file" className="hidden" onChange={onFilesChange}
            // @ts-expect-error non-standard
            webkitdirectory="true" directory="true"
          />

          <div className="flex gap-2">
            <button
              onClick={() => inputFilesRef.current?.click()}
              disabled={busyCount > 0}
              className="game-tile flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              <Icon name="Files" size={18} />
              Файлы
            </button>
            <button
              onClick={() => inputFolderRef.current?.click()}
              disabled={busyCount > 0}
              className="game-tile flex-1 flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              <Icon name="FolderUp" size={18} />
              Папку
            </button>
          </div>
        </div>

        {/* Очередь задач */}
        {tasks.length > 0 && (
          <div className="rounded-2xl mb-4 overflow-hidden"
            style={{ background: 'rgba(0,0,0,0.2)', border: '2px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <span className="text-white font-bold text-sm">
                Очередь: {doneCount}✓ {errCount > 0 ? `${errCount}✗` : ''} {busyCount > 0 ? `${busyCount} загружается` : ''}
              </span>
              <button onClick={() => setTasks([])} className="text-white/50 hover:text-white text-xs">очистить</button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {tasks.map(t => (
                <div key={t.id} className="px-4 py-2 border-b border-white/5 flex items-center gap-3">
                  <div className="shrink-0">
                    {t.status === 'done' && <span className="text-[#4CB944] text-lg">✓</span>}
                    {t.status === 'error' && <span className="text-red-400 text-lg">✗</span>}
                    {t.status === 'uploading' && <Icon name="Loader" size={16} className="text-white animate-spin" />}
                    {t.status === 'pending' && <Icon name="Clock" size={16} className="text-white/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{t.name}</p>
                    {t.status === 'uploading' && (
                      <div className="mt-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${t.progress}%`, background: 'linear-gradient(90deg,#4CB944,#7ED957)' }} />
                      </div>
                    )}
                    {t.status === 'error' && <p className="text-red-300 text-xs truncate">{t.error}</p>}
                  </div>
                  <span className="text-white/40 text-xs shrink-0">{fmtSize(t.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Список загруженных файлов */}
        <div className="flex flex-col gap-2">
          {loading && <p className="text-white/60 text-center py-4 text-sm">Загрузка...</p>}
          {!loading && files.length === 0 && (
            <p className="text-white/60 text-center py-8 text-sm">Нет загруженных файлов</p>
          )}
          {files.map(f => (
            <div key={f.id} className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.92)' }}>
              <Icon name="FileArchive" size={26} className="text-[#3568c6] shrink-0" />
              <div className="flex-1 min-w-0">
                <a href={f.cdn_url} target="_blank" rel="noreferrer"
                  className="block font-bold text-[#244a96] truncate text-sm hover:underline">
                  {f.file_name}
                </a>
                <div className="text-xs text-gray-400">
                  {fmtSize(f.file_size)}{f.description ? ` · ${f.description}` : ''} · {new Date(f.created_at).toLocaleString('ru-RU')}
                </div>
              </div>
              <button onClick={() => remove(f.id)} className="shrink-0 p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                <Icon name="Trash2" size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Кнопка логов — фиксированная в углу */}
      <button
        onClick={() => setShowLogs(v => !v)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-white text-xs shadow-lg"
        style={{ background: showLogs ? '#244a96' : 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.3)' }}
      >
        <Icon name="Terminal" size={16} />
        Логи {logs.length > 0 && `(${logs.length})`}
      </button>

      {/* Окно логов */}
      {showLogs && (
        <div
          ref={logsRef}
          className="fixed bottom-14 right-4 z-50 rounded-xl overflow-hidden shadow-2xl"
          style={{ width: 360, maxHeight: 280, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(10,20,50,0.97)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-white/80 text-xs font-bold flex items-center gap-1">
              <Icon name="Terminal" size={13} /> Логи загрузки
            </span>
            <button onClick={() => setLogs([])} className="text-white/40 hover:text-white text-xs">очистить</button>
          </div>
          <div className="overflow-y-auto p-2 flex flex-col gap-0.5" style={{ maxHeight: 230 }}>
            {logs.length === 0 && <p className="text-white/30 text-xs p-2">Лог пуст</p>}
            {logs.map((l, i) => (
              <p key={i} className="text-xs font-mono px-1 py-0.5 rounded"
                style={{
                  color: l.includes('ОШИБКА') ? '#ff6b6b' : l.includes('✓') ? '#4CB944' : 'rgba(255,255,255,0.7)',
                  background: l.includes('ОШИБКА') ? 'rgba(255,0,0,0.08)' : 'transparent',
                }}>
                {l}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Files;
