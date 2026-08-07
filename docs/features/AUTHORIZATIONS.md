# AUTHORIZATION

> **Nota (auth nativa):** Clerk fue removido por completo — Rondo administra autenticación de punta a punta. Ver [`docs/AUTHENTICATION.md`](../AUTHENTICATION.md) para el diseño real. Las reglas de autorización (roles, guards) descriptas debajo siguen vigentes sin cambios: son independientes del mecanismo de autenticación.

# Objetivo

Este documento define cómo se controlan los permisos dentro de Rondo.

La autenticación es responsabilidad de Rondo (ver nota arriba).

Este dominio únicamente define qué acciones puede realizar un usuario una vez autenticado.

---

# Autenticación

El usuario inicia sesión mediante Clerk.

Una vez autenticado, el backend recibe su identidad y obtiene el usuario interno de Rondo.

El backend nunca debe confiar únicamente en el identificador enviado por el cliente.

---

# Usuario interno

Todos los permisos se calculan utilizando el usuario interno.

```ts
interface User {
  id: UserId;
  externalAuthId: string;
}
```

---

# Roles del MVP

Se utilizarán únicamente tres roles.

```ts
enum UserRole {
  USER = 'USER',
  CLUB_ADMIN = 'CLUB_ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
```

---

# USER

Puede:

* editar su perfil;
* buscar clubes;
* buscar partidos;
* crear reservas;
* cancelar sus reservas;
* crear partidos;
* administrar los partidos que organiza;
* unirse a partidos;
* abandonar partidos;
* recibir notificaciones.

No puede administrar clubes ni reservas de otros usuarios.

---

# CLUB_ADMIN

Además de los permisos de USER puede:

* administrar su club;
* administrar sedes;
* administrar canchas;
* aprobar reservas;
* cancelar reservas;
* administrar partidos del club.

Un administrador solo puede administrar los clubes donde posee permisos.

---

# SUPER_ADMIN

Administrador global del sistema.

Puede acceder a todos los clubes y realizar tareas de soporte.

Este rol no debe utilizarse para la operación diaria.

---

# Validaciones

Toda operación debe validar:

* usuario autenticado;
* usuario activo;
* permisos del rol;
* pertenencia al club cuando corresponda;
* propiedad del recurso.

---

# Ownership

Algunas acciones dependen del propietario del recurso.

Ejemplos:

Un usuario solo puede editar:

* su perfil;
* sus reservas;
* los partidos que organiza.

No basta con tener el rol `USER`.

---

# Permisos por módulo

## USERS

* editar perfil propio.

## CLUBS

* CLUB_ADMIN
* SUPER_ADMIN

## COURTS

* CLUB_ADMIN
* SUPER_ADMIN

## BOOKINGS

Crear:

* USER

Administrar reservas del club:

* CLUB_ADMIN

## MATCHES

Crear partido:

* USER

Editar partido:

* únicamente el organizador.

Cancelar partido:

* organizador;
* CLUB_ADMIN del club;
* SUPER_ADMIN.

---

# Implementación

Cada caso de uso deberá validar permisos antes de ejecutar lógica de negocio.

Ejemplo:

```text
Controller
    ↓
Authentication
    ↓
Authorization
    ↓
Use Case
```

La autorización no debe implementarse únicamente en el frontend.

---

# Casos especiales

Un `CLUB_ADMIN` nunca debe poder administrar otro club.

Ejemplo:

```text
Club A
    Admin Juan

Club B
    Admin Pedro
```

Juan no puede modificar información del Club B.

---

# Auditoría

Las siguientes acciones deben registrarse:

* creación de clubes;
* eliminación de canchas;
* cancelación de reservas;
* cambio de administradores;
* modificaciones administrativas.

---

# Reglas principales

1. Clerk autentica al usuario.
2. Rondo autoriza las acciones.
3. Todos los permisos se validan en el backend.
4. Un usuario solo puede modificar recursos propios.
5. Un CLUB_ADMIN solo administra sus clubes.
6. SUPER_ADMIN tiene acceso global.
7. El frontend nunca decide permisos.

---

# Principio final

La autenticación identifica quién es el usuario.

La autorización determina qué puede hacer dentro de Rondo.
