/* ============================================================
   app.js — Entry point v3
   
   Integra: Supabase Auth, EventBus, Services e módulos UI.
   Ordem: initAuth → carregarDados → renderUI → remove overlay
============================================================ */
import { carregarDoSupabase, salvarManualSupabase }  from './db.js';
import { initAuth, getCurrentProfile, isAdmin }      from './auth.js';
import { renderCatNav, renderCardapio, aplicarLogo,
         iniciarCarrosselHero, atualizarWhatsapp,
         mostrarToast, inicializarScrollSpy }         from './ui.js';
import { atualizarBotaoCliente }                     from './admin-auth.js';
import { getCategorias, getProdutos, getSessao,
         getSessaoCliente, setCategorias,
         setProdutos }                                from './state.js';
import { CATEGORIAS_PADRAO, PRODUTOS_PADRAO }         from './config.js';
import { emit, on, EVENTS }                          from './eventBus.js';
import { stockService }                              from './services/stockService.js';

function registrarEventos() {
  on(EVENTS.DATA_SAVED,      () => mostrarToast('Dados salvos! ✓', 'success'));
  on(EVENTS.DATA_SAVE_ERROR, () => mostrarToast('Erro ao salvar.', 'error'));

  on(EVENTS.ADMIN_LOGGED_IN, ({ nome }) => {
    const btn = document.getElementById('btnLoginTopo');
    if (btn) btn.textContent = '⚙ Painel';
    mostrarToast(`Bem-vindo, ${nome}!`, 'success');
  });

  on(EVENTS.ADMIN_LOGGED_OUT, () => {
    const btn = document.getElementById('btnLoginTopo');
    if (btn) btn.textContent = 'Entrar';
    renderCardapio();
  });

  on(EVENTS.CLIENT_LOGGED_IN, ({ nome }) => {
    atualizarBotaoCliente();
    mostrarToast(`Olá, ${nome}!`, 'success');
  });

  on(EVENTS.CLIENT_LOGGED_OUT, () => atualizarBotaoCliente());

  on(EVENTS.ORDER_CREATED,   ({ pedido }) => mostrarToast(`Pedido #${pedido.numero} criado.`, 'success'));
  on(EVENTS.ORDER_CONFIRMED, ({ pedido }) => mostrarToast(`Pedido #${pedido.numero} confirmado!`, 'success'));
  on(EVENTS.ORDER_CANCELLED, ()           => mostrarToast('Pedido cancelado.', 'info'));

  on(EVENTS.STOCK_LOW, ({ produtos }) => {
    if (isAdmin()) mostrarToast(`⚠ Estoque baixo: ${produtos.slice(0,2).join(', ')}`, 'warning');
  });

  on(EVENTS.PRODUCT_UPDATED, () => renderCardapio());
  on(EVENTS.PRODUCT_CREATED, () => { renderCatNav(); renderCardapio(); });
  on(EVENTS.PRODUCT_DELETED, () => { renderCatNav(); renderCardapio(); });

  const btnSalvar = document.getElementById('btnSalvarSupabase');
  if (btnSalvar) btnSalvar.addEventListener('click', () => salvarManualSupabase());
}

async function inicializar() {
  try { await initAuth(); }
  catch (err) { console.warn('[app.js] Auth:', err.message); }

  try {
    await carregarDoSupabase();
  } catch (err) {
    console.error('[app.js] Dados:', err);
    mostrarToast('Erro de conexão. Dados padrão.', 'error');
    if (!getCategorias().length) setCategorias(CATEGORIAS_PADRAO);
    if (!getProdutos().length)   setProdutos(PRODUTOS_PADRAO);
  }

  stockService.garantirEntradas();
  renderCatNav();
  renderCardapio();
  atualizarWhatsapp();
  aplicarLogo();
  iniciarCarrosselHero();
  atualizarBotaoCliente();
  inicializarScrollSpy();
  registrarEventos();

  const sessaoCliente = getSessaoCliente();
  const sessao        = getSessao();
  const profile       = getCurrentProfile();

  if (sessaoCliente) {
    const n = document.getElementById('dropdownNome');
    const s = document.getElementById('dropdownSub');
    if (n) n.textContent = sessaoCliente.nome;
    if (s) s.textContent = sessaoCliente.email || '';
  }

  if (sessao || profile) {
    const btn = document.getElementById('btnLoginTopo');
    if (btn) btn.textContent = '⚙ Painel';
  }

  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.transition = 'opacity .4s ease';
    overlay.style.opacity    = '0';
    setTimeout(() => overlay.remove(), 450);
  }
}

inicializar();
