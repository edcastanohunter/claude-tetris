#!/usr/bin/env bash
# Obtiene el clima actual de una ciudad usando wttr.in (sin API key).
# Uso: ./get_weather.sh "Buenos Aires"
#      ./get_weather.sh          (usa Cajica, Colombia por defecto)

set -euo pipefail

CITY="${1:-Cajica, Colombia}"
URL="https://wttr.in/${CITY// /+}?format=%l:+%c+%t+(sensacion+%f)+%h+humedad+%w+viento+%p+precipitacion&M"

if ! curl -fsS --max-time 10 "$URL"; then
  echo "Error: no se pudo obtener el clima (revisa la conexion a internet o el nombre de la ciudad)." >&2
  exit 1
fi
echo
