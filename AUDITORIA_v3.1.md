# Auditoría de CalD Risk Screen v3.0 (motor CARDA v2.0)

Documento de trabajo previo a la v6.0. Cada hallazgo indica **qué está mal**,
**por qué importa**, **la fuente** y **el efecto numérico esperado** de
corregirlo. Se ordenan por impacto sobre el resultado que la herramienta
reporta, no por gravedad del código.

Estado de partida verificado en esta máquina: `node tests/validacion.js`
→ 85/85; `node tests/humo.js` → 5/5. El motor sí reproduce los valores
publicados que esas pruebas contrastan. Los problemas de abajo están en lo
que las pruebas **no** cubren.

---

## A. Defectos que cambian el número reportado

### A1. Doble conteo de las pérdidas basales de calcio

`aplicarModificadoresCalcio` resta del calcio absorbido la pérdida urinaria
completa atribuible al sodio y a la cafeína:

```
perdidaSodio   = gramosSodio × 10 mg
perdidaCafeina = tazas × 2.5 mg
absorbidoNeto  = absorbidoAjustado − (perdidaSodio + perdidaCafeina)
```

El problema es el referente contra el que se compara ese neto:
`metaAbsorbidaDiaria`, derivada de la RDA del IOM. Las RDA de calcio del
IOM/NASEM (2011) se derivaron de estudios de balance realizados en
poblaciones con ingestas **habituales** de sodio y cafeína, de modo que las
pérdidas urinarias típicas ya están incorporadas en la cifra de 1000–1200 mg.
Restarlas otra vez penaliza dos veces al mismo participante.

Con el nivel de sodio "medio" (3 g/día) y sin café, la versión 3.0 resta
30 mg/día a **todo** participante, incluido el que consume exactamente la
ingesta de referencia. Un participante con sodio alto (5 g) y 3 tazas de café
pierde 57.5 mg/día frente al 0 que le correspondería si su consumo fuera el de
referencia.

**Corrección v6.0.** Modelar el **exceso sobre la ingesta de referencia**:

```
perdida = (gramosSodio − SODIO_REFERENCIA) × 10 + (tazas − CAFE_REFERENCIA) × 2.5
```

con `SODIO_REFERENCIA = 3.0 g/día` (mediana de ingesta poblacional adulta con
la que se derivaron los balances) y `CAFE_REFERENCIA = 1 taza/día`. El signo se
conserva: un participante con sodio bajo recibe un crédito, no un castigo.
Efecto: el participante mediano gana ~30 mg/día de calcio absorbido neto; el
de sodio alto pierde 20 mg en vez de 50.

Fuente del coeficiente sodio→calcio: ~20–30 mg de calcio por cada 2300 mg de
sodio excretado (revisiones de balance de calcio; IOM 2011, cap. 4). El
coeficiente en sí es correcto; lo que estaba mal era el punto de referencia.

### A2. `resultadoVitDDieta.totalPromedioDia` no existe — se muestra `undefined` en pantalla

Aparece en **dos** sitios, y el segundo es visible para el participante.

`app.js`, línea 1572 — la tarjeta de vitamina D de la columna de resultados:

```jsx
<span class="text-2xl font-extrabold opacity-80">{resultadoVitDDieta.totalPromedioDia}<span class="text-xs font-semibold"> /{resultadoVitDDieta.meta}mcg</span></span>
```

En pantalla, donde debería leerse `12.4 /15mcg`, se lee **`undefined /15mcg`**.

`app.js`, línea 629 — el informe individual exportado:

```js
csv += `Vitamina D dietetica + suplemento (mcg/dia prom.);${resultadoVitDDieta.totalPromedioDia} / meta ${resultadoVitDDieta.meta}\r\n`;
```

`calcularAdecuacionVitaminaD` devuelve `totalEq`, `totalBruto`, `dietaEq`,
`suplEq` — nunca `totalPromedioDia`. El informe individual de cada
participante sale con la cadena literal `undefined` en la fila de vitamina D.
Es un defecto silencioso: no rompe la aplicación, solo corrompe el dato
exportado. **Corrección:** usar `totalEq` y añadir `totalBruto` en una fila
aparte, porque la diferencia entre ambos (la corrección D2/D3) es información
metodológica que el revisor necesita ver.

### A3. `vitDSupGenerico` se registra aunque no haya suplemento

`app.js`, línea 543: `suplementoVitD.forma !== 'ninguna' ? ... : ''`. El campo
`forma` solo toma los valores `'D3'`, `'D2'` o `'desconocida'`; nunca
`'ninguna'`. La condición es siempre verdadera, así que la columna de
procedencia del dato se llena con 1 incluso para participantes que no toman
suplemento de vitamina D. Lo mismo en la línea 639 del informe individual.
**Corrección:** la condición debe ser sobre la dosis (`uiPorDia > 0 &&
diasPorSemana > 0`), que es lo que define la existencia del suplemento.

### A4. La categoría solar que alimenta el riesgo óseo usa un modelo, y hay otro sin usar

`algorithm.js` define dos modelos solares completos:

- `calcularIndiceExposicionSolar` (sección 4) — índice en unidades
  arbitrarias, con umbrales calibrados "de modo que ~15 min/día caiga en bajo
  riesgo".
- `calcularExposicionSolarEstandar` (sección 12) — SED, fracción de MED y
  equivalente en UI por la regla de Holick.

`app.js` solo usa el segundo, y deriva la categoría con un criterio propio
escrito en línea (`ui >= metaUI`, `>= metaUI × 0.4`). El primero es **código
muerto**: no lo llama nadie, pero sigue exportando `FACTOR_HORARIO`,
`FACTOR_FOTOTIPO`, `FACTOR_SUPERFICIE_CORPORAL`, `UMBRAL_INDICE_SOLAR_BAJO` y
`UMBRAL_INDICE_SOLAR_MODERADO` como si estuvieran en uso, y el README lo
documenta como si fuera parte del cálculo. Un revisor que lea el código no
puede saber cuál de los dos produjo el resultado.

**Corrección:** eliminar el modelo de unidades arbitrarias, mover el criterio
de categorización desde `app.js` al motor (donde es verificable por la suite
de pruebas) y dejar una sola ruta de cálculo.

### A5. El índice UV está fijado a la latitud de Panamá

`INDICE_UV_TIPICO = { pico: 10, no_pico: 3 }`. Es razonable para Panamá (9°N),
pero la aplicación se publica en tres idiomas y la estructura admite ocho, lo
que implica uso fuera del trópico. Con esos valores, un participante en
Helsinki en diciembre recibiría la misma estimación de síntesis cutánea que
uno en Ciudad de Panamá en marzo, cuando la diferencia real es de más de un
orden de magnitud.

**Corrección:** estimar el índice UV de cielo claro a partir de latitud, mes y
franja horaria mediante el ángulo cenital solar, conservando el campo de
anulación manual para cuando el evaluador tenga el valor observado.

### A6. Calcio sérico interpretado sin corregir por albúmina

`interpretarCalcioSerico` compara el calcio total con 8.5–10.5 mg/dL sin más.
Cerca de la mitad del calcio circulante viaja unido a albúmina, así que en
hipoalbuminemia el calcio total cae sin que exista hipocalcemia real, y en
hiperalbuminemia ocurre lo contrario. En una población de estudio con dietas
100 % vegetales — donde la albúmina baja no es infrecuente — clasificar por
calcio total sin corregir produce falsos positivos de hipocalcemia.

**Corrección:** añadir la corrección de Payne y reportar ambos valores, con la
advertencia de que la fórmula es una aproximación y que el calcio iónico es el
patrón cuando la decisión clínica depende de ello.

---

## B. Ausencias que limitan el uso como herramienta de investigación

### B1. No hay huella de versión ni de parámetros en los registros exportados

El CSV acumulado no lleva ninguna marca de qué versión del motor ni qué
valores de parámetros produjeron cada fila. Si durante el estudio se ajusta un
solo coeficiente — y el README anuncia que los datos panameños de composición
**deben** ajustarse —, las filas recogidas antes y después quedan mezcladas sin
forma de distinguirlas. Eso invalida el análisis o obliga a recalcular todo a
mano.

**Corrección:** cada fila exportada lleva `motorVersion` y una huella
determinista (hash) del conjunto completo de parámetros del modelo.

### B2. No hay diccionario de datos

Se exportan ~60 columnas con nombres en castellano sin acentos y sin
definición, unidades ni codificación de los valores categóricos. Quien importe
ese CSV en SPSS o R tiene que inferir qué es `razonAdecuacionNeta` o qué
significan los niveles de `nivelSodio`.

**Corrección:** generador de diccionario de datos (nombre, etiqueta, tipo,
unidad, rango válido, codificación, fuente del parámetro) exportable en CSV y
en el formato de importación de REDCap.

### B3. No hay forma de validar la herramienta con la herramienta

El objetivo declarado del estudio es validar los umbrales del riesgo óseo
contra DXA. La v3.0 no calcula ningún estadístico: el investigador exporta el
CSV y hace todo fuera. Eso está bien, pero significa que la herramienta no
puede demostrar su propio desempeño ni el estudio puede reportar un corte
óptimo derivado con ella.

**Corrección:** módulo de exactitud diagnóstica y psicometría (ROC/AUC con
intervalo de confianza, sensibilidad y especificidad con intervalos de Wilson,
índice de Youden, kappa, coeficiente de correlación intraclase para
test-retest, alfa de Cronbach para SARC-F, Bland-Altman, calibración por
deciles) más la pestaña que lo expone.

### B4. Falta el panel bioquímico que da sentido a un tamizaje óseo

Se capturan dos analitos: calcio sérico total y 25(OH)D. Faltan los que
convierten esos dos en una interpretación: albúmina (ver A6), PTH intacta
—que es el mecanismo por el que la insuficiencia de vitamina D produce pérdida
ósea, y cuyo ascenso precede a la caída del calcio sérico—, fosfatasa
alcalina como marcador de recambio, fósforo, magnesio (cofactor de la
1α-hidroxilación), creatinina con tasa de filtración glomerular estimada, y
calcio urinario con razón calcio/creatinina.

Este último punto tiene una ironía documentada en el propio README de la
v2.7: la herramienta registra el uso de creatina precisamente porque eleva la
creatinina y distorsiona la razón calcio/creatinina — pero no calcula esa
razón.

### B5. El requerimiento de vitamina D no considera el tamaño corporal

`obtenerReferenciaVitaminaD` depende solo de la edad. La vitamina D es
liposoluble y se distribuye en el compartimento graso, de modo que a igual
dosis la concentración sérica alcanzada es inversamente proporcional a la
masa grasa (dilución volumétrica). La herramienta ya captura peso y talla, y
ya calcula el IMC para el CSV, pero no lo usa en ningún cálculo.

### B6. SARC-CalF implementado como alerta paralela y no con su puntuación validada

`calcularRiesgoSarcopenia` usa la circunferencia de pantorrilla como una
bandera independiente que degrada la categoría a `'alerta'`. El instrumento
validado (SARC-CalF) funciona de otro modo: la circunferencia entra como
sexto ítem puntuado 0 o 10, y el corte del total pasa a ≥11. Además los cortes
fijos de 33/34 cm tienen un sesgo conocido por IMC: en obesidad la pantorrilla
es gruesa aunque la masa muscular sea baja, y en delgadez ocurre lo inverso.

### B7. El riesgo óseo es un puntaje heurístico sin índice validado de contraste

El puntaje 0–10 de `calcularRiesgoOseo` es una construcción propia, algo que
el README reconoce. El problema para el estudio no es que sea heurístico —es
razonable como punto de partida— sino que no hay nada validado al lado con lo
que compararlo. Existen índices de cribado de densidad mineral ósea baja de
dominio público, con sus coeficientes publicados y su desempeño reportado, que
pueden calcularse sin licencia (a diferencia de FRAX, correctamente excluido).
Incluirlos da al estudio un comparador externo desde el primer participante.

### B8. No hay detección de subregistro del cuestionario

El catálogo es deliberadamente corto, lo que es defendible, pero implica que
la proteína estimada estará sistemáticamente por debajo de la real. Sin una
verificación de plausibilidad, una entrevista en la que el participante se
cansó y respondió "0" a la mitad del cuestionario entra al análisis con el
mismo peso que una completa.

---

## C. Robustez de la aplicación

### C1. Pantalla gris sin mensaje

Documentado en el propio README como síntoma conocido, con instrucciones para
abrir la consola del navegador. Es evitable: un `ErrorBoundary` de React más un
manejador de `window.onerror` y de `unhandledrejection` pueden mostrar en
pantalla el archivo y la línea. Para una herramienta que se usa frente al
participante en una entrevista, la diferencia entre "pantalla gris" y "no
cargó js/i18n/pt.js" es la diferencia entre perder la sesión y seguir.

### C2. Las reubicaciones manuales no se validan

`ejecutarSemanaVirtualCalcio` indexa `semanaVirtual[dia][comida]` con los
valores que vengan en `overridesManual`, sin comprobar rango. Un valor fuera
de 0–6 / 0–2 —posible si el estado se restaura desde un almacenamiento
persistente de otra versión— lanza `TypeError` y deja la pantalla gris.

### C3. Una entrevista se pierde con un recargado accidental

Todo el estado vive en memoria. El registro acumulado de participantes
—explícitamente pensado para 180 personas— desaparece con un F5.

### C4. Toda la aplicación depende de cuatro CDN en tiempo de ejecución

Tailwind, FontAwesome, React y Babel se cargan de tres dominios externos en
cada arranque, y el JSX se compila en el navegador en cada carga. Sin conexión
—o con el centro de salud tras un cortafuegos— la herramienta no abre. No lo
resuelvo en la v6.0 porque vendorizar esas bibliotecas añade cerca de un
megabyte al repositorio y cambia el modelo de publicación, pero queda
documentado como la limitación operativa de mayor riesgo para el trabajo de
campo.

---

## D. Lo que está bien y no se toca

Conviene dejarlo escrito para que la v6.0 no lo rompa:

- **La normalización de la absorción fraccional por la carga de medición.**
  `absorbido = mg × FA_medida × [FA(carga_comida) / FA(carga_medición)]` es la
  solución correcta al doble conteo del efecto de dosis, y está bien
  argumentada en los comentarios. Es la mejor idea del motor.
- **No calcular FRAX.** La decisión es correcta y está bien justificada.
- **Unidades caseras en vez de gramos.** El argumento sobre el error de
  recordatorio es el correcto para un cuestionario de frecuencia.
- **Reportar los dos cortes de SARC-F.** La asimetría
  sensibilidad/especificidad del instrumento es real y ocultarla sería peor.
- **Los dos marcos de 25(OH)D con señalización de la zona de desacuerdo.**
  Tratar la discrepancia entre organismos como dato y no como ruido es la
  decisión correcta.
- **La suite de pruebas que cita la fuente de cada aserción.** Se amplía, no
  se reemplaza.
