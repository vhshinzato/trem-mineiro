/* ============================================================
   admin-products.js — Gerenciamento de categorias, produtos e imagens
   Trem Mineiro v2
============================================================ */
import {
  getCategorias, getProdutos, getConfig, getUsuarios,
  getFornecedores, getClientes, getPedidos, getEstoque, getMovimentos,
  getSessao, getSessaoCliente, getCarrinho, isAdminCarregado,
  setCategorias, setProdutos, setConfig, setUsuarios,
  setFornecedores, setClientes, setPedidos, setEstoque, setMovimentos,
  setSessao, setSessaoCliente, clearSessao, clearSessaoCliente,
  isSessaoAdmin, getProdutoById, getCategoriaById, getClienteById, getPedidoById,
  getCategoriasOuPadrao, getProdutosOuPadrao, getUsuariosOuPadrao
} from './state.js';
import { persistir, carregarDadosAdmin, salvarManualSupabase } from './db.js';
import { mostrarToast, renderCardapio, renderCatNav, atualizarWhatsapp, aplicarLogo, abrirModal, fecharModal, abrirConfirm } from './ui.js';

================================================
   GERENCIAMENTO DE CATEGORIAS
============================================================ */
function renderTabelaCategorias() {
  const tbody = document.getElementById('catTableBody');
  tbody.innerHTML = '';
  const isAdmin = getSessao() && getSessao().perfil === 'admin';

  if (getCategorias().length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="admin-empty">Nenhuma categoria cadastrada.</div></td></tr>`;
    return;
  }

  getCategorias().forEach((cat, i) => {
    const qtd = getProdutos().filter(p => p.categoriaId === cat.id).length;
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

  // Ativa drag-and-drop na tabela de categorias
  ativarDragDrop(tbody, 'categorias');
}

document.getElementById('btnNovaCat').addEventListener('click', () => abrirModalCategoria(null));

export function abrirModalCategoria(catId) {
  document.getElementById('catNome').value = '';
  document.getElementById('catEditId').value = '';
  document.getElementById('catNomeErr').textContent = '';
  document.getElementById('catAlert').innerHTML = '';

  if (catId) {
    const cat = getCategorias().find(c => c.id === catId);
    if (!cat) return;
    document.getElementById('modalCatTitulo').textContent = 'Editar Categoria';
    document.getElementById('catNome').value = cat.nome;
    document.getElementById('catEditId').value = cat.id;
  } else {
    document.getElementById('modalCatTitulo').textContent = 'Nova Categoria';
  }
  abrirModal('modalCategoria');
}

export function salvarCategoria() {
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
    const idx = getCategorias().findIndex(c => c.id === editId);
    if (idx > -1) categorias[idx].nome = nome;
    mostrarToast('Categoria atualizada!', 'success');
  } else {
    getCategorias().push({ id: gerarId(), nome });
    mostrarToast('Categoria criada!', 'success');
  }
  persistir();
  fecharModal('modalCategoria');
  renderTabelaCategorias();
  renderSelectCategorias();
  renderFiltroCategorias();
}

export function confirmarExcluirCategoria(catId) {
  const cat = getCategorias().find(c => c.id === catId);
  if (!cat) return;
  const qtd = getProdutos().filter(p => p.categoriaId === catId).length;
  document.getElementById('confirmTitulo').textContent = 'Excluir Categoria';
  document.getElementById('confirmMsg').innerHTML =
    `Deseja excluir a categoria <strong>"${escapeHtml(cat.nome)}"</strong>?` +
    (qtd > 0 ? `<br><br>⚠️ Atenção: ${qtd} produto${qtd>1?'s':''} vinculado${qtd>1?'s':''} também ser${qtd>1?'ão':'á'} excluído${qtd>1?'s':''}.` : '');
  document.getElementById('confirmOkBtn').onclick = () => excluirCategoria(catId);
  abrirModal('confirmModal');
}

export function excluirCategoria(catId) {
  const prodIds = getProdutos().filter(p => p.categoriaId === catId).map(p => p.id);
  categorias = getCategorias().filter(c => c.id !== catId);
  produtos   = getProdutos().filter(p => p.categoriaId !== catId);
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

  let lista = produtos;
  if (filtroCat) lista = lista.filter(p => p.categoriaId === filtroCat);

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="admin-empty">Nenhum produto encontrado.</div></td></tr>`;
    return;
  }

  lista.forEach(p => {
    const cat = getCategorias().find(c => c.id === p.categoriaId);
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

  // Ativa drag-and-drop na tabela de produtos
  ativarDragDrop(tbody, 'produtos');
}

function renderSelectCategorias() {
  // Select no modal de produto
  const sel = document.getElementById('prodCategoria');
  sel.innerHTML = '<option value="">Selecione uma categoria</option>';
  getCategorias().forEach(c => {
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
  getCategorias().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    if (c.id === val) opt.selected = true;
    sel.appendChild(opt);
  });
}

export function abrirModalProduto(prodId) {
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
    const p = getProdutos().find(x => x.id === prodId);
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

export function salvarProduto() {
  const catId = document.getElementById('prodCategoria').value;
  const nome  = document.getElementById('prodNome').value.trim();
  const desc  = document.getElementById('prodDesc').value.trim();
  const preco = document.getElementById('prodPreco').value.trim();
  const img   = obterImagemFinal();
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

  if (editId) {
    const idx = getProdutos().findIndex(p => p.id === editId);
    if (idx > -1) {
      produtos[idx] = { ...produtos[idx], categoriaId: catId, nome, descricao: desc, preco: precoFormatado, imagem: img };
    }
    mostrarToast('Produto atualizado!', 'success');
  } else {
    getProdutos().push({ id: gerarId(), categoriaId: catId, nome, descricao: desc, preco: precoFormatado, imagem: img });
    garantirEntradaEstoque();
    mostrarToast('Produto criado!', 'success');
  }
  persistir();
  fecharModal('modalProduto');
  renderTabelaProdutos();
}

export function confirmarExcluirProduto(prodId) {
  const p = getProdutos().find(x => x.id === prodId);
  if (!p) return;
  document.getElementById('confirmTitulo').textContent = 'Excluir Produto';
  document.getElementById('confirmMsg').innerHTML = `Deseja excluir o produto <strong>"${escapeHtml(p.nome)}"</strong>? Esta ação não pode ser desfeita.`;
  document.getElementById('confirmOkBtn').onclick = () => excluirProduto(prodId);
  abrirModal('confirmModal');
}

export function excluirProduto(prodId) {
  produtos   = getProdutos().filter(p => p.id !== prodId);
  delete getEstoque()[prodId];
  movimentos = getMovimentos().filter(m => m.produtoId !== prodId);
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

// Guarda o base64 da imagem carregada do arquivo (temporário, por modal aberto)
let _imagemBase64 = null;
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
  if (file.size > 5 * 1024 * 1024) {
    mostrarToast('Imagem muito grande! Máximo 5 MB.', 'error');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    _imagemBase64 = e.target.result; // string base64 completa (data:image/...;base64,...)
    document.getElementById('uploadFileName').textContent = '✔ ' + file.name;

    // Exibe preview
    const wrap = document.getElementById('imgPreviewWrap');
    wrap.innerHTML = `
      <img src="${_imagemBase64}" alt="preview" />
      <button class="preview-remove" title="Remover imagem" onclick="removerImagem()">✕</button>
    `;
  };
  reader.readAsDataURL(file);
}

// Remove a imagem atual do preview
function removerImagem() {
  _imagemBase64 = null;
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
