// MVC-LP-05 - Modelo Pedido y sus lineas (DetallePedido) (HU-LP-04, HU-LP-05).
class StockInsuficiente extends Error {
  constructor(sku, requerido, disponible) {
    super(`Stock insuficiente para ${sku}`);
    this.name = 'StockInsuficiente';
    this.sku = sku;
    this.requerido = requerido;
    this.disponible = disponible;
  }
}

module.exports = {
  StockInsuficiente,

  async buscarClientePorCodigo(db, codigo) {
    const { rows } = await db.query('SELECT id, codigo, nombre FROM clientes WHERE codigo = $1', [codigo]);
    return rows[0] || null;
  },

  // Crea el pedido y reserva existencias por FEFO (primero en vencer, primero en salir) en la MISMA transaccion
  // que recibe `db` (RNF-LP-01). Lanza StockInsuficiente si alguna linea no se puede cubrir.
  async crearConReserva(db, clienteId, lineas) {
    const { rows } = await db.query(
      "INSERT INTO pedidos (cliente_id, estado) VALUES ($1, 'CREADO') RETURNING id",
      [clienteId]
    );
    const pedidoId = rows[0].id;
    // Orden fijo por producto para que dos pedidos concurrentes bloqueen filas en el mismo orden (sin deadlocks).
    const ordenadas = [...lineas].sort((a, b) => a.productoId - b.productoId);
    for (const linea of ordenadas) {
      await db.query('INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad) VALUES ($1, $2, $3)', [pedidoId, linea.productoId, linea.cantidad]);
      const { rows: candidatas } = await db.query(
        `SELECT e.id, e.cantidad - e.cantidad_reservada AS disponible
           FROM existencias e JOIN lotes l ON l.id = e.lote_id
          WHERE l.producto_id = $1 AND l.fecha_vencimiento >= CURRENT_DATE AND e.cantidad - e.cantidad_reservada > 0
          ORDER BY l.fecha_vencimiento ASC, l.id ASC, e.id ASC
            FOR UPDATE OF e`,
        [linea.productoId]
      );
      const totalDisponible = candidatas.reduce((suma, c) => suma + c.disponible, 0);
      if (totalDisponible < linea.cantidad) throw new StockInsuficiente(linea.sku, linea.cantidad, totalDisponible);
      let pendiente = linea.cantidad;
      for (const candidata of candidatas) {
        if (pendiente === 0) break;
        const tomar = Math.min(pendiente, candidata.disponible);
        await db.query('UPDATE existencias SET cantidad_reservada = cantidad_reservada + $2 WHERE id = $1', [candidata.id, tomar]);
        await db.query(
          'INSERT INTO asignaciones_pedido (pedido_id, existencia_id, producto_id, cantidad) VALUES ($1, $2, $3, $4)',
          [pedidoId, candidata.id, linea.productoId, tomar]
        );
        pendiente -= tomar;
      }
    }
    return pedidoId;
  },

  // Pedido con cliente, lineas y asignaciones (lote y ubicacion reservados).
  async obtener(db, id) {
    const { rows } = await db.query(
      `SELECT p.id, p.estado, p.creado_en, p.preparado_en, c.codigo AS cliente
         FROM pedidos p JOIN clientes c ON c.id = p.cliente_id WHERE p.id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    const pedido = rows[0];
    pedido.lineas = (await db.query(
      `SELECT pr.sku, pr.nombre AS producto, d.cantidad
         FROM detalle_pedido d JOIN productos pr ON pr.id = d.producto_id
        WHERE d.pedido_id = $1 ORDER BY pr.sku`, [id])).rows;
    pedido.asignaciones = (await db.query(
      `SELECT pr.sku, l.codigo_lote AS lote, l.fecha_vencimiento, u.codigo AS ubicacion, a.cantidad
         FROM asignaciones_pedido a
         JOIN existencias e ON e.id = a.existencia_id
         JOIN lotes l ON l.id = e.lote_id
         JOIN ubicaciones u ON u.id = e.ubicacion_id
         JOIN productos pr ON pr.id = a.producto_id
        WHERE a.pedido_id = $1
        ORDER BY l.fecha_vencimiento, l.id, u.codigo`, [id])).rows;
    return pedido;
  },

  async bloquear(db, id) {
    const { rows } = await db.query('SELECT id, estado FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    return rows[0] || null;
  },

  async marcarPreparado(db, id) {
    await db.query("UPDATE pedidos SET estado = 'PREPARADO', preparado_en = now() WHERE id = $1", [id]);
  },
};
