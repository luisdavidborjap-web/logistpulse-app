// MVC-LP-01 - Modelo Producto (HU-LP-01, HU-LP-02, HU-LP-04).
module.exports = {
  async buscarPorSku(db, sku) {
    const { rows } = await db.query('SELECT id, sku, nombre, stock_minimo FROM productos WHERE sku = $1', [sku]);
    return rows[0] || null;
  },
};
