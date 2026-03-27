/* ============================================================
   services/orderService.js — Regras de negócio de pedidos
   
   Centraliza: cálculo de totais, descontos, validações,
   criação, confirmação e cancelamento de pedidos.
   UI não contém lógica. db.js não contém regras de negócio.
============================================================ */
import { getPedidos, getProdutoById, getClienteById,
         getEstoque, setPedidos, setEstoque,
         getClientes, setClientes }          from '../state.js';
import { persistir }                         from '../db.js';
import { emit, EVENTS }                      from '../eventBus.js';
import { stockService }                      from './stockService.js';

// ── Calcular total do carrinho ───────────────────────────────
export function calcularTotalCarrinho(itens = []) {
  return itens.reduce((total, item) => {
    const preco = _parsePrececimal(item.preco || item.precoUnit || '0');
    return total + (preco * (item.quantidade || 1));
  }, 0);
}

// ── Calcular desconto ────────────────────────────────────────
export function calcularDesconto(total, valor, tipo = 'valor') {
  if (!valor || valor <= 0) return { desconto: 0, totalFinal: total };

  let desconto = 0;
  if (tipo === 'percentual') {
    desconto = total * (Math.min(valor, 100) / 100);
  } else {
    desconto = Math.min(valor, total); // desconto não pode ser maior que o total
  }

  return {
    desconto:   parseFloat(desconto.toFixed(2)),
    totalFinal: parseFloat((total - desconto).toFixed(2)),
  };
}

// ── Criar pedido ─────────────────────────────────────────────
export function criarPedido({ itens, clienteId = null, clienteNome = null, obs = '' }) {
  if (!itens || itens.length === 0) {
    return { success: false, message: 'Pedido sem itens.' };
  }

  const total  = calcularTotalCarrinho(itens);
  const numero = _gerarNumeroPedido();

  const pedido = {
    id:           _gerarId(),
    numero,
    status:       'pendente',
    clienteId,
    clienteNome:  clienteNome || 'Cliente não identificado',
    itens:        itens.map(item => ({
      produtoId:  item.id,
      nome:       item.nome,
      quantidade: item.quantidade || 1,
      precoUnit:  _parsePrececimal(item.preco || '0'),
      subtotal:   _parsePrececimal(item.preco || '0') * (item.quantidade || 1),
    })),
    total,
    totalFinal:  null,
    desconto:    0,
    obs,
    data:        new Date().toISOString(),
    dataConfirmacao: null,
  };

  const pedidos = getPedidos();
  setPedidos([pedido, ...pedidos]);
  persistir();

  emit(EVENTS.ORDER_CREATED, { pedido });
  return { success: true, pedido };
}

// ── Confirmar pedido com desconto opcional ───────────────────
export function confirmarPedido(pedidoId, { desconto = 0, tipoDesconto = 'valor', obs = '' } = {}) {
  const pedidos = getPedidos();
  const idx     = pedidos.findIndex(p => p.id === pedidoId);
  if (idx === -1) return { success: false, message: 'Pedido não encontrado.' };

  const pedido = { ...pedidos[idx] };
  if (pedido.status === 'confirmado') {
    return { success: false, message: 'Pedido já confirmado.' };
  }

  // Calcula desconto e total final
  const { desconto: valorDesc, totalFinal } = calcularDesconto(
    pedido.total, desconto, tipoDesconto
  );

  pedido.status          = 'confirmado';
  pedido.desconto        = valorDesc;
  pedido.totalFinal      = totalFinal;
  pedido.dataConfirmacao = new Date().toISOString();
  if (obs) pedido.obs    = obs;

  // Baixa o estoque
  const resultEstoque = stockService.baixarEstoquePedido(pedido.itens);
  if (!resultEstoque.success) {
    return { success: false, message: resultEstoque.message };
  }

  // Atualiza histórico do cliente
  if (pedido.clienteId) {
    _registrarCompraCliente(pedido);
  }

  // Salva estado
  const novosPedidos = [...pedidos];
  novosPedidos[idx]  = pedido;
  setPedidos(novosPedidos);
  persistir();

  emit(EVENTS.ORDER_CONFIRMED, { pedido });
  return { success: true, pedido };
}

// ── Cancelar pedido ──────────────────────────────────────────
export function cancelarPedido(pedidoId) {
  const pedidos = getPedidos();
  const idx     = pedidos.findIndex(p => p.id === pedidoId);
  if (idx === -1) return { success: false, message: 'Pedido não encontrado.' };

  const novosPedidos = [...pedidos];
  novosPedidos[idx]  = { ...novosPedidos[idx], status: 'cancelado' };
  setPedidos(novosPedidos);
  persistir();

  emit(EVENTS.ORDER_CANCELLED, { pedidoId });
  return { success: true };
}

// ── Reabrir pedido ───────────────────────────────────────────
export function reabrirPedido(pedidoId) {
  const pedidos = getPedidos();
  const idx     = pedidos.findIndex(p => p.id === pedidoId);
  if (idx === -1) return { success: false, message: 'Pedido não encontrado.' };

  const novosPedidos = [...pedidos];
  novosPedidos[idx]  = {
    ...novosPedidos[idx],
    status: 'pendente',
    dataConfirmacao: null,
    desconto: 0,
    totalFinal: null,
  };
  setPedidos(novosPedidos);
  persistir();

  emit(EVENTS.ORDER_REOPENED, { pedidoId });
  return { success: true };
}

// ── Gerar mensagem WhatsApp ──────────────────────────────────
export function gerarMensagemWhatsApp(itens, config, clienteNome = '') {
  const total   = calcularTotalCarrinho(itens);
  const linhas  = itens.map(item => {
    const preco = _parsePrececimal(item.preco || '0');
    return `• ${item.nome} x${item.quantidade} = R$ ${(preco * item.quantidade).toFixed(2).replace('.',',')}`;
  });

  const saudacao = clienteNome ? `Olá! Sou ${clienteNome}.\n\n` : '';
  const msg      = `${saudacao}🛒 *Pedido - Trem Mineiro*\n\n${linhas.join('\n')}\n\n*Total: R$ ${total.toFixed(2).replace('.',',')}*`;
  const tel      = (config?.whatsapp || '').replace(/\D/g, '');

  return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
}

// ── Helpers privados ─────────────────────────────────────────
function _parsePrececimal(str) {
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
}

function _gerarNumeroPedido() {
  return String(Date.now()).slice(-6);
}

function _gerarId() {
  return 'ped_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function _registrarCompraCliente(pedido) {
  const clientes = getClientes();
  const idx      = clientes.findIndex(c => c.id === pedido.clienteId);
  if (idx === -1) return;

  const novosClientes = [...clientes];
  const compra = {
    id:       _gerarId(),
    data:     pedido.dataConfirmacao,
    valor:    pedido.totalFinal ?? pedido.total,
    produtos: pedido.itens.map(i => i.nome).join(', '),
  };
  novosClientes[idx] = {
    ...novosClientes[idx],
    compras: [...(novosClientes[idx].compras || []), compra],
  };
  setClientes(novosClientes);
}
