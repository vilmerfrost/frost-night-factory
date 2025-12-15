// agent-runner/lib/supabase.types.ts
/**
 * Supabase Database Type Definitions
 * 
 * Provides type safety for Supabase client operations
 */

export type Database = {
  public: {
    Tables: {
      error_events: {
        Row: {
          id: string;
          pipeline_id: string;
          phase: string;
          error_message: string;
          error_type: string;
          file_path: string;
          created_at: string;
        };
        Insert: {
          pipeline_id: string;
          phase: string;
          error_message: string;
          error_type: string;
          file_path: string;
        };
        Update: Partial<{
          pipeline_id: string;
          phase: string;
          error_message: string;
          error_type: string;
          file_path: string;
        }>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
