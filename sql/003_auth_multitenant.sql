-- ============================================================
-- 003_auth_multitenant.sql
-- Supabase Auth + user_profiles + RLS baseado em auth.uid()
-- 
-- EXECUTE APÓS 001_multi_tenant.sql e 002_rls_policies.sql
-- ORDEM IMPORTA: este script depende da tabela stores existir
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- PARTE 1: TABELA DE PERFIS DE USUÁRIO
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text        NOT NULL,
  email       text        NOT NULL,
  telefone    text,
  role        text        NOT NULL DEFAULT 'funcionario',
            -- valores válidos: 'admin' | 'funcionario' | 'cliente'
  store_id    uuid        REFERENCES stores(id) ON DELETE SET NULL,
            -- NULL para clientes (não pertencem a uma store)
  ativo       boolean     NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT role_valido CHECK (role IN ('admin', 'funcionario', 'cliente'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_store  ON user_profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role   ON user_profiles(role);

-- RLS na tabela de perfis
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuário lê e edita apenas o próprio perfil
CREATE POLICY user_profiles_self ON user_profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin pode ver todos os perfis da sua store
CREATE POLICY user_profiles_admin ON user_profiles
  FOR SELECT TO authenticated
  USING (
    store_id = (
      SELECT store_id FROM user_profiles WHERE id = auth.uid() LIMIT 1
    )
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


-- ══════════════════════════════════════════════════════════════
-- PARTE 2: TABELA DE MEMBROS DA STORE
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS store_membros (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'funcionario',
  ativo       boolean     NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

ALTER TABLE store_membros ENABLE ROW LEVEL SECURITY;

-- Membros veem apenas a própria store
CREATE POLICY store_membros_isolation ON store_membros
  FOR ALL TO authenticated
  USING (
    store_id = (
      SELECT store_id FROM user_profiles WHERE id = auth.uid() LIMIT 1
    )
  );


-- ══════════════════════════════════════════════════════════════
-- PARTE 3: FUNÇÃO HELPER — get_current_store_id()
-- Retorna o store_id do usuário logado
-- Usada em todas as políticas RLS para evitar repetição
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_current_store_id()
RETURNS uuid AS $$
  SELECT store_id FROM user_profiles
  WHERE id = auth.uid() AND ativo = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função helper para verificar role
CREATE OR REPLACE FUNCTION get_current_role()
RETURNS text AS $$
  SELECT role FROM user_profiles
  WHERE id = auth.uid() AND ativo = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND ativo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ══════════════════════════════════════════════════════════════
-- PARTE 4: RLS REAL — ISOLAMENTO POR TENANT
-- Remove anon_full_access e aplica isolamento real
-- ══════════════════════════════════════════════════════════════

-- Remove políticas permissivas anteriores
DO $$
DECLARE tabelas text[] := ARRAY['categorias','produtos','estoque','movimentos',
                                 'fornecedores','clientes','compras','pedidos',
                                 'usuarios','config'];
        t text;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('DROP POLICY IF EXISTS anon_full_access ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS auth_read_all ON %I', t);
  END LOOP;
END $$;

-- ── Cardápio público (sem login) ─────────────────────────────
-- Produtos e categorias visíveis para todos (cardápio)
-- Config lida apenas para montagem do cardápio

CREATE POLICY cardapio_public_produtos ON produtos
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY cardapio_public_categorias ON categorias
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY cardapio_public_config ON config
  FOR SELECT TO anon, authenticated
  USING (true);

-- ── Política de isolamento por tenant (authenticated) ────────
-- Aplica em todas as tabelas com store_id

DO $$
DECLARE
  tabelas text[] := ARRAY['categorias','produtos','estoque','movimentos',
                           'fornecedores','clientes','compras','pedidos',
                           'usuarios','config'];
  t text;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- SELECT: apenas registros da store do usuário
    EXECUTE format('
      DROP POLICY IF EXISTS tenant_select ON %I;
      CREATE POLICY tenant_select ON %I
        FOR SELECT TO authenticated
        USING (store_id = get_current_store_id())
    ', t, t);

    -- INSERT/UPDATE: apenas para a store do usuário, apenas admin ou funcionário
    EXECUTE format('
      DROP POLICY IF EXISTS tenant_write ON %I;
      CREATE POLICY tenant_write ON %I
        FOR INSERT TO authenticated
        WITH CHECK (
          store_id = get_current_store_id()
          AND get_current_role() IN (''admin'', ''funcionario'')
        )
    ', t, t);

    EXECUTE format('
      DROP POLICY IF EXISTS tenant_update ON %I;
      CREATE POLICY tenant_update ON %I
        FOR UPDATE TO authenticated
        USING (store_id = get_current_store_id())
        WITH CHECK (
          store_id = get_current_store_id()
          AND get_current_role() IN (''admin'', ''funcionario'')
        )
    ', t, t);

    -- DELETE: apenas admin
    EXECUTE format('
      DROP POLICY IF EXISTS tenant_delete ON %I;
      CREATE POLICY tenant_delete ON %I
        FOR DELETE TO authenticated
        USING (
          store_id = get_current_store_id()
          AND is_admin()
        )
    ', t, t);
  END LOOP;
END $$;

-- ── Clientes: acesso aos próprios dados ──────────────────────
-- Cliente logado vê apenas seus próprios dados

CREATE POLICY cliente_self ON clientes
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()::text
    OR get_current_role() IN ('admin', 'funcionario')
  );


-- ══════════════════════════════════════════════════════════════
-- PARTE 5: TRIGGER — Cria user_profile automaticamente
-- Quando um usuário se cadastra no Supabase Auth,
-- cria linha em user_profiles automaticamente
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ══════════════════════════════════════════════════════════════
-- PARTE 6: ONBOARDING — Admin do Trem Mineiro
-- Execute manualmente após criar o usuário admin via Supabase Auth
-- ══════════════════════════════════════════════════════════════

-- Substitua 'SEU_USER_ID_AQUI' pelo auth.uid() do admin
-- (encontre em Authentication → Users no painel do Supabase)
--
-- UPDATE user_profiles
-- SET role = 'admin', store_id = (SELECT id FROM stores WHERE slug = 'trem-mineiro')
-- WHERE id = 'SEU_USER_ID_AQUI';


-- ══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO FINAL
-- ══════════════════════════════════════════════════════════════

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_ativo,
  (SELECT count(*) FROM pg_policies WHERE tablename = t.tablename) AS num_policies
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('categorias','produtos','estoque','movimentos','fornecedores',
                    'clientes','compras','pedidos','usuarios','config','user_profiles','stores')
ORDER BY tablename;
