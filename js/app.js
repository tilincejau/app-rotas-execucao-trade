/* ROTAS DE CAMPO — Executivo de Chopp e Promotor (app offline / PWA) */
const S = { usuario: null, token: null, pacote: null, clientes: [], porCod: {}, visitasServ: [], outbox: [], enviados: [],
  tela: 'login', rota: null, filtros: { vend: '', dia: '', cidade: '', busca: '' }, draft: null, msg: null, sincronizando: false, modal: null };
const $app = document.getElementById('app');
const mesAtual = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const hoje = () => new Date().toLocaleDateString('pt-BR');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n2 = v => (v == null || v === '' || isNaN(v) ? '–' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const n1 = v => (v == null || v === '' ? '–' : (Math.round(Number(v) * 10) / 10).toLocaleString('pt-BR'));
const rs = v => (v == null || v === '' || isNaN(v) ? '–' : 'R$ ' + n2(v));
const num = v => { const n = Number(String(v == null ? '' : v).replace(',', '.')); return isNaN(n) ? null : n; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const uniq = a => [...new Set(a.filter(Boolean))].sort((x, y) => String(x).localeCompare(String(y), 'pt-BR', { numeric: true }));
const perfilCfg = () => PERFIS[S.usuario.perfil] || PERFIS._OUTROS;
const R = () => S.draft.r;
function setPath(o, p, v) { const k = p.split('.'); k.slice(0, -1).forEach(x => o = o[x] = o[x] || {}); o[k[k.length - 1]] = v; }
function getPath(o, p) { return p.split('.').reduce((a, k) => a == null ? undefined : a[k], o); }
function nomeMes(voltar) { const [a, m] = String(S.pacote.mes || mesAtual()).split('-').map(Number), d = new Date(a, m - 1 - voltar, 1); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][d.getMonth()]; }

/* ---------------------------- INICIALIZAÇÃO ---------------------------- */
async function iniciar() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  S.token = await DB.get('token'); S.usuario = await DB.get('usuario');
  S.outbox = (await DB.get('outbox')) || []; S.visitasServ = (await DB.get('visitas')) || []; S.enviados = (await DB.get('enviados')) || [];
  const pac = await DB.get('pacote'); if (pac) carregarPacote(pac);
  S.draft = (await DB.get('rascunho')) || null;
  S.tela = S.token && S.pacote ? 'resumo' : 'login';
  render();
  if (S.tela === 'resumo') sincronizar();
  window.addEventListener('online', () => { render(); sincronizar(); });
  window.addEventListener('offline', render);
}
function carregarPacote(p) {
  S.pacote = p;
  S.clientes = p.clientes.map(a => { const o = {}; p.colsClientes.forEach((c, i) => o[c] = a[i]); return o; });
  S.porCod = {}; S.clientes.forEach(c => S.porCod[c.cod] = c);
}
async function sincronizar(forcar) {
  if (S.sincronizando || !S.token || !navigator.onLine) return;
  S.sincronizando = true; render();
  try {
    for (const v of [...S.outbox]) {
      const r = await API.chamar({ acao: 'enviar', token: S.token, visita: v }, 120000);
      if (r.erro === 'SESSAO_EXPIRADA') return sair('Sessão expirada. Entre novamente.');
      if (r.ok) {
        S.outbox = S.outbox.filter(x => x.id !== v.id);
        S.enviados = S.enviados.filter(x => x.id !== v.id && x.mes === mesAtual());
        S.enviados.push({ id: v.id, mes: v.mes, data: v.data, rota: v.rota, cod: v.cod, fantasia: v.fantasia, login: S.usuario.login, enviadoEm: Date.now() });
        await DB.set('enviados', S.enviados);
      } else v.erroEnvio = r.msg || r.erro;
      await DB.set('outbox', S.outbox);
    }
    const ver = await API.chamar({ acao: 'versao', token: S.token });
    if (ver.erro === 'SESSAO_EXPIRADA') return sair('Sessão expirada. Entre novamente.');
    if (forcar || !S.pacote || ver.versao !== S.pacote.versao) {
      const d = await API.chamar({ acao: 'dados', token: S.token }, 180000);
      if (d.ok) { S.usuario = d.usuario; await DB.set('usuario', d.usuario); await DB.set('pacote', d.pacote); carregarPacote(d.pacote); }
    }
    const vs = await API.chamar({ acao: 'visitas', token: S.token, mes: mesAtual() });
    if (vs.ok) {
      S.visitasServ = vs.visitas; await DB.set('visitas', vs.visitas);
      const ids = new Set(vs.visitas.map(x => x.id));
      S.enviados = S.enviados.filter(x => !ids.has(x.id) && Date.now() - x.enviadoEm < 10 * 60 * 1000); await DB.set('enviados', S.enviados);
    }
  } catch (e) { console.warn('sync', e); }
  finally { S.sincronizando = false; render(); }
}
async function sair(msg) {
  if (S.outbox.length && !confirm('Há ' + S.outbox.length + ' visita(s) não enviada(s). Sair mesmo assim? (elas ficam salvas no aparelho)')) return;
  await DB.del('token'); S.token = null; S.tela = 'login'; S.msg = msg || null; S.sincronizando = false; render();
}

/* ------------------------------ CONSULTAS ------------------------------ */
function minhasVisitas() {
  const me = S.usuario.login, mes = mesAtual();
  const serv = S.visitasServ.filter(v => v.login === me && v.mes === mes), ids = new Set(serv.map(v => v.id));
  const loc = S.enviados.filter(v => v.mes === mes && !ids.has(v.id)); loc.forEach(v => ids.add(v.id));
  const pend = S.outbox.filter(v => v.mes === mes && !ids.has(v.id)).map(v => ({ ...v, pendente: true }));
  return [...pend, ...loc, ...serv].sort((a, b) => String(b.id).localeCompare(String(a.id)));
}
const visitasPdv = (cod, rota) => minhasVisitas().filter(v => v.cod === cod && (!rota || v.rota === rota));
function clientesDaRota(rota) {
  const t = ROTAS[rota].lista;
  return S.clientes.filter(c => t === 'chop' ? c.chop : t === 'prom' ? c.prom : true);
}
function filtrados() {
  const f = S.filtros, b = f.busca.trim().toLowerCase();
  return clientesDaRota(S.rota).filter(c => (!f.vend || c.vend === f.vend) && (!f.dia || c.dia === f.dia) && (!f.cidade || c.cidade === f.cidade) &&
    (!b || c.cod.includes(b) || c.fantasia.toLowerCase().includes(b) || c.razao.toLowerCase().includes(b)));
}
// Comodato: semáforo de dias para vencer
function semaforo(dias) {
  if (dias < 0) return { cor: 'erro', bg: 'alerta-v', txt: `Vencido há ${-dias} dia(s)`, plano: true };
  if (dias <= DIAS_ALERTA_COMODATO) return { cor: 'am', bg: 'alerta', txt: `Vence em ${dias} dia(s)`, plano: true };
  return { cor: 'sobe', bg: 'ok', txt: `OK – vence em ${dias} dia(s)`, plano: false };
}
// Chopp comprado (exp): [ProdCod, Marca, Litros, meses, última, Tab, Preço, qtd atual, ant, retrasado]
const ehAderido = tab => (S.pacote.tabAderido || [459, 349, 350]).includes(Number(tab));
function choppDoPdv(cod) {
  return ((S.pacote.exp || {})[cod] || []).map(x => ({ cod: x[0], marca: x[1], litros: x[2], bits: x[3], ult: x[4], tab: x[5], preco: x[6], qtd: [x[7], x[8], x[9]],
    aderido: ehAderido(x[5]), litro: x[2] ? x[6] / x[2] : null, noMes: !!(x[3] & 1) })).sort((a, b) => (b.noMes - a.noMes) || a.marca.localeCompare(b.marca));
}

/* ------------------------------ TELAS ------------------------------ */
function render() {
  const telas = { login: tLogin, resumo: tResumo, lista: tLista, visita: tVisita };
  $app.innerHTML = (S.tela !== 'login' ? cabecalho() : '') + (telas[S.tela] || tLogin)() + (S.modal || '');
  if (S.tela === 'lista' && S._focoBusca) { const b = document.getElementById('busca'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }
}
function cabecalho() {
  const on = navigator.onLine;
  return `<header class="top"><img class="marca" src="img/icone-192.png" alt="">
    <div class="quem"><b>${esc(S.usuario.nome || S.usuario.login)}</b><small>${esc(perfilCfg().nome)}</small></div>
    <div class="st ${on ? 'on' : 'off'}">${S.sincronizando ? '⟳ sincronizando' : on ? '● online' : '● offline'}${S.outbox.length ? ` · ${S.outbox.length} pendente(s)` : ''}</div></header>`;
}
function tLogin() {
  return `<section class="login"><div class="logo"><img src="img/logo.png" alt="Lince Distribuidora"><span>Rotas de campo</span></div>
    ${S.msg ? `<div class="aviso erro">${esc(S.msg)}</div>` : ''}
    <form id="fLogin"><label>Login<input name="login" autocomplete="username" autocapitalize="none" required value="${esc(S._login || S.usuario?.login || '')}"></label>
      <label>Senha<input name="senha" type="password" autocomplete="current-password" required></label><button class="btn pri" type="submit">Entrar</button></form>
    <p class="dica">Executivo de Chopp e Promotor. No primeiro acesso é preciso internet para baixar a base.</p>
    <p class="dica" style="text-align:center">versão ${VERSAO_APP}</p></section>`;
}
async function fazerLogin(form) {
  const login = form.login.value.trim(), senha = form.senha.value; S._login = login; S.msg = 'Entrando...'; render();
  try {
    const r = await API.chamar({ acao: 'login', login, senha });
    if (!r.ok) { S.msg = r.erro; return render(); }
    if (S.usuario && S.usuario.login !== r.usuario.login) { await DB.clear(); S.outbox = []; S.visitasServ = []; S.enviados = []; S.draft = null; S.pacote = null; }
    S.token = r.token; S.usuario = r.usuario; await DB.set('token', r.token); await DB.set('usuario', r.usuario);
    S.msg = 'Baixando a base...'; render();
    const d = await API.chamar({ acao: 'dados', token: S.token }, 180000);
    if (!d.ok) { S.msg = d.erro; return render(); }
    await DB.set('pacote', d.pacote); carregarPacote(d.pacote);
    S.msg = null; S.tela = 'resumo'; render(); sincronizar();
  } catch (e) { S.msg = e.message === 'OFFLINE' ? 'Sem internet. Conecte-se para o primeiro acesso.' : 'Falha: ' + e.message; render(); }
}
function tResumo() {
  const vs = minhasVisitas(), rotas = perfilCfg().rotas;
  return `<section>
    ${S.draft ? `<div class="aviso info">Visita em andamento: <b>${esc(S.draft.fantasia)}</b> (${esc(ROTAS[S.draft.rota].curto)}).
      <div class="lin" style="margin-top:6px"><button class="btn peq pri" data-acao="continuar">Continuar</button><button class="btn peq" data-acao="descartar">Descartar</button></div></div>` : ''}
    <h2>Visitas de ${mesAtual().split('-').reverse().join('/')}</h2>
    <div class="cards-rota">${rotas.map(k => { const n = vs.filter(v => v.rota === k).length, m = METAS[k];
      return `<button class="card rota-card" data-acao="escolherRota" data-v="${k}"><span class="ic">${ROTAS[k].icone}</span><b>${esc(ROTAS[k].nome)}</b>
        <span class="big">${n}${m ? `<small>/${m}</small>` : ''}</span><small>${m ? (n >= m ? '✔ meta batida' : 'faltam ' + (m - n)) : 'visita(s) no mês'} · ${esc(ROTAS[k].desc)}</small></button>`; }).join('')}</div>
    <p class="dica">Toque numa rota para escolher o PDV e iniciar a visita.</p>
    <h3>Minhas visitas do mês (${vs.length})</h3>
    <ul class="lista">${vs.slice(0, 60).map(v => `<li><div style="flex:1"><b>${esc(v.cod)} – ${esc(v.fantasia || (S.porCod[v.cod] || {}).fantasia || '')}</b>
      <small>${esc(v.data)} · ${esc((ROTAS[v.rota] || {}).curto || v.rota)}</small></div>
      ${v.pendente ? `<span class="tag pend">${v.erroEnvio ? '⚠ ' + esc(v.erroEnvio) : 'pendente'}</span>` : v.pdf && /^https/.test(v.pdf) ? `<a class="tag ok" href="${esc(v.pdf)}" target="_blank">PDF</a>` : '<span class="tag ok">enviada</span>'}</li>`).join('') || '<li><small>Nenhuma visita ainda.</small></li>'}</ul>
    <div class="lin" style="margin-top:12px"><button class="btn" data-acao="sync">⟳ Sincronizar</button><button class="btn" data-acao="sair">Sair</button></div>
    <p class="dica">Base atualizada em ${esc(S.pacote.atualizado || '–')}.</p></section>`;
}
function tLista() {
  const f = S.filtros, base = clientesDaRota(S.rota), bv = base.filter(c => !f.vend || c.vend === f.vend), bd = bv.filter(c => !f.dia || c.dia === f.dia);
  const l = filtrados(), mostrar = l.slice(0, 150), rt = ROTAS[S.rota];
  const sel = (k, rot, opts) => `<label>${rot}<select data-filtro="${k}"><option value="">Todos</option>${opts.map(x => `<option ${x === f[k] ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
  const dias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].filter(d => bv.some(c => c.dia === d)).concat(uniq(bv.map(c => c.dia)).filter(d => !/^(Segunda|Terça|Quarta|Quinta|Sexta|Sábado)$/.test(d)));
  return `<section><button class="voltar" data-acao="ir" data-v="resumo">‹ Resumo</button>
    <h2>${rt.icone} ${esc(rt.nome)}</h2>
    <div class="filtros">${sel('vend', 'Vendedor', uniq(base.map(c => c.vend)))}${sel('dia', 'Rota (dia)', dias)}${sel('cidade', 'Cidade', uniq(bd.map(c => c.cidade)))}</div>
    <input id="busca" class="busca" type="search" placeholder="Buscar código ou nome" value="${esc(f.busca)}" data-filtro="busca">
    ${S.rota === 'CONQUISTA' ? '<button class="btn peq" data-acao="pdvNovo">+ PDV sem cadastro</button>' : ''}
    <p class="dica">${l.length} PDV(s)${l.length > 150 ? ' – mostrando 150, use os filtros' : ''}</p>
    <ul class="lista pdvs">${mostrar.map(c => { const vis = visitasPdv(c.cod, S.rota);
      return `<li class="${vis.length ? 'feito' : ''}" data-acao="abrirPdv" data-v="${esc(c.cod)}"><span class="ck">${vis.length ? '✔' : ''}</span>
        <div><b>${esc(c.cod)} – ${esc(c.fantasia)}</b><small>${esc(c.canal)} · ${esc(c.cidade)} · vend ${esc(c.vend)} · ${esc(c.dia)}</small>${infoLinha(c)}</div></li>`; }).join('')}</ul></section>`;
}
function infoLinha(c) {
  const P = S.pacote;
  if (S.rota === 'CHOPP') {
    const ch = P.chop[c.cod] || {}, pior = (ch.comod || []).reduce((m, x) => Math.min(m, x[5]), 99999), sm = pior < 99999 ? semaforo(pior) : null;
    const pct = ch.meta ? Math.round(ch.real[0] / ch.meta * 100) : null, ad = choppDoPdv(c.cod).some(x => x.aderido);
    return `<small class="vol">Meta ${n1(ch.meta)} · real ${nomeMes(0)} ${n1((ch.real || [])[0])}${pct != null ? ` (${pct}%)` : ''}${sm ? ` · <span class="${sm.cor}">● ${esc(sm.txt)}</span>` : ''}${ad ? ' · <b>aderido</b>' : ''}</small>`;
  }
  if (S.rota === 'PROMOTOR') {
    const f = P.fds[c.cod] || []; if (!f.length) return '';
    return `<small class="vol">FDS ${nomeMes(1)} ${f.filter(x => x[4]).length}/${f.length} · ${nomeMes(0)} ${f.filter(x => x[1]).length}/${f.length}</small>`;
  }
  return '';
}
function modalPdv(cod) {
  const c = S.porCod[cod], vis = visitasPdv(cod, S.rota);
  S.modal = `<div class="modal" data-acao="fecharModal"><div class="caixa">
    <h3>${esc(c.cod)} – ${esc(c.fantasia)}</h3><p><small>${esc(c.razao)}</small></p>
    <ul class="rev"><li>Canal<b>${esc(c.canal)}</b></li><li>Cidade<b>${esc(c.cidade)}</b></li><li>Vendedor / supervisor<b>${esc(c.vend)} / ${esc(c.sup)}</b></li><li>Rota<b>${esc(c.dia)} (pasta ${esc(c.pasta)})</b></li></ul>
    ${vis.length ? `<div class="aviso info">Você já visitou este PDV neste mês (${vis.map(v => esc(v.data)).join(', ')}). Pode registrar outra visita.</div>` : ''}
    <div class="lin"><button class="btn" data-acao="fecharModal">Cancelar</button><button class="btn pri" data-acao="iniciar" data-v="${esc(cod)}">Iniciar visita ›</button></div></div></div>`;
  render();
}
function novaVisita(cod) {
  const c = S.porCod[cod];
  S.draft = { id: uid(), rota: S.rota, cod, fantasia: c.fantasia, razao: c.razao, vend: c.vend, sup: c.sup, cidade: c.cidade, dia: c.dia, canal: c.canal,
    data: hoje(), mes: mesAtual(), fotos: [], r: { marcas: {}, conc: [{}, {}, {}], fds: {}, fluxos: {} } };
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => { if (S.draft) { S.draft.lat = p.coords.latitude; S.draft.lng = p.coords.longitude; salvarRascunho(); } }, () => {}, { timeout: 8000 });
  S.modal = null; S.tela = 'visita'; salvarRascunho(); render(); scrollTo(0, 0);
}
let _tmr; function salvarRascunho() { clearTimeout(_tmr); _tmr = setTimeout(() => { if (S.draft) DB.set('rascunho', S.draft); }, 300); }

/* ---- componentes de formulário ---- */
const radio = (path, opts) => { const v = getPath(R(), path); const vert = opts.some(o => String(Array.isArray(o) ? o[1] : o).length > 14);
  return `<div class="seg${vert ? ' vert' : ''}">${opts.map(o => { const [val, rot] = Array.isArray(o) ? o : [o, o];
  return `<label class="${v === val ? 'on' : ''}"><input type="radio" name="${path}" value="${esc(val)}" ${v === val ? 'checked' : ''} data-k="${path}">${esc(rot)}</label>`; }).join('')}</div>`; };
const SN = [['S', 'Sim'], ['N', 'Não']];
const pergunta = (txt, inner, req = true) => `<div class="campo"><b>${txt}${req ? ' *' : ''}</b>${inner}</div>`;
const texto = (path, rot, ph = '', req) => `<label class="campo">${rot}${req ? ' *' : ''}<textarea data-k="${path}" rows="3" placeholder="${esc(ph)}">${esc(getPath(R(), path) || '')}</textarea></label>`;
const linhaTxt = (path, rot, ph = '', tipo = 'text') => `<label class="num">${rot}<input type="${tipo}" ${tipo === 'number' ? 'inputmode="decimal" step="0.01"' : ''} data-k="${path}" value="${esc(getPath(R(), path) ?? '')}" placeholder="${esc(ph)}"></label>`;
const fotoBtn = (tipo, rot, req) => { const fs = S.draft.fotos.filter(f => f.tipo === tipo);
  return `<div class="fotos">${fs.map(f => `<div class="mini"><img src="${f.dados}"><button data-acao="delFoto" data-v="${S.draft.fotos.indexOf(f)}">×</button></div>`).join('')}
    <label class="btn ${req && !fs.length ? 'falta-foto' : ''}">📷 ${rot}${req ? ' *' : ''}<input type="file" accept="image/*" capture="environment" data-foto="${tipo}" hidden></label></div>`; };
const temFoto = t => S.draft.fotos.some(f => f.tipo === t);
const card = (titulo, corpo, cls = '') => `<div class="card ${cls}"><h3>${titulo}</h3>${corpo}</div>`;

function tVisita() {
  const d = S.draft, rt = ROTAS[d.rota], erros = validar();
  const corpo = d.rota === 'CHOPP' ? fChopp() : d.rota === 'CONQUISTA' ? fConquista() : fPromotor();
  return `<section class="visita"><button class="voltar" data-acao="sairVisita">‹ Resumo (a visita fica salva)</button>
    <div class="card pdvcab"><b>${esc(d.cod)} – ${esc(d.fantasia)}</b><small>${rt.icone} ${esc(rt.nome)} · ${esc(d.canal)} · ${esc(d.cidade)} · vend ${esc(d.vend)} · sup ${esc(d.sup)} · ${esc(d.dia)}</small></div>
    ${corpo}
    ${erros.length ? `<div class="aviso erro"><b>Falta preencher:</b><ul>${erros.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '<div class="aviso ok">Tudo certo! A visita fica salva no aparelho e é enviada quando houver internet.</div>'}
    <div class="navfix"><button class="btn" data-acao="sairVisita">Sair</button><button class="btn pri" data-acao="salvar">Salvar visita ✔</button></div></section>`;
}

/* ---- ROTA ROTINA CHOPP ---- */
function fChopp() {
  const d = S.draft, r = R(), P = S.pacote, ch = P.chop[d.cod] || { meta: 0, real: [0, 0, 0, 0], comod: [] }, lista = choppDoPdv(d.cod);
  let h = card('Lembre-se da rotina básica', `<ul class="rotina">${ROTINA_CHOPP.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="dica"><b>O intuito é auxiliar o cliente a vender mais!</b></p>`, 'lembrete');
  h += card('Acesso', pergunta('Conseguiu acesso ao PDV?', radio('acesso', SN)) +
    (r.acesso === 'N' ? texto('motivoSemAcesso', 'Por que não conseguiu acesso?', 'Ex.: PDV fechado, responsável ausente...', true) + fotoBtn('fachada', 'Foto da fachada') : ''));
  if (r.acesso !== 'S') return h + (r.acesso === 'N' ? card('Anotação', texto('oport', 'Oportunidade no PDV / anotação', '', true)) : '');
  h += card('Precificação', pergunta('Cliente possui a precificação do chopp no cardápio?', radio('cardapio', SN)) + fotoBtn('cardapio', 'Foto do cardápio', r.cardapio === 'S'));
  // marcas nossas (exp)
  const linhas = lista.map(m => {
    const k = 'marcas.' + m.cod, x = r.marcas[m.cod] || {}, copo = num(x.copo), pc = num(x.precoCopo), litroPonta = copo && pc ? pc / (copo / 1000) : null;
    const margem = litroPonta && m.litro ? (litroPonta - m.litro) / m.litro * 100 : null;
    const meses = [[4, 2], [2, 1], [1, 0]].map(([b, i]) => `<i class="mes ${m.bits & b ? 'on' : ''}">${nomeMes(i)}</i>`).join('');
    return `<div class="card marca ${m.noMes ? '' : 'antiga'}"><div class="lin sp"><b>${esc(m.marca)} ${m.litros}L</b><span class="tag ${m.aderido ? 'ok' : 'alerta'}">${m.aderido ? 'ADERIDO' : 'NÃO ADERIDO'} · tab ${esc(m.tab)}</span></div>
      <div class="meses">${meses}<small>última compra ${esc(m.ult)} · ${n1(m.qtd[0])} barril(is) em ${nomeMes(0)}</small></div>
      <div class="grid4"><span>Preço barril<b>${rs(m.preco)}</b></span><span>Preço por litro<b>${rs(m.litro)}</b></span><span>Na ponta (R$/L)<b>${rs(litroPonta)}</b></span></div>
      ${m.noMes ? `<div class="lin">${linhaTxt(k + '.copo', 'Volume do copo (ml) *', 'ex.: 300', 'number')}${linhaTxt(k + '.precoCopo', 'Preço do copo R$ *', 'ex.: 9,90', 'number')}</div>
        ${margem != null ? `<small>Margem do PDV sobre o custo por litro: <b class="${margem < 0 ? 'erro' : 'sobe'}">${n1(margem)}%</b></small>` : ''}
        ${m.aderido ? pergunta('Está praticando o preço aderido na ponta?', radio(k + '.praticando', SN)) : ''}`
        : `<div class="aviso alerta">Comprou em ${[[4, 2], [2, 1]].filter(([b]) => m.bits & b).map(([, i]) => nomeMes(i)).join('/')}, mas ainda não em ${nomeMes(0)}.</div>
        ${pergunta('Ainda tem essa marca no PDV?', radio(k + '.aindaTem', SN))}${texto(k + '.porque', 'Por que não compra mais?', 'Ex.: giro baixo, preço, concorrência...', true)}`}</div>`;
  }).join('');
  h += card('Chopp da casa – marcas que o cliente trabalha', lista.length ? `<p class="dica">Vem do EXP (últimos 3 meses). Aderido = Tab. Preço 459, 349 ou 350. Preço por litro = preço do barril ÷ litros.</p>${linhas}`
    : '<div class="aviso info">Nenhuma compra de chopp nos últimos 3 meses no EXP.</div>' + texto('obsSemCompra', 'Observação', 'Por que o cliente não comprou chopp?', true));
  // concorrência
  h += card('Concorrência', pergunta('Cliente trabalha com outro chopp da concorrência?', radio('concorrencia', SN)) + (r.concorrencia === 'S' ? r.conc.map((c, i) => `<div class="lin conc">
      <label class="num">Marca${i ? '' : ' *'}<select data-k="conc.${i}.marca" data-rr><option value="">–</option>${MARCAS_CONC.map(m => `<option ${c.marca === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      ${c.marca === 'Outra' ? linhaTxt(`conc.${i}.outra`, 'Qual?') : ''}
      <label class="num">Barril<select data-k="conc.${i}.litros"><option value="">–</option>${['30', '50'].map(l => `<option ${c.litros === l ? 'selected' : ''} value="${l}">${l}L</option>`).join('')}</select></label>
      ${linhaTxt(`conc.${i}.precoL`, 'Preço R$/L' + (i ? '' : ' *'), 'ex.: 12,90', 'number')}</div>`).join('') : ''));
  // comodato
  const com = ch.comod || [], precisaPlano = com.some(x => semaforo(x[5]).plano);
  h += card('Comodato da chopeira', com.length ? com.map(x => { const s = semaforo(x[5]);
    return `<div class="ativo"><b>${esc(x[0])}</b> <small>comodato ${esc(x[1])} · qtd ${n1(x[4])}</small>
      <div class="grid4"><span>Emissão<b>${esc(x[2])}</b></span><span>Vencimento<b>${esc(x[3])}</b></span><span>Situação<b class="${s.cor}">● ${esc(s.txt)}</b></span></div></div>`; }).join('') +
    (precisaPlano ? `<div class="aviso alerta">Comodato vencido ou vencendo em até ${DIAS_ALERTA_COMODATO} dias: defina o plano de ação.</div>
      ${pergunta('Plano de ação do comodato', radio('planoComodato', PLANOS_COMODATO))}${texto('planoComodatoTxt', 'Detalhe do plano', 'Ex.: levar contrato para assinatura até dd/mm', true)}` : '')
    : '<small>Nenhum comodato de chopeira na base.</small>');
  // meta
  const pct = ch.meta ? Math.round(ch.real[0] / ch.meta * 100) : null;
  h += card('Meta da chopeira', ch.meta ? `<div class="grid4"><span>Meta do mês<b>${n1(ch.meta)}</b></span><span>Real ${nomeMes(0)}<b class="${ch.real[0] >= ch.meta ? 'sobe' : 'erro'}">${n1(ch.real[0])} (${pct}%)</b></span>
      <span>${nomeMes(1)}<b>${n1(ch.real[1])}</b></span><span>${nomeMes(2)}<b>${n1(ch.real[2])}</b></span><span>${nomeMes(3)}<b>${n1(ch.real[3])}</b></span></div>
      <small>${ch.real[0] >= ch.meta ? '✔ Bateu a meta da chopeira.' : 'Abaixo da meta: o mês ainda está em andamento.'}</small>` : '<small>Sem meta cadastrada (aba chopeiras_giro).</small>');
  h += card('Assepsia', fotoBtn('assepsia', 'Evidência da assepsia', true));
  h += card('Fechamento', texto('comentario', 'Comentário do cliente', '', true) + texto('oport', 'Oportunidade no PDV / anotação', '', true));
  return h;
}
/* ---- PDV CONQUISTA ---- */
function fConquista() {
  const r = R();
  return card('Motivo da visita', radio('motivo', MOTIVOS_CONQUISTA) + (r.motivo === 'Outro' ? texto('motivoOutro', 'Qual?', '', true) : '')) +
    card('Chopp no PDV', linhaTxt('volume', 'Se o cliente trabalha com chopp, qual o volume?', 'ex.: 4 barris de 50L por mês')) +
    card('Oportunidade', texto('descricao', 'Descrição / oportunidade identificada', '', true) + fotoBtn('fachada', 'Foto do PDV'));
}
/* ---- ROTA PROMOTOR ---- */
function fPromotor() {
  const d = S.draft, r = R(), f = S.pacote.fds[d.cod] || [];
  let h = card('Passos do promotor', `<ol class="rotina">${PASSOS_PROMOTOR.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`, 'lembrete');
  h += card('P – Presença (gôndola e geladeira)', f.length ? `<p class="dica">Automático: ${nomeMes(1)} = comprou no mês anterior · ${nomeMes(0)} = FDS do mês. Assinale onde o item está exposto.</p>
    <ul class="lista fds2">${f.map(x => { const k = 'fds.' + x[0], v = r.fds[x[0]] || {};
      return `<li><div style="flex:1"><b>${esc(NOMES_FDS[x[0]] || x[0])}</b><small><span class="${x[4] ? 'sobe' : 'erro'}">${nomeMes(1)} ${x[4] ? '✔' : '✘'}</span> · <span class="${x[1] ? 'sobe' : 'erro'}">${nomeMes(0)} ${x[1] ? '✔' : '✘'}</span></small></div>
        <label class="chk"><input type="checkbox" data-k="${k}.gondola" ${v.gondola ? 'checked' : ''}> Gôndola</label><label class="chk"><input type="checkbox" data-k="${k}.geladeira" ${v.geladeira ? 'checked' : ''}> Geladeira</label></li>`; }).join('')}</ul>`
    : '<small>PDV sem matriz FDS neste mês.</small>');
  [...FLUXOS, FLUXO_GELADEIRA].forEach(([k, nome, img]) => {
    const v = (r.fluxos[k] || {}).res, q = k === 'geladeira' ? 'Conseguiu realizar a execução da geladeira?' : 'Conseguiu criar o fluxo de execução?';
    h += card(nome, `<a href="${img}" target="_blank"><img class="ref" src="${img}" alt="${esc(nome)}"></a><small class="dica">Toque na imagem para ampliar.</small>${pergunta(q, radio(`fluxos.${k}.res`, ['Sim', 'Não', 'Outro']))}
      ${v === 'Outro' ? linhaTxt(`fluxos.${k}.outro`, 'Descreva *') : ''}${v === 'Não' ? linhaTxt(`fluxos.${k}.motivo`, 'Por quê? *') : ''}${fotoBtn('fluxo_' + k, 'Foto da execução', v === 'Sim')}`);
  });
  h += card('Checagem final', pergunta('Há presença de materiais de visibilidade?', radio('visibilidade', SN)) + pergunta('Todos os produtos estão precificados?', radio('precificados', SN)) +
    pergunta('O cliente possui algum produto vencido ou próximo ao vencimento?', radio('vencido', SN)) +
    (r.vencido === 'S' ? pergunta('Já enviou no grupo AS + PROMOTOR?', radio('enviouGrupo', SN)) : '') + texto('obs', 'Observação (opcional)'));
  return h;
}

/* ---- validação ---- */
function validar() {
  const d = S.draft, r = R(), e = [], t = (v, n = 3) => String(v || '').trim().length >= n;
  if (d.rota === 'CHOPP') {
    if (!r.acesso) return ['Informe se conseguiu acesso ao PDV'];
    if (r.acesso === 'N') { if (!t(r.motivoSemAcesso)) e.push('Motivo de não ter acesso'); if (!t(r.oport)) e.push('Oportunidade / anotação'); return e; }
    if (!r.cardapio) e.push('Precificação do chopp no cardápio'); else if (r.cardapio === 'S' && !temFoto('cardapio')) e.push('Foto do cardápio');
    const lista = choppDoPdv(d.cod);
    lista.forEach(m => { const x = r.marcas[m.cod] || {};
      if (m.noMes) { if (!num(x.copo) || !num(x.precoCopo)) e.push(`${m.marca} ${m.litros}L: volume e preço do copo`); if (m.aderido && !x.praticando) e.push(`${m.marca}: está praticando o preço aderido?`); }
      else { if (!x.aindaTem) e.push(`${m.marca}: ainda tem no PDV?`); if (!t(x.porque)) e.push(`${m.marca}: por que não compra mais?`); } });
    if (!lista.length && !t(r.obsSemCompra)) e.push('Observação: cliente sem compra de chopp');
    if (!r.concorrencia) e.push('Chopp da concorrência'); else if (r.concorrencia === 'S' && !(r.conc[0].marca && num(r.conc[0].precoL))) e.push('Marca e preço por litro da concorrência');
    const com = (S.pacote.chop[d.cod] || {}).comod || [];
    if (com.some(x => semaforo(x[5]).plano) && (!r.planoComodato || !t(r.planoComodatoTxt))) e.push('Plano de ação do comodato');
    if (!temFoto('assepsia')) e.push('Foto da assepsia');
    if (!t(r.comentario)) e.push('Comentário do cliente'); if (!t(r.oport)) e.push('Oportunidade no PDV / anotação');
  }
  if (d.rota === 'CONQUISTA') {
    if (!r.motivo) e.push('Motivo da visita'); else if (r.motivo === 'Outro' && !t(r.motivoOutro)) e.push('Descreva o outro motivo');
    if (!t(r.descricao)) e.push('Descrição / oportunidade identificada');
  }
  if (d.rota === 'PROMOTOR') {
    [...FLUXOS, FLUXO_GELADEIRA].forEach(([k, nome]) => { const x = r.fluxos[k] || {};
      if (!x.res) e.push(`${nome}: conseguiu executar?`);
      else if (x.res === 'Sim' && !temFoto('fluxo_' + k)) e.push(`${nome}: foto da execução`);
      else if (x.res === 'Outro' && !t(x.outro)) e.push(`${nome}: descreva`);
      else if (x.res === 'Não' && !t(x.motivo)) e.push(`${nome}: por quê?`); });
    if (!r.visibilidade) e.push('Presença de materiais de visibilidade'); if (!r.precificados) e.push('Produtos precificados');
    if (!r.vencido) e.push('Produto vencido ou próximo ao vencimento'); else if (r.vencido === 'S' && !r.enviouGrupo) e.push('Enviou no grupo AS + PROMOTOR?');
  }
  return e;
}

/* ---- espelho para o PDF: [[seção, [[pergunta, resposta]]]] ---- */
const sn = v => v === 'S' ? 'Sim' : v === 'N' ? 'Não' : (v || '–');
function espelho() {
  const d = S.draft, r = R(), out = [];
  if (d.rota === 'CHOPP') {
    out.push(['Acesso', [['Conseguiu acesso ao PDV?', sn(r.acesso)]].concat(r.acesso === 'N' ? [['Motivo', r.motivoSemAcesso]] : [])]);
    if (r.acesso === 'S') {
      out.push(['Precificação', [['Precificação do chopp no cardápio?', sn(r.cardapio)]]]);
      const l = choppDoPdv(d.cod);
      out.push(['Chopp da casa (EXP)', l.length ? [].concat(...l.map(m => { const x = r.marcas[m.cod] || {}, copo = num(x.copo), pc = num(x.precoCopo), lp = copo && pc ? pc / (copo / 1000) : null;
        const base = [[`${m.marca} ${m.litros}L`, `${m.aderido ? 'ADERIDO' : 'NÃO ADERIDO'} (tab ${m.tab}) · barril ${rs(m.preco)} · ${rs(m.litro)}/L · última compra ${m.ult}`]];
        return m.noMes ? base.concat([[`${m.marca}: copo`, copo ? `${copo} ml a ${rs(pc)} = ${rs(lp)}/L na ponta${lp && m.litro ? ' (margem ' + n1((lp - m.litro) / m.litro * 100) + '%)' : ''}` : '–']],
          m.aderido ? [[`${m.marca}: praticando o preço aderido?`, sn(x.praticando)]] : [])
          : base.concat([[`${m.marca}: ainda tem no PDV?`, sn(x.aindaTem)], [`${m.marca}: por que não compra mais?`, x.porque || '–']]); }))
        : [['Compras de chopp', 'Nenhuma nos últimos 3 meses'], ['Observação', r.obsSemCompra]]]);
      out.push(['Concorrência', [['Trabalha com chopp da concorrência?', sn(r.concorrencia)]].concat(r.concorrencia === 'S' ? r.conc.filter(c => c.marca).map(c => [c.marca === 'Outra' ? c.outra : c.marca, `${c.litros ? c.litros + 'L · ' : ''}${rs(num(c.precoL))}/L`]) : [])]);
      const ch = S.pacote.chop[d.cod] || { comod: [], real: [] };
      out.push(['Comodato e meta da chopeira', (ch.comod || []).map(x => [x[0] + ' (' + x[1] + ')', (x[5] < 0 ? 'Vencido' : x[5] <= DIAS_ALERTA_COMODATO ? 'Vence em ' + x[5] + ' dia(s)' : 'OK') + ' · vencimento ' + x[3] + (x[5] < 0 ? ' (há ' + (-x[5]) + ' dias)' : '')])
        .concat(r.planoComodato ? [['Plano de ação do comodato', r.planoComodato + ' – ' + (r.planoComodatoTxt || '')]] : [])
        .concat(ch.meta ? [['Meta x real ' + nomeMes(0), (ch.real[0] >= ch.meta ? 'Bateu' : 'Abaixo') + ': ' + n1(ch.real[0]) + ' de ' + n1(ch.meta) + ' (' + Math.round(ch.real[0] / ch.meta * 100) + '%)'],
          ['Histórico', `${nomeMes(1)} ${n1(ch.real[1])} · ${nomeMes(2)} ${n1(ch.real[2])} · ${nomeMes(3)} ${n1(ch.real[3])}`]] : [])]);
      out.push(['Assepsia', [['Evidência da assepsia', temFoto('assepsia') ? 'Sim (foto)' : 'Não']]]);
      out.push(['Fechamento', [['Comentário do cliente', r.comentario], ['Oportunidade / anotação', r.oport]]]);
    } else out.push(['Anotação', [['Oportunidade / anotação', r.oport]]]);
  }
  if (d.rota === 'CONQUISTA') out.push(['PDV Conquista', [['Motivo da visita', r.motivo === 'Outro' ? 'Outro: ' + r.motivoOutro : r.motivo], ['Volume de chopp (se trabalha)', r.volume || '–'], ['Descrição / oportunidade', r.descricao]]]);
  if (d.rota === 'PROMOTOR') {
    const f = S.pacote.fds[d.cod] || [];
    out.push(['P – Presença', f.map(x => { const v = r.fds[x[0]] || {}; return [NOMES_FDS[x[0]] || x[0], `${nomeMes(1)} ${x[4] ? '✔' : '✘'} · ${nomeMes(0)} ${x[1] ? '✔' : '✘'} · exposto: ${[v.gondola ? 'gôndola' : '', v.geladeira ? 'geladeira' : ''].filter(Boolean).join(' e ') || '–'}`]; })]);
    out.push(['Fluxos de execução', [...FLUXOS, FLUXO_GELADEIRA].map(([k, nome]) => { const x = r.fluxos[k] || {}; return [nome, (x.res || '–') + (x.outro ? ': ' + x.outro : '') + (x.motivo ? ': ' + x.motivo : '') + (temFoto('fluxo_' + k) ? ' (foto)' : '')]; })]);
    out.push(['Checagem final', [['Materiais de visibilidade', sn(r.visibilidade)], ['Todos os produtos precificados', sn(r.precificados)], ['Produto vencido / próximo ao vencimento', sn(r.vencido)]]
      .concat(r.vencido === 'S' ? [['Enviou no grupo AS + PROMOTOR', sn(r.enviouGrupo)]] : []).concat(r.obs ? [['Observação', r.obs]] : [])]);
  }
  return out;
}
function resumoTxt() {
  const d = S.draft, r = R();
  if (d.rota === 'CHOPP') return r.acesso === 'N' ? 'Sem acesso: ' + (r.motivoSemAcesso || '') : `Cardápio ${sn(r.cardapio)} · concorrência ${sn(r.concorrencia)} · ${r.oport || ''}`;
  if (d.rota === 'CONQUISTA') return (r.motivo || '') + ' · ' + (r.descricao || '');
  return [...FLUXOS, FLUXO_GELADEIRA].map(([k, n]) => n + ': ' + ((r.fluxos[k] || {}).res || '–')).join(' · ');
}
async function salvarVisita() {
  const e = validar(); if (e.length) { alert('Falta preencher:\n- ' + e.join('\n- ')); return; }
  const d = S.draft; d.espelho = espelho(); d.resumoTxt = resumoTxt(); d.respostas = d.r;
  S.outbox.push(d); await DB.set('outbox', S.outbox);
  S.draft = null; await DB.del('rascunho'); S.tela = 'resumo'; render(); scrollTo(0, 0); sincronizar();
}
function comprimir(file) {
  return new Promise((ok, err) => { const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 1280 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = img.width * k; cv.height = img.height * k; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.7)); };
    img.onerror = err; img.src = url; });
}

/* ---------------------------- EVENTOS ---------------------------- */
document.addEventListener('submit', e => { if (e.target.id === 'fLogin') { e.preventDefault(); fazerLogin(e.target); } });
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-acao]'); if (!el) return;
  const a = el.dataset.acao, v = el.dataset.v;
  switch (a) {
    case 'ir': S.tela = v; S.modal = null; scrollTo(0, 0); break;
    case 'escolherRota': if (S.draft && !confirm('Há uma visita em andamento. Abrir outra rota mesmo assim? (a visita continua salva)')) return;
      S.rota = v; S.filtros = { vend: '', dia: '', cidade: '', busca: '' }; S.tela = 'lista'; scrollTo(0, 0); break;
    case 'abrirPdv': return modalPdv(v);
    case 'fecharModal': if (el.classList.contains('modal') && e.target.closest('.caixa')) return; S.modal = null; break;
    case 'iniciar': return novaVisita(v);
    case 'pdvNovo': { const nome = prompt('Nome do PDV (sem cadastro):'); if (!nome) return; const cid = prompt('Cidade:') || '';
      const cod = 'NOVO-' + Date.now().toString(36).slice(-4).toUpperCase(); S.porCod[cod] = { cod, fantasia: nome, razao: 'PDV sem cadastro', vend: '', sup: '', cidade: cid, dia: '', canal: '', pasta: '' };
      return novaVisita(cod); }
    case 'continuar': S.rota = S.draft.rota; S.tela = 'visita'; scrollTo(0, 0); break;
    case 'descartar': if (!confirm('Descartar a visita em andamento?')) return; S.draft = null; await DB.del('rascunho'); break;
    case 'sairVisita': salvarRascunho(); S.tela = 'resumo'; scrollTo(0, 0); break;
    case 'salvar': return salvarVisita();
    case 'delFoto': S.draft.fotos.splice(Number(v), 1); salvarRascunho(); break;
    case 'sync': return sincronizar(true);
    case 'sair': return sair();
    default: return;
  }
  render();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.filtro === 'busca') { S.filtros.busca = t.value; S._focoBusca = true; clearTimeout(S._tb); S._tb = setTimeout(render, 250); return; }
  if (t.dataset.k && (t.tagName === 'TEXTAREA' || t.type === 'number' || t.type === 'text')) { setPath(R(), t.dataset.k, t.value); salvarRascunho();
    if (t.type === 'number') { clearTimeout(S._tn); S._tn = setTimeout(() => { const y = scrollY, id = t.dataset.k; render(); scrollTo(0, y); const n = document.querySelector(`[data-k="${id}"]`); if (n) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (_) {} } }, 700); } }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.dataset.filtro && t.dataset.filtro !== 'busca') { S.filtros[t.dataset.filtro] = t.value; if (t.dataset.filtro === 'vend') { S.filtros.dia = ''; S.filtros.cidade = ''; } if (t.dataset.filtro === 'dia') S.filtros.cidade = ''; S._focoBusca = false; return render(); }
  if (t.dataset.foto) { for (const f of t.files) S.draft.fotos.push({ tipo: t.dataset.foto, dados: await comprimir(f) }); salvarRascunho(); const y = scrollY; render(); return scrollTo(0, y); }
  if (t.dataset.k) {
    setPath(R(), t.dataset.k, t.type === 'checkbox' ? t.checked : t.value); salvarRascunho();
    if (t.type === 'radio' || t.tagName === 'SELECT' || t.type === 'checkbox') { const y = scrollY; render(); scrollTo(0, y); }
  }
});
iniciar();
