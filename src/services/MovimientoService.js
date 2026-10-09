// MVC-LP-13 - MovimientoService: descuento transaccional FEFO y registro de movimientos (HU-LP-05, RNF-LP-01/02).
// Recibe la conexion de la transaccion abierta por PedidoController: si cualquier linea falla, el Controlador
// hace ROLLBACK y el inventario queda intacto.
module.exports = {
  async descontarPedido(db, pedidoId) {
    // Las filas de existencias asignadas al pedido se bloquean en orden FEFO.
    const { rows: asignaciones } = await db.query(
      `SELECT a.existencia_id, a.producto_id, a.cantidad, e.lote_id, e.ubicacion_id
         FROM asignaciones_pedido a
         JOIN existencias e ON e.id = a.existencia_id
         JOIN lotes l ON l.id = e.lote_id
        WHERE a.pedido_id = $1
        ORDER BY l.fecha_vencimiento ASC, l.id ASC, e.id ASC
          FOR UPDATE OF e`,
      [pedidoId]
    );
    for (const a of asignaciones) {
      // Los CHECK de la tabla (cantidad >= 0, reservada >= 0, reservada <= cantidad) abortan la operacion si algo no cuadra.
      await db.query(
        `UPDATE existencias
            SET cantidad = cantidad - $2, cantidad_reservada = cantidad_reservada - $2
          WHERE id = $1`,
        [a.existencia_id, a.cantidad]
      );
      await db.query(
        `INSERT INTO movimientos_inventario (pedido_id, producto_id, lote_id, ubicacion_id, cantidad, tipo)
         VALUES ($1, $2, $3, $4, $5, 'SALIDA_PEDIDO')`,
        [pedidoId, a.producto_id, a.lote_id, a.ubicacion_id, a.cantidad]
      );
    }
    return asignaciones.length;
  },
};
