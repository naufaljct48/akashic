import type { ComicType, ComicStatus, ComicFormat } from './comic';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      comics: {
        Row: {
          id: string;
          source_id: number;
          id_mal: number | null;
          slug: string;
          title_romaji: string;
          title_english: string | null;
          title_native: string | null;
          synonyms: string[];
          type: ComicType;
          format: ComicFormat;
          status: ComicStatus;
          synopsis: string | null;
          genres: string[];
          tags: string[];
          total_chapters: number | null;
          release_year: number | null;
          average_score: number | null;
          popularity: number | null;
          cover_image_url: string | null;
          banner_image_url: string | null;
          country_of_origin: string;
          site_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['comics']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['comics']['Insert']>;
      };
      comic_embeddings: {
        Row: {
          id: string;
          comic_id: string;
          content_text: string;
          embedding: string; // vector representation
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['comic_embeddings']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['comic_embeddings']['Insert']>;
      };
      user_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          comic_id: string;
          status: 'FAVORITE' | 'READING' | 'PLAN_TO_READ' | 'COMPLETED';
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_bookmarks']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_bookmarks']['Insert']>;
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          guest_ip: string | null;
          title: string;
          messages: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chat_sessions']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['chat_sessions']['Insert']>;
      };
      rate_limits: {
        Row: {
          id: string;
          identifier: string;
          request_date: string;
          prompt_count: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rate_limits']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['rate_limits']['Insert']>;
      };
    };
    Functions: {
      match_comics_hybrid: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          filter_type?: ComicType | null;
          filter_status?: ComicStatus | null;
          filter_genres?: string[] | null;
        };
        Returns: Array<{
          id: string;
          source_id: number;
          id_mal: number | null;
          slug: string;
          title_romaji: string;
          title_english: string | null;
          type: ComicType;
          status: ComicStatus;
          genres: string[];
          tags: string[];
          synopsis: string | null;
          cover_image_url: string | null;
          banner_image_url: string | null;
          average_score: number | null;
          total_chapters: number | null;
          release_year: number | null;
          similarity: number;
        }>;
      };
    };
  };
}
