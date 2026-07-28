# DESIGN SYSTEM

# Objetivo

Este documento define el sistema de diseño oficial de Rondo.

Su propósito es garantizar consistencia visual, reutilización de componentes y una identidad de producto reconocible.

Toda interfaz deberá utilizar este sistema antes de crear nuevos componentes.

---

# Filosofía

Rondo transmite:

- deporte
- energía
- comunidad
- confianza
- tecnología

La interfaz debe sentirse moderna, limpia y liviana.

Inspiraciones:

- Spotify
- Linear
- Nike
- Airbnb

---

# Tema

Modo principal:

Dark Mode

El modo oscuro representa la identidad principal del producto.

El modo claro podrá incorporarse en futuras versiones.

---

# Colores

## Primario

Verde

Representa:

- deporte
- acción
- éxito

---

## Secundario

Blanco

Utilizado para:

- textos principales
- iconografía

---

## Fondo

Negro / Gris muy oscuro

Debe priorizar el contraste y la comodidad visual.

---

## Estados

Success

Verde

Warning

Amarillo

Error

Rojo

Info

Celeste

---

# Tipografía

Fuente:

Inter

Alternativa:

Roboto

---

# Jerarquía

Display

Pantallas principales.

---

H1

Títulos.

---

H2

Secciones.

---

Body

Contenido.

---

Caption

Información secundaria.

---

# Espaciado

Unidad base:

8 px

Todos los espacios deberán ser múltiplos de 8.

Ejemplos:

8

16

24

32

40

48

---

# Border Radius

Cards

16 px

Botones

12 px

Inputs

12 px

Chips

999 px

---

# Sombras

Utilizar sombras suaves.

Evitar elevaciones exageradas.

La jerarquía deberá lograrse principalmente mediante espaciado.

---

# Botones

Tipos:

Primary

Secondary

Outlined

Text

Danger

---

Reglas

Solo un botón primario por pantalla.

---

# Inputs

Todos los formularios deberán utilizar el mismo estilo.

Estados:

Normal

Focused

Error

Disabled

---

# Cards

Las cards representan el componente principal de la aplicación.

Ejemplos:

Club

Partido

Reserva

Jugador

Promoción

---

Características

- bordes redondeados
- padding consistente
- separación uniforme

---

# Chips

Utilizados para representar:

- estados
- deportes
- etiquetas
- disponibilidad

---

# Avatares

Siempre circulares.

Si el usuario no posee imagen:

Mostrar iniciales.

---

# Badges

Representan información breve.

Ejemplos:

Nuevo

Lleno

Pendiente

Disponible

---

# Listas

Cada fila debe contener:

- información principal
- información secundaria
- acción rápida

---

# Bottom Navigation

La navegación principal en móviles utilizará Bottom Navigation.

Máximo:

5 opciones.

---

# App Bar

Debe mostrar:

- contexto actual
- acciones principales

No sobrecargar con botones.

---

# Floating Action Button

Utilizar únicamente para la acción más importante de la pantalla.

Ejemplos:

Crear Partido

Reservar

---

# Dialogs

Los diálogos deberán utilizarse únicamente para:

- confirmaciones
- formularios breves
- acciones críticas

---

# Snackbars

Utilizar para:

- confirmaciones
- acciones exitosas
- errores temporales

Duración recomendada:

3 segundos.

---

# Skeletons

Toda carga superior a 300 ms deberá mostrar Skeletons.

Nunca loaders vacíos.

---

# Empty States

Toda pantalla sin información deberá mostrar:

- ilustración
- mensaje
- acción recomendada

---

# Iconografía

Utilizar Material Symbols.

Los íconos siempre complementan el texto.

---

# Imágenes

Priorizar fotografías reales de:

- personas
- clubes
- deportes

Evitar imágenes genéricas.

---

# Animaciones

Duración recomendada:

150 ms a 250 ms.

Las transiciones deben ser sutiles.

---

# Responsive

Breakpoints principales:

Mobile

Tablet

Desktop

La experiencia móvil tiene prioridad.

---

# Componentes reutilizables

Todo componente utilizado en más de una pantalla deberá incorporarse al Design System.

Ejemplos:

PrimaryButton

MatchCard

BookingCard

PlayerCard

RatingStars

Avatar

SportChip

EmptyState

LoadingCard

---

# Accesibilidad

Todos los componentes deberán cumplir:

- navegación por teclado
- labels
- contraste
- foco visible

---

# Material UI

Material UI será la base del sistema.

Todo componente deberá personalizarse mediante un Theme global.

No deberán utilizarse estilos aislados que rompan la identidad visual.

---

# Tokens

El Theme deberá centralizar:

- colores
- tipografía
- spacing
- radius
- shadows
- breakpoints

---

# Principio

Antes de crear un nuevo componente deberá responderse:

¿Este componente ya existe o puede reutilizarse?

La reutilización siempre tendrá prioridad sobre la creación de nuevos componentes.