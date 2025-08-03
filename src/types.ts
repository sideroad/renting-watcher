export interface Property {
  id: string;
  url: string;
  title: string;
  price: string;
  address: string;
  layout: string;
  area: string;
  building_type: string;
  access: string[];
  created_at?: Date;
  first_seen_at?: Date;
}