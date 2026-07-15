import { createClient as createBrowserClient } from '@supabase/supabase-js';

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          artist: string | null;
          status: string;
          description: string | null;
          bpm: number | null;
          key: string | null;
          genre: string | null;
          mood: string | null;
          tags: string[];
          cover_image: string | null;
          local_data: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          artist?: string | null;
          status?: string;
          description?: string | null;
          bpm?: number | null;
          key?: string | null;
          genre?: string | null;
          mood?: string | null;
          tags?: string[];
          cover_image?: string | null;
          local_data?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          artist?: string | null;
          status?: string;
          description?: string | null;
          bpm?: number | null;
          key?: string | null;
          genre?: string | null;
          mood?: string | null;
          tags?: string[];
          cover_image?: string | null;
          local_data?: Record<string, unknown> | null;
          updated_at?: string;
        };
      };
      ideas: {
        Row: {
          id: string;
          user_id: string | null;
          project_id: string | null;
          content: string;
          type: string;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          content: string;
          type?: string;
          tags?: string[];
          created_at?: string;
        };
        Update: {
          content?: string;
          type?: string;
          tags?: string[];
        };
      };
      beats: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          duration: string | null;
          storage_path: string | null;
          bpm: number | null;
          key: string | null;
          tags: string[];
          date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          duration?: string | null;
          storage_path?: string | null;
          bpm?: number | null;
          key?: string | null;
          tags?: string[];
          date?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          duration?: string | null;
          storage_path?: string | null;
          bpm?: number | null;
          key?: string | null;
          tags?: string[];
        };
      };
      recording_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          project_id: string | null;
          beat_id: string | null;
          name: string | null;
          duration: number | null;
          storage_path: string | null;
          transcription: string | null;
          is_loop_session: boolean;
          loop_start: number | null;
          loop_end: number | null;
          beat_offset: number | null;
          bpm: number | null;
          sections: unknown[];
          lines: unknown[];
          timestamp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          beat_id?: string | null;
          name?: string | null;
          duration?: number | null;
          storage_path?: string | null;
          transcription?: string | null;
          is_loop_session?: boolean;
          loop_start?: number | null;
          loop_end?: number | null;
          beat_offset?: number | null;
          bpm?: number | null;
          sections?: unknown[];
          lines?: unknown[];
          timestamp?: string;
          created_at?: string;
        };
        Update: {
          name?: string | null;
          transcription?: string | null;
          sections?: unknown[];
          lines?: unknown[];
        };
      };
      beta_waitlist: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          how_heard: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          how_heard?: string | null;
          created_at?: string;
        };
        Update: never;
      };
    };
  };
};

// Legacy browser client — kept for backwards compat with existing imports
// Prefer the createClient() helpers in src/lib/supabase/client.ts and server.ts
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
) as ReturnType<typeof createBrowserClient> & { from: (table: string) => unknown };

export const db = supabase;
