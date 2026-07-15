-- ============================================================
-- Lyriq Lab — Supabase Schema Migration
-- Run this in the Supabase SQL Editor (Project: ebomfglluqwogdvlwice)
-- ============================================================

-- 1. PROJECTS TABLE (update existing, add missing columns)
-- ============================================================

ALTER TABLE IF EXISTS projects
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS artist TEXT,
  ADD COLUMN IF NOT EXISTS bpm INTEGER,
  ADD COLUMN IF NOT EXISTS key TEXT,
  ADD COLUMN IF NOT EXISTS genre TEXT,
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_image TEXT,
  ADD COLUMN IF NOT EXISTS local_data JSONB;

-- If the projects table doesn't exist yet, create it fresh:
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT,
  bpm INTEGER,
  key TEXT,
  genre TEXT,
  mood TEXT,
  tags TEXT[] DEFAULT '{}',
  cover_image TEXT,
  local_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. IDEAS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'lyric',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BEATS TABLE (metadata only — audio stays in Storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS beats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration TEXT,
  storage_path TEXT,
  bpm INTEGER,
  key TEXT,
  tags TEXT[] DEFAULT '{}',
  date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. RECORDING_SESSIONS TABLE (metadata only — audio stays in Storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS recording_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  beat_id UUID REFERENCES beats(id) ON DELETE SET NULL,
  name TEXT,
  duration REAL,
  storage_path TEXT,
  transcription TEXT,
  is_loop_session BOOLEAN DEFAULT FALSE,
  loop_start REAL,
  loop_end REAL,
  beat_offset REAL,
  bpm INTEGER,
  sections JSONB DEFAULT '[]',
  lines JSONB DEFAULT '[]',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BETA_WAITLIST TABLE (for private beta signups)
-- ============================================================
CREATE TABLE IF NOT EXISTS beta_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  how_heard TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own projects" ON projects;
CREATE POLICY "Users see own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Ideas
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own ideas" ON ideas;
CREATE POLICY "Users see own ideas" ON ideas
  FOR ALL USING (auth.uid() = user_id);

-- Beats
ALTER TABLE beats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own beats" ON beats;
CREATE POLICY "Users see own beats" ON beats
  FOR ALL USING (auth.uid() = user_id);

-- Recording Sessions
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own sessions" ON recording_sessions;
CREATE POLICY "Users see own sessions" ON recording_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Beta Waitlist (anyone can insert, no one can read others)
ALTER TABLE beta_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join waitlist" ON beta_waitlist;
CREATE POLICY "Anyone can join waitlist" ON beta_waitlist
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

-- Create audio bucket (run in Supabase Storage UI or via this SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio',
  false,
  52428800, -- 50MB per file
  ARRAY['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access their own audio files
CREATE POLICY "Users manage own audio" ON storage.objects
  FOR ALL USING (
    bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create muse-uploads bucket (Muse session audio recordings)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'muse-uploads',
  'muse-uploads',
  false,
  52428800, -- 50MB per file
  ARRAY['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access their own muse audio uploads
CREATE POLICY "Users manage own muse uploads" ON storage.objects
  FOR ALL USING (
    bucket_id = 'muse-uploads' AND auth.uid()::text = (storage.foldername(name))[1]
  );
