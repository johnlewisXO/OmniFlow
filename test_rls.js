const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://sqzjlxayhghoxjloaddo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxempseGF5aGdob3hqbG9hZGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA0NDQ4MDksImV4cCI6MjA2NjAyMDgwOX0.80rrMJ7AC-XrcUNozIlMa1kh8SFnKagakG_4XOwVbTY');

async function check() {
  const { data, error } = await supabase.rpc('get_schema_info', { table_name: 'notifications' });
  
  if (error) {
    console.log('RPC Error:', error);
    // Fallback: try to insert an empty row to get the next error
    const { error: insertError } = await supabase.from('notifications').insert({});
    console.log('Insert Error:', insertError);
  } else {
    console.log('Schema:', data);
  }
}
check();