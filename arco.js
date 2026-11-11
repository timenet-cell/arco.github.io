// ARCO · leitura dos conteúdos do Supabase para o site público.
// Regra de reserva: o HTML já traz conteúdo embutido. Se a base não responder (sem config, sem rede,
// erro ou mais de 8 s), NADA é substituído e o site fica como está.
(function () {
  'use strict';
  var C = window.ARCO_CONFIG || {};
  var sb = null;
  try {
    if (C.SUPABASE_URL && C.SUPABASE_KEY && window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: false } });
    }
  } catch (e) { sb = null; }

  var MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  var MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function safeUrl(u) {
    u = String(u || '').trim();
    return /^(https?:\/\/|mailto:)/i.test(u) ? u : '';
  }
  function within(el, sel) { return (el.matches && el.matches(sel) ? [el] : []).concat($$(sel, el)); }
  function hide(el) { if (el) el.style.display = 'none'; }

  function setImg(el, url) {
    url = safeUrl(url);
    if (!url) return;
    el.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    Array.prototype.slice.call(el.childNodes).forEach(function (n) { if (n.nodeType === 3) n.remove(); });
  }

  // Preenche um elemento clonado com os campos de obj (data-f, data-f-href, data-f-img).
  function fill(el, obj) {
    within(el, '[data-f]').forEach(function (n) {
      var v = obj[n.getAttribute('data-f')];
      if (v == null) return;
      n.textContent = (v ? (n.getAttribute('data-f-prefix') || '') : '') + v;
    });
    within(el, '[data-f-href]').forEach(function (n) {
      var k = n.getAttribute('data-f-href'), v = obj[k];
      if (v == null) return;
      var u = k === 'url' && /^[a-z0-9-]+\.html/.test(v) ? v : safeUrl(v);
      if (u) n.setAttribute('href', u); else hide(n);
    });
    within(el, '[data-f-img]').forEach(function (n) { setImg(n, obj[n.getAttribute('data-f-img')]); });
  }

  // Substitui os itens de uma lista pelos dados. items === null → mantém a reserva.
  function renderList(container, items, emptyText) {
    if (!container || !Array.isArray(items)) return [];
    var tpl = $$(':scope > [data-arco-item]', container)[0];
    if (!tpl) return [];
    var lim = parseInt(container.getAttribute('data-limit') || '0', 10);
    if (lim > 0) items = items.slice(0, lim);
    $$(':scope > [data-arco-item]', container).forEach(function (n) { n.remove(); });
    $$(':scope > [data-arco-empty]', container).forEach(function (n) { n.remove(); });
    var out = items.map(function (it) {
      var c = tpl.cloneNode(true);
      fill(c, it);
      if (it._key != null) c.setAttribute('data-key', it._key);
      container.appendChild(c);
      return c;
    });
    if (!items.length && emptyText) {
      var p = document.createElement(container.tagName === 'UL' ? 'li' : 'p');
      p.setAttribute('data-arco-empty', '');
      p.textContent = emptyText;
      p.style.cssText = 'padding: 18px 0; list-style: none; opacity: .8';
      container.appendChild(p);
    }
    return out;
  }

  // Filtros (chips): reconstrói os botões a partir de labels [{key,label}] e chama onPick(key|null).
  function setupChips(group, labels, onPick) {
    if (!group) return;
    var btns = $$('button', group);
    if (btns.length < 2) return;
    var onCss = btns[0].style.cssText, offCss = btns[1].style.cssText;
    var tpl = btns[1];
    btns.slice(1).forEach(function (b) { b.remove(); });
    var all = [{ key: null, el: btns[0] }];
    labels.forEach(function (l) {
      var b = tpl.cloneNode(true);
      b.textContent = l.label;
      group.appendChild(b);
      all.push({ key: l.key, el: b });
    });
    all.forEach(function (x) {
      x.el.addEventListener('click', function () {
        all.forEach(function (y) {
          var on = y === x;
          y.el.style.cssText = on ? onCss : offCss;
          y.el.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        onPick(x.key);
      });
    });
  }
  function filterItems(items, key) {
    items.forEach(function (n) { n.hidden = key != null && n.getAttribute('data-key') !== key; });
  }

  function embedUrl(u) {
    try {
      var x = new URL(u), h = x.hostname.replace(/^www\./, ''), m;
      if (h === 'youtu.be') return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(x.pathname.slice(1));
      if (h === 'youtube.com' || h === 'm.youtube.com') {
        if (x.searchParams.get('v')) return 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(x.searchParams.get('v'));
        if ((m = x.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/))) return 'https://www.youtube-nocookie.com/embed/' + m[1];
      }
      if (h === 'vimeo.com' && (m = x.pathname.match(/^\/(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
      if (h === 'open.spotify.com' && (m = x.pathname.match(/^\/(track|album|artist|playlist|episode|show)\/(\w+)/))) return 'https://open.spotify.com/embed/' + m[1] + '/' + m[2];
      if (h === 'soundcloud.com') return 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(u) + '&visual=true';
    } catch (e) {}
    return null;
  }
  function setEmbed(el, url) {
    url = safeUrl(url);
    if (!url) { hide(el); return; }
    var src = embedUrl(url);
    el.textContent = '';
    if (src) {
      var f = document.createElement('iframe');
      f.src = src; f.loading = 'lazy'; f.title = 'Leitor';
      f.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      f.style.cssText = 'width: 100%; height: 100%; border: 0; display: block';
      el.style.padding = '0';
      el.appendChild(f);
    } else {
      var a = document.createElement('a');
      a.href = url; a.textContent = 'Abrir ↗'; a.target = '_blank'; a.rel = 'noopener';
      el.appendChild(a);
    }
  }

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms || 8000); })]);
  }
  function q(builder) {
    if (!sb) return Promise.resolve(null);
    return withTimeout(builder).then(function (r) { return r && !r.error && Array.isArray(r.data) ? r.data : null; }, function () { return null; });
  }

  function eventRow(e, artistsById) {
    var d = new Date(e.date + 'T12:00:00'), a = artistsById[e.artist_id] || {};
    return {
      dd: String(d.getDate()).padStart(2, '0'), mm: MESES[d.getMonth()],
      artist: a.name || '', event: e.event_name || '',
      place: [e.venue, e.city].filter(Boolean).join(' · '),
      tickets: e.tickets_url || '', _key: a.slug || '',
      _month: d.getFullYear() + '-' + d.getMonth(), _monthLabel: MESES_LONGOS[d.getMonth()] + ' · ' + d.getFullYear(),
    };
  }

  function applySettings(S) {
    var mail = function (old, nu) {
      if (!nu) return;
      $$('a[href="mailto:' + old + '"]').forEach(function (a) {
        a.setAttribute('href', 'mailto:' + nu);
        if (/^\[/.test(a.textContent.trim()) || a.textContent.indexOf(old) >= 0) a.textContent = nu;
      });
    };
    mail('bookings@arco.pt', S.bookings_email);
    mail('press@arco.pt', S.press_email);
    var handle = (S.instagram_handle || '').replace(/^@/, '').trim();
    var ig = safeUrl(S.instagram_url) || (handle ? 'https://instagram.com/' + encodeURIComponent(handle) + '/' : '');
    if (ig) $$('a[href="https://instagram.com/"]').forEach(function (a) { a.setAttribute('href', ig); });
    if (handle) $$('[data-s="instagram_handle"]').forEach(function (n) { n.textContent = '@' + handle; });
    ['spotify', 'youtube'].forEach(function (k) {
      var u = safeUrl(S[k + '_url']);
      $$('a[href="#' + k + '"]').forEach(function (a) { if (u) a.setAttribute('href', u); });
    });
  }
  // links sem destino (#spotify/#youtube) nunca ficam visíveis, com ou sem base
  function hideDeadLinks() {
    ['spotify', 'youtube'].forEach(function (k) {
      $$('a[href="#' + k + '"]').forEach(function (a) {
        var br = a.nextElementSibling && a.nextElementSibling.tagName === 'BR' ? a.nextElementSibling : a.previousElementSibling && a.previousElementSibling.tagName === 'BR' ? a.previousElementSibling : null;
        hide(a); if (br) br.remove();
      });
    });
  }

  function artistPage(artists, artistsById, events) {
    if (!document.querySelector('[data-p]') || !artists) return;
    var slug = new URLSearchParams(location.search).get('a');
    var A = artists.filter(function (x) { return x.slug === slug; })[0] || (slug ? null : artists[0]);
    if (!A) return;
    document.title = A.name + ' — Presskit — ARCO';
    $$('[data-p]').forEach(function (n) { var v = A[n.getAttribute('data-p')]; if (v != null && v !== '') n.textContent = v; });
    $$('[data-p-img]').forEach(function (n) { setImg(n, A[n.getAttribute('data-p-img')]); });
    $$('[data-p-href]').forEach(function (n) {
      var u = safeUrl(A[n.getAttribute('data-p-href')]);
      if (!u) { hide(n); return; }
      n.setAttribute('href', u); n.setAttribute('target', '_blank'); n.setAttribute('rel', 'noopener');
    });
    $$('[data-p-mail]').forEach(function (n) { var m = A[n.getAttribute('data-p-mail')]; if (m) { n.setAttribute('href', 'mailto:' + m); n.textContent = m; } });
    $$('[data-p-embed]').forEach(function (n) { setEmbed(n, A[n.getAttribute('data-p-embed')]); });
    $$('[data-p-paras]').forEach(function (n) {
      var txt = A[n.getAttribute('data-p-paras')];
      if (!txt) return;
      var tpl = n.querySelector('p');
      n.textContent = '';
      txt.split(/\n\s*\n/).forEach(function (para) { var p = tpl.cloneNode(false); p.textContent = para.trim(); n.appendChild(p); });
    });
    var sectionOf = function (el) { return el && el.closest('section'); };
    var lists = {
      photos: (A.photos || []).filter(function (x) { return x && (x.web || x.hi); }).map(function (x) { return { web: x.web || x.hi, hi: x.hi || x.web, credit: x.credit || '' }; }),
      docs: (A.docs || []).filter(function (x) { return x && x.url; }).map(function (x) { return { label: x.label || 'Documento', meta: x.meta || '', url: x.url }; }),
      links: (A.links || []).filter(function (x) { return x && x.url; }).map(function (x) { return { label: x.label || 'Link', url: x.url }; }),
      'artist-events': (events || []).filter(function (e) { return e.artist_id === A.id; }).map(function (e) { return eventRow(e, artistsById); }),
    };
    Object.keys(lists).forEach(function (k) {
      var c = document.querySelector('[data-arco-list="' + k + '"]');
      if (!c) return;
      if (!lists[k].length && k !== 'artist-events') { var s = sectionOf(c); if (k === 'links') hide(c.parentElement); else hide(s); return; }
      renderList(c, lists[k], 'Sem datas anunciadas de momento.');
    });
    // secção de média escondida se não houver nem áudio nem vídeo
    var emb = $$('[data-p-embed]');
    if (emb.length && emb.every(function (n) { return n.style.display === 'none'; })) hide(sectionOf(emb[0]));
  }

  function agendaPage(rows) {
    var box = document.querySelector('[data-arco-agenda]');
    if (!box || !rows) return;
    var tplMonth = box.querySelector('[data-arco-month]');
    if (!tplMonth) return;
    var tpl = tplMonth.cloneNode(true);
    $$('[data-arco-month]', box).forEach(function (n) { n.remove(); });
    var groups = [];
    rows.forEach(function (r) {
      var g = groups[groups.length - 1];
      if (!g || g.key !== r._month) groups.push(g = { key: r._month, label: r._monthLabel, rows: [] });
      g.rows.push(r);
    });
    var months = groups.map(function (g, i) {
      var m = tpl.cloneNode(true);
      m.style.marginTop = i === 0 ? '8px' : '56px';
      var hEl = m.querySelector('[data-f="month"]'); if (hEl) hEl.textContent = g.label;
      var items = renderList(m.querySelector('ul'), g.rows);
      box.appendChild(m);
      return { el: m, items: items };
    });
    if (!groups.length) {
      var p = document.createElement('p'); p.textContent = 'Sem datas anunciadas de momento.'; box.appendChild(p);
    }
    return months;
  }

  function setupForm(artists) {
    var form = document.querySelector('[data-arco-form]');
    if (!form) return;
    var st = form.querySelector('[data-arco-form-status]');
    var sel = form.querySelector('#f-art');
    if (sel && artists) {
      while (sel.options.length > 1) sel.remove(1);
      artists.forEach(function (a) { var o = document.createElement('option'); o.textContent = a.name; sel.appendChild(o); });
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var v = function (id) { var el = form.querySelector('#' + id); return el ? el.value.trim() : ''; };
      var kind = v('f-tipo');
      var say = function (t) { if (st) st.textContent = t; };
      if (!sb) { say('O envio não está disponível neste momento. Escreva-nos por email (ver acima).'); return; }
      var btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
      say('A enviar…');
      withTimeout(sb.from('messages').insert({
        kind: ['Booking', 'Press', 'Outro'].indexOf(kind) >= 0 ? kind : 'Outro',
        artist: v('f-art'), name: v('f-nome'), email: v('f-mail'),
        event_date: v('f-data') || null, place: v('f-local'), body: v('f-msg'),
      })).then(function (r) {
        if (r && r.error) throw r.error;
        form.reset(); say('Pedido enviado. Obrigado — respondemos em breve.');
      }).catch(function () {
        say('Não foi possível enviar. Tente de novo ou escreva-nos por email (ver acima).');
      }).then(function () { if (btn) btn.disabled = false; });
    });
  }

  hideDeadLinks();

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  Promise.all([
    q(sb && sb.from('site_texts').select('key, value')),
    q(sb && sb.from('settings').select('key, value')),
    q(sb && sb.from('artists').select('*').eq('visible', true).order('sort').order('name')),
    q(sb && sb.from('events').select('*').eq('visible', true).gte('date', iso).order('date')),
    q(sb && sb.from('instagram_posts').select('*').eq('visible', true).order('posted_at', { ascending: false }).limit(24)),
  ]).then(function (r) {
    var texts = r[0], settings = r[1], artists = r[2], events = r[3], posts = r[4];

    if (texts) texts.forEach(function (t) { if (t.value) $$('[data-t="' + t.key + '"]').forEach(function (n) { n.textContent = t.value; }); });
    if (settings) { var S = {}; settings.forEach(function (x) { S[x.key] = x.value; }); applySettings(S); }

    var byId = {};
    (artists || []).forEach(function (a) { byId[a.id] = a; });
    if (artists) {
      var cards = artists.map(function (a) { return { name: a.name, discipline: a.discipline, photo: a.photo, url: 'artista.html?a=' + encodeURIComponent(a.slug), _key: a.discipline || '' }; });
      var rendered = [];
      $$('[data-arco-list="artists"]').forEach(function (c) { rendered = rendered.concat(renderList(c, cards, 'Em breve.')); });
      var disc = []; artists.forEach(function (a) { if (a.discipline && disc.indexOf(a.discipline) < 0) disc.push(a.discipline); });
      if (rendered.length && document.querySelector('[data-arco-list="artists"]:not([data-limit])')) {
        setupChips(document.querySelector('[data-arco-chips]'), disc.map(function (d) { return { key: d, label: d }; }), function (k) { filterItems(rendered, k); });
      }
    }

    var rows = artists && events ? events.filter(function (e) { return byId[e.artist_id]; }).map(function (e) { return eventRow(e, byId); }) : null;
    $$('[data-arco-list="events"]').forEach(function (c) { renderList(c, rows, 'Sem datas anunciadas de momento.'); });
    var months = agendaPage(rows);
    if (months && artists) {
      setupChips(document.querySelector('[data-arco-chips]'), artists.map(function (a) { return { key: a.slug, label: a.name }; }), function (k) {
        months.forEach(function (m) { filterItems(m.items, k); m.el.hidden = m.items.every(function (n) { return n.hidden; }); });
      });
    }

    artistPage(artists, byId, events);

    if (posts && posts.length) {
      $$('[data-arco-list="instagram"]').forEach(function (c) { renderList(c, posts.map(function (p) { return { url: p.url, image: p.image }; })); });
      var last = new Date(posts[0].posted_at);
      $$('[data-arco-ig-status]').forEach(function (n) { n.textContent = 'Actualizado automaticamente a partir do Instagram · última publicação ' + last.toLocaleDateString('pt-PT'); });
    }

    setupForm(artists);
  });
})();
