# Logo de Palante: tres variantes para elegir

Arco chato del Casco Antiguo con una flecha hacia la derecha debajo, junto a "Palante" en Fraunces.
Las letras están convertidas a trazos, así que los SVG no dependen de fuentes instaladas.
Se generan con `scripts/generar_logos.py`.

| Variante | Archivos | Idea |
| --- | --- | --- |
| A, Sello | `palante-a.svg`, `palante-a-icono.svg`, `palante-a-mono.svg` | Arco y flecha en cal sobre un cuadro terracota. La más legible a 32 px. |
| B, Dovelas | `palante-b*.svg` | Arco hecho de cinco dovelas terracota y flecha verde persiana. |
| C, Trazo | `palante-c*.svg` | Arco dibujado en línea de hierro y flecha terracota. |

Cada variante tiene versión a color, solo icono y de un solo color (`currentColor`).

La web usa la variante A de forma provisional en el favicon y los iconos de la app.
El logo definitivo lo elige Iker. Para cambiarlo:

```bash
cd web
node scripts/generar-iconos.mjs b   # o c
```

Luego hay que copiar el icono elegido en `web/src/components/Logo.astro` y `web/src/og/render.ts`.
