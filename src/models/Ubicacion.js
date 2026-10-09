// MVC-LP-02 - Modelo Ubicacion (HU-LP-01, HU-LP-02).
module.exports = {
  async buscarPorCodigo(db, codigo) {
    const { rows } = await db.query('SELECT id, codigo, descripcion FROM ubicaciones WHERE codigo = $1', [codigo]);
    return rows[0] || null;
  },
};