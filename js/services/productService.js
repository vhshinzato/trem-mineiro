/* ============================================================
   services/productService.js — Regras de negócio de produtos
   
   Centraliza: validações, criação, edição, exclusão,
   e lógica de filtragem de produtos e categorias.
============================================================ */
import { getCategorias, getProdutos, getEstoque,
         setCategorias, setProdutos, setEstoque } from '../state.js';
import { persistir }                              from '../db.js';
import { emit, EVENTS }                           from '../eventBus.js';

export const productService = {

  // ── Validar produto ───────────────────────────────────────
  validarProduto({ nome, preco, categoriaId }) {
    const erros = [];
    if (!nome || nome.trim().length < 2)   erros.push('Nome deve ter pelo menos 2 caracteres.');
    if (!preco || preco.trim() === '')      erros.push('Preço é obrigatório.');
    if (!categoriaId)                       erros.push('Categoria é obrigatória.');
    return { valido: erros.length === 0, erros };
  },

  // ── Criar produto ─────────────────────────────────────────
  criarProduto({ nome, descricao = '', preco, categoriaId, imagem = '' }) {
    const { valido, erros } = this.validarProduto({ nome, preco, categoriaId });
    if (!valido) return { success: false, erros };

    const produto = {
      id:         'prod_' + Math.random().toString(36).slice(2, 9),
      nome:       nome.trim(),
      descricao:  descricao.trim(),
      preco:      preco.trim(),
      categoriaId,
      imagem,
    };

    setProdutos([...getProdutos(), produto]);

    // Inicializa estoque para o novo produto
    const estoque = getEstoque();
    if (!estoque[produto.id]) {
      setEstoque({ ...estoque, [produto.id]: { quantidade: 0, minimo: 0, maximo: 100 } });
    }

    persistir();
    emit(EVENTS.PRODUCT_CREATED, { produto });
    return { success: true, produto };
  },

  // ── Atualizar produto ─────────────────────────────────────
  atualizarProduto(id, dados) {
    const produtos = getProdutos();
    const idx      = produtos.findIndex(p => p.id === id);
    if (idx === -1) return { success: false, erros: ['Produto não encontrado.'] };

    const { valido, erros } = this.validarProduto({
      nome:       dados.nome       ?? produtos[idx].nome,
      preco:      dados.preco      ?? produtos[idx].preco,
      categoriaId: dados.categoriaId ?? produtos[idx].categoriaId,
    });
    if (!valido) return { success: false, erros };

    const novos  = [...produtos];
    novos[idx]   = { ...novos[idx], ...dados };
    setProdutos(novos);
    persistir();

    emit(EVENTS.PRODUCT_UPDATED, { produto: novos[idx] });
    return { success: true, produto: novos[idx] };
  },

  // ── Excluir produto ───────────────────────────────────────
  excluirProduto(id) {
    setProdutos(getProdutos().filter(p => p.id !== id));
    // Remove do estoque também
    const estoque = getEstoque();
    const novoEst = { ...estoque };
    delete novoEst[id];
    setEstoque(novoEst);
    persistir();

    emit(EVENTS.PRODUCT_DELETED, { produtoId: id });
    return { success: true };
  },

  // ── Filtrar produtos (busca pública) ──────────────────────
  filtrar(produtos = [], { texto = '', categoriaId = null } = {}) {
    const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const q    = norm(texto);
    return produtos.filter(p => {
      const matchCat  = !categoriaId || p.categoriaId === categoriaId;
      const matchText = !q || norm(p.nome).includes(q) || norm(p.descricao || '').includes(q);
      return matchCat && matchText;
    });
  },

  // ── Validar categoria ─────────────────────────────────────
  validarCategoria({ nome }) {
    const erros = [];
    if (!nome || nome.trim().length < 2) erros.push('Nome deve ter pelo menos 2 caracteres.');
    return { valido: erros.length === 0, erros };
  },

  criarCategoria({ nome }) {
    const { valido, erros } = this.validarCategoria({ nome });
    if (!valido) return { success: false, erros };

    const cat = { id: 'cat_' + Math.random().toString(36).slice(2, 7), nome: nome.trim() };
    setCategorias([...getCategorias(), cat]);
    persistir();
    return { success: true, categoria: cat };
  },

  atualizarCategoria(id, { nome }) {
    const cats = getCategorias();
    const idx  = cats.findIndex(c => c.id === id);
    if (idx === -1) return { success: false, erros: ['Categoria não encontrada.'] };
    const novas = [...cats];
    novas[idx]  = { ...novas[idx], nome: nome.trim() };
    setCategorias(novas);
    persistir();
    return { success: true };
  },

  excluirCategoria(id) {
    // Verifica se há produtos usando a categoria
    const temProdutos = getProdutos().some(p => p.categoriaId === id);
    if (temProdutos) {
      return { success: false, erros: ['Existem produtos nesta categoria. Mova-os antes de excluir.'] };
    }
    setCategorias(getCategorias().filter(c => c.id !== id));
    persistir();
    return { success: true };
  },
};
