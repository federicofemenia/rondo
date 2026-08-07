# REPOSITORY STRUCTURE

# Objetivo

Este documento define la estructura oficial del repositorio de Rondo.

Su propósito es:

* mantener una organización predecible;
* separar responsabilidades;
* facilitar el trabajo entre frontend, backend y paquetes compartidos;
* evitar dependencias incorrectas;
* permitir que nuevas aplicaciones se incorporen sin reorganizar el proyecto.

Toda nueva carpeta deberá respetar esta estructura.

---

# Enfoque

Rondo utilizará un monorepo.

El repositorio contendrá:

* aplicaciones ejecutables;
* paquetes compartidos;
* configuración;
* documentación;
* herramientas internas.

La estructura combinará:

* organización por aplicación;
* organización por dominio;
* arquitectura hexagonal;
* separación entre código de negocio e infraestructura.

---

# Estructura general

```text
rondo/
├── apps/
│   ├── frontend/
│   └── backend/
│
├── packages/
│   ├── contracts/
│   ├── domain/
│   ├── shared/
│   ├── ui/
│   ├── config/
│   └── testing/
│
├── docs/
│   ├── features/
│   └── design/
│
├── tooling/
│
├── .github/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
└── README.md
```

---

# Gestor del monorepo

Se utilizará:

```text
pnpm workspaces
```

Podrá evaluarse Turborepo para:

* cachear builds;
* ejecutar tareas en paralelo;
* optimizar CI/CD;
* administrar dependencias entre paquetes.

La incorporación de Turborepo deberá registrarse en `TECH_DECISIONS.md`.

---

# Apps

La carpeta `apps` contiene aplicaciones ejecutables.

Cada aplicación puede depender de paquetes compartidos.

Los paquetes compartidos no deberán depender de las aplicaciones.

---

# Frontend

Ruta:

```text
apps/frontend/
```

Responsabilidad:

* interfaz de usuario;
* navegación;
* interacción con la API;
* experiencia PWA;
* integración con capacidades del dispositivo;
* gestión de estado del servidor;
* estado visual local.

Estructura:

```text
apps/frontend/
├── public/
│
├── src/
│   ├── app/
│   ├── features/
│   ├── pages/
│   ├── layouts/
│   ├── providers/
│   ├── routes/
│   ├── infrastructure/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   ├── styles/
│   └── main.tsx
│
├── tests/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

# Frontend: app

Ruta:

```text
apps/frontend/src/app/
```

Contiene la configuración general de la aplicación.

Ejemplos:

* inicialización;
* theme;
* QueryClient;
* manejo global de errores;
* configuración de providers;
* configuración PWA.

No deberá contener lógica específica de un dominio.

---

# Frontend: features

Ruta:

```text
apps/frontend/src/features/
```

Cada funcionalidad se organiza por dominio.

Ejemplo:

```text
features/
├── auth/
├── users/
├── clubs/
├── courts/
├── bookings/
├── matches/
├── match-chat/
├── invitations/
├── reputation/
├── notifications/
├── promotions/
└── search/
```

Cada feature podrá contener:

```text
matches/
├── api/
├── application/
├── components/
├── hooks/
├── pages/
├── schemas/
├── types/
└── index.ts
```

---

# Frontend: api

Ruta de ejemplo:

```text
apps/frontend/src/features/matches/api/
```

Contiene:

* llamadas HTTP;
* query keys;
* funciones de consulta;
* funciones de mutación;
* mapeo entre DTOs y modelos de presentación.

No deberá contener reglas de negocio.

---

# Frontend: application

Ruta de ejemplo:

```text
apps/frontend/src/features/matches/application/
```

Contiene lógica de aplicación propia del frontend.

Ejemplos:

* orquestación de formularios;
* adaptación de datos;
* reglas de presentación;
* coordinación de casos de uso;
* construcción de view models.

No deberá reemplazar al dominio del backend.

---

# Frontend: components

Ruta de ejemplo:

```text
apps/frontend/src/features/matches/components/
```

Contiene componentes visuales específicos del dominio.

Ejemplos:

* MatchCard;
* MatchParticipants;
* MatchStatusChip;
* MatchActions;
* MatchForm.

Un componente utilizado por varias features deberá trasladarse a:

```text
packages/ui
```

o a:

```text
apps/frontend/src/components
```

según su alcance.

---

# Frontend: pages

Ruta:

```text
apps/frontend/src/pages/
```

Contiene páginas de nivel de navegación.

Las páginas deberán:

* componer features;
* controlar layout;
* recibir parámetros de ruta;
* manejar estados generales de la pantalla.

Las páginas no deberán contener lógica de negocio compleja.

---

# Frontend: infrastructure

Ruta:

```text
apps/frontend/src/infrastructure/
```

Contiene adaptadores vinculados al navegador o al dispositivo.

Ejemplos:

```text
infrastructure/
├── auth/
├── camera/
├── notifications/
├── location/
├── share/
├── storage/
└── deep-links/
```

Aquí vivirán implementaciones como:

* SessionAuthAdapter;
* BrowserLocationAdapter;
* WebCameraAdapter;
* BrowserStorageAdapter;
* WebShareAdapter;
* PushNotificationAdapter.

---

# Frontend: providers

Ruta:

```text
apps/frontend/src/providers/
```

Contiene los providers de React necesarios para exponer dependencias.

Ejemplos:

* AuthProvider;
* ThemeProvider;
* NotificationProvider;
* LocationProvider;
* StorageProvider.

Los providers deberán depender de interfaces, no de detalles de implementación cuando sea posible.

---

# Backend

Ruta:

```text
apps/backend/
```

Responsabilidad:

* exponer la API REST;
* ejecutar casos de uso;
* validar permisos;
* acceder a persistencia;
* integrar servicios externos;
* aplicar reglas de negocio;
* publicar eventos internos.

Estructura:

```text
apps/backend/
├── src/
│   ├── app/
│   ├── modules/
│   ├── infrastructure/
│   ├── shared/
│   ├── config/
│   └── main.ts
│
├── tests/
├── tsconfig.json
└── package.json
```

---

# Backend: app

Ruta:

```text
apps/backend/src/app/
```

Contiene:

* inicialización del servidor;
* registro de rutas;
* middlewares globales;
* manejo de errores;
* composición de dependencias;
* configuración general.

No deberá contener reglas de negocio.

---

# Backend: modules

Ruta:

```text
apps/backend/src/modules/
```

Cada dominio tendrá su propio módulo.

Ejemplo:

```text
modules/
├── auth/
├── users/
├── clubs/
├── sports/
├── courts/
├── bookings/
├── matches/
├── match-chat/
├── invitations/
├── reputation/
├── notifications/
├── promotions/
└── search/
```

Estructura recomendada por módulo:

```text
matches/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── index.ts
```

---

# Backend: domain

Ruta de ejemplo:

```text
apps/backend/src/modules/matches/domain/
```

Contiene la lógica central del negocio.

Ejemplo:

```text
domain/
├── entities/
├── value-objects/
├── enums/
├── events/
├── services/
├── repositories/
├── errors/
└── policies/
```

Puede contener:

* entidades;
* value objects;
* reglas;
* invariantes;
* eventos de dominio;
* interfaces de repositorio;
* servicios de dominio.

No puede depender de:

* Express;
* Fastify;
* PostgreSQL;
* Clerk;
* Prisma;
* Drizzle;
* APIs externas.

---

# Backend: application

Ruta de ejemplo:

```text
apps/backend/src/modules/matches/application/
```

Contiene los casos de uso.

Ejemplo:

```text
application/
├── commands/
├── queries/
├── use-cases/
├── dto/
├── ports/
└── mappers/
```

Responsabilidades:

* coordinar entidades;
* ejecutar casos de uso;
* validar autorización de aplicación;
* utilizar repositorios;
* publicar eventos;
* controlar transacciones.

Ejemplos:

* CreateMatch;
* JoinMatch;
* CancelMatch;
* RemoveParticipant;
* LinkBookingToMatch;
* CompleteMatch.

---

# Backend: infrastructure

Ruta de ejemplo:

```text
apps/backend/src/modules/matches/infrastructure/
```

Contiene implementaciones técnicas.

Ejemplo:

```text
infrastructure/
├── persistence/
├── repositories/
├── messaging/
├── jobs/
└── external-services/
```

Ejemplos:

* PostgresMatchRepository;
* DrizzleMatchMapper;
* MatchExpirationJob;
* NotificationPublisherAdapter.

---

# Backend: presentation

Ruta de ejemplo:

```text
apps/backend/src/modules/matches/presentation/
```

Contiene la exposición HTTP del módulo.

Ejemplo:

```text
presentation/
├── controllers/
├── routes/
├── schemas/
├── presenters/
└── middlewares/
```

Responsabilidades:

* recibir requests;
* validar formato;
* transformar DTOs;
* ejecutar casos de uso;
* devolver respuestas HTTP.

No deberá contener reglas de negocio.

---

# Infrastructure global

Ruta:

```text
apps/backend/src/infrastructure/
```

Contiene infraestructura transversal.

Ejemplos:

```text
infrastructure/
├── database/
├── auth/
├── storage/
├── email/
├── notifications/
├── logging/
├── observability/
└── queue/
```

Aquí podrán existir:

* conexión a Neon;
* cliente ORM;
* hashing de contraseñas y sesiones;
* Object Storage;
* servicio de email;
* push notifications;
* logging;
* métricas;
* colas.

---

# Packages

La carpeta `packages` contiene código reutilizable entre aplicaciones.

---

# Contracts

Ruta:

```text
packages/contracts/
```

Contiene contratos compartidos entre frontend y backend.

Ejemplos:

* request DTOs;
* response DTOs;
* enums públicos;
* esquemas de validación;
* tipos de paginación;
* códigos de error públicos;
* eventos de integración.

Ejemplo:

```text
contracts/
├── auth/
├── users/
├── clubs/
├── bookings/
├── matches/
└── shared/
```

Los contratos no deberán exponer entidades internas del dominio.

---

# Domain

Ruta:

```text
packages/domain/
```

Solo deberá utilizarse si existen elementos de dominio realmente compartidos.

Ejemplos posibles:

* identificadores;
* fechas;
* tipos de deporte;
* value objects sin dependencias;
* errores base.

No deberá convertirse en una carpeta genérica donde se mezclen todos los dominios.

La lógica exclusiva del backend permanecerá en `apps/backend`.

---

# Shared

Ruta:

```text
packages/shared/
```

Contiene utilidades técnicas reutilizables.

Ejemplos:

* manejo de fechas;
* helpers;
* tipos genéricos;
* utilidades de validación;
* funciones puras.

No deberá contener reglas de negocio específicas.

---

# UI

Ruta:

```text
packages/ui/
```

Contiene el sistema de componentes reutilizables.

Ejemplo:

```text
ui/
├── components/
├── theme/
├── tokens/
├── icons/
├── hooks/
└── index.ts
```

Ejemplos de componentes:

* Button;
* Card;
* Avatar;
* EmptyState;
* LoadingState;
* SportChip;
* RatingStars;
* ConfirmationDialog.

Todos los componentes deberán respetar `DESIGN_SYSTEM.md`.

---

# Config

Ruta:

```text
packages/config/
```

Contiene configuraciones compartidas.

Ejemplos:

* TypeScript;
* ESLint;
* Prettier;
* Vitest;
* Playwright;
* Vite.

---

# Testing

Ruta:

```text
packages/testing/
```

Contiene herramientas compartidas de testing.

Ejemplos:

* factories;
* fixtures;
* mocks;
* test builders;
* helpers;
* servidores simulados.

No deberá contener tests específicos de una aplicación.

---

# Tooling

Ruta:

```text
tooling/
```

Contiene scripts internos del repositorio.

Ejemplos:

* generación de código;
* validación de arquitectura;
* seeds;
* migraciones auxiliares;
* mantenimiento;
* chequeo de contratos;
* validación de documentación.

---

# Documentación

Ruta:

```text
docs/
```

Contiene toda la documentación funcional y técnica.

Estructura:

```text
docs/
├── PROJECT.md
├── BUSINESS_RULES.md
├── DATABASE.md
├── ARCHITECTURE.md
├── API_GUIDELINES.md
├── UI_GUIDELINES.md
├── DESIGN_SYSTEM.md
├── ROADMAP.md
├── TECH_DECISIONS.md
├── PRODUCT_DECISIONS.md
├── REPOSITORY_STRUCTURE.md
│
├── features/
│   ├── AUTH.md
│   ├── USERS.md
│   ├── CLUBS.md
│   ├── SPORTS.md
│   ├── COURTS.md
│   ├── BOOKINGS.md
│   ├── MATCHES.md
│   ├── MATCH_CHAT.md
│   ├── INVITATIONS.md
│   ├── PLAYER_REPUTATION.md
│   ├── NOTIFICATIONS.md
│   ├── PROMOTIONS.md
│   └── SEARCH.md
│
└── design/
    ├── BRAND.md
    ├── ICONOGRAPHY.md
    ├── MOTION.md
    └── COPYWRITING.md
```

La documentación deberá actualizarse antes o junto con los cambios de implementación.

---

# Dependencias permitidas

La dirección general de dependencias deberá ser:

```text
presentation
    ↓
application
    ↓
domain
```

La infraestructura implementa interfaces definidas por capas internas.

```text
infrastructure
    ↓
application ports
    ↓
domain
```

El dominio no conoce la infraestructura.

---

# Regla entre módulos

Un módulo no deberá acceder directamente a las tablas internas de otro módulo.

Ejemplo incorrecto:

```text
MatchesRepository consultando directamente tablas de Bookings
```

Ejemplo correcto:

```text
Match application service
    ↓
BookingQueryPort
    ↓
Bookings module
```

La comunicación deberá realizarse mediante:

* casos de uso públicos;
* puertos;
* eventos;
* contratos internos;
* consultas explícitas.

---

# Imports públicos

Cada módulo y paquete deberá exponer una API pública mediante un archivo:

```text
index.ts
```

Otros módulos deberán importar desde esa API pública.

Ejemplo correcto:

```ts
import { MatchId } from '@rondo/domain/matches';
```

Ejemplo incorrecto:

```ts
import { MatchId } from '@rondo/domain/matches/value-objects/match-id';
```

Esto evita acoplamiento a la estructura interna.

---

# Alias

Se utilizarán alias consistentes.

Ejemplos:

```text
@rondo/contracts
@rondo/domain
@rondo/shared
@rondo/ui
@rondo/config
```

Dentro de las aplicaciones podrán existir alias como:

```text
@app
@features
@infrastructure
@components
@routes
```

No deberán utilizarse alias ambiguos.

---

# Convenciones de nombres

Carpetas:

```text
kebab-case
```

Archivos TypeScript:

```text
kebab-case.ts
```

Componentes React:

```text
PascalCase.tsx
```

Clases:

```text
PascalCase
```

Funciones y variables:

```text
camelCase
```

Constantes globales:

```text
UPPER_SNAKE_CASE
```

Tipos y enums:

```text
PascalCase
```

---

# Ubicación de tipos

Los tipos deberán vivir cerca del código que los utiliza.

No se deberá crear una carpeta global `types` para almacenar indiscriminadamente todos los tipos del proyecto.

Un tipo deberá moverse a un paquete compartido únicamente cuando sea utilizado por más de una aplicación o dominio.

---

# Variables de entorno

Cada aplicación gestionará sus propias variables.

Ejemplo:

```text
apps/frontend/.env.example
apps/backend/.env.example
```

Nunca deberán versionarse secretos.

Las variables deberán validarse al iniciar la aplicación.

---

# Tests

Los tests unitarios y de componentes no deberán mezclarse con el código fuente.

Cada aplicación mantendrá una carpeta `tests/` en su raíz que refleja la estructura de `src/`.

Ejemplo:

```text
apps/backend/
├── src/
│   └── modules/matches/application/create-match.use-case.ts
└── tests/
    └── modules/matches/application/create-match.use-case.test.ts
```

Los tests de integración podrán ubicarse en:

```text
tests/integration/
```

Los tests end-to-end deberán ubicarse en:

```text
apps/frontend/e2e/
```

o en un paquete específico si abarcan múltiples aplicaciones.

---

# Migraciones

Las migraciones de base de datos deberán ubicarse dentro de la aplicación API.

Ejemplo:

```text
apps/backend/src/infrastructure/database/migrations/
```

Toda modificación del esquema deberá realizarse mediante una migración.

Nunca se modificará producción manualmente.

---

# Seeds

Los datos iniciales deberán ubicarse en:

```text
apps/backend/src/infrastructure/database/seeds/
```

Los seeds deberán ser:

* repetibles cuando sea posible;
* seguros;
* independientes del ambiente;
* claramente documentados.

---

# Archivos generados

El código generado deberá distinguirse claramente del código manual.

Ejemplos:

```text
generated/
```

No deberá editarse manualmente.

Las herramientas responsables de generarlo deberán estar documentadas.

---

# Archivos prohibidos

No deberán existir carpetas genéricas sin responsabilidad clara.

Ejemplos a evitar:

```text
misc/
common/
helpers/
stuff/
temp/
general/
```

Solo se utilizarán nombres que expresen propósito concreto.

---

# Regla de colocación

Antes de crear un archivo deberá responderse:

1. ¿A qué aplicación pertenece?
2. ¿A qué dominio pertenece?
3. ¿En qué capa se encuentra?
4. ¿Es reutilizable?
5. ¿Tiene dependencias externas?
6. ¿Existe una ubicación equivalente?

Si estas preguntas no tienen una respuesta clara, el archivo todavía no está correctamente diseñado.

---

# Crecimiento futuro

La estructura deberá permitir incorporar:

```text
apps/admin
apps/mobile
apps/worker
apps/marketing
```

También deberá permitir nuevos paquetes:

```text
packages/analytics
packages/observability
packages/email-templates
packages/sdk
```

Estas carpetas se crearán únicamente cuando exista una necesidad real.

---

# Principio final

La estructura del repositorio debe facilitar el cambio.

Una buena organización no busca tener más carpetas.

Busca que cada pieza de código tenga una responsabilidad clara, una ubicación predecible y dependencias controladas.
