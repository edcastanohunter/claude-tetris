---
description: Crea un git worktree en .trees/ con un nombre derivado del requerimiento
argument-hint: <descripción del requerimiento>
---

El usuario quiere crear un nuevo git worktree para trabajar en un requerimiento aislado.

Requerimiento: $ARGUMENTS

Pasos a seguir:

1. A partir del requerimiento descrito arriba, determina un nombre corto en kebab-case (minúsculas, guiones, sin espacios ni acentos) que lo represente claramente (p. ej. "arreglar el scoring" -> `fix-scoring`, "agregar modo multijugador" -> `multiplayer-mode`). Si no hay descripción, pide al usuario que la proporcione antes de continuar.
2. Verifica que el directorio `.trees/` exista (créalo si es necesario, git lo maneja automáticamente al crear el worktree).
3. Verifica que no exista ya un worktree o rama con ese nombre (`git worktree list`, `git branch --list <nombre>`).
4. Ejecuta:
   ```
   git worktree add .trees/<nombre>
   ```
   Si el nombre implica una rama nueva, usa `git worktree add -b <nombre> .trees/<nombre>` en su lugar, para crear la rama al mismo tiempo.
5. **Trabaja de forma aislada**: Usa el Agent tool (subagent_type: general-purpose) para ejecutar todo el trabajo dentro del worktree. En el prompt del agente:
   - Indica que el directorio de trabajo es `.trees/[nombre]` (ruta absoluta)
   - Todas las lecturas y ediciones deben hacerse sobre archivos en esa ruta
   - El agente debe realizar el requerimiento completo antes de terminar
   - Al final, el agente debe reportar qué archivos modificó y un resumen del trabajo

6. **Reporta** al usuario: nombre del worktree creado, rama, y resumen del trabajo realizado por el agente.
