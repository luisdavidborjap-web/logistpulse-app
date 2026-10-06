// MVC-LP-10 - GET /health: estado de la API y de la base de datos.
const { query } = require('../config/db');

module.exports = {
  async estado(req, res) {
    try {
      await query('SELECT 1');
      return res.status(200).json({ estado: 'ok', servicio: 'logistpulse-api', base_de_datos: 'ok' });
    } catch (error) {
      return res.status(503).json({ estado: 'degradado', servicio: 'logistpulse-api', base_de_datos: 'sin_conexion' });
    }
  },
};
