/* ============================================================
   admin-auth.js — Autenticação e painel administrativo
   
   Responsabilidades:
   - Login/logout de admin (via Supabase Auth + fallback legado)
   - Abertura/fechamento do painel admin
   - Alternância de abas do admin
   - Gerenciamento de mídia do hero
   - atualizarBotaoCliente (estado do cliente logado no header)
   
   NÃO contém: renderização de tabelas, regras de negócio,
   módulos de produto/estoque/pedido/cliente (estão nos sub-módulos).
============================================================ */
import {
  getCategorias, getProdutos, getConfig, getUsuarios,
  getSessao, getSessaoCliente,
  setSessao, clearSessao, clearSessaoCliente,
  isAdminCarregado, isSessaoAdmin,
  getCategoriasOuPadrao, getProdutosOuPadrao, getUsuariosOuPadrao
} from './state.js';
import { persistir, carregarDadosAdmin, salvarManualSupabase } from './db.js';
import {
  mostrarToast, renderCardapio, renderCatNav,
  atualizarWhatsapp, aplicarLogo, abrirModal, fecharModal,
  iniciarCarrosselHero, carregarPreviewLogoAdmin
} from './ui.js';
import { emit, EVENTS } from './eventBus.js';

/* ── Helper local: gerar ID único ───────────────────────────── */
function gerarId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

/* ============================================================
   AUTENTICAÇÃO DE ADMIN
============================================================ */

// Listener no botão de login/acesso ao painel
document.getElementById('btnLoginTopo').addEventListener('click', () => {
  if (getSessao()) {
    abrirAdmin();
  } else {
    abrirModal('loginModal');
  }
});

export function fazerLogin() {
  const emailOuLogin = (document.getElementById('loginUser')?.value || '').trim();
  const senha        = document.getElementById('loginPass')?.value || '';
  const alerta       = document.getElementById('loginAlert');

  if (!emailOuLogin || !senha) {
    if (alerta) alerta.innerHTML = `<div class="alert alert-error">Preencha todos os campos.</div>`;
    return;
  }

  const isEmail = emailOuLogin.includes('@');

  if (isEmail) {
    // Tenta Supabase Auth primeiro (async — usa import dinâmico para evitar circular)
    import('./auth.js').then(({ loginAdmin }) => {
      loginAdmin(emailOuLogin, senha).then(result => {
        if (result.success) {
          if (alerta) alerta.innerHTML = '';
          if (document.getElementById('loginUser')) document.getElementById('loginUser').value = '';
          if (document.getElementById('loginPass')) document.getElementById('loginPass').value = '';
          fecharModal('loginModal');
          abrirAdmin();
        } else {
          if (alerta) alerta.innerHTML = `<div class="alert alert-error">${result.message}</div>`;
        }
      });
    }).catch(() => {
      // Supabase Auth indisponível — tenta fallback legado
      _loginLegado(emailOuLogin, senha, alerta);
    });
  } else {
    // Login com username — fallback legado direto
    _loginLegado(emailOuLogin, senha, alerta);
  }
}

/** Fallback: login por login/senha no array de usuários (compatibilidade) */
function _loginLegado(loginOuEmail, senha, alerta) {
  const usuario = getUsuariosOuPadrao().find(
    u => (u.login === loginOuEmail || u.email === loginOuEmail) && u.senha === senha
  );
  if (!usuario) {
    if (alerta) alerta.innerHTML = `<div class="alert alert-error">Login ou senha inválidos.</div>`;
    return;
  }
  setSessao({ id: usuario.id, nome: usuario.nome, perfil: usuario.perfil });
  if (alerta) alerta.innerHTML = '';
  if (document.getElementById('loginUser')) document.getElementById('loginUser').value = '';
  if (document.getElementById('loginPass')) document.getElementById('loginPass').value = '';
  fecharModal('loginModal');
  abrirAdmin();
  emit(EVENTS.ADMIN_LOGGED_IN, { nome: usuario.nome, role: usuario.perfil });
}

export function fazerLogout() {
  // Tenta logout via Supabase Auth; se falhar, só limpa local
  import('./auth.js').then(({ logout }) => logout()).catch(() => {});
  clearSessao();
  fecharAdmin();
  mostrarToast('Sessão encerrada.', 'success');
  const btn = document.getElementById('btnLoginTopo');
  if (btn) btn.textContent = 'Entrar';
}

/* ============================================================
   ABERTURA E FECHAMENTO DO PAINEL ADMIN
============================================================ */

export async function abrirAdmin() {
  const sessao = getSessao();
  if (!sessao) { abrirModal('loginModal'); return; }

  // Atualiza topbar
  const elNome  = document.getElementById('adminUserName');
  const elBadge = document.getElementById('adminBadgeRole');
  if (elNome)  elNome.textContent  = sessao.nome;
  if (elBadge) {
    elBadge.textContent = sessao.perfil === 'admin' ? 'Admin' : 'Funcionário';
    elBadge.className   = 'badge-role ' + (sessao.perfil === 'admin' ? 'badge-admin' : 'badge-func');
  }

  // Visibilidade das abas restritas
  const isAdmin = sessao.perfil === 'admin';
  document.querySelectorAll(
    '.admin-tab-whatsapp, .admin-tab-usuarios, .admin-tab-fornecedores, .admin-tab-clientes'
  ).forEach(el => el.classList.toggle('hidden', !isAdmin));

  const btnNovaCat = document.getElementById('btnNovaCat');
  if (btnNovaCat) btnNovaCat.style.display = isAdmin ? '' : 'none';

  // Carregamento lazy dos dados admin (Fase 2)
  if (!isAdminCarregado()) {
    const overlay = document.createElement('div');
    overlay.id = 'adminLoadingOverlay';
    overlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:9998;background:rgba(44,24,16,.7);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = '<div style="color:var(--ouro);font-size:1rem;font-family:serif;">⏳ Carregando painel...</div>';
    document.body.appendChild(overlay);
    try {
      await carregarDadosAdmin();
    } catch (e) {
      console.error('[admin-auth] Erro ao carregar dados admin:', e);
      mostrarToast('Erro ao carregar painel. Tente novamente.', 'error');
    } finally {
      overlay.remove();
    }
  }

  const panel = document.getElementById('adminPanel');
  if (panel) panel.classList.add('open');

  // Abre primeira aba e renderiza
  const primeiraAba = document.querySelector('[data-tab="tabCategorias"]');
  abrirAba('tabCategorias', primeiraAba);

  // Chama renders dos sub-módulos via import dinâmico para evitar circular
  _renderizarAdmin();

  emit(EVENTS.ADMIN_OPENED);
}

export function fecharAdmin() {
  const panel = document.getElementById('adminPanel');
  if (panel) panel.classList.remove('open');
  emit(EVENTS.ADMIN_CLOSED);
}

export function voltarCardapio() {
  fecharAdmin();
}

/* ── Delega renderização para sub-módulos ───────────────────── */
function _renderizarAdmin() {
  // Import dinâmico evita imports circulares entre admin-auth ↔ admin-products etc.
  Promise.all([
    import('./admin-products.js'),
    import('./admin-stock.js'),
    import('./admin-orders.js'),
  ]).then(([products, stock, orders]) => {
    if (products.garantirEntradaEstoque) products.garantirEntradaEstoque();
    if (products.renderTabelaCategorias) products.renderTabelaCategorias();
    if (products.renderTabelaProdutos)   products.renderTabelaProdutos();
    if (products.renderSelectCategorias) products.renderSelectCategorias();
    if (products.renderFiltroCategorias) products.renderFiltroCategorias();
    if (products.renderSelectEstoqueProdutos) products.renderSelectEstoqueProdutos();
    if (stock.renderFiltroEstoqueCat)    stock.renderFiltroEstoqueCat();
    if (stock.renderTabelaEstoque)       stock.renderTabelaEstoque();
    if (orders.renderTabelaPedidos)      orders.renderTabelaPedidos();
    if (orders.atualizarBadgePedidos)    orders.atualizarBadgePedidos();
  }).catch(e => console.error('[admin-auth] render admin:', e));
}

/* ============================================================
   ABAS DO PAINEL ADMIN
============================================================ */
export function abrirAba(tabId, btnEl) {
  document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  if (btnEl) btnEl.classList.add('active');
}

export function abrirAbaRelatorios(btnEl) {
  abrirAba('tabRelatorios', btnEl);
  import('./reports.js').then(m => {
    if (m.renderRelatorio) m.renderRelatorio();
  }).catch(() => {});
}

/* ============================================================
   CLIENTE LOGADO — botão no header público
============================================================ */
export function atualizarBotaoCliente() {
  const sessaoCliente = getSessaoCliente();
  const btnCliente    = document.getElementById('btnCliente');
  const btnLoginTopo  = document.getElementById('btnLoginTopo');

  if (sessaoCliente) {
    if (btnCliente) {
      btnCliente.style.display = '';
      const nome = document.getElementById('dropdownNome');
      const sub  = document.getElementById('dropdownSub');
      if (nome) nome.textContent = sessaoCliente.nome;
      if (sub)  sub.textContent  = sessaoCliente.email || '';
    }
  } else {
    if (btnCliente) btnCliente.style.display = 'none';
  }

  if (btnLoginTopo) {
    btnLoginTopo.textContent = getSessao() ? '⚙ Painel' : 'Entrar';
  }
}

/* ============================================================
   GERENCIADOR DE MÍDIA DO HERO
============================================================ */
export function renderHeroMediaLista() {
  const wrap = document.getElementById('heroMediaLista');
  if (!wrap) return;
  const lista = getConfig().heroMedia || [];

  if (!lista.length) {
    wrap.innerHTML = `<div style="text-align:center;color:var(--cinza);font-size:.85rem;padding:1.5rem;">Nenhuma mídia adicionada ainda.</div>`;
    return;
  }

  wrap.innerHTML = `<div class="hero-media-grid" id="heroMediaGrid"></div>`;
  const grid = document.getElementById('heroMediaGrid');

  lista.forEach((m, i) => {
    const div   = document.createElement('div');
    div.className = 'hero-media-item';
    const thumb = m.tipo === 'video'
      ? `<div class="hero-media-thumb-video">🎬</div>`
      : `<img class="hero-media-thumb" src="${m.src}" onerror="this.style.opacity='.3'" />`;

    div.innerHTML = `
      <span class="hero-media-ordem">${i + 1}</span>
      <span class="hero-media-tipo">${m.tipo === 'video' ? '🎬 vídeo' : '🖼️ img'}</span>
      ${thumb}
      <div class="hero-media-label">${m.titulo || ('Mídia ' + (i + 1))}</div>
      <div class="hero-media-actions">
        ${i > 0 ? `<button class="hero-media-btn mover" onclick="moverHeroMedia(${i},-1)" title="Mover para esquerda">◀</button>` : ''}
        ${i < lista.length - 1 ? `<button class="hero-media-btn mover" onclick="moverHeroMedia(${i},1)" title="Mover para direita">▶</button>` : ''}
        <button class="hero-media-btn" onclick="removerHeroMedia('${m.id}')" title="Remover">✕</button>
      </div>`;
    grid.appendChild(div);
  });
}

export function adicionarHeroImagem(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { mostrarToast('Máximo 5 MB!', 'error'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const cfg = getConfig();
    if (!cfg.heroMedia) cfg.heroMedia = [];
    cfg.heroMedia.push({ id: gerarId(), tipo: 'imagem', src: e.target.result, titulo: file.name.replace(/\.[^.]+$/, '') });
    persistir();
    input.value = '';
    renderHeroMediaLista();
    iniciarCarrosselHero();
    mostrarToast('Imagem adicionada! ✓', 'success');
  };
  reader.readAsDataURL(file);
}

export function adicionarHeroUrl() {
  const url    = (document.getElementById('heroUrlInput')?.value  || '').trim();
  const titulo = (document.getElementById('heroUrlTitulo')?.value || '').trim();
  if (!url) { mostrarToast('Informe uma URL.', 'error'); return; }

  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  const cfg = getConfig();
  if (!cfg.heroMedia) cfg.heroMedia = [];
  cfg.heroMedia.push({ id: gerarId(), tipo: isVideo ? 'video' : 'imagem', src: url, titulo: titulo || url.split('/').pop() });
  persistir();

  if (document.getElementById('heroUrlInput'))  document.getElementById('heroUrlInput').value  = '';
  if (document.getElementById('heroUrlTitulo')) document.getElementById('heroUrlTitulo').value = '';
  renderHeroMediaLista();
  iniciarCarrosselHero();
  mostrarToast((isVideo ? 'Vídeo' : 'Imagem') + ' adicionado! ✓', 'success');
}

export function removerHeroMedia(mediaId) {
  const cfg = getConfig();
  cfg.heroMedia = (cfg.heroMedia || []).filter(m => m.id !== mediaId);
  persistir();
  renderHeroMediaLista();
  iniciarCarrosselHero();
  mostrarToast('Mídia removida.', 'success');
}

export function moverHeroMedia(idx, dir) {
  const lista = getConfig().heroMedia || [];
  const novo  = idx + dir;
  if (novo < 0 || novo >= lista.length) return;
  [lista[idx], lista[novo]] = [lista[novo], lista[idx]];
  persistir();
  renderHeroMediaLista();
  iniciarCarrosselHero();
}

/* ── Botão Salvar ───────────────────────────────────────────── */
// Listener registrado via app.js (evita duplicidade)
