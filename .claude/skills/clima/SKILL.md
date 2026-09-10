---
name: clima
description: Obtiene el clima actual de una ciudad usando el servicio público wttr.in (sin API key). Trigger: /clima [ciudad]
---

# Skill: clima

Este skill obtiene información del clima para una ciudad, usando el servicio gratuito
[wttr.in](https://wttr.in), que no requiere API key ni configuración adicional.

## Cuándo usarlo

El usuario escribe `/clima` o pide explícitamente el clima/tiempo de una ciudad
(ej: "/clima Buenos Aires", "¿qué clima hace en Madrid?").

## Cómo obtener el clima

1. Determinar la ciudad:
   - Si el usuario la indicó en el comando (`/clima <ciudad>`), usar esa.
   - Si no indicó ninguna, usar la ciudad por defecto: **Cajicá, Colombia**.

2. Ejecutar el script auxiliar, pasando la ciudad como argumento (usar comillas si tiene espacios):

   - Bash (`Bash` tool): `./.claude/skills/clima/scripts/get_weather.sh "<ciudad>"`
   - PowerShell (`PowerShell` tool): `./.claude/skills/clima/scripts/get_weather.ps1 "<ciudad>"`

   Elegir el que corresponda al shell disponible. Si `<ciudad>` está vacío, no pasar
   ningún argumento y el script usará Cajicá, Colombia por defecto.

3. El script imprime un reporte de clima en texto plano (formato compacto de wttr.in).
   Mostrar ese resultado al usuario tal cual, o resumirlo brevemente si el usuario
   pidió solo un dato puntual (ej. "¿va a llover?", "¿cuántos grados hace?").

## Notas

- No requiere API key ni configuración.
- Si el comando falla (sin conexión a internet, servicio caído), informar el error
  al usuario en vez de inventar datos de clima.
- Este skill es de nivel de proyecto: solo está disponible dentro de este repositorio.
