# AUTH

# Objetivo

Este documento define el proceso de autenticación y autorización de Rondo.

Su propósito es garantizar una experiencia de acceso simple, segura y consistente en toda la plataforma.

La autenticación identifica al usuario.

La autorización determina qué acciones puede realizar.

---

# Principios

La autenticación debe ser:

- rápida
- simple
- segura
- transparente

El usuario nunca debe autenticarse más veces de las necesarias.

---

# Registro

Todo usuario podrá crear una cuenta.

Datos requeridos:

- nombre
- apellido
- email
- sexo
- teléfono
- contraseña

Datos opcionales:

- foto de perfil
- deportes favoritos

Durante el registro nunca se solicitará:

- club
- reserva
- partido

---

# Inicio de sesión

El usuario podrá iniciar sesión utilizando:

- email
- contraseña

En futuras versiones podrán incorporarse otros proveedores.

Ejemplos:

- Google
- Apple

---

# Recuperación de contraseña

El usuario podrá solicitar la recuperación mediante email.

El enlace tendrá vencimiento.

Una vez utilizada la recuperación, el enlace dejará de ser válido.

---

# Persistencia de sesión

La sesión permanecerá iniciada hasta:

- cierre manual
- expiración
- revocación

---

# Cierre de sesión

El usuario podrá cerrar sesión desde cualquier dispositivo.

El cierre invalidará la sesión correspondiente.

---

# Autorización

La autenticación no implica permisos.

Cada acción deberá validar:

- identidad
- permisos
- contexto

---

# Roles

Por el momento existirán únicamente dos niveles.

## Usuario

Puede:

- crear partidos
- unirse a partidos
- reservar canchas si pertenece al club
- valorar jugadores

---

## Administrador del Club

Puede además:

- administrar canchas
- administrar promociones
- administrar reservas del club
- administrar miembros

---

# Permisos

Los permisos nunca dependerán únicamente del rol.

También deberán considerar:

- pertenencia al club
- participación en el partido
- estado de la reserva

---

# Sesiones

Un usuario podrá iniciar sesión desde múltiples dispositivos.

Cada sesión será independiente.

---

# Seguridad

Nunca almacenar:

- contraseñas en texto plano
- tokens inseguros

Las contraseñas deberán almacenarse utilizando algoritmos de hash seguros.

---

# Verificación

En una futura versión podrá incorporarse:

- verificación de email
- verificación de teléfono

La primera versión podrá funcionar sin estas validaciones.

---

# Eliminación de cuenta

El usuario podrá solicitar eliminar su cuenta.

La eliminación deberá respetar las políticas de retención de datos y auditoría.

---

# Auditoría

Registrar:

- registro
- inicio de sesión
- cierre de sesión
- recuperación de contraseña
- eliminación de cuenta

---

# Futuras mejoras

- Google Login
- Apple Login
- Passkeys
- Autenticación de dos factores (2FA)
- Inicio de sesión biométrico en aplicaciones móviles

---

# Principio

La autenticación debe ser prácticamente invisible para el usuario.

Cuanto menos tiempo dedique a iniciar sesión, más tiempo dedicará a organizar y disfrutar sus actividades deportivas.