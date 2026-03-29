/* js/config.js — Configurações do Trem Mineiro */
export { SUPA_URL, SUPA_KEY } from './env.js';

/* ============================================================
   CONFIGURAÇÃO EDITÁVEL
============================================================ */
// Número WhatsApp padrão — formato internacional sem +
export const WHATSAPP_DEFAULT = '5531999990000';

/* ============================================================
   DADOS INICIAIS (mock)
============================================================ */
export const CATEGORIAS_PADRAO = [
  { id: 'cat1', nome: 'Cafés' },
  { id: 'cat2', nome: 'Doces de Leite' },
  { id: 'cat3', nome: 'Queijos' },
  { id: 'cat4', nome: 'Kits' },
];

export const PRODUTOS_PADRAO = [
  // Cafés
  { id: 'p1', categoriaId: 'cat1', nome: 'Café Especial Cerrado', descricao: 'Grãos 100% arábica do Cerrado Mineiro, torra média, notas de caramelo e frutas vermelhas.', preco: 'R$ 38,00', imagem: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&q=80' },
  { id: 'p2', categoriaId: 'cat1', nome: 'Café Torrado & Moído Premium', descricao: 'Blend exclusivo de fazendas da Serra da Mantiqueira. Aroma intenso, sabor aveludado.', preco: 'R$ 29,90', imagem: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&q=80' },
  { id: 'p3', categoriaId: 'cat1', nome: 'Café em Grãos Chapada', descricao: 'Torra escura da Chapada Gaúcha, ideal para espresso cremoso e encorpado.', preco: 'R$ 45,00', imagem: 'https://images.unsplash.com/photo-1606791422814-b32c705e3e2f?w=400&q=80' },
  // Doces de leite
  { id: 'p4', categoriaId: 'cat2', nome: 'Doce de Leite Cremoso', descricao: 'Feito artesanalmente com leite integral de vacas criadas no campo. Pote 400g.', preco: 'R$ 19,90', imagem: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&q=80' },
  { id: 'p5', categoriaId: 'cat2', nome: 'Doce de Leite com Canela', descricao: 'A clássica receita mineira com toque especial de canela da terra. Pote 300g.', preco: 'R$ 17,90', imagem: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&q=80' },
  // Queijos
  { id: 'p6', categoriaId: 'cat3', nome: 'Queijo Minas Frescal', descricao: 'Queijo macio e levemente salgado, produzido artesanalmente com leite cru pasteurizado.', preco: 'R$ 22,50', imagem: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a318?w=400&q=80' },
  { id: 'p7', categoriaId: 'cat3', nome: 'Queijo da Canastra', descricao: 'Patrimônio imaterial de Minas, maturado por 45 dias. Sabor marcante e textura firme.', preco: 'R$ 68,00', imagem: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400&q=80' },
  // Kits
  { id: 'p8', categoriaId: 'cat4', nome: 'Kit Café da Manhã Mineiro', descricao: 'Café especial + doce de leite cremoso + queijo frescal + biscoitinhos de polvilho. Para 2 pessoas.', preco: 'R$ 89,90', imagem: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80' },
  { id: 'p9', categoriaId: 'cat4', nome: 'Kit Presente Gourmet', descricao: 'Caixa presente com 2 doces de leite, 1 queijo da canastra, 1 café especial e embalagem exclusiva.', preco: 'R$ 149,00', imagem: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&q=80' },
];

export const USUARIOS_PADRAO = [
  { id: 'u1', nome: 'Administrador', login: 'tremmineiro', email: 'tremmineiro010@gmail.com', senha: '1234', perfil: 'admin' },
  { id: 'u2', nome: 'Funcionário',   login: 'funcionario', email: '', senha: '1234', perfil: 'funcionario' },
];

