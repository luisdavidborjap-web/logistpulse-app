// MVC-LP-03 - Modelo Lote (HU-LP-02, HU-LP-05).
module.exports = {
  async buscarPorProductoYCodigo(db, productoId, codigoLote) {
    const { rows } = await db.query('SELECT id FROM lotes WHERE producto_id = $1 AND codigo_lote = $2', [productoId, codigoLote]);
    return rows[0] || null;
  },

  async crear(db, { productoId, codigoLote, fechaVencimiento }) {
    const { rows } = await db.query(
      `INSERT INTO lotes (producto_id, codigo_lote, fecha_vencimiento)
       VALUES ($1, $2, $3)
       RETURNING id, codigo_lote, fecha_vencimiento`,
      [productoId, codigoLote, fechaVencimiento]
    );
    return rows[0];
  },
};