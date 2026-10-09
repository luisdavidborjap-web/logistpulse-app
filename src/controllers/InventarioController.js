// MVC-LP-11 - InventarioController (HU-LP-01, HU-LP-02).
const { pool, query } = require('../config/db');
const Producto = require('../models/Producto');
const Ubicacion = require('../models/Ubicacion');
const Lote = require('../models/Lote');
const Existencia = require('../models/Existencia');

const hoy = () => new Date().toLocaleDateString('en-CA');
const fechaValida = (texto) =>
  /^\d{4}-\d{2}-\d{2}$/.test(texto || '') && new Date(`${texto}T00:00:00Z`).toISOString().slice(0, 10) === texto;

module.exports = {
  // GET /inventario?producto=SKU-001&ubicacion=A-01-01   (HU-LP-01)
  async consultar(req, res, next) {
    try {
      const sku = req.query.producto || undefined;
      const ubicacion = req.query.ubicacion || undefined;
      const filtros = { producto: sku || '', ubicacion: ubicacion || '' };
      if (sku && !(await Producto.buscarPorSku({ query }, sku))) {
        return res.responder('inventario/existencias', { existencias: null, filtros, error: 'Producto no encontrado' }, 404);
      }
      if (ubicacion && !(await Ubicacion.buscarPorCodigo({ query }, ubicacion))) {
        return res.responder('inventario/existencias', { existencias: null, filtros, error: 'Ubicacion no encontrada' }, 404);
      }
      const existencias = await Existencia.consultar({ query }, { sku, ubicacion });
      return res.responder('inventario/existencias', { existencias, total: existencias.length, filtros, error: null });
    } catch (error) {
      return next(error);
    }
  },

  // POST /lotes  { sku, codigo_lote, ubicacion, cantidad, fecha_vencimiento }   (HU-LP-02)
  async registrarLote(req, res, next) {
    const b = req.body || {};
    const cantidad = Number(b.cantidad);
    const errores = [];
    if (typeof b.sku !== 'string' || !b.sku) errores.push('sku es obligatorio');
    if (typeof b.ubicacion !== 'string' || !b.ubicacion) errores.push('ubicacion es obligatoria');
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(b.codigo_lote || '')) errores.push('codigo_lote es obligatorio (3 a 30 caracteres alfanumericos, guion o guion bajo)');
    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 1000000) errores.push('cantidad debe ser un entero positivo');
    if (!fechaValida(b.fecha_vencimiento)) errores.push('fecha_vencimiento es obligatoria con formato YYYY-MM-DD');
    else if (b.fecha_vencimiento <= hoy()) errores.push('fecha_vencimiento debe ser futura');
    if (errores.length) return res.responder('inventario/lotes', { lote: null, existencia: null, error: 'Datos invalidos', detalle: errores }, 400);

    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      const producto = await Producto.buscarPorSku(conexion, b.sku);
      if (!producto) { await conexion.query('ROLLBACK'); return res.responder('inventario/lotes', { lote: null, existencia: null, error: 'Producto no encontrado', detalle: [] }, 404); }
      const ubicacion = await Ubicacion.buscarPorCodigo(conexion, b.ubicacion);
      if (!ubicacion) { await conexion.query('ROLLBACK'); return res.responder('inventario/lotes', { lote: null, existencia: null, error: 'Ubicacion no encontrada', detalle: [] }, 404); }
      if (await Lote.buscarPorProductoYCodigo(conexion, producto.id, b.codigo_lote)) {
        await conexion.query('ROLLBACK');
        return res.responder('inventario/lotes', { lote: null, existencia: null, error: 'El codigo de lote ya existe para este producto', detalle: [] }, 409);
      }
      const lote = await Lote.crear(conexion, { productoId: producto.id, codigoLote: b.codigo_lote, fechaVencimiento: b.fecha_vencimiento });
      const existencia = await Existencia.incrementar(conexion, { loteId: lote.id, ubicacionId: ubicacion.id, cantidad });
      await conexion.query('COMMIT');
      return res.responder('inventario/lotes', { lote: { ...lote, sku: producto.sku, ubicacion: ubicacion.codigo }, existencia, error: null, detalle: [] }, 201);
    } catch (error) {
      try { await conexion.query('ROLLBACK'); } catch (e) { /* conexion ya cerrada */ }
      if (error.code === '23505') return res.responder('inventario/lotes', { lote: null, existencia: null, error: 'El codigo de lote ya existe para este producto', detalle: [] }, 409);
      return next(error);
    } finally {
      conexion.release();
    }
  },
};