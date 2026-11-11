// ARCO · ligação ao Supabase (um só sítio para o site e para a admin).
// Supabase → Project Settings → API: copiar "Project URL" e a chave "anon public".
// A chave anon é pública por natureza: a segurança está nas regras (RLS) da base, não aqui.
window.ARCO_CONFIG = {
  SUPABASE_URL: '',   // ex.: 'https://xxxxxxxx.supabase.co'
  SUPABASE_KEY: '',   // chave anon public
};
