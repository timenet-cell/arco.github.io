# ARCO – Collectivo Criativo · site

Site estático (GitHub Pages) + Supabase para os conteúdos e a admin.

- Site: `index.html`, `artistas.html`, `artista.html?a=<slug>`, `agenda.html`, `social.html`, `contacto.html`
- Admin: `admin/` (login Supabase; só entra quem estiver em `public.admins`)
- `arco-config.js` — único sítio com o URL e a chave **anon** do Supabase (site e admin usam o mesmo)
- `arco.js` — lê a base e preenche o site. **Reserva:** se a base não responder (sem config, erro ou mais de 8 s) o site mostra o conteúdo embutido no HTML.
- `supabase/001_arco.sql` — tabelas, regras de segurança (RLS), bucket de ficheiros

## Ligar ao Supabase (falta fazer)

1. Supabase → **SQL Editor → New query** → colar `supabase/001_arco.sql` → **Run** (deve dar «Success»).
2. **Authentication → Users → Add user** → o teu email (convite, ou password com «Auto confirm»).
3. No SQL Editor, correr a linha final do ficheiro com o teu email:
   `insert into public.admins (user_id) select id from auth.users where email = '…';`
4. **Project Settings → API** → copiar **Project URL** e chave **anon public** para `arco-config.js`.
5. Commit + Push. Testar em `/admin/`.

Antes de ligar, a admin abre em **modo demonstração** (dados de exemplo, nada é gravado).

## Notas

- Fotos: versão web até ~500 KB para mostrar; alta resolução até 25 MB para descarregar (ou link externo).
- Instagram: por agora os posts são adicionados na admin. A sincronização automática fica para uma Edge Function do Supabase (a fazer).
- Formulário de contacto: grava em `messages`; aparece em Admin → Mensagens.
