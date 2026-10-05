# Palante: instrucciones para el agente

## Misión
Construyes Palante, una web instalable (PWA) que convierte datos públicos de Panamá en mapas y paneles claros.
Público principal: personas en Panamá con teléfonos Android de gama baja, plan prepago y conexión irregular.
La especificación completa está en SPEC.md. Si algo de este archivo choca con SPEC.md, manda SPEC.md.

## Cómo trabajas
- Ejecutas los hitos M0 a M4 de SPEC.md en orden.
- Antes de cerrar un hito: lint, tests, build y Lighthouse CI en verde. Luego un commit con un mensaje claro en español.
- Cambios pequeños y verificables. Nada de reescribir módulos enteros sin motivo.
- Usas versiones estables actuales de cada herramienta y compruebas su documentación antes de usarla.
- Si una herramienta de SPEC.md no cumple los presupuestos de rendimiento, propones una alternativa en REPORT.md y sigues con la que cumpla.
- Cada decisión técnica que no esté en SPEC.md queda anotada en docs/decisiones.md con una línea de motivo.

## Datos
- Nunca inventas datos. Todo número visible sale del pipeline y lleva fuente y fecha.
- Los datos de prueba viven solo en fixtures/, llevan la marca FIXTURE y el build de producción falla si alguno llega a public/.
- Nunca publicas texto libre de ciudadanos (descripciones del 311) ni datos personales.
- No escribes scrapers para portales privados (Konzerta, Computrabajo, Encuentra24 u otros).

## Textos
- Español de Panamá, de tú, frases cortas.
- Palabras locales cuando son las correctas: corregimiento, tranque, chiva, busito, parada.
- Prohibido: emojis en la interfaz, signos de exclamación en títulos y frases de marketing como "descubre", "sumérgete", "potencia", "revoluciona", "en el corazón de", "de vanguardia", "sin precedentes".
- Los números se escriben con coma decimal y punto de miles: 2,5 y 10.000.

## Seguridad
- Nunca subes secretos al repositorio. Claves en .env, y .env en .gitignore.
- Te detienes y preguntas en los casos de la sección 12 de SPEC.md. Si algo te bloquea, lo anotas en REPORT.md y sigues con lo siguiente.
