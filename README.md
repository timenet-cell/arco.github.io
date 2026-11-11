# ARCO – Collectivo Criativo · site

Site estático (GitHub Pages) + Supabase para os conteúdos e a admin.

- Site: `index.html`, `artistas.html`, `artista.html?a=<slug>`, `agenda.html`, `social.html`, `contacto.html`
- Admin: `admin/` (login Supabase; só entra quem estiver em `public.admins`)
- `arco-config.js` — único sítio com o URL e a chave **anon** do Supabase (site e admin usam o mesmo)
- `arco.js` — lê a base e preenche o site. **Reserva:** se a base não responder (sem config, erro ou mais de 8 s) o site mostra o conteúdo embutido no HTML.
- `supabase/001_arco.sql` — tabelas, regras de segurança (RLS), bucket de ficheiros

## Supabase (projecto ARCO, conta própria)

Já feito: `001_arco.sql` + `002_equipa.sql` corridos, função `equipa` publicada (código em `supabase/functions/equipa`), URLs de autenticação apontadas para `/admin/`, `arco-config.js` preenchido.

- Papéis: **gestor** (tudo + Equipa) e **artista** (só o seu presskit e as suas datas). Máx. 10 utilizadores (trava na base e na função).
- Convites: Admin → Equipa. A pessoa recebe email, escolhe a password e entra.
- Esqueceu a password: botão no ecrã de entrada.

## Notas

- Fotos: versão web até ~500 KB para mostrar; alta resolução até 25 MB para descarregar (ou link externo).
- Instagram: por agora os posts são adicionados na admin. A sincronização automática fica para uma Edge Function do Supabase (a fazer).
- Formulário de contacto: grava em `messages`; aparece em Admin → Mensagens.
