/* ============================================================
   eventBus.js — Sistema de eventos centralizado v3
   
   Desacopla módulos via eventos padronizados.
   Nenhum módulo usa document.dispatchEvent diretamente.
   
   NOMENCLATURA: tm:{domínio}:{ação}
============================================================ */

// ── Catálogo de eventos (fonte da verdade) ──────────────────
export const EVENTS = {
  // Auth
  ADMIN_LOGGED_IN:     'tm:admin:logged-in',
  ADMIN_LOGGED_OUT:    'tm:admin:logged-out',
  CLIENT_LOGGED_IN:    'tm:client:logged-in',
  CLIENT_LOGGED_OUT:   'tm:client:logged-out',
  AUTH_ERROR:          'tm:auth:error',
  PASSWORD_RESET_SENT: 'tm:auth:password-reset-sent',

  // Store / Tenant
  STORE_LOADED:        'tm:store:loaded',
  STORE_UPDATED:       'tm:store:updated',

  // Dados (Supabase)
  DATA_SAVED:          'tm:data:saved',
  DATA_SAVE_ERROR:     'tm:data:save-error',
  ADMIN_DATA_LOADED:   'tm:data:admin-loaded',

  // Carrinho
  CART_CHANGED:        'tm:cart:changed',
  CART_CLEARED:        'tm:cart:cleared',
  ORDER_CREATED:       'tm:order:created',

  // Pedidos
  ORDER_CONFIRMED:     'tm:order:confirmed',
  ORDER_CANCELLED:     'tm:order:cancelled',
  ORDER_REOPENED:      'tm:order:reopened',

  // Produtos / Estoque
  PRODUCT_UPDATED:     'tm:product:updated',
  PRODUCT_CREATED:     'tm:product:created',
  PRODUCT_DELETED:     'tm:product:deleted',
  STOCK_MOVED:         'tm:stock:moved',
  STOCK_LOW:           'tm:stock:low-alert',

  // Clientes
  CUSTOMER_CREATED:    'tm:customer:created',
  CUSTOMER_UPDATED:    'tm:customer:updated',

  // UI
  TOAST_SHOW:          'tm:ui:toast',
  MODAL_OPEN:          'tm:ui:modal-open',
  MODAL_CLOSE:         'tm:ui:modal-close',
  ADMIN_OPENED:        'tm:ui:admin-opened',
  ADMIN_CLOSED:        'tm:ui:admin-closed',
};

// ── emit — dispara evento com payload ───────────────────────
export function emit(eventName, payload = {}) {
  document.dispatchEvent(
    new CustomEvent(eventName, { detail: payload, bubbles: false })
  );
}

// ── on — registra listener ──────────────────────────────────
export function on(eventName, handler) {
  const wrapper = (e) => handler(e.detail);
  document.addEventListener(eventName, wrapper);
  // Retorna função de cleanup
  return () => document.removeEventListener(eventName, wrapper);
}

// ── once — listener de uso único ────────────────────────────
export function once(eventName, handler) {
  const cleanup = on(eventName, (payload) => {
    handler(payload);
    cleanup();
  });
  return cleanup;
}

// ── off — remove listener ────────────────────────────────────
export function off(eventName, handler) {
  document.removeEventListener(eventName, handler);
}
