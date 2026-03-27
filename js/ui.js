/* ============================================================
   ui.js v2 — imports explícitos, zero globals implícitos
============================================================ */
import {
  getCategorias, getProdutos, getConfig, getUsuarios,
  getClientes, getPedidos, getEstoque, getMovimentos, getFornecedores,
  getSessao, getSessaoCliente, getCarrinho,
  setCategorias, setProdutos, setConfig, setClientes, setPedidos,
  setCarrinho, setSessaoCliente, clearSessaoCliente,
  getProdutoById, getCategoriaById, getCategoriasOuPadrao, getProdutosOuPadrao
} from './state.js';
import { persistir, getSb, uploadImagem } from './db.js';


/* ============================================================
   ui.js — Renderização pública, toast, busca, hero, carrossel
   Trem Mineiro
============================================================ */

/* ============================================================
   RENDERIZAÇÃO DA ÁREA PÚBLICA
============================================================ */
function renderCardapio(filtroNome = '', filtroCat = '') {
  const secoes = document.getElementById('productSections');
  secoes.innerHTML = '';

  // Normaliza texto: minúsculo + remove acentos
  function norm(str) {
    return (str || '').toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  const termoBusca = norm(filtroNome);

  getCategorias().forEach(cat => {
    if (filtroCat && filtroCat !== cat.id) return;

    const prods = getProdutos().filter(p =>
      p.categoriaId === cat.id &&
      (!termoBusca || norm(p.nome).includes(termoBusca) || norm(p.descricao).includes(termoBusca))
    );

    if (termoBusca && prods.length === 0) return;

    const section = document.createElement('section');
    section.className = 'category-section';
    section.id = 'sec_' + cat.id;

    section.innerHTML = `
      <div class="cat-header">
        <h2>${cat.nome}</h2>
        <div class="cat-line"></div>
      </div>
      <div class="products-grid" id="grid_${cat.id}"></div>
    `;
    secoes.appendChild(section);

    const grid = section.querySelector('.products-grid');

    if (prods.length === 0) {
      grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🍃</div>Nenhum produto nesta categoria ainda.</div>`;
    } else {
      prods.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => abrirDetalhe(p.id);
        card.innerHTML = `
          <div class="product-img-wrap" style="position:relative;">
            ${p.imagem
              ? `<img src="${escapeHtml(p.imagem)}" alt="${escapeHtml(p.nome)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'product-img-placeholder\\'>🛍️</div>'" />`
              : `<div class="product-img-placeholder">🛍️</div>`
            }
            <div class="product-card-overlay"><span>🛒 Ver detalhes</span></div>
          </div>
          <div class="product-body">
            <div class="product-name">${escapeHtml(p.nome)}</div>
            <div class="product-desc">${escapeHtml(p.descricao)}</div>
            <div class="product-price">${escapeHtml(p.preco)}</div>
          </div>
        `;
        grid.appendChild(card);
      });
    }
  });

  // Nenhum resultado global
  if (!secoes.innerHTML.trim()) {
    secoes.innerHTML = `<div class="empty-state" style="padding:4rem 0;">
      <div class="empty-state-icon">🔍</div>
      <p>Nenhum produto encontrado para "<strong>${escapeHtml(termoBusca)}</strong>".</p>
    </div>`;
  }

  // Reinicia scroll spy após renderizar
  if (!filtroAtivoCat && !termoBusca) iniciarScrollSpy();
}

// Renderiza botões de navegação de categorias
function renderCatNav() {
  const nav = document.getElementById('catNavList');
  nav.innerHTML = `<button class="cat-btn active" data-cat="" onclick="filtrarPorCategoria(this, '')">Todos</button>`;
  getCategorias().forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = cat.id;
    btn.textContent = cat.nome;
    btn.onclick = () => filtrarPorCategoria(btn, cat.id);
    nav.appendChild(btn);
  });
  // Reinicia o scroll spy sempre que o nav for reconstruído
  iniciarScrollSpy();
}

// Filtro por categoria na navegação
let filtroAtivoCat = '';
function filtrarPorCategoria(btn, catId) {
  filtroAtivoCat = catId;
  _pausarScrollSpy();
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const searchInput = document.getElementById('searchInput');
  searchInput.value = '';
  document.getElementById('hero').classList.remove('buscando');
  renderCardapio('', catId);
}

/* ── Scroll Spy — destaca a categoria visível no nav ─────── */
let _scrollSpyObserver = null;
let _scrollSpyActivo   = true; // false quando o usuário clicou numa aba (evita conflito)

function iniciarScrollSpy() {
  // Desconecta observer anterior se existir
  if (_scrollSpyObserver) _scrollSpyObserver.disconnect();

  // Só funciona quando está mostrando "Todos" (sem filtro de categoria)
  if (filtroAtivoCat) return;

  const headerH = (document.getElementById('header')  || {}).offsetHeight || 80;
  const navH    = (document.getElementById('catNav')   || {}).offsetHeight || 48;
  const offset  = headerH + navH;

  _scrollSpyObserver = new IntersectionObserver(entries => {
    if (!_scrollSpyActivo) return;
    if (filtroAtivoCat) return; // ignorar quando há filtro ativo

    // Pega todas as seções visíveis e ordena pela posição vertical
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const catId = entry.target.id.replace('sec_', '');
      const btn   = document.querySelector('.cat-btn[data-cat="' + catId + '"]');
      if (!btn) return;

      // Marca como ativo
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Rola o nav para mostrar o botão ativo
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }, {
    // Dispara quando a seção entra na faixa entre o nav e 60% da tela
    rootMargin: '-' + offset + 'px 0px -40% 0px',
    threshold: 0
  });

  // Observa todas as seções de categoria
  document.querySelectorAll('.category-section').forEach(sec => {
    _scrollSpyObserver.observe(sec);
  });
}

// Quando o usuário clica numa aba, pausa o spy por 1s para não conflitar com o scroll programático
function _pausarScrollSpy() {
  _scrollSpyActivo = false;
  clearTimeout(window._spyTimer);
  window._spyTimer = setTimeout(() => { _scrollSpyActivo = true; }, 1000);
}


// Atualiza link do WhatsApp
function atualizarWhatsapp() {
  const num = getConfig().whatsapp || WHATSAPP_DEFAULT;
  document.getElementById('btnWhatsapp').href = `https://wa.me/${num}`;
}



/* ============================================================
   TOAST
============================================================ */
let _toastTimer = null;
function mostrarToast(msg, tipo = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'show ' + tipo;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.className = ''; }, 2800);
}



/* ============================================================
   MASCARA DE MOEDA
============================================================ */
function mascaraPreco(input) {
  let v = input.value.replace(/\D/g, '');
  v = (parseInt(v, 10) || 0).toString();
  while (v.length < 3) v = '0' + v;
  const inteiros = v.slice(0, -2) || '0';
  const centavos = v.slice(-2);
  const formatado = parseInt(inteiros, 10).toLocaleString('pt-BR');
  input.value = formatado + ',' + centavos;
}



/* ============================================================
   ESCAPE HTML (segurança básica)
============================================================ */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}



/* ============================================================
   BUSCA
============================================================ */
let _searchTimer = null;
document.getElementById('searchInput').addEventListener('input', function() {
  const hero    = document.getElementById('hero');
  const temBusca = this.value.trim().length > 0;

  // Minimiza ou restaura o hero
  hero.classList.toggle('buscando', temBusca);

  // Se limpou a busca, garante rolagem de volta ao topo
  if (!temBusca) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    renderCardapio(this.value, filtroAtivoCat);
  }, 300);
});




/* ============================================================
   CARROSSEL DO HERO
============================================================ */
let _heroTimer   = null;
let _heroIndice  = 0;
let _heroSlides  = []; // lista de URLs de imagens

function iniciarCarrosselHero() {
  // Usa getConfig().heroMedia; se vazio, fallback para imagens dos produtos
  let midia = (getConfig().heroMedia && getConfig().heroMedia.length > 0)
    ? getConfig().heroMedia
    : getProdutos().filter(p => p.imagem).map(p => ({ id: p.id, tipo: 'imagem', src: p.imagem, titulo: p.nome }));

  const hero = document.getElementById('hero');

  // Remove slides anteriores
  hero.querySelectorAll('.hero-slide').forEach(el => el.remove());
  document.getElementById('heroDots').innerHTML = '';
  clearInterval(_heroTimer);

  if (midia.length === 0) { _heroSlides = []; return; }

  _heroSlides = midia;
  _heroIndice = 0;

  // Cria os elementos de slide
  midia.forEach((m, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
    slide.dataset.tipo = m.tipo;

    if (m.tipo === 'video') {
      slide.style.cssText = 'position:absolute;top:0;right:0;bottom:0;left:0;overflow:hidden;';
      const vid = document.createElement('video');
      vid.src      = m.src;
      vid.autoplay = true;
      vid.muted    = true;
      vid.loop     = true;
      vid.playsInline = true;
      vid.style.cssText = 'position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;';
      slide.appendChild(vid);
      if (i === 0) vid.play().catch(() => {});
    } else {
      slide.style.backgroundImage = `url('${m.src}')`;
    }

    hero.insertBefore(slide, hero.firstChild);
  });

  // Cria os dots
  const dotsWrap = document.getElementById('heroDots');
  midia.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.onclick = () => irParaSlide(i);
    dotsWrap.appendChild(dot);
  });
  dotsWrap.style.display = midia.length > 1 ? 'flex' : 'none';

  if (midia.length > 1) {
    _heroTimer = setInterval(proximoSlideAuto, 6000);
  }
}

// Avança automático — vídeos não avançam automaticamente (ficam em loop)
function proximoSlideAuto() {
  const slides = document.querySelectorAll('#hero .hero-slide');
  const atual  = slides[_heroIndice];
  // Se o slide atual é vídeo, não avança — fica em loop
  if (atual && atual.dataset.tipo === 'video') return;
  irParaSlide(_heroIndice + 1);
}

function irParaSlide(indice) {
  const slides = document.querySelectorAll('#hero .hero-slide');
  const dots   = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;

  // Pausa vídeo do slide anterior
  const vidAnterior = (slides[_heroIndice] ? slides[_heroIndice].querySelector('video') : null);
  if (vidAnterior) vidAnterior.pause();

  if(slides[_heroIndice]) slides[_heroIndice].classList.remove('active');
  if(dots[_heroIndice]) dots[_heroIndice].classList.remove('active');

  _heroIndice = (indice + slides.length) % slides.length;

  if(slides[_heroIndice]) slides[_heroIndice].classList.add('active');
  if(dots[_heroIndice]) dots[_heroIndice].classList.add('active');

  // Play no vídeo do novo slide
  const vidNovo = (slides[_heroIndice] ? slides[_heroIndice].querySelector('video') : null);
  if (vidNovo) vidNovo.play().catch(() => {});

  clearInterval(_heroTimer);
  if (slides.length > 1) {
    _heroTimer = setInterval(proximoSlideAuto, 6000);
  }
}




async function inicializar() {
  try {
    await carregarDoSupabase();
  } catch(err) {
    console.error('Erro ao carregar dados:', err);
    if (!getCategorias().length) setCategorias(CATEGORIAS_PADRAO);
    if (!getProdutos().length)   produtos   = PRODUTOS_PADRAO;
    if (!getUsuarios().length)   usuarios   = USUARIOS_PADRAO;
    mostrarToast('Erro de conexão. Exibindo dados padrão.', 'error');
  }

  garantirEntradaEstoque();
  renderCatNav();
  renderCardapio();
  atualizarWhatsapp();
  aplicarLogo();
  iniciarCarrosselHero();
  atualizarBotaoCliente();

  if (getSessaoCliente()) {
    document.getElementById('dropdownNome').textContent = getSessaoCliente().nome;
    document.getElementById('dropdownSub').textContent  = getSessaoCliente().email || '';
  }
  if (getSessao()) {
    document.getElementById('btnLoginTopo').textContent = '⚙ Painel';
  }

  // Remove overlay de loading
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.transition = 'opacity .4s ease';
    overlay.style.opacity = '0';
    setTimeout(function() { overlay.remove(); }, 450);
  }
}

inicializar();



/* ============================================================
   MOTOR DE DRAG & DROP REUTILIZÁVEL
   Funciona para a tabela de categorias e de getProdutos().
   Reordena o array de origem e persiste automaticamente.
============================================================ */
function ativarDragDrop(tbody, tipo) {
  /*
   * CORREÇÃO DO DRAG & DROP:
   * O browser não expõe de qual filho veio o clique no dragstart
   * (e.target sempre é o <tr>). A solução correta é:
   *  1) <tr> começa com draggable=false
   *  2) pointerdown na alça seta draggable=true
   *  3) pointerup / dragend desativa draggable=false
   * Assim o arraste só inicia quando vem da alça.
   */
  let dragSrcId = null;

  // ── Delegação no tbody: dragover e drop ──────────────────────
  tbody.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragSrcId) return;
    const tr = e.target.closest('tr[data-id]');
    if (!tr || tr.dataset.id === dragSrcId) return;
    e.dataTransfer.dropEffect = 'move';
    const rect = tr.getBoundingClientRect();
    tbody.querySelectorAll('tr').forEach(r =>
      r.classList.remove('drag-over-top', 'drag-over-bottom'));
    tr.classList.add(e.clientY < rect.top + rect.height / 2
      ? 'drag-over-top' : 'drag-over-bottom');
  });

  tbody.addEventListener('dragleave', e => {
    if (!tbody.contains(e.relatedTarget)) {
      tbody.querySelectorAll('tr').forEach(r =>
        r.classList.remove('drag-over-top', 'drag-over-bottom'));
    }
  });

  tbody.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrcId) return;
    const tr = e.target.closest('tr[data-id]');
    if (!tr || tr.dataset.id === dragSrcId) return;

    const isTop = tr.classList.contains('drag-over-top');
    tbody.querySelectorAll('tr').forEach(r =>
      r.classList.remove('drag-over-top', 'drag-over-bottom'));

    if (tipo === 'categorias') {
      reordenarArray(categorias, dragSrcId, tr.dataset.id, isTop);
      persistir();
      renderTabelaCategorias();
      renderFiltroCategorias();
    } else {
      const filtroCat = document.getElementById('filtroCategoriaProd').value;
      if (filtroCat) {
        const idsVisiveis = produtos
          .filter(p => p.categoriaId === filtroCat)
          .map(p => p.id);
        reordenarArrayPorIds(produtos, idsVisiveis, dragSrcId, tr.dataset.id, isTop);
      } else {
        reordenarArray(produtos, dragSrcId, tr.dataset.id, isTop);
      }
      persistir();
      renderTabelaProdutos();
    }

    dragSrcId = null;
    mostrarToast('Ordem atualizada! ✓', 'success');
  });

  // ── Por linha: controle via alça ─────────────────────────────
  tbody.querySelectorAll('tr[data-id]').forEach(tr => {
    const handle = tr.querySelector('.drag-handle');
    if (!handle) return;

    // Alça ativa o draggable ao pressionar
    handle.addEventListener('pointerdown', () => { tr.draggable = true; });
    handle.addEventListener('pointerup',   () => { tr.draggable = false; });
    handle.addEventListener('pointercancel', () => { tr.draggable = false; });

    tr.addEventListener('dragstart', e => {
      if (!tr.draggable) { e.preventDefault(); return; }
      dragSrcId = tr.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSrcId);
      requestAnimationFrame(() => tr.classList.add('dragging'));
    });

    tr.addEventListener('dragend', () => {
      tr.draggable = false;
      tr.classList.remove('dragging');
      tbody.querySelectorAll('tr').forEach(r =>
        r.classList.remove('drag-over-top', 'drag-over-bottom'));
      dragSrcId = null;
    });
  });
}

// Reordena um array movendo o item com srcId antes ou depois de tgtId
function reordenarArray(arr, srcId, tgtId, inserirAntes) {
  const srcIdx = arr.findIndex(x => x.id === srcId);
  const tgtIdx = arr.findIndex(x => x.id === tgtId);
  if (srcIdx === -1 || tgtIdx === -1) return;

  const [item] = arr.splice(srcIdx, 1);
  const novoTgt = arr.findIndex(x => x.id === tgtId);
  arr.splice(inserirAntes ? novoTgt : novoTgt + 1, 0, item);
}

// Reordena apenas os itens visíveis (subconjunto) dentro do array global
function reordenarArrayPorIds(arr, idsVisiveis, srcId, tgtId, inserirAntes) {
  // Salva snapshot dos items visíveis (antes de qualquer modificação)
  const snapItems = idsVisiveis.map(id => arr.find(x => x.id === id));

  // Calcula nova ordem dos IDs visíveis
  const srcIdx = idsVisiveis.indexOf(srcId);
  const tgtIdx = idsVisiveis.indexOf(tgtId);
  if (srcIdx === -1 || tgtIdx === -1) return;

  const novaOrdem = [...idsVisiveis];
  const [movido] = novaOrdem.splice(srcIdx, 1);
  const tgtNovo = novaOrdem.indexOf(tgtId);
  novaOrdem.splice(inserirAntes ? tgtNovo : tgtNovo + 1, 0, movido);

  // Mapeia: nova posição (na sequência dos visíveis) → item correto
  const snapNova = novaOrdem.map(id => snapItems.find(x => x.id === id));

  // Reescreve as posições globais com a nova ordem
  const posicoes = idsVisiveis.map(id => arr.findIndex(x => x.id === id));
  posicoes.forEach((pos, i) => { arr[pos] = snapNova[i]; });
}





/* ============================================================
   DRAG-TO-SCROLL — clique e arraste para rolar
   Só ativa depois de 5px de movimento, para não interferir
   com cliques normais em botões, cards e inputs.
============================================================ */
(function () {
  let pressing = false;  // mousedown ocorreu
  let dragging = false;  // threshold superado, drag real
  let target   = null;
  let startX, startY, scrollX, scrollY;
  const THRESHOLD = 5; // px mínimo de movimento para iniciar drag

  function encontrarScrollavel(el) {
    while (el && el !== document.documentElement && el !== document.body) {
      const s = getComputedStyle(el);
      if (
        ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) ||
        ((s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth  > el.clientWidth)
      ) return el;
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const tag = e.target.tagName;
    if (['INPUT','SELECT','TEXTAREA'].includes(tag)) return;

    const scroll = encontrarScrollavel(e.target);
    if (!scroll) return;

    pressing = true;
    dragging = false;
    target   = scroll;
    startX   = e.clientX;
    startY   = e.clientY;
    scrollX  = scroll.scrollLeft;
    scrollY  = scroll.scrollTop;
  }, { passive: true });

  document.addEventListener('mousemove', e => {
    if (!pressing || !target) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragging) {
      // Só inicia o drag depois do threshold
      if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
      dragging = true;
      target.style.cursor = 'grabbing';
      target.style.userSelect = 'none';
    }

    target.scrollLeft = scrollX - dx;
    target.scrollTop  = scrollY - dy;
  }, { passive: true });

  function parar() {
    if (!pressing) return;
    if (dragging && target) {
      target.style.cursor    = '';
      target.style.userSelect = '';
    }
    pressing = false;
    dragging = false;
    target   = null;
  }

  document.addEventListener('mouseup',    parar, { passive: true });
  document.addEventListener('mouseleave', parar, { passive: true });
})();


/* ============================================================
   LOGO DA MARCA
============================================================ */

// Guarda o base64 temporário antes de salvar
let _logoBase64Temp = null;

function handleLogoUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    mostrarToast('Imagem muito grande! Máximo 2 MB.', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    _logoBase64Temp = e.target.result;
    // Atualiza preview do admin
    const prev = document.getElementById('logoPreviewAdmin');
    prev.innerHTML = `<img src="${_logoBase64Temp}" alt="logo" />`;
    document.getElementById('logoFileName').textContent = '✔ ' + file.name;
  };
  reader.readAsDataURL(file);
}

function salvarLogo() {
  if (!_logoBase64Temp) {
    mostrarToast('Selecione uma imagem primeiro.', 'error');
    return;
  }
  getConfig().logo = _logoBase64Temp;
  persistir();
  _logoBase64Temp = null;
  aplicarLogo();
  document.getElementById('btnRemoverLogo').style.display = '';
  mostrarToast('Logo atualizada! ✓', 'success');
}

function removerLogo() {
  getConfig().logo = '';
  persistir();
  _logoBase64Temp = null;
  document.getElementById('logoFileName').textContent = '';
  document.getElementById('inputLogoFile').value = '';
  aplicarLogo();
  carregarPreviewLogoAdmin();
  mostrarToast('Logo removida.', 'success');
}

// Aplica a logo no header público
function aplicarLogo() {
  const heroIcon   = document.getElementById('logoIcon');
  const headerIcon = document.getElementById('logoIconHeader');
  const wrap       = document.getElementById('heroLogoWrap');

  if (getConfig().logo) {
    if (heroIcon)   heroIcon.innerHTML   = `<img src="${getConfig().logo}" alt="Logo" />`;
    if (headerIcon) headerIcon.innerHTML = `<img src="${getConfig().logo}" alt="Logo" />`;
    if (wrap) wrap.classList.add('tem-logo');
  } else {
    if (heroIcon)   heroIcon.innerHTML   = '☕';
    if (headerIcon) headerIcon.innerHTML = '☕';
    if (wrap) wrap.classList.remove('tem-logo');
  }
}

// Atualiza o preview dentro do painel admin
function carregarPreviewLogoAdmin() {
  const prev   = document.getElementById('logoPreviewAdmin');
  const btnRem = document.getElementById('btnRemoverLogo');
  if (!prev) return;
  if (getConfig().logo) {
    prev.innerHTML = `<img src="${getConfig().logo}" alt="logo" style="height:100%;width:auto;max-width:100%;object-fit:contain;display:block;" />`;
    if (btnRem) btnRem.style.display = '';
  } else {
    prev.innerHTML = '☕';
    if (btnRem) btnRem.style.display = 'none';
  }
  document.getElementById('logoFileName').textContent = '';
  document.getElementById('inputLogoFile').value = '';
  _logoBase64Temp = null;
  // Sincroniza também o header e o hero
  aplicarLogo();
}


function abrirModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function fecharModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
// Fecha ao clicar fora
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) fecharModal(overlay.id);
  });
});