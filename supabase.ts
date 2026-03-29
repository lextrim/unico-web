import { createClient } from '@supabase/supabase-js';

// Reemplaza con tus datos de Supabase (Project Settings > API)
const supabaseUrl = 'https://qsdxnwpgyvhttceizica.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZHhud3BneXZodHRjZWl6aWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMjgwMjAsImV4cCI6MjA4NDkwNDAyMH0.x8U-7ISr-Nbuir8pR6wtm99QNKPcU22aA9JpjBnbulc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);