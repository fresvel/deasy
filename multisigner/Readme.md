# Generación de un Certificado .p12 Autofirmado

# 📋 Requisitos Previos
# Verificar si OpenSSL está instalado
openssl version

# 🚀 Pasos para Generar el Certificado

# 1️⃣ Generar una Clave Privada
openssl genrsa -out private.key 2048
# private.key: Archivo que contendrá la clave privada de 2048 bits.

# 2️⃣ Crear una Solicitud de Firma de Certificado (CSR)
openssl req -new -key private.key -out request.csr
# Se pedirá ingresar datos como:
# - País (C)
# - Estado (ST)
# - Localidad (L)
# - Organización (O)
# - Nombre común (CN) → Importante usar el dominio o nombre que identificará el certificado.

# 3️⃣ Generar el Certificado Autofirmado
openssl x509 -req -days 365 -in request.csr -signkey private.key -out certificate.crt
# -days 365: Certificado válido por 1 año (ajustable).
# certificate.crt: Archivo resultante del certificado autofirmado.

# 4️⃣ Convertir el Certificado y la Clave en un Archivo .p12
openssl pkcs12 -export -out certificate.p12 -inkey private.key -in certificate.crt
# Se pedirá establecer una contraseña para proteger el archivo .p12.

# 🔍 Verificar el Contenido del Archivo .p12
openssl pkcs12 -info -in certificate.p12
# Introducir la contraseña para ver los detalles del certificado.

# 🗑️ Limpieza de Archivos Temporales (Opcional)
rm private.key request.csr certificate.crt
# Elimina los archivos intermedios si solo necesitas el .p12.

# ✅ Resultado Final
# certificate.p12: Contiene el certificado y la clave privada protegidos por una contraseña.
# Uso: Ideal para sistemas que requieren autenticación segura basada en certificados.
