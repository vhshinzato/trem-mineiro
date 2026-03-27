/* ============================================================
   admin-customers.js — Clientes e histórico de compras
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

  let lista = clientes;
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

export function abrirModalCliente(clienteId) {
  ['clienteNome','clienteAniversario','clienteTelefone','clienteEmail','clienteEndereco','clienteObs']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('clienteEditId').value = '';
  document.getElementById('clienteNomeErr').textContent = '';
  document.getElementById('clienteNome').classList.remove('error');

  if (clienteId) {
    const c = getClientes().find(x => x.id === clienteId);
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

export function salvarCliente() {
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
    const idx = getClientes().findIndex(c => c.id === editId);
    if (idx > -1) clientes[idx] = { ...clientes[idx], nome, aniversario, telefone, email, endereco, obs };
    mostrarToast('Cliente atualizado! ✓', 'success');
  } else {
    getClientes().push({ id: gerarId(), nome, aniversario, telefone, email, endereco, obs, compras: [] });
    mostrarToast('Cliente cadastrado! ✓', 'success');
  }
  persistir();
  fecharModal('modalCliente');
  renderTabelaClientes();
}

export function confirmarExcluirCliente(clienteId) {
  const c = getClientes().find(x => x.id === clienteId);
  if (!c) return;
  document.getElementById('confirmTitulo').textContent = 'Excluir Cliente';
  document.getElementById('confirmMsg').innerHTML =
    `Deseja excluir <strong>"${escapeHtml(c.nome)}"</strong>?<br>O histórico de compras também será removido.`;
  document.getElementById('confirmOkBtn').onclick = () => {
    setClientes(getClientes().filter(x => x.id !== clienteId);
    persistir();
    fecharModal('confirmModal');
    renderTabelaClientes();
    mostrarToast('Cliente excluído.', 'success');
  };
  abrirModal('confirmModal');
}

// ── Histórico de compras ─────────────────────────────────────
export function abrirHistoricoCliente(clienteId) {
  const c = getClientes().find(x => x.id === clienteId);
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

export function adicionarCompra() {
  const c = getClientes().find(x => x.id === _clienteHistId);
  if (!c) return;
  const data     = document.getElementById('compraData').value;
  const valorRaw = document.getElementById('compraValor').value.trim();
  const produtos = document.getElementById('compraProdutos').value.trim();
  if (!data || !valorRaw) { mostrarToast('Informe a data e o valor.', 'error'); return; }
  const valor = precoParaNum('R$ ' + valorRaw);
  if (!valor) { mostrarToast('Valor inválido.', 'error'); return; }
  if (!c.compras) c.compras = [];
  c.compras.push({ id: gerarId(), data, valor, produtos });
  c.compras.sort((a, b) => a.data.localeCompare(b.data));
  persistir();
  document.getElementById('compraValor').value    = '';
  document.getElementById('compraProdutos').value = '';
  renderResumoHistoricoCliente(c);
  renderListaCompras(c);
  renderTabelaClientes();
  mostrarToast('Compra registrada! ✓', 'success');
}

export function removerCompra(idxReversed) {
  const c = getClientes().find(x => x.id === _clienteHistId);
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
