/* ============================================================
   ui.js — Interface pública compartilhada
   Responsabilidades: cardápio, hero, carrossel, busca,
   toast, modal, logo, drag-and-drop, scroll spy.

   EXPORTS públicos (usados por outros módulos):
     renderCardapio, renderCatNav, atualizarWhatsapp,
     aplicarLogo, iniciarCarrosselHero, inicializarScrollSpy,
     mostrarToast, abrirModal, fecharModal, abrirConfirm,
     mascaraPreco, escapeHtml,
     handleLogoUpload, salvarLogo, removerLogo,
     carregarPreviewLogoAdmin, ativarDragDrop
============================================================ */
import {
  getCategorias, getProdutos, getConfig,
  getSessao, getSessaoCliente
} from './state.js';
import { WHATSAPP_DEFAULT } from './config.js';
import { persistir } from './db.js';

/* ── Helpers internos ───────────────────────────────────────── */
function norm(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── Toast ──────────────────────────────────────────────────── */
let _toastTimer = null;
export function mostrarToast(msg, tipo = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'show ' + tipo;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.className = ''; }, 2800);
}

/* ── Modal ──────────────────────────────────────────────────── */
export function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

export function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

export function abrirConfirm(mensagem) {
  return new Promise(resolve => {
    const el = document.getElementById('confirmModal');
    if (!el) { resolve(window.confirm(mensagem)); return; }
    const msg = document.getElementById('confirmMsg');
    const ok  = document.getElementById('confirmOkBtn');
    const no  = document.getElementById('confirmNoBtn');
    if (msg) msg.textContent = mensagem;
    function limpar() {
      el.classList.remove('open');
      ok.removeEventListener('click', onOk);
      no.removeEventListener('click', onNo);
    }
    function onOk() { limpar(); resolve(true); }
    function onNo() { limpar(); resolve(false); }
    ok.addEventListener('click', onOk);
    no.addEventListener('click', onNo);
    el.classList.add('open');
  });
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) fecharModal(overlay.id);
  });
});

/* ── Máscara de moeda ───────────────────────────────────────── */
export function mascaraPreco(input) {
  let v = input.value.replace(/\D/g, '');
  v = (parseInt(v, 10) || 0).toString();
  while (v.length < 3) v = '0' + v;
  const inteiros = v.slice(0, -2) || '0';
  const centavos = v.slice(-2);
  input.value = parseInt(inteiros, 10).toLocaleString('pt-BR') + ',' + centavos;
}

/* ── Cardápio público ───────────────────────────────────────── */
let filtroAtivoCat = '';

export function renderCardapio(filtroNome = '', filtroCat = '') {
  const secoes = document.getElementById('productSections');
  if (!secoes) return;
  secoes.innerHTML = '';
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
      <div class="cat-header"><h2>${escapeHtml(cat.nome)}</h2><div class="cat-line"></div></div>
      <div class="products-grid" id="grid_${cat.id}"></div>`;
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
              ? `<img src="${escapeHtml(p.imagem)}" alt="${escapeHtml(p.nome)}" loading="lazy"
                   onerror="this.parentElement.innerHTML='<div class=\\'product-img-placeholder\\'>🛍️</div>'" />`
              : `<div class="product-img-placeholder">🛍️</div>`}
            <div class="product-card-overlay"><span>🛒 Ver detalhes</span></div>
          </div>
          <div class="product-body">
            <div class="product-name">${escapeHtml(p.nome)}</div>
            <div class="product-desc">${escapeHtml(p.descricao)}</div>
            <div class="product-price">${escapeHtml(p.preco)}</div>
          </div>`;
        grid.appendChild(card);
      });
    }
  });

  if (!secoes.innerHTML.trim()) {
    secoes.innerHTML = `<div class="empty-state" style="padding:4rem 0;">
      <div class="empty-state-icon">🔍</div>
      <p>Nenhum produto encontrado para "<strong>${escapeHtml(termoBusca)}</strong>".</p></div>`;
  }
  if (!filtroAtivoCat && !termoBusca) iniciarScrollSpy();
}

export function renderCatNav() {
  const nav = document.getElementById('catNavList');
  if (!nav) return;
  nav.innerHTML = `<button class="cat-btn active" data-cat="" onclick="filtrarPorCategoria(this,'')">Todos</button>`;
  getCategorias().forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = cat.id;
    btn.textContent = cat.nome;
    btn.onclick = () => filtrarPorCategoria(btn, cat.id);
    nav.appendChild(btn);
  });
  iniciarScrollSpy();
}

function filtrarPorCategoria(btn, catId) {
  filtroAtivoCat = catId;
  _pausarScrollSpy();
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const si = document.getElementById('searchInput');
  if (si) si.value = '';
  const hero = document.getElementById('hero');
  if (hero) hero.classList.remove('buscando');
  renderCardapio('', catId);
}

/* ── Scroll Spy ─────────────────────────────────────────────── */
let _scrollSpyObserver = null;
let _scrollSpyActivo   = true;

export function inicializarScrollSpy() { iniciarScrollSpy(); }

function iniciarScrollSpy() {
  if (_scrollSpyObserver) _scrollSpyObserver.disconnect();
  if (filtroAtivoCat) return;
  const headerH = (document.getElementById('header') || {}).offsetHeight || 80;
  const navH    = (document.getElementById('catNav')  || {}).offsetHeight || 48;
  _scrollSpyObserver = new IntersectionObserver(entries => {
    if (!_scrollSpyActivo || filtroAtivoCat) return;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const catId = entry.target.id.replace('sec_', '');
      const btn   = document.querySelector('.cat-btn[data-cat="' + catId + '"]');
      if (!btn) return;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }, { rootMargin: '-' + (headerH + navH) + 'px 0px -40% 0px', threshold: 0 });
  document.querySelectorAll('.category-section').forEach(sec => _scrollSpyObserver.observe(sec));
}

function _pausarScrollSpy() {
  _scrollSpyActivo = false;
  clearTimeout(window._spyTimer);
  window._spyTimer = setTimeout(() => { _scrollSpyActivo = true; }, 1000);
}

/* ── Busca ──────────────────────────────────────────────────── */
(function () {
  const si = document.getElementById('searchInput');
  if (!si) return;
  let _t = null;
  si.addEventListener('input', function () {
    const hero = document.getElementById('hero');
    const tem  = this.value.trim().length > 0;
    if (hero) hero.classList.toggle('buscando', tem);
    if (!tem) window.scrollTo({ top: 0, behavior: 'smooth' });
    clearTimeout(_t);
    _t = setTimeout(() => renderCardapio(this.value, filtroAtivoCat), 300);
  });
})();

/* ── WhatsApp ───────────────────────────────────────────────── */
export function atualizarWhatsapp() {
  const num = getConfig().whatsapp || WHATSAPP_DEFAULT;
  const btn = document.getElementById('btnWhatsapp');
  if (btn) btn.href = `https://wa.me/${num}`;
}

/* ── Logo ───────────────────────────────────────────────────── */
let _logoBase64Temp = null;

export function handleLogoUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { mostrarToast('Máximo 2 MB.', 'error'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    _logoBase64Temp = e.target.result;
    const prev = document.getElementById('logoPreviewAdmin');
    if (prev) prev.innerHTML = `<img src="${_logoBase64Temp}" alt="logo" />`;
    const fn = document.getElementById('logoFileName');
    if (fn) fn.textContent = '✔ ' + file.name;
  };
  reader.readAsDataURL(file);
}

export function salvarLogo() {
  if (!_logoBase64Temp) { mostrarToast('Selecione uma imagem primeiro.', 'error'); return; }
  getConfig().logo = _logoBase64Temp;
  persistir();
  _logoBase64Temp = null;
  aplicarLogo();
  const br = document.getElementById('btnRemoverLogo');
  if (br) br.style.display = '';
  mostrarToast('Logo atualizada! ✓', 'success');
}

export function removerLogo() {
  getConfig().logo = '';
  persistir();
  _logoBase64Temp = null;
  const fn = document.getElementById('logoFileName');
  const ip = document.getElementById('inputLogoFile');
  if (fn) fn.textContent = '';
  if (ip) ip.value = '';
  aplicarLogo();
  carregarPreviewLogoAdmin();
  mostrarToast('Logo removida.', 'success');
}

export function aplicarLogo() {
  const logo      = getConfig().logo;
  const heroIcon  = document.getElementById('logoIcon');
  const headIcon  = document.getElementById('logoIconHeader');
  const wrap      = document.getElementById('heroLogoWrap');
  if (logo) {
    if (heroIcon) heroIcon.innerHTML   = `<img src="${logo}" alt="Logo" />`;
    if (headIcon) headIcon.innerHTML   = `<img src="${logo}" alt="Logo" />`;
    if (wrap)     wrap.classList.add('tem-logo');
  } else {
    if (heroIcon) heroIcon.innerHTML   = '☕';
    if (headIcon) headIcon.innerHTML   = '☕';
    if (wrap)     wrap.classList.remove('tem-logo');
  }
}

export function carregarPreviewLogoAdmin() {
  const prev  = document.getElementById('logoPreviewAdmin');
  const br    = document.getElementById('btnRemoverLogo');
  const fn    = document.getElementById('logoFileName');
  const ip    = document.getElementById('inputLogoFile');
  if (!prev) return;
  const logo = getConfig().logo;
  if (logo) {
    prev.innerHTML = `<img src="${logo}" alt="logo" style="height:100%;width:auto;max-width:100%;object-fit:contain;display:block;" />`;
    if (br) br.style.display = '';
  } else {
    prev.innerHTML = '☕';
    if (br) br.style.display = 'none';
  }
  if (fn) fn.textContent = '';
  if (ip) ip.value = '';
  _logoBase64Temp = null;
  aplicarLogo();
}

/* ── Carrossel do Hero ──────────────────────────────────────── */
let _heroTimer  = null;
let _heroIndice = 0;
let _heroSlides = [];

export function iniciarCarrosselHero() {
  const cfg  = getConfig();
  const hero = document.getElementById('hero');
  if (!hero) return;

  const midia = (cfg.heroMedia && cfg.heroMedia.length > 0)
    ? cfg.heroMedia
    : getProdutos().filter(p => p.imagem).map(p => ({ id: p.id, tipo: 'imagem', src: p.imagem, titulo: p.nome }));

  hero.querySelectorAll('.hero-slide').forEach(el => el.remove());
  const dotsWrap = document.getElementById('heroDots');
  if (dotsWrap) dotsWrap.innerHTML = '';
  clearInterval(_heroTimer);
  if (!midia.length) { _heroSlides = []; return; }
  _heroSlides = midia;
  _heroIndice = 0;

  midia.forEach((m, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide' + (i === 0 ? ' active' : '');
    slide.dataset.tipo = m.tipo;
    if (m.tipo === 'video') {
      slide.style.cssText = 'position:absolute;top:0;right:0;bottom:0;left:0;overflow:hidden;';
      const vid = document.createElement('video');
      vid.src = m.src; vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true;
      vid.style.cssText = 'position:absolute;top:0;right:0;bottom:0;left:0;width:100%;height:100%;object-fit:cover;';
      slide.appendChild(vid);
      if (i === 0) vid.play().catch(() => {});
    } else {
      slide.style.backgroundImage = `url('${m.src}')`;
    }
    hero.insertBefore(slide, hero.firstChild);
  });

  if (dotsWrap) {
    midia.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'hero-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.onclick = () => irParaSlide(i);
      dotsWrap.appendChild(dot);
    });
    dotsWrap.style.display = midia.length > 1 ? 'flex' : 'none';
  }
  if (midia.length > 1) _heroTimer = setInterval(_proximoSlideAuto, 6000);
}

function _proximoSlideAuto() {
  const slides = document.querySelectorAll('#hero .hero-slide');
  if (slides[_heroIndice] && slides[_heroIndice].dataset.tipo === 'video') return;
  irParaSlide(_heroIndice + 1);
}

function irParaSlide(indice) {
  const slides = document.querySelectorAll('#hero .hero-slide');
  const dots   = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;
  const vAnterior = slides[_heroIndice] && slides[_heroIndice].querySelector('video');
  if (vAnterior) vAnterior.pause();
  if (slides[_heroIndice]) slides[_heroIndice].classList.remove('active');
  if (dots[_heroIndice])   dots[_heroIndice].classList.remove('active');
  _heroIndice = (indice + slides.length) % slides.length;
  if (slides[_heroIndice]) slides[_heroIndice].classList.add('active');
  if (dots[_heroIndice])   dots[_heroIndice].classList.add('active');
  const vNovo = slides[_heroIndice] && slides[_heroIndice].querySelector('video');
  if (vNovo) vNovo.play().catch(() => {});
  clearInterval(_heroTimer);
  if (slides.length > 1) _heroTimer = setInterval(_proximoSlideAuto, 6000);
}

/* ── Drag & Drop (reordenação de tabelas admin) ─────────────── */
export function ativarDragDrop(tbody, tipo, onReordenar) {
  /* onReordenar(srcId, tgtId, inserirAntes) — callback do módulo admin.
     ui.js não acessa arrays de admin diretamente. */
  let dragSrcId = null;

  tbody.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dragSrcId) return;
    const tr = e.target.closest('tr[data-id]');
    if (!tr || tr.dataset.id === dragSrcId) return;
    e.dataTransfer.dropEffect = 'move';
    const rect = tr.getBoundingClientRect();
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
    tr.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
  });

  tbody.addEventListener('dragleave', e => {
    if (!tbody.contains(e.relatedTarget))
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
  });

  tbody.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrcId) return;
    const tr = e.target.closest('tr[data-id]');
    if (!tr || tr.dataset.id === dragSrcId) return;
    const antes = tr.classList.contains('drag-over-top');
    tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
    if (onReordenar) onReordenar(dragSrcId, tr.dataset.id, antes);
    dragSrcId = null;
    mostrarToast('Ordem atualizada! ✓', 'success');
  });

  tbody.querySelectorAll('tr[data-id]').forEach(tr => {
    const handle = tr.querySelector('.drag-handle');
    if (!handle) return;
    handle.addEventListener('pointerdown',   () => { tr.draggable = true; });
    handle.addEventListener('pointerup',     () => { tr.draggable = false; });
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
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
      dragSrcId = null;
    });
  });
}

/* ── Drag-to-scroll ─────────────────────────────────────────── */
(function () {
  let pressing = false, dragging = false, target = null, startX, startY, scrollX, scrollY;
  const T = 5;
  function scrollavel(el) {
    while (el && el !== document.documentElement && el !== document.body) {
      const s = getComputedStyle(el);
      if (((s.overflowY==='auto'||s.overflowY==='scroll')&&el.scrollHeight>el.clientHeight)||
          ((s.overflowX==='auto'||s.overflowX==='scroll')&&el.scrollWidth>el.clientWidth)) return el;
      el = el.parentElement;
    }
    return null;
  }
  document.addEventListener('mousedown', e => {
    if (e.button!==0||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
    const s = scrollavel(e.target); if (!s) return;
    pressing=true; dragging=false; target=s;
    startX=e.clientX; startY=e.clientY; scrollX=s.scrollLeft; scrollY=s.scrollTop;
  }, { passive:true });
  document.addEventListener('mousemove', e => {
    if (!pressing||!target) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if (!dragging) { if (Math.abs(dx)<T&&Math.abs(dy)<T) return; dragging=true; target.style.cursor='grabbing'; target.style.userSelect='none'; }
    target.scrollLeft=scrollX-dx; target.scrollTop=scrollY-dy;
  }, { passive:true });
  function parar() {
    if (!pressing) return;
    if (dragging&&target) { target.style.cursor=''; target.style.userSelect=''; }
    pressing=false; dragging=false; target=null;
  }
  document.addEventListener('mouseup', parar, { passive:true });
  document.addEventListener('mouseleave', parar, { passive:true });
})();
