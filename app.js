(function () {
  'use strict';

  var CFG = window.CORTES_CONFIG || {};
  var DEMO = !CFG.API_URL;
  var $app = document.getElementById('app');
  var $toast = document.getElementById('toast');

  // ---------- Utilidades ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) {
    return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  }
  function eur(n) {
    return (Math.round(n * 100) / 100).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  }
  function todayISO() {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function thisMonth() { return todayISO().slice(0, 7); }
  function addMonths(ym, d) {
    var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + d;
    var dt = new Date(y, m, 1);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
  }
  function monthLabel(ym) {
    return new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }
  function shortMonth(ym) {
    return new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)
      .toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  }
  var toastTimer;
  function toast(msg, isErr) {
    $toast.textContent = msg;
    $toast.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $toast.className = ''; }, isErr ? 4000 : 1800);
  }

  // ---------- API (real o demo) ----------
  var api = {
    list: function (pin) {
      if (DEMO) return Demo.call('list', { pin: pin });
      return fetch(CFG.API_URL + '?action=list&pin=' + encodeURIComponent(pin))
        .then(parse);
    },
    post: function (action, payload) {
      var body = Object.assign({ action: action, pin: S.pin }, payload);
      if (DEMO) return Demo.call(action, body);
      return fetch(CFG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      }).then(parse);
    }
  };
  function parse(res) {
    return res.json().then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Error');
      return j.data;
    });
  }

  // Modo demo: "servidor" en localStorage
  var Demo = {
    key: 'cortes_demo_db',
    load: function () {
      try { var d = JSON.parse(localStorage.getItem(this.key)); if (d) return d; } catch (e) {}
      var t = todayISO(), prev = addMonths(thisMonth(), -1) + '-';
      var d = {
        config: { personas: ['Yeray', 'Jan'], repartoPrimero: 50, precioDefecto: 10 },
        cuts: [
          { id: 'd1', fecha: prev + '05', cliente: 'Marcos', precio: 10, quien: 'Yeray', pagado: true, fechaPago: prev + '05', notas: '' },
          { id: 'd2', fecha: prev + '12', cliente: 'Lucía', precio: 12, quien: 'Jan', pagado: true, fechaPago: prev + '12', notas: 'Flequillo' },
          { id: 'd3', fecha: prev + '20', cliente: 'Marcos', precio: 10, quien: 'Conjunto', pagado: false, fechaPago: '', notas: '' },
          { id: 'd4', fecha: t, cliente: 'Pablo', precio: 8, quien: 'Jan', pagado: false, fechaPago: '', notas: 'Degradado' },
          { id: 'd5', fecha: t, cliente: 'marcos', precio: 10, quien: 'Yeray', pagado: false, fechaPago: '', notas: '' },
          { id: 'd6', fecha: t, cliente: 'Álvaro', precio: 15, quien: 'Conjunto', pagado: true, fechaPago: t, notas: 'Pelo y barba' }
        ]
      };
      this.save(d);
      return d;
    },
    save: function (d) { localStorage.setItem(this.key, JSON.stringify(d)); },
    call: function (action, p) {
      var self = this;
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          if (String(p.pin) !== '1234') return reject(new Error('PIN incorrecto (en demo es 1234)'));
          var d = self.load(), r = {};
          function find(id) { return d.cuts.filter(function (c) { return c.id === id; })[0]; }
          if (action === 'add') {
            var id = Math.random().toString(16).slice(2, 10);
            d.cuts.push({ id: id, fecha: p.fecha, cliente: p.cliente, precio: Number(p.precio), quien: p.quien,
              pagado: !!p.pagado, fechaPago: p.pagado ? (p.fechaPago || p.fecha) : '', notas: p.notas || '' });
            r = { id: id };
          } else if (action === 'edit') {
            var c = find(p.id); if (!c) return reject(new Error('Corte no encontrado'));
            Object.assign(c, { fecha: p.fecha, cliente: p.cliente, precio: Number(p.precio), quien: p.quien,
              pagado: !!p.pagado, fechaPago: p.pagado ? (p.fechaPago || p.fecha) : '', notas: p.notas || '' });
          } else if (action === 'delete') {
            d.cuts = d.cuts.filter(function (c) { return c.id !== p.id; });
          } else if (action === 'markPaid' || action === 'markUnpaid') {
            (p.ids || []).forEach(function (id) {
              var c = find(id); if (c) { c.pagado = action === 'markPaid'; c.fechaPago = c.pagado ? todayISO() : ''; }
            });
          } else if (action === 'setConfig') {
            d.config.precioDefecto = Number(p.precioDefecto);
          } else if (action === 'renameClient') {
            d.cuts.forEach(function (c) { if (norm(c.cliente) === norm(p.from)) c.cliente = p.to; });
          }
          self.save(d);
          resolve(action === 'list' ? d : r);
        }, 150);
      });
    }
  };

  // ---------- Estado ----------
  var S = {
    pin: null, cuts: [], config: { personas: ['Yeray', 'Jan'], repartoPrimero: 50, precioDefecto: 0 },
    loaded: false, loading: false, loadError: '',
    tab: 'nuevo', client: null, modal: null, month: thisMonth(),
    filters: { q: '', mes: '', quien: '', estado: '' },
    deudaQ: '', clientesQ: '', clientesSort: 'nombre', limit: 80,
    formQuien: '', formPrecio: null, prefill: '', settings: false
  };

  // ---------- Cálculos ----------
  function split(c) {
    var p = S.config.personas, r = S.config.repartoPrimero / 100;
    if (c.quien === p[0]) return [c.precio, 0];
    if (c.quien === p[1]) return [0, c.precio];
    return [c.precio * r, c.precio * (1 - r)];
  }
  function stats(list) {
    var o = { n: list.length, fact: 0, cob: 0, pend: 0, p: [{ fact: 0, cob: 0, pend: 0 }, { fact: 0, cob: 0, pend: 0 }] };
    list.forEach(function (c) {
      o.fact += c.precio;
      if (c.pagado) o.cob += c.precio; else o.pend += c.precio;
      var s = split(c);
      for (var i = 0; i < 2; i++) {
        o.p[i].fact += s[i];
        if (c.pagado) o.p[i].cob += s[i]; else o.p[i].pend += s[i];
      }
    });
    return o;
  }
  function sortedCuts(list) {
    return list.slice().reverse().sort(function (a, b) { return b.fecha.localeCompare(a.fecha); });
  }
  function clientsMap() {
    var m = {};
    sortedCuts(S.cuts).forEach(function (c) {
      var k = norm(c.cliente);
      if (!m[k]) m[k] = { key: k, name: c.cliente, cuts: [] };
      m[k].cuts.push(c);
    });
    return m;
  }
  function clientList() {
    var m = clientsMap();
    return Object.keys(m).map(function (k) {
      var c = m[k]; c.st = stats(c.cuts); c.last = c.cuts[0].fecha; return c;
    });
  }
  function byId(id) { return S.cuts.filter(function (c) { return c.id === id; })[0]; }

  // ---------- Carga y mutaciones ----------
  function load(silent) {
    if (!silent) { S.loading = true; S.loadError = ''; render(); }
    return api.list(S.pin).then(function (d) {
      S.cuts = d.cuts; S.config = d.config; S.loaded = true; S.loading = false; S.loadError = '';
      try { localStorage.setItem('cortes_pin', S.pin); } catch (e) {}
      render();
    }).catch(function (e) {
      S.loading = false;
      if (/PIN/.test(e.message)) {
        try { localStorage.removeItem('cortes_pin'); } catch (e2) {}
        S.pin = null; S.loaded = false;
        toast(e.message, true);
      } else {
        S.loadError = 'No se pudo conectar. Revisa tu conexión.';
        if (silent) toast(S.loadError, true);
      }
      render();
    });
  }

  function mutate(localFn, action, payload, okMsg) {
    var snapshot = JSON.stringify(S.cuts);
    localFn();
    render();
    return api.post(action, payload).then(function (r) {
      if (okMsg) toast(okMsg);
      return r;
    }).catch(function (e) {
      S.cuts = JSON.parse(snapshot);
      render();
      toast(e.message || 'Error al guardar', true);
      load(true);
      throw e;
    });
  }

  function addCut(data) {
    var tmp = 'tmp' + Date.now();
    var cut = Object.assign({ id: tmp, fechaPago: data.pagado ? data.fecha : '' }, data);
    return mutate(function () { S.cuts.push(cut); }, 'add', data, 'Corte guardado').then(function (r) {
      var c = byId(tmp); if (c && r && r.id) c.id = r.id;
    });
  }
  function editCut(id, data) {
    return mutate(function () {
      Object.assign(byId(id), data, { fechaPago: data.pagado ? (byId(id).fechaPago || data.fecha) : '' });
    }, 'edit', Object.assign({ id: id }, data), 'Cambios guardados');
  }
  function deleteCut(id) {
    return mutate(function () { S.cuts = S.cuts.filter(function (c) { return c.id !== id; }); },
      'delete', { id: id }, 'Corte borrado');
  }
  function setPaid(ids, paid) {
    return mutate(function () {
      ids.forEach(function (id) { var c = byId(id); if (c) { c.pagado = paid; c.fechaPago = paid ? todayISO() : ''; } });
    }, paid ? 'markPaid' : 'markUnpaid', { ids: ids }, paid ? 'Marcado como pagado' : 'Marcado como pendiente');
  }
  function saveDefaultPrice(precio) {
    var old = S.config.precioDefecto;
    return api.post('setConfig', { precioDefecto: precio }).then(function () {
      S.config.precioDefecto = precio; S.formPrecio = null; render(); toast('Precio habitual guardado');
    }).catch(function (e) { S.config.precioDefecto = old; toast(e.message || 'Error al guardar', true); });
  }
  function renameClient(key, to) {
    var from = (clientsMap()[key] || {}).name || key;
    return mutate(function () {
      S.cuts.forEach(function (c) { if (norm(c.cliente) === key) c.cliente = to; });
      S.client = norm(to);
    }, 'renameClient', { from: from, to: to }, 'Cliente renombrado');
  }

  // ---------- Vistas ----------
  function render() {
    var active = document.activeElement, focusId = active && active.id, selStart = active && active.selectionStart;
    var html;
    if (!S.pin) html = viewPin();
    else if (!S.loaded) html = viewLoading();
    else html = viewMain();
    $app.innerHTML = html;
    if (focusId) {
      var el = document.getElementById(focusId);
      if (el && /^(q-|f-search)/.test(focusId)) {
        el.focus();
        try { el.setSelectionRange(selStart, selStart); } catch (e) {}
      }
    }
  }

  function viewPin() {
    return '<div class="pin-wrap"><img class="logo" src="assets/logo.jpg" alt="Barber"><h1>Cortes</h1>' + (DEMO ? '<div class="demo">MODO DEMO · PIN 1234 · datos solo en este navegador</div>' : '') +
      '<div class="card"><label class="f" for="pin">PIN de acceso</label>' +
      '<input id="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••">' +
      '<button class="btn" data-act="login">Entrar</button></div></div>';
  }
  function viewLoading() {
    if (S.loadError) {
      return '<div class="pin-wrap"><div class="card empty">' + esc(S.loadError) +
        '<button class="btn" data-act="reload">Reintentar</button><button class="btn sec" data-act="logout">Cambiar PIN</button></div></div>';
    }
    return '<div class="spinner">Cargando…</div>';
  }

  var TABS = [['nuevo', 'fa-plus-circle', 'Nuevo'], ['clientes', 'fa-users', 'Clientes'], ['deudas', 'fa-eur', 'Deudas'], ['resumen', 'fa-bar-chart', 'Resumen'], ['historial', 'fa-list', 'Historial']];

  function viewMain() {
    var body, title = '';
    if (S.client) {
      body = viewClient();
    } else {
      switch (S.tab) {
        case 'clientes': body = viewClientes(); title = 'Clientes'; break;
        case 'deudas': body = viewDeudas(); title = 'Deudas'; break;
        case 'resumen': body = viewResumen(); title = 'Resumen'; break;
        case 'historial': body = viewHistorial(); title = 'Historial'; break;
        default: body = viewNuevo(); title = 'Nuevo corte';
      }
      body = '<div class="pole"></div><div class="brand"><i class="fa fa-cut"></i>Yeray &amp; Jan · Barbería</div>' +
        '<header class="top"><h1>' + title + '</h1><div class="acts">' +
        '<button class="icon-btn" data-act="refresh" aria-label="Actualizar"><i class="fa fa-refresh"></i></button>' +
        '<button class="icon-btn" data-act="settings" aria-label="Ajustes"><i class="fa fa-cog"></i></button></div>' +
        '</header>' + (DEMO ? '<div class="demo">MODO DEMO</div>' : '') + body;
    }
    var nav = '<nav class="tabs"><div class="inner">' + TABS.map(function (t) {
      return '<button data-act="tab" data-tab="' + t[0] + '" class="' + (S.tab === t[0] && !S.client ? 'on' : '') + '">' +
        '<i class="fa ' + t[1] + '"></i>' + t[2] + '</button>';
    }).join('') + '</div></nav>';
    return body + nav + (S.settings ? viewSettings() : '') + (S.modal ? viewModal() : '');
  }

  // Formulario reutilizable (nuevo y editar)
  function formHTML(v, pre, def) {
    var P = S.config.personas, opts = P.concat(['Conjunto']);
    var names = Object.keys(clientsMap()).map(function (k) { return clientsMap()[k].name; });
    return '<label class="f" for="' + pre + 'cliente">Cliente</label>' +
      '<input id="' + pre + 'cliente" type="text" list="' + pre + 'dl" autocomplete="off" autocapitalize="words" value="' + esc(v.cliente) + '" placeholder="Nombre">' +
      '<datalist id="' + pre + 'dl">' + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<label class="f" for="' + pre + 'precio">Precio (€)</label>' +
      '<input id="' + pre + 'precio" type="number" inputmode="decimal" step="0.5" min="0" value="' + esc(v.precio) + '" placeholder="0">' +
      (def ? '<div class="hint">Precio habitual: ' + eur(def) + (Number(v.precio) !== def ? ' · <button type="button" data-act="useDefault">usar habitual</button>' : '') + '</div>' : '') +
      '<label class="f">Quién lo hizo</label>' +
      '<div class="seg" data-seg="quien" id="' + pre + 'quien">' + opts.map(function (o) {
        return '<button type="button" data-val="' + esc(o) + '" class="' + (v.quien === o ? 'on' : '') + '">' + esc(o) + '</button>';
      }).join('') + '</div>' +
      '<label class="f">Pago</label>' +
      '<div class="seg paid" data-seg="pagado" id="' + pre + 'pagado">' +
      '<button type="button" data-val="1" class="' + (v.pagado ? 'on' : '') + '">Pagado</button>' +
      '<button type="button" data-val="0" class="no ' + (!v.pagado ? 'on' : '') + '">Pendiente</button></div>' +
      '<label class="f" for="' + pre + 'fecha">Fecha</label>' +
      '<input id="' + pre + 'fecha" type="date" value="' + esc(v.fecha) + '">' +
      '<label class="f" for="' + pre + 'notas">Notas (opcional)</label>' +
      '<input id="' + pre + 'notas" type="text" value="' + esc(v.notas) + '" placeholder="Degradado, barba…">';
  }
  function readForm(pre) {
    var q = document.querySelector('#' + pre + 'quien button.on'), p = document.querySelector('#' + pre + 'pagado button.on');
    return {
      cliente: document.getElementById(pre + 'cliente').value.trim(),
      precio: document.getElementById(pre + 'precio').value === '' ? NaN : Number(String(document.getElementById(pre + 'precio').value).replace(',', '.')),
      quien: q ? q.getAttribute('data-val') : '',
      pagado: p ? p.getAttribute('data-val') === '1' : false,
      fecha: document.getElementById(pre + 'fecha').value,
      notas: document.getElementById(pre + 'notas').value.trim()
    };
  }
  function checkForm(d) {
    if (!d.cliente) return 'Pon el nombre del cliente';
    if (!isFinite(d.precio) || d.precio < 0) return 'Pon un precio válido';
    if (!d.quien) return 'Elige quién hizo el corte';
    if (!d.fecha) return 'Falta la fecha';
    return '';
  }

  function viewNuevo() {
    var recent = sortedCuts(S.cuts).slice(0, 5);
    var def = S.config.precioDefecto || 0;
    var v = { cliente: S.prefill, precio: S.formPrecio != null ? S.formPrecio : (def || ''), quien: S.formQuien, pagado: true, fecha: todayISO(), notas: '' };
    return '<div class="card">' + formHTML(v, 'n-', def) +
      '<button class="btn" data-act="save">Guardar corte</button></div>' +
      '<div class="card"><h2>Últimos cortes</h2>' + (recent.length ? '<ul class="list">' + recent.map(function (c) { return cutItem(c, true); }).join('') + '</ul>' : '<div class="empty">Aún no hay cortes</div>') + '</div>';
  }

  function cutItem(c, showClient) {
    var sub = fmtDate(c.fecha) + ' · ' + esc(c.quien) + (c.notas ? ' · ' + esc(c.notas) : '');
    return '<li class="item tap" data-act="openCut" data-id="' + esc(c.id) + '"><div class="main">' +
      '<div class="name">' + (showClient ? esc(c.cliente) : fmtDate(c.fecha)) + '</div>' +
      '<div class="small muted">' + (showClient ? sub : esc(c.quien) + (c.notas ? ' · ' + esc(c.notas) : '')) + '</div></div>' +
      '<div><div class="amt">' + eur(c.precio) + '</div>' +
      '<span class="badge ' + (c.pagado ? 'ok' : 'pend') + '">' + (c.pagado ? 'Pagado' : 'Pendiente') + '</span></div></li>';
  }

  function viewClientes() {
    var list = clientList(), q = norm(S.clientesQ);
    if (q) list = list.filter(function (c) { return norm(c.name).indexOf(q) >= 0; });
    var sorts = {
      nombre: function (a, b) { return norm(a.name).localeCompare(norm(b.name)); },
      deuda: function (a, b) { return b.st.pend - a.st.pend; },
      ultimo: function (a, b) { return b.last.localeCompare(a.last); }
    };
    list.sort(sorts[S.clientesSort]);
    return '<input id="q-clientes" type="search" placeholder="Buscar cliente…" value="' + esc(S.clientesQ) + '">' +
      '<label class="f" for="sort-clientes">Ordenar por</label>' +
      '<select id="sort-clientes"><option value="nombre"' + (S.clientesSort === 'nombre' ? ' selected' : '') + '>Nombre</option>' +
      '<option value="deuda"' + (S.clientesSort === 'deuda' ? ' selected' : '') + '>Deuda</option>' +
      '<option value="ultimo"' + (S.clientesSort === 'ultimo' ? ' selected' : '') + '>Último corte</option></select>' +
      '<div class="card">' + (list.length ? '<ul class="list">' + list.map(function (c) {
        return '<li class="item tap" data-act="openClient" data-key="' + esc(c.key) + '"><div class="main"><div class="name">' + esc(c.name) + '</div>' +
          '<div class="small muted">' + c.st.n + (c.st.n === 1 ? ' corte' : ' cortes') + ' · último ' + fmtDate(c.last) + '</div></div>' +
          '<div class="amt">' + (c.st.pend > 0 ? '<span class="v neg">Debe ' + eur(c.st.pend) + '</span>' : '<span class="muted">' + eur(c.st.fact) + '</span>') + '</div></li>';
      }).join('') + '</ul>' : '<div class="empty">Sin resultados</div>') + '</div>';
  }

  function viewDeudas() {
    var all = stats(S.cuts), q = norm(S.deudaQ);
    var list = clientList().filter(function (c) { return c.st.pend > 0 && (!q || norm(c.name).indexOf(q) >= 0); })
      .sort(function (a, b) { return b.st.pend - a.st.pend; });
    return '<div class="card"><div class="small muted">Te deben en total</div><div class="big ' + (all.pend > 0 ? 'v neg' : 'v pos') + '">' + eur(all.pend) + '</div>' +
      '<div class="small muted">' + S.config.personas[0] + ': ' + eur(all.p[0].pend) + ' · ' + S.config.personas[1] + ': ' + eur(all.p[1].pend) + '</div></div>' +
      '<input id="q-deudas" type="search" placeholder="Buscar cliente…" value="' + esc(S.deudaQ) + '">' +
      '<div class="card">' + (list.length ? '<ul class="list">' + list.map(function (c) {
        var pend = c.cuts.filter(function (x) { return !x.pagado; }).length;
        return '<li class="item"><div class="main tap" data-act="openClient" data-key="' + esc(c.key) + '" style="cursor:pointer">' +
          '<div class="name">' + esc(c.name) + '</div><div class="small muted">' + pend + (pend === 1 ? ' corte pendiente' : ' cortes pendientes') + '</div></div>' +
          '<div style="text-align:right"><div class="amt v neg">' + eur(c.st.pend) + '</div>' +
          '<button class="btn sm sec" data-act="payAll" data-key="' + esc(c.key) + '">Pagó todo</button></div></li>';
      }).join('') + '</ul>' : '<div class="empty"><i class="fa fa-check-circle"></i> Nadie debe nada</div>') + '</div>';
  }

  function viewResumen() {
    var inMonth = S.cuts.filter(function (c) { return c.fecha.slice(0, 7) === S.month; });
    var st = stats(inMonth), tot = stats(S.cuts), P = S.config.personas;
    var months = [], i;
    for (i = 5; i >= 0; i--) months.push(addMonths(thisMonth(), -i));
    var vals = months.map(function (m) { return stats(S.cuts.filter(function (c) { return c.fecha.slice(0, 7) === m; })).fact; });
    var max = Math.max.apply(null, vals.concat([1]));
    return '<div class="monthnav"><button class="icon-btn" data-act="monthPrev"><i class="fa fa-chevron-left"></i></button><b>' + monthLabel(S.month) + '</b>' +
      '<button class="icon-btn" data-act="monthNext"><i class="fa fa-chevron-right"></i></button></div>' +
      '<div class="card"><div class="grid">' +
      stat('Facturado', eur(st.fact)) + stat('Cobrado', eur(st.cob), 'pos') + stat('Pendiente', eur(st.pend), st.pend > 0 ? 'neg' : '') + stat('Cortes', st.n) +
      '</div></div>' +
      '<div class="card"><h2>Reparto del mes</h2><div class="grid">' + [0, 1].map(function (i) {
        return '<div class="stat"><div class="l">' + esc(P[i]) + '</div><div class="v">' + eur(st.p[i].fact) + '</div>' +
          '<div class="small muted">cobrado ' + eur(st.p[i].cob) + '<br>pendiente ' + eur(st.p[i].pend) + '</div></div>';
      }).join('') + '</div><div class="small muted" style="margin-top:8px">Los cortes en conjunto se reparten ' + S.config.repartoPrimero + '/' + (100 - S.config.repartoPrimero) + '.</div></div>' +
      '<div class="card"><h2>Últimos 6 meses (facturado)</h2><div class="bars">' + months.map(function (m, i) {
        return '<div class="bar ' + (m === S.month ? 'cur' : '') + '"><span>' + (vals[i] ? Math.round(vals[i]) : '') + '</span><i style="height:' + Math.round(vals[i] / max * 80) + '%"></i><span>' + shortMonth(m) + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="card"><h2>Total histórico</h2><div class="grid">' +
      stat('Facturado', eur(tot.fact)) + stat('Cobrado', eur(tot.cob), 'pos') + stat('Pendiente', eur(tot.pend), tot.pend > 0 ? 'neg' : '') + stat('Cortes', tot.n) +
      '</div></div>';
  }
  function stat(l, v, cls) { return '<div class="stat"><div class="l">' + l + '</div><div class="v ' + (cls || '') + '">' + v + '</div></div>'; }

  function viewHistorial() {
    var F = S.filters, q = norm(F.q), P = S.config.personas;
    var months = {};
    S.cuts.forEach(function (c) { months[c.fecha.slice(0, 7)] = 1; });
    var ml = Object.keys(months).sort().reverse();
    var list = sortedCuts(S.cuts).filter(function (c) {
      return (!F.mes || c.fecha.slice(0, 7) === F.mes) && (!F.quien || c.quien === F.quien) &&
        (!F.estado || (F.estado === 'pend' ? !c.pagado : c.pagado)) && (!q || norm(c.cliente).indexOf(q) >= 0);
    });
    var shown = list.slice(0, S.limit);
    function sel(id, val, opts) {
      return '<select id="' + id + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (val === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    }
    return '<input id="q-historial" type="search" placeholder="Buscar cliente…" value="' + esc(F.q) + '">' +
      '<div class="filters">' +
      sel('f-mes', F.mes, [['', 'Todos los meses']].concat(ml.map(function (m) { return [m, monthLabel(m)]; }))) +
      sel('f-quien', F.quien, [['', 'Todos'], [P[0], P[0]], [P[1], P[1]], ['Conjunto', 'Conjunto']]) +
      sel('f-estado', F.estado, [['', 'Todos'], ['pend', 'Pendientes'], ['pag', 'Pagados']]) + '</div>' +
      '<div class="small muted">' + list.length + ' cortes · ' + eur(stats(list).fact) + '</div>' +
      '<div class="card">' + (shown.length ? '<ul class="list">' + shown.map(function (c) { return cutItem(c, true); }).join('') + '</ul>' : '<div class="empty">Sin cortes</div>') +
      (list.length > shown.length ? '<button class="btn sec" data-act="more">Ver más</button>' : '') + '</div>';
  }

  function viewClient() {
    var c = clientsMap()[S.client];
    if (!c) { S.client = null; return ''; }
    var st = stats(c.cuts), P = S.config.personas, cnt = {};
    c.cuts.forEach(function (x) { cnt[x.quien] = (cnt[x.quien] || 0) + 1; });
    var first = c.cuts[c.cuts.length - 1].fecha, last = c.cuts[0].fecha;
    return '<div class="pole"></div><header class="top"><button class="back" data-act="back"><i class="fa fa-chevron-left"></i> Volver</button><button class="icon-btn" data-act="renameClient" data-key="' + esc(c.key) + '"><i class="fa fa-pencil"></i> Renombrar</button></header>' +
      '<h1 style="margin:4px 0 0;font-family:Alice,Georgia,serif;font-weight:400;color:var(--accent)">' + esc(c.name) + '</h1>' +
      '<div class="card"><div class="grid">' + stat('Debe', eur(st.pend), st.pend > 0 ? 'neg' : 'pos') + stat('Total gastado', eur(st.fact)) +
      stat('Cortes', st.n) + stat('Precio medio', eur(st.fact / st.n)) + stat('Primer corte', fmtDate(first)) + stat('Último corte', fmtDate(last)) + '</div>' +
      '<div class="small muted" style="margin-top:10px">' + P[0] + ' ' + (cnt[P[0]] || 0) + ' · ' + P[1] + ' ' + (cnt[P[1]] || 0) + ' · Conjunto ' + (cnt['Conjunto'] || 0) + '</div>' +
      '<div class="row-actions"><button class="btn sm" data-act="newFor" data-key="' + esc(c.key) + '"><i class="fa fa-plus"></i> Nuevo corte</button>' +
      (st.pend > 0 ? '<button class="btn sm sec" data-act="payAll" data-key="' + esc(c.key) + '">Pagó todo (' + eur(st.pend) + ')</button>' : '') + '</div></div>' +
      '<div class="card"><h2>Todos sus cortes</h2><ul class="list">' + c.cuts.map(function (x) { return cutItem(x, false); }).join('') + '</ul></div>';
  }

  function viewSettings() {
    return '<div class="modal-bg" data-act="closeSettings"><div class="modal">' +
      '<header class="top"><h1>Ajustes</h1><button class="icon-btn" data-act="closeSettings" aria-label="Cerrar"><i class="fa fa-times"></i></button></header>' +
      '<label class="f" for="s-precio">Precio habitual del corte (€)</label>' +
      '<input id="s-precio" type="number" inputmode="decimal" step="0.5" min="0" value="' + esc(S.config.precioDefecto || '') + '" placeholder="0">' +
      '<div class="hint">Se pone solo al apuntar un corte nuevo. Puedes cambiarlo en cada corte sin afectar al habitual.</div>' +
      '<button class="btn" data-act="saveSettings">Guardar precio</button>' +
      '<button class="btn sec" data-act="logout">Cerrar sesión / cambiar PIN</button></div></div>';
  }

  function viewModal() {
    var c = byId(S.modal);
    if (!c) return '';
    return '<div class="modal-bg" data-act="closeModal"><div class="modal">' +
      '<header class="top"><h1>Corte de ' + esc(c.cliente) + '</h1><button class="icon-btn" data-act="closeModal" aria-label="Cerrar"><i class="fa fa-times"></i></button></header>' +
      formHTML(c, 'e-') +
      '<button class="btn" data-act="editSave">Guardar cambios</button>' +
      '<button class="btn sec" data-act="togglePaid" data-id="' + esc(c.id) + '">' + (c.pagado ? 'Marcar como pendiente' : 'Marcar como pagado') + '</button>' +
      '<button class="btn sec" data-act="openClient" data-key="' + esc(norm(c.cliente)) + '">Ver ficha del cliente</button>' +
      '<button class="btn danger" data-act="del" data-id="' + esc(c.id) + '">Borrar corte</button></div></div>';
  }

  // ---------- Eventos ----------
  $app.addEventListener('click', function (e) {
    var seg = e.target.closest('.seg button');
    if (seg) {
      Array.prototype.forEach.call(seg.parentNode.children, function (b) { b.classList.remove('on'); });
      seg.classList.add('on');
      if (seg.parentNode.id === 'n-quien') S.formQuien = seg.getAttribute('data-val');
      return;
    }
    var t = e.target.closest('[data-act]');
    if (!t) return;
    // Evita que un botón dentro de una fila clicable dispare también la fila
    if (/^close(Modal|Settings)$/.test(t.getAttribute('data-act')) && e.target.closest('.modal') && t.classList.contains('modal-bg')) return;
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id'), key = t.getAttribute('data-key');
    var cl;
    switch (act) {
      case 'login': return doLogin();
      case 'logout': S.settings = false; return doLogout();
      case 'reload': return load();
      case 'refresh': return load(true).then(function () { toast('Actualizado'); });
      case 'tab': S.tab = t.getAttribute('data-tab'); S.client = null; S.modal = null; S.settings = false; if (S.tab !== 'nuevo') S.prefill = ''; return render();
      case 'back': S.client = null; return render();
      case 'openClient': S.modal = null; S.client = key; window.scrollTo(0, 0); return render();
      case 'openCut': S.modal = id; return render();
      case 'closeModal': S.modal = null; return render();
      case 'monthPrev': S.month = addMonths(S.month, -1); return render();
      case 'monthNext': S.month = addMonths(S.month, 1); return render();
      case 'more': S.limit += 80; return render();
      case 'newFor': cl = clientsMap()[key]; S.prefill = cl ? cl.name : ''; S.client = null; S.tab = 'nuevo'; return render();
      case 'settings': S.settings = true; return render();
      case 'closeSettings': S.settings = false; return render();
      case 'saveSettings':
        var pr = document.getElementById('s-precio').value;
        if (pr === '' || !isFinite(Number(pr)) || Number(pr) < 0) return toast('Pon un precio válido', true);
        S.settings = false; render(); return saveDefaultPrice(Number(pr));
      case 'useDefault': S.formPrecio = null; return render();
      case 'save': return doSave(t);
      case 'editSave': return doEditSave();
      case 'togglePaid': var c = byId(id); S.modal = null; return setPaid([id], !c.pagado);
      case 'del':
        if (!confirm('¿Borrar este corte?')) return;
        S.modal = null; return deleteCut(id);
      case 'payAll':
        cl = clientsMap()[key];
        var ids = cl.cuts.filter(function (x) { return !x.pagado; }).map(function (x) { return x.id; });
        if (!ids.length || !confirm(cl.name + ' paga ' + eur(stats(cl.cuts).pend) + '. ¿Marcar todo como pagado?')) return;
        return setPaid(ids, true);
      case 'renameClient':
        cl = clientsMap()[key];
        var nn = prompt('Nuevo nombre (si ya existe otro cliente con ese nombre, se unirán):', cl.name);
        if (nn && nn.trim() && nn.trim() !== cl.name) return renameClient(key, nn.trim());
    }
  });

  $app.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'q-clientes') { S.clientesQ = e.target.value; render(); }
    else if (id === 'q-deudas') { S.deudaQ = e.target.value; render(); }
    else if (id === 'q-historial') { S.filters.q = e.target.value; S.limit = 80; render(); }
    else if (id === 'n-cliente') { S.prefill = e.target.value; }
    else if (id === 'n-precio') { S.formPrecio = e.target.value; }
  });
  $app.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'sort-clientes') { S.clientesSort = e.target.value; render(); }
    else if (id === 'f-mes') { S.filters.mes = e.target.value; S.limit = 80; render(); }
    else if (id === 'f-quien') { S.filters.quien = e.target.value; S.limit = 80; render(); }
    else if (id === 'f-estado') { S.filters.estado = e.target.value; S.limit = 80; render(); }
  });
  $app.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'pin') doLogin();
  });

  function doLogin() {
    var pin = document.getElementById('pin').value.trim();
    if (!pin) return toast('Escribe el PIN', true);
    S.pin = pin; load();
  }
  function doLogout() {
    try { localStorage.removeItem('cortes_pin'); } catch (e) {}
    S.pin = null; S.loaded = false; S.loadError = ''; render();
  }
  function doSave() {
    var d = readForm('n-'), err = checkForm(d);
    if (err) return toast(err, true);
    // El formulario se reinicia tras guardar, conservando la última persona elegida
    S.formQuien = d.quien; S.prefill = ''; S.formPrecio = null;
    window.scrollTo(0, 0);
    addCut(d).catch(function () {});
  }
  function doEditSave() {
    var d = readForm('e-'), err = checkForm(d), id = S.modal;
    if (err) return toast(err, true);
    S.modal = null;
    editCut(id, d).catch(function () {});
  }

  // ---------- Arranque ----------
  try { S.pin = localStorage.getItem('cortes_pin') || null; } catch (e) {}
  render();
  if (S.pin) load();
})();
