-- ============================================================
-- 000_base_schema.sql
-- Schema base completo do Trem Mineiro v3
--
-- EXECUTE ESTE ARQUIVO PRIMEIRO, antes de qualquer migration.
-- Ordem obrigatória:
--   1. 000_base_schema.sql  ← este arquivo
--   2. 001_multi_tenant.sql
--   3. 002_rls_policies.sql
--   4. 003_auth_multitenant.sql
--
-- Seguro para reexecutar: usa IF NOT EXISTS em tudo.
-- Compatível com Supabase (PostgreSQL 15+).
-- ============================================================


-- ============================================================
-- TABELA: config
-- Armazena configurações globais da loja:
-- WhatsApp, logo, mídias do hero (heroMedia).
-- Linha única com id = 'main'.
-- ============================================================
CREATE TABLE IF NOT EXISTS config (
  id          text        PRIMARY KEY DEFAULT 'main',
  dados       jsonb       NOT NULL DEFAULT '{
    "whatsapp": "",
    "logo": "",
    "heroMedia": []
  }'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Garante que sempre exista a linha principal
INSERT INTO config (id, dados)
VALUES ('main', '{"whatsapp":"","logo":"","heroMedia":[]}'::jsonb)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TABELA: categorias
-- Categorias de produtos do cardápio.
-- Exemplo: Cafés, Doces de Leite, Queijos, Kits.
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias (
  id          text        PRIMARY KEY,
  nome        text        NOT NULL,
  ordem       integer     NOT NULL DEFAULT 0,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_ordem ON categorias(ordem);


-- ============================================================
-- TABELA: produtos
-- Produtos disponíveis no cardápio.
-- categoria_id referencia categorias.id.
-- imagem: URL externa ou URL do Supabase Storage.
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos (
  id           text        PRIMARY KEY,
  categoria_id text        REFERENCES categorias(id) ON DELETE SET NULL,
  nome         text        NOT NULL,
  descricao    text        NOT NULL DEFAULT '',
  preco        text        NOT NULL DEFAULT '',
  imagem       text        NOT NULL DEFAULT '',
  ordem        integer     NOT NULL DEFAULT 0,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ordem     ON produtos(ordem);


-- ============================================================
-- TABELA: estoque
-- Controle de quantidade por produto.
-- produto_id referencia produtos.id (1:1).
-- ============================================================
CREATE TABLE IF NOT EXISTS estoque (
  produto_id  text        PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade  integer     NOT NULL DEFAULT 0,
  minimo      integer     NOT NULL DEFAULT 0,
  maximo      integer     NOT NULL DEFAULT 100,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- TABELA: movimentos
-- Histórico de movimentações de estoque (entradas e saídas).
-- tipo: 'entrada' | 'saida'
-- Limite mantido pelo app: últimos 200 registros por store.
-- ============================================================
CREATE TABLE IF NOT EXISTS movimentos (
  id           text        PRIMARY KEY,
  produto_id   text        REFERENCES produtos(id) ON DELETE SET NULL,
  tipo         text        NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  quantidade   integer     NOT NULL CHECK (quantidade > 0),
  novo_total   integer     NOT NULL DEFAULT 0,
  obs          text        NOT NULL DEFAULT '',
  fornecedor   text,
  data_compra  date,
  valor_unit   numeric(10,2),
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentos_produto   ON movimentos(produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_criado_em ON movimentos(criado_em DESC);


-- ============================================================
-- TABELA: fornecedores
-- Cadastro de fornecedores de produtos.
-- produtos: lista de produtos fornecidos (texto livre).
-- ============================================================
CREATE TABLE IF NOT EXISTS fornecedores (
  id          text        PRIMARY KEY,
  nome        text        NOT NULL,
  telefone    text,
  email       text,
  endereco    text,
  produtos    text,
  obs         text,
  criado_em   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- TABELA: clientes
-- Cadastro de clientes da loja.
-- senha_hash: hash da senha para login público.
--   (migrar para Supabase Auth via 003_auth_multitenant.sql)
-- aniversario: formato YYYY-MM-DD para filtro de aniversariantes.
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id           text        PRIMARY KEY,
  nome         text        NOT NULL,
  email        text,
  senha_hash   text        NOT NULL DEFAULT '',
  telefone     text,
  aniversario  text,
  endereco     text,
  obs          text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);


-- ============================================================
-- TABELA: compras
-- Histórico de compras por cliente.
-- cliente_id referencia clientes.id.
-- produtos: lista de itens em texto livre (compatibilidade).
-- ============================================================
CREATE TABLE IF NOT EXISTS compras (
  id          text        PRIMARY KEY,
  cliente_id  text        REFERENCES clientes(id) ON DELETE CASCADE,
  data        date        NOT NULL DEFAULT CURRENT_DATE,
  valor       numeric(10,2) NOT NULL DEFAULT 0,
  produtos    text        NOT NULL DEFAULT '',
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_cliente ON compras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_compras_data    ON compras(data DESC);


-- ============================================================
-- TABELA: pedidos
-- Pedidos realizados pelos clientes.
-- status: 'pendente' | 'confirmado' | 'cancelado'
-- itens: array JSON com { produtoId, nome, quantidade, precoUnit, subtotal }
-- cliente_id: nullable (pedido anônimo via WhatsApp)
-- ============================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id                text        PRIMARY KEY,
  numero            text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente','confirmado','cancelado')),
  cliente_id        text        REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome      text,
  itens             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  total             numeric(10,2) NOT NULL DEFAULT 0,
  total_final       numeric(10,2),
  desconto          numeric(10,2) NOT NULL DEFAULT 0,
  obs               text,
  data              timestamptz NOT NULL DEFAULT now(),
  data_confirmacao  timestamptz,
  criado_em         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_status    ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data      ON pedidos(data DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente   ON pedidos(cliente_id);


-- ============================================================
-- TABELA: usuarios
-- Usuários do painel administrativo.
-- perfil: 'admin' | 'funcionario'
-- IMPORTANTE: após 003_auth_multitenant.sql, autenticação migra
-- para Supabase Auth. Esta tabela mantida para compatibilidade.
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id          text        PRIMARY KEY,
  nome        text        NOT NULL,
  login       text        NOT NULL UNIQUE,
  senha       text        NOT NULL DEFAULT '',
  perfil      text        NOT NULL DEFAULT 'funcionario'
                          CHECK (perfil IN ('admin', 'funcionario')),
  ativo       boolean     NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- DADOS INICIAIS (usuários padrão)
-- Senha '1234' em texto para compatibilidade inicial.
-- Substituída por Supabase Auth após 003_auth_multitenant.sql.
-- ============================================================
INSERT INTO usuarios (id, nome, login, senha, perfil)
VALUES
  ('u1', 'Administrador', 'admin',       '1234', 'admin'),
  ('u2', 'Funcionário',   'funcionario', '1234', 'funcionario')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- VERIFICAÇÃO FINAL
-- Confirma que todas as tabelas foram criadas corretamente.
-- ============================================================
SELECT
  table_name,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name = t.table_name
     AND table_schema = 'public') AS num_colunas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN (
    'config','categorias','produtos','estoque',
    'movimentos','fornecedores','clientes','compras',
    'pedidos','usuarios'
  )
ORDER BY table_name;
