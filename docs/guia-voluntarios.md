# Guía para voluntarios: capturar una ruta

Con esta guía grabas el recorrido y las paradas de una ruta interna de busito o chiva con tu teléfono.
No necesitas cuenta ni datos móviles mientras grabas.

## Antes de salir

- **Usa un teléfono Android con Chrome.** En iPhone, Safari deja de leer el GPS si se apaga la pantalla o
  cambias de app.
- Carga la batería. Una hora de captura gasta más o menos lo mismo que una hora de mapa en el teléfono.
- Abre `/captura` en Palante con internet una vez. Después funciona sin conexión.
- Pregunta al conductor o a la cooperativa si la ruta tiene permiso de la ATTT. Si no lo sabes, marca «No sé»:
  esas rutas no se publican.

## Seguridad

- Captura **en pareja y de día**.
- Guarda el teléfono entre paradas. Si no te sientes seguro, no lo saques: es mejor perder una parada.
- No grabes ni fotografíes a personas. La app no usa la cámara ni el micrófono.

## Paso a paso

1. Escribe tu código de voluntario (por ejemplo `UTP-07`) y toca «Nueva captura».
2. Escribe el nombre de la ruta como la llama la gente, el operador o cooperativa, la tarifa, el sentido
   (ida o vuelta) y si tiene permiso.
3. Toca «Empezar a grabar» cuando el busito arranque en su primera parada. Acepta el permiso de ubicación.
4. En cada parada donde suba o baje gente, toca «Parada aquí». Si la app avisa que la precisión pasa de 50 m,
   acércate a una ventana.
5. En la última parada toca «Fin de ruta». Revisa la traza, nombra las paradas que conozcas («frente al
   súper») y borra las que marcaste por error.
6. Toca «Enviar por WhatsApp» y elige al coordinador. Si tu teléfono no deja compartir archivos, toca
   «Descargar el archivo» y envíalo por WhatsApp como documento.

La captura queda guardada en el teléfono hasta que la envías. Si se cierra el navegador mientras grabas,
vuelve a abrir `/captura`: sigue donde iba.

## Para el coordinador

Guarda cada archivo `.json` recibido en `pipeline/data/raw/rutas/` y corre
`uv run python -m palante_pipeline rutas` desde `pipeline/`. Para que una ruta entre al GTFS, añade su horario
en `pipeline/config/rutas.csv`.
