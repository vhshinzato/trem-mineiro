/* ============================================================
   config.js — Configurações centralizadas v2
   
   CREDENCIAIS: use variáveis de ambiente do Vercel.
   No Vercel Dashboard → Project → Settings → Environment Variables:
     VITE_SUPA_URL  = https://seu-projeto.supabase.co
     VITE_SUPA_KEY  = sua-anon-key
   
   Localmente: crie .env.local com as mesmas variáveis.
   Para deploy HTML puro (sem build): substitua os valores
   abaixo diretamente — nunca commit credenciais reais.
============================================================ */

// ── Supabase (substitua pelos valores reais em produção) ───
// Em produção via Vercel, defina como Environment Variables
export const SUPA_URL = typeof __SUPA_URL__ !== 'undefined'
  ? __SUPA_URL__
  : 'https://dmacyvehgczghyqfqeqe.supabase.co';

export const SUPA_KEY = typeof __SUPA_KEY__ !== 'undefined'
  ? __SUPA_KEY__
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWN5dmVoZ2N6Z2h5cWZxZXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NzA3MDksImV4cCI6MjA4OTU0NjcwOX0.UPNEBToTQ3O44Pxylap2PJgFXfyjB5FV-5I-MXoDbYg';

// ── Tenant atual (Trem Mineiro como store inicial) ──────────
// Em arquitetura multi-tenant, isso virá do login do admin.
// Por ora, fixo para o tenant único atual.
export const CURRENT_STORE_SLUG = 'trem-mineiro';

// ── Performance ────────────────────────────────────────────
export const LOADING_TIMEOUT_MS = 8000;
export const DEBOUNCE_SYNC_MS   = 800;
export const MAX_MOVIMENTOS     = 200;
export const PAGE_SIZE          = 50; // paginação futura

// ── Loja ────────────────────────────────────────────────────
export const WHATSAPP_DEFAULT   = '5531999990000';

// ── Dados padrão (fallback quando banco está vazio) ─────────
export const CATEGORIAS_PADRAO = [
  { id: 'cat1', nome: 'Cafés' },
  { id: 'cat2', nome: 'Doces de Leite' },
  { id: 'cat3', nome: 'Queijos' },
  { id: 'cat4', nome: 'Kits' },
];

export const PRODUTOS_PADRAO = [
  { id: 'p1', categoriaId: 'cat1', nome: 'Café Especial Cerrado',        descricao: 'Grãos 100% arábica do Cerrado Mineiro, torra média.',        preco: 'R$ 38,00', imagem: '' },
  { id: 'p2', categoriaId: 'cat1', nome: 'Café Torrado & Moído Premium', descricao: 'Blend exclusivo com notas de chocolate amargo e caramelo.',   preco: 'R$ 29,90', imagem: '' },
  { id: 'p3', categoriaId: 'cat1', nome: 'Café em Grãos Chapada',        descricao: 'Torra escura da Chapada Diamantina, encorpado e intenso.',    preco: 'R$ 42,00', imagem: '' },
  { id: 'p4', categoriaId: 'cat2', nome: 'Doce de Leite Cremoso',        descricao: 'Feito artesanalmente com leite integral. Pote 400g.',         preco: 'R$ 19,90', imagem: '' },
  { id: 'p5', categoriaId: 'cat2', nome: 'Doce de Leite com Canela',     descricao: 'A clássica receita mineira com toque de canela. Pote 300g.',  preco: 'R$ 17,90', imagem: '' },
  { id: 'p6', categoriaId: 'cat3', nome: 'Queijo Minas Frescal',         descricao: 'Queijo macio e levemente salgado. Artesanal.',                preco: 'R$ 22,50', imagem: '' },
  { id: 'p7', categoriaId: 'cat3', nome: 'Queijo da Canastra',           descricao: 'Patrimônio imaterial de MG. Maturado por 45 dias.',           preco: 'R$ 68,00', imagem: '' },
  { id: 'p8', categoriaId: 'cat4', nome: 'Kit Café da Manhã Mineiro',    descricao: 'Café especial + doce de leite + biscoito artesanal. Para 2.', preco: 'R$ 89,90', imagem: '' },
  { id: 'p9', categoriaId: 'cat4', nome: 'Kit Presente Gourmet',         descricao: 'Caixa presente com 2 doces + 1 queijo + 1 café.',            preco: 'R$ 149,00', imagem: '' },
];

// ATENÇÃO: senhas em texto simples apenas como fallback inicial.
// Produção usa Supabase Auth ou hash no banco.
export const USUARIOS_PADRAO = [
  { id: 'u1', nome: 'Administrador', login: 'admin',       perfil: 'admin' },
  { id: 'u2', nome: 'Funcionário',   login: 'funcionario', perfil: 'funcionario' },
];
