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

    // Remove duplicates within the same batch based on ID
    const uniqueProperties = this.removeDuplicateProperties(properties);
    console.log(`Removed ${properties.length - uniqueProperties.length} duplicate properties from batch`);

    const now = new Date().toISOString();
    const propertiesWithTimestamp = uniqueProperties.map(p => ({
      ...p,
      created_at: now,
      first_seen_at: now
    }));

    // Use upsert to handle potential duplicates gracefully
    const { data, error } = await this.supabase
      .from('properties')
      .upsert(propertiesWithTimestamp, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('Error saving properties:', error);
      return [];
    }

    return data || [];
  }

  private removeDuplicateProperties(properties: Property[]): Property[] {
    const uniqueMap = new Map<string, Property>();
    
    for (const property of properties) {
      // Keep the first occurrence of each unique ID
      if (!uniqueMap.has(property.id)) {
        uniqueMap.set(property.id, property);
      } else {
        console.log(`Skipping duplicate property with ID: ${property.id} (${property.title})`);
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  async findNewProperties(properties: Property[]): Promise<Property[]> {
    const existingIds = await this.getExistingPropertyIds();
    return properties.filter(p => !existingIds.has(p.id));
  }

  async deleteAllProperties(): Promise<void> {
    const { error } = await this.supabase
      .from('properties')
      .delete()
      .neq('id', ''); // This condition will match all rows since id cannot be empty
    
    if (error) {
      console.error('Error deleting all properties:', error);
      throw error;
    }
    
    console.log('All properties deleted from database');
  }
}