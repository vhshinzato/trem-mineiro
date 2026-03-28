/* js/db.js — Camada de acesso ao Supabase
   Carrega o cardápio (Fase 1) e os dados admin sob demanda (Fase 2). */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPA_URL, SUPA_KEY, WHATSAPP_DEFAULT,
         CATEGORIAS_PADRAO, PRODUTOS_PADRAO, USUARIOS_PADRAO } from './config.js';

export function carregarDados(chave, padrao) {
  try { var r = localStorage.getItem(chave); return r ? JSON.parse(r) : padrao; }
  catch { return padrao; }
}
export function salvarDados(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch(e) {}
}

// ── Estado compartilhado ──────────────────────────────────────
// Objeto único referenciado por db.js e app.js.
// Mutações em qualquer lado são visíveis no outro.
export const state = {
  categorias: [],
  produtos: [],
  config: { whatsapp: WHATSAPP_DEFAULT, logo: '', heroMedia: [] },
  usuarios: [],
  fornecedores: [],
  clientes: [],
  pedidos: [],
  estoque: {},
  movimentos: [],
  _adminCarregado: false,
  sessao: carregarDados('sm_sessao',         null),
  sessaoCliente: carregarDados('sm_sessao_cliente', null),
};

const sb = createClient(SUPA_URL, SUPA_KEY);

/* ============================================================
   SUPABASE — camada de dados com lazy loading
============================================================ */

// ── Estado público (carregado na abertura) ────────────────

// ── Estado admin (carregado lazy ao abrir o painel) ───────

// Sessão — sempre local

/* ── FASE 1: carrega só cardápio público (rápido) ─────── */
export async function carregarDoSupabase() {
  document.getElementById('loadingMsg').textContent = 'Conectando ao servidor...';

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 8000)
  );

  const [
    { data: cats },
    { data: prods },
    { data: cfgRow },
  ] = await Promise.race([
    Promise.all([
      sb.from('categorias').select('*').order('ordem'),
      sb.from('produtos').select('*').order('ordem'),
      sb.from('config').select('*').eq('id','main').maybeSingle(),
    ]),
    timeout
  ]);

  document.getElementById('loadingMsg').textContent = 'Preparando dados...';

  state.categorias = (cats && cats.length)
    ? cats.map(c => ({ id: c.id, nome: c.nome }))
    : CATEGORIAS_PADRAO;

  state.produtos = (prods && prods.length)
    ? prods.map(p => ({ id: p.id, categoriaId: p.categoria_id, nome: p.nome,
        descricao: p.descricao, preco: p.preco, imagem: p.imagem || '' }))
    : PRODUTOS_PADRAO;

  if (cfgRow && cfgRow.dados) {
    var d = cfgRow.dados;
    state.config = { whatsapp: d.whatsapp||WHATSAPP_DEFAULT, logo: d.logo||'', heroMedia: d.heroMedia||[] };
  }
  if (!state.config.heroMedia) state.config.heroMedia = [];

  if (!cats || !cats.length) await syncToSupabase();
}

/* ── FASE 2: carrega dados do painel admin (lazy) ─────── */
export async function carregarDadosAdmin() {
  if (state._adminCarregado) return;

  const [
    { data: estRows },
    { data: movRows },
    { data: fornRows },
    { data: cliRows },
    { data: cpRows },
    { data: pedRows },
    { data: usrRows },
  ] = await Promise.all([
    sb.from('estoque').select('*'),
    sb.from('movimentos').select('*').order('criado_em',{ascending:false}).limit(200),
    sb.from('fornecedores').select('*'),
    sb.from('clientes').select('*'),
    sb.from('compras').select('*'),
    sb.from('pedidos').select('*').order('data',{ascending:false}),
    sb.from('usuarios').select('*'),
  ]);

  state.estoque = {};
  (estRows || []).forEach(function(e) {
    state.estoque[e.produto_id] = { quantidade: e.quantidade, minimo: e.minimo, maximo: e.maximo };
  });

  state.movimentos = (movRows || []).map(function(m) { return {
    id: m.id, produtoId: m.produto_id, tipo: m.tipo,
    quantidade: m.quantidade, novoTotal: m.novo_total, obs: m.obs || '',
    fornecedor: m.fornecedor || '', dataCompra: m.data_compra || '',
    valorUnit: m.valor_unit ? parseFloat(m.valor_unit) : null,
    data: m.criado_em
  }; });

  state.fornecedores = (fornRows || []).map(function(f) { return {
    id: f.id, nome: f.nome, telefone: f.telefone || '',
    email: f.email || '', endereco: f.endereco || '',
    produtos: f.produtos || '', obs: f.obs || ''
  }; });

  state.clientes = (cliRows || []).map(function(c) { return {
    id: c.id, nome: c.nome, email: c.email || '',
    senhaHash: c.senha_hash || '', telefone: c.telefone || '',
    aniversario: c.aniversario || '', endereco: c.endereco || '', obs: c.obs || '',
    compras: (cpRows || [])
      .filter(function(cp) { return cp.cliente_id === c.id; })
      .map(function(cp) { return { id: cp.id, data: cp.data, valor: parseFloat(cp.valor)||0, produtos: cp.produtos||'' }; })
      .sort(function(a,b) { return a.data.localeCompare(b.data); })
  }; });

  state.pedidos = (pedRows || []).map(function(p) { return {
    id: p.id, numero: p.numero, status: p.status,
    clienteId: p.cliente_id||null, clienteNome: p.cliente_nome||'Cliente não identificado',
    itens: p.itens||[], total: parseFloat(p.total)||0,
    totalFinal: p.total_final ? parseFloat(p.total_final) : null,
    desconto: parseFloat(p.desconto)||0, obs: p.obs||'',
    data: p.data, dataConfirmacao: p.data_confirmacao||null
  }; });

  state.usuarios = (usrRows && usrRows.length)
    ? usrRows.map(function(u) { return { id: u.id, nome: u.nome, login: u.login, senha: u.senha, perfil: u.perfil }; })
    : USUARIOS_PADRAO;

  state._adminCarregado = true;
}

/* ── Persistir (debounced 800ms) ─────────────────────── */
var _syncTimer = null;
export function persistir() {
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async function() {
    try { await syncToSupabase(); }
    catch(err) {
      console.error('Supabase sync error:', err);
      console.error('Erro ao salvar no servidor.');
    }
  }, 800);
}






async function syncToSupabase() {
  var ops = [];
  ops.push(sb.from('config').upsert({ id: 'main', dados: state.config }));
  if (state.categorias.length)
    ops.push(sb.from('categorias').upsert(state.categorias.map(function(c,i){ return { id:c.id, nome:c.nome, ordem:i }; })));
  if (state.produtos.length)
    ops.push(sb.from('produtos').upsert(state.produtos.map(function(p,i){ return {
      id:p.id, categoria_id:p.categoriaId||null, nome:p.nome,
      descricao:p.descricao||'', preco:p.preco||'', imagem:p.imagem||'', ordem:i
    }; })));
  var estRows = Object.keys(state.estoque).map(function(pid){ return {
    produto_id:pid, quantidade:state.estoque[pid].quantidade, minimo:state.estoque[pid].minimo, maximo:state.estoque[pid].maximo
  }; });
  if (estRows.length) ops.push(sb.from('estoque').upsert(estRows));
  if (state.movimentos.length)
    ops.push(sb.from('movimentos').upsert(state.movimentos.map(function(m){ return {
      id:m.id, produto_id:m.produtoId, tipo:m.tipo,
      quantidade:m.quantidade, novo_total:m.novoTotal, obs:m.obs||'',
      fornecedor:m.fornecedor||null, data_compra:m.dataCompra||null,
      valor_unit:m.valorUnit != null ? m.valorUnit : null
    }; })));
  if (state.fornecedores.length)
    ops.push(sb.from('fornecedores').upsert(state.fornecedores.map(function(f){ return {
      id:f.id, nome:f.nome, telefone:f.telefone||null, email:f.email||null,
      endereco:f.endereco||null, produtos:f.produtos||null, obs:f.obs||null
    }; })));
  if (state.clientes.length) {
    ops.push(sb.from('clientes').upsert(state.clientes.map(function(c){ return {
      id:c.id, nome:c.nome, email:c.email||null, senha_hash:c.senhaHash||null,
      telefone:c.telefone||null, aniversario:c.aniversario||null,
      endereco:c.endereco||null, obs:c.obs||null
    }; })));
    var todasCompras = state.clientes.reduce(function(acc, c){ return acc.concat((c.compras||[]).map(function(cp){ return {
      id:cp.id, cliente_id:c.id, data:cp.data, valor:cp.valor, produtos:cp.produtos||''
    }; })); }, []);
    if (todasCompras.length) ops.push(sb.from('compras').upsert(todasCompras));
  }
  if (state.pedidos.length)
    ops.push(sb.from('pedidos').upsert(state.pedidos.map(function(p){ return {
      id:p.id, numero:p.numero, status:p.status,
      cliente_id:p.clienteId||null, cliente_nome:p.clienteNome||null,
      itens:p.itens||[], total:p.total,
      total_final:p.totalFinal != null ? p.totalFinal : null,
      desconto:p.desconto||0, obs:p.obs||null,
      data:p.data, data_confirmacao:p.dataConfirmacao||null
    }; })));
  if (state.usuarios.length)
    ops.push(sb.from('usuarios').upsert(state.usuarios.map(function(u){ return {
      id:u.id, nome:u.nome, login:u.login, senha:u.senha, perfil:u.perfil
    }; })));
  await Promise.all(ops);
}

export async function salvarManualSupabase() {
  var btn = document.getElementById('btnSalvarSupabase');
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = '⏳ Salvando...';
  btn.style.opacity = '.7';
  try {
    await syncToSupabase();
    btn.innerHTML = '✅ Salvo!';
    btn.style.background = 'var(--sucesso)';
    setTimeout(function() {
      btn.innerHTML = '☁️ Salvar';
      btn.style.background = 'var(--ouro)';
      btn.style.opacity = '1';
      btn.disabled = false;
    }, 2500);
    document.dispatchEvent(new CustomEvent('tm:salvo'));
  } catch(err) {
    console.error('Erro ao salvar:', err);
    btn.innerHTML = '❌ Erro!';
    btn.style.background = 'var(--erro)';
    setTimeout(function() {
      btn.innerHTML = '☁️ Salvar';
      btn.style.background = 'var(--ouro)';
      btn.style.opacity = '1';
      btn.disabled = false;
    }, 3000);
    document.dispatchEvent(new CustomEvent('tm:erro-salvar'));
  }
}

// Garante que todos os state.produtos tenham entrada no objeto de state.estoque
export function garantirEntradaEstoque() {
  let alterado = false;
  state.produtos.forEach(p => {
    if (!state.estoque[p.id]) {
      state.estoque[p.id] = { quantidade: 0, minimo: 5, maximo: 50 };
      alterado = true;
    } else if (state.estoque[p.id].maximo === undefined) {
      state.estoque[p.id].maximo = 50;
      alterado = true;
    }
  });
  if (alterado) salvarDados('sm_estoque', state.estoque);
}

// Helpers de status de state.estoque
export function statusEstoque(prodId) {
  const e = state.estoque[prodId] || { quantidade: 0, minimo: 5, maximo: 50 };
  if (e.quantidade <= 0)                          return 'zero';
  if (e.quantidade <= e.minimo)                   return 'baixo';
  if (e.maximo > 0 && e.quantidade > e.maximo)    return 'excesso';
  return 'ok';
}
export function labelStatus(status) {
  if (status === 'zero')    return '<span class="badge-estoque zero">🔴 Esgotado</span>';
  if (status === 'baixo')   return '<span class="badge-estoque baixo">⚠️ Baixo</span>';
  if (status === 'excesso') return '<span class="badge-estoque excesso">🔵 Excedido</span>';
  return '<span class="badge-estoque ok">✅ Normal</span>';
}

// Gera ID único simples
export function gerarId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

