"""Red de pruebas del microservicio de firma.

Se ejecuta SIEMPRE dentro del contenedor:

    bash scripts/docker-env.sh dev exec -T signer python -m unittest discover -s tests -t . -v

No hay pytest en la imagen (ver `signer/requirements.txt`): la red usa solo
`unittest` de la biblioteca estándar, para no añadir dependencias a un servicio
que firma documentos legales.

Ninguna prueba abre red ni toca MinIO/RabbitMQ reales: todo lo que sale del
proceso está sustituido por dobles.
"""

import logging

# `app.py` registra en INFO al importarse y en varios caminos de error que las
# pruebas recorren a propósito. Se silencia para que la salida de la suite sea
# legible; las aserciones no dependen del log.
logging.disable(logging.CRITICAL)
