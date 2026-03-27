/* ============================================================
   reports.js v2 — imports explícitos, zero globals implícitos
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
   reports.js — Relatórios, gráficos e KPIs
   Trem Mineiro
============================================================ */

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
  const comprasNoPeriodo = getClientes().flatMap(c =>
    filtrarPorPeriodo(c.compras || [], 'data')
  );
  const receitaTotal  = comprasNoPeriodo.reduce((s, x) => s + (x.valor || 0), 0);
  const ticketMedio   = comprasNoPeriodo.length ? receitaTotal / comprasNoPeriodo.length : 0;
  const totalClientes = getClientes().length;
  const totalProdutos = getProdutos().length;

  const entradasNoPeriodo = filtrarPorPeriodo(
    getMovimentos().filter(m => m.tipo === 'entrada'), 'data'
  );
  const custoEntradas = entradasNoPeriodo.reduce((s, m) => {
    const vu = m.valorUnit || 0;
    return s + vu * m.quantidade;
  }, 0);

  const estoqueAlerta = getProdutos().filter(p =>
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
      <div class="rel-kpi-sub">${getFornecedores().length} fornecedor${getFornecedores().length!==1?'es':''}</div>
    </div>
    <div class="rel-kpi">
      <div class="rel-kpi-label">Produtos no catálogo</div>
      <div class="rel-kpi-valor">${totalProdutos}</div>
      <div class="rel-kpi-sub">${getCategorias().length} categoria${getCategorias().length!==1?'s':''}</div>
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

  // ── Agrupa receita (compras dos clientes) ────────────────────
  const gruposVal = {};
  filtrarPorPeriodo(getClientes().flatMap(c => c.compras || []), 'data').forEach(x => {
    const k = chaveDeData(x.data); if (!k) return;
    gruposVal[k] = (gruposVal[k] || 0) + (x.valor || 0);
  });

  // ── Agrupa quantidade (pedidos confirmados) ──────────────────
  const gruposQtd = {};
  filtrarPorPeriodo(
    getPedidos().filter(p => p.status === 'confirmado'),
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


// ── Gráfico de rosca: status de estoque ─────────────────────
function renderChartEstoque() {
  const canvas = document.getElementById('chartEstoque');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const contagem = { ok: 0, baixo: 0, zero: 0, excesso: 0 };
  getProdutos().forEach(p => { const s = statusEstoque(p.id); contagem[s] = (contagem[s]||0) + 1; });
  const total = getProdutos().length || 1;

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
  ctx.fillText('produtos', cx, cy + 16);

  // Legenda
  const leg = document.getElementById('legendEstoque');
  leg.innerHTML = fatias.map(f => `
    <div class="rel-legend-item">
      <div class="rel-legend-dot" style="background:${f.cor};"></div>
      ${f.label}
      <span class="rel-legend-pct">${f.valor} (${Math.round(f.valor/total*100)}%)</span>
    </div>`).join('');
}

// ── Top produtos ─────────────────────────────────────────────
function renderTopProdutos() {
  const wrap = document.getElementById('relTopProdutos');
  // Conta quantas vezes cada produto aparece nas compras filtradas (por nome)
  const comprasFilt = getClientes().flatMap(c => filtrarPorPeriodo(c.compras || [], 'data'));
  const contagem = {};
  comprasFilt.forEach(x => {
    if (!x.produtos) return;
    // Tenta casar pelo nome de algum produto cadastrado
    getProdutos().forEach(p => {
      if (x.getProdutos().toLowerCase().includes(p.nome.toLowerCase())) {
        contagem[p.id] = (contagem[p.id]||0) + 1;
      }
    });
  });

  // Fallback: usa movimentos de saída
  filtrarPorPeriodo(getMovimentos().filter(m => m.tipo === 'saida'), 'data').forEach(m => {
    contagem[m.produtoId] = (contagem[m.produtoId]||0) + m.quantidade;
  });

  const ranking = produtos
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

// ── Top clientes ─────────────────────────────────────────────
function renderTopClientes() {
  const wrap = document.getElementById('relTopClientes');
  const ranking = getClientes().map(c => {
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

// ── Últimas entradas de estoque ──────────────────────────────
function renderEntradasEstoque() {
  const wrap = document.getElementById('relEntradasEstoque');
  const entradas = filtrarPorPeriodo(getMovimentos().filter(m => m.tipo === 'entrada'), 'data')
    .slice(0, 8);
  if (entradas.length === 0) {
    wrap.innerHTML = `<div style="color:var(--cinza);font-size:.85rem;text-align:center;padding:1rem;">Nenhuma entrada no período.</div>`;
    return;
  }
  wrap.innerHTML = `<table class="rel-table">
    <thead><tr><th>Produto</th><th>Qtd</th><th>Fornecedor</th><th>Data</th></tr></thead>
    <tbody>` +
    entradas.map(m => {
      const prod = getProdutos().find(p => p.id === m.produtoId);
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
  const lista = clientes
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
  const entradas = filtrarPorPeriodo(getMovimentos().filter(m => m.tipo === 'entrada' && m.fornecedor), 'data');
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