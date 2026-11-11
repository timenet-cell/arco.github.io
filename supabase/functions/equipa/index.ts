// ARCO · função "equipa": o gestor convida, altera e remove utilizadores (máx. 10).
// Corre no Supabase com a chave de serviço; a página nunca a vê.
// Cada pedido confirma primeiro que quem chama é gestor.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGINS = ['https://timenet-cell.github.io'];
const REDIRECT = 'https://timenet-cell.github.io/arco.github.io/admin/';
const MAX = 10;

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const H = cors(req.headers.get('Origin'));
  const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...H, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: H });
  if (req.method !== 'POST') return out({ error: 'Método não permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // quem chama?
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: who } = await admin.auth.getUser(jwt);
  if (!who?.user) return out({ error: 'Sessão inválida' }, 401);
  const { data: me } = await admin.from('members').select('role').eq('user_id', who.user.id).maybeSingle();
  if (me?.role !== 'gestor') return out({ error: 'Só o gestor pode gerir a equipa' }, 403);

  let p: Record<string, unknown> = {};
  try { p = await req.json(); } catch { return out({ error: 'Pedido inválido' }, 400); }
  const action = String(p.action || '');

  try {
    if (action === 'list') {
      const { data: rows, error } = await admin.from('members').select('user_id, email, role, artist_id, created_at').order('created_at');
      if (error) throw error;
      const list = await Promise.all((rows || []).map(async (r) => {
        const { data } = await admin.auth.admin.getUserById(r.user_id);
        const u = data?.user;
        return { ...r, email: u?.email || r.email, last_sign_in_at: u?.last_sign_in_at || null, confirmed: !!(u?.email_confirmed_at || u?.last_sign_in_at) };
      }));
      return out({ members: list, max: MAX });
    }

    if (action === 'invite') {
      const email = String(p.email || '').trim().toLowerCase();
      const role = p.role === 'gestor' ? 'gestor' : 'artista';
      const artist_id = role === 'artista' ? String(p.artist_id || '') : null;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out({ error: 'Email inválido' }, 400);
      if (role === 'artista' && !artist_id) return out({ error: 'Escolha o artista' }, 400);
      const { count } = await admin.from('members').select('user_id', { count: 'exact', head: true });
      if ((count || 0) >= MAX) return out({ error: 'Limite de ' + MAX + ' utilizadores atingido' }, 400);
      if (artist_id) {
        const { data: taken } = await admin.from('members').select('user_id').eq('artist_id', artist_id).maybeSingle();
        if (taken) return out({ error: 'Esse artista já tem utilizador' }, 400);
      }
      const { data: inv, error: e1 } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: REDIRECT });
      if (e1) return out({ error: /already/i.test(e1.message) ? 'Esse email já tem conta' : e1.message }, 400);
      const { error: e2 } = await admin.from('members').insert({ user_id: inv.user.id, email, role, artist_id });
      if (e2) { await admin.auth.admin.deleteUser(inv.user.id); throw e2; } // sem membro, não fica conta solta
      return out({ ok: true });
    }

    if (action === 'update') {
      const user_id = String(p.user_id || '');
      const role = p.role === 'gestor' ? 'gestor' : 'artista';
      const artist_id = role === 'artista' ? String(p.artist_id || '') : null;
      if (role === 'artista' && !artist_id) return out({ error: 'Escolha o artista' }, 400);
      if (user_id === who.user.id && role !== 'gestor') return out({ error: 'Não pode tirar a si próprio o papel de gestor' }, 400);
      const { error } = await admin.from('members').update({ role, artist_id }).eq('user_id', user_id);
      if (error) throw error;
      return out({ ok: true });
    }

    if (action === 'remove') {
      const user_id = String(p.user_id || '');
      if (user_id === who.user.id) return out({ error: 'Não pode remover-se a si próprio' }, 400);
      const { error } = await admin.auth.admin.deleteUser(user_id); // apaga também a linha em members (cascade)
      if (error) throw error;
      return out({ ok: true });
    }

    if (action === 'resend') {
      const user_id = String(p.user_id || '');
      const { data } = await admin.auth.admin.getUserById(user_id);
      if (!data?.user?.email) return out({ error: 'Utilizador não encontrado' }, 404);
      const { error } = await admin.auth.resetPasswordForEmail(data.user.email, { redirectTo: REDIRECT });
      if (error) throw error;
      return out({ ok: true });
    }

    return out({ error: 'Acção desconhecida' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message || e);
    return out({ error: /duplicate key/i.test(msg) ? 'Esse artista já tem utilizador' : msg }, 400);
  }
});
