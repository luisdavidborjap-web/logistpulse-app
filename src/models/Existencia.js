// MVC-LP-04 - Modelo Existencia: cantidad por lote y ubicacion (HU-LP-01, HU-LP-02, HU-LP-04, HU-LP-05).
module.exports = {
  // Existencias filtradas por SKU y/o codigo de ubicacion. cantidad_disponible = cantidad - cantidad_reservada.
  async consultar(db, { sku, ubicacion }) {
    const { rows } = await db.query(
      `SELECT p.sku, p.nombre AS producto, l.codigo_lote AS lote, l.fecha_vencimiento,
              u.codigo AS ubicacion, e.cantidad, e.cantidad_reservada,
              e.cantidad - e.cantidad_reservada AS cantidad_disponible
         FROM existencias e
         JOIN lotes l ON l.id = e.lote_id
         JOIN productos p ON p.id = l.producto_id
         JOIN ubicaciones u ON u.id = e.ubicacion_id
        WHERE ($1::text IS NULL OR p.sku = $1) AND ($2::text IS NULL OR u.codigo = $2)
        ORDER BY p.sku, l.fecha_vencimiento, l.id, u.codigo`,
      [sku || null, ubicacion || null]
    );
    return rows;
  },

  // Suma la cantidad al lote en la ubicacion (crea la fila si no existe).
  async incrementar(db, { loteId, ubicacionId, cantidad }) {
    const { rows } = await db.query(
      `INSERT INTO existencias (lote_id, ubicacion_id, cantidad)
       VALUES ($1, $2, $3)
       ON CONFLICT (lote_id, ubicacion_id) DO UPDATE SET cantidad = existencias.cantidad + EXCLUDED.cantidad
       RETURNING cantidad, cantidad_reservada, cantidad - cantidad_reservada AS cantidad_disponible`,
      [loteId, ubicacionId, cantidad]
    );
    return rows[0];
  },
};