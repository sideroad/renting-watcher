import { createClient } from '@supabase/supabase-js';
import { Property } from './types';
import { getSupabaseUrl, getSupabaseAnonKey } from './config';

export class Database {
  private supabase;

  constructor() {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration is missing');
    }
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  async initializeDatabase() {
    const { error } = await this.supabase.from('properties').select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log('Table does not exist, it should be created in Supabase dashboard');
    }
  }

  async getExistingPropertyIds(): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('properties')
      .select('id');

    if (error) {
      console.error('Error fetching existing properties:', error);
      return new Set();
    }

    return new Set(data?.map(p => p.id) || []);
  }

  async saveNewProperties(properties: Property[]): Promise<Property[]> {
    if (properties.length === 0) return [];

    const now = new Date().toISOString();
    const propertiesWithTimestamp = properties.map(p => ({
      ...p,
      created_at: now,
      first_seen_at: now
    }));

    const { data, error } = await this.supabase
      .from('properties')
      .insert(propertiesWithTimestamp)
      .select();

    if (error) {
      console.error('Error saving properties:', error);
      return [];
    }

    return data || [];
  }

  async findNewProperties(properties: Property[]): Promise<Property[]> {
    const existingIds = await this.getExistingPropertyIds();
    return properties.filter(p => !existingIds.has(p.id));
  }
}