// Rutas de LOGISTPULSE: cada ruta delega en un Controlador (MVC).
// Los controladores se cargan de forma perezosa: si un controlador aun no existe en la rama
// (historia pendiente de integrar), la ruta responde 501 en lugar de romper el arranque.
// Gracias a esto este archivo no cambia al integrar cada historia y los Pull Requests no chocan.
const router = require('express').Router();

function ruta(archivo, metodo, historia) {
  return (req, res, next) => {
    let controlador;
    try {
      controlador = require(`../controllers/${archivo}`);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND' && String(error.message).includes(`controllers/${archivo}`)) {
        return res.status(501).json({ error: `Pendiente de implementar (${historia})`, controlador: archivo, metodo });
      }
      return next(error);
    }
    return controlador[metodo](req, res, next);
  };
}

router.get('/health', ruta('SaludController', 'estado', 'TEC-LP-02'));
router.get('/inventario', ruta('InventarioController', 'consultar', 'HU-LP-01'));
router.post('/lotes', ruta('InventarioController', 'registrarLote', 'HU-LP-02'));
router.post('/pedidos', ruta('PedidoController', 'crear', 'HU-LP-04'));
router.post('/pedidos/:id/preparar', ruta('PedidoController', 'preparar', 'HU-LP-05'));

module.exports = router;
