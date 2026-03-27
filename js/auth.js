/* ============================================================
   auth.js — Autenticação via Supabase Auth v3
   
   Substitui o sistema de login com senha texto puro.
   Toda autenticação passa por este módulo.
   Supabase Auth gerencia sessões, tokens e refresh automaticamente.
============================================================ */
import { getSb }                          from './db.js';
import { setStore, setSessao, clearSessao,
         setSessaoCliente, clearSessaoCliente } from './state.js';
import { emit, EVENTS }                   from './eventBus.js';

// ── Perfis de usuário (lidos da tabela user_profiles) ───────
let _currentProfile = null;
export function getCurrentProfile() { return _currentProfile; }
export function getCurrentRole()    { return _currentProfile?.role || null; }
export function isAdmin()           { return _currentProfile?.role === 'admin'; }
export function isFuncionario()     { return ['admin','funcionario'].includes(_currentProfile?.role); }

/* ── Inicializa Auth — chama ao abrir o app ─────────────────
   Restaura sessão existente se o usuário já estava logado      */
export async function initAuth() {
  const sb = getSb();

  // Listener para mudanças de sessão (token refresh, logout de outra aba, etc.)
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await _loadProfile(session.user);
    } else if (event === 'SIGNED_OUT') {
      _currentProfile = null;
      clearSessao();
      emit(EVENTS.ADMIN_LOGGED_OUT);
    } else if (event === 'TOKEN_REFRESHED') {
      // Sessão renovada automaticamente — nada a fazer
    }
  });

  // Verifica sessão existente
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    await _loadProfile(session.user);
  }
}

/* ── Login de admin/funcionário ─────────────────────────────
   Usa Supabase Auth — nenhuma senha é comparada manualmente   */
export async function loginAdmin(email, senha) {
  const sb = getSb();

  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });

  if (error) {
    emit(EVENTS.AUTH_ERROR, { message: _traduzirErro(error.message) });
    return { success: false, message: _traduzirErro(error.message) };
  }

  await _loadProfile(data.user);
  return { success: true };
}

/* ── Login de cliente (área pública) ────────────────────────
   Cliente usa o mesmo Supabase Auth com role = 'cliente'      */
export async function loginCliente(email, senha) {
  const sb = getSb();

  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });

  if (error) {
    return { success: false, message: _traduzirErro(error.message) };
  }

  // Verifica se é realmente um cliente (não admin logando como cliente)
  const profile = await _loadProfile(data.user);
  if (profile?.role !== 'cliente') {
    await sb.auth.signOut();
    return { success: false, message: 'Acesso não autorizado para clientes.' };
  }

  setSessaoCliente({ id: data.user.id, nome: profile.nome, email: data.user.email });
  emit(EVENTS.CLIENT_LOGGED_IN, { nome: profile.nome });
  return { success: true, profile };
}

/* ── Cadastro de cliente (área pública) ─────────────────────
   Cria conta no Supabase Auth + linha em user_profiles        */
export async function cadastrarCliente({ nome, email, senha, telefone = '' }) {
  const sb = getSb();

  // 1. Cria conta Auth
  const { data, error } = await sb.auth.signUp({ email, password: senha });
  if (error) {
    return { success: false, message: _traduzirErro(error.message) };
  }

  // 2. Cria perfil de cliente
  const { error: profileError } = await sb.from('user_profiles').insert({
    id:        data.user.id,
    nome,
    email,
    telefone,
    role:      'cliente',
    store_id:  null, // clientes não pertencem a uma store específica
  });

  if (profileError) {
    console.error('[auth] Erro ao criar perfil:', profileError.message);
  }

  return { success: true, user: data.user };
}

/* ── Logout ─────────────────────────────────────────────────
   Limpa sessão local e revoga token no Supabase               */
export async function logout() {
  const sb = getSb();
  await sb.auth.signOut();
  _currentProfile = null;
  clearSessao();
  clearSessaoCliente();
  emit(EVENTS.ADMIN_LOGGED_OUT);
}

export async function logoutCliente() {
  const sb = getSb();
  await sb.auth.signOut();
  clearSessaoCliente();
  emit(EVENTS.CLIENT_LOGGED_OUT);
}

/* ── Recuperação de senha ───────────────────────────────────
   Envia email de reset via Supabase Auth                      */
export async function recuperarSenha(email) {
  const sb = getSb();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    return { success: false, message: _traduzirErro(error.message) };
  }

  emit(EVENTS.PASSWORD_RESET_SENT, { email });
  return { success: true };
}

/* ── Carrega perfil do usuário autenticado ──────────────────
   Lê user_profiles e configura o contexto de store           */
async function _loadProfile(user) {
  const sb = getSb();

  const { data: profile, error } = await sb
    .from('user_profiles')
    .select('*, stores(id, slug, nome, plano)')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) {
    console.error('[auth] Perfil não encontrado:', error?.message);
    return null;
  }

  _currentProfile = profile;

  // Configura contexto de store (tenant)
  if (profile.stores) {
    setStore({
      id:   profile.stores.id,
      slug: profile.stores.slug,
      meta: { nome: profile.stores.nome, plano: profile.stores.plano },
    });
  }

  // Configura sessão legada compatível com o sistema atual
  if (profile.role !== 'cliente') {
    setSessao({
      id:     user.id,
      nome:   profile.nome,
      perfil: profile.role,
      email:  user.email,
    });
    emit(EVENTS.ADMIN_LOGGED_IN, { nome: profile.nome, role: profile.role });
  }

  return profile;
}

/* ── Tradução de erros Supabase → português ─────────────────
   Supabase retorna mensagens em inglês                        */
function _traduzirErro(msg = '') {
  const map = {
    'Invalid login credentials':        'E-mail ou senha incorretos.',
    'Email not confirmed':              'Confirme seu e-mail antes de entrar.',
    'User already registered':          'Este e-mail já está cadastrado.',
    'Password should be at least 6':    'A senha deve ter pelo menos 6 caracteres.',
    'Unable to validate email address': 'E-mail inválido.',
    'Email rate limit exceeded':        'Muitas tentativas. Tente novamente em alguns minutos.',
    'Auth session missing':             'Sessão expirada. Faça login novamente.',
  };
  for (const [en, pt] of Object.entries(map)) {
    if (msg.includes(en)) return pt;
  }
  return msg || 'Erro de autenticação. Tente novamente.';
}
