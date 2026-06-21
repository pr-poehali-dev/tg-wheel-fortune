CREATE TABLE IF NOT EXISTS upload_sessions (
    session_id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    total_chunks INT NOT NULL,
    description TEXT DEFAULT '',
    prefix TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upload_chunk_keys (
    session_id TEXT NOT NULL,
    chunk_index INT NOT NULL,
    s3_key TEXT NOT NULL,
    PRIMARY KEY (session_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS project_files (
    id SERIAL PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT DEFAULT 0,
    cdn_url TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT now()
);