# Obtiene el clima actual de una ciudad usando wttr.in (sin API key).
# Uso: .\get_weather.ps1 "Buenos Aires"
#      .\get_weather.ps1          (usa Cajica, Colombia por defecto)

param(
    [string]$City = "Cajica, Colombia"
)

$encodedCity = $City -replace ' ', '+'
$format = "%l:+%c+%t+(sensacion+%f)+%h+humedad+%w+viento+%p+precipitacion"
$url = "https://wttr.in/${encodedCity}?format=$format&M"

try {
    $response = Invoke-RestMethod -Uri $url -TimeoutSec 10
    Write-Output $response
} catch {
    Write-Error "Error: no se pudo obtener el clima (revisa la conexion a internet o el nombre de la ciudad)."
    exit 1
}
