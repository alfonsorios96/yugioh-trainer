# Fases TCG

Orden de un turno: Draw → Standby → Main Phase 1 → Battle → Main Phase 2 → End.

- En Draw Phase el turno activo roba. Handtraps del rival (Fuwalos, Maxx C, Ash) pueden resolverse aquí o en Standby/Main.
- La invocación normal se usa como máximo una vez por turno, salvo efectos que den una extra (Funny Dark Rabbit).
- `to_ep` declara fin de Main / paso a End Phase. No es un timeout: solo se elige a propósito.
- En End Phase se pueden activar algunos efectos y se descarta al límite de mano.

Al rankear, el `phase` del request (`DP`, `SP`, `MP1`, `BP`, `MP2`, `EP`) acota qué acciones son coherentes.
