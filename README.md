# CalD Risk Screen — CARDA v6.0

Herramienta de tamizaje determinística, basada en navegador y sin
backend, que estima riesgo de insuficiencia de calcio y vitamina D,
riesgo óseo orientativo, riesgo de sarcopenia y patrones bioquímicos del
metabolismo mineral.

Herramienta hermana de **B12 Risk Screen**, del mismo autor.

> **Uso exclusivo de investigación.** No diagnostica, no sustituye a la
> densitometría y no emite indicaciones de dosis ni de tratamiento. La
> interpretación de cualquier analito corresponde al médico tratante,
> con los rangos del laboratorio que emitió el informe y el contexto
> clínico completo del participante.

Sello del motor: `CARDA-v6.0+2e78524e`

---

## Qué hay de nuevo en la v6.0

La versión anterior funcionaba y sus 85 pruebas pasaban, pero tenía tres
clases de problema: correcciones metodológicas que cambiaban resultados,
ausencias que limitaban su uso como instrumento de investigación, y dos
defectos silenciosos que corrompían datos exportados.

El detalle completo, con el efecto numérico de cada cambio, está en
**[CHANGELOG.md](CHANGELOG.md)**; el diagnóstico que originó la revisión,
en **[AUDITORIA_v3.1.md](AUDITORIA_v3.1.md)**; y las ecuaciones con sus
fuentes, en **[METODOS.md](METODOS.md)**.

Resumen:

- **Nueve correcciones que alteran el número reportado.** Las pérdidas
  urinarias de calcio ya no se cuentan dos veces; el factor de los
  inhibidores de la bomba de protones depende de si el suplemento se
  toma en ayuno o con comida; el índice UV se estima por geometría solar
  en vez de fijarse a la latitud de Panamá; el protector solar entra
  como transmisión parcial; la proteína se pondera por DIAAS de cada
  fuente; la circunferencia de pantorrilla se puntúa como SARC-CalF con
  ajuste por adiposidad; el calcio del agua de consumo entra al balance;
  y la meta de vitamina D se escala por tamaño corporal.
- **Dos defectos corregidos.** La tarjeta de vitamina D mostraba
  literalmente `undefined /15mcg` en pantalla y exportaba la cadena
  `undefined` al CSV, porque la interfaz leía un campo que el motor
  nunca devolvió. Y la columna de procedencia del suplemento de vitamina
  D se rellenaba con 1 incluso para participantes sin suplemento.
- **Panel bioquímico completo** (`js/biomarkers.js`): albúmina con
  calcio corregido, paratohormona, fósforo, fosfatasa alcalina,
  magnesio, filtración glomerular estimada y calcio urinario, evaluados
  como patrones y no como hallazgos aislados.
- **Módulo de exactitud diagnóstica** (`js/validation.js`) y su pestaña:
  la herramienta puede ahora demostrar su propio desempeño contra la
  densitometría, en el navegador y sin enviar datos a ningún sitio.
- **Diccionario de datos** de 122 campos, exportable en CSV y en formato
  de importación de REDCap, más exportación en formato largo.
- **Registro de parámetros con grado de evidencia.** Las 49 constantes
  del modelo declaran su fuente y su grado; los 4 parámetros heurísticos
  se enumeran solos en la pestaña de Metodología, y son la lista de
  trabajo del estudio de validación.
- **La pantalla gris, sustituida por un mensaje útil**, y autoguardado
  del formulario para no perder una entrevista con un recargado
  accidental.

---

## Instalación y uso

No hay paso de compilación ni dependencias que instalar. Son archivos
estáticos.

### Abrir en local

```bash
# Un servidor estático cualquiera; el navegador necesita servir los
# archivos por HTTP para que el compilador de JSX los cargue.
python3 -m http.server 8000
# luego abrir http://localhost:8000
```

Abrir `index.html` directamente con doble clic **no** funciona en la
mayoría de los navegadores, porque el compilador de JSX carga los
archivos de `js/` por fetch y el origen `file://` lo bloquea.

### Publicar en GitHub Pages

Subir el contenido del repositorio y activar Pages sobre la rama
principal. No hace falta configuración adicional.

### Requiere conexión

La interfaz carga cuatro bibliotecas externas (Tailwind, FontAwesome,
React y el compilador de JSX) desde tres dominios, en cada arranque. Sin
conexión, o con un cortafuegos institucional que bloquee esos dominios,
la herramienta no abre. Es la limitación operativa de mayor riesgo para
el trabajo de campo; la v6.0 no la resuelve, pero al menos falla con un
mensaje que dice qué biblioteca no cargó en vez de dejar la pantalla
gris.

---

## Estructura

```
index.html                 arranque, orden de carga y red de seguridad
css/style.css              estilos propios
js/data.js                 catálogos, constantes y registro de parámetros
js/algorithm.js            motor CARDA v6.0
js/biomarkers.js           panel bioquímico y patrones integrados
js/validation.js           exactitud diagnóstica y psicometría
js/codebook.js             diccionario de datos y lectura de CSV
js/ui-panels.js            paneles de interfaz y gráficos en SVG
js/app.js                  componente principal
js/i18n.js                 registro de idiomas
js/i18n/{es,en,pt}.js      tablas de traducción
tests/validacion.js        188 pruebas del motor contra la literatura
tests/estadistica.js       103 pruebas del módulo estadístico
tests/humo.js              prueba de humo del componente
AUDITORIA_v3.1.md          diagnóstico que originó la v6.0
CHANGELOG.md               qué cambió y con qué efecto numérico
METODOS.md                 ecuaciones, supuestos y protocolo de validación
```

**El orden de carga de `index.html` importa.** `data.js` declara las
constantes que `algorithm.js` consume, `biomarkers.js` depende de las
dos, y `ui-panels.js` tiene que estar antes de `app.js` porque `app.js`
usa sus componentes. Cambiar el orden deja la pantalla en gris.

---

## Pruebas

Requieren Node (cualquier versión reciente; probado con Node 22). No hay
dependencias que instalar: las tres suites concatenan los archivos del
motor y los evalúan, igual que hace el navegador.

```bash
node tests/validacion.js     # 188 pruebas: el motor contra la literatura
node tests/estadistica.js    # 103 pruebas: el módulo estadístico
node tests/humo.js           # el componente se carga y renderiza
```

Las tres devuelven 0 si todo pasa y 1 si algo falla.

### Qué comprueba cada una

**`validacion.js`** contrasta el motor contra **valores publicados**, no
contra su propia implementación: la curva de Heaney en varios puntos, la
tabla de absorción de Weaver y Heaney alimento por alimento, la regla de
Holick, el índice UV de cielo claro frente a los máximos observados en
Panamá y en Helsinki, la ecuación CKD-EPI 2021 con valores derivados a
mano, los puntajes OST y ORAI contra sus ejemplos publicados, el corte
de SARC-CalF, los factores de los inhibidores en ayuno y con comida, y
la ausencia de doble conteo de las pérdidas urinarias. Cada aserción
imprime su fuente.

**`estadistica.js`** contrasta cada estadístico contra un valor publicado
o una **identidad algebraica conocida** —por ejemplo, que el alfa
estandarizado de dos ítems cumpla exactamente la fórmula de
Spearman-Brown, o que el área bajo la curva calculada por la regla
trapezoidal coincida con la calculada por el estadístico U—. Cada prueba
declara cuál de los dos casos es.

**`humo.js`** ejecuta la lógica real del componente bajo Node, con React
simulado y un transformador de JSX propio, para detectar el uso de
constantes antes de su declaración —el fallo que deja la pantalla en
gris—. Renderiza además los nueve componentes de `ui-panels.js` uno por
uno, porque las pestañas solo montan el panel activo y un fallo en la
pestaña de Validación es tan grave como uno en la de Tamizaje.
Comprueba también la cobertura de los tres idiomas y la del diccionario
de datos frente a los campos que el CSV exporta.

---

## Flujo de trabajo del estudio de validación

1. **Entrevista.** Pestaña *Tamizaje*. El formulario se autoguarda en el
   navegador, así que un recargado accidental no pierde la sesión.
2. **Guardar en el registro.** Cada fila lleva estampada la versión del
   motor y la huella de parámetros con que se calculó.
3. **Exportar.** El CSV ancho incluye 12 columnas del patrón de oro
   **vacías** a propósito (`dxaTScoreLumbar`, `dxaDmoBaja`,
   `sarcopeniaEWGSOP2`, `retestRiesgoOseoPuntaje`…).
4. **Rellenar el patrón de oro.** Cuando llegue la densitometría, pegar
   los valores en esas columnas con cualquier hoja de cálculo. Al no
   tener que cruzar dos archivos, se evita el error de emparejado.
5. **Validar.** Pestaña *Validación*: pegar el CSV, elegir predictor y
   desenlace, y se obtienen la curva ROC con su intervalo de confianza,
   la tabla completa de cortes, la exactitud en el corte recomendado, la
   calibración por grupos y la comparación contra el OST o el ORAI.
   Todo exportable.
6. **Documentar.** Pestaña *Metodología*: descargar el diccionario de
   datos para el material suplementario, y consultar el registro de
   parámetros para la sección de métodos.

**Si ajusta un parámetro a mitad del estudio**, la huella cambia. Las
filas anteriores siguen en el CSV ya exportado con su huella antigua, y
el análisis puede separar los subconjuntos. Al recargar la herramienta,
el registro guardado con otra huella no se restaura, y se avisa en
pantalla en vez de mezclar dos modelos en silencio.

---

## Idiomas

| Idioma | Estado |
|---|---|
| Español (`es`) | Idioma de referencia, completo (752 claves) |
| Inglés (`en`) | Completo, traducido del español |
| Portugués (`pt`) | Completo, traducido del español |

La prueba de humo verifica que los tres tengan el mismo conjunto de
claves: una clave presente solo en español dejaría el inglés y el
portugués mostrando texto castellano sin avisar, porque el traductor
recurre al idioma de referencia en silencio.

**Las redacciones de los instrumentos validados no están validadas
lingüísticamente.** Los ítems del SARC-F y equivalentes se muestran
traducidos para la operación de campo, pero una traducción no validada
de un instrumento no es usable como instrumento en una publicación. Si
el estudio va a aplicar el SARC-F en inglés o en portugués, debe usarse
la versión validada para esa población y citarla.

---

## Limitaciones

1. **Los umbrales del riesgo óseo y de la categoría solar son
   heurísticos.** Son calibraciones propias de cribado, no derivadas de
   una validación externa. La herramienta los declara como tales y los
   enumera en la pestaña de Metodología. Calibrarlos es el objeto del
   estudio en curso.
2. **El cuestionario de frecuencia es corto a propósito** y por tanto
   subestima la ingesta. Se mide la plausibilidad y se marcan las
   entrevistas con señales de subregistro, pero eso no convierte la
   estimación en una medición.
3. **La síntesis cutánea de vitamina D es un modelo**, con varios
   supuestos encadenados y una cota superior de cielo claro. No es
   comparable en incertidumbre con la ingesta estimada del
   cuestionario, y por eso las dos vías se reportan separadas.
4. **Los datos de composición de alimentos son genéricos.** Las cifras
   panameñas —y sobre todo la fortificación de las bebidas vegetales,
   que varía mucho entre marcas— deben contrastarse con las etiquetas
   del mercado local. La herramienta permite marcar cada alimento como
   verificado con etiqueta o genérico, y esa procedencia viaja al CSV.
5. **No funciona sin conexión** (ver arriba).
6. **El panel bioquímico no es un diagnóstico.** Devuelve patrones y
   niveles de derivación, con los rangos de referencia del método más
   habitual. Los rangos varían entre laboratorios.

---

## Autor

**MEd Jean Carlos Ruiz Mosley** — Nutricionista-Dietista especializado en
nutrición basada en plantas.

© 2026 Jean Carlos Ruiz Mosley. Todos los derechos reservados.
