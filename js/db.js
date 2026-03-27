/* ============================================================
   db.js — Camada de dados (Supabase) v2
   
   REGRA: ÚNICA camada que faz chamadas ao Supabase.
   Nenhum outro módulo importa ou usa `sb` diretamente.
   
   Multi-tenant: queries filtradas por store_id quando disponível.
   Fase atual: Trem Mineiro como tenant único (store_id = null,
   tabelas sem filtro). Migration SQL em /sql/001_multi_tenant.sql.
============================================================ */
import {
  SUPA_URL, SUPA_KEY, LOADING_TIMEOUT_MS, DEBOUNCE_SYNC_MS,
  MAX_MOVIMENTOS, CATEGORIAS_PADRAO, PRODUTOS_PADRAO, USUARIOS_PADRAO
} from './config.js';

import { emit, EVENTS }                      from './eventBus.js';
import {
  getStoreId,
  getCategorias, getProdutos, getConfig, getUsuarios,
  getFornecedores, getClientes, getPedidos, getEstoque, getMovimentos,
  isAdminCarregado,
  setCategorias, setProdutos, setConfig, setUsuarios,
  setFornecedores, setClientes, setPedidos, setEstoque, setMovimentos,
  setAdminCarregado, setStore
} from './state.js';

// ── Instância Supabase (singleton) ──────────────────────────
let _sb = null;
export function getSb() {
  if (!_sb) _sb = supabase.createClient(SUPA_URL, SUPA_KEY);
  return _sb;
}

// ── Contexto do tenant atual ─────────────────────────────────
export function getCurrentStoreContext() {
  return {
    storeId:  getStoreId(),
    getQuery: (tabela) => withStore(getSb().from(tabela)),
  };
}

// ── Helper: query com filtro de store_id (preparado para multi-tenant) ──
// Quando store_id for null (Trem Mineiro atual), retorna a query sem filtro.
// Quando multi-tenant estiver ativo, filtra automaticamente.
function withStore(query) {
  const storeId = getStoreId();
  if (storeId) return query.eq('store_id', storeId);
  return query;
}

// ── Helper: adiciona store_id ao payload (multi-tenant) ─────
function addStoreId(payload) {
  const storeId = getStoreId();
  if (storeId) return { ...payload, store_id: storeId };
  return payload;
}

// ── Tratamento de erro padronizado ──────────────────────────
function handleDbError(context, error) {
  console.error(`[db.js] ${context}:`, error?.message || error);
  return null;
}

/* ── FASE 1: carrega somente dados do cardápio público ──────
   3 tabelas → aparece em ~1-2s mesmo com banco frio           */
export async function carregarDoSupabase() {
  const el = document.getElementById('loadingMsg');
  if (el) el.textContent = 'Conectando ao servidor...';

  const sb = getSb();
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), LOADING_TIMEOUT_MS)
  );

  try {
    const [
      { data: cats,   error: e1 },
      { data: prods,  error: e2 },
      { data: cfgRow, error: e3 },
    ] = await Promise.race([
      Promise.all([
        withStore(sb.from('categorias').select('*').order('ordem')),
        withStore(sb.from('produtos').select('*').order('ordem')),
        sb.from('config').select('*').eq('id', 'main').maybeSingle(),
      ]),
      timeout
    ]);

    if (el) el.textContent = 'Preparando dados...';
    if (e1) handleDbError('carregar categorias', e1);
    if (e2) handleDbError('carregar produtos', e2);
    if (e3) handleDbError('carregar config', e3);

    setCategorias(
      (cats && cats.length)
        ? cats.map(c => ({ id: c.id, nome: c.nome }))
        : CATEGORIAS_PADRAO
    );

    setProdutos(
      (prods && prods.length)
        ? prods.map(p => ({
            id: p.id, categoriaId: p.categoria_id, nome: p.nome,
            descricao: p.descricao, preco: p.preco, imagem: p.imagem || ''
          }))
        : PRODUTOS_PADRAO
    );

    if (cfgRow?.dados) {
      const d = cfgRow.dados;
      setConfig({
        whatsapp: d.whatsapp || SUPA_URL,
        logo: d.logo || '',
        heroMedia: d.heroMedia || []
      });
    }

    // Primeira vez: popula o banco com dados padrão
    if (!cats || !cats.length) {
      await syncToSupabase();
    }

  } catch (err) {
    if (err.message === 'timeout') {
      console.warn('[db.js] Supabase timeout — usando dados padrão');
    } else {
      handleDbError('carregarDoSupabase', err);
    }
    // Garante fallbacks mesmo com erro
    if (!getCategorias().length) setCategorias(CATEGORIAS_PADRAO);
    if (!getProdutos().length)   setProdutos(PRODUTOS_PADRAO);
  }
}

/* ── FASE 2: carrega dados admin (lazy, 1x por sessão) ──────
   7 tabelas em paralelo → carregadas quando o painel abre     */
export async function carregarDadosAdmin() {
  if (isAdminCarregado()) return;

  const sb = getSb();

  try {
    const [
      { data: estRows,  error: e1 },
      { data: movRows,  error: e2 },
      { data: fornRows, error: e3 },
      { data: cliRows,  error: e4 },
      { data: cpRows,   error: e5 },
      { data: pedRows,  error: e6 },
      { data: usrRows,  error: e7 },
    ] = await Promise.all([
      withStore(sb.from('estoque').select('*')),
      withStore(sb.from('movimentos').select('*').order('criado_em', { ascending: false }).limit(MAX_MOVIMENTOS)),
      withStore(sb.from('fornecedores').select('*')),
      withStore(sb.from('clientes').select('*')),
      withStore(sb.from('compras').select('*')),
      withStore(sb.from('pedidos').select('*').order('data', { ascending: false })),
      withStore(sb.from('usuarios').select('*')),
    ]);

    [e1,e2,e3,e4,e5,e6,e7].forEach((e, i) => {
      if (e) handleDbError(`carregar tabela admin #${i+1}`, e);
    });

    // Estoque (mapa por produto_id)
    const novoEstoque = {};
    (estRows || []).forEach(e => {
      novoEstoque[e.produto_id] = {
        quantidade: e.quantidade, minimo: e.minimo, maximo: e.maximo
      };
    });
    setEstoque(novoEstoque);

    setMovimentos((movRows || []).map(m => ({
      id: m.id, produtoId: m.produto_id, tipo: m.tipo,
      quantidade: m.quantidade, novoTotal: m.novo_total, obs: m.obs || '',
      fornecedor: m.fornecedor || '', dataCompra: m.data_compra || '',
      valorUnit: m.valor_unit ? parseFloat(m.valor_unit) : null,
      data: m.criado_em
    })));

    setFornecedores((fornRows || []).map(f => ({
      id: f.id, nome: f.nome, telefone: f.telefone || '',
      email: f.email || '', endereco: f.endereco || '',
      produtos: f.produtos || '', obs: f.obs || ''
    })));

    setClientes((cliRows || []).map(c => ({
      id: c.id, nome: c.nome, email: c.email || '',
      senhaHash: c.senha_hash || '', telefone: c.telefone || '',
      aniversario: c.aniversario || '', endereco: c.endereco || '', obs: c.obs || '',
      compras: (cpRows || [])
        .filter(cp => cp.cliente_id === c.id)
        .map(cp => ({ id: cp.id, data: cp.data, valor: parseFloat(cp.valor) || 0, produtos: cp.produtos || '' }))
        .sort((a, b) => a.data.localeCompare(b.data))
    })));

    setPedidos((pedRows || []).map(p => ({
      id: p.id, numero: p.numero, status: p.status,
      clienteId: p.cliente_id || null,
      clienteNome: p.cliente_nome || 'Cliente não identificado',
      itens: p.itens || [], total: parseFloat(p.total) || 0,
      totalFinal: p.total_final ? parseFloat(p.total_final) : null,
      desconto: parseFloat(p.desconto) || 0, obs: p.obs || '',
      data: p.data, dataConfirmacao: p.data_confirmacao || null
    })));

    setUsuarios(
      (usrRows && usrRows.length)
        ? usrRows.map(u => ({ id: u.id, nome: u.nome, login: u.login, senha: u.senha, perfil: u.perfil }))
        : USUARIOS_PADRAO
    );

    setAdminCarregado();

  } catch (err) {
    handleDbError('carregarDadosAdmin', err);
    throw err; // propaga para o caller mostrar feedback ao usuário
  }
}

/* ── Sync completo → Supabase (todas tabelas em paralelo) ─── */
export async function syncToSupabase() {
  const sb = getSb();
  const categorias   = getCategorias();
  const produtos     = getProdutos();
  const config       = getConfig();
  const usuarios     = getUsuarios();
  const fornecedores = getFornecedores();
  const clientes     = getClientes();
  const pedidos      = getPedidos();
  const estoque      = getEstoque();
  const movimentos   = getMovimentos();

  const ops = [];

  ops.push(sb.from('config').upsert({ id: 'main', dados: config }));

  if (getCategorias().length)
    ops.push(sb.from('categorias').upsert(
      getCategorias().map((c, i) => addStoreId({ id: c.id, nome: c.nome, ordem: i }))
    ));

  if (getProdutos().length)
    ops.push(sb.from('produtos').upsert(
      getProdutos().map((p, i) => addStoreId({
        id: p.id, categoria_id: p.categoriaId || null, nome: p.nome,
        descricao: p.descricao || '', preco: p.preco || '', imagem: p.imagem || '', ordem: i
      }))
    ));

  const estRows = Object.keys(getEstoque()).map(pid => addStoreId({
    produto_id: pid, quantidade: getEstoque()[pid].quantidade,
    minimo: getEstoque()[pid].minimo, maximo: getEstoque()[pid].maximo
  }));
  if (estRows.length) ops.push(sb.from('estoque').upsert(estRows));

  if (getMovimentos().length)
    ops.push(sb.from('movimentos').upsert(
      getMovimentos().map(m => addStoreId({
        id: m.id, produto_id: m.produtoId, tipo: m.tipo,
        quantidade: m.quantidade, novo_total: m.novoTotal, obs: m.obs || '',
        fornecedor: m.fornecedor || null, data_compra: m.dataCompra || null,
        valor_unit: m.valorUnit != null ? m.valorUnit : null
      }))
    ));

  if (getFornecedores().length)
    ops.push(sb.from('fornecedores').upsert(
      getFornecedores().map(f => addStoreId({
        id: f.id, nome: f.nome, telefone: f.telefone || null, email: f.email || null,
        endereco: f.endereco || null, produtos: f.produtos || null, obs: f.obs || null
      }))
    ));

  if (getClientes().length) {
    ops.push(sb.from('clientes').upsert(
      getClientes().map(c => addStoreId({
        id: c.id, nome: c.nome, email: c.email || null, senha_hash: c.senhaHash || null,
        telefone: c.telefone || null, aniversario: c.aniversario || null,
        endereco: c.endereco || null, obs: c.obs || null
      }))
    ));
    const todasCompras = getClientes().flatMap(c =>
      (c.compras || []).map(cp => addStoreId({
        id: cp.id, cliente_id: c.id, data: cp.data, valor: cp.valor, produtos: cp.produtos || ''
      }))
    );
    if (todasCompras.length) ops.push(sb.from('compras').upsert(todasCompras));
  }

  if (getPedidos().length)
    ops.push(sb.from('pedidos').upsert(
      getPedidos().map(p => addStoreId({
        id: p.id, numero: p.numero, status: p.status,
        cliente_id: p.clienteId || null, cliente_nome: p.clienteNome || null,
        itens: p.itens || [], total: p.total,
        total_final: p.totalFinal != null ? p.totalFinal : null,
        desconto: p.desconto || 0, obs: p.obs || null,
        data: p.data, data_confirmacao: p.dataConfirmacao || null
      }))
    ));

  if (getUsuarios().length)
    ops.push(sb.from('usuarios').upsert(
      getUsuarios().map(u => addStoreId({
        id: u.id, nome: u.nome, login: u.login, senha: u.senha, perfil: u.perfil
      }))
    ));

  const results = await Promise.all(ops);

  // Verifica erros
  results.forEach((r, i) => {
    if (r?.error) handleDbError(`syncToSupabase op#${i}`, r.error);
  });
}

/* ── persistir — debounced auto-save ───────────────────────── */
let _syncTimer = null;
export function persistir() {
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(async () => {
    try { await syncToSupabase(); }
    catch (err) { handleDbError('persistir', err); }
  }, DEBOUNCE_SYNC_MS);
}

/* ── salvarManualSupabase — botão ☁️ Salvar ────────────────── */
export async function salvarManualSupabase() {
  const btn = document.getElementById('btnSalvarSupabase');
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '⏳ Salvando...';
  btn.style.opacity = '.7';

  try {
    await syncToSupabase();
    btn.innerHTML = '✅ Salvo!';
    btn.style.background = 'var(--sucesso)';
    setTimeout(() => {
      btn.innerHTML = '☁️ Salvar';
      btn.style.background = 'var(--ouro)';
      btn.style.opacity = '1';
      btn.disabled = false;
    }, 2500);
    // mostrarToast importado pelo caller
    emit(EVENTS.DATA_SAVED);
  } catch (err) {
    handleDbError('salvarManualSupabase', err);
    btn.innerHTML = '❌ Erro!';
    btn.style.background = 'var(--erro)';
    setTimeout(() => {
      btn.innerHTML = '☁️ Salvar';
      btn.style.background = 'var(--ouro)';
      btn.style.opacity = '1';
      btn.disabled = false;
    }, 3000);
    emit(EVENTS.DATA_SAVE_ERROR);
  }
}

/* ── Supabase Storage — upload de imagem ────────────────────
   Preparado para migração de base64 para Storage              */
export async function uploadImagem(file, pasta = 'produtos') {
  const sb = getSb();
  const ext  = file.name.split('.').pop();
  const nome = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data, error } = await sb.storage
    .from('trem-mineiro')
    .upload(nome, file, { cacheControl: '3600', upsert: false });

  if (error) {
    handleDbError('uploadImagem', error);
    return null;
  }

  const { data: urlData } = sb.storage
    .from('trem-mineiro')
    .getPublicUrl(data.path);

  return urlData?.publicUrl || null;
}
