// MVC-LP-12 - PedidoController: crea pedidos validando disponibilidad (HU-LP-04) y los prepara (HU-LP-05).
const { pool } = require('../config/db');
const Producto = require('../models/Producto');
const Pedido = require('../models/Pedido');
const MovimientoService = require('../services/MovimientoService');

// Acepta { lineas: [{ sku, cantidad }] } (JSON) o sku/cantidad repetidos (formulario HTML).
function normalizarLineas(b) {
  let crudas = [];
  if (Array.isArray(b.lineas)) crudas = b.lineas;
  else if (b.sku !== undefined) {
    const skus = [].concat(b.sku);
    const cantidades = [].concat(b.cantidad === undefined ? [] : b.cantidad);
    crudas = skus.map((sku, i) => ({ sku, cantidad: cantidades[i] })).filter((l) => String(l.sku).trim() !== '');
  }
  return crudas;
}

module.exports = {
  // POST /pedidos  { cliente: "CLI-001", lineas: [{ sku: "SKU-001", cantidad: 2 }] }
  async crear(req, res, next) {
    const b = req.body || {};
    const crudas = normalizarLineas(b);
    const errores = [];
    if (typeof b.cliente !== 'string' || !b.cliente) errores.push('cliente es obligatorio (codigo, por ejemplo CLI-001)');
    if (crudas.length === 0) errores.push('el pedido debe tener al menos una linea');
    const porSku = new Map();
    crudas.forEach((l, i) => {
      const cantidad = Number(l.cantidad);
      if (typeof l.sku !== 'string' || !l.sku) errores.push(`linea ${i + 1}: sku es obligatorio`);
      else if (!Number.isInteger(cantidad) || cantidad <= 0) errores.push(`linea ${i + 1}: cantidad debe ser un entero positivo`);
      else porSku.set(l.sku, (porSku.get(l.sku) || 0) + cantidad);
    });
    if (errores.length) return res.responder('pedidos/pedido_nuevo', { pedido: null, error: 'Datos invalidos', detalle: errores }, 400);

    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      const cliente = await Pedido.buscarClientePorCodigo(conexion, b.cliente);
      if (!cliente) { await conexion.query('ROLLBACK'); return res.responder('pedidos/pedido_nuevo', { pedido: null, error: 'Cliente no encontrado', detalle: [] }, 404); }
      const lineas = [];
      for (const [sku, cantidad] of porSku) {
        const producto = await Producto.buscarPorSku(conexion, sku);
        if (!producto) { await conexion.query('ROLLBACK'); return res.responder('pedidos/pedido_nuevo', { pedido: null, error: `Producto no encontrado: ${sku}`, detalle: [] }, 404); }
        lineas.push({ productoId: producto.id, sku, cantidad });
      }
      const pedidoId = await Pedido.crearConReserva(conexion, cliente.id, lineas);
      await conexion.query('COMMIT');
      const pedido = await Pedido.obtener(pool, pedidoId);
      return res.responder('pedidos/pedido_nuevo', { pedido, error: null, detalle: [] }, 201);
    } catch (error) {
      try { await conexion.query('ROLLBACK'); } catch (e) { /* conexion ya cerrada */ }
      if (error instanceof Pedido.StockInsuficiente) {
        return res.responder('pedidos/pedido_nuevo', {
          pedido: null, error: 'Stock insuficiente', detalle: [`${error.sku}: requerido ${error.requerido}, disponible ${error.disponible}`],
          sku_faltante: error.sku, requerido: error.requerido, disponible: error.disponible,
        }, 409);
      }
      return next(error);
    } finally {
      conexion.release();
    }
  },

  // POST /pedidos/:id/preparar   (HU-LP-05): descuenta el inventario en una sola transaccion.
  async preparar(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.responder('pedidos/preparacion', { pedido: null, error: 'id invalido' }, 400);
    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      const actual = await Pedido.bloquear(conexion, id);
      if (!actual) { await conexion.query('ROLLBACK'); return res.responder('pedidos/preparacion', { pedido: null, error: 'Pedido no encontrado' }, 404); }
      if (actual.estado !== 'CREADO') {
        await conexion.query('ROLLBACK');
        return res.responder('pedidos/preparacion', { pedido: null, error: `El pedido ya esta en estado ${actual.estado}` }, 409);
      }
      await MovimientoService.descontarPedido(conexion, id);
      await Pedido.marcarPreparado(conexion, id);
      await conexion.query('COMMIT');
      return res.responder('pedidos/preparacion', { pedido: await Pedido.obtener(pool, id), error: null });
    } catch (error) {
      try { await conexion.query('ROLLBACK'); } catch (e) { /* conexion ya cerrada */ }
      if (error.code === '23514') { // CHECK violado: el inventario no cuadra; toda la operacion se revierte.
        return res.responder('pedidos/preparacion', { pedido: null, error: 'INVENTARIO_INCONSISTENTE: la operacion se revirtio y el inventario no cambio' }, 409);
      }
      return next(error);
    } finally {
      conexion.release();
    }
  },
};
