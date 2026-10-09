// LOGISTPULSE - PRB-LP-04b / CA-LP-05-3: si falla el descuento de una linea, se revierte TODA la preparacion.
// Ejecutar dentro del contenedor:  docker compose exec logistpulse-api node scripts/prueba_rollback.js
// Provoca el fallo de forma controlada (pone en 0 la reserva de una existencia) y limpia los datos de prueba al final.
const { pool } = require('../src/config/db');
const BASE = process.env.BASE_URL || 'http://localhost:3000';
let fallos = 0;
const verificar = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) fallos += 1; };

async function post(ruta, cuerpo) {
  const r = await fetch(BASE + ruta, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  return { estado: r.status, datos: await r.json().catch(() => null) };
}
const inventario = async () => (await pool.query("SELECT id, cantidad, cantidad_reservada FROM existencias ORDER BY id")).rows;

(async () => {
  console.log('PRB-LP-04b  Rollback de la preparacion (CA-LP-05-3)');
  const crear = await post('/pedidos', { cliente: 'CLI-001', lineas: [{ sku: 'SKU-004', cantidad: 1 }, { sku: 'SKU-005', cantidad: 1 }] });
  verificar(crear.estado === 201, `pedido de prueba creado (estado ${crear.estado})`);
  const pedidoId = crear.datos.pedido.id;
  const asign = (await pool.query('SELECT a.existencia_id, a.cantidad, p.sku FROM asignaciones_pedido a JOIN productos p ON p.id = a.producto_id WHERE a.pedido_id = $1 ORDER BY p.sku', [pedidoId])).rows;
  const segunda = asign[asign.length - 1]; // SKU-005: se procesa despues de SKU-004 por FEFO
  await pool.query('UPDATE existencias SET cantidad_reservada = 0 WHERE id = $1', [segunda.existencia_id]); // corrompe la reserva a proposito
  const antes = await inventario();

  const prep = await post(`/pedidos/${pedidoId}/preparar`);
  verificar(prep.estado === 409, `la preparacion falla con 409 (estado ${prep.estado})`);
  const despues = await inventario();
  verificar(JSON.stringify(antes) === JSON.stringify(despues), 'el inventario quedo exactamente igual: la primera linea tambien se revirtio');
  const estado = (await pool.query('SELECT estado FROM pedidos WHERE id = $1', [pedidoId])).rows[0].estado;
  verificar(estado === 'CREADO', `el pedido sigue en estado CREADO (${estado})`);
  const movs = (await pool.query('SELECT count(*)::int AS n FROM movimientos_inventario WHERE pedido_id = $1', [pedidoId])).rows[0].n;
  verificar(movs === 0, 'no se registraron movimientos de inventario');

  // Limpieza de los datos de prueba.
  await pool.query('UPDATE existencias e SET cantidad_reservada = GREATEST(0, e.cantidad_reservada - a.cantidad) FROM asignaciones_pedido a WHERE a.existencia_id = e.id AND a.pedido_id = $1 AND a.existencia_id <> $2', [pedidoId, segunda.existencia_id]);
  await pool.query('DELETE FROM asignaciones_pedido WHERE pedido_id = $1', [pedidoId]);
  await pool.query('DELETE FROM detalle_pedido WHERE pedido_id = $1', [pedidoId]);
  await pool.query('DELETE FROM pedidos WHERE id = $1', [pedidoId]);
  console.log(`\nResultado: ${fallos === 0 ? 'ROLLBACK VERIFICADO' : `${fallos} PRUEBA(S) FALLARON`}`);
  await pool.end();
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error(e.message); process.exit(1); });
