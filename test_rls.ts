import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sqzjlxayhghoxjloaddo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxempseGF5aGdob3hqbG9hZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NDQ4MDksImV4cCI6MjA2NjAyMDgwOX0.80rrMJ7AC-XrcUNozIlMa1kh8SFnKagakG_4XOwVbTY');

async function check() {
  const { data, error } = await supabase.from('notifications').select('*').limit(1);
  console.log('Select Data:', data);
  console.log('Select Error:', error);
}
check();