# PRODUCT DECISIONS

# Objetivo

Este documento registra las decisiones funcionales tomadas durante el diseño y evolución de Rondo.

Cada decisión representa un acuerdo de producto.

El objetivo es conservar el contexto que motivó cada elección y evitar perder conocimiento con el paso del tiempo.

---

# Formato

Cada decisión deberá contener:

- Identificador
- Fecha
- Estado
- Contexto
- Problema
- Alternativas
- Decisión
- Justificación
- Consecuencias

---

# PD-001

## Fecha

2026-07-28

## Estado

Aceptada

## Título

El registro no solicita un club.

## Contexto

Muchos jugadores quieren comenzar a utilizar la aplicación sin pertenecer todavía a un club.

## Problema

Obligar a elegir un club durante el registro genera fricción innecesaria.

## Alternativas

- Elegir club durante el registro.
- Crear cuenta libre.

## Decisión

El usuario podrá registrarse sin pertenecer a ningún club.

La asociación se solicitará únicamente cuando utilice funcionalidades propias del club.

## Consecuencias

- menor fricción
- onboarding más rápido
- usuarios independientes

---

# PD-002

## Estado

Aceptada

## Título

Los partidos existen independientemente de las reservas.

## Contexto

Muchos organizadores primero reúnen jugadores y luego buscan cancha.

Otros realizan exactamente el proceso inverso.

## Decisión

Match y Booking serán entidades independientes.

bookingId será opcional.

## Consecuencias

Mayor flexibilidad.

---

# PD-003

## Estado

Aceptada

## Título

El Match recibe su identificador al momento de crearse.

## Contexto

El partido necesita existir para poder compartirlo, invitar jugadores y organizar el encuentro.

## Decisión

El Match obtiene su UUID inmediatamente.

No depende de:

- reserva
- cantidad de jugadores
- club

---

# PD-004

## Estado

Aceptada

## Título

El chat pertenece al partido.

## Contexto

Los usuarios suelen abandonar la plataforma para organizarse mediante WhatsApp.

## Decisión

Cada Match crea automáticamente un MatchChat.

El chat permanece activo hasta 24 horas posteriores a la finalización del partido.

## Consecuencias

Toda la organización ocurre dentro de Rondo.

---

# PD-005

## Estado

Aceptada

## Título

La reputación se divide en Juego y Conducta.

## Contexto

Un buen jugador no siempre es un buen compañero.

## Decisión

Las valoraciones tendrán dos dimensiones independientes.

- Game Rating
- Behavior Rating

## Consecuencias

Evaluaciones más representativas.

---

# PD-006

## Estado

Aceptada

## Título

Todos los participantes pueden valorar.

## Contexto

Limitar la valoración únicamente al organizador genera poca información.

## Decisión

Todos los participantes confirmados podrán valorar al resto.

Restricciones:

- una valoración por partido
- no puede valorarse a sí mismo

---

# PD-007

## Estado

Aceptada

## Título

Jugador de la Cancha.

## Contexto

Se busca incentivar la participación y la interacción posterior al partido.

## Decisión

Rondo calculará automáticamente:

- Jugador de la Cancha
- Mejor Compañero

utilizando las valoraciones recibidas.

---

# PD-008

## Estado

Aceptada

## Título

Modo oscuro como experiencia principal.

## Contexto

La mayor parte del uso ocurrirá desde dispositivos móviles.

## Decisión

Dark Mode será la identidad visual inicial del producto.

---

# PD-009

## Estado

Aceptada

## Título

PWA antes que aplicación nativa.

## Contexto

Es necesario validar el producto rápidamente.

## Decisión

Desarrollar primero una Progressive Web App.

Evaluar Capacitor posteriormente.

---

# PD-010

## Estado

Aceptada

## Título

Arquitectura preparada para múltiples clubes.

## Contexto

El primer cliente será Club Señor Pato.

Sin embargo, Rondo debe nacer como plataforma.

## Decisión

Todo el dominio será multi-club desde la primera versión.

---

# PD-011

## Estado

Aceptada

## Título

Las promociones pertenecen únicamente al club.

## Decisión

Solo los miembros recibirán promociones.

Las invitaciones a partidos podrán llegar también a usuarios externos.

---

# PD-012

## Estado

Aceptada

## Título

La disponibilidad para invitaciones es configurable.

## Decisión

Cada usuario podrá activar o desactivar su disponibilidad.

Cuando esté desactivada:

- no aparecerá en búsquedas
- no recibirá invitaciones

---

# Cambios

Toda modificación de una decisión existente deberá:

- mantener el historial
- indicar la fecha
- explicar el motivo

Nunca deberán eliminarse decisiones anteriores.

Se marcarán como:

- Reemplazada
- Obsoleta
- Cancelada

cuando corresponda.

---

# Principio

Cada decisión registrada en este documento representa un acuerdo funcional del producto.

Si una nueva funcionalidad contradice una decisión existente, primero deberá actualizarse este documento y luego implementarse el cambio.

# PD-013

## Fecha

2026-07-28

## Estado

Aceptada

## Título

El registro solicita el sexo del usuario.

## Contexto

Rondo necesitará permitir búsquedas de jugadores y creación de partidos según categorías deportivas.

## Problema

No almacenar este dato impediría implementar filtros precisos para partidos masculinos, femeninos o mixtos.

## Alternativas

* No solicitar el dato.
* Solicitar únicamente hombre o mujer.
* Solicitar el dato permitiendo no informarlo.

## Decisión

El registro solicitará el sexo del usuario.

Los valores disponibles serán:

* Hombre
* Mujer
* Prefiero no informarlo

El dato se almacenará mediante un enum y no mediante un valor booleano.

## Consecuencias

* permitirá búsquedas filtradas;
* facilitará partidos masculinos, femeninos y mixtos;
* evitará migraciones complejas en el futuro;
* respetará a los usuarios que no deseen informar el dato.

## Regla

El sexo del usuario no determinará automáticamente a qué partidos puede unirse.

La compatibilidad dependerá de la categoría y las reglas configuradas en cada partido.
