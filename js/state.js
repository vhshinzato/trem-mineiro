/* ============================================================
   state.js — Estado global centralizado v2
   
   REGRA: nenhum outro módulo declara variáveis de estado.
   Todo acesso ao estado usa getter/setter explícito.
   Todo módulo que usa estado importa o que precisa daqui.
============================================================ */
import {
  WHATSAPP_DEFAULT, CATEGORIAS_PADRAO, PRODUTOS_PADRAO, USUARIOS_PADRAO,
  CURRENT_STORE_SLUG
} from './config.js';

// ── Helpers de sessão local ─────────────────────────────────
function _load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function _save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}
function _remove(key) {
  try { localStorage.removeItem(key); } catch(e) {}
}

// ── Store atual (tenant) ────────────────────────────────────
// Preparado para multi-tenant: store_id virá do banco ao fazer login
let _storeId   = null;
let _storeSlug = CURRENT_STORE_SLUG;
let _storeMeta = {}; // nome, logo, config geral da loja

export function getStoreId()   { return _storeId; }
export function getStoreSlug() { return _storeSlug; }
export function getStoreMeta() { return _storeMeta; }
export function setStore({ id, slug, meta }) {
  _storeId   = id;
  _storeSlug = slug || CURRENT_STORE_SLUG;
  _storeMeta = meta || {};
}

// ── Estado público (carregado na Fase 1) ────────────────────
let _categorias = [];
let _produtos   = [];
let _config     = { whatsapp: WHATSAPP_DEFAULT, logo: '', heroMedia: [] };

export function getCategorias()  { return _categorias; }
export function getProdutos()    { return _produtos; }
export function getConfig()      { return _config; }

export function setCategorias(v) { _categorias = Array.isArray(v) ? v : []; }
export function setProdutos(v)   { _produtos   = Array.isArray(v) ? v : []; }
export function setConfig(v) {
  _config = v || { whatsapp: WHATSAPP_DEFAULT, logo: '', heroMedia: [] };
  if (!_config.heroMedia) _config.heroMedia = [];
}

// ── Estado admin (carregado na Fase 2 — lazy) ───────────────
let _usuarios     = [];
let _fornecedores = [];
let _clientes     = [];
let _pedidos      = [];
let _estoque      = {};
let _movimentos   = [];
let _adminCarregado = false;

export function getUsuarios()     { return _usuarios; }
export function getFornecedores() { return _fornecedores; }
export function getClientes()     { return _clientes; }
export function getPedidos()      { return _pedidos; }
export function getEstoque()      { return _estoque; }
export function getMovimentos()   { return _movimentos; }
export function isAdminCarregado(){ return _adminCarregado; }

export function setUsuarios(v)     { _usuarios     = Array.isArray(v) ? v : []; }
export function setFornecedores(v) { _fornecedores = Array.isArray(v) ? v : []; }
export function setClientes(v)     { _clientes     = Array.isArray(v) ? v : []; }
export function setPedidos(v)      { _pedidos       = Array.isArray(v) ? v : []; }
export function setEstoque(v)      { _estoque       = v && typeof v === 'object' ? v : {}; }
export function setMovimentos(v)   { _movimentos    = Array.isArray(v) ? v : []; }
export function setAdminCarregado(){ _adminCarregado = true; }
export function resetAdminCache()  { _adminCarregado = false; } // forçar recarga

// ── Carrinho (em memória, sem persistência) ─────────────────
let _carrinho = [];
export function getCarrinho()  { return _carrinho; }
export function setCarrinho(v) { _carrinho = Array.isArray(v) ? v : []; }

// ── Sessão admin (persistida no localStorage) ───────────────
let _sessao = _load('tm_sessao', null);
export function getSessao()      { return _sessao; }
export function setSessao(v)     { _sessao = v; v ? _save('tm_sessao', v) : _remove('tm_sessao'); }
export function clearSessao()    { _sessao = null; _remove('tm_sessao'); }
export function isSessaoAdmin()  { return _sessao?.perfil === 'admin'; }
export function isSessaoFuncionario() { return !!_sessao; }

// ── Sessão cliente (persistida no localStorage) ─────────────
let _sessaoCliente = _load('tm_sessao_cliente', null);
export function getSessaoCliente()   { return _sessaoCliente; }
export function setSessaoCliente(v)  { _sessaoCliente = v; v ? _save('tm_sessao_cliente', v) : _remove('tm_sessao_cliente'); }
export function clearSessaoCliente() { _sessaoCliente = null; _remove('tm_sessao_cliente'); }

// ── Helpers com fallback ────────────────────────────────────
export function getCategoriasOuPadrao() {
  return _categorias.length ? _categorias : CATEGORIAS_PADRAO;
}
export function getProdutosOuPadrao() {
  return _produtos.length ? _produtos : PRODUTOS_PADRAO;
}
export function getUsuariosOuPadrao() {
  return _usuarios.length ? _usuarios : USUARIOS_PADRAO;
}

// ── Produto por ID (helper frequente) ──────────────────────
export function getProdutoById(id) {
  return _produtos.find(p => p.id === id) || null;
}
export function getCategoriaById(id) {
  return _categorias.find(c => c.id === id) || null;
}
export function getClienteById(id) {
  return _clientes.find(c => c.id === id) || null;
}
export function getPedidoById(id) {
  return _pedidos.find(p => p.id === id) || null;
}
