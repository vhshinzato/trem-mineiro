-- ============================================================
-- 001_multi_tenant.sql
-- Preparação para arquitetura multi-tenant (store_id)
-- Trem Mineiro → tenant inicial
-- 
-- EXECUTE NO SQL EDITOR DO SUPABASE
-- Execução segura: usa IF NOT EXISTS e migração sem perda de dados
-- ============================================================


-- ── 1. Tabela de lojas (tenants) ─────────────────────────────
CREATE TABLE IF NOT EXISTS stores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text        UNIQUE NOT NULL,
  nome        text        NOT NULL,
  plano       text        NOT NULL DEFAULT 'basico', -- basico | pro | enterprise
  ativo       boolean     NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  config      jsonb       NOT NULL DEFAULT '{}'
);

-- ── 2. Inserir Trem Mineiro como tenant inicial ───────────────
-- ON CONFLICT DO NOTHING → seguro executar múltiplas vezes
INSERT INTO stores (slug, nome, plano)
VALUES ('trem-mineiro', 'Trem Mineiro', 'basico')
ON CONFLICT (slug) DO NOTHING;

-- Salva o store_id do Trem Mineiro para uso nas etapas abaixo
DO $$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'trem-mineiro';
  RAISE NOTICE 'Trem Mineiro store_id: %', v_store_id;
END $$;


-- ── 3. Adiciona store_id nas tabelas de dados ─────────────────
-- Padrão: nullable agora, obrigatório após migração dos dados

ALTER TABLE categorias  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE produtos     ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE estoque      ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE movimentos   ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE clientes     ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE compras      ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE pedidos      ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);
ALTER TABLE usuarios     ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id);


-- ── 4. Migra dados existentes para o tenant Trem Mineiro ──────
-- Preenche store_id nos registros que ainda não têm

DO $$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT id INTO v_store_id FROM stores WHERE slug = 'trem-mineiro';

  UPDATE categorias  SET store_id = v_store_id WHERE store_id IS NULL;
  UPDATE produtos     SET store_id = v_store_id WHERE store_id IS NULL;
  UPDATE estoque      SET store_id = v_store_id WHERE store_id IS NULL;
  UPDATE movimentos   SET store_id = v_store_id WHERE store_id IS NULL;
  UPDATE fornecedores SET store_id = v_store_id WHERE store_id IS NULL;
  UPDATE clientes     SET store_id = v_store_id WHERE store_id IS NULL;
  UPDATE compras      SET store_id = v_store_id WHERE store_id IS NULL;
  UPDATE pedidos      SET store_id = v_store_id WHERE store_id IS NULL;
  UPDATE usuarios     SET store_id = v_store_id WHERE store_id IS NULL;

  RAISE NOTICE 'Migração concluída para store_id: %', v_store_id;
END $$;


-- ── 5. Índices de performance (store_id em todas as tabelas) ──
CREATE INDEX IF NOT EXISTS idx_categorias_store  ON categorias(store_id);
CREATE INDEX IF NOT EXISTS idx_produtos_store    ON produtos(store_id);
CREATE INDEX IF NOT EXISTS idx_estoque_store     ON estoque(store_id);
CREATE INDEX IF NOT EXISTS idx_movimentos_store  ON movimentos(store_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_store ON fornecedores(store_id);
CREATE INDEX IF NOT EXISTS idx_clientes_store    ON clientes(store_id);
CREATE INDEX IF NOT EXISTS idx_compras_store     ON compras(store_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_store     ON pedidos(store_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_store    ON usuarios(store_id);


-- ── 6. Verificação final ──────────────────────────────────────
SELECT
  'categorias'  AS tabela, COUNT(*) AS total, COUNT(store_id) AS com_store_id FROM categorias
UNION ALL SELECT 'produtos',     COUNT(*), COUNT(store_id) FROM produtos
UNION ALL SELECT 'clientes',     COUNT(*), COUNT(store_id) FROM clientes
UNION ALL SELECT 'pedidos',      COUNT(*), COUNT(store_id) FROM pedidos
UNION ALL SELECT 'usuarios',     COUNT(*), COUNT(store_id) FROM usuarios;
