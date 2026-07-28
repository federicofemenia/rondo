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

Pendiente

## Alternativas

Prisma

Drizzle

TypeORM

## Estado

Se decidirá durante la implementación.

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