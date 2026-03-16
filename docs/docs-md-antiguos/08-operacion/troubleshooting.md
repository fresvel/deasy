# Operacion - Troubleshooting

## Problemas frecuentes

1) MariaDB: errores por columnas legacy o esquema desalineado
- Causa: backend nuevo ejecutandose contra una base no reseteada o desactualizada.
- Accion: recrear esquema o correr las migraciones correspondientes antes de operar.

2) MinIO no visible o rutas faltantes
- Verificar buckets, prefijos y credenciales de MinIO.
- Confirmar que `docker compose up -d --force-recreate backend` se haya ejecutado si cambiaste mounts o env.

3) EMQX en modo anonymous
- En docker-compose se permite anonymous; ajustar para prod.

4) Servicios docker no inician
- Verificar docker daemon y docker compose.
- Revisar variables en docker/.env.
