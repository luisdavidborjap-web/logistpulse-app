-- LOGISTPULSE - esquema y datos semilla (TEC-LP-03). Se ejecuta solo al crear el volumen logistpulse_pgdata.
CREATE TABLE productos (
  id           SERIAL PRIMARY KEY,
  sku          VARCHAR(30) NOT NULL UNIQUE,
  nombre       VARCHAR(100) NOT NULL,
  stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0)
);

CREATE TABLE ubicaciones (
  id           SERIAL PRIMARY KEY,
  codigo       VARCHAR(20) NOT NULL UNIQUE,
  descripcion  VARCHAR(100)
);

CREATE TABLE lotes (
  id                 SERIAL PRIMARY KEY,
  producto_id        INTEGER NOT NULL REFERENCES productos(id),
  codigo_lote        VARCHAR(30) NOT NULL,
  fecha_vencimiento  DATE NOT NULL,
  UNIQUE (producto_id, codigo_lote)
);

CREATE TABLE existencias (
  id                  SERIAL PRIMARY KEY,
  lote_id             INTEGER NOT NULL REFERENCES lotes(id),
  ubicacion_id        INTEGER NOT NULL REFERENCES ubicaciones(id),
  cantidad            INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  cantidad_reservada  INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
  CHECK (cantidad_reservada <= cantidad),
  UNIQUE (lote_id, ubicacion_id)
);

CREATE TABLE clientes (
  id      SERIAL PRIMARY KEY,
  codigo  VARCHAR(20) NOT NULL UNIQUE,
  nombre  VARCHAR(100) NOT NULL
);

CREATE TABLE pedidos (
  id            SERIAL PRIMARY KEY,
  cliente_id    INTEGER NOT NULL REFERENCES clientes(id),
  estado        VARCHAR(15) NOT NULL CHECK (estado IN ('CREADO', 'PREPARADO', 'DESPACHADO', 'ENTREGADO')),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  preparado_en  TIMESTAMPTZ
);

CREATE TABLE detalle_pedido (
  id           SERIAL PRIMARY KEY,
  pedido_id    INTEGER NOT NULL REFERENCES pedidos(id),
  producto_id  INTEGER NOT NULL REFERENCES productos(id),
  cantidad     INTEGER NOT NULL CHECK (cantidad > 0)
);

-- Reserva FEFO: de que existencia (lote y ubicacion) saldra cada parte del pedido.
CREATE TABLE asignaciones_pedido (
  id            SERIAL PRIMARY KEY,
  pedido_id     INTEGER NOT NULL REFERENCES pedidos(id),
  existencia_id INTEGER NOT NULL REFERENCES existencias(id),
  producto_id   INTEGER NOT NULL REFERENCES productos(id),
  cantidad      INTEGER NOT NULL CHECK (cantidad > 0)
);

CREATE TABLE movimientos_inventario (
  id            SERIAL PRIMARY KEY,
  pedido_id     INTEGER REFERENCES pedidos(id),
  producto_id   INTEGER NOT NULL REFERENCES productos(id),
  lote_id       INTEGER NOT NULL REFERENCES lotes(id),
  ubicacion_id  INTEGER NOT NULL REFERENCES ubicaciones(id),
  cantidad      INTEGER NOT NULL CHECK (cantidad > 0),
  tipo          VARCHAR(20) NOT NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Datos semilla (ficticios). Las fechas de vencimiento son relativas a la creacion de la base.
INSERT INTO productos (sku, nombre, stock_minimo) VALUES
  ('SKU-001', 'Leche entera 1 L',      10),
  ('SKU-002', 'Arroz 1 kg',             5),
  ('SKU-003', 'Aceite de cocina 1 L',  20),
  ('SKU-004', 'Cafe molido 500 g',      5),
  ('SKU-005', 'Atun en lata',          10);

INSERT INTO ubicaciones (codigo, descripcion) VALUES
  ('A-01-01', 'Pasillo A, rack 1, nivel 1'),
  ('A-01-02', 'Pasillo A, rack 1, nivel 2'),
  ('B-02-01', 'Pasillo B, rack 2, nivel 1');

INSERT INTO clientes (codigo, nombre) VALUES
  ('CLI-001', 'Supermercado Central'),
  ('CLI-002', 'Tienda La Esquina');

INSERT INTO lotes (producto_id, codigo_lote, fecha_vencimiento)
SELECT p.id, v.codigo, CURRENT_DATE + v.dias
  FROM (VALUES ('SKU-001', 'L-001-A', 30), ('SKU-001', 'L-001-B', 90),
               ('SKU-002', 'L-002-A', 45),
               ('SKU-003', 'L-003-A', 20), ('SKU-003', 'L-003-B', 120),
               ('SKU-004', 'L-004-A', 60),
               ('SKU-005', 'L-005-A', 200)) AS v(sku, codigo, dias)
  JOIN productos p ON p.sku = v.sku;

INSERT INTO existencias (lote_id, ubicacion_id, cantidad)
SELECT l.id, u.id, v.cantidad
  FROM (VALUES ('L-001-A', 'A-01-01', 40), ('L-001-B', 'A-01-02', 60),
               ('L-002-A', 'A-01-01', 50),
               ('L-003-A', 'B-02-01', 30), ('L-003-B', 'B-02-01', 100),
               ('L-004-A', 'A-01-02', 15),
               ('L-005-A', 'B-02-01', 80)) AS v(lote, ubicacion, cantidad)
  JOIN lotes l ON l.codigo_lote = v.lote
  JOIN ubicaciones u ON u.codigo = v.ubicacion;
