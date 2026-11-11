// ARCO · ligação ao Supabase (um só sítio para o site e para a admin).
// Supabase → Project Settings → API: copiar "Project URL" e a chave "anon public".
// A chave anon é pública por natureza: a segurança está nas regras (RLS) da base, não aqui.
window.ARCO_CONFIG = {
  SUPABASE_URL: 'https://cczdxkdtepaekyrvfend.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjemR4a2R0ZXBhZWt5cnZmZW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzODMwMzUsImV4cCI6MjEwOTk1OTAzNX0.kPmA2nL3v9qzMToJupzf6QedudLfL5If1iiackpy05g', // anon public
};
