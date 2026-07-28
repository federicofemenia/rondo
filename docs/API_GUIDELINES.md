# API GUIDELINES

# Objetivo

Este documento establece los estándares para el diseño e implementación de las APIs de Rondo.

Todas las APIs deberán seguir estas convenciones para garantizar consistencia, mantenibilidad y una buena experiencia para consumidores internos y externos.

---

# Arquitectura

Las APIs seguirán el estilo REST.

Los recursos representan entidades del dominio.

Las URLs deberán representar sustantivos, nunca acciones.

Correcto:

GET /matches

Incorrecto:

GET /createMatch

---

# Versionado

Todas las APIs deberán estar versionadas.

Ejemplo:

/api/v1

Una nueva versión nunca deberá romper la anterior.

---

# Formato

Todas las APIs consumirán y devolverán JSON.

Content-Type:

application/json

---

# Convenciones de nombres

Las URLs utilizarán:

kebab-case

Ejemplos:

match-participants

notification-settings

---

# Métodos HTTP

GET

Obtiene información.

No modifica estado.

---

POST

Crea recursos.

---

PUT

Reemplaza completamente un recurso.

---

PATCH

Actualiza parcialmente un recurso.

---

DELETE

Elimina o desactiva un recurso según corresponda.

---

# Códigos HTTP

200 OK

Consulta exitosa.

---

201 Created

Recurso creado correctamente.

---

204 No Content

Operación exitosa sin contenido.

---

400 Bad Request

Solicitud inválida.

---

401 Unauthorized

Usuario no autenticado.

---

403 Forbidden

Usuario autenticado sin permisos.

---

404 Not Found

Recurso inexistente.

---

409 Conflict

Conflicto de negocio.

Ejemplo:

Reserva duplicada.

---

422 Unprocessable Entity

Reglas de negocio incumplidas.

---

500 Internal Server Error

Error inesperado.

---

# Formato de respuesta

Respuesta exitosa

{
  "data": {}
}

---

Colecciones

{
  "data": [],
  "pagination": {}
}

---

Errores

{
  "error": {
    "code": "...",
    "message": "...",
    "details": []
  }
}

---

# Paginación

Todas las colecciones deberán soportar paginación.

Parámetros:

page

pageSize

Respuesta:

total

page

pageSize

totalPages

---

# Ordenamiento

Las colecciones deberán permitir:

sortBy

sortDirection

Ejemplo:

createdAt

name

rating

---

# Filtros

Los filtros deberán enviarse mediante query params.

Ejemplos:

sportId

clubId

status

date

---

# Fechas

Todas las fechas se almacenarán y transmitirán en UTC.

Formato:

ISO 8601

Ejemplo:

2026-08-05T19:00:00Z

La conversión al huso horario del usuario será responsabilidad del frontend.

---

# Identificadores

Todas las entidades utilizarán UUID.

Nunca IDs autoincrementales expuestos públicamente.

---

# Idempotencia

Las operaciones críticas deberán ser idempotentes siempre que sea posible.

Especialmente:

- pagos
- reservas
- invitaciones

---

# Validaciones

Las validaciones de negocio pertenecen al backend.

El frontend podrá validar para mejorar la experiencia del usuario, pero nunca será la única validación.

---

# Seguridad

Todas las APIs privadas requerirán autenticación.

La autorización se evaluará en cada operación.

---

# Autorización

Nunca confiar en datos enviados por el cliente.

Todos los permisos deberán verificarse utilizando el usuario autenticado.

---

# Soft Delete

Los recursos eliminados no deberán desaparecer físicamente salvo casos específicos.

Las APIs deberán respetar esta política.

---

# Auditoría

Las operaciones críticas deberán registrar:

- usuario
- fecha
- acción
- entidad afectada

---

# Performance

Las APIs deberán evitar:

- consultas N+1
- payloads innecesarios
- información duplicada

---

# Evolución

Las APIs deberán diseñarse pensando en futuras aplicaciones:

- Web
- Mobile
- Integraciones
- Partners

---

# Principios

Las APIs deben ser:

- predecibles
- consistentes
- seguras
- simples
- fáciles de consumir

Antes de crear un nuevo endpoint deberá responderse:

¿Ya existe una forma consistente de resolver este caso utilizando las reglas establecidas?