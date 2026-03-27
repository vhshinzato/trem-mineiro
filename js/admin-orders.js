/* ============================================================
   admin-orders.js — Pedidos e confirmação com desconto
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
   MÓDULO DE PEDIDOS
============================================================ */

let _filtroPedidos = 'todos';

export function filtrarPedidos(status, btn) {
  _filtroPedidos = status;
  document.querySelectorAll('.pedidos-filtros .estoque-filtro-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTabelaPedidos();
}

export function atualizarBadgePedidos() {
  const pendentes = getPedidos().filter(p => p.status === 'pendente').length;
  const badge     = document.getElementById('pedidosBadgeTab');
  if (!badge) return;
  if (pendentes > 0) {
    badge.textContent = pendentes;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

export function renderTabelaPedidos() {
  const wrap = document.getElementById('pedidosLista');
  if (!wrap) return;

  let lista = [...pedidos];
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
  lista.forEach(ped => {
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
}

function togglePedidoBody(pedId) {
  const body    = document.getElementById('body_'    + pedId);
  const chevron = document.getElementById('chevron_' + pedId);
  if (!body) return;
  const aberto = body.style.display !== 'none';
  body.style.display    = aberto ? 'none' : '';
  if (chevron) chevron.textContent = aberto ? '▼' : '▲';
}

// ── Confirmar: desconta estoque + lança no histórico do cliente ──





/* ============================================================
   CONFIRMAÇÃO DE PEDIDO COM DESCONTO
============================================================ */

let _confPedId       = null;
let _confDescontoTipo = 'reais'; // 'reais' | 'pct'

export function confirmarPedido(pedId) {
  const ped = getPedidos().find(p => p.id === pedId);
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
  const ped = getPedidos().find(p => p.id === _confPedId);
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
  const ped = getPedidos().find(p => p.id === _confPedId);
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

  // 1. Debita estoque
  garantirEntradaEstoque();
  ped.itens.forEach(it => {
    if (getEstoque()[it.id]) {
      getEstoque()[it.id].quantidade = Math.max(0, getEstoque()[it.id].quantidade - it.quantidade);
      registrarMovimento(it.id, 'saida', it.quantidade,
        `Pedido confirmado ${ped.numero}`, getEstoque()[it.id].quantidade);
    }
  });

  // 2. Lança no histórico do cliente com o valor final (já com desconto)
  if (ped.clienteId) {
    const cliente = getClientes().find(c => c.id === ped.clienteId);
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
export function cancelarPedido(pedId) {
  const ped = getPedidos().find(p => p.id === pedId);
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
  const ped = getPedidos().find(p => p.id === pedId);
  if (!ped) return;
  const num = getConfig().whatsapp || WHATSAPP_DEFAULT;
  let msg   = `🛒 *${ped.numero} — Trem Mineiro*\n\n`;
  ped.itens.forEach(it => {
    const sub = (it.precoNum * it.quantidade).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    msg += `• ${it.quantidade}× *${it.nome}* — ${sub}\n`;
  });
  msg += `\n💰 *Total: ${ped.total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}*`;
  if (ped.clienteId) msg += `\n👤 *Cliente: ${ped.clienteNome}*`;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
}
