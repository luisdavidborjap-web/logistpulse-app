// LOGISTPULSE - pruebas de humo de las historias del Sprint 1 (PRB-LP-xx). Node 20+, sin dependencias.
// Dentro del contenedor:  docker compose exec logistpulse-api node scripts/smoke.js all
// Desde el host:          BASE_URL=http://localhost:3002 node scripts/smoke.js all
// Secciones: health | hu01 | hu02 | hu04 | hu05 | all
const BASE = process.env.BASE_URL || 'http://localhost:3000';
let fallos = 0;

const verificar = (condicion, mensaje) => {
  console.log(`${condicion ? 'PASS' : 'FAIL'}  ${mensaje}`);
  if (!condicion) fallos += 1;
};
const titulo = (texto) => console.log(`\n== ${texto} ==`);
const fechaEnDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function http(metodo, ruta, cuerpo) {
  const respuesta = await fetch(BASE + ruta, {
    method: metodo,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await respuesta.json(); } catch (e) { /* sin cuerpo JSON */ }
  return { estado: respuesta.status, datos };
}

const suma = (filas, campo) => filas.reduce((total, f) => total + f[campo], 0);
// Devuelve null si la consulta de inventario (HU-LP-01) aun no esta integrada en esta rama.
const resumen = async (sku) => {
  const r = await http('GET', `/inventario?producto=${sku}`);
  if (r.estado !== 200) return null;
  return { cantidad: suma(r.datos.existencias, 'cantidad'), reservada: suma(r.datos.existencias, 'cantidad_reservada'), filas: r.datos.existencias };
};
const ctx = {};

async function health() {
  titulo('PRB-LP-00b  GET /health  (TEC-LP-02)');
  const r = await http('GET', '/health');
  verificar(r.estado === 200, `GET /health responde 200 (obtuvo ${r.estado})`);
  verificar(r.datos && r.datos.base_de_datos === 'ok', 'la base de datos responde (base_de_datos = ok)');
}

async function hu01() {
  titulo('PRB-LP-01  HU-LP-01  Consultar existencias por producto y ubicacion');
  let r = await http('GET', '/inventario?producto=SKU-001');
  const filas = (r.datos && r.datos.existencias) || [];
  verificar(r.estado === 200 && filas.length > 0 && filas.every((f) => f.sku === 'SKU-001'), `CA-LP-01-1: 200 con existencias de SKU-001 por lote (${filas.length})`);
  verificar(filas.every((f) => f.cantidad_disponible === f.cantidad - f.cantidad_reservada), 'CA-LP-01-1: cantidad_disponible = cantidad - reservada');
  r = await http('GET', '/inventario?producto=SKU-001&ubicacion=A-01-01');
  verificar(r.estado === 200 && r.datos.existencias.every((f) => f.ubicacion === 'A-01-01'), 'CA-LP-01-1: filtro por producto y ubicacion');
  r = await http('GET', '/inventario');
  verificar(r.estado === 200 && r.datos.existencias.length >= 7, `CA-LP-01-2: sin filtros devuelve todas las existencias (${r.datos.existencias.length})`);
  r = await http('GET', '/inventario?producto=SKU-999');
  verificar(r.estado === 404, 'CA-LP-01-3: 404 con SKU inexistente');
  r = await http('GET', '/inventario?ubicacion=ZZ-99-99');
  verificar(r.estado === 404, 'ubicacion inexistente: 404');
}

async function hu02() {
  titulo('PRB-LP-02  HU-LP-02  Registrar lotes con vencimiento');
  const antes = (await resumen('SKU-002')).cantidad;
  const lote = `L-T${Date.now().toString(36).toUpperCase()}`;
  const cuerpo = { sku: 'SKU-002', codigo_lote: lote, ubicacion: 'A-01-01', cantidad: 7, fecha_vencimiento: fechaEnDias(60) };
  let r = await http('POST', '/lotes', cuerpo);
  verificar(r.estado === 201 && r.datos.lote.codigo_lote === lote, `CA-LP-02-1: 201 al registrar el lote ${lote}`);
  verificar((await resumen('SKU-002')).cantidad === antes + 7, 'CA-LP-02-1: la existencia aumento en 7');
  r = await http('POST', '/lotes', cuerpo);
  verificar(r.estado === 409, 'CA-LP-02-3: 409 con codigo de lote repetido');
  r = await http('POST', '/lotes', { ...cuerpo, codigo_lote: `${lote}X`, cantidad: 0 });
  verificar(r.estado === 400, 'CA-LP-02-2: 400 con cantidad 0');
  r = await http('POST', '/lotes', { ...cuerpo, codigo_lote: `${lote}Y`, fecha_vencimiento: fechaEnDias(-5) });
  verificar(r.estado === 400, 'CA-LP-02-2: 400 con fecha de vencimiento pasada');
}

async function hu04() {
  titulo('PRB-LP-03  HU-LP-04  Crear pedido validando disponibilidad');
  const antes = await resumen('SKU-001');
  let r = await http('POST', '/pedidos', { cliente: 'CLI-001', lineas: [{ sku: 'SKU-001', cantidad: 2 }] });
  verificar(r.estado === 201 && r.datos.pedido.estado === 'CREADO', `CA-LP-04-1: 201 con pedido CREADO (estado ${r.estado})`);
  ctx.pedidoId = r.datos.pedido && r.datos.pedido.id;
  const despues = await resumen('SKU-001');
  if (antes && despues) verificar(despues.reservada === antes.reservada + 2 && despues.cantidad === antes.cantidad, 'CA-LP-04-1: reservo 2 unidades sin descontar cantidad fisica');
  else console.log('SKIP  CA-LP-04-1: reserva visible en inventario (requiere HU-LP-01 integrada)');
  r = await http('POST', '/pedidos', { cliente: 'CLI-001', lineas: [{ sku: 'SKU-001', cantidad: 999999 }] });
  verificar(r.estado === 409 && r.datos.sku_faltante === 'SKU-001', 'CA-LP-04-2: 409 indicando el SKU faltante');
  const trasRechazo = await resumen('SKU-001');
  if (despues && trasRechazo) verificar(trasRechazo.reservada === despues.reservada, 'CA-LP-04-2: el rechazo no deja reservas parciales');
  else console.log('SKIP  CA-LP-04-2: sin reservas parciales (requiere HU-LP-01 integrada)');
  r = await http('POST', '/pedidos', { cliente: 'CLI-001', lineas: [] });
  verificar(r.estado === 400, 'CA-LP-04-3: 400 con pedido sin lineas');
  r = await http('POST', '/pedidos', { cliente: 'CLI-001', lineas: [{ sku: 'SKU-001', cantidad: -1 }] });
  verificar(r.estado === 400, 'CA-LP-04-3: 400 con cantidad no positiva');
  r = await http('POST', '/pedidos', { cliente: 'CLI-999', lineas: [{ sku: 'SKU-001', cantidad: 1 }] });
  verificar(r.estado === 404, 'cliente inexistente: 404');
}

async function hu05() {
  titulo('PRB-LP-04  HU-LP-05  Preparar pedido con descuento FEFO');
  if (!ctx.pedidoId) await hu04();
  const antes = await resumen('SKU-001');
  let r = await http('POST', `/pedidos/${ctx.pedidoId}/preparar`);
  verificar(r.estado === 200 && r.datos.pedido.estado === 'PREPARADO', `CA-LP-05-1: 200 con pedido PREPARADO (estado ${r.estado})`);
  const despues = await resumen('SKU-001');
  if (antes && despues) verificar(despues.cantidad === antes.cantidad - 2 && despues.reservada === antes.reservada - 2, 'CA-LP-05-1: descuento de 2 unidades en cantidad y reserva');
  else console.log('SKIP  CA-LP-05-1: descuento visible en inventario (requiere HU-LP-01 integrada)');
  const asign = (r.datos.pedido && r.datos.pedido.asignaciones) || [];
  if (antes && asign.length) {
    const esperado = antes.filas.find((f) => f.cantidad_reservada > 0) || antes.filas[0];
    verificar(asign[0].lote === esperado.lote, `CA-LP-05-1: FEFO, se tomo el lote con vencimiento mas cercano (${asign[0].lote})`);
  } else if (asign.length) console.log('SKIP  CA-LP-05-1: verificacion de lote FEFO (requiere HU-LP-01 integrada)');
  r = await http('POST', `/pedidos/${ctx.pedidoId}/preparar`);
  verificar(r.estado === 409, 'CA-LP-05-2: 409 si el pedido ya fue preparado');
  r = await http('POST', '/pedidos/999999/preparar');
  verificar(r.estado === 404, 'pedido inexistente: 404');
  console.log('Nota: el rollback (CA-LP-05-3) se prueba con: docker compose exec logistpulse-api node scripts/prueba_rollback.js');
}

const secciones = { health, hu01, hu02, hu04, hu05 };

(async () => {
  const pedida = process.argv[2] || 'all';
  const lista = pedida === 'all' ? Object.keys(secciones) : [pedida];
  if (lista.some((s) => !secciones[s])) {
    console.error(`Seccion desconocida: ${pedida}. Use: ${Object.keys(secciones).join(' | ')} | all`);
    process.exit(2);
  }
  console.log(`LOGISTPULSE smoke tests contra ${BASE}  (${new Date().toISOString()})`);
  for (const nombre of lista) await secciones[nombre]();
  console.log(`\nResultado: ${fallos === 0 ? 'TODAS LAS PRUEBAS PASARON' : `${fallos} PRUEBA(S) FALLARON`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((error) => { console.error('Error ejecutando las pruebas:', error.message); process.exit(1); });
