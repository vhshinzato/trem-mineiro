/* js/app.js — Lógica da aplicação
   UI pública, painel admin, carrinho, relatórios e inicialização. */
import { state,
  carregarDados, salvarDados,
  carregarDoSupabase, carregarDadosAdmin,
  persistir, salvarManualSupabase,
  garantirEntradaEstoque, statusEstoque, labelStatus, gerarId,
  loginAdmin, logoutAdmin, getAuthSession, criarAuthUser, atualizarSenhaAuth, uploadImagemStorage
} from './db.js';
import { WHATSAPP_DEFAULT, CATEGORIAS_PADRAO,
         PRODUTOS_PADRAO, USUARIOS_PADRAO } from './config.js';

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

  state.categorias.forEach(cat => {
    if (filtroCat && filtroCat !== cat.id) return;

    const prods = state.produtos.filter(p =>
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

// Renderiza botões de navegação de state.categorias
function renderCatNav() {
  const nav = document.getElementById('catNavList');
  nav.innerHTML = `<button class="cat-btn active" data-cat="" onclick="filtrarPorCategoria(this, '')">Todos</button>`;
  state.categorias.forEach(cat => {
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
  const num = state.config.whatsapp || WHATSAPP_DEFAULT;
  document.getElementById('btnWhatsapp').href = `https://wa.me/${num}`;
}

/* ============================================================
   AUTENTICAÇÃO
============================================================ */
document.getElementById('btnLoginTopo').addEventListener('click', () => {
  if (state.sessao) {
    abrirAdmin();
  } else {
    abrirModal('loginModal');
  }
});

async function fazerLogin() {
  const login = document.getElementById('loginUser').value.trim();
  const senha = document.getElementById('loginPass').value;
  const alerta = document.getElementById('loginAlert');

  const usuario = state.usuarios.find(u => u.login === login);
  if (!usuario) {
    alerta.innerHTML = `<div class="alert alert-error">Login ou senha inválidos.</div>`;
    return;
  }

  const emailAuth = usuario.email || `${login}@trem-mineiro.app`;
  const { error } = await loginAdmin(emailAuth, senha);
  if (error) {
    alerta.innerHTML = `<div class="alert alert-error">Login ou senha inválidos.</div>`;
    return;
  }

  state.sessao = { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil };
  alerta.innerHTML = '';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  fecharModal('loginModal');
  abrirAdmin();
}

async function fazerLogout() {
  await logoutAdmin();
  state.sessao = null;
  fecharAdmin();
  mostrarToast('Sessão encerrada.', 'success');
}

/* ============================================================
   PAINEL ADMINISTRATIVO
============================================================ */
async function abrirAdmin() {
  if (!state.sessao) { abrirModal('loginModal'); return; }

  const isAdmin = state.sessao.perfil === 'admin';

  // Atualiza topbar
  document.getElementById('adminUserName').textContent = state.sessao.nome;
  const badge = document.getElementById('adminBadgeRole');
  badge.textContent = isAdmin ? 'Admin' : 'Funcionário';
  badge.className   = 'badge-role ' + (isAdmin ? 'badge-admin' : 'badge-func');

  // Mostrar/ocultar abas restritas
  document.querySelectorAll('.admin-tab-whatsapp, .admin-tab-usuarios, .admin-tab-fornecedores, .admin-tab-clientes').forEach(el => {
    el.classList.toggle('hidden', !isAdmin);
  });

  // Mostrar/ocultar botão nova categoria
  document.getElementById('btnNovaCat').style.display = isAdmin ? '' : 'none';

  // Abre o painel PRIMEIRO para que elementos tenham dimensões disponíveis
  // Lazy load dos dados admin
  const adminOverlay = document.createElement('div');
  adminOverlay.id = 'adminLoadingOverlay';
  adminOverlay.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:9998;background:rgba(44,24,16,.7);display:flex;align-items:center;justify-content:center;';
  adminOverlay.innerHTML = '<div style="color:var(--ouro);font-size:1rem;font-family:serif;">⏳ Carregando painel...</div>';

  if (!state._adminCarregado) {
    document.body.appendChild(adminOverlay);
    try { await carregarDadosAdmin(); } catch(e) { console.error('Erro ao carregar admin:', e); }
    adminOverlay.remove();
  }

  document.getElementById('adminPanel').classList.add('open');

  // Abre primeira aba
  abrirAba('tabCategorias', document.querySelector('[data-tab="tabCategorias"]'));

  // Renderiza tabelas
  garantirEntradaEstoque();
  renderTabelaCategorias();
  renderTabelaProdutos();
  renderSelectCategorias();
  renderFiltroCategorias();
  renderSelectEstoqueProdutos();
  renderFiltroEstoqueCat();
  renderResumoEstoque();
  renderTabelaEstoque();
  renderHistorico();
  renderSelectHistProd();
  renderTabelaFornecedores();
  renderSelectFornecedores();
  renderTabelaClientes();
  if (isAdmin) {
    renderTabelaPedidos();
    atualizarBadgePedidos();
    inicializarFiltroRelatorio();
    renderRelatorios();
    renderTabelaUsuarios();
    document.getElementById('inputWhatsapp').value = state.config.whatsapp || WHATSAPP_DEFAULT;
    carregarPreviewLogoAdmin();
    renderHeroMediaLista();
  }
}

function fecharAdmin() {
  document.getElementById('adminPanel').classList.remove('open');
}

function voltarCardapio() {
  fecharAdmin();
  renderCatNav();
  renderCardapio();
  atualizarWhatsapp();
  iniciarCarrosselHero();
}

function abrirAba(tabId, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if (btn) btn.classList.add('active');
}

/* ============================================================
   GERENCIAMENTO DE CATEGORIAS
============================================================ */
function renderTabelaCategorias() {
  const tbody = document.getElementById('catTableBody');
  tbody.innerHTML = '';
  const isAdmin = state.sessao && state.sessao.perfil === 'admin';

  if (state.categorias.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="admin-empty">Nenhuma categoria cadastrada.</div></td></tr>`;
    return;
  }

  state.categorias.forEach((cat, i) => {
    const qtd = state.produtos.filter(p => p.categoriaId === cat.id).length;
    const tr = document.createElement('tr');
    tr.dataset.id = cat.id;
    tr.innerHTML = `
      <td><span class="drag-handle" title="Arrastar para reordenar">⠿⠿</span></td>
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(cat.nome)}</strong></td>
      <td>${qtd} produto${qtd !== 1 ? 's' : ''}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="abrirModalCategoria('${cat.id}')">✏️ Editar</button>
          ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="confirmarExcluirCategoria('${cat.id}')">🗑️ Excluir</button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Ativa drag-and-drop na tabela de state.categorias
  ativarDragDrop(tbody, 'categorias');
}

document.getElementById('btnNovaCat').addEventListener('click', () => abrirModalCategoria(null));

function abrirModalCategoria(catId) {
  document.getElementById('catNome').value = '';
  document.getElementById('catEditId').value = '';
  document.getElementById('catNomeErr').textContent = '';
  document.getElementById('catAlert').innerHTML = '';

  if (catId) {
    const cat = state.categorias.find(c => c.id === catId);
    if (!cat) return;
    document.getElementById('modalCatTitulo').textContent = 'Editar Categoria';
    document.getElementById('catNome').value = cat.nome;
    document.getElementById('catEditId').value = cat.id;
  } else {
    document.getElementById('modalCatTitulo').textContent = 'Nova Categoria';
  }
  abrirModal('modalCategoria');
}

function salvarCategoria() {
  const nome = document.getElementById('catNome').value.trim();
  const editId = document.getElementById('catEditId').value;
  let valido = true;

  document.getElementById('catNomeErr').textContent = '';
  document.getElementById('catNome').classList.remove('error');

  if (!nome) {
    document.getElementById('catNomeErr').textContent = 'Nome obrigatório.';
    document.getElementById('catNome').classList.add('error');
    valido = false;
  }
  if (!valido) return;

  if (editId) {
    const idx = state.categorias.findIndex(c => c.id === editId);
    if (idx > -1) state.categorias[idx].nome = nome;
    mostrarToast('Categoria atualizada!', 'success');
  } else {
    state.categorias.push({ id: gerarId(), nome });
    mostrarToast('Categoria criada!', 'success');
  }
  persistir();
  fecharModal('modalCategoria');
  renderTabelaCategorias();
  renderSelectCategorias();
  renderFiltroCategorias();
}

function confirmarExcluirCategoria(catId) {
  const cat = state.categorias.find(c => c.id === catId);
  if (!cat) return;
  const qtd = state.produtos.filter(p => p.categoriaId === catId).length;
  document.getElementById('confirmTitulo').textContent = 'Excluir Categoria';
  document.getElementById('confirmMsg').innerHTML =
    `Deseja excluir a categoria <strong>"${escapeHtml(cat.nome)}"</strong>?` +
    (qtd > 0 ? `<br><br>⚠️ Atenção: ${qtd} produto${qtd>1?'s':''} vinculado${qtd>1?'s':''} também ser${qtd>1?'ão':'á'} excluído${qtd>1?'s':''}.` : '');
  document.getElementById('confirmOkBtn').onclick = () => excluirCategoria(catId);
  abrirModal('confirmModal');
}

function excluirCategoria(catId) {
  const prodIds = state.produtos.filter(p => p.categoriaId === catId).map(p => p.id);
  state.categorias = state.categorias.filter(c => c.id !== catId);
  state.produtos   = state.produtos.filter(p => p.categoriaId !== catId);
  persistir();
  // Deleta do Supabase
  fecharModal('confirmModal');
  renderTabelaCategorias();
  renderTabelaProdutos();
  renderSelectCategorias();
  renderFiltroCategorias();
  mostrarToast('Categoria excluída.', 'success');
}

/* ============================================================
   GERENCIAMENTO DE PRODUTOS
============================================================ */
function renderTabelaProdutos() {
  const tbody = document.getElementById('prodTableBody');
  const filtroCat = document.getElementById('filtroCategoriaProd').value;
  tbody.innerHTML = '';

  let lista = state.produtos;
  if (filtroCat) lista = lista.filter(p => p.categoriaId === filtroCat);

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="admin-empty">Nenhum produto encontrado.</div></td></tr>`;
    return;
  }

  lista.forEach(p => {
    const cat = state.categorias.find(c => c.id === p.categoriaId);
    const tr = document.createElement('tr');
    tr.dataset.id = p.id;
    tr.innerHTML = `
      <td><span class="drag-handle" title="Arrastar para reordenar">⠿⠿</span></td>
      <td>
        ${p.imagem
          ? `<img class="table-thumb" src="${p.imagem.startsWith('data:') ? p.imagem : escapeHtml(p.imagem)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'table-thumb-placeholder\\'>🛍️</div>'" />`
          : `<div class="table-thumb-placeholder">🛍️</div>`
        }
      </td>
      <td><strong>${escapeHtml(p.nome)}</strong></td>
      <td>${cat ? escapeHtml(cat.nome) : '<em>—</em>'}</td>
      <td>${escapeHtml(p.preco)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="abrirModalProduto('${p.id}')">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="confirmarExcluirProduto('${p.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Ativa drag-and-drop na tabela de state.produtos
  ativarDragDrop(tbody, 'produtos');
}

function renderSelectCategorias() {
  // Select no modal de produto
  const sel = document.getElementById('prodCategoria');
  sel.innerHTML = '<option value="">Selecione uma categoria</option>';
  state.categorias.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    sel.appendChild(opt);
  });
}

function renderFiltroCategorias() {
  const sel = document.getElementById('filtroCategoriaProd');
  const val = sel.value;
  sel.innerHTML = '<option value="">Todas as categorias</option>';
  state.categorias.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    if (c.id === val) opt.selected = true;
    sel.appendChild(opt);
  });
}

function abrirModalProduto(prodId) {
  // Reseta estado de imagem
  _imagemBase64 = null;
  _imgAbaAtiva = 'url';

  // Limpa campos
  ['prodNome','prodDesc','prodPreco','prodImagem'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('error');
  });
  ['prodNomeErr','prodDescErr','prodPrecoErr','prodCategoriaErr'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  document.getElementById('prodEditId').value = '';
  document.getElementById('prodCategoria').value = '';
  document.getElementById('prodImagemFile').value = '';
  document.getElementById('uploadFileName').textContent = '';
  document.getElementById('imgPreviewWrap').innerHTML = '<span>Sem imagem</span>';
  document.getElementById('prodAlert').innerHTML = '';

  // Garante que a aba URL esteja ativa por padrão
  document.getElementById('imgPanelUrl').style.display    = '';
  document.getElementById('imgPanelUpload').style.display = 'none';
  document.querySelectorAll('.img-tab').forEach((b, i) => b.classList.toggle('active', i === 0));

  if (prodId) {
    const p = state.produtos.find(x => x.id === prodId);
    if (!p) return;
    document.getElementById('modalProdTitulo').textContent = 'Editar Produto';
    document.getElementById('prodEditId').value    = p.id;
    document.getElementById('prodCategoria').value = p.categoriaId;
    document.getElementById('prodNome').value      = p.nome;
    document.getElementById('prodDesc').value      = p.descricao;
    document.getElementById('prodPreco').value     = p.preco.replace('R$ ', '');

    if (p.imagem) {
      // Se for base64, mostrar na aba Upload; se for URL, mostrar na aba URL
      if (p.imagem.startsWith('data:')) {
        _imagemBase64 = p.imagem;
        _imgAbaAtiva = 'upload';
        document.getElementById('imgPanelUrl').style.display    = 'none';
        document.getElementById('imgPanelUpload').style.display = '';
        document.querySelectorAll('.img-tab').forEach((b, i) => b.classList.toggle('active', i === 1));
        document.getElementById('uploadFileName').textContent = '✔ Imagem carregada';
      } else {
        document.getElementById('prodImagem').value = p.imagem;
        _imgAbaAtiva = 'url';
      }
      document.getElementById('imgPreviewWrap').innerHTML = `
        <img src="${p.imagem.startsWith('data:') ? p.imagem : escapeHtml(p.imagem)}"
             onerror="this.parentElement.innerHTML='<span>Imagem inválida</span>'" />
        <button class="preview-remove" title="Remover imagem" onclick="removerImagem()">✕</button>
      `;
    }
  } else {
    document.getElementById('modalProdTitulo').textContent = 'Novo Produto';
  }

  // Ativa drag & drop na área de upload
  setTimeout(initDragDrop, 50);
  abrirModal('modalProduto');
}

async function salvarProduto() {
  const catId = document.getElementById('prodCategoria').value;
  const nome  = document.getElementById('prodNome').value.trim();
  const desc  = document.getElementById('prodDesc').value.trim();
  const preco = document.getElementById('prodPreco').value.trim();
  const editId= document.getElementById('prodEditId').value;

  let valido = true;
  const erros = { prodCategoriaErr: !catId, prodNomeErr: !nome, prodDescErr: !desc, prodPrecoErr: !preco };
  Object.keys(erros).forEach(k => {
    const fieldId = k.replace('Err','');
    document.getElementById(k).textContent = erros[k] ? 'Campo obrigatório.' : '';
    document.getElementById(fieldId) && document.getElementById(fieldId).classList.toggle('error', erros[k]);
    if (erros[k]) valido = false;
  });
  if (!valido) return;

  const precoFormatado = 'R$ ' + (preco.includes(',') ? preco : parseFloat(preco).toFixed(2).replace('.',','));

  // Upload da imagem para o Storage se houver arquivo selecionado
  let img = obterImagemFinal();
  if (_imgAbaAtiva === 'upload' && _imagemBase64 && _imagemFile) {
    try {
      mostrarToast('Enviando imagem...', 'success');
      const prodId = editId || gerarId();
      img = await uploadImagemStorage(_imagemBase64, 'produtos', prodId);
      if (editId) {
        const idx = state.produtos.findIndex(p => p.id === editId);
        if (idx > -1) state.produtos[idx] = { ...state.produtos[idx], categoriaId: catId, nome, descricao: desc, preco: precoFormatado, imagem: img };
        mostrarToast('Produto atualizado!', 'success');
      } else {
        state.produtos.push({ id: prodId, categoriaId: catId, nome, descricao: desc, preco: precoFormatado, imagem: img });
        garantirEntradaEstoque();
        mostrarToast('Produto criado!', 'success');
      }
    } catch(err) {
      mostrarToast('Erro ao enviar imagem: ' + err.message, 'error');
      return;
    }
  } else {
    if (editId) {
      const idx = state.produtos.findIndex(p => p.id === editId);
      if (idx > -1) state.produtos[idx] = { ...state.produtos[idx], categoriaId: catId, nome, descricao: desc, preco: precoFormatado, imagem: img };
      mostrarToast('Produto atualizado!', 'success');
    } else {
      state.produtos.push({ id: gerarId(), categoriaId: catId, nome, descricao: desc, preco: precoFormatado, imagem: img });
      garantirEntradaEstoque();
      mostrarToast('Produto criado!', 'success');
    }
  }

  persistir();
  fecharModal('modalProduto');
  renderTabelaProdutos();
}

function confirmarExcluirProduto(prodId) {
  const p = state.produtos.find(x => x.id === prodId);
  if (!p) return;
  document.getElementById('confirmTitulo').textContent = 'Excluir Produto';
  document.getElementById('confirmMsg').innerHTML = `Deseja excluir o produto <strong>"${escapeHtml(p.nome)}"</strong>? Esta ação não pode ser desfeita.`;
  document.getElementById('confirmOkBtn').onclick = () => excluirProduto(prodId);
  abrirModal('confirmModal');
}

function excluirProduto(prodId) {
  state.produtos   = state.produtos.filter(p => p.id !== prodId);
  delete state.estoque[prodId];
  state.movimentos = state.movimentos.filter(m => m.produtoId !== prodId);
  persistir();
  fecharModal('confirmModal');
  renderTabelaProdutos();
  renderResumoEstoque();
  renderTabelaEstoque();
  renderHistorico();
  mostrarToast('Produto excluído.', 'success');
}

/* ============================================================
   GERENCIAMENTO DE IMAGEM DO PRODUTO (URL + Upload)
============================================================ */

// Comprime uma imagem para max 800x800 JPEG 80% via Canvas
function comprimirImagem(file, maxW, maxH, qualidade) {
  return new Promise(function(resolve) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        let w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Guarda o base64 da imagem carregada do arquivo (temporário, por modal aberto)
let _imagemBase64 = null;
let _imagemFile   = null; // arquivo original para upload no Storage
// Indica qual aba está ativa: 'url' ou 'upload'
let _imgAbaAtiva = 'url';

// Troca entre as abas URL e Upload
function trocarAbaImagem(aba, btn) {
  _imgAbaAtiva = aba;
  document.querySelectorAll('.img-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('imgPanelUrl').style.display    = aba === 'url'    ? '' : 'none';
  document.getElementById('imgPanelUpload').style.display = aba === 'upload' ? '' : 'none';
  // Limpa preview e estado ao trocar de aba
  _imagemBase64 = null;
  _imagemFile   = null;
  document.getElementById('prodImagem').value = '';
  document.getElementById('prodImagemFile').value = '';
  document.getElementById('uploadFileName').textContent = '';
  document.getElementById('imgPreviewWrap').innerHTML = '<span>Sem imagem</span>';
}

// Preview de imagem ao digitar URL
function previewImagem() {
  const url = document.getElementById('prodImagem').value.trim();
  const wrap = document.getElementById('imgPreviewWrap');
  if (!url) { wrap.innerHTML = '<span>Sem imagem</span>'; return; }
  wrap.innerHTML = `
    <img src="${escapeHtml(url)}" onerror="this.parentElement.innerHTML='<span>Imagem inválida ou inacessível</span>'" />
    <button class="preview-remove" title="Remover imagem" onclick="removerImagem()">✕</button>
  `;
}

// Lida com o upload de arquivo
function handleFileUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  // Validação de tamanho: máx 5 MB
  if (file.size > 10 * 1024 * 1024) {
    mostrarToast('Imagem muito grande! Máximo 10 MB.', 'error');
    input.value = '';
    return;
  }

  comprimirImagem(file, 800, 800, 0.80).then(function(base64) {
    _imagemBase64 = base64;
    _imagemFile   = file;
    document.getElementById('uploadFileName').textContent = '✔ ' + file.name;
    const wrap = document.getElementById('imgPreviewWrap');
    wrap.innerHTML = `
      <img src="${_imagemBase64}" alt="preview" />
      <button class="preview-remove" title="Remover imagem" onclick="removerImagem()">✕</button>
    `;
  });
}

// Remove a imagem atual do preview
function removerImagem() {
  _imagemBase64 = null;
  _imagemFile   = null;
  document.getElementById('prodImagem').value = '';
  document.getElementById('prodImagemFile').value = '';
  document.getElementById('uploadFileName').textContent = '';
  document.getElementById('imgPreviewWrap').innerHTML = '<span>Sem imagem</span>';
}

// Drag & Drop na área de upload
function initDragDrop() {
  const area = document.getElementById('uploadDropArea');
  if (!area) return;
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const fakeInput = { files: [file] };
      handleFileUpload(fakeInput);
    }
  });
}

// Retorna a string de imagem final a ser salva (URL ou base64)
function obterImagemFinal() {
  if (_imgAbaAtiva === 'upload') return _imagemBase64 || '';
  return document.getElementById('prodImagem').value.trim();
}

/* ============================================================
   GERENCIAMENTO DE USUÁRIOS (somente admin)
============================================================ */
function renderTabelaUsuarios() {
  const tbody = document.getElementById('userTableBody');
  tbody.innerHTML = '';

  state.usuarios.forEach((u, i) => {
    const isSelf = state.sessao && state.sessao.id === u.id;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(u.nome)}</strong> ${isSelf ? '<em style="color:var(--ouro);font-size:.75rem;">(você)</em>' : ''}</td>
      <td>${escapeHtml(u.login)}</td>
      <td><span class="badge-role ${u.perfil === 'admin' ? 'badge-admin' : 'badge-func'}" style="font-size:.7rem;padding:.2rem .6rem;">${u.perfil === 'admin' ? 'Admin' : 'Funcionário'}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="abrirModalUsuario('${u.id}')">✏️ Editar</button>
          ${!isSelf ? `<button class="btn btn-danger btn-sm" onclick="confirmarExcluirUsuario('${u.id}')">🗑️</button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirModalUsuario(userId) {
  ['userNome','userLogin','userSenha'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('error');
  });
  ['userNomeErr','userLoginErr','userSenhaErr'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  document.getElementById('userEditId').value = '';
  document.getElementById('userPerfil').value = 'funcionario';
  document.getElementById('userAlert').innerHTML = '';

  if (userId) {
    const u = state.usuarios.find(x => x.id === userId);
    if (!u) return;
    document.getElementById('modalUserTitulo').textContent = 'Editar Usuário';
    document.getElementById('userEditId').value = u.id;
    document.getElementById('userNome').value   = u.nome;
    document.getElementById('userLogin').value  = u.login;
    document.getElementById('userSenha').value  = u.senha;
    document.getElementById('userPerfil').value = u.perfil;
  } else {
    document.getElementById('modalUserTitulo').textContent = 'Novo Usuário';
  }
  abrirModal('modalUsuario');
}

async function salvarUsuario() {
  const nome   = document.getElementById('userNome').value.trim();
  const login  = document.getElementById('userLogin').value.trim();
  const senha  = document.getElementById('userSenha').value;
  const perfil = document.getElementById('userPerfil').value;
  const editId = document.getElementById('userEditId').value;

  let valido = true;
  const campos = { userNomeErr: !nome, userLoginErr: !login, userSenhaErr: !senha };
  Object.keys(campos).forEach(k => {
    const fId = k.replace('Err','');
    document.getElementById(k).textContent = campos[k] ? 'Campo obrigatório.' : '';
    document.getElementById(fId).classList.toggle('error', campos[k]);
    if (campos[k]) valido = false;
  });
  if (!valido) return;

  // Verifica login duplicado
  const dupLogin = state.usuarios.find(u => u.login === login && u.id !== editId);
  if (dupLogin) {
    document.getElementById('userLoginErr').textContent = 'Login já está em uso.';
    document.getElementById('userLogin').classList.add('error');
    return;
  }

  if (editId) {
    const idx = state.usuarios.findIndex(u => u.id === editId);
    if (idx > -1) state.usuarios[idx] = { ...state.usuarios[idx], nome, login, senha, perfil };
    if (state.sessao && editId === state.sessao.id) {
      const { error: authErr } = await atualizarSenhaAuth(senha);
      if (authErr) {
        mostrarToast('Dados salvos, mas falha ao atualizar senha: ' + authErr.message, 'error');
        persistir();
        fecharModal('modalUsuario');
        renderTabelaUsuarios();
        return;
      }
    }
    mostrarToast('Usuário atualizado!', 'success');
  } else {
    const novoEmail = document.getElementById('userEmail') ? document.getElementById('userEmail').value.trim() : '';
    state.usuarios.push({ id: gerarId(), nome, login, email: novoEmail, senha, perfil });
    const emailAuth = novoEmail || `${login}@trem-mineiro.app`;
    await criarAuthUser(emailAuth, senha);
    mostrarToast('Usuário criado!', 'success');
  }
  persistir();
  fecharModal('modalUsuario');
  renderTabelaUsuarios();
}

function confirmarExcluirUsuario(userId) {
  const u = state.usuarios.find(x => x.id === userId);
  if (!u) return;
  document.getElementById('confirmTitulo').textContent = 'Excluir Usuário';
  document.getElementById('confirmMsg').innerHTML = `Deseja excluir o usuário <strong>"${escapeHtml(u.nome)}"</strong>?`;
  document.getElementById('confirmOkBtn').onclick = () => excluirUsuario(userId);
  abrirModal('confirmModal');
}

function excluirUsuario(userId) {
  state.usuarios = state.usuarios.filter(u => u.id !== userId);
  persistir();
  fecharModal('confirmModal');
  renderTabelaUsuarios();
  mostrarToast('Usuário excluído.', 'success');
}

/* ============================================================
   WHATSAPP
============================================================ */
function salvarWhatsapp() {
  const num = document.getElementById('inputWhatsapp').value.trim();
  if (!num) { mostrarToast('Informe o número!', 'error'); return; }
  state.config.whatsapp = num;
  persistir();
  atualizarWhatsapp();
  mostrarToast('Número salvo!', 'success');
}

/* ============================================================
   LOGO DA MARCA
============================================================ */

// Guarda o base64 temporário antes de salvar
let _logoBase64Temp = null;
let _logoFileTemp   = null;

function handleLogoUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    mostrarToast('Imagem muito grande! Máximo 10 MB.', 'error');
    input.value = '';
    return;
  }
  comprimirImagem(file, 400, 400, 0.85).then(function(base64) {
    _logoBase64Temp = base64;
    _logoFileTemp   = file;
    const prev = document.getElementById('logoPreviewAdmin');
    prev.innerHTML = `<img src="${_logoBase64Temp}" alt="logo" />`;
    document.getElementById('logoFileName').textContent = '✔ ' + file.name;
  });
}

async function salvarLogo() {
  if (!_logoBase64Temp) {
    mostrarToast('Selecione uma imagem primeiro.', 'error');
    return;
  }
  try {
    mostrarToast('Enviando logo...', 'success');
    const url = await uploadImagemStorage(_logoBase64Temp, 'logo', 'logo');
    state.config.logo = url;
  } catch(err) {
    mostrarToast('Erro ao enviar logo: ' + err.message, 'error');
    return;
  }
  persistir();
  _logoBase64Temp = null;
  _logoFileTemp   = null;
  aplicarLogo();
  document.getElementById('btnRemoverLogo').style.display = '';
  mostrarToast('Logo atualizada! ✓', 'success');
}

function removerLogo() {
  state.config.logo = '';
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

  if (state.config.logo) {
    if (heroIcon)   heroIcon.innerHTML   = `<img src="${state.config.logo}" alt="Logo" />`;
    if (headerIcon) headerIcon.innerHTML = `<img src="${state.config.logo}" alt="Logo" />`;
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
  if (state.config.logo) {
    prev.innerHTML = `<img src="${state.config.logo}" alt="logo" style="height:100%;width:auto;max-width:100%;object-fit:contain;display:block;" />`;
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
function toggleSenha(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

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
   MÓDULO DE ESTOQUE
============================================================ */

// Filtro de status ativo na tabela de state.estoque
let _filtroEstoqueStatus = '';

function filtroEstoqueStatus(btn, status) {
  _filtroEstoqueStatus = status;
  document.querySelectorAll('.estoque-filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabelaEstoque();
}

// ── Cards de resumo ──────────────────────────────────────────
function renderResumoEstoque() {
  garantirEntradaEstoque();
  const total   = state.produtos.length;
  const zeros   = state.produtos.filter(p => statusEstoque(p.id) === 'zero').length;
  const baixos  = state.produtos.filter(p => statusEstoque(p.id) === 'baixo').length;
  const excessos= state.produtos.filter(p => statusEstoque(p.id) === 'excesso').length;
  const ok      = total - zeros - baixos - excessos;
  const totalUn = Object.values(state.estoque).reduce((s, e) => s + (e.quantidade || 0), 0);

  document.getElementById('estoqueResumo').innerHTML = `
    <div class="estoque-card total">
      <div class="estoque-card-label">Total de produtos</div>
      <div class="estoque-card-valor">${total}</div>
      <div class="estoque-card-sub">${totalUn} unidades em estoque</div>
    </div>
    <div class="estoque-card ok">
      <div class="estoque-card-label">Estoque normal</div>
      <div class="estoque-card-valor">${ok}</div>
      <div class="estoque-card-sub">produtos com saldo saudável</div>
    </div>
    <div class="estoque-card baixo">
      <div class="estoque-card-label">Estoque baixo</div>
      <div class="estoque-card-valor">${baixos}</div>
      <div class="estoque-card-sub">abaixo do mínimo configurado</div>
    </div>
    <div class="estoque-card zero">
      <div class="estoque-card-label">Esgotado</div>
      <div class="estoque-card-valor">${zeros}</div>
      <div class="estoque-card-sub">sem unidades disponíveis</div>
    </div>
    <div class="estoque-card excesso">
      <div class="estoque-card-label">Acima do máximo</div>
      <div class="estoque-card-valor">${excessos}</div>
      <div class="estoque-card-sub">excedeu a capacidade máxima</div>
    </div>
  `;
}

// ── Tabela de state.estoque ────────────────────────────────────────
function renderTabelaEstoque() {
  garantirEntradaEstoque();
  const tbody    = document.getElementById('estoqueTableBody');
  const filtroCat = document.getElementById('filtroEstoqueCat').value;
  tbody.innerHTML = '';

  let lista = state.produtos;
  if (filtroCat)               lista = lista.filter(p => p.categoriaId === filtroCat);
  if (_filtroEstoqueStatus)    lista = lista.filter(p => statusEstoque(p.id) === _filtroEstoqueStatus);

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="admin-empty">Nenhum produto encontrado.</div></td></tr>`;
    return;
  }

  lista.forEach(p => {
    const cat = state.categorias.find(c => c.id === p.categoriaId);
    const est = state.estoque[p.id] || { quantidade: 0, minimo: 5, maximo: 50 };
    const status = statusEstoque(p.id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:.6rem;">
          ${p.imagem
            ? `<img style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;" src="${p.imagem.startsWith('data:') ? p.imagem : escapeHtml(p.imagem)}" onerror="this.style.display='none'" />`
            : `<div style="width:36px;height:36px;border-radius:6px;background:var(--creme-mid);display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0;">🛍️</div>`
          }
          <strong>${escapeHtml(p.nome)}</strong>
        </div>
      </td>
      <td>${cat ? escapeHtml(cat.nome) : '—'}</td>
      <td>
        <span style="font-family:var(--font-serif);font-size:1.1rem;font-weight:700;color:${status==='zero'?'var(--erro)':status==='baixo'?'#b7860a':status==='excesso'?'#1a6fa8':'var(--sucesso)'}">
          ${est.quantidade}
        </span>
        <span style="font-size:.75rem;color:var(--cinza);margin-left:.2rem;">un.</span>
      </td>
      <td>
        <input
          class="qtd-input"
          type="number" min="0"
          value="${est.minimo}"
          title="Estoque mínimo — pressione Enter ou saia do campo para salvar"
          style="width:64px;"
          onchange="salvarLimiteInline('${p.id}','minimo',this)"
          onkeydown="if(event.key==='Enter') this.blur()"
        />
      </td>
      <td>
        <input
          class="qtd-input"
          type="number" min="0"
          value="${est.maximo}"
          title="Estoque máximo — pressione Enter ou saia do campo para salvar"
          style="width:64px;"
          onchange="salvarLimiteInline('${p.id}','maximo',this)"
          onkeydown="if(event.key==='Enter') this.blur()"
        />
      </td>
      <td>${labelStatus(status)}</td>
      <td>
        <div class="qtd-control">
          <button class="qtd-btn minus" onclick="ajusteRapido('${p.id}', -1)" title="Remover 1">−</button>
          <input
            class="qtd-input"
            type="number"
            min="0"
            value="${est.quantidade}"
            title="Digite a quantidade e pressione Enter ou saia do campo"
            onchange="ajusteDigitado('${p.id}', this)"
            onkeydown="if(event.key==='Enter') this.blur()"
          />
          <button class="qtd-btn" onclick="ajusteRapido('${p.id}', 1)" title="Adicionar 1">+</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Ajuste rápido (+1 / -1) ─────────────────────────────────
function ajusteRapido(prodId, delta) {
  garantirEntradaEstoque();
  const est = state.estoque[prodId];
  const novo = Math.max(0, est.quantidade + delta);
  if (novo === est.quantidade) return;

  est.quantidade = novo;
  registrarMovimento(prodId, delta > 0 ? 'entrada' : 'saida', Math.abs(delta), 'Ajuste rápido', novo);
  persistir();
  // Atualiza só o input da linha sem re-renderizar a tabela inteira
  const inputs = document.querySelectorAll(`#estoqueTableBody .qtd-input`);
  inputs.forEach(inp => {
    if (inp.closest('tr') && inp.closest('tr').querySelector(`[onclick*="${prodId}"]`)) {
      inp.value = novo;
    }
  });
  renderTabelaEstoque();
  renderResumoEstoque();
  renderHistorico();
}

// ── Ajuste por digitação direta ───────────────────────────────
function ajusteDigitado(prodId, input) {
  garantirEntradaEstoque();
  const est  = state.estoque[prodId];
  const novo = Math.max(0, parseInt(input.value, 10) || 0);

  if (novo === est.quantidade) { input.value = est.quantidade; return; }

  const diff   = novo - est.quantidade;
  const tipo   = diff > 0 ? 'entrada' : 'saida';
  est.quantidade = novo;
  registrarMovimento(prodId, tipo, Math.abs(diff), 'Digitado manualmente', novo);
  persistir();
  renderResumoEstoque();
  renderHistorico();
  input.value = novo; // garante valor limpo (ex: NaN ou negativo)
  mostrarToast(`Estoque atualizado para ${novo} un. ✓`, 'success');
}

// ── Modal de movimentação ────────────────────────────────────
function abrirModalMovimento(tipo) {
  const titulos = { entrada: '＋ Entrada de Estoque', saida: '－ Saída de Estoque', ajuste: '✎ Ajuste de Estoque' };
  const labels  = { entrada: 'Quantidade a adicionar *', saida: 'Quantidade a retirar *', ajuste: 'Nova quantidade total *' };

  document.getElementById('modalMovTitulo').textContent = titulos[tipo] || 'Movimentação';
  document.getElementById('movQtdLabel').textContent    = labels[tipo];
  document.getElementById('movTipo').value    = tipo;
  document.getElementById('movProduto').value = '';
  document.getElementById('movQtd').value     = '';
  document.getElementById('movObs').value     = '';
  document.getElementById('movProdutoErr').textContent = '';
  document.getElementById('movQtdErr').textContent     = '';
  document.getElementById('movAlert').innerHTML        = '';

  // Campos exclusivos de entrada
  const isEntrada = tipo === 'entrada';
  document.getElementById('movCamposEntrada').style.display = isEntrada ? '' : 'none';
  if (isEntrada) {
    document.getElementById('movFornecedorSel').value = '';
    document.getElementById('movFornecedor').value  = '';
    document.getElementById('movDataCompra').value  = new Date().toISOString().slice(0,10); // hoje como padrão
    document.getElementById('movValorUnit').value   = '';
  }

  abrirModal('modalMovimento');
}

function confirmarMovimento() {
  const tipo   = document.getElementById('movTipo').value;
  const prodId = document.getElementById('movProduto').value;
  const qtd    = parseInt(document.getElementById('movQtd').value, 10);
  const obs    = document.getElementById('movObs').value.trim();
  let valido = true;

  document.getElementById('movProdutoErr').textContent = '';
  document.getElementById('movQtdErr').textContent     = '';

  if (!prodId) { document.getElementById('movProdutoErr').textContent = 'Selecione um produto.'; valido = false; }
  if (isNaN(qtd) || qtd < 0) { document.getElementById('movQtdErr').textContent = 'Informe uma quantidade válida.'; valido = false; }
  if (!valido) return;

  // Campos extras só para entrada
  const extras = {};
  if (tipo === 'entrada') {
    // Usa o campo texto (pode ter sido preenchido manualmente ou via select)
    extras.fornecedor  = document.getElementById('movFornecedor').value.trim() || document.getElementById('movFornecedorSel').value.trim();
    extras.dataCompra  = document.getElementById('movDataCompra').value;
    const vRaw = document.getElementById('movValorUnit').value.trim();
    extras.valorUnit   = vRaw ? precoParaNum('R$ ' + vRaw) : null;
  }

  garantirEntradaEstoque();
  const est = state.estoque[prodId];
  let novoTotal;

  if (tipo === 'entrada') {
    novoTotal = est.quantidade + qtd;
  } else if (tipo === 'saida') {
    novoTotal = Math.max(0, est.quantidade - qtd);
  } else {
    novoTotal = qtd;
  }

  est.quantidade = novoTotal;
  registrarMovimento(prodId, tipo, tipo === 'ajuste' ? novoTotal : qtd, obs, novoTotal, extras);
  persistir();
  fecharModal('modalMovimento');
  renderTabelaEstoque();
  renderResumoEstoque();
  renderHistorico();
  mostrarToast('Estoque atualizado! ✓', 'success');
}

// ── Registro de state.movimentos ───────────────────────────────────
function registrarMovimento(prodId, tipo, quantidade, obs, novoTotal, extras = {}) {
  state.movimentos.unshift({
    id:          gerarId(),
    produtoId:   prodId,
    tipo,
    quantidade,
    novoTotal,
    obs:         obs || '',
    fornecedor:  extras.fornecedor  || '',
    dataCompra:  extras.dataCompra  || '',
    valorUnit:   extras.valorUnit || null,
    data:        new Date().toISOString()
  });
  if (state.movimentos.length > 200) state.movimentos = state.movimentos.slice(0, 200);
}

// ── Histórico ────────────────────────────────────────────────
function renderHistorico() {
  const tbody   = document.getElementById('historicoTableBody');
  const filtProd = document.getElementById('filtroHistProd').value;
  tbody.innerHTML = '';

  let lista = filtProd ? state.movimentos.filter(m => m.produtoId === filtProd) : state.movimentos;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="admin-empty">Nenhuma movimentação registrada.</div></td></tr>`;
    return;
  }

  lista.forEach(m => {
    const prod = state.produtos.find(p => p.id === m.produtoId);
    const data = new Date(m.data);
    const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});

    const tipoLabels = { entrada: '＋ Entrada', saida: '－ Saída', ajuste: '✎ Ajuste' };
    const qtdClass   = m.tipo === 'entrada' ? 'hist-qtd-plus' : m.tipo === 'saida' ? 'hist-qtd-minus' : 'hist-qtd-adj';
    const qtdPrefix  = m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : '→';

    // Campos exclusivos de entrada
    const fornecedor = m.tipo === 'entrada' && m.fornecedor ? escapeHtml(m.fornecedor) : '<span style="color:var(--cinza)">—</span>';
    const dataCompra = m.tipo === 'entrada' && m.dataCompra
      ? new Date(m.dataCompra + 'T12:00:00').toLocaleDateString('pt-BR')
      : '<span style="color:var(--cinza)">—</span>';
    const valorUnit  = m.tipo === 'entrada' && m.valorUnit != null
      ? m.valorUnit.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
      : '<span style="color:var(--cinza)">—</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="white-space:nowrap;font-size:.8rem;color:var(--cinza);">${dataStr}</td>
      <td>${prod ? escapeHtml(prod.nome) : '<em style="color:var(--cinza)">Produto removido</em>'}</td>
      <td><span class="badge-tipo ${m.tipo}">${tipoLabels[m.tipo] || m.tipo}</span></td>
      <td class="${qtdClass}">${qtdPrefix}${m.quantidade} <span style="font-size:.74rem;color:var(--cinza);">(total: ${m.novoTotal})</span></td>
      <td style="font-size:.82rem;">${fornecedor}</td>
      <td style="font-size:.82rem;white-space:nowrap;">${dataCompra}</td>
      <td style="font-size:.82rem;white-space:nowrap;">${valorUnit}</td>
      <td style="font-size:.82rem;color:var(--cafe-soft);">${escapeHtml(m.obs) || '<span style="color:var(--cinza)">—</span>'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function confirmarLimparHistorico() {
  document.getElementById('confirmTitulo').textContent = 'Limpar Histórico';
  document.getElementById('confirmMsg').innerHTML      = 'Deseja apagar <strong>todo o histórico</strong> de movimentações? Esta ação não pode ser desfeita.';
  document.getElementById('confirmOkBtn').onclick = () => {
    state.movimentos = [];
    persistir();
    fecharModal('confirmModal');
    renderHistorico();
    mostrarToast('Histórico apagado.', 'success');
  };
  abrirModal('confirmModal');
}

// ── Modal de limites (mínimo + máximo) ───────────────────────


// ── Edição inline de mínimo / máximo direto na tabela ────────
function salvarLimiteInline(prodId, campo, input) {
  garantirEntradaEstoque();
  const est = state.estoque[prodId];
  const val = parseInt(input.value, 10);

  if (isNaN(val) || val < 0) {
    input.value = est[campo]; // reverte
    mostrarToast('Valor inválido.', 'error');
    return;
  }
  // Validação cruzada
  if (campo === 'minimo' && est.maximo > 0 && val >= est.maximo) {
    input.value = est.minimo; // reverte
    mostrarToast('Mínimo deve ser menor que o máximo.', 'error');
    return;
  }
  if (campo === 'maximo' && val > 0 && val <= est.minimo) {
    input.value = est.maximo; // reverte
    mostrarToast('Máximo deve ser maior que o mínimo.', 'error');
    return;
  }

  est[campo] = val;
  persistir();
  renderResumoEstoque();
  // Atualiza só o badge de status da linha sem re-renderizar tudo
  renderTabelaEstoque();
  mostrarToast(`Estoque ${campo === 'minimo' ? 'mínimo' : 'máximo'} atualizado! ✓`, 'success');
}

// ── Selects auxiliares ────────────────────────────────────────
function renderSelectEstoqueProdutos() {
  const sel = document.getElementById('movProduto');
  sel.innerHTML = '<option value="">Selecione um produto</option>';
  state.produtos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    sel.appendChild(opt);
  });
}

function renderFiltroEstoqueCat() {
  const sel = document.getElementById('filtroEstoqueCat');
  const val = sel.value;
  sel.innerHTML = '<option value="">Todas as categorias</option>';
  state.categorias.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    if (c.id === val) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderSelectHistProd() {
  const sel = document.getElementById('filtroHistProd');
  const val = sel.value;
  sel.innerHTML = '<option value="">Todos os produtos</option>';
  state.produtos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    if (p.id === val) opt.selected = true;
    sel.appendChild(opt);
  });
}


/* ============================================================
   CARRINHO DE COMPRAS
============================================================ */

state.carrinho = []; // [{ id, nome, preco, precoNum, imagem, quantidade }]
let _detalheId  = null; // produto aberto no modal de detalhe
let _detalheQtd = 1;    // quantidade selecionada no modal

// ── Abre modal de detalhe ────────────────────────────────────
function abrirDetalhe(prodId) {
  const p   = state.produtos.find(x => x.id === prodId);
  if (!p) return;
  const cat = state.categorias.find(c => c.id === p.categoriaId);
  const est = state.estoque[prodId] || { quantidade: 0 };

  _detalheId  = prodId;
  _detalheQtd = 1;

  // Imagem
  const imgWrap = document.getElementById('detalheImgWrap');
  if (p.imagem) {
    imgWrap.innerHTML = `<img class="detalhe-img" src="${p.imagem.startsWith('data:') ? p.imagem : escapeHtml(p.imagem)}"
      onerror="this.outerHTML='<div class=\'detalhe-img-placeholder\'>🛍️</div>'" />`;
  } else {
    imgWrap.innerHTML = `<div class="detalhe-img-placeholder">🛍️</div>`;
  }

  document.getElementById('detalheCat').textContent   = cat ? cat.nome : '';
  document.getElementById('detalheNome').textContent  = p.nome;
  document.getElementById('detalheDesc').textContent  = p.descricao;
  document.getElementById('detalhePreco').textContent = p.preco;
  document.getElementById('detalheQtdNum').textContent = _detalheQtd;

  // Disponível = state.estoque total − já no state.carrinho
  const noCarrinho = ((state.carrinho.find(function(c){return c.id===prodId}) ? state.carrinho.find(function(c){return c.id===prodId}).quantidade : undefined) || 0);
  const disponivel  = Math.max(0, est.quantidade - noCarrinho);
  const esgotado    = disponivel <= 0;

  document.getElementById('detalheQtdWrap').style.display = esgotado ? 'none' : '';

  // Badge de disponibilidade abaixo do preço
  let dispBadge = document.getElementById('detalheDispBadge');
  if (!dispBadge) {
    dispBadge = document.createElement('div');
    dispBadge.id = 'detalheDispBadge';
    dispBadge.style.cssText = 'font-size:.78rem;font-weight:700;margin-bottom:.8rem;';
    document.getElementById('detalhePreco').insertAdjacentElement('afterend', dispBadge);
  }
  if (esgotado) {
    dispBadge.innerHTML = '<span style="color:var(--erro);">🔴 Esgotado</span>';
  } else if (noCarrinho > 0) {
    dispBadge.innerHTML = `<span style="color:#b7860a;">⚠️ ${disponivel} disponível${disponivel!==1?'is':''} (${noCarrinho} já no carrinho)</span>`;
  } else {
    dispBadge.innerHTML = `<span style="color:var(--sucesso);">✅ ${disponivel} em estoque</span>`;
  }

  const btnAdd = document.getElementById('btnAddCart');
  if (esgotado) {
    btnAdd.outerHTML = `<div class="detalhe-esgotado" id="btnAddCart">🔴 ${noCarrinho > 0 ? 'Limite do estoque atingido' : 'Produto esgotado'}</div>`;
  } else {
    const curr = document.getElementById('btnAddCart');
    if (curr.tagName !== 'BUTTON') {
      curr.outerHTML = `<button class="btn-add-cart" id="btnAddCart" onclick="addAoCarrinho()">🛒 Adicionar ao carrinho</button>`;
    }
    document.getElementById('btnAddCart').onclick = addAoCarrinho;
  }

  abrirModal('modalDetalhe');
}

// ── Controle de quantidade no detalhe ───────────────────────
function detalheQtd(delta) {
  const est        = state.estoque[_detalheId] || { quantidade: 0 };
  var _cd = state.carrinho.find(function(c){return c.id===_detalheId}); var noCarrinho = (_cd ? _cd.quantidade : 0);
  const disponivel = Math.max(0, est.quantidade - noCarrinho);
  _detalheQtd = Math.min(disponivel, Math.max(1, _detalheQtd + delta));
  document.getElementById('detalheQtdNum').textContent = _detalheQtd;
  if (delta > 0 && _detalheQtd >= disponivel) {
    mostrarToast(`Máximo disponível: ${disponivel} un.`, 'error');
  }
}

// ── Adicionar ao state.carrinho ────────────────────────────────────
function addAoCarrinho() {
  const p = state.produtos.find(x => x.id === _detalheId);
  if (!p) return;

  const est        = state.estoque[_detalheId] || { quantidade: 0 };
  const existente  = state.carrinho.find(c => c.id === _detalheId);
  var noCarrinho = (existente ? existente.quantidade : 0);
  const disponivel = Math.max(0, est.quantidade - noCarrinho);

  if (_detalheQtd > disponivel) {
    mostrarToast(`Apenas ${disponivel} unidade${disponivel!==1?'s':''} disponível${disponivel!==1?'is':''}.`, 'error');
    return;
  }

  if (existente) {
    existente.quantidade += _detalheQtd;
  } else {
    state.carrinho.push({
      id:        p.id,
      nome:      p.nome,
      preco:     p.preco,
      precoNum:  precoParaNum(p.preco),
      imagem:    p.imagem || '',
      quantidade: _detalheQtd
    });
  }

  fecharModal('modalDetalhe');
  atualizarBadge();
  mostrarToast(`${_detalheQtd}× "${p.nome}" adicionado! 🛒`, 'success');
}

// ── Badge no botão flutuante ─────────────────────────────────
function atualizarBadge() {
  const total = state.carrinho.reduce((s, c) => s + c.quantidade, 0);
  const btn   = document.getElementById('btnCarrinho');
  const badge = document.getElementById('carrinhoBadge');
  badge.textContent = total;
  btn.classList.toggle('hidden', total === 0);
}

// ── Abre / fecha o drawer ────────────────────────────────────
function abrirCarrinho() {
  renderCarrinho();
  document.getElementById('carrinhoOverlay').classList.add('open');
  document.getElementById('carrinhoDrawer').classList.add('open');
}

function fecharCarrinho() {
  document.getElementById('carrinhoOverlay').classList.remove('open');
  document.getElementById('carrinhoDrawer').classList.remove('open');
}

// ── Renderiza o drawer ───────────────────────────────────────
function renderCarrinho() {
  const wrap  = document.getElementById('carrinhoItens');
  const foot  = document.getElementById('carrinhoFooter');
  wrap.innerHTML = '';

  if (state.carrinho.length === 0) {
    wrap.innerHTML = `
      <div class="carrinho-vazio">
        <div class="carrinho-vazio-icon">🛒</div>
        <p>Seu carrinho está vazio.</p>
        <p style="font-size:.82rem;color:var(--cinza)">Clique em um produto para adicionar.</p>
      </div>`;
    foot.style.display = 'none';
    return;
  }

  state.carrinho.forEach(item => {
    const div = document.createElement('div');
    div.className = 'carrinho-item';
    const imgSrc = item.imagem
      ? `<img class="carrinho-item-img" src="${item.imagem.startsWith('data:') ? item.imagem : escapeHtml(item.imagem)}"
           onerror="this.style.display='none'" />`
      : `<div class="carrinho-item-img" style="display:flex;align-items:center;justify-content:center;font-size:1.6rem;">🛍️</div>`;

    const subtotal = (item.precoNum * item.quantidade).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

    div.innerHTML = `
      ${imgSrc}
      <div class="carrinho-item-info">
        <div class="carrinho-item-nome">${escapeHtml(item.nome)}</div>
        <div class="carrinho-item-preco">${escapeHtml(item.preco)} × ${item.quantidade} = ${subtotal}</div>
      </div>
      <div class="carrinho-item-controles">
        <button class="ci-btn remove" onclick="carrinhoAlterarQtd('${item.id}', -1)" title="Remover 1">−</button>
        <span class="ci-qtd">${item.quantidade}</span>
        <button class="ci-btn" onclick="carrinhoAlterarQtd('${item.id}', 1)" title="Adicionar 1">+</button>
        <button class="ci-btn remove" onclick="carrinhoRemover('${item.id}')" title="Remover item" style="margin-left:.2rem;font-size:.7rem;">✕</button>
      </div>
    `;
    wrap.appendChild(div);
  });

  // Total
  const totalNum = state.carrinho.reduce((s, c) => s + c.precoNum * c.quantidade, 0);
  document.getElementById('carrinhoTotal').textContent =
    totalNum.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

  // Botão dinâmico: logado = verde WA / não logado = pede login
  const waSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.554 4.122 1.523 5.855L0 24l6.29-1.494A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 01-5.003-1.37l-.36-.214-3.734.887.93-3.624-.235-.373A9.788 9.788 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>`;
  const btnWrap = document.getElementById('carrinhoBtnWrap');
  if (state.sessaoCliente) {
    btnWrap.innerHTML = `
      <button class="btn-pedido-wa" onclick="finalizarPedido()">
        ${waSvg} Enviar pedido pelo WhatsApp
      </button>`;
  } else {
    btnWrap.innerHTML = `
      <button class="btn-pedido-wa" style="background:#7c4dbe;"
        onclick="pedirLoginParaPedido()">
        👤 Entre para finalizar o pedido
      </button>
      <p style="text-align:center;font-size:.75rem;color:var(--cinza);margin-top:.4rem;">
        Faça login ou crie uma conta gratuita para continuar.
      </p>`;
  }

  foot.style.display = '';
}

// ── Alterar quantidade no state.carrinho ───────────────────────────
function carrinhoAlterarQtd(prodId, delta) {
  const item = state.carrinho.find(c => c.id === prodId);
  if (!item) return;

  if (delta > 0) {
    const est        = state.estoque[prodId] || { quantidade: 0 };
    const disponivel = Math.max(0, est.quantidade - item.quantidade);
    if (disponivel <= 0) {
      mostrarToast('Limite do estoque atingido.', 'error');
      return;
    }
  }

  item.quantidade = Math.max(1, item.quantidade + delta);
  atualizarBadge();
  renderCarrinho();
}

function carrinhoRemover(prodId) {
  state.carrinho = state.carrinho.filter(c => c.id !== prodId);
  atualizarBadge();
  renderCarrinho();
  if (state.carrinho.length === 0) mostrarToast('Carrinho vazio.', 'success');
}

function limparCarrinho() {
  state.carrinho = [];
  atualizarBadge();
  renderCarrinho();
}

// ── Finalizar pedido via WhatsApp ────────────────────────────
function finalizarPedido() {
  if (state.carrinho.length === 0) return;

  // Guarda obrigatório: precisa estar logado
  if (!state.sessaoCliente) {
    pedirLoginParaPedido();
    return;
  }

  const num   = state.config.whatsapp || WHATSAPP_DEFAULT;
  const total = state.carrinho.reduce((s, c) => s + c.precoNum * c.quantidade, 0);

  // Salva o pedido como pendente
  const novoPedido = {
    id:        gerarId(),
    numero:    'PED-' + String(state.pedidos.length + 1).padStart(4, '0'),
    data:      new Date().toISOString(),
    status:    'pendente',
    clienteId: state.sessaoCliente.id,
    clienteNome: state.sessaoCliente.nome,
    itens:     state.carrinho.map(c => ({
      id: c.id, nome: c.nome, preco: c.preco,
      precoNum: c.precoNum, quantidade: c.quantidade
    })),
    total
  };
  state.pedidos.unshift(novoPedido);
  persistir();

  // Monta e envia a mensagem no WhatsApp
  let msg = `🛒 *Pedido ${novoPedido.numero} — Trem Mineiro*\n\n`;
  state.carrinho.forEach(item => {
    const sub = (item.precoNum * item.quantidade).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    msg += `• ${item.quantidade}× *${item.nome}* — ${sub}\n`;
  });
  msg += `\n💰 *Total estimado: ${total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}*`;
  msg += `\n👤 *Cliente: ${state.sessaoCliente.nome}*`;

  const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');

  limparCarrinho();
  mostrarToast(`Pedido ${novoPedido.numero} registrado! ✓`, 'success');
}

function pedirLoginParaPedido() {
  fecharCarrinho();
  // Pequeno delay para o drawer fechar antes do modal abrir
  setTimeout(() => {
    abrirModalClienteAuth();
    mostrarToast('Faça login para finalizar o pedido.', 'error');
  }, 300);
}

// ── Utilitário: converte "R$ 38,00" em número ────────────────
function precoParaNum(precoStr) {
  if (!precoStr) return 0;
  const s = precoStr.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}



/* ============================================================
   AUTENTICAÇÃO DE CLIENTES (ÁREA PÚBLICA)
============================================================ */

// ── Botão no header ──────────────────────────────────────────
function atualizarBotaoCliente() {
  const btn = document.getElementById('btnClienteArea');
  if (!btn) return;
  if (state.sessaoCliente) {
    const primeiroNome = state.sessaoCliente.nome.split(' ')[0];
    btn.textContent = '👤 ' + primeiroNome;
    btn.classList.add('logado');
  } else {
    btn.textContent = '👤 Entrar';
    btn.classList.remove('logado');
  }
}

function toggleClienteDropdown() {
  if (!state.sessaoCliente) {
    abrirModalClienteAuth();
    return;
  }
  const dd = document.getElementById('clienteDropdown');
  const open = dd.classList.toggle('open');
  // Fecha ao clicar fora
  if (open) {
    setTimeout(() => {
      document.addEventListener('click', fecharDropdownFora, { once: true });
    }, 10);
  }
}
function fecharDropdownFora(e) {
  const dd  = document.getElementById('clienteDropdown');
  const btn = document.getElementById('btnClienteArea');
  if (!dd.contains(e.target) && e.target !== btn) {
    dd.classList.remove('open');
  }
}

// ── Abrir modal de auth ──────────────────────────────────────
function abrirModalClienteAuth() {
  trocarAuthTab('login');
  // Limpa campos
  ['authLoginEmail','authLoginSenha','authCadNome','authCadEmail','authCadSenha',
   'authCadTel','authCadAniv','authCadEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('error'); }
  });
  ['authLoginEmailErr','authLoginSenhaErr','authCadNomeErr','authCadEmailErr','authCadSenhaErr'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });
  document.getElementById('authLoginAlert').innerHTML = '';
  document.getElementById('authCadAlert').innerHTML   = '';
  abrirModal('modalClienteAuth');
}

function trocarAuthTab(aba) {
  document.getElementById('painelAuthLogin').style.display    = aba === 'login'    ? '' : 'none';
  document.getElementById('painelAuthCadastro').style.display = aba === 'cadastro' ? '' : 'none';
  document.getElementById('tabAuthLogin').classList.toggle('active', aba === 'login');
  document.getElementById('tabAuthCad').classList.toggle('active',   aba === 'cadastro');
}

// ── Login do cliente ─────────────────────────────────────────
function fazerLoginCliente() {
  const email = document.getElementById('authLoginEmail').value.trim().toLowerCase();
  const senha = document.getElementById('authLoginSenha').value;
  let valido  = true;

  document.getElementById('authLoginEmailErr').textContent = '';
  document.getElementById('authLoginSenhaErr').textContent = '';
  document.getElementById('authLoginAlert').innerHTML      = '';

  if (!email) { document.getElementById('authLoginEmailErr').textContent = 'Informe o e-mail.'; valido = false; }
  if (!senha)  { document.getElementById('authLoginSenhaErr').textContent = 'Informe a senha.'; valido = false; }
  if (!valido) return;

  const cliente = state.clientes.find(c => (c.email || '').toLowerCase() === email && c.senhaHash === senha);
  if (!cliente) {
    document.getElementById('authLoginAlert').innerHTML =
      `<div class="alert alert-error">E-mail ou senha incorretos.</div>`;
    return;
  }

  state.sessaoCliente = { id: cliente.id, nome: cliente.nome, email: cliente.email };
  salvarDados('sm_sessao_cliente', state.sessaoCliente);
  fecharModal('modalClienteAuth');
  atualizarBotaoCliente();
  if (state.carrinho.length > 0) renderCarrinho(); // atualiza botão do drawer

  // Atualiza dropdown
  document.getElementById('dropdownNome').textContent = cliente.nome;
  document.getElementById('dropdownSub').textContent  = cliente.email;
  mostrarToast(`Bem-vindo(a), ${cliente.nome.split(' ')[0]}! 👋`, 'success');
}

// ── Cadastro do cliente ──────────────────────────────────────
function cadastrarCliente() {
  const nome  = document.getElementById('authCadNome').value.trim();
  const email = document.getElementById('authCadEmail').value.trim().toLowerCase();
  const senha = document.getElementById('authCadSenha').value;
  const tel   = document.getElementById('authCadTel').value.trim();
  const aniv  = document.getElementById('authCadAniv').value;
  const end   = document.getElementById('authCadEnd').value.trim();
  let valido  = true;

  ['authCadNomeErr','authCadEmailErr','authCadSenhaErr'].forEach(id =>
    document.getElementById(id).textContent = '');
  document.getElementById('authCadAlert').innerHTML = '';

  if (!nome)         { document.getElementById('authCadNomeErr').textContent  = 'Nome obrigatório.'; valido = false; }
  if (!email)        { document.getElementById('authCadEmailErr').textContent = 'E-mail obrigatório.'; valido = false; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('authCadEmailErr').textContent = 'E-mail inválido.'; valido = false;
  }
  if (!senha || senha.length < 6) {
    document.getElementById('authCadSenhaErr').textContent = 'Senha deve ter pelo menos 6 caracteres.'; valido = false;
  }
  if (!valido) return;

  // Verifica duplicidade de e-mail
  if (state.clientes.find(c => (c.email || '').toLowerCase() === email)) {
    document.getElementById('authCadEmailErr').textContent = 'Este e-mail já está cadastrado.';
    return;
  }

  const novo = {
    id: gerarId(), nome, email, senhaHash: senha,
    telefone: tel, aniversario: aniv, endereco: end,
    obs: '', compras: []
  };
  state.clientes.push(novo);
  persistir();

  // Faz login automático
  state.sessaoCliente = { id: novo.id, nome: novo.nome, email: novo.email };
  salvarDados('sm_sessao_cliente', state.sessaoCliente);

  fecharModal('modalClienteAuth');
  atualizarBotaoCliente();
  if (state.carrinho.length > 0) renderCarrinho(); // atualiza botão do drawer
  document.getElementById('dropdownNome').textContent = novo.nome;
  document.getElementById('dropdownSub').textContent  = novo.email;
  mostrarToast(`Conta criada! Bem-vindo(a), ${novo.nome.split(' ')[0]}! 🎉`, 'success');
}

// ── Logout do cliente ────────────────────────────────────────
function logoutCliente() {
  state.sessaoCliente = null;
  localStorage.removeItem('sm_sessao_cliente');
  document.getElementById('clienteDropdown').classList.remove('open');
  atualizarBotaoCliente();
  mostrarToast('Sessão encerrada.', 'success');
}

// ── Meus dados ───────────────────────────────────────────────
function abrirMeusDados() {
  document.getElementById('clienteDropdown').classList.remove('open');
  if (!state.sessaoCliente) return;
  const c = state.clientes.find(x => x.id === state.sessaoCliente.id);
  if (!c) return;

  document.getElementById('mdNome').value  = c.nome        || '';
  document.getElementById('mdTel').value   = c.telefone    || '';
  document.getElementById('mdAniv').value  = c.aniversario || '';
  document.getElementById('mdEnd').value   = c.endereco    || '';
  document.getElementById('mdSenha').value = '';
  document.getElementById('mdNomeErr').textContent   = '';
  document.getElementById('meusDadosAlert').innerHTML = '';
  abrirModal('modalMeusDados');
}

function salvarMeusDados() {
  if (!state.sessaoCliente) return;
  const nome  = document.getElementById('mdNome').value.trim();
  const tel   = document.getElementById('mdTel').value.trim();
  const aniv  = document.getElementById('mdAniv').value;
  const end   = document.getElementById('mdEnd').value.trim();
  const senha = document.getElementById('mdSenha').value;

  document.getElementById('mdNomeErr').textContent = '';
  if (!nome) { document.getElementById('mdNomeErr').textContent = 'Nome obrigatório.'; return; }

  const idx = state.clientes.findIndex(c => c.id === state.sessaoCliente.id);
  if (idx === -1) return;

  state.clientes[idx].nome        = nome;
  state.clientes[idx].telefone    = tel;
  state.clientes[idx].aniversario = aniv;
  state.clientes[idx].endereco    = end;
  if (senha && senha.length >= 6) state.clientes[idx].senhaHash = senha;

  state.sessaoCliente.nome = nome;
  salvarDados('sm_sessao_cliente', state.sessaoCliente);

  persistir();
  fecharModal('modalMeusDados');
  atualizarBotaoCliente();
  document.getElementById('dropdownNome').textContent = nome;
  mostrarToast('Dados atualizados! ✓', 'success');
}

/* ============================================================
   MÓDULO DE FORNECEDORES
============================================================ */

function renderTabelaFornecedores() {
  const tbody = document.getElementById('fornTableBody');
  if (!tbody) return;
  const busca = ((document.getElementById('buscaFornecedor') ? document.getElementById('buscaFornecedor').value : '') || '').toLowerCase().trim();
  tbody.innerHTML = '';

  let lista = state.fornecedores;
  if (busca) {
    lista = lista.filter(f =>
      f.nome.toLowerCase().includes(busca) ||
      (f.produtos || '').toLowerCase().includes(busca) ||
      (f.telefone || '').toLowerCase().includes(busca) ||
      (f.email || '').toLowerCase().includes(busca)
    );
  }

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="admin-empty">${busca ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor cadastrado ainda.'}</div></td></tr>`;
    return;
  }

  lista.forEach((f, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--cinza);font-size:.82rem;">${i + 1}</td>
      <td>
        <strong>${escapeHtml(f.nome)}</strong>
        ${f.obs ? `<div style="font-size:.75rem;color:var(--cinza);margin-top:.15rem;">${escapeHtml(f.obs.slice(0,60))}${f.obs.length>60?'…':''}</div>` : ''}
      </td>
      <td>
        ${f.telefone
          ? `<a href="https://wa.me/55${f.telefone.replace(/\D/g,'')}" target="_blank"
               style="color:var(--terra);font-weight:700;font-size:.85rem;text-decoration:none;"
               title="Abrir no WhatsApp">📱 ${escapeHtml(f.telefone)}</a>`
          : '<span style="color:var(--cinza)">—</span>'}
      </td>
      <td>
        ${f.email
          ? `<a href="mailto:${escapeHtml(f.email)}" style="color:var(--terra);font-size:.85rem;">${escapeHtml(f.email)}</a>`
          : '<span style="color:var(--cinza)">—</span>'}
      </td>
      <td style="font-size:.82rem;max-width:180px;">
        ${f.endereco ? escapeHtml(f.endereco) : '<span style="color:var(--cinza)">—</span>'}
      </td>
      <td style="font-size:.82rem;max-width:180px;">
        ${f.produtos
          ? `<span style="background:var(--creme-mid);border-radius:6px;padding:.15rem .5rem;display:inline-block;line-height:1.5;">${escapeHtml(f.produtos)}</span>`
          : '<span style="color:var(--cinza)">—</span>'}
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="abrirModalFornecedor('${f.id}')">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="confirmarExcluirFornecedor('${f.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirModalFornecedor(fornId) {
  ['fornNome','fornTelefone','fornEmail','fornEndereco','fornProdutos','fornObs'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList && document.getElementById(id).classList.remove('error');
  });
  document.getElementById('fornEditId').value = '';
  document.getElementById('fornNomeErr').textContent = '';

  if (fornId) {
    const f = state.fornecedores.find(x => x.id === fornId);
    if (!f) return;
    document.getElementById('modalFornTitulo').textContent = 'Editar Fornecedor';
    document.getElementById('fornEditId').value   = f.id;
    document.getElementById('fornNome').value     = f.nome;
    document.getElementById('fornTelefone').value = f.telefone || '';
    document.getElementById('fornEmail').value    = f.email    || '';
    document.getElementById('fornEndereco').value = f.endereco || '';
    document.getElementById('fornProdutos').value = f.produtos || '';
    document.getElementById('fornObs').value      = f.obs      || '';
  } else {
    document.getElementById('modalFornTitulo').textContent = 'Novo Fornecedor';
  }
  abrirModal('modalFornecedor');
}

function salvarFornecedor() {
  const nome     = document.getElementById('fornNome').value.trim();
  const telefone = document.getElementById('fornTelefone').value.trim();
  const email    = document.getElementById('fornEmail').value.trim();
  const endereco = document.getElementById('fornEndereco').value.trim();
  const produtosField = document.getElementById('fornProdutos').value.trim();
  const obs      = document.getElementById('fornObs').value.trim();
  const editId   = document.getElementById('fornEditId').value;

  document.getElementById('fornNomeErr').textContent = '';
  if (!nome) {
    document.getElementById('fornNomeErr').textContent = 'Nome obrigatório.';
    document.getElementById('fornNome').classList.add('error');
    return;
  }
  document.getElementById('fornNome').classList.remove('error');

  if (editId) {
    const idx = state.fornecedores.findIndex(f => f.id === editId);
    if (idx > -1) state.fornecedores[idx] = { ...fornecedores[idx], nome, telefone, email, endereco, produtos: produtosField, obs };
    mostrarToast('Fornecedor atualizado! ✓', 'success');
  } else {
    state.fornecedores.push({ id: gerarId(), nome, telefone, email, endereco, produtos: produtosField, obs });
    mostrarToast('Fornecedor cadastrado! ✓', 'success');
  }

  persistir();
  fecharModal('modalFornecedor');
  renderTabelaFornecedores();
  renderSelectFornecedores();
  renderTabelaClientes();
}

function confirmarExcluirFornecedor(fornId) {
  const f = state.fornecedores.find(x => x.id === fornId);
  if (!f) return;
  document.getElementById('confirmTitulo').textContent = 'Excluir Fornecedor';
  document.getElementById('confirmMsg').innerHTML =
    `Deseja excluir o fornecedor <strong>"${escapeHtml(f.nome)}"</strong>? Esta ação não pode ser desfeita.`;
  document.getElementById('confirmOkBtn').onclick = () => {
    state.fornecedores = state.fornecedores.filter(x => x.id !== fornId);
    persistir();
    fecharModal('confirmModal');
    renderTabelaFornecedores();
    renderSelectFornecedores();
    mostrarToast('Fornecedor excluído.', 'success');
  };
  abrirModal('confirmModal');
}

// Popula o select de fornecedor no modal de movimentação
function renderSelectFornecedores() {
  const sel = document.getElementById('movFornecedorSel');
  if (!sel) return;
  const val = sel.value;
  sel.innerHTML = '<option value="">— selecionar da lista —</option>';
  state.fornecedores.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.nome;
    opt.textContent = f.nome;
    if (f.nome === val) opt.selected = true;
    sel.appendChild(opt);
  });
}


// Sincroniza select → campo texto de fornecedor no modal de movimentação
function sincronizarFornecedorTexto() {
  const sel = document.getElementById('movFornecedorSel');
  const txt = document.getElementById('movFornecedor');
  if (sel.value) txt.value = sel.value;
}



/* ============================================================
   MÓDULO DE RELATÓRIOS
============================================================ */

/* Estado do filtro de data */
let _relDataInicio = null;
let _relDataFim    = null;

function inicializarFiltroRelatorio() {
  // Preenche datas padrão no painel de intervalo
  const hoje = new Date().toISOString().slice(0,10);
  const ini  = new Date(); ini.setDate(ini.getDate() - 30);
  const elIni = document.getElementById('filtroInicio');
  const elFim = document.getElementById('filtroFim');
  if (elIni) elIni.value = ini.toISOString().slice(0,10);
  if (elFim) elFim.value = hoje;

  // Padrão: últimos 30 dias, botão "30 dias" ativo
  const btn30 = document.querySelector('.rel-period-btn.active') ||
                document.querySelectorAll('.rel-period-btn')[1];
  setAtalho(30, btn30);
}

// ── Toggle do painel de intervalo ────────────────────────────
function toggleIntervalo(btn) {
  const painel = document.getElementById('painelIntervaloRel');
  const aberto = painel.style.display !== 'none';
  painel.style.display = aberto ? 'none' : '';
  btn.classList.toggle('active', !aberto);
  if (!aberto) {
    // Ao abrir, desmarca os atalhos e aplica o intervalo atual
    document.querySelectorAll('.rel-period-btn').forEach(b => {
      if (b !== btn) b.classList.remove('active');
    });
    aplicarFiltroIntervalo();
  }
}

// ── Atalhos rápidos ──────────────────────────────────────────
function setAtalho(dias, btn) {
  // Fecha painel de intervalo se estiver aberto
  const painel = document.getElementById('painelIntervaloRel');
  if (painel) painel.style.display = 'none';

  document.querySelectorAll('.rel-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  if (!dias) {
    _relDataInicio = null;
    _relDataFim    = null;
    atualizarTagPeriodo('Todo o período');
  } else {
    const fim = new Date();
    const ini = new Date(); ini.setDate(ini.getDate() - dias);
    _relDataInicio = ini.toISOString().slice(0,10);
    _relDataFim    = fim.toISOString().slice(0,10);
    const labels = { 7:'Últimos 7 dias', 30:'Últimos 30 dias', 90:'Últimos 90 dias', 365:'Últimos 12 meses' };
    atualizarTagPeriodo(labels[dias] || `Últimos ${dias} dias`);
  }
  renderRelatorios();
}

// ── Intervalo livre ──────────────────────────────────────────
function aplicarFiltroIntervalo() {
  const ini = (document.getElementById('filtroInicio') ? document.getElementById('filtroInicio').value : '');
  const fim = (document.getElementById('filtroFim') ? document.getElementById('filtroFim').value : '');
  if (!ini || !fim) return;
  if (ini > fim) { mostrarToast('Data inicial deve ser anterior à final.', 'error'); return; }
  _relDataInicio = ini;
  _relDataFim    = fim;
  const fmtIni = new Date(ini + 'T12:00:00').toLocaleDateString('pt-BR');
  const fmtFim = new Date(fim + 'T12:00:00').toLocaleDateString('pt-BR');
  atualizarTagPeriodo(fmtIni === fmtFim ? fmtIni : `${fmtIni} → ${fmtFim}`);
  renderRelatorios();
}

// ── Tag de período ativo ──────────────────────────────────────
function atualizarTagPeriodo(texto) {
  const el = document.getElementById('relPeriodoTag');
  if (el) el.innerHTML = `<strong>${texto}</strong>`;
}

// ── Filtrar por período ───────────────────────────────────────
function filtrarPorPeriodo(lista, campoData) {
  if (!_relDataInicio && !_relDataFim) return lista;
  return lista.filter(x => {
    const d = (x[campoData] || '').slice(0,10);
    if (_relDataInicio && d < _relDataInicio) return false;
    if (_relDataFim    && d > _relDataFim)    return false;
    return true;
  });
}

function abrirAbaRelatorios(btn) {
  abrirAba('tabRelatorios', btn);
  inicializarFiltroRelatorio();
  renderRelatorios();
}

// ── Ponto de entrada ─────────────────────────────────────────
function renderRelatorios() {
  garantirEntradaEstoque();
  renderKpis();
  renderChartVendas();
  renderChartEstoque();
  renderTopProdutos();
  renderTopClientes();
  renderEntradasEstoque();
  renderAniversariantesRel();
  renderFornecedoresRel();
}

// ── KPIs ─────────────────────────────────────────────────────
function renderKpis() {
  const comprasNoPeriodo = state.clientes.flatMap(c =>
    filtrarPorPeriodo(c.compras || [], 'data')
  );
  const receitaTotal  = comprasNoPeriodo.reduce((s, x) => s + (x.valor || 0), 0);
  const ticketMedio   = comprasNoPeriodo.length ? receitaTotal / comprasNoPeriodo.length : 0;
  const totalClientes = state.clientes.length;
  const totalProdutos = state.produtos.length;

  const entradasNoPeriodo = filtrarPorPeriodo(
    state.movimentos.filter(m => m.tipo === 'entrada'), 'data'
  );
  const custoEntradas = entradasNoPeriodo.reduce((s, m) => {
    const vu = m.valorUnit || 0;
    return s + vu * m.quantidade;
  }, 0);

  const estoqueAlerta = state.produtos.filter(p =>
    statusEstoque(p.id) === 'zero' || statusEstoque(p.id) === 'baixo'
  ).length;

  document.getElementById('relKpis').innerHTML = `
    <div class="rel-kpi verde">
      <div class="rel-kpi-label">Receita no período</div>
      <div class="rel-kpi-valor">${receitaTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
      <div class="rel-kpi-sub">${comprasNoPeriodo.length} venda${comprasNoPeriodo.length!==1?'s':''} registrada${comprasNoPeriodo.length!==1?'s':''}</div>
    </div>
    <div class="rel-kpi terra">
      <div class="rel-kpi-label">Ticket médio</div>
      <div class="rel-kpi-valor">${ticketMedio.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
      <div class="rel-kpi-sub">por compra no período</div>
    </div>
    <div class="rel-kpi azul">
      <div class="rel-kpi-label">Clientes cadastrados</div>
      <div class="rel-kpi-valor">${totalClientes}</div>
      <div class="rel-kpi-sub">${state.fornecedores.length} fornecedor${state.fornecedores.length!==1?'es':''}</div>
    </div>
    <div class="rel-kpi">
      <div class="rel-kpi-label">Produtos no catálogo</div>
      <div class="rel-kpi-valor">${totalProdutos}</div>
      <div class="rel-kpi-sub">${state.categorias.length} categoria${state.categorias.length!==1?'s':''}</div>
    </div>
    <div class="rel-kpi roxo">
      <div class="rel-kpi-label">Custo de entradas</div>
      <div class="rel-kpi-valor">${custoEntradas.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
      <div class="rel-kpi-sub">valor total das entradas no período</div>
    </div>
    <div class="rel-kpi ${estoqueAlerta > 0 ? 'terra' : 'verde'}">
      <div class="rel-kpi-label">Alertas de estoque</div>
      <div class="rel-kpi-valor">${estoqueAlerta}</div>
      <div class="rel-kpi-sub">produto${estoqueAlerta!==1?'s':''} com estoque baixo ou zerado</div>
    </div>
  `;
}

// ── Gráfico de barras: vendas por período ────────────────────
function renderChartVendas() {
  const canvas = document.getElementById('chartVendas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const parentPad = 24;
  const W = Math.max(200, (canvas.parentElement.offsetWidth || 400) - parentPad);
  const H = Math.max(200, Math.round(W * 0.32));
  canvas.width  = W;
  canvas.height = H;

  // ── Granularidade ────────────────────────────────────────────
  const diasIntervalo = (_relDataInicio && _relDataFim)
    ? Math.round((new Date(_relDataFim) - new Date(_relDataInicio)) / 86400000)
    : 365;
  const gran = diasIntervalo <= 30 ? 'dia' : diasIntervalo <= 90 ? 'semana' : 'mes';

  function chaveDeData(dataStr) {
    if (!dataStr) return null;
    if (gran === 'dia') return dataStr.slice(0,10);
    if (gran === 'semana') {
      const d = new Date(dataStr + 'T12:00:00');
      const ini = new Date(d); ini.setDate(d.getDate() - d.getDay());
      return ini.toISOString().slice(0,10);
    }
    return dataStr.slice(0,7);
  }

  // ── Agrupa receita (compras dos state.clientes) ────────────────────
  const gruposVal = {};
  filtrarPorPeriodo(state.clientes.flatMap(c => c.compras || []), 'data').forEach(x => {
    const k = chaveDeData(x.data); if (!k) return;
    gruposVal[k] = (gruposVal[k] || 0) + (x.valor || 0);
  });

  // ── Agrupa quantidade (state.pedidos confirmados) ──────────────────
  const gruposQtd = {};
  filtrarPorPeriodo(
    state.pedidos.filter(p => p.status === 'confirmado'),
    'dataConfirmacao'
  ).forEach(p => {
    const dataStr = (p.dataConfirmacao || p.data || '').slice(0,10);
    const k = chaveDeData(dataStr); if (!k) return;
    const qtd = (p.itens || []).reduce((s, it) => s + (it.quantidade || 1), 0);
    gruposQtd[k] = (gruposQtd[k] || 0) + qtd;
  });

  // ── Preenche lacunas ─────────────────────────────────────────
  function preencherLacunas(grupos) {
    if (!_relDataInicio && !_relDataFim) return;
    if (gran === 'dia') {
      const cur = new Date(_relDataInicio + 'T12:00:00');
      const fim = new Date(_relDataFim   + 'T12:00:00');
      while (cur <= fim) {
        const k = cur.toISOString().slice(0,10);
        if (!(k in grupos)) grupos[k] = 0;
        cur.setDate(cur.getDate() + 1);
      }
    } else if (gran === 'semana') {
      const cur = new Date(_relDataInicio + 'T12:00:00');
      cur.setDate(cur.getDate() - cur.getDay());
      const fim = new Date(_relDataFim + 'T12:00:00');
      while (cur <= fim) {
        const k = cur.toISOString().slice(0,10);
        if (!(k in grupos)) grupos[k] = 0;
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      const ini = new Date(_relDataInicio + 'T12:00:00');
      const fim = new Date(_relDataFim   + 'T12:00:00');
      let cur = new Date(ini.getFullYear(), ini.getMonth(), 1);
      while (cur <= fim) {
        const k = cur.toISOString().slice(0,7);
        if (!(k in grupos)) grupos[k] = 0;
        cur.setMonth(cur.getMonth() + 1);
      }
    }
  }
  preencherLacunas(gruposVal);
  preencherLacunas(gruposQtd);

  // Unifica chaves
  const todasChaves = Array.from(new Set([
    ...Object.keys(gruposVal), ...Object.keys(gruposQtd)
  ])).sort();

  if (todasChaves.length === 0) {
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#aaa'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Nenhuma venda registrada no período.', W/2, H/2);
    return;
  }

  const valRec = todasChaves.map(k => gruposVal[k] || 0);
  const valQtd = todasChaves.map(k => gruposQtd[k] || 0);
  const n      = todasChaves.length;
  const pular  = n > 20 ? 3 : n > 10 ? 2 : 1;

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const labels = todasChaves.map((k, i) => {
    if (i % pular !== 0) return '';
    if (gran !== 'mes') {
      const d = new Date(k + 'T12:00:00');
      return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
    }
    const [y, m] = k.split('-');
    return meses[parseInt(m)-1] + '/' + y.slice(2);
  });

  drawCompositeChart(ctx, W, H, labels, valRec, valQtd);
}

function drawCompositeChart(ctx, W, H, labels, valRec, valQtd) {
  ctx.clearRect(0, 0, W, H);
  const n      = valRec.length;
  const pad    = { top: 28, right: 64, bottom: 40, left: 62 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top  - pad.bottom;

  const maxRec = Math.max(...valRec, 1);
  const maxQtd = Math.max(...valQtd, 1);

  const slotW    = chartW / n;
  const barW     = Math.min(Math.max(6, slotW * 0.6), 40);
  const barOff   = (slotW - barW) / 2;

  // ── Grade (4 linhas) ─────────────────────────────────────────
  const steps = 4;
  ctx.lineWidth = 1; ctx.strokeStyle = '#e8dfc8';
  for (let i = 0; i <= steps; i++) {
    const y = pad.top + chartH - (chartH * i / steps);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();

    // Eixo Y esq — Receita (R$)
    const vR = maxRec * i / steps;
    ctx.fillStyle = '#C4622D'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(vR >= 1000 ? 'R$'+(vR/1000).toFixed(1)+'k' : 'R$'+vR.toFixed(0), pad.left - 5, y + 3);

    // Eixo Y dir — Quantidade (itens)
    const vQ = Math.round(maxQtd * i / steps);
    ctx.fillStyle = '#1a6fa8'; ctx.textAlign = 'left';
    ctx.fillText(vQ + ' un', pad.left + chartW + 5, y + 3);
  }

  // ── Barras — Receita ─────────────────────────────────────────
  valRec.forEach((v, i) => {
    const x  = pad.left + i * slotW + barOff;
    const bH = Math.max(2, (v / maxRec) * chartH);
    const y  = pad.top + chartH - bH;
    const grad = ctx.createLinearGradient(0, y, 0, y + bH);
    grad.addColorStop(0, 'rgba(196,98,45,.9)');
    grad.addColorStop(1, 'rgba(201,145,58,.75)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, barW, bH, [3,3,0,0]) : ctx.rect(x, y, barW, bH);
    ctx.fill();
  });

  // ── Linha — Quantidade ───────────────────────────────────────
  const xOf = i => pad.left + i * slotW + slotW / 2;
  const yOf = v => pad.top  + chartH - (v / maxQtd) * chartH;

  // Área sob a linha
  const gradL = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  gradL.addColorStop(0, 'rgba(26,111,168,.22)');
  gradL.addColorStop(1, 'rgba(26,111,168,.02)');
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(valQtd[0]));
  valQtd.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
  ctx.lineTo(xOf(n-1), pad.top + chartH);
  ctx.lineTo(xOf(0),   pad.top + chartH);
  ctx.closePath();
  ctx.fillStyle = gradL; ctx.fill();

  // Linha
  ctx.beginPath();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#1a6fa8'; ctx.lineJoin = 'round';
  ctx.moveTo(xOf(0), yOf(valQtd[0]));
  valQtd.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
  ctx.stroke();

  // Pontos
  valQtd.forEach((v, i) => {
    if (v === 0) return;
    ctx.beginPath(); ctx.arc(xOf(i), yOf(v), 3.5, 0, Math.PI*2);
    ctx.fillStyle = '#1a6fa8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();
  });

  // ── Labels eixo X ────────────────────────────────────────────
  labels.forEach((lb, i) => {
    if (!lb) return;
    ctx.fillStyle = '#777'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(lb, xOf(i), pad.top + chartH + 14);
  });

  // ── Eixos ────────────────────────────────────────────────────
  ctx.strokeStyle = '#d0c4a8'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.left, pad.top); ctx.lineTo(pad.left, pad.top + chartH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad.left, pad.top + chartH); ctx.lineTo(pad.left + chartW, pad.top + chartH); ctx.stroke();

  // ── Legenda ──────────────────────────────────────────────────
  const lx = pad.left + chartW - 10, ly = pad.top - 14;
  // Barra laranja = receita
  ctx.fillStyle = '#C4622D'; ctx.fillRect(lx - 120, ly - 4, 12, 9);
  ctx.fillStyle = '#555'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Receita (R$)', lx - 105, ly + 4);
  // Linha azul = qtd
  ctx.strokeStyle = '#1a6fa8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(lx - 48, ly); ctx.lineTo(lx - 38, ly); ctx.stroke();
  ctx.beginPath(); ctx.arc(lx - 43, ly, 3, 0, Math.PI*2);
  ctx.fillStyle = '#1a6fa8'; ctx.fill();
  ctx.fillStyle = '#555'; ctx.textAlign = 'left';
  ctx.fillText('Itens vendidos', lx - 33, ly + 4);
}


// ── Gráfico de rosca: status de state.estoque ─────────────────────
function renderChartEstoque() {
  const canvas = document.getElementById('chartEstoque');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const contagem = { ok: 0, baixo: 0, zero: 0, excesso: 0 };
  state.produtos.forEach(p => { const s = statusEstoque(p.id); contagem[s] = (contagem[s]||0) + 1; });
  const total = state.produtos.length || 1;

  const fatias = [
    { label: 'Normal',   valor: contagem.ok,      cor: '#27AE60' },
    { label: 'Baixo',    valor: contagem.baixo,   cor: '#C9913A' },
    { label: 'Esgotado', valor: contagem.zero,    cor: '#C0392B' },
    { label: 'Excedido', valor: contagem.excesso, cor: '#1a6fa8' },
  ].filter(f => f.valor > 0);

  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);
  const cx = W/2, cy = H/2, rExt = Math.min(W,H)/2 - 6, rInt = rExt * 0.55;
  let angulo = -Math.PI / 2;

  fatias.forEach(f => {
    const sweep = (f.valor / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rExt, angulo, angulo + sweep);
    ctx.closePath();
    ctx.fillStyle = f.cor;
    ctx.fill();
    angulo += sweep;
  });

  // Buraco
  ctx.beginPath(); ctx.arc(cx, cy, rInt, 0, Math.PI*2);
  ctx.fillStyle = 'var(--branco, #FDFAF5)'; ctx.fill();

  // Total no centro
  ctx.fillStyle = '#2C1810'; ctx.font = 'bold 18px serif'; ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy + 4);
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#888';
  ctx.fillText('Produtos', cx, cy + 16);

  // Legenda
  const leg = document.getElementById('legendEstoque');
  leg.innerHTML = fatias.map(f => `
    <div class="rel-legend-item">
      <div class="rel-legend-dot" style="background:${f.cor};"></div>
      ${f.label}
      <span class="rel-legend-pct">${f.valor} (${Math.round(f.valor/total*100)}%)</span>
    </div>`).join('');
}

// ── Top state.produtos ─────────────────────────────────────────────
function renderTopProdutos() {
  const wrap = document.getElementById('relTopProdutos');
  // Conta quantas vezes cada produto aparece nas compras filtradas (por nome)
  const comprasFilt = state.clientes.flatMap(c => filtrarPorPeriodo(c.compras || [], 'data'));
  const contagem = {};
  comprasFilt.forEach(x => {
    if (!x.produtos) return;
    // Tenta casar pelo nome de algum produto cadastrado
    state.produtos.forEach(p => {
      if (x.produtos.toLowerCase().includes(p.nome.toLowerCase())) {
        contagem[p.id] = (contagem[p.id]||0) + 1;
      }
    });
  });

  // Fallback: usa state.movimentos de saída
  filtrarPorPeriodo(state.movimentos.filter(m => m.tipo === 'saida'), 'data').forEach(m => {
    contagem[m.produtoId] = (contagem[m.produtoId]||0) + m.quantidade;
  });

  const ranking = state.produtos
    .map(p => ({ p, cnt: contagem[p.id] || 0 }))
    .filter(x => x.cnt > 0)
    .sort((a,b) => b.cnt - a.cnt)
    .slice(0, 7);

  if (ranking.length === 0) {
    wrap.innerHTML = `<div style="color:var(--cinza);font-size:.85rem;text-align:center;padding:1rem;">Nenhum dado no período.</div>`;
    return;
  }
  const max = ranking[0].cnt;
  wrap.innerHTML = ranking.map((item, i) => `
    <div class="rel-bar-row">
      <div class="rel-bar-label" title="${escapeHtml(item.p.nome)}">
        <span class="rel-rank">${i+1}.</span> ${escapeHtml(item.p.nome)}
      </div>
      <div class="rel-bar-track">
        <div class="rel-bar-fill" style="width:${Math.round(item.cnt/max*100)}%;"></div>
      </div>
      <div class="rel-bar-val">${item.cnt}</div>
    </div>`).join('');
}

// ── Top state.clientes ─────────────────────────────────────────────
function renderTopClientes() {
  const wrap = document.getElementById('relTopClientes');
  const ranking = state.clientes.map(c => {
    const comprasFilt = filtrarPorPeriodo(c.compras || [], 'data');
    return { c, total: comprasFilt.reduce((s,x) => s+(x.valor||0), 0), qtd: comprasFilt.length };
  }).filter(x => x.total > 0).sort((a,b) => b.total - a.total).slice(0, 7);

  if (ranking.length === 0) {
    wrap.innerHTML = `<div style="color:var(--cinza);font-size:.85rem;text-align:center;padding:1rem;">Nenhum dado no período.</div>`;
    return;
  }
  const max = ranking[0].total;
  wrap.innerHTML = ranking.map((item, i) => `
    <div class="rel-bar-row">
      <div class="rel-bar-label" title="${escapeHtml(item.c.nome)}">
        <span class="rel-rank">${i+1}.</span> ${escapeHtml(item.c.nome)}
      </div>
      <div class="rel-bar-track">
        <div class="rel-bar-fill" style="width:${Math.round(item.total/max*100)}%;background:linear-gradient(90deg,#1a6fa8,#27AE60);"></div>
      </div>
      <div class="rel-bar-val" style="font-size:.7rem;">${item.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
    </div>`).join('');
}

// ── Últimas entradas de state.estoque ──────────────────────────────
function renderEntradasEstoque() {
  const wrap = document.getElementById('relEntradasEstoque');
  const entradas = filtrarPorPeriodo(state.movimentos.filter(m => m.tipo === 'entrada'), 'data')
    .slice(0, 8);
  if (entradas.length === 0) {
    wrap.innerHTML = `<div style="color:var(--cinza);font-size:.85rem;text-align:center;padding:1rem;">Nenhuma entrada no período.</div>`;
    return;
  }
  wrap.innerHTML = `<table class="rel-table">
    <thead><tr><th>Produto</th><th>Qtd</th><th>Fornecedor</th><th>Data</th></tr></thead>
    <tbody>` +
    entradas.map(m => {
      const prod = state.produtos.find(p => p.id === m.produtoId);
      const dataFmt = m.data ? new Date(m.data).toLocaleDateString('pt-BR') : '—';
      return `<tr>
        <td>${prod ? escapeHtml(prod.nome) : '<em style="color:var(--cinza)">Removido</em>'}</td>
        <td style="font-weight:700;color:var(--sucesso);">+${m.quantidade}</td>
        <td style="color:var(--cafe-soft);">${m.fornecedor ? escapeHtml(m.fornecedor) : '—'}</td>
        <td style="color:var(--cinza);font-size:.78rem;">${dataFmt}</td>
      </tr>`;
    }).join('') + `</tbody></table>`;
}

// ── Aniversariantes do mês ───────────────────────────────────
function renderAniversariantesRel() {
  const wrap = document.getElementById('relAniversariantes');
  const mes  = new Date().getMonth() + 1;
  const hoje = new Date().getDate();
  const lista = state.clientes
    .filter(c => c.aniversario && parseInt(c.aniversario.slice(5,7),10) === mes)
    .sort((a,b) => parseInt(a.aniversario.slice(8),10) - parseInt(b.aniversario.slice(8),10));

  if (lista.length === 0) {
    wrap.innerHTML = `<div style="color:var(--cinza);font-size:.85rem;text-align:center;padding:1rem;">Nenhum aniversariante este mês.</div>`;
    return;
  }
  wrap.innerHTML = `<table class="rel-table">
    <thead><tr><th>Cliente</th><th>Dia</th><th>Telefone</th></tr></thead>
    <tbody>` +
    lista.map(c => {
      const dia   = parseInt(c.aniversario.slice(8), 10);
      const badge = dia === hoje
        ? '<span style="background:#fef3d0;color:#b8860b;font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:10px;margin-left:.3rem;">Hoje!</span>' : '';
      return `<tr>
        <td><strong>${escapeHtml(c.nome)}</strong>${badge}</td>
        <td style="font-family:var(--font-serif);font-weight:800;color:var(--ouro);">${dia}</td>
        <td>${c.telefone
          ? `<a href="https://wa.me/55${c.telefone.replace(/\D/g,'')}" target="_blank"
               style="color:var(--terra);font-size:.82rem;text-decoration:none;font-weight:700;">📱 ${escapeHtml(c.telefone)}</a>`
          : '<span style="color:var(--cinza)">—</span>'}</td>
      </tr>`;
    }).join('') + `</tbody></table>`;
}

// ── Volume por fornecedor ────────────────────────────────────
function renderFornecedoresRel() {
  const wrap = document.getElementById('relFornecedores');
  const entradas = filtrarPorPeriodo(state.movimentos.filter(m => m.tipo === 'entrada' && m.fornecedor), 'data');
  const agrup = {};
  entradas.forEach(m => {
    const key = m.fornecedor.trim();
    if (!agrup[key]) agrup[key] = { qtd: 0, custo: 0, compras: 0 };
    agrup[key].qtd    += m.quantidade;
    agrup[key].custo  += (m.valorUnit || 0) * m.quantidade;
    agrup[key].compras++;
  });

  const lista = Object.entries(agrup).sort((a,b) => b[1].custo - a[1].custo);
  if (lista.length === 0) {
    wrap.innerHTML = `<div style="color:var(--cinza);font-size:.85rem;text-align:center;padding:1rem;">Nenhuma entrada com fornecedor identificado no período.</div>`;
    return;
  }
  wrap.innerHTML = `<table class="rel-table">
    <thead><tr><th>Fornecedor</th><th>Entradas</th><th>Unidades</th><th>Custo total</th></tr></thead>
    <tbody>` +
    lista.map(([nome, d]) => `<tr>
      <td><strong>${escapeHtml(nome)}</strong></td>
      <td>${d.compras}</td>
      <td style="font-weight:700;">${d.qtd}</td>
      <td style="font-family:var(--font-serif);font-weight:800;color:var(--terra);">${d.custo.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
    </tr>`).join('') + `</tbody></table>`;
}


/* ============================================================
   MÓDULO DE PEDIDOS
============================================================ */

let _filtroPedidos = 'todos';
const _PEDIDOS_POR_PAGINA = 25;
let _pedidosPagina = 1;

function filtrarPedidos(status, btn) {
  _filtroPedidos = status;
  _pedidosPagina = 1;
  document.querySelectorAll('.pedidos-filtros .estoque-filtro-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabelaPedidos();
}

function atualizarBadgePedidos() {
  const pendentes = state.pedidos.filter(p => p.status === 'pendente').length;
  const badge     = document.getElementById('pedidosBadgeTab');
  if (!badge) return;
  if (pendentes > 0) {
    badge.textContent = pendentes;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

function renderTabelaPedidos() {
  const wrap = document.getElementById('pedidosLista');
  if (!wrap) return;

  let lista = [...state.pedidos];
  if (_filtroPedidos !== 'todos') lista = lista.filter(p => p.status === _filtroPedidos);

  if (lista.length === 0) {
    wrap.innerHTML = `
      <div class="pedidos-vazio">
        <div class="pedidos-vazio-icon">🛒</div>
        <p>${_filtroPedidos === 'todos' ? 'Nenhum pedido recebido ainda.' : 'Nenhum pedido com este status.'}</p>
      </div>`;
    return;
  }

  wrap.innerHTML = '';
  const total = lista.length;
  const totalPaginas = Math.ceil(total / _PEDIDOS_POR_PAGINA);
  if (_pedidosPagina > totalPaginas) _pedidosPagina = 1;
  const inicio = (_pedidosPagina - 1) * _PEDIDOS_POR_PAGINA;
  const paginaAtual = lista.slice(inicio, inicio + _PEDIDOS_POR_PAGINA);

  paginaAtual.forEach(ped => {
    const data  = new Date(ped.data);
    const hora  = data.toLocaleDateString('pt-BR') + ' às ' +
                  data.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    const statusLabels = { pendente: '⏳ Pendente', confirmado: '✅ Confirmado', cancelado: '✕ Cancelado' };

    const div = document.createElement('div');
    div.className = `pedido-card ${ped.status}`;
    div.innerHTML = `
      <div class="pedido-header" onclick="togglePedidoBody('${ped.id}')">
        <div class="pedido-header-left">
          <span class="pedido-numero">${escapeHtml(ped.numero)}</span>
          <span class="pedido-hora">${hora}</span>
          ${ped.clienteId
            ? `<span class="pedido-cliente-tag">👤 ${escapeHtml(ped.clienteNome)}</span>`
            : `<span style="font-size:.75rem;color:var(--cinza);">👤 ${escapeHtml(ped.clienteNome)}</span>`}
        </div>
        <div style="display:flex;align-items:center;gap:.6rem;">
          <div style="text-align:right;">
            ${ped.desconto > 0 ? `
              <div style="font-size:.72rem;color:var(--cinza);text-decoration:line-through;">${ped.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
              <div style="font-family:var(--font-serif);font-weight:800;color:var(--sucesso);font-size:1rem;">${(ped.totalFinal != null ? ped.totalFinal : ped.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
            ` : `
              <span class="pedido-total-valor" style="font-size:1rem;">${ped.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
            `}
          </div>
          <span class="badge-status ${ped.status}">${statusLabels[ped.status] || ped.status}</span>
          <span style="color:var(--cinza);font-size:.8rem;" id="chevron_${ped.id}">▼</span>
        </div>
      </div>

      <div class="pedido-body" id="body_${ped.id}" style="display:none;">
        <div class="pedido-itens">
          ${ped.itens.map(it => `
            <div class="pedido-item-linha">
              <span class="pedido-item-qtd">${it.quantidade}×</span>
              <span class="pedido-item-nome">${escapeHtml(it.nome)}</span>
              <span class="pedido-item-sub">${(it.precoNum * it.quantidade).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
            </div>`).join('')}
        </div>
        <div class="pedido-total-linha">
          <span class="pedido-total-label">Subtotal</span>
          <span class="pedido-total-valor">${ped.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        </div>
        ${ped.desconto > 0 ? `
        <div class="pedido-total-linha" style="padding-top:.3rem;">
          <span class="pedido-total-label" style="color:var(--erro);">Desconto</span>
          <span style="font-family:var(--font-serif);font-weight:800;color:var(--erro);">− ${ped.desconto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        </div>
        <div class="pedido-total-linha" style="border-top:1.5px dashed var(--creme-mid);margin-top:.4rem;padding-top:.6rem;">
          <span class="pedido-total-label" style="color:var(--cafe);">Total final</span>
          <span style="font-family:var(--font-serif);font-weight:800;color:var(--sucesso);font-size:1.15rem;">${(ped.totalFinal != null ? ped.totalFinal : ped.total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
        </div>
        ${ped.obs ? `<div style="font-size:.78rem;color:var(--cinza);margin-top:.4rem;">📝 ${escapeHtml(ped.obs)}</div>` : ''}
        ` : ''}

      ${ped.status === 'pendente' ? `
      <div class="pedido-actions">
        <button class="btn btn-primary btn-sm" onclick="confirmarPedido('${ped.id}')">✅ Confirmar venda</button>
        <button class="btn btn-danger btn-sm" onclick="cancelarPedido('${ped.id}')">✕ Cancelar</button>
        <button class="btn btn-outline btn-sm" onclick="reenviarWhatsapp('${ped.id}')">📲 Re-enviar WA</button>
      </div>` : ''}
    `;
    wrap.appendChild(div);
  });

  if (totalPaginas > 1) {
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:1rem;flex-wrap:wrap;';

    const btnAnterior = document.createElement('button');
    btnAnterior.className = 'btn btn-outline btn-sm';
    btnAnterior.textContent = '← Anterior';
    btnAnterior.disabled = _pedidosPagina === 1;
    btnAnterior.onclick = function() { _pedidosPagina--; renderTabelaPedidos(); };
    nav.appendChild(btnAnterior);

    for (let i = 1; i <= totalPaginas; i++) {
      const btnPag = document.createElement('button');
      btnPag.className = 'btn btn-sm ' + (i === _pedidosPagina ? 'btn-primary' : 'btn-outline');
      btnPag.textContent = i;
      btnPag.onclick = (function(p) { return function() { _pedidosPagina = p; renderTabelaPedidos(); }; })(i);
      nav.appendChild(btnPag);
    }

    const btnProximo = document.createElement('button');
    btnProximo.className = 'btn btn-outline btn-sm';
    btnProximo.textContent = 'Próximo →';
    btnProximo.disabled = _pedidosPagina === totalPaginas;
    btnProximo.onclick = function() { _pedidosPagina++; renderTabelaPedidos(); };
    nav.appendChild(btnProximo);

    const info = document.createElement('div');
    info.style.cssText = 'width:100%;text-align:center;font-size:.78rem;color:var(--cinza);margin-top:.3rem;';
    info.textContent = `${inicio + 1}–${Math.min(inicio + _PEDIDOS_POR_PAGINA, total)} de ${total} pedidos`;
    nav.appendChild(info);

    wrap.appendChild(nav);
  }
}

function togglePedidoBody(pedId) {
  const body    = document.getElementById('body_'    + pedId);
  const chevron = document.getElementById('chevron_' + pedId);
  if (!body) return;
  const aberto = body.style.display !== 'none';
  body.style.display    = aberto ? 'none' : '';
  if (chevron) chevron.textContent = aberto ? '▼' : '▲';
}

// ── Confirmar: desconta state.estoque + lança no histórico do cliente ──

/* ============================================================
   CONFIRMAÇÃO DE PEDIDO COM DESCONTO
============================================================ */

let _confPedId       = null;
let _confDescontoTipo = 'reais'; // 'reais' | 'pct'

function confirmarPedido(pedId) {
  const ped = state.pedidos.find(p => p.id === pedId);
  if (!ped || ped.status !== 'pendente') return;

  _confPedId       = pedId;
  _confDescontoTipo = 'reais';

  // Cabeçalho
  document.getElementById('confPedNumero').textContent  = ped.numero;
  document.getElementById('confPedCliente').textContent =
    ped.clienteId ? '👤 ' + ped.clienteNome : '👤 Cliente não identificado';

  // Lista de itens
  const wrap = document.getElementById('confPedItens');
  wrap.innerHTML = ped.itens.map(it => {
    const sub = (it.precoNum * it.quantidade).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
    return `
      <div class="conf-pedido-item">
        <span class="conf-pedido-item-nome">${it.quantidade}× ${escapeHtml(it.nome)}</span>
        <span class="conf-pedido-item-val">${sub}</span>
      </div>`;
  }).join('');

  // Reseta campos
  document.getElementById('confDescontoVal').value = '';
  document.getElementById('confObs').value         = '';
  document.getElementById('confDescontoErr').textContent = '';
  setDescontoTipo('reais');
  recalcularConfPedido();

  abrirModal('modalConfPedido');
}

function setDescontoTipo(tipo) {
  _confDescontoTipo = tipo;
  document.getElementById('btnDescontoReais').classList.toggle('active', tipo === 'reais');
  document.getElementById('btnDescontoPct').classList.toggle('active',   tipo === 'pct');
  // Ajusta placeholder
  document.getElementById('confDescontoVal').placeholder = tipo === 'pct' ? '0,00' : '0,00';
  recalcularConfPedido();
}

function recalcularConfPedido() {
  const ped = state.pedidos.find(p => p.id === _confPedId);
  if (!ped) return;

  const subtotal    = ped.total;
  const rawInput    = document.getElementById('confDescontoVal').value.trim();
  const valorDigit  = rawInput ? precoParaNum('R$ ' + rawInput) : 0;
  const errEl       = document.getElementById('confDescontoErr');
  errEl.textContent = '';

  let descontoVal = 0;
  if (valorDigit > 0) {
    if (_confDescontoTipo === 'pct') {
      if (valorDigit > 100) {
        errEl.textContent = 'Percentual não pode ser maior que 100%.';
        descontoVal = 0;
      } else {
        descontoVal = subtotal * (valorDigit / 100);
      }
    } else {
      if (valorDigit > subtotal) {
        errEl.textContent = 'Desconto não pode ser maior que o total do pedido.';
        descontoVal = 0;
      } else {
        descontoVal = valorDigit;
      }
    }
  }

  const totalFinal = Math.max(0, subtotal - descontoVal);
  const fmt = v => v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

  document.getElementById('confSubtotal').textContent     = fmt(subtotal);
  document.getElementById('confTotalFinal').textContent   = fmt(totalFinal);

  const linhaDesc = document.getElementById('confLinhaDesconto');
  if (descontoVal > 0 && !errEl.textContent) {
    linhaDesc.style.display = '';
    const desc = _confDescontoTipo === 'pct'
      ? `− ${fmt(descontoVal)} (${valorDigit.toFixed(1)}%)`
      : `− ${fmt(descontoVal)}`;
    document.getElementById('confDescontoDisplay').textContent = desc;
  } else {
    linhaDesc.style.display = 'none';
  }
}

function executarConfirmarPedido() {
  const ped = state.pedidos.find(p => p.id === _confPedId);
  if (!ped) return;

  // Valida desconto
  const errEl = document.getElementById('confDescontoErr');
  if (errEl.textContent) return;

  const rawInput   = document.getElementById('confDescontoVal').value.trim();
  const valorDigit = rawInput ? precoParaNum('R$ ' + rawInput) : 0;
  const obs        = document.getElementById('confObs').value.trim();

  let descontoVal = 0;
  if (valorDigit > 0) {
    descontoVal = _confDescontoTipo === 'pct'
      ? ped.total * (valorDigit / 100)
      : valorDigit;
  }
  const totalFinal = Math.max(0, ped.total - descontoVal);

  // 1. Debita state.estoque
  garantirEntradaEstoque();
  ped.itens.forEach(it => {
    if (state.estoque[it.id]) {
      state.estoque[it.id].quantidade = Math.max(0, state.estoque[it.id].quantidade - it.quantidade);
      registrarMovimento(it.id, 'saida', it.quantidade,
        `Pedido confirmado ${ped.numero}`, state.estoque[it.id].quantidade);
    }
  });

  // 2. Lança no histórico do cliente com o valor final (já com desconto)
  if (ped.clienteId) {
    const cliente = state.clientes.find(c => c.id === ped.clienteId);
    if (cliente) {
      if (!cliente.compras) cliente.compras = [];
      const dataStr  = new Date(ped.data).toISOString().slice(0, 10);
      const descProd = ped.itens.map(it => `${it.quantidade}× ${it.nome}`).join(', ');
      const descObs  = [
        descProd,
        descontoVal > 0 ? `Desconto: ${descontoVal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}` : '',
        obs
      ].filter(Boolean).join(' | ');
      cliente.compras.push({
        id: gerarId(), data: dataStr,
        valor: totalFinal, produtos: descObs
      });
      cliente.compras.sort((a, b) => a.data.localeCompare(b.data));
    }
  }

  // 3. Atualiza o pedido
  ped.status          = 'confirmado';
  ped.dataConfirmacao = new Date().toISOString();
  ped.totalFinal      = totalFinal;
  ped.desconto        = descontoVal;
  ped.obs             = obs;
  persistir();

  fecharModal('modalConfPedido');
  renderTabelaPedidos();
  renderResumoEstoque();
  renderTabelaEstoque();
  renderHistorico();
  renderTabelaClientes();
  atualizarBadgePedidos();

  const msg = descontoVal > 0
    ? `Pedido ${ped.numero} confirmado com desconto de ${descontoVal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}! ✓`
    : `Pedido ${ped.numero} confirmado! ✓`;
  mostrarToast(msg, 'success');
}


// ── Cancelar pedido ───────────────────────────────────────────
function cancelarPedido(pedId) {
  const ped = state.pedidos.find(p => p.id === pedId);
  if (!ped || ped.status !== 'pendente') return;

  document.getElementById('confirmTitulo').textContent = 'Cancelar Pedido';
  document.getElementById('confirmMsg').innerHTML =
    `Cancelar o pedido <strong>${escapeHtml(ped.numero)}</strong>? O estoque não será alterado.`;
  document.getElementById('confirmOkBtn').onclick = () => {
    ped.status = 'cancelado';
    ped.dataCancelamento = new Date().toISOString();
    persistir();
    fecharModal('confirmModal');
    renderTabelaPedidos();
    atualizarBadgePedidos();
    mostrarToast(`Pedido ${ped.numero} cancelado.`, 'success');
  };
  abrirModal('confirmModal');
}

// ── Re-enviar mensagem no WhatsApp ───────────────────────────
function reenviarWhatsapp(pedId) {
  const ped = state.pedidos.find(p => p.id === pedId);
  if (!ped) return;
  const num = state.config.whatsapp || WHATSAPP_DEFAULT;
  let msg   = `🛒 *${ped.numero} — Trem Mineiro*\n\n`;
  ped.itens.forEach(it => {
    const sub = (it.precoNum * it.quantidade).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    msg += `• ${it.quantidade}× *${it.nome}* — ${sub}\n`;
  });
  msg += `\n💰 *Total: ${ped.total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}*`;
  if (ped.clienteId) msg += `\n👤 *Cliente: ${ped.clienteNome}*`;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
}

/* ============================================================
   MÓDULO DE CLIENTES
============================================================ */

let _filtroAniversario = false;
let _clienteHistId     = null;

function renderTabelaClientes() {
  const tbody = document.getElementById('clienteTableBody');
  if (!tbody) return;
  const busca    = ((document.getElementById('buscaCliente') ? document.getElementById('buscaCliente').value : '') || '').toLowerCase().trim();
  const mesAtual = new Date().getMonth() + 1;
  tbody.innerHTML = '';

  let lista = state.clientes;
  if (busca) {
    lista = lista.filter(c =>
      c.nome.toLowerCase().includes(busca) ||
      (c.telefone || '').includes(busca) ||
      (c.email    || '').toLowerCase().includes(busca)
    );
  }
  if (_filtroAniversario) {
    lista = lista.filter(c => c.aniversario && parseInt(c.aniversario.slice(5,7),10) === mesAtual);
  }
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="admin-empty">${
      _filtroAniversario ? 'Nenhum aniversariante este mês.' :
      busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'
    }</div></td></tr>`;
    return;
  }

  lista.forEach((c, i) => {
    const compras    = c.compras || [];
    const totalGasto = compras.reduce((s, x) => s + (x.valor || 0), 0);
    const ultCompra  = compras.length
      ? new Date(compras[compras.length-1].data + 'T12:00:00').toLocaleDateString('pt-BR') : null;

    let anivDisplay = '—', anivBadge = '';
    if (c.aniversario) {
      const [,mm,dd] = c.aniversario.split('-');
      anivDisplay = dd + '/' + mm;
      if (parseInt(mm,10) === mesAtual) {
        const hoje = new Date().getDate();
        anivBadge = parseInt(dd,10) === hoje
          ? ' <span style="background:#fef3d0;color:#b8860b;font-size:.68rem;font-weight:700;padding:.1rem .45rem;border-radius:12px;">🎂 Hoje!</span>'
          : ' <span style="background:#eafaf1;color:#27ae60;font-size:.68rem;font-weight:700;padding:.1rem .45rem;border-radius:12px;">🎂 Este mês</span>';
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--cinza);font-size:.82rem;">${i+1}</td>
      <td>
        <strong>${escapeHtml(c.nome)}</strong>
        ${c.obs ? `<div style="font-size:.74rem;color:var(--cinza);margin-top:.1rem;">${escapeHtml(c.obs.slice(0,55))}${c.obs.length>55?'…':''}</div>` : ''}
      </td>
      <td style="white-space:nowrap;">${anivDisplay}${anivBadge}</td>
      <td>${c.telefone
        ? `<a href="https://wa.me/55${c.telefone.replace(/\D/g,'')}" target="_blank"
             style="color:var(--terra);font-weight:700;font-size:.85rem;text-decoration:none;">📱 ${escapeHtml(c.telefone)}</a>`
        : '<span style="color:var(--cinza)">—</span>'}</td>
      <td>${c.email
        ? `<a href="mailto:${escapeHtml(c.email)}" style="color:var(--terra);font-size:.85rem;">${escapeHtml(c.email)}</a>`
        : '<span style="color:var(--cinza)">—</span>'}</td>
      <td style="font-size:.82rem;max-width:160px;">${c.endereco ? escapeHtml(c.endereco) : '<span style="color:var(--cinza)">—</span>'}</td>
      <td>
        <span style="font-family:var(--font-serif);font-weight:800;color:var(--terra);">${totalGasto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span><br>
        <span style="font-size:.74rem;color:var(--cinza);">${compras.length} compra${compras.length!==1?'s':''}</span>
        ${ultCompra ? `<br><span style="font-size:.72rem;color:var(--cinza);">Última: ${ultCompra}</span>` : ''}
      </td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="abrirModalCliente('${c.id}')">✏️</button>
          <button class="btn btn-gold btn-sm" onclick="abrirHistoricoCliente('${c.id}')" title="Histórico de compras">🧾</button>
          <button class="btn btn-danger btn-sm" onclick="confirmarExcluirCliente('${c.id}')">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleFiltroAniversario(btn) {
  _filtroAniversario = !_filtroAniversario;
  btn.classList.toggle('active', _filtroAniversario);
  renderTabelaClientes();
}

function abrirModalCliente(clienteId) {
  ['clienteNome','clienteAniversario','clienteTelefone','clienteEmail','clienteEndereco','clienteObs']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('clienteEditId').value = '';
  document.getElementById('clienteNomeErr').textContent = '';
  document.getElementById('clienteNome').classList.remove('error');

  if (clienteId) {
    const c = state.clientes.find(x => x.id === clienteId);
    if (!c) return;
    document.getElementById('modalClienteTitulo').textContent = 'Editar Cliente';
    document.getElementById('clienteEditId').value      = c.id;
    document.getElementById('clienteNome').value        = c.nome;
    document.getElementById('clienteAniversario').value = c.aniversario || '';
    document.getElementById('clienteTelefone').value    = c.telefone   || '';
    document.getElementById('clienteEmail').value       = c.email      || '';
    document.getElementById('clienteEndereco').value    = c.endereco   || '';
    document.getElementById('clienteObs').value         = c.obs        || '';
  } else {
    document.getElementById('modalClienteTitulo').textContent = 'Novo Cliente';
  }
  abrirModal('modalCliente');
}

function salvarCliente() {
  const nome        = document.getElementById('clienteNome').value.trim();
  const aniversario = document.getElementById('clienteAniversario').value;
  const telefone    = document.getElementById('clienteTelefone').value.trim();
  const email       = document.getElementById('clienteEmail').value.trim();
  const endereco    = document.getElementById('clienteEndereco').value.trim();
  const obs         = document.getElementById('clienteObs').value.trim();
  const editId      = document.getElementById('clienteEditId').value;

  document.getElementById('clienteNomeErr').textContent = '';
  if (!nome) {
    document.getElementById('clienteNomeErr').textContent = 'Nome obrigatório.';
    document.getElementById('clienteNome').classList.add('error');
    return;
  }
  document.getElementById('clienteNome').classList.remove('error');

  if (editId) {
    const idx = state.clientes.findIndex(c => c.id === editId);
    if (idx > -1) state.clientes[idx] = { ...clientes[idx], nome, aniversario, telefone, email, endereco, obs };
    mostrarToast('Cliente atualizado! ✓', 'success');
  } else {
    state.clientes.push({ id: gerarId(), nome, aniversario, telefone, email, endereco, obs, compras: [] });
    mostrarToast('Cliente cadastrado! ✓', 'success');
  }
  persistir();
  fecharModal('modalCliente');
  renderTabelaClientes();
}

function confirmarExcluirCliente(clienteId) {
  const c = state.clientes.find(x => x.id === clienteId);
  if (!c) return;
  document.getElementById('confirmTitulo').textContent = 'Excluir Cliente';
  document.getElementById('confirmMsg').innerHTML =
    `Deseja excluir <strong>"${escapeHtml(c.nome)}"</strong>?<br>O histórico de compras também será removido.`;
  document.getElementById('confirmOkBtn').onclick = () => {
    state.clientes = state.clientes.filter(x => x.id !== clienteId);
    persistir();
    fecharModal('confirmModal');
    renderTabelaClientes();
    mostrarToast('Cliente excluído.', 'success');
  };
  abrirModal('confirmModal');
}

// ── Histórico de compras ─────────────────────────────────────
function abrirHistoricoCliente(clienteId) {
  const c = state.clientes.find(x => x.id === clienteId);
  if (!c) return;
  _clienteHistId = clienteId;
  document.getElementById('modalHistClienteTitulo').textContent = '🧾 Histórico — ' + c.nome;
  document.getElementById('compraData').value     = new Date().toISOString().slice(0,10);
  document.getElementById('compraValor').value    = '';
  document.getElementById('compraProdutos').value = '';
  renderResumoHistoricoCliente(c);
  renderListaCompras(c);
  abrirModal('modalHistoricoCliente');
}

function renderResumoHistoricoCliente(c) {
  const compras    = c.compras || [];
  const totalGasto = compras.reduce((s, x) => s + (x.valor || 0), 0);
  const media      = compras.length ? totalGasto / compras.length : 0;
  document.getElementById('modalHistClienteResumo').innerHTML = `
    <div style="background:var(--creme-mid);border-radius:var(--radius-sm);padding:.6rem 1rem;flex:1;min-width:110px;">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--cinza);">Compras</div>
      <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:800;color:var(--cafe);">${compras.length}</div>
    </div>
    <div style="background:var(--creme-mid);border-radius:var(--radius-sm);padding:.6rem 1rem;flex:1;min-width:110px;">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--cinza);">Total gasto</div>
      <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:800;color:var(--terra);">${totalGasto.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
    </div>
    <div style="background:var(--creme-mid);border-radius:var(--radius-sm);padding:.6rem 1rem;flex:1;min-width:110px;">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--cinza);">Ticket médio</div>
      <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:800;color:var(--ouro);">${media.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
    </div>
  `;
}

function renderListaCompras(c) {
  const wrap    = document.getElementById('listaComprasCliente');
  const compras = [...(c.compras || [])].reverse();
  if (compras.length === 0) {
    wrap.innerHTML = `<div style="text-align:center;color:var(--cinza);padding:1.5rem;font-size:.9rem;">Nenhuma compra registrada ainda.</div>`;
    return;
  }
  wrap.innerHTML = compras.map((x, i) => {
    const d = new Date(x.data + 'T12:00:00');
    return `
      <div style="display:flex;align-items:flex-start;gap:.8rem;padding:.75rem 0;border-bottom:1px solid var(--creme-mid);">
        <div style="background:var(--creme-mid);border-radius:8px;padding:.4rem .65rem;text-align:center;flex-shrink:0;min-width:48px;">
          <div style="font-size:.6rem;color:var(--cinza);font-weight:700;text-transform:uppercase;">${d.toLocaleDateString('pt-BR',{month:'short'})}</div>
          <div style="font-family:var(--font-serif);font-size:1.1rem;font-weight:800;color:var(--cafe);line-height:1;">${d.getDate()}</div>
          <div style="font-size:.6rem;color:var(--cinza);">${d.getFullYear()}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.88rem;color:var(--cafe-soft);">${x.produtos ? escapeHtml(x.produtos) : '<em style="color:var(--cinza)">Sem descrição</em>'}</div>
          <div style="font-family:var(--font-serif);font-weight:800;color:var(--terra);font-size:1rem;margin-top:.15rem;">${(x.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
        </div>
        <button onclick="removerCompra(${i})"
          style="background:none;border:none;color:var(--cinza);font-size:.85rem;cursor:pointer;padding:.2rem .4rem;border-radius:4px;"
          onmouseover="this.style.color='var(--erro)'" onmouseout="this.style.color='var(--cinza)'"
          title="Remover">✕</button>
      </div>`;
  }).join('');
}

function adicionarCompra() {
  const c = state.clientes.find(x => x.id === _clienteHistId);
  if (!c) return;
  const data     = document.getElementById('compraData').value;
  const valorRaw = document.getElementById('compraValor').value.trim();
  const produtosField = document.getElementById('compraProdutos').value.trim();
  if (!data || !valorRaw) { mostrarToast('Informe a data e o valor.', 'error'); return; }
  const valor = precoParaNum('R$ ' + valorRaw);
  if (!valor) { mostrarToast('Valor inválido.', 'error'); return; }
  if (!c.compras) c.compras = [];
  c.compras.push({ id: gerarId(), data, valor, produtos: produtosField });
  c.compras.sort((a, b) => a.data.localeCompare(b.data));
  persistir();
  document.getElementById('compraValor').value    = '';
  document.getElementById('compraProdutos').value = '';
  renderResumoHistoricoCliente(c);
  renderListaCompras(c);
  renderTabelaClientes();
  mostrarToast('Compra registrada! ✓', 'success');
}

function removerCompra(idxReversed) {
  const c = state.clientes.find(x => x.id === _clienteHistId);
  if (!c || !c.compras) return;
  const idxReal = c.compras.length - 1 - idxReversed;
  const compraId = (c.compras[idxReal] ? c.compras[idxReal].id : null);
  c.compras.splice(idxReal, 1);
  persistir();
  renderResumoHistoricoCliente(c);
  renderListaCompras(c);
  renderTabelaClientes();
  mostrarToast('Compra removida.', 'success');
}

/* ============================================================
   MOTOR DE DRAG & DROP REUTILIZÁVEL
   Funciona para a tabela de state.categorias e de state.produtos.
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
      reordenarArray(state.categorias, dragSrcId, tr.dataset.id, isTop);
      persistir();
      renderTabelaCategorias();
      renderFiltroCategorias();
    } else {
      const filtroCat = document.getElementById('filtroCategoriaProd').value;
      if (filtroCat) {
        const idsVisiveis = state.produtos
          .filter(p => p.categoriaId === filtroCat)
          .map(p => p.id);
        reordenarArrayPorIds(state.produtos, idsVisiveis, dragSrcId, tr.dataset.id, isTop);
      } else {
        reordenarArray(state.produtos, dragSrcId, tr.dataset.id, isTop);
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
   GERENCIADOR DE MÍDIA DO HERO
============================================================ */

function renderHeroMediaLista() {
  const wrap = document.getElementById('heroMediaLista');
  if (!wrap) return;
  const lista = state.config.heroMedia || [];

  if (lista.length === 0) {
    wrap.innerHTML = `<div style="text-align:center;color:var(--cinza);font-size:.85rem;padding:1.5rem;">Nenhuma mídia adicionada ainda.</div>`;
    return;
  }

  wrap.innerHTML = `<div class="hero-media-grid" id="heroMediaGrid"></div>`;
  const grid = document.getElementById('heroMediaGrid');

  lista.forEach((m, i) => {
    const div = document.createElement('div');
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
        ${i > 0
          ? `<button class="hero-media-btn mover" onclick="moverHeroMedia(${i},-1)" title="Mover para esquerda">◀</button>`
          : ''}
        ${i < lista.length - 1
          ? `<button class="hero-media-btn mover" onclick="moverHeroMedia(${i},1)" title="Mover para direita">▶</button>`
          : ''}
        <button class="hero-media-btn" onclick="removerHeroMedia('${m.id}')" title="Remover">✕</button>
      </div>
    `;
    grid.appendChild(div);
  });
}

function adicionarHeroImagem(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { mostrarToast('Máximo 5 MB!', 'error'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const item = {
      id:    gerarId(),
      tipo:  'imagem',
      src:   e.target.result,
      titulo: file.name.replace(/\.[^.]+$/, '')
    };
    state.config.heroMedia.push(item);
    persistir();
    input.value = '';
    renderHeroMediaLista();
    iniciarCarrosselHero();
    mostrarToast('Imagem adicionada! ✓', 'success');
  };
  reader.readAsDataURL(file);
}

function adicionarHeroUrl() {
  const url    = document.getElementById('heroUrlInput').value.trim();
  const titulo = document.getElementById('heroUrlTitulo').value.trim();
  if (!url) { mostrarToast('Informe uma URL.', 'error'); return; }

  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  const item = { id: gerarId(), tipo: isVideo ? 'video' : 'imagem', src: url, titulo: titulo || url.split('/').pop() };
  state.config.heroMedia.push(item);
  persistir();
  document.getElementById('heroUrlInput').value  = '';
  document.getElementById('heroUrlTitulo').value = '';
  renderHeroMediaLista();
  iniciarCarrosselHero();
  mostrarToast((isVideo ? 'Vídeo' : 'Imagem') + ' adicionado! ✓', 'success');
}

function removerHeroMedia(mediaId) {
  state.config.heroMedia = state.config.heroMedia.filter(m => m.id !== mediaId);
  persistir();
  renderHeroMediaLista();
  iniciarCarrosselHero();
  mostrarToast('Mídia removida.', 'success');
}

function moverHeroMedia(idx, dir) {
  const lista = state.config.heroMedia;
  const novoIdx = idx + dir;
  if (novoIdx < 0 || novoIdx >= lista.length) return;
  [lista[idx], lista[novoIdx]] = [lista[novoIdx], lista[idx]];
  persistir();
  renderHeroMediaLista();
  iniciarCarrosselHero();
}

/* ============================================================
   CARROSSEL DO HERO
============================================================ */
let _heroTimer   = null;
let _heroIndice  = 0;
let _heroSlides  = []; // lista de URLs de imagens

function iniciarCarrosselHero() {
  // Usa state.config.heroMedia; se vazio, fallback para imagens dos state.produtos
  let midia = (state.config.heroMedia && state.config.heroMedia.length > 0)
    ? state.config.heroMedia
    : state.produtos.filter(p => p.imagem).map(p => ({ id: p.id, tipo: 'imagem', src: p.imagem, titulo: p.nome }));

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
  // Ouve eventos disparados pelo db.js (substituem mostrarToast no db)
  document.addEventListener('tm:salvo',       () => mostrarToast('Dados salvos! ✓', 'success'));
  document.addEventListener('tm:erro-salvar', () => mostrarToast('Erro ao salvar.', 'error'));

  try {
    await carregarDoSupabase();
  } catch(err) {
    console.error('Erro ao carregar dados:', err);
    if (!state.categorias.length) state.categorias = CATEGORIAS_PADRAO;
    if (!state.produtos.length)   state.produtos   = PRODUTOS_PADRAO;
    if (!state.usuarios.length)   state.usuarios   = USUARIOS_PADRAO;
    mostrarToast('Erro de conexão. Exibindo dados padrão.', 'error');
  }

  // Restaura sessão admin do Supabase Auth
  try {
    const { data: { session } } = await getAuthSession();
    if (session) {
      const emailSessao = session.user.email;
      const usuario = state.usuarios.find(u =>
        u.email === emailSessao || `${u.login}@trem-mineiro.app` === emailSessao
      );
      if (usuario) {
        state.sessao = { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil };
      }
    }
  } catch(e) { /* ignora erros de auth no init */ }

  garantirEntradaEstoque();
  renderCatNav();
  renderCardapio();
  atualizarWhatsapp();
  aplicarLogo();
  iniciarCarrosselHero();
  atualizarBotaoCliente();

  if (state.sessaoCliente) {
    document.getElementById('dropdownNome').textContent = state.sessaoCliente.nome;
    document.getElementById('dropdownSub').textContent  = state.sessaoCliente.email || '';
  }
  if (state.sessao) {
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
   MÓDULO DE IMPORTAÇÃO (CSV / XLSX)
============================================================ */
let _importDados = [];
let _importTipo  = 'produtos'; // 'produtos' | 'estoque'

function trocarAbaImport(tipo, btn) {
  _importDados = [];
  _importTipo  = tipo;
  const inp = document.getElementById('importFileInput');
  if (inp) inp.value = '';
  const prev = document.getElementById('importPreviewArea');
  if (prev) prev.style.display = 'none';
  const alerta = document.getElementById('importAlertArea');
  if (alerta) alerta.innerHTML = '';

  document.querySelectorAll('#importTabProd, #importTabEst').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('importDescProdutos').style.display = tipo === 'produtos' ? '' : 'none';
  document.getElementById('importDescEstoque').style.display  = tipo === 'estoque'  ? '' : 'none';
}

function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => processarCSVImport(e.target.result);
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') {
      _mostrarAlertImport('error', 'Biblioteca XLSX não carregada. Verifique sua conexão.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const wb  = XLSX.read(e.target.result, { type: 'array' });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws);
      processarCSVImport(csv);
    };
    reader.readAsArrayBuffer(file);
  } else {
    _mostrarAlertImport('error', 'Formato não suportado. Use .csv ou .xlsx');
  }
}

function _parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function processarCSVImport(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    _mostrarAlertImport('error', 'Arquivo vazio ou sem dados.');
    return;
  }
  const headers = _parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim());
  _importDados = [];
  const erros = [];

  if (_importTipo === 'produtos') {
    const iCat   = headers.indexOf('categoria');
    const iNome  = headers.indexOf('nome');
    const iDesc  = headers.indexOf('descricao');
    const iPreco = headers.indexOf('preco');
    if (iCat === -1 || iNome === -1 || iDesc === -1 || iPreco === -1) {
      _mostrarAlertImport('error', 'Colunas obrigatórias não encontradas. Esperado: categoria, nome, descricao, preco');
      return;
    }
    lines.slice(1).forEach((line, idx) => {
      const cols    = _parseCSVLine(line);
      const catNome = (cols[iCat]   || '').replace(/['"]/g,'').trim();
      const nome    = (cols[iNome]  || '').replace(/['"]/g,'').trim();
      const desc    = (cols[iDesc]  || '').replace(/['"]/g,'').trim();
      const precoRaw= (cols[iPreco] || '').replace(/['"]/g,'').trim();
      if (!nome) return;
      const cat = state.categorias.find(c => c.nome.toLowerCase() === catNome.toLowerCase());
      if (!cat) { erros.push(`Linha ${idx+2}: categoria "${catNome}" não encontrada.`); return; }
      const precoNum = parseFloat(precoRaw.replace(',', '.'));
      if (isNaN(precoNum)) { erros.push(`Linha ${idx+2}: preço inválido "${precoRaw}".`); return; }
      _importDados.push({ catNome: cat.nome, categoriaId: cat.id, nome, desc, precoNum });
    });
  } else {
    // Movimentações: tipo, nome_produto, quantidade, fornecedor, data_compra, valor_unitario, observacao
    const iTipo  = headers.indexOf('tipo');
    const iNome  = headers.indexOf('nome_produto');
    const iQtd   = headers.indexOf('quantidade');
    const iForn  = headers.indexOf('fornecedor');
    const iData  = headers.indexOf('data_compra');
    const iVlr   = headers.indexOf('valor_unitario');
    const iObs   = headers.indexOf('observacao');
    if (iTipo === -1 || iNome === -1 || iQtd === -1) {
      _mostrarAlertImport('error', 'Colunas obrigatórias não encontradas. Esperado: tipo, nome_produto, quantidade');
      return;
    }
    const tiposValidos = ['entrada', 'saida', 'ajuste'];
    lines.slice(1).forEach((line, idx) => {
      const cols     = _parseCSVLine(line);
      const tipo     = (cols[iTipo]  || '').replace(/['"]/g,'').trim().toLowerCase();
      const nomeProd = (cols[iNome]  || '').replace(/['"]/g,'').trim();
      const qtdRaw   = (cols[iQtd]   || '').replace(/['"]/g,'').trim();
      const forn     = iForn !== -1  ? (cols[iForn] || '').replace(/['"]/g,'').trim() : '';
      const dataC    = iData !== -1  ? (cols[iData] || '').replace(/['"]/g,'').trim() : '';
      const vlrRaw   = iVlr  !== -1  ? (cols[iVlr]  || '').replace(/['"]/g,'').trim() : '';
      const obs      = iObs  !== -1  ? (cols[iObs]  || '').replace(/['"]/g,'').trim() : '';
      if (!nomeProd && !tipo) return; // linha vazia
      if (!tiposValidos.includes(tipo)) {
        erros.push(`Linha ${idx+2}: tipo "${tipo}" inválido. Use: entrada, saida ou ajuste.`); return;
      }
      if (!nomeProd) { erros.push(`Linha ${idx+2}: nome_produto em branco.`); return; }
      const qtd = parseInt(qtdRaw, 10);
      if (isNaN(qtd) || qtd < 0) { erros.push(`Linha ${idx+2}: quantidade inválida "${qtdRaw}".`); return; }
      const prod = state.produtos.find(p => p.nome.toLowerCase() === nomeProd.toLowerCase());
      if (!prod) { erros.push(`Linha ${idx+2}: produto "${nomeProd}" não encontrado.`); return; }
      const valorUnit = vlrRaw ? parseFloat(vlrRaw.replace(',', '.')) || null : null;
      _importDados.push({ prodId: prod.id, nomeProd: prod.nome, tipo, qtd, forn, dataC, valorUnit, obs });
    });
  }

  _mostrarPreviewImport(erros);
}

function _mostrarAlertImport(tipo, msg) {
  const el = document.getElementById('importAlertArea');
  if (el) el.innerHTML = `<div class="alert alert-${tipo === 'error' ? 'error' : 'success'}" style="max-width:700px;">${msg}</div>`;
}

function _mostrarPreviewImport(erros) {
  const area  = document.getElementById('importPreviewArea');
  const thead = document.getElementById('importPreviewHead');
  const tbody = document.getElementById('importPreviewBody');
  const count = document.getElementById('importCount');
  area.style.display = '';
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (erros.length > 0) {
    _mostrarAlertImport('error', erros.map(e => `• ${e}`).join('<br>'));
  } else {
    document.getElementById('importAlertArea').innerHTML = '';
  }

  if (_importDados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--cinza);">Nenhum dado válido encontrado.</td></tr>`;
    count.textContent = '0 itens';
    document.getElementById('btnConfirmarImport').disabled = true;
    return;
  }

  document.getElementById('btnConfirmarImport').disabled = false;
  count.textContent = `${_importDados.length} ${_importTipo === 'produtos' ? 'produto(s)' : 'item(ns) de estoque'}`;

  if (_importTipo === 'produtos') {
    thead.innerHTML = '<tr><th>Categoria</th><th>Nome</th><th>Descrição</th><th>Preço</th></tr>';
    _importDados.forEach(row => {
      const tr = document.createElement('tr');
      const pFmt = row.precoNum.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
      tr.innerHTML = `
        <td>${escapeHtml(row.catNome)}</td>
        <td><strong>${escapeHtml(row.nome)}</strong></td>
        <td style="font-size:.79rem;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(row.desc)}</td>
        <td>${pFmt}</td>`;
      tbody.appendChild(tr);
    });
  } else {
    const tipoLabel = { entrada: '⬆ Entrada', saida: '⬇ Saída', ajuste: '✎ Ajuste' };
    thead.innerHTML = '<tr><th>Tipo</th><th>Produto</th><th>Qtd</th><th>Fornecedor</th><th>Data compra</th><th>Vlr. unit.</th><th>Obs.</th></tr>';
    _importDados.forEach(row => {
      const tr = document.createElement('tr');
      const vlrFmt = row.valorUnit !== null
        ? row.valorUnit.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
        : '—';
      tr.innerHTML = `
        <td><span style="font-size:.78rem;font-weight:700;">${tipoLabel[row.tipo] || row.tipo}</span></td>
        <td><strong>${escapeHtml(row.nomeProd)}</strong></td>
        <td>${row.qtd}</td>
        <td style="font-size:.8rem;">${escapeHtml(row.forn) || '—'}</td>
        <td style="font-size:.8rem;">${row.dataC || '—'}</td>
        <td style="font-size:.8rem;">${vlrFmt}</td>
        <td style="font-size:.8rem;">${escapeHtml(row.obs) || '—'}</td>`;
      tbody.appendChild(tr);
    });
  }
}

async function confirmarImport() {
  if (_importDados.length === 0) return;
  const btn = document.getElementById('btnConfirmarImport');
  btn.disabled = true;
  btn.textContent = 'Importando…';
  try {
    if (_importTipo === 'produtos') {
      _importDados.forEach(row => {
        const existe = state.produtos.find(p =>
          p.nome.toLowerCase() === row.nome.toLowerCase() && p.categoriaId === row.categoriaId);
        if (existe) {
          existe.descricao = row.desc;
          existe.preco = row.precoNum.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        } else {
          const novo = {
            id: gerarId(),
            categoriaId: row.categoriaId,
            nome:        row.nome,
            descricao:   row.desc,
            preco:       row.precoNum.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
            imagem:      ''
          };
          state.produtos.push(novo);
          garantirEntradaEstoque(novo.id);
        }
      });
    } else {
      _importDados.forEach(row => {
        garantirEntradaEstoque(row.prodId);
        const est = state.estoque[row.prodId];
        let novoTotal;
        if (row.tipo === 'entrada') {
          novoTotal = est.quantidade + row.qtd;
        } else if (row.tipo === 'saida') {
          novoTotal = Math.max(0, est.quantidade - row.qtd);
        } else { // ajuste
          novoTotal = row.qtd;
        }
        est.quantidade = novoTotal;
        registrarMovimento(
          row.prodId,
          row.tipo,
          row.tipo === 'ajuste' ? novoTotal : row.qtd,
          row.obs,
          novoTotal,
          { fornecedor: row.forn, dataCompra: row.dataC, valorUnit: row.valorUnit }
        );
      });
    }
    await persistir();
    const n = _importDados.length;
    _importDados = [];
    document.getElementById('importPreviewArea').style.display = 'none';
    document.getElementById('importFileInput').value = '';
    _mostrarAlertImport('success', `✓ ${n} ${_importTipo === 'produtos' ? 'produto(s) importado(s)' : 'item(ns) de estoque atualizado(s)'} com sucesso!`);
    renderTabelaProdutos();
    renderTabelaEstoque();
    mostrarToast(`Importação concluída! ${n} itens processados. ✓`, 'success');
  } catch(e) {
    _mostrarAlertImport('error', 'Erro ao importar: ' + (e.message || e));
    btn.disabled = false;
    btn.textContent = '✓ Confirmar importação';
  }
}

// ── Expõe funções para o HTML (necessário com type="module") ──
if (typeof abrirAba !== "undefined") window.abrirAba = abrirAba;
if (typeof abrirAbaRelatorios !== "undefined") window.abrirAbaRelatorios = abrirAbaRelatorios;
if (typeof abrirCarrinho !== "undefined") window.abrirCarrinho = abrirCarrinho;
if (typeof abrirHistoricoCliente !== "undefined") window.abrirHistoricoCliente = abrirHistoricoCliente;
if (typeof abrirMeusDados !== "undefined") window.abrirMeusDados = abrirMeusDados;
if (typeof abrirModalCategoria !== "undefined") window.abrirModalCategoria = abrirModalCategoria;
if (typeof abrirModalCliente !== "undefined") window.abrirModalCliente = abrirModalCliente;
if (typeof abrirModalFornecedor !== "undefined") window.abrirModalFornecedor = abrirModalFornecedor;
if (typeof abrirModalMovimento !== "undefined") window.abrirModalMovimento = abrirModalMovimento;
if (typeof abrirModalProduto !== "undefined") window.abrirModalProduto = abrirModalProduto;
if (typeof abrirModalUsuario !== "undefined") window.abrirModalUsuario = abrirModalUsuario;
if (typeof addAoCarrinho !== "undefined") window.addAoCarrinho = addAoCarrinho;
if (typeof adicionarCompra !== "undefined") window.adicionarCompra = adicionarCompra;
if (typeof adicionarHeroImagem !== "undefined") window.adicionarHeroImagem = adicionarHeroImagem;
if (typeof adicionarHeroUrl !== "undefined") window.adicionarHeroUrl = adicionarHeroUrl;
if (typeof ajusteDigitado !== "undefined") window.ajusteDigitado = ajusteDigitado;
if (typeof ajusteRapido !== "undefined") window.ajusteRapido = ajusteRapido;
if (typeof aplicarFiltroIntervalo !== "undefined") window.aplicarFiltroIntervalo = aplicarFiltroIntervalo;
if (typeof cadastrarCliente !== "undefined") window.cadastrarCliente = cadastrarCliente;
if (typeof cancelarPedido !== "undefined") window.cancelarPedido = cancelarPedido;
if (typeof carrinhoAlterarQtd !== "undefined") window.carrinhoAlterarQtd = carrinhoAlterarQtd;
if (typeof carrinhoRemover !== "undefined") window.carrinhoRemover = carrinhoRemover;
if (typeof confirmarExcluirCategoria !== "undefined") window.confirmarExcluirCategoria = confirmarExcluirCategoria;
if (typeof confirmarExcluirCliente !== "undefined") window.confirmarExcluirCliente = confirmarExcluirCliente;
if (typeof confirmarExcluirFornecedor !== "undefined") window.confirmarExcluirFornecedor = confirmarExcluirFornecedor;
if (typeof confirmarExcluirProduto !== "undefined") window.confirmarExcluirProduto = confirmarExcluirProduto;
if (typeof confirmarExcluirUsuario !== "undefined") window.confirmarExcluirUsuario = confirmarExcluirUsuario;
if (typeof confirmarLimparHistorico !== "undefined") window.confirmarLimparHistorico = confirmarLimparHistorico;
if (typeof confirmarMovimento !== "undefined") window.confirmarMovimento = confirmarMovimento;
if (typeof confirmarPedido !== "undefined") window.confirmarPedido = confirmarPedido;
if (typeof detalheQtd !== "undefined") window.detalheQtd = detalheQtd;
if (typeof executarConfirmarPedido !== "undefined") window.executarConfirmarPedido = executarConfirmarPedido;
if (typeof fazerLogin !== "undefined") window.fazerLogin = fazerLogin;
if (typeof fazerLoginCliente !== "undefined") window.fazerLoginCliente = fazerLoginCliente;
if (typeof fazerLogout !== "undefined") window.fazerLogout = fazerLogout;
if (typeof fecharCarrinho !== "undefined") window.fecharCarrinho = fecharCarrinho;
if (typeof fecharModal !== "undefined") window.fecharModal = fecharModal;
if (typeof filtrarPedidos !== "undefined") window.filtrarPedidos = filtrarPedidos;
if (typeof filtrarPorCategoria !== "undefined") window.filtrarPorCategoria = filtrarPorCategoria;
if (typeof filtroEstoqueStatus !== "undefined") window.filtroEstoqueStatus = filtroEstoqueStatus;
if (typeof finalizarPedido !== "undefined") window.finalizarPedido = finalizarPedido;
if (typeof handleFileUpload !== "undefined") window.handleFileUpload = handleFileUpload;
if (typeof handleLogoUpload !== "undefined") window.handleLogoUpload = handleLogoUpload;
if (typeof limparCarrinho !== "undefined") window.limparCarrinho = limparCarrinho;
if (typeof logoutCliente !== "undefined") window.logoutCliente = logoutCliente;
if (typeof mascaraPreco !== "undefined") window.mascaraPreco = mascaraPreco;
if (typeof toggleSenha !== "undefined") window.toggleSenha = toggleSenha;
if (typeof moverHeroMedia !== "undefined") window.moverHeroMedia = moverHeroMedia;
if (typeof pedirLoginParaPedido !== "undefined") window.pedirLoginParaPedido = pedirLoginParaPedido;
if (typeof previewImagem !== "undefined") window.previewImagem = previewImagem;
if (typeof reenviarWhatsapp !== "undefined") window.reenviarWhatsapp = reenviarWhatsapp;
if (typeof removerCompra !== "undefined") window.removerCompra = removerCompra;
if (typeof removerHeroMedia !== "undefined") window.removerHeroMedia = removerHeroMedia;
if (typeof removerImagem !== "undefined") window.removerImagem = removerImagem;
if (typeof removerLogo !== "undefined") window.removerLogo = removerLogo;
if (typeof renderHistorico !== "undefined") window.renderHistorico = renderHistorico;
if (typeof renderTabelaClientes !== "undefined") window.renderTabelaClientes = renderTabelaClientes;
if (typeof renderTabelaEstoque !== "undefined") window.renderTabelaEstoque = renderTabelaEstoque;
if (typeof renderTabelaFornecedores !== "undefined") window.renderTabelaFornecedores = renderTabelaFornecedores;
if (typeof renderTabelaPedidos !== "undefined") window.renderTabelaPedidos = renderTabelaPedidos;
if (typeof renderTabelaProdutos !== "undefined") window.renderTabelaProdutos = renderTabelaProdutos;
if (typeof salvarCategoria !== "undefined") window.salvarCategoria = salvarCategoria;
if (typeof salvarCliente !== "undefined") window.salvarCliente = salvarCliente;
if (typeof salvarFornecedor !== "undefined") window.salvarFornecedor = salvarFornecedor;
if (typeof salvarLimiteInline !== "undefined") window.salvarLimiteInline = salvarLimiteInline;
if (typeof salvarLogo !== "undefined") window.salvarLogo = salvarLogo;
if (typeof salvarMeusDados !== "undefined") window.salvarMeusDados = salvarMeusDados;
if (typeof salvarProduto !== "undefined") window.salvarProduto = salvarProduto;
if (typeof salvarUsuario !== "undefined") window.salvarUsuario = salvarUsuario;
if (typeof salvarWhatsapp !== "undefined") window.salvarWhatsapp = salvarWhatsapp;
if (typeof salvarManualSupabase !== "undefined") window.salvarManualSupabase = salvarManualSupabase;
if (typeof setAtalho !== "undefined") window.setAtalho = setAtalho;
if (typeof setDescontoTipo !== "undefined") window.setDescontoTipo = setDescontoTipo;
if (typeof sincronizarFornecedorTexto !== "undefined") window.sincronizarFornecedorTexto = sincronizarFornecedorTexto;
if (typeof toggleClienteDropdown !== "undefined") window.toggleClienteDropdown = toggleClienteDropdown;
if (typeof toggleFiltroAniversario !== "undefined") window.toggleFiltroAniversario = toggleFiltroAniversario;
if (typeof toggleIntervalo !== "undefined") window.toggleIntervalo = toggleIntervalo;
if (typeof togglePedidoBody !== "undefined") window.togglePedidoBody = togglePedidoBody;
if (typeof trocarAbaImagem !== "undefined") window.trocarAbaImagem = trocarAbaImagem;
if (typeof trocarAuthTab !== "undefined") window.trocarAuthTab = trocarAuthTab;
if (typeof voltarCardapio !== "undefined") window.voltarCardapio = voltarCardapio;
if (typeof trocarAbaImport !== "undefined") window.trocarAbaImport = trocarAbaImport;
if (typeof handleImportFile !== "undefined") window.handleImportFile = handleImportFile;
if (typeof confirmarImport !== "undefined") window.confirmarImport = confirmarImport;
