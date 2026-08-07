/**
 * src/types/database.ts
 *
 * Supabase-generated Database type stub.
 *
 * HOW TO REGENERATE:
 *   Once you have your Supabase project set up, replace this file by running:
 *
 *     npx supabase gen types typescript \
 *       --project-id <YOUR_PROJECT_ID> \
 *       --schema public \
 *       > src/types/database.ts
 *
 *   Or via the Supabase dashboard:
 *     Settings → API → "Generate TypeScript types"
 *
 * Until then, this stub satisfies the generic type parameter in createClient<Database>().
 */

export type Database = {
  public: {
    Tables: {
      hackathons: {
        Row: {
          id: string;
          title: string;
          source_site: string;
          source_url: string;
          mode: string | null;
          prize_pool: string | null;
          team_size: string | null;
          banner_url: string | null;
          tags: string[] | null;
          ai_summary: string | null;
          registration_start: string | null;
          registration_end: string;
          rounds: unknown;
          venue_name: string | null;
          venue_city: string | null;
          venue_state: string | null;
          scraped_at: string;
          updated_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          source_site: string;
          source_url: string;
          mode?: string | null;
          prize_pool?: string | null;
          team_size?: string | null;
          banner_url?: string | null;
          tags?: string[] | null;
          ai_summary?: string | null;
          registration_start?: string | null;
          registration_end: string;
          rounds?: unknown;
          venue_name?: string | null;
          venue_city?: string | null;
          venue_state?: string | null;
          scraped_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          title?: string;
          source_site?: string;
          source_url?: string;
          mode?: string | null;
          prize_pool?: string | null;
          team_size?: string | null;
          banner_url?: string | null;
          tags?: string[] | null;
          ai_summary?: string | null;
          registration_start?: string | null;
          registration_end?: string;
          rounds?: unknown;
          venue_name?: string | null;
          venue_city?: string | null;
          venue_state?: string | null;
          scraped_at?: string;
          updated_at?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      expire_old_hackathons: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
