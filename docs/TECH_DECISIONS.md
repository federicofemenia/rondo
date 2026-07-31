# TECH DECISIONS

# Objetivo

Este documento registra las decisiones técnicas relevantes del proyecto.

Cada decisión deberá documentar:

- contexto
- alternativas consideradas
- decisión tomada
- justificación
- consecuencias

El objetivo es preservar el conocimiento arquitectónico del proyecto y facilitar futuras revisiones.

---

# TD-001

## Título

Monorepo

## Estado

Aceptada

## Contexto

Rondo está compuesto por múltiples aplicaciones que compartirán código.

- Web
- API
- futuros clientes móviles
- librerías compartidas

## Alternativas

- Monorepo
- Múltiples repositorios

## Decisión

Utilizar un único monorepo.

## Justificación

Permite compartir:

- tipos
- contratos
- utilidades
- configuración

Reduce duplicación y simplifica el desarrollo.

---

# TD-002

## Título

Frontend

## Estado

Aceptada

## Decisión

React

TypeScript

Vite

Material UI

TanStack Query

## Justificación

Stack ampliamente adoptado.

Excelente experiencia de desarrollo.

Gran ecosistema.

Preparado para PWA.

---

# TD-003

## Título

Backend

## Estado

Aceptada

## Decisión

Node.js

TypeScript

REST API

## Justificación

Lenguaje único en frontend y backend.

Facilita compartir contratos y tipos.

---

# TD-004

## Título

Base de datos

## Estado

Aceptada

## Decisión

PostgreSQL

Proveedor inicial:

Neon

## Justificación

Excelente soporte relacional.

Integridad.

Escalabilidad.

Consultas complejas.

---

# TD-005

## Título

Arquitectura

## Estado

Aceptada

## Decisión

DDD

Hexagonal

Clean Architecture

Feature Based

## Justificación

Favorece:

- mantenibilidad
- escalabilidad
- testing

---

# TD-006

## Título

Aplicación móvil

## Estado

Aceptada

## Decisión

Desarrollar primero una PWA.

Evaluar posteriormente Capacitor.

## Justificación

Permite validar el producto rápidamente.

Comparte la mayor parte del código.

---

# TD-007

## Título

Storage

## Estado

Aceptada

## Decisión

Las imágenes no se almacenarán en PostgreSQL.

Se utilizará Object Storage.

## Justificación

Reduce tamaño de la base.

Mejor escalabilidad.

---

# TD-008

## Título

Autenticación

## Estado

Pendiente

## Alternativas

JWT

Clerk

Auth0

Supabase Auth

Firebase Auth

## Estado

Se decidirá durante la implementación.

---

# TD-009

## Título

ORM

## Estado

Aceptada

## Alternativas

Prisma

Drizzle

TypeORM

## Decisión

Prisma

## Justificación

Buen soporte de tipos con TypeScript.

Migraciones integradas.

Curva de adopción baja para el equipo.

## Consecuencias

El schema vive en `apps/backend/src/infrastructure/database/schema.prisma`.

Las migraciones se generan junto al schema, dentro de `infrastructure/database/`.

---

# TD-010

## Título

Push Notifications

## Estado

Pendiente

## Alternativas

Firebase Cloud Messaging

OneSignal

Otros proveedores

## Estado

Se decidirá durante la implementación.

---

# TD-011

## Título

Mapas

## Estado

Pendiente

## Alternativas

Google Maps

Mapbox

OpenStreetMap

## Estado

Se evaluará durante el desarrollo.

---

# TD-012

## Título

Testing

## Estado

Aceptada

## Estrategia

Priorizar:

- Unit Tests
- Integration Tests
- End-to-End

Las pruebas deberán concentrarse principalmente en los casos de uso y reglas del dominio.

---

# TD-013

## Título

CI/CD

## Estado

Pendiente

## Objetivo

Automatizar:

- tests
- lint
- build
- deploy

---

# TD-014

## Título

Actualización automática sin WebSockets (beta)

## Estado

Aceptada

## Decisión

Polling visible, por pantalla, mediante un hook reutilizable (`useVisiblePolling`), no un scheduler global ni un endpoint de resumen nuevo.

Reglas:

- Home, Mis invitaciones, MatchDetail y la pestaña Jugadores refrescan cada 20 segundos mientras `document.visibilityState === "visible"`.
- El polling se detiene por completo (no se reduce) cuando la pestaña queda oculta.
- Al volver a estar visible, al recuperar foco de la ventana o al recuperar conectividad (`online`), se refresca de inmediato.
- Cada pantalla reutiliza su propia función de carga existente (`loadAccountData`, fetch de invitaciones, fetch de participantes); no se creó `/me/pending-summary` ni ningún endpoint agregador.
- Una actualización silenciosa nunca reemplaza los datos visibles por un spinner ni por un error invasivo: si falla, se reintenta en el siguiente ciclo y se conserva la última información válida.
- Un guard de concurrencia evita solicitudes superpuestas si el ciclo anterior no terminó (relevante cuando el backend gratuito de Render está despertando).
- El chat mantiene su polling propio de 10 segundos, activo únicamente mientras la pestaña Chat está montada; este mecanismo no lo reemplaza ni lo duplica.
- No existe sincronización mientras la aplicación está completamente cerrada (sin pestaña abierta); el polling depende de que el documento exista en el navegador.

## Justificación

Da una sensación de "tiempo real" razonable para una beta cerrada sin el costo de infraestructura de WebSockets/SSE, evitando además el resource-usage de un intervalo global corriendo durante toda la sesión sin importar la pantalla activa.

## Futuro

Cuando se justifique (mayor escala, latencia esperada menor), migrar a WebSockets o Server-Sent Events reemplazaría este polling sin cambiar el contrato de las pantallas (siguen "suscribiéndose" a una señal de actualización, solo cambia cómo se dispara).

---

# Revisión

Las decisiones técnicas podrán modificarse.

Toda modificación deberá:

- documentarse
- justificar el cambio
- registrar la fecha
- indicar el impacto sobre el proyecto

---

# Principio

Las decisiones técnicas deberán priorizar la simplicidad, mantenibilidad y evolución del producto.

Nunca se adoptará una tecnología únicamente por tendencia o novedad.