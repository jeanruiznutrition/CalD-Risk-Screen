# CalD Risk Screen (CARDA v1.1)

**Novedades v1.1:** ejercicio agrupado por categoría OMS (aeróbico / fortalecimiento muscular), suplementación de calcio con tipo de sal (carbonato/citrato) + mg/día + veces/día + días/semana, fototipo de piel (Fitzpatrick) en el módulo solar, FFQ de calcio ampliado (leche/yogur/queso por separado, 3 variedades de tofu Mori-Nu, frutos secos en media taza o gramos, alimentos fortificados extra ilimitados y editables), FFQ de vitamina D independiente (dieta + suplemento), interpretación de laboratorio para calcio sérico y 25-OH-vitamina D, sección de metodología explicada, y bibliografía completa. Ver detalle abajo.

Herramienta de tamizaje determinística, basada en navegador (sin backend, sin
dependencias de servidor), para estimar el riesgo de insuficiencia de calcio
y vitamina D, riesgo óseo orientativo (osteopenia/osteoporosis) y riesgo de
sarcopenia (SARC-F), a partir de datos dietéticos, de suplementación, de
exposición solar y del perfil del participante.

Es la herramienta hermana de **B12 Risk Screen**, del mismo autor, y reutiliza
su misma arquitectura de "semana virtual" para modelar la absorción saturable
por dosis — en este caso, aplicada a la fisiología del calcio en vez de la
vitamina B12.

> ⚠️ **Uso exclusivo de investigación y tamizaje orientativo.** Esta
> herramienta no sustituye una densitometría ósea (DXA), una medición
> bioquímica de 25-OH-vitamina D sérica, ni una evaluación clínica
> profesional.

## Módulos

1. **Calcio y Vitamina D** — Cuestionario de frecuencia de consumo (FFQ) de
   fuentes de calcio, suplementación y exposición solar. Calcula el aporte
   semanal ingerido y absorbido de calcio (modelo de absorción saturable,
   techo de ~500 mg de absorción activa por toma, según evidencia de
   biodisponibilidad de calcio de Heaney et al.), y un índice proxy de
   síntesis de vitamina D a partir de hábitos de exposición solar.
2. **Riesgo Óseo (orientativo)** — Puntaje compuesto a partir de la
   adecuación de calcio, el índice de vitamina D, edad, sexo, actividad
   física de fuerza, tabaquismo y consumo de alcohol. **No es diagnóstico**;
   está pensado para calibrarse/validarse a futuro contra datos reales de
   densitometría ósea.
3. **Riesgo de Sarcopenia (SARC-F)** — Cuestionario validado de 5 ítems
   (Malmstrom & Morley, 2013). Puntaje ≥ 4 sugiere riesgo probable de
   sarcopenia. La ingesta proteica y el ejercicio de fuerza se muestran como
   señales contextuales adicionales, sin alterar el punto de corte validado.

## Estructura del proyecto

```
cald-risk-screen/
├── index.html          # Punto de entrada, carga Tailwind/React/Babel por CDN
├── css/
│   └── style.css       # Tipografía y estilos de impresión
└── js/
    ├── data.js          # Catálogo de alimentos, constantes fisiológicas, SARC-F
    ├── i18n.js           # Diccionario de traducción (v1.0: español)
    ├── algorithm.js      # Motor de cálculo CARDA (sin dependencias)
    └── app.js            # Interfaz React (JSX compilado en el navegador)
```

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio nuevo (por ejemplo, `cald-risk-screen`) y sube estos
   archivos manteniendo la misma estructura de carpetas.
2. En **Settings → Pages**, selecciona la rama `main` y la carpeta raíz (`/`).
3. En un par de minutos, GitHub publicará la app en
   `https://<tu-usuario>.github.io/cald-risk-screen/`.

No requiere build ni instalación: todo corre en el navegador vía CDN (React,
Tailwind, FontAwesome, Babel).

## Pendientes conocidos (v1.0)

- **Idiomas:** por ahora solo español. La arquitectura de `i18n.js` está
  lista para agregar inglés y otros idiomas más adelante, igual que en B12
  Risk Screen.
- **Validación:** los umbrales del riesgo óseo compuesto y del índice solar
  son heurísticos de tamizaje, no coeficientes validados estadísticamente.
  Deben calibrarse contra los datos reales de DXA / bioquímica del estudio
  de densitometría ósea en curso, tal como se hizo con B12 Risk Screen usando
  el estudio hospitalario de B12 (n=132).

## Autor

**MEd Jean Carlos Ruiz Mosley** — Nutricionista-Dietista especializado en
nutrición basada en plantas.

© 2026 Jean Carlos Ruiz Mosley. Todos los derechos reservados.
