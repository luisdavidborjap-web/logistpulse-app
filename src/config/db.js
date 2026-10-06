// Conexion a PostgreSQL (logistpulse-db). Configuracion solo por variables de entorno.
const { Pool, types } = require('pg');

// DATE (1082) como texto 'YYYY-MM-DD' para evitar desfases de zona horaria; NUMERIC (1700) como numero.
types.setTypeParser(1082, (valor) => valor);
types.setTypeParser(1700, (valor) => parseFloat(valor));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'logistpulse',
  user: process.env.DB_USER || 'logistpulse_user',
  password: process.env.DB_PASSWORD,
});

const query = (texto, parametros) => pool.query(texto, parametros);

// La API reintenta hasta que la base de datos acepte conexiones (ademas del healthcheck de Compose).
async function esperarBaseDeDatos(reintentos = 30, esperaMs = 2000) {
  for (let intento = 1; intento <= reintentos; intento++) {
    try {
      await pool.query('SELECT 1');
      console.log(`[db] conexion lista (intento ${intento})`);
      return;
    } catch (error) {
      console.log(`[db] no disponible (intento ${intento}/${reintentos}): ${error.message}`);
      await new Promise((resolver) => setTimeout(resolver, esperaMs));
    }
  }
  throw new Error('No fue posible conectar a la base de datos');
}

module.exports = { pool, query, esperarBaseDeDatos };
