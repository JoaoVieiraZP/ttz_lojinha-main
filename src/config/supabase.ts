import { createClient, SupabaseClient } from '@supabase/supabase-js';

class DatabaseSingleton {
  private static instance: DatabaseSingleton;
  public client: SupabaseClient;

  private constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL ou Key não encontrados no arquivo .env');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  public static getInstance(): DatabaseSingleton {
    if (!DatabaseSingleton.instance) {
      DatabaseSingleton.instance = new DatabaseSingleton();
    }
    return DatabaseSingleton.instance;
  }
}

export const supabase = DatabaseSingleton.getInstance().client;