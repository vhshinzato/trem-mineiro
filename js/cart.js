/* ============================================================
   cart.js v2 — imports explícitos, zero globals implícitos
============================================================ */
import {
  getCategorias, getProdutos, getConfig, getUsuarios,
  getClientes, getPedidos, getEstoque, getMovimentos, getFornecedores,
  getSessao, getSessaoCliente, getCarrinho,
  setCategorias, setProdutos, setConfig, setClientes, setPedidos,
  setCarrinho, setSessaoCliente, clearSessaoCliente,
  getProdutoById, getCategoriaById, getCategoriasOuPadrao, getProdutosOuPadrao
} from './state.js';
import { persistir, getSb, uploadImagem } from './db.js';


/* ============================================================
   cart.js — Carrinho de compras e finalização de pedido
   Trem Mineiro
============================================================ */
import { produtos, carrinho, getEstoque(), config, getSessaoCliente(), clientes, pedidos,
         setCarrinho, setPedidos, setClientes } from './state.js';

/* ============================================================
   CARRINHO DE COMPRAS
============================================================ */

let carrinho = []; // [{ id, nome, preco, precoNum, imagem, quantidade }]
let _detalheId  = null; // produto aberto no modal de detalhe
let _detalheQtd = 1;    // quantidade selecionada no modal

// ── Abre modal de detalhe ────────────────────────────────────
function abrirDetalhe(prodId) {
  const p   = getProdutos().find(x => x.id === prodId);
  if (!p) return;
  const cat = getCategorias().find(c => c.id === p.categoriaId);
  const est = getEstoque()[prodId] || { quantidade: 0 };

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

  // Disponível = estoque total − já no carrinho
  const noCarrinho = ((getCarrinho().find(function(c){return c.id===prodId}) ? getCarrinho().find(function(c){return c.id===prodId}).quantidade : undefined) || 0);
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
  const est        = getEstoque()[_detalheId] || { quantidade: 0 };
  var _cd = getCarrinho().find(function(c){return c.id===_detalheId}); var noCarrinho = (_cd ? _cd.quantidade : 0);
  const disponivel = Math.max(0, est.quantidade - noCarrinho);
  _detalheQtd = Math.min(disponivel, Math.max(1, _detalheQtd + delta));
  document.getElementById('detalheQtdNum').textContent = _detalheQtd;
  if (delta > 0 && _detalheQtd >= disponivel) {
    mostrarToast(`Máximo disponível: ${disponivel} un.`, 'error');
  }
}

// ── Adicionar ao carrinho ────────────────────────────────────
function addAoCarrinho() {
  const p = getProdutos().find(x => x.id === _detalheId);
  if (!p) return;

  const est        = getEstoque()[_detalheId] || { quantidade: 0 };
  const existente  = getCarrinho().find(c => c.id === _detalheId);
  var noCarrinho = (existente ? existente.quantidade : 0);
  const disponivel = Math.max(0, est.quantidade - noCarrinho);

  if (_detalheQtd > disponivel) {
    mostrarToast(`Apenas ${disponivel} unidade${disponivel!==1?'s':''} disponível${disponivel!==1?'is':''}.`, 'error');
    return;
  }

  if (existente) {
    existente.quantidade += _detalheQtd;
  } else {
    getCarrinho().push({
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
  const total = getCarrinho().reduce((s, c) => s + c.quantidade, 0);
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

  if (getCarrinho().length === 0) {
    wrap.innerHTML = `
      <div class="carrinho-vazio">
        <div class="carrinho-vazio-icon">🛒</div>
        <p>Seu carrinho está vazio.</p>
        <p style="font-size:.82rem;color:var(--cinza)">Clique em um produto para adicionar.</p>
      </div>`;
    foot.style.display = 'none';
    return;
  }

  getCarrinho().forEach(item => {
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
  const totalNum = getCarrinho().reduce((s, c) => s + c.precoNum * c.quantidade, 0);
  document.getElementById('carrinhoTotal').textContent =
    totalNum.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

  // Botão dinâmico: logado = verde WA / não logado = pede login
  const waSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.554 4.122 1.523 5.855L0 24l6.29-1.494A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.797 9.797 0 01-5.003-1.37l-.36-.214-3.734.887.93-3.624-.235-.373A9.788 9.788 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>`;
  const btnWrap = document.getElementById('carrinhoBtnWrap');
  if (getSessaoCliente()) {
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

// ── Alterar quantidade no carrinho ───────────────────────────
function carrinhoAlterarQtd(prodId, delta) {
  const item = getCarrinho().find(c => c.id === prodId);
  if (!item) return;

  if (delta > 0) {
    const est        = getEstoque()[prodId] || { quantidade: 0 };
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
  carrinho = getCarrinho().filter(c => c.id !== prodId);
  atualizarBadge();
  renderCarrinho();
  if (getCarrinho().length === 0) mostrarToast('Carrinho vazio.', 'success');
}

function limparCarrinho() {
  carrinho = [];
  atualizarBadge();
  renderCarrinho();
}

// ── Finalizar pedido via WhatsApp ────────────────────────────
function finalizarPedido() {
  if (getCarrinho().length === 0) return;

  // Guarda obrigatório: precisa estar logado
  if (!getSessaoCliente()) {
    pedirLoginParaPedido();
    return;
  }

  const num   = getConfig().whatsapp || WHATSAPP_DEFAULT;
  const total = getCarrinho().reduce((s, c) => s + c.precoNum * c.quantidade, 0);

  // Salva o pedido como pendente
  const novoPedido = {
    id:        gerarId(),
    numero:    'PED-' + String(getPedidos().length + 1).padStart(4, '0'),
    data:      new Date().toISOString(),
    status:    'pendente',
    clienteId: getSessaoCliente().id,
    clienteNome: getSessaoCliente().nome,
    itens:     getCarrinho().map(c => ({
      id: c.id, nome: c.nome, preco: c.preco,
      precoNum: c.precoNum, quantidade: c.quantidade
    })),
    total
  };
  getPedidos().unshift(novoPedido);
  persistir();

  // Monta e envia a mensagem no WhatsApp
  let msg = `🛒 *Pedido ${novoPedido.numero} — Trem Mineiro*\n\n`;
  getCarrinho().forEach(item => {
    const sub = (item.precoNum * item.quantidade).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
    msg += `• ${item.quantidade}× *${item.nome}* — ${sub}\n`;
  });
  msg += `\n💰 *Total estimado: ${total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}*`;
  msg += `\n👤 *Cliente: ${getSessaoCliente().nome}*`;

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