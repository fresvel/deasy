# Operacion - Troubleshooting

## Problemas frecuentes

1) MariaDB: Field 'template_version_id' doesn't have a default value
- Causa: columna legacy en process_templates.
- Accion: revisar schema y migraciones antes de operar.

2) Permisos de storage compartido
- Verificar SHARED_STORAGE_ROOT y permisos del contenedor backend.

3) EMQX en modo anonymous
- En docker-compose se permite anonymous; ajustar para prod.

4) Servicios docker no inician
- Verificar docker daemon y docker compose.
- Revisar variables en docker/.env.

