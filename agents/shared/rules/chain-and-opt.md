# Cadena y once-per-turn

- Una cadena se resuelve de último a primero. Negar el eslabón 1 no deshace costes ya pagados.
- Soft OPT: si la carta deja el campo y vuelve, se trata como una carta nueva y puede activar de nuevo.
- Hard OPT: el nombre de carta no puede usar ese efecto otra vez este turno, aunque recicle.
- Al anunciar (Mind Scan, Called by) el nombre tiene que estar en `legalActions`.
- No inventar acciones fuera de la lista legal que mandó EDOPro.
