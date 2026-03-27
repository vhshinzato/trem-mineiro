/* ============================================================
   admin-users.js — Usuários, WhatsApp, configurações e autenticação de clientes
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
   GERENCIAMENTO DE USUÁRIOS (somente admin)
============================================================ */
function renderTabelaUsuarios() {
  const tbody = document.getElementById('userTableBody');
  tbody.innerHTML = '';

  getUsuarios().forEach((u, i) => {
    const isSelf = getSessao() && getSessao().id === u.id;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${escapeHtml(u.nome)}</strong> ${isSelf ? '<em style="color:var(--ouro);font-size:.75rem;">(você)</em>' : ''}</td>
      <td>${escapeHtml(u.login)}</td>
      <td><span class="badge-role ${u.perfil === 'admin' ? 'badge-admin' : 'badge-func'}" style="font-size:.7rem;padding:.2rem .6rem;">${u.perfil === 'admin' ? 'Admin' : 'Funcionário'}</span></td>
      <td>
        <div class="actions-cell">
          <button class="btn btn-outline btn-sm" onclick="abrirModalUsuario('${u.id}')">✏️ Editar</button>
          ${!isSelf ? `<button class="btn btn-danger btn-sm" onclick="confirmarExcluirUsuario('${u.id}')">🗑️</button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

export function abrirModalUsuario(userId) {
  ['userNome','userLogin','userSenha'].forEach(id => {
    document.getElementById(id).value = '';
    document.getElementById(id).classList.remove('error');
  });
  ['userNomeErr','userLoginErr','userSenhaErr'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  document.getElementById('userEditId').value = '';
  document.getElementById('userPerfil').value = 'funcionario';
  document.getElementById('userAlert').innerHTML = '';

  if (userId) {
    const u = getUsuarios().find(x => x.id === userId);
    if (!u) return;
    document.getElementById('modalUserTitulo').textContent = 'Editar Usuário';
    document.getElementById('userEditId').value = u.id;
    document.getElementById('userNome').value   = u.nome;
    document.getElementById('userLogin').value  = u.login;
    document.getElementById('userSenha').value  = u.senha;
    document.getElementById('userPerfil').value = u.perfil;
  } else {
    document.getElementById('modalUserTitulo').textContent = 'Novo Usuário';
  }
  abrirModal('modalUsuario');
}

export function salvarUsuario() {
  const nome   = document.getElementById('userNome').value.trim();
  const login  = document.getElementById('userLogin').value.trim();
  const senha  = document.getElementById('userSenha').value;
  const perfil = document.getElementById('userPerfil').value;
  const editId = document.getElementById('userEditId').value;

  let valido = true;
  const campos = { userNomeErr: !nome, userLoginErr: !login, userSenhaErr: !senha };
  Object.keys(campos).forEach(k => {
    const fId = k.replace('Err','');
    document.getElementById(k).textContent = campos[k] ? 'Campo obrigatório.' : '';
    document.getElementById(fId).classList.toggle('error', campos[k]);
    if (campos[k]) valido = false;
  });
  if (!valido) return;

  // Verifica login duplicado
  const dupLogin = getUsuarios().find(u => u.login === login && u.id !== editId);
  if (dupLogin) {
    document.getElementById('userLoginErr').textContent = 'Login já está em uso.';
    document.getElementById('userLogin').classList.add('error');
    return;
  }

  if (editId) {
    const idx = getUsuarios().findIndex(u => u.id === editId);
    if (idx > -1) usuarios[idx] = { ...usuarios[idx], nome, login, senha, perfil };
    mostrarToast('Usuário atualizado!', 'success');
  } else {
    getUsuarios().push({ id: gerarId(), nome, login, senha, perfil });
    mostrarToast('Usuário criado!', 'success');
  }
  persistir();
  fecharModal('modalUsuario');
  renderTabelaUsuarios();
}

export function confirmarExcluirUsuario(userId) {
  const u = getUsuarios().find(x => x.id === userId);
  if (!u) return;
  document.getElementById('confirmTitulo').textContent = 'Excluir Usuário';
  document.getElementById('confirmMsg').innerHTML = `Deseja excluir o usuário <strong>"${escapeHtml(u.nome)}"</strong>?`;
  document.getElementById('confirmOkBtn').onclick = () => excluirUsuario(userId);
  abrirModal('confirmModal');
}

export function excluirUsuario(userId) {
  usuarios = getUsuarios().filter(u => u.id !== userId);
  persistir();
  fecharModal('confirmModal');
  renderTabelaUsuarios();
  mostrarToast('Usuário excluído.', 'success');
}





/* ============================================================
   WHATSAPP
============================================================ */
export function salvarWhatsapp() {
  const num = document.getElementById('inputWhatsapp').value.trim();
  if (!num) { mostrarToast('Informe o número!', 'error'); return; }
  getConfig().whatsapp = num;
  persistir();
  atualizarWhatsapp();
  mostrarToast('Número salvo!', 'success');
}





/* ============================================================
   AUTENTICAÇÃO DE CLIENTES (ÁREA PÚBLICA)
============================================================ */

// ── Botão no header ──────────────────────────────────────────
function atualizarBotaoCliente() {
  const btn = document.getElementById('btnClienteArea');
  if (!btn) return;
  if (getSessaoCliente()) {
    const primeiroNome = getSessaoCliente().nome.split(' ')[0];
    btn.textContent = '👤 ' + primeiroNome;
    btn.classList.add('logado');
  } else {
    btn.textContent = '👤 Entrar';
    btn.classList.remove('logado');
  }
}

function toggleClienteDropdown() {
  if (!getSessaoCliente()) {
    abrirModalClienteAuth();
    return;
  }
  const dd = document.getElementById('clienteDropdown');
  const open = dd.classList.toggle('open');
  // Fecha ao clicar fora
  if (open) {
    setTimeout(() => {
      document.addEventListener('click', fecharDropdownFora, { once: true });
    }, 10);
  }
}
function fecharDropdownFora(e) {
  const dd  = document.getElementById('clienteDropdown');
  const btn = document.getElementById('btnClienteArea');
  if (!dd.contains(e.target) && e.target !== btn) {
    dd.classList.remove('open');
  }
}

// ── Abrir modal de auth ──────────────────────────────────────
export function abrirModalClienteAuth() {
  trocarAuthTab('login');
  // Limpa campos
  ['authLoginEmail','authLoginSenha','authCadNome','authCadEmail','authCadSenha',
   'authCadTel','authCadAniv','authCadEnd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('error'); }
  });
  ['authLoginEmailErr','authLoginSenhaErr','authCadNomeErr','authCadEmailErr','authCadSenhaErr'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });
  document.getElementById('authLoginAlert').innerHTML = '';
  document.getElementById('authCadAlert').innerHTML   = '';
  abrirModal('modalClienteAuth');
}

function trocarAuthTab(aba) {
  document.getElementById('painelAuthLogin').style.display    = aba === 'login'    ? '' : 'none';
  document.getElementById('painelAuthCadastro').style.display = aba === 'cadastro' ? '' : 'none';
  document.getElementById('tabAuthLogin').classList.toggle('active', aba === 'login');
  document.getElementById('tabAuthCad').classList.toggle('active',   aba === 'cadastro');
}

// ── Login do cliente ─────────────────────────────────────────
export function fazerLoginCliente() {
  const email = document.getElementById('authLoginEmail').value.trim().toLowerCase();
  const senha = document.getElementById('authLoginSenha').value;
  let valido  = true;

  document.getElementById('authLoginEmailErr').textContent = '';
  document.getElementById('authLoginSenhaErr').textContent = '';
  document.getElementById('authLoginAlert').innerHTML      = '';

  if (!email) { document.getElementById('authLoginEmailErr').textContent = 'Informe o e-mail.'; valido = false; }
  if (!senha)  { document.getElementById('authLoginSenhaErr').textContent = 'Informe a senha.'; valido = false; }
  if (!valido) return;

  const cliente = getClientes().find(c => (c.email || '').toLowerCase() === email && c.senhaHash === senha);
  if (!cliente) {
    document.getElementById('authLoginAlert').innerHTML =
      `<div class="alert alert-error">E-mail ou senha incorretos.</div>`;
    return;
  }

  sessaoCliente = { id: cliente.id, nome: cliente.nome, email: cliente.email };
  salvarDados('sm_sessao_cliente', getSessaoCliente());
  fecharModal('modalClienteAuth');
  atualizarBotaoCliente();
  if (getCarrinho().length > 0) renderCarrinho(); // atualiza botão do drawer

  // Atualiza dropdown
  document.getElementById('dropdownNome').textContent = cliente.nome;
  document.getElementById('dropdownSub').textContent  = cliente.email;
  mostrarToast(`Bem-vindo(a), ${cliente.nome.split(' ')[0]}! 👋`, 'success');
}

// ── Cadastro do cliente ──────────────────────────────────────
function cadastrarCliente() {
  const nome  = document.getElementById('authCadNome').value.trim();
  const email = document.getElementById('authCadEmail').value.trim().toLowerCase();
  const senha = document.getElementById('authCadSenha').value;
  const tel   = document.getElementById('authCadTel').value.trim();
  const aniv  = document.getElementById('authCadAniv').value;
  const end   = document.getElementById('authCadEnd').value.trim();
  let valido  = true;

  ['authCadNomeErr','authCadEmailErr','authCadSenhaErr'].forEach(id =>
    document.getElementById(id).textContent = '');
  document.getElementById('authCadAlert').innerHTML = '';

  if (!nome)         { document.getElementById('authCadNomeErr').textContent  = 'Nome obrigatório.'; valido = false; }
  if (!email)        { document.getElementById('authCadEmailErr').textContent = 'E-mail obrigatório.'; valido = false; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('authCadEmailErr').textContent = 'E-mail inválido.'; valido = false;
  }
  if (!senha || senha.length < 6) {
    document.getElementById('authCadSenhaErr').textContent = 'Senha deve ter pelo menos 6 caracteres.'; valido = false;
  }
  if (!valido) return;

  // Verifica duplicidade de e-mail
  if (getClientes().find(c => (c.email || '').toLowerCase() === email)) {
    document.getElementById('authCadEmailErr').textContent = 'Este e-mail já está cadastrado.';
    return;
  }

  const novo = {
    id: gerarId(), nome, email, senhaHash: senha,
    telefone: tel, aniversario: aniv, endereco: end,
    obs: '', compras: []
  };
  getClientes().push(novo);
  persistir();

  // Faz login automático
  sessaoCliente = { id: novo.id, nome: novo.nome, email: novo.email };
  salvarDados('sm_sessao_cliente', getSessaoCliente());

  fecharModal('modalClienteAuth');
  atualizarBotaoCliente();
  if (getCarrinho().length > 0) renderCarrinho(); // atualiza botão do drawer
  document.getElementById('dropdownNome').textContent = novo.nome;
  document.getElementById('dropdownSub').textContent  = novo.email;
  mostrarToast(`Conta criada! Bem-vindo(a), ${novo.nome.split(' ')[0]}! 🎉`, 'success');
}

// ── Logout do cliente ────────────────────────────────────────
function logoutCliente() {
  clearSessaoCliente();
  localStorage.removeItem('sm_sessao_cliente');
  document.getElementById('clienteDropdown').classList.remove('open');
  atualizarBotaoCliente();
  mostrarToast('Sessão encerrada.', 'success');
}

// ── Meus dados ───────────────────────────────────────────────
function abrirMeusDados() {
  document.getElementById('clienteDropdown').classList.remove('open');
  if (!getSessaoCliente()) return;
  const c = getClientes().find(x => x.id === getSessaoCliente().id);
  if (!c) return;

  document.getElementById('mdNome').value  = c.nome        || '';
  document.getElementById('mdTel').value   = c.telefone    || '';
  document.getElementById('mdAniv').value  = c.aniversario || '';
  document.getElementById('mdEnd').value   = c.endereco    || '';
  document.getElementById('mdSenha').value = '';
  document.getElementById('mdNomeErr').textContent   = '';
  document.getElementById('meusDadosAlert').innerHTML = '';
  abrirModal('modalMeusDados');
}

function salvarMeusDados() {
  if (!getSessaoCliente()) return;
  const nome  = document.getElementById('mdNome').value.trim();
  const tel   = document.getElementById('mdTel').value.trim();
  const aniv  = document.getElementById('mdAniv').value;
  const end   = document.getElementById('mdEnd').value.trim();
  const senha = document.getElementById('mdSenha').value;

  document.getElementById('mdNomeErr').textContent = '';
  if (!nome) { document.getElementById('mdNomeErr').textContent = 'Nome obrigatório.'; return; }

  const idx = getClientes().findIndex(c => c.id === getSessaoCliente().id);
  if (idx === -1) return;

  clientes[idx].nome        = nome;
  clientes[idx].telefone    = tel;
  clientes[idx].aniversario = aniv;
  clientes[idx].endereco    = end;
  if (senha && senha.length >= 6) clientes[idx].senhaHash = senha;

  getSessaoCliente().nome = nome;
  salvarDados('sm_sessao_cliente', getSessaoCliente());

  persistir();
  fecharModal('modalMeusDados');
  atualizarBotaoCliente();
  document.getElementById('dropdownNome').textContent = nome;
  mostrarToast('Dados atualizados! ✓', 'success');
}
