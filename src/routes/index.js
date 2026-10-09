// Rutas de LOGISTPULSE: cada ruta delega en un Controlador (MVC).
const router = require('express').Router();
const SaludController = require('../controllers/SaludController');
const InventarioController = require('../controllers/InventarioController');
const PedidoController = require('../controllers/PedidoController');

router.get('/health', SaludController.estado);
router.get('/inventario', InventarioController.consultar);
router.post('/lotes', InventarioController.registrarLote);
router.post('/pedidos', PedidoController.crear);
router.post('/pedidos/:id/preparar', PedidoController.preparar);

module.exports = router;
