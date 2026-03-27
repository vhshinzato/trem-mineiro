/* ============================================================
   services/stockService.js — Regras de negócio de estoque
   
   Centraliza: validação de disponibilidade, baixa de estoque,
   alertas de estoque mínimo, movimentações.
============================================================ */
import { getEstoque, setEstoque, getMovimentos, setMovimentos,
         getProdutos }                 from '../state.js';
import { persistir }                  from '../db.js';
import { emit, EVENTS }               from '../eventBus.js';

export const stockService = {

  // ── Verifica se produto tem estoque disponível ─────────────
  temEstoque(produtoId, quantidade = 1) {
    const estoque = getEstoque();
    const item    = estoque[produtoId];
    if (!item) return true; // sem controle = disponível
    return item.quantidade >= quantidade;
  },

  // ── Verifica lista de itens do carrinho ───────────────────
  validarItens(itens = []) {
    const erros = [];
    for (const item of itens) {
      if (!this.temEstoque(item.id, item.quantidade)) {
        const estoque = getEstoque();
        const disp    = estoque[item.id]?.quantidade ?? 0;
        erros.push(`"${item.nome}": disponível ${disp}, solicitado ${item.quantidade}`);
      }
    }
    return { valido: erros.length === 0, erros };
  },

  // ── Baixar estoque ao confirmar pedido ────────────────────
  baixarEstoquePedido(itens = []) {
    const estoque = getEstoque();
    const novo    = { ...estoque };
    const alertas = [];

    for (const item of itens) {
      const pid = item.produtoId || item.id;
      if (!novo[pid]) continue;

      novo[pid] = {
        ...novo[pid],
        quantidade: Math.max(0, novo[pid].quantidade - item.quantidade),
      };

      // Alerta de estoque baixo
      if (novo[pid].quantidade <= (novo[pid].minimo || 0)) {
        alertas.push(item.nome || pid);
      }
    }

    setEstoque(novo);

    if (alertas.length > 0) {
      emit(EVENTS.STOCK_LOW, { produtos: alertas });
    }

    return { success: true };
  },

  // ── Registrar movimento manual ────────────────────────────
  registrarMovimento({ produtoId, tipo, quantidade, obs = '', fornecedor = '', valorUnit = null, dataCompra = null }) {
    if (!produtoId || !tipo || !quantidade || quantidade <= 0) {
      return { success: false, message: 'Dados de movimentação inválidos.' };
    }

    const estoque = getEstoque();
    if (!estoque[produtoId]) {
      return { success: false, message: 'Produto não encontrado no estoque.' };
    }

    const qtdAtual = estoque[produtoId].quantidade;
    const novaQtd  = tipo === 'entrada'
      ? qtdAtual + quantidade
      : Math.max(0, qtdAtual - quantidade);

    // Atualiza estoque
    const novoEstoque = {
      ...estoque,
      [produtoId]: { ...estoque[produtoId], quantidade: novaQtd },
    };
    setEstoque(novoEstoque);

    // Registra movimento
    const mov = {
      id:         'mov_' + Date.now().toString(36),
      produtoId,
      tipo,
      quantidade,
      novoTotal:  novaQtd,
      obs,
      fornecedor,
      valorUnit:  valorUnit ? parseFloat(valorUnit) : null,
      dataCompra: dataCompra || null,
      data:       new Date().toISOString(),
    };

    const movimentos = getMovimentos();
    const novos      = [mov, ...movimentos].slice(0, 200); // mantém últimos 200
    setMovimentos(novos);
    persistir();

    emit(EVENTS.STOCK_MOVED, { movimento: mov });

    // Alerta se ficou abaixo do mínimo
    if (novaQtd <= (novoEstoque[produtoId].minimo || 0)) {
      const produto = getProdutos().find(p => p.id === produtoId);
      emit(EVENTS.STOCK_LOW, { produtos: [produto?.nome || produtoId] });
    }

    return { success: true, movimento: mov, novaQuantidade: novaQtd };
  },

  // ── Garantir entrada de estoque para todos os produtos ────
  garantirEntradas() {
    const produtos = getProdutos();
    const estoque  = getEstoque();
    const novo     = { ...estoque };
    let   mudou    = false;

    for (const p of produtos) {
      if (!novo[p.id]) {
        novo[p.id] = { quantidade: 0, minimo: 0, maximo: 100 };
        mudou = true;
      }
    }

    if (mudou) setEstoque(novo);
  },

  // ── Status visual do estoque ──────────────────────────────
  getStatus(produtoId) {
    const item = getEstoque()[produtoId];
    if (!item) return 'sem-controle';
    if (item.quantidade <= 0)              return 'esgotado';
    if (item.quantidade <= item.minimo)    return 'baixo';
    if (item.quantidade >= item.maximo)    return 'excedido';
    return 'normal';
  },
};
