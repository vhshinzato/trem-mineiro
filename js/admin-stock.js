/* ============================================================
   admin-stock.js — Estoque e fornecedores
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
   MÓDULO DE ESTOQUE
============================================================ */

// Filtro de status ativo na tabela de estoque
let _filtroEstoqueStatus = '';

export function filtroEstoqueStatus(btn, status) {
  _filtroEstoqueStatus = status;
  document.querySelectorAll('.estoque-filtro-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabelaEstoque();
}

// ── Cards de resumo ──────────────────────────────────────────
function renderResumoEstoque() {
  garantirEntradaEstoque();
  const total   = getProdutos().length;
  const zeros   = getProdutos().filter(p => statusEstoque(p.id) === 'zero').length;
  const baixos  = getProdutos().filter(p => statusEstoque(p.id) === 'baixo').length;
  const excessos= getProdutos().filter(p => statusEstoque(p.id) === 'excesso').length;
  const ok      = total - zeros - baixos - excessos;
  const totalUn = Object.values(getEstoque()).reduce((s, e) => s + (e.quantidade || 0), 0);

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

// ── Tabela de estoque ────────────────────────────────────────
function renderTabelaEstoque() {
  garantirEntradaEstoque();
  const tbody    = document.getElementById('estoqueTableBody');
  const filtroCat = document.getElementById('filtroEstoqueCat').value;
  tbody.innerHTML = '';

  let lista = produtos;
  if (filtroCat)               lista = lista.filter(p => p.categoriaId === filtroCat);
  if (_filtroEstoqueStatus)    lista = lista.filter(p => statusEstoque(p.id) === _filtroEstoqueStatus);

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="admin-empty">Nenhum produto encontrado.</div></td></tr>`;
    return;
  }

  lista.forEach(p => {
    const cat = getCategorias().find(c => c.id === p.categoriaId);
    const est = getEstoque()[p.id] || { quantidade: 0, minimo: 5, maximo: 50 };
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
export function ajusteRapido(prodId, delta) {
  garantirEntradaEstoque();
  const est = getEstoque()[prodId];
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
export function ajusteDigitado(prodId, input) {
  garantirEntradaEstoque();
  const est  = getEstoque()[prodId];
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
export function abrirModalMovimento(tipo) {
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

export function confirmarMovimento() {
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
  const est = getEstoque()[prodId];
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

// ── Registro de movimentos ───────────────────────────────────
function registrarMovimento(prodId, tipo, quantidade, obs, novoTotal, extras = {}) {
  getMovimentos().unshift({
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
  if (getMovimentos().length > 200) setMovimentos(getMovimentos().slice(0, 200);
}

// ── Histórico ────────────────────────────────────────────────
function renderHistorico() {
  const tbody   = document.getElementById('historicoTableBody');
  const filtProd = document.getElementById('filtroHistProd').value;
  tbody.innerHTML = '';

  let lista = filtProd ? getMovimentos().filter(m => m.produtoId === filtProd) : movimentos;

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="admin-empty">Nenhuma movimentação registrada.</div></td></tr>`;
    return;
  }

  lista.forEach(m => {
    const prod = getProdutos().find(p => p.id === m.produtoId);
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
    movimentos = [];
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
  const est = getEstoque()[prodId];
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
  getProdutos().forEach(p => {
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
  getCategorias().forEach(c => {
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
  getProdutos().forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    if (p.id === val) opt.selected = true;
    sel.appendChild(opt);
  });
}






/* ============================================================
   MÓDULO DE FORNECEDORES
============================================================ */

function renderTabelaFornecedores() {
  const tbody = document.getElementById('fornTableBody');
  if (!tbody) return;
  const busca = ((document.getElementById('buscaFornecedor') ? document.getElementById('buscaFornecedor').value : '') || '').toLowerCase().trim();
  tbody.innerHTML = '';

  let lista = fornecedores;
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

export function abrirModalFornecedor(fornId) {
  ['fornNome','fornTelefone','fornEmail','fornEndereco','fornProdutos','fornObs'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList && document.getElementById(id).classList.remove('error');
  });
  document.getElementById('fornEditId').value = '';
  document.getElementById('fornNomeErr').textContent = '';

  if (fornId) {
    const f = getFornecedores().find(x => x.id === fornId);
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

export function salvarFornecedor() {
  const nome     = document.getElementById('fornNome').value.trim();
  const telefone = document.getElementById('fornTelefone').value.trim();
  const email    = document.getElementById('fornEmail').value.trim();
  const endereco = document.getElementById('fornEndereco').value.trim();
  const produtos = document.getElementById('fornProdutos').value.trim();
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
    const idx = getFornecedores().findIndex(f => f.id === editId);
    if (idx > -1) fornecedores[idx] = { ...fornecedores[idx], nome, telefone, email, endereco, produtos, obs };
    mostrarToast('Fornecedor atualizado! ✓', 'success');
  } else {
    getFornecedores().push({ id: gerarId(), nome, telefone, email, endereco, produtos, obs });
    mostrarToast('Fornecedor cadastrado! ✓', 'success');
  }

  persistir();
  fecharModal('modalFornecedor');
  renderTabelaFornecedores();
  renderSelectFornecedores();
  renderTabelaClientes();
}

function confirmarExcluirFornecedor(fornId) {
  const f = getFornecedores().find(x => x.id === fornId);
  if (!f) return;
  document.getElementById('confirmTitulo').textContent = 'Excluir Fornecedor';
  document.getElementById('confirmMsg').innerHTML =
    `Deseja excluir o fornecedor <strong>"${escapeHtml(f.nome)}"</strong>? Esta ação não pode ser desfeita.`;
  document.getElementById('confirmOkBtn').onclick = () => {
    fornecedores = getFornecedores().filter(x => x.id !== fornId);
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
  getFornecedores().forEach(f => {
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
