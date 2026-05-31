import { createClient } from '@supabase/supabase-js';
import { getIsAPK } from './utils/platform';

// Reemplaza con tus datos de Supabase (Project Settings > API)
const supabaseUrl = 'https://qsdxnwpgyvhttceizica.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZHhud3BneXZodHRjZWl6aWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMjgwMjAsImV4cCI6MjA4NDkwNDAyMH0.x8U-7ISr-Nbuir8pR6wtm99QNKPcU22aA9JpjBnbulc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function logActivity(
  userEmail: string,
  event: 'login' | 'logout',
  details?: Record<string, unknown>
) {
  const isAPK = getIsAPK();
  const { error } = await supabase.from('unico_activity_log').insert({
    user_email: userEmail,
    event,
    details: {
      platform: isAPK ? 'apk' : 'web',
      user_agent: navigator.userAgent.substring(0, 200),
      ...details,
    },
  });
  if (error) console.error('[activity]', error);
}