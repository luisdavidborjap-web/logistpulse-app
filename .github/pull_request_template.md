## Resumen
<!-- Que cambia y por que (1 a 3 lineas). -->

## Trazabilidad
- Historias / tareas: <!-- por ejemplo HU-LP-01, HU-LP-02 o TEC-LP-01 -->
- Criterios de aceptacion cubiertos: <!-- por ejemplo CA-LP-01-1 a CA-LP-01-3 -->
- Componentes MVC: <!-- por ejemplo MVC-LP-01, MVC-LP-06, MVC-LP-11 -->
- Servicio Docker: <!-- SVC-LP-01 / SVC-LP-02 -->
- PR: <!-- PR-LP-0N -->

## Pruebas ejecutadas
<!-- Comando y resultado, por ejemplo: docker compose exec logistpulse-api node scripts/smoke.js hu01 -> PASS -->

## Lista de verificacion (Definition of Done)
- [ ] La rama sigue la convencion feature/<ID>-<descripcion>
- [ ] Los commits tienen mensajes descriptivos <tipo>(<ID>): <descripcion>
- [ ] Todos los criterios de aceptacion se verificaron con una prueba ejecutada
- [ ] `docker compose up --build` levanta y GET /health responde 200
- [ ] No hay secretos en el repositorio (solo .env.example)
- [ ] README actualizado si cambia como levantar o probar el entorno
- [ ] Un companero reviso este PR
