import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sqzjlxayhghoxjloaddo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxempseGF5aGdob3hqbG9hZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NDQ4MDksImV4cCI6MjA2NjAyMDgwOX0.80rrMJ7AC-XrcUNozIlMa1kh8SFnKagakG_4XOwVbTY');

async function check() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'notification_type' });
  console.log('RPC:', data, error);
  
  // Alternative way to get enum values if RPC doesn't exist
  const { data: d2, error: e2 } = await supabase.from('notifications').select('type').limit(1);
  console.log('Select:', d2, e2);
}
check();
