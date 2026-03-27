/* ============================================================
   admin-auth.js — Autenticação admin e cliente, painel, abas, mídias do hero
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
   AUTENTICAÇÃO
============================================================ */
document.getElementById('btnLoginTopo').addEventListener('click', () => {
  if (getSessao()) {
    abrirAdmin();
  } else {
    abrirModal('loginModal');
  }
});

export function fazerLogin() {
  const emailOuLogin = document.getElementById('loginUser').value.trim();
  const senha        = document.getElementById('loginPass').value;
  const alerta       = document.getElementById('loginAlert');

  // Determina se é e-mail ou login legado
  const isEmail = emailOuLogin.includes('@');

  // Tenta Supabase Auth (primário) com fallback para login legado
  let loginOk = false;
  let usuarioEncontrado = null;

  if (isEmail) {
    // Supabase Auth — e-mail/senha
    try {
      const { loginAdmin } = await import('./auth.js');
      const result = await loginAdmin(emailOuLogin, senha);
      if (result.success) {
        loginOk = true;
      } else {
        alerta.innerHTML = `<div class="alert alert-error">${result.message}</div>`;
        return;
      }
    } catch(e) {
      console.warn('[admin-auth] Supabase Auth falhou, tentando fallback:', e.message);
    }
  }

  if (!loginOk) {
    // Fallback: login legado por login/senha para compatibilidade
    usuarioEncontrado = getUsuariosOuPadrao().find(u => u.login === emailOuLogin && u.senha === senha /* legado: migrar para Supabase Auth via auth.js */);
  }

  const usuario = usuarioEncontrado;
  if (!usuario) {
    alerta.innerHTML = `<div class="alert alert-error">Login ou senha inválidos.</div>`;
    return;
  }

  setSessao({ id: usuario.id, nome: usuario.nome, perfil: usuario.perfil });
  salvarDados('sm_sessao', getSessao());
  alerta.innerHTML = '';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  fecharModal('loginModal');
  abrirAdmin();
}

export function fazerLogout() {
  clearSessao();
  localStorage.removeItem('sm_sessao');
  fecharAdmin();
  mostrarToast('Sessão encerrada.', 'success');
}





/* ============================================================
   admin.js — Painel administrativo completo
   Trem Mineiro
============================================================ */
import { categorias, produtos, usuarios, fornecedores, clientes, pedidos,
         getEstoque(), movimentos, config, getSessao(), getSessaoCliente(), isAdminCarregado(),
         setCategorias, setProdutos, setUsuarios, setFornecedores, setClientes,
         setPedidos, setEstoque, setMovimentos, setConfig, setSessao, setSessaoCliente,
         getUsuariosComFallback } from './state.js';
import { persistir, carregarDadosAdmin, salvarManualSupabase } from './db.js';
import { mostrarToast, renderCardapio, renderCatNav, atualizarWhatsapp, aplicarLogo } from './ui.js';



/* ============================================================
   GERENCIADOR DE MÍDIA DO HERO
============================================================ */

function renderHeroMediaLista() {
  const wrap = document.getElementById('heroMediaLista');
  if (!wrap) return;
  const lista = getConfig().heroMedia || [];

  if (lista.length === 0) {
    wrap.innerHTML = `<div style="text-align:center;color:var(--cinza);font-size:.85rem;padding:1.5rem;">Nenhuma mídia adicionada ainda.</div>`;
    return;
  }

  wrap.innerHTML = `<div class="hero-media-grid" id="heroMediaGrid"></div>`;
  const grid = document.getElementById('heroMediaGrid');

  lista.forEach((m, i) => {
    const div = document.createElement('div');
    div.className = 'hero-media-item';

    const thumb = m.tipo === 'video'
      ? `<div class="hero-media-thumb-video">🎬</div>`
      : `<img class="hero-media-thumb" src="${m.src}" onerror="this.style.opacity='.3'" />`;

    div.innerHTML = `
      <span class="hero-media-ordem">${i + 1}</span>
      <span class="hero-media-tipo">${m.tipo === 'video' ? '🎬 vídeo' : '🖼️ img'}</span>
      ${thumb}
      <div class="hero-media-label">${m.titulo || ('Mídia ' + (i + 1))}</div>
      <div class="hero-media-actions">
        ${i > 0
          ? `<button class="hero-media-btn mover" onclick="moverHeroMedia(${i},-1)" title="Mover para esquerda">◀</button>`
          : ''}
        ${i < lista.length - 1
          ? `<button class="hero-media-btn mover" onclick="moverHeroMedia(${i},1)" title="Mover para direita">▶</button>`
          : ''}
        <button class="hero-media-btn" onclick="removerHeroMedia('${m.id}')" title="Remover">✕</button>
      </div>
    `;
    grid.appendChild(div);
  });
}

function adicionarHeroImagem(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { mostrarToast('Máximo 5 MB!', 'error'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const item = {
      id:    gerarId(),
      tipo:  'imagem',
      src:   e.target.result,
      titulo: file.name.replace(/\.[^.]+$/, '')
    };
    getConfig().heroMedia.push(item);
    persistir();
    input.value = '';
    renderHeroMediaLista();
    iniciarCarrosselHero();
    mostrarToast('Imagem adicionada! ✓', 'success');
  };
  reader.readAsDataURL(file);
}

function adicionarHeroUrl() {
  const url    = document.getElementById('heroUrlInput').value.trim();
  const titulo = document.getElementById('heroUrlTitulo').value.trim();
  if (!url) { mostrarToast('Informe uma URL.', 'error'); return; }

  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  const item = { id: gerarId(), tipo: isVideo ? 'video' : 'imagem', src: url, titulo: titulo || url.split('/').pop() };
  getConfig().heroMedia.push(item);
  persistir();
  document.getElementById('heroUrlInput').value  = '';
  document.getElementById('heroUrlTitulo').value = '';
  renderHeroMediaLista();
  iniciarCarrosselHero();
  mostrarToast((isVideo ? 'Vídeo' : 'Imagem') + ' adicionado! ✓', 'success');
}

function removerHeroMedia(mediaId) {
  getConfig().heroMedia = getConfig().heroMedia.filter(m => m.id !== mediaId);
  persistir();
  renderHeroMediaLista();
  iniciarCarrosselHero();
  mostrarToast('Mídia removida.', 'success');
}

function moverHeroMedia(idx, dir) {
  const lista = getConfig().heroMedia;
  const novoIdx = idx + dir;
  if (novoIdx < 0 || novoIdx >= lista.length) return;
  [lista[idx], lista[novoIdx]] = [lista[novoIdx], lista[idx]];
  persistir();
  renderHeroMediaLista();
  iniciarCarrosselHero();
}
