// LOGISTPULSE - punto de entrada de la API (Express + EJS).
const path = require('path');
const express = require('express');
const rutas = require('./routes');
const { esperarBaseDeDatos } = require('./config/db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Responde con la Vista EJS (HTML) o con JSON segun la cabecera Accept o ?formato=json.
app.use((req, res, next) => {
  res.quiereJson = req.query.formato === 'json' || req.accepts(['html', 'json']) === 'json';
  res.responder = (vista, datos, estado = 200) => {
    res.status(estado);
    return res.quiereJson ? res.json(datos) : res.render(vista, datos);
  };
  next();
});

app.use('/', rutas);

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalido' });
  console.error(error);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

async function iniciar() {
  await esperarBaseDeDatos();
  const puerto = parseInt(process.env.PORT || '3000', 10);
  app.listen(puerto, () => console.log(`[logistpulse-api] escuchando en el puerto ${puerto}`));
}

if (require.main === module) {
  iniciar().catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = app;
