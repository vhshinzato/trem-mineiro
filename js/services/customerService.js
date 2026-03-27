/* ============================================================
   services/customerService.js — Regras de negócio de clientes
   
   Centraliza: validações, CRUD, histórico de compras,
   lógica de aniversariantes e segmentação.
============================================================ */
import { getClientes, setClientes } from '../state.js';
import { persistir }                from '../db.js';
import { emit, EVENTS }             from '../eventBus.js';

export const customerService = {

  // ── Validar cliente ───────────────────────────────────────
  validar({ nome, email = '', telefone = '' }) {
    const erros = [];
    if (!nome || nome.trim().length < 2)
      erros.push('Nome deve ter pelo menos 2 caracteres.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      erros.push('E-mail inválido.');
    return { valido: erros.length === 0, erros };
  },

  // ── Criar cliente ─────────────────────────────────────────
  criar({ nome, email = '', telefone = '', aniversario = '', endereco = '', obs = '' }) {
    const { valido, erros } = this.validar({ nome, email });
    if (!valido) return { success: false, erros };

    // E-mail único
    if (email && getClientes().some(c => c.email === email)) {
      return { success: false, erros: ['Este e-mail já está cadastrado.'] };
    }

    const cliente = {
      id:          'cli_' + Math.random().toString(36).slice(2, 9),
      nome:        nome.trim(),
      email:       email.trim(),
      telefone:    telefone.trim(),
      aniversario: aniversario.trim(),
      endereco:    endereco.trim(),
      obs:         obs.trim(),
      senhaHash:   '',
      compras:     [],
      criadoEm:    new Date().toISOString(),
    };

    setClientes([...getClientes(), cliente]);
    persistir();
    emit(EVENTS.CUSTOMER_CREATED, { cliente });
    return { success: true, cliente };
  },

  // ── Atualizar cliente ─────────────────────────────────────
  atualizar(id, dados) {
    const clientes = getClientes();
    const idx      = clientes.findIndex(c => c.id === id);
    if (idx === -1) return { success: false, erros: ['Cliente não encontrado.'] };

    const { valido, erros } = this.validar({
      nome:  dados.nome  ?? clientes[idx].nome,
      email: dados.email ?? clientes[idx].email,
    });
    if (!valido) return { success: false, erros };

    const novos   = [...clientes];
    novos[idx]    = { ...novos[idx], ...dados };
    setClientes(novos);
    persistir();
    emit(EVENTS.CUSTOMER_UPDATED, { clienteId: id });
    return { success: true, cliente: novos[idx] };
  },

  // ── Excluir cliente ───────────────────────────────────────
  excluir(id) {
    setClientes(getClientes().filter(c => c.id !== id));
    persistir();
    return { success: true };
  },

  // ── Adicionar compra ao histórico ─────────────────────────
  adicionarCompra(clienteId, { data, valor, produtos }) {
    const clientes = getClientes();
    const idx      = clientes.findIndex(c => c.id === clienteId);
    if (idx === -1) return { success: false };

    const compra = {
      id:       'comp_' + Date.now().toString(36),
      data:     data || new Date().toISOString().split('T')[0],
      valor:    parseFloat(valor) || 0,
      produtos: produtos || '',
    };

    const novos = [...clientes];
    novos[idx]  = { ...novos[idx], compras: [...(novos[idx].compras || []), compra] };
    setClientes(novos);
    persistir();
    return { success: true, compra };
  },

  // ── Remover compra do histórico ───────────────────────────
  removerCompra(clienteId, compraId) {
    const clientes = getClientes();
    const idx      = clientes.findIndex(c => c.id === clienteId);
    if (idx === -1) return { success: false };

    const novos = [...clientes];
    novos[idx]  = {
      ...novos[idx],
      compras: (novos[idx].compras || []).filter(c => c.id !== compraId),
    };
    setClientes(novos);
    persistir();
    return { success: true };
  },

  // ── Total gasto por cliente ───────────────────────────────
  totalGasto(cliente) {
    return (cliente.compras || []).reduce((s, c) => s + (c.valor || 0), 0);
  },

  // ── Aniversariantes do mês ────────────────────────────────
  aniversariantesMes(mes = null) {
    const m = mes ?? (new Date().getMonth() + 1);
    return getClientes().filter(c => {
      if (!c.aniversario) return false;
      const partes = c.aniversario.split('-');
      return parseInt(partes[1]) === m;
    });
  },

  // ── Autenticar cliente (login básico por e-mail/senha hash) ──
  // Mantido como fallback — a versão Supabase Auth usa auth.js
  autenticarLegacy(email, senhaHash) {
    const cliente = getClientes().find(
      c => c.email === email && c.senhaHash === senhaHash
    );
    return cliente || null;
  },
};
