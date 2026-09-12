# CalD Risk Screen (CARDA v2.6)

Herramienta de tamizaje determinística, basada en navegador y sin backend, que
estima riesgo de insuficiencia de calcio y vitamina D, riesgo óseo orientativo
(osteopenia/osteoporosis) y riesgo de sarcopenia.

Herramienta hermana de **B12 Risk Screen**, del mismo autor.

> **Uso exclusivo de investigación y tamizaje orientativo.** No sustituye una
> densitometría ósea (DXA), una evaluación bioquímica ni una evaluación clínica.

## Cambio central de la v2.0: se modela calcio ABSORBIBLE

Las versiones anteriores contaban miligramos ingeridos. Eso oculta el problema
real: 115 mg de calcio de espinaca aportan ~6 mg absorbibles, mientras 61 mg de
col rizada aportan ~30 mg. La v2.0 aplica dos correcciones simultáneas:

1. **Curva de saturación de Heaney** — la absorción fraccional decae con el
   logaritmo de la carga de cada comida:
   `FA(carga) = 0.889 − 0.0964 × ln(carga_mg)`
   Reproduce los valores publicados: 62.8% a 15 mg y 29.0% a 500 mg (reportados
   ~64% y 28.6%).
2. **Biodisponibilidad medida por alimento** — cada fuente lleva su absorción
   fraccional determinada con isótopos (Weaver & Heaney 1999), normalizada por
   la carga a la que fue medida para no contar dos veces el efecto de la dosis.

El motor está validado contra la tabla publicada: consumidos en su porción de
referencia, los siete alimentos verificados reproducen el calcio absorbible
publicado con desviación menor al 5%.

## Novedades de la v2.0

- **Marco de referencia seleccionable IOM/NASEM 2011 o EFSA 2015**, con la
  diferencia explicada en pantalla (no son intercambiables: el IOM usa retención
  positiva y añade incremento geriátrico; la EFSA usa balance nulo y no lo añade).
- **Tofu organizado por coagulante**, no por marca ni firmeza: sulfato de calcio,
  nigari y sedoso (glucono-delta-lactona). Es el coagulante el que determina el
  contenido de calcio.
- **Verduras separadas por contenido de oxalato**, que es el factor decisivo:
  las altas en oxalato se marcan como fuente no fiable pese a su contenido.
- **Alerta del umbral de 525 mg/día** (EPIC-Oxford): el exceso de riesgo de
  fractura de cadera en veganos se concentró por debajo de ese valor.
- **Alerta de fraccionamiento** cuando una comida supera 500 mg.
- **Vitamina D con potencia relativa D2/D3**: la D2 se computa al 60% de la D3
  (Tripkovic et al. 2012). Señala cuando el aporte depende mayoritariamente de D2.
- **Cortes de 25(OH)D actualizados al consenso IOM/EFSA (20 ng/mL)**. La
  Endocrine Society abandonó en 2024 el umbral de 30 ng/mL de su guía de 2011;
  la herramienta lo conserva solo como nota histórica.
- **SARC-F con doble corte**: el validado (≥4, alta especificidad) y el sensible
  (≥2), porque la sensibilidad del corte estándar es baja (30-55%). Incluye
  circunferencia de pantorrilla (componente SARC-CalF).
- **Proteína ajustada por edad y patrón dietético**: 0.8 g/kg/día en adultos,
  1.0 g/kg/día desde los 65 años, con ajuste al alza en dietas 100% vegetales.
- **Razón continua de adecuación** como métrica primaria, en lugar del conteo
  binario de días que confundía al que estaba al 68% de la meta con el que
  estaba al 8%.
- **Eficiencia de absorción global** visible: revela cuánto del calcio ingerido
  se aprovecha realmente.

## Novedades de la v2.6

- **Selección del organismo en los resultados.** Tres botones (IOM, EFSA y el
  umbral EPIC-Oxford) gobiernan toda la herramienta: la clasificación de calcio,
  el riesgo óseo y lo que se exporta. El selector desapareció del perfil.
- **Tabla comparativa siempre visible**, en lugar de oculta tras un botón: muestra
  la meta de ingesta, la meta absorbida y el resultado del participante con cada
  organismo, más la explicación de por qué difieren.
- **Tarjetas de resultado reordenadas**: promedio de ingesta diaria, promedio de
  calcio absorbido y días cumplidos, cada una contrastada contra el organismo
  elegido.
- **Suplementación de vitamina D repuesta** como sección propia bajo la de calcio.
  Se había perdido al unificar los cuestionarios. Pide la dosis en unidades
  internacionales, que es como viene en la etiqueta, y convierte internamente.
  Distingue D3, D2 y forma desconocida, que se calcula como D2 por prudencia.
- **Cereales en medida casera**: una taza cocida o dos rebanadas de pan.

## Por qué las unidades son caseras y no gramos

Las calculadoras de ingesta de calcio disponibles piden las porciones en gramos,
a veces sobre alimento crudo. Eso no es solo incómodo: degrada el dato, porque el
participante no sabe cuántos gramos come y termina estimando, y esa estimación
entra al cálculo como si fuera una medición. Las medidas caseras (una taza
cocida, media taza, un bloque de tofu) reducen el error de recordatorio, que es
la principal fuente de sesgo en un cuestionario de frecuencia.

El mismo criterio explica que el catálogo sea corto: una lista extensa no aporta
precisión si el participante se cansa a la mitad y empieza a responder de
memoria.


## Idiomas

La app detecta el idioma del navegador y recuerda la elección del usuario.

**Publicados:** español, inglés, portugués.
**Preparados en la estructura, pendientes de traducir:** finés, alemán, italiano,
coreano, japonés.

Cada idioma vive en su propio archivo (`js/i18n/es.js`, `en.js`, `pt.js`…) y el
registro `js/i18n.js` los ensambla. **Un idioma solo aparece en el selector si está
completo** respecto al español: la cobertura se comprueba automáticamente al cargar
comparando claves, de modo que nunca se muestra una interfaz mitad traducida.

Para añadir un idioma:
1. Copiar `js/i18n/es.js` a `js/i18n/<código>.js` y renombrar la constante a
   `TRADUCCION_<CÓDIGO>`.
2. Traducir los valores, **conservando los marcadores** entre llaves (`{meta}`,
   `{pct}`…), que se sustituyen en tiempo de ejecución.
3. Añadir la etiqueta `<script>` correspondiente en `index.html`.
4. Ejecutar `node tests/validacion.js`: la suite comprueba la cobertura y que los
   marcadores estén intactos, y solo entonces el idioma aparece en el selector.

## Novedades de la v2.1

- **Registro acumulado de participantes.** Código identificador, fecha y notas por
  participante; las sesiones se acumulan y se exportan en un único CSV de formato
  ancho (una fila por participante, ~50 variables) listo para SPSS, R o Jamovi.
- **Captura compatible con FRAX®.** Recoge los factores de riesgo clínico con sus
  definiciones oficiales y enlaza a la calculadora oficial. **No calcula FRAX**: el
  algoritmo es propiedad de la Universidad de Sheffield, sus coeficientes no son
  públicos y su automatización requiere licencia. Además Panamá carece de modelo
  calibrado, por lo que la herramienta obliga a declarar el país sustituto usado.
- **Inhibidores y pérdidas de calcio.** Inhibidores de la bomba de protones (que
  penalizan al carbonato pero no al citrato), sodio y cafeína, modelados como
  mayor excreción urinaria y no como menor absorción.
- **Exposición solar en unidades estándar.** Se sustituyó el índice arbitrario por
  SED (dosis eritematosa estándar, 100 J/m²), fracción de MED según fototipo y
  equivalente en UI mediante la regla de Holick, incluyendo la **saturación
  fisiológica**: por encima de ~1 MED la previtamina D3 se fotodegrada, de modo que
  más tiempo al sol no aporta más vitamina D y sí riesgo de quemadura. La cifra más
  útil es accionable: *"con tu fototipo necesitas unos N minutos"*.
- **Verduras contabilizadas solo cocidas**, ya que hervir y descartar el agua
  arrastra parte del oxalato soluble.
- **Hoja para el participante.** Una página en lenguaje sencillo, con sus
  resultados y acciones concretas, imprimible por separado del informe técnico.
- **Suite de validación versionada** en `tests/validacion.js`.

## Validación del motor

```bash
node tests/validacion.js   # el motor reproduce los valores publicados
node tests/humo.js         # la interfaz carga sin errores
```

`humo.js` existe por una razón concreta: en JavaScript las declaraciones
`const` no se elevan, así que usar una constante antes de declararla produce
un archivo sintácticamente válido que al ejecutarse deja la pantalla en
blanco, sin ningún mensaje visible. Esa prueba ejecuta la lógica real del
componente con hooks simulados y detecta ese fallo antes de publicar.

Ejecuta 64 pruebas que contrastan el algoritmo con valores publicados: la curva de
absorción de Heaney, la tabla de calcio absorbible de Weaver y Heaney, las
referencias del IOM y de la EFSA, la potencia relativa D2/D3, el punto de
referencia de la regla de Holick, los cortes de SARC-F, el comportamiento de los
inhibidores y la integridad de las traducciones. Cada prueba imprime su fuente bibliográfica.

Esto permite afirmar, con respaldo comprobable por cualquier revisor, que el motor
reproduce los valores de referencia de la literatura.

## Estructura de archivos: subir TODO

La aplicación no arranca si falta cualquiera de estos archivos, y el síntoma es
una **pantalla en gris sin mensaje de error**. Al publicar hay que subir la
estructura completa, incluidas las subcarpetas:

```
index.html
css/style.css
js/data.js
js/algorithm.js
js/app.js
js/i18n.js
js/i18n/es.js      <- carpeta añadida en la v2.2
js/i18n/en.js
js/i18n/pt.js
tests/validacion.js
tests/humo.js
```

`index.html` carga los archivos por ruta relativa, así que reemplazar solo los
sueltos y no subir la carpeta `js/i18n/` deja la aplicación sin arrancar.

### Si aparece una pantalla en gris

1. Abrir la consola del navegador con F12, pestaña «Console». El error aparece
   ahí con el nombre del archivo que no cargó.
2. Un error `404` indica que ese archivo no llegó al servidor: falta subirlo.
3. Un error `is not defined` indica lo mismo, visto desde el otro lado: el
   archivo que define ese nombre no cargó.
4. Si la consola no muestra nada, suele ser caché del navegador: recargar con
   Ctrl+Shift+R (Cmd+Shift+R en Mac).


## Estructura

```
cald-risk-screen/
├── index.html
├── css/style.css
└── js/
    ├── data.js       # catálogos, biodisponibilidad, marcos IOM/EFSA
    ├── i18n.js       # diccionario (español) y bibliografía
    ├── algorithm.js  # motor CARDA v2.0
    └── app.js        # interfaz React
```

## Publicar en GitHub Pages

Subir el CONTENIDO de esta carpeta a la raíz del repositorio (no la carpeta
misma), luego Settings → Pages → rama `main` → carpeta `/ (root)`.
No requiere build: todo corre en el navegador vía CDN.

## Pendientes conocidos

- **Idiomas:** solo español. La arquitectura de `i18n.js` admite más.
- **Calibración:** los umbrales del riesgo óseo compuesto y del índice solar son
  heurísticos de tamizaje, no coeficientes validados. Deben calibrarse contra los
  datos reales de DXA del estudio en curso.
- **Datos panameños:** las cifras de composición de alimentos deben contrastarse
  con etiquetas del mercado local, especialmente la fortificación de bebidas
  vegetales, que varía mucho entre marcas.

## Autor

**MEd Jean Carlos Ruiz Mosley** — Nutricionista-Dietista especializado en
nutrición basada en plantas.

© 2026 Jean Carlos Ruiz Mosley. Todos los derechos reservados.
