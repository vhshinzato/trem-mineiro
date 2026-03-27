/* ============================================================
   services/index.js — Barrel export de todos os serviços
   
   Uso: import { orderService, stockService } from './services/index.js'
============================================================ */
export { orderService }   from './orderService.js';   // pedidos, carrinho, WhatsApp
export { stockService }   from './stockService.js';   // estoque, movimentos
export { productService } from './productService.js'; // produtos, categorias
export { customerService} from './customerService.js';// clientes, histórico
