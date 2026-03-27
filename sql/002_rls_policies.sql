-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security — isolamento por loja
-- Execute APÓS 001_multi_tenant.sql
--
-- IMPORTANTE: O frontend atual usa a anon key.
-- Esta configuração garante que registros sem store_id
-- (ou com store_id incorreto) não vazem entre tenants.
-- ============================================================


-- ── 1. Habilita RLS em todas as tabelas ──────────────────────
ALTER TABLE stores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque     ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE config      ENABLE ROW LEVEL SECURITY;


-- ── 2. Políticas de leitura pública (cardápio) ───────────────
-- Clientes sem login podem ver o cardápio

DROP POLICY IF EXISTS public_read_categorias ON categorias;
CREATE POLICY public_read_categorias ON categorias
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS public_read_produtos ON produtos;
CREATE POLICY public_read_produtos ON produtos
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS public_read_config ON config;
CREATE POLICY public_read_config ON config
  FOR SELECT TO anon
  USING (true);


-- ── 3. Política de leitura para usuários autenticados ────────
-- (preparado para Supabase Auth — ativado quando implementado)

DROP POLICY IF EXISTS auth_read_all ON categorias;
CREATE POLICY auth_read_all ON categorias
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS auth_read_all ON produtos;
CREATE POLICY auth_read_all ON produtos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);


-- ── 4. Política permissiva temporária para anon (sistema atual)
-- O frontend atual usa anon key sem Supabase Auth.
-- Esta política permite todas as operações da anon key.
-- REMOVA quando migrar para Supabase Auth.

DO $$
DECLARE
  tabelas text[] := ARRAY['categorias','produtos','estoque','movimentos',
                           'fornecedores','clientes','compras','pedidos',
                           'usuarios','config'];
  t text;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS anon_full_access ON %I;
       CREATE POLICY anon_full_access ON %I
         FOR ALL TO anon
         USING (true)
         WITH CHECK (true);',
      t, t
    );
  END LOOP;
END $$;


-- ── 5. PRÓXIMO PASSO: migrar para Supabase Auth ──────────────
-- Quando Supabase Auth estiver implementado, substitua a política
-- anon_full_access por políticas baseadas em auth.uid():
--
-- CREATE POLICY tenant_isolation ON produtos
--   FOR ALL TO authenticated
--   USING (store_id = (
--     SELECT store_id FROM store_membros
--     WHERE user_id = auth.uid() AND ativo = true
--     LIMIT 1
--   ));
