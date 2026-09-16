# Métodos — CalD Risk Screen (motor CARDA v6.0)

Documento redactado para servir de base a la sección de métodos de un
manuscrito. Todas las ecuaciones están en la notación que el motor
implementa, y cada constante remite al registro de parámetros
(`REGISTRO_PARAMETROS` en `js/data.js`), donde figura con su fuente y su
grado de evidencia.

Sello del motor: `CARDA-v6.0+2e78524e`. La parte tras el `+` es la huella
determinista del conjunto de parámetros y viaja en cada fila exportada.

---

## 1. Diseño del instrumento

CalD Risk Screen es una herramienta de tamizaje determinística, sin
backend, que se ejecuta íntegramente en el navegador del evaluador. No
transmite datos a ningún servidor. Estima, a partir de un cuestionario
de frecuencia de consumo, de variables de exposición solar y de un panel
bioquímico opcional:

1. calcio absorbible neto y su razón de adecuación,
2. adecuación de vitamina D por ingesta y entrada total estimada,
3. riesgo óseo orientativo (puntaje compuesto propio, más dos índices
   publicados como comparador),
4. riesgo de sarcopenia (SARC-F y SARC-CalF),
5. patrones bioquímicos del metabolismo mineral.

Es determinística: para una misma entrada devuelve siempre la misma
salida, sin componentes aleatorios, con la única excepción del
remuestreo del módulo estadístico, que usa semilla fija y por tanto es
reproducible también.

**Población de uso previsto.** Adultos de 18 años o más. Los índices
ORAI y los cortes de circunferencia de pantorrilla tienen restricciones
de población que el motor aplica por sí mismo (§8.2, §7.2).

---

## 2. Calcio absorbible

### 2.1 Curva de saturación de la absorción fraccional

La absorción fraccional de calcio decrece de forma logarítmica con la
carga de la comida (Heaney, Weaver y Fitzsimmons, *J Bone Miner Res*
1990;5:1135):

```
FA(carga) = 0.889 − 0.0964 × ln(carga_mg)
```

acotada al intervalo [0.05, 0.75] para no extrapolar fuera del rango de
los ensayos.

### 2.2 Normalización por la carga de medición

Cada alimento tiene una absorción fraccional medida con isótopos
estables a una carga concreta de ensayo. Aplicar directamente esa
absorción fraccional a una carga distinta cuenta dos veces el efecto de
dosis. El motor lo resuelve normalizando:

```
absorbido_i = mg_i × FA_medida_i × [ FA(carga_comida) / FA(carga_medición_i) ]
```

donde `carga_comida` es el calcio total de la comida en la que el
alimento aparece. De este modo la absorción fraccional propia del
alimento (oxalato, fitato, matriz) se conserva, y el efecto de
saturación se aplica una sola vez, sobre la carga real.

### 2.3 Semana virtual

El cuestionario recoge frecuencia (días/semana), número de tomas al día
y porciones por toma, en medidas caseras. El motor reconstruye una
semana de 7 días × 3 comidas y coloca cada ocurrencia en ella,
respetando las reubicaciones manuales del evaluador cuando son válidas.
El suplemento de calcio se coloca en la comida de menor carga dietética,
que es la asignación que maximiza la absorción y por tanto la hipótesis
conservadora al estimar riesgo.

Las reubicaciones manuales se validan antes de indexar: un índice fuera
de 0–6 (día) o 0–2 (comida) se descarta y el ítem vuelve a su posición
automática.

### 2.4 Agua de consumo

```
mg_agua_por_comida = (litros_día × mg_por_litro) / 3
```

El aporte se reparte de forma uniforme entre las tres comidas de cada
día, porque el agua se bebe a lo largo de la jornada. Entra a la carga
de la comida, de modo que también desplaza la absorción fraccional del
resto de los alimentos por saturación. Absorción fraccional asignada
0.30 a una carga de referencia de 120 mg, comparable a la de la leche
(Couzy et al., *Am J Clin Nutr* 1995;62:1239; Heaney y Dowell,
*Osteoporos Int* 1994;4:323).

### 2.5 Pérdidas urinarias: modelo de exceso

Las ingesta de referencia de calcio del IOM/NASEM (2011) se derivaron de
estudios de balance en poblaciones con ingestas habituales de sodio y
cafeína, de modo que la excreción urinaria típica ya está incorporada en
la cifra. Restar la pérdida completa y comparar contra esa cifra cuenta
dos veces la misma pérdida. El motor modela la **desviación** respecto a
la ingesta de referencia:

```
pérdida = (Na_g − 3.0) × 10 mg  +  (tazas_café − 1) × 2.5 mg
calcio_absorbido_neto = calcio_absorbido_ajustado − pérdida
```

El signo se conserva: una ingesta de sodio inferior a la de referencia
produce un valor negativo, es decir un crédito, porque la excreción es
genuinamente menor que la del balance con que se fijó la ingesta de
referencia. Coeficientes: ~20–30 mg de calcio por cada 2300 mg de sodio
excretado (IOM 2011, cap. 4) y ~2.5 mg por taza de café.

### 2.6 Inhibidores de la bomba de protones

El carbonato de calcio requiere ácido gástrico para disolverse; el
citrato no. El factor depende además del momento de la toma:

| Situación | Factor sobre el suplemento |
|---|---|
| Carbonato en ayuno | 0.40 |
| Carbonato con comida | 0.85 |
| Citrato (cualquier momento) | sin penalización relevante |

El factor de ayuno procede de O'Connell et al. (*Am J Med* 2005;118:778),
donde el omeprazol redujo la absorción fraccional del carbonato del
9.1 % al 3.5 % en ayuno. Con alimentos, el propio alimento estimula la
acidez que el carbonato necesita, y la penalización casi desaparece.

### 2.7 Razón de adecuación

```
razón_neta = calcio_absorbido_neto / meta_absorbida_diaria
```

La meta absorbida se deriva de la ingesta de referencia del organismo
elegido (IOM/NASEM o EFSA) aplicando la absorción fraccional esperada a
esa carga. Se ofrece también el umbral de 525 mg/día de EPIC-Oxford como
marco alternativo, señalado como umbral único de ingesta y no como marco
completo por edad y sexo.

---

## 3. Vitamina D por ingesta

```
total_equivalente = Σ (mcg_alimento) + mcg_suplemento × f_forma
```

con `f_forma` = 1.0 para D3 y un factor de potencia menor para D2. Se
reportan por separado el total sin corregir (`totalBruto`) y el
equivalente de potencia D3 (`totalEq`), porque la diferencia entre ambos
es información metodológica que un revisor necesita ver.

Conversión: 1 mcg = 40 UI.

### 3.1 Ajuste por tamaño corporal

La vitamina D es liposoluble y se distribuye en el compartimento graso,
de modo que a igual dosis la concentración sérica alcanzada es
inversamente proporcional a la masa corporal (dilución volumétrica;
Drincic et al., *Obesity* 2012;20:1444). Ekwaru et al. (*PLoS One*
2014;9:e111265) cuantificaron el orden de magnitud del ajuste necesario:

| IMC (kg/m²) | Multiplicador de la meta |
|---|---|
| < 25 | 1.0 |
| 25–29.9 | 1.5 |
| 30–34.9 | 2.0 |
| ≥ 35 | 2.5 |

```
meta_ajustada = min( UL , meta_edad × multiplicador_IMC )
```

La meta sin ajustar se conserva y se reporta junto a la ajustada. El
ajuste está declarado como **derivado de estudios observacionales**, no
como valor de guía, y se limita por el nivel máximo tolerable
(100 mcg/día): un ajuste que llevara la meta por encima del UL no sería
una recomendación defendible.

---

## 4. Síntesis cutánea de vitamina D

### 4.1 Índice UV de cielo claro

Declinación solar por la ecuación de Cooper (*Solar Energy* 1969;12:333):

```
δ = 23.45° × sin( 360° × (284 + N) / 365 )
```

con `N` el día del año (se usa el día 15 de cada mes como
representativo, porque la declinación cambia poco dentro de un mes).

Coseno del ángulo cenital solar:

```
μ = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(h)      h = 15° × (hora_solar − 12)
```

truncado en 0 (no existe radiación negativa). Índice UV de cielo claro:

```
UVI = 12.5 × μ^2.42 × (ozono/300 DU)^(−1.23) × (1 + 0.06 × altitud_km)
```

Es la forma funcional de las parametrizaciones de transferencia
radiativa al uso en fotobiología. Los coeficientes están fijados para
reproducir los máximos observados y la parametrización es una **cota
superior**: supone cielo despejado y ausencia de aerosoles.

Verificación frente a valores observados (recogida en
`tests/validacion.js`):

| Lugar y época | Modelo | Observado |
|---|---|---|
| Ciudad de Panamá (9° N), marzo, mediodía | 11.9 | 10–12 |
| Helsinki (60° N), solsticio de junio | 7.3 | 6–7 |
| Helsinki (60° N), diciembre | < 0.1 | invierno de vitamina D |

### 4.2 Cadena de fiabilidad del dato

El índice UV se resuelve en este orden, y la procedencia se propaga al
resultado y a la fila exportada:

1. `observado` — valor medido y declarado por el evaluador.
2. `modelo_cielo_claro` — estimado por §4.1 a partir de latitud y mes.
3. `valor_tipico_panama` — valor de reserva cuando faltan latitud o mes.

Un resultado de reserva no es comparable con uno medido, y el informe
tiene que poder decirlo.

### 4.3 Dosis eritemática y síntesis

El índice UV equivale aproximadamente a los SED recibidos en una hora de
exposición a esa intensidad:

```
SED_sesión = UVI × (minutos/60) × transmisión_protector
MED_fototipo ∈ {I: 2, II: 2.5, III: 3, IV: 4.5, V: 6, VI: 8} SED
fracción_MED = SED_sesión / MED_fototipo
```

Síntesis por la regla de Holick (¼ MED sobre ¼ de superficie corporal
≈ 1000 UI de vitamina D3), con saturación por encima de 1 MED —por
encima de esa dosis la síntesis no aumenta y sí el daño— y declive con
la edad por pérdida de 7-dehidrocolesterol cutáneo:

```
UI_sesión = 1000 × (fracción_MED_efectiva / 0.25) × (fracción_superficie / 0.25) × f_edad
```

Fracciones de superficie corporal: mínima 0.10 (cara y manos), parcial
0.25 (cara, brazos y manos), amplia 0.50.

### 4.4 Protector solar

La cantidad que se aplica en la práctica (0.5–1.0 mg/cm²) es una
fracción de los 2 mg/cm² con que se determina el factor de protección de
la etiqueta, así que la protección real es una fracción de la nominal:

```
transmisión = 1 / √FPS_declarado
```

Tratarla como bloqueo total subestima la síntesis; ignorarla la
sobrestima.

### 4.5 Categorización del riesgo solar

```
UI_día = UI_sesión × días_semana / 7
categoría = bajo      si UI_día ≥ 1.00 × RDA_UI
            moderado  si UI_día ≥ 0.40 × RDA_UI
            alto      en otro caso
```

Los dos cortes están declarados **heurísticos** en el registro de
parámetros y deben calibrarse contra la 25-hidroxivitamina D sérica del
estudio.

### 4.6 Entrada total estimada

```
UI_total = UI_dieta + UI_suplemento + UI_cutánea
```

**Advertencia metodológica que este resultado lleva siempre.** Las
ingestas de referencia de vitamina D del IOM se derivaron bajo el
supuesto explícito de **exposición solar mínima**. Comparar esta suma
directamente contra la RDA no es una comparación legítima, porque la RDA
no está definida para ese total. Se reporta como **entrada total
estimada**, con la RDA solo como escala de referencia. Las tres vías se
devuelven separadas, con su peso relativo, porque no comparten
incertidumbre: la ingesta se estima de un cuestionario y la síntesis
cutánea de un modelo fotobiológico con varios supuestos encadenados. El
nivel máximo tolerable se aplica solo a la ingesta, no a la síntesis
cutánea, que es autolimitada.

---

## 5. Proteína

### 5.1 Proteína bruta y objetivo

```
g_día = Σ (proteína_porción × porciones × tomas_día × días_semana) / 7
g_por_kg = g_día / peso_kg
```

Objetivo por edad, con el ajuste para dieta vegetal de versiones
anteriores conservado para la ruta de proteína bruta.

### 5.2 Proteína utilizable por DIAAS

La variación de calidad **entre** fuentes vegetales es mayor que la que
hay entre vegetal y animal: el gluten de trigo (DIAAS 0.25) y la
proteína de soja (0.90) no se parecen en nada. Un factor global los
trata igual. El motor pondera por fuente:

```
proteína_utilizable = Σ (g_alimento × DIAAS_alimento)
DIAAS_medio = proteína_utilizable / proteína_bruta
```

Valores de DIAAS de FAO (2013) y de la recopilación de Herreman et al.
(*Food Sci Nutr* 2020;8:5379), con el patrón de aminoácidos de adulto.
Los alimentos sin DIAAS publicado llevan un valor **estimado** por
analogía con su grupo, declarado como tal en el catálogo.

**Para no contar dos veces la misma corrección:** la proteína utilizable
se compara contra el objetivo **sin** el factor de dieta vegetal, porque
el DIAAS ya hace ese trabajo. La proteína bruta se sigue comparando
contra el objetivo ajustado. Las dos rutas se reportan juntas.

### 5.3 Umbral de leucina por comida

En el adulto mayor, estimular la síntesis proteica muscular requiere una
cantidad mínima de leucina **por comida**, no solo un total diario
suficiente (Bauer et al., PROT-AGE, *J Am Med Dir Assoc* 2013;14:542;
Deutz et al., ESPEN, *Clin Nutr* 2014;33:929). El motor calcula la
leucina de la comida de mayor aporte proteico y la contrasta con el
umbral de 2.5 g, solo en participantes de 65 años o más.

### 5.4 Plausibilidad del cuestionario

El catálogo es deliberadamente corto, lo que implica que la proteína
estimada queda por debajo de la real. Siguiendo la lógica de los puntos
de corte de Goldberg (Goldberg et al., *Eur J Clin Nutr* 1991;45:569),
aplicada a proteína en vez de a energía, se marcan tres situaciones:

| Bandera | Criterio |
|---|---|
| `cuestionario_incompleto` | menos de 3 alimentos declarados |
| `subregistro_probable` | proteína < 50 % del objetivo |
| `sobredeclaracion_probable` | proteína > 300 % del objetivo |

La herramienta **marca, no descarta**. La decisión de excluir a un
participante corresponde al protocolo de análisis y debe quedar
documentada. El corte del 50 % está declarado heurístico.

---

## 6. Panel bioquímico

Todos los analitos son opcionales. El módulo clasifica cada uno contra
su rango de referencia y, sobre todo, los evalúa **en conjunto**: el
valor de un panel está en el patrón, no en hallazgos aislados.

### 6.1 Calcio corregido por albúmina

```
Ca_corregido = Ca_medido + 0.8 × (4.0 − albúmina_g_dL)
```

Fórmula de Payne (Payne et al., *BMJ* 1973;4:643). Cerca de la mitad del
calcio circulante viaja unido a albúmina, así que en hipoalbuminemia el
calcio total cae sin que exista hipocalcemia real. Es una aproximación
de regresión: cuando la decisión depende del valor, el patrón es el
calcio iónico. El módulo señala explícitamente cuando la corrección
cambia la clasificación.

El calcio sérico está bajo control hormonal estrecho y **no** refleja la
ingesta de calcio: puede ser normal con una ingesta crónicamente
insuficiente. Esa advertencia acompaña siempre al analito.

### 6.2 Filtración glomerular estimada (CKD-EPI 2021)

```
TFGe = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^(−1.200)
             × 0.9938^edad × (1.012 si mujer)
```

con κ = 0.7 (mujer) o 0.9 (varón) y α = −0.241 (mujer) o −0.302 (varón).
Ecuación sin término racial, vigente y recomendada por NKF-ASN (Inker et
al., *N Engl J Med* 2021;385:1737). Estadificación KDIGO.

Importa por dos razones: la 1α-hidroxilación de la vitamina D es renal,
de modo que una filtración baja cambia por completo la interpretación de
la 25-hidroxivitamina D; y la estimación por creatinina pierde exactitud
en masa muscular extrema.

### 6.3 Excreción urinaria de calcio

```
razón_Ca/Cr = Ca_orina_mg_dL / Cr_orina_mg_dL          límite 0.20 mg/mg
Ca_24h_por_kg = Ca_24h_mg / peso_kg                    límite 4 mg/kg/24 h
```

más los límites absolutos por sexo. La hipercalciuria es una causa
tratable de pérdida ósea y un contraindicador relativo de la
suplementación.

### 6.4 Suplementación con creatina como confusor

La herramienta registra el uso de creatina desde versiones anteriores.
La creatina eleva la creatinina sérica y urinaria sin que exista daño
renal, de modo que:

- la filtración glomerular estimada queda **subestimada**,
- la razón calcio/creatinina queda **infraestimada**, y una
  hipercalciuria real puede pasar desapercibida.

El módulo señala ambas cosas cuando el participante lo declara.

### 6.5 Patrones integrados

Catorce patrones, cada uno con los analitos que lo sostienen y un nivel
de derivación (`seguimiento`, `derivacion`, `derivacion_urgente`). Los
principales:

| Patrón | Criterio |
|---|---|
| Hiperparatiroidismo secundario a vitamina D | PTH alta + Ca corregido normal/bajo + 25(OH)D reducida |
| Hiperparatiroidismo secundario renal | PTH alta + TFGe reducida |
| Hiperparatiroidismo primario posible | Ca corregido alto + PTH no suprimida |
| Hiperparatiroidismo normocalcémico posible | PTH alta + Ca, 25(OH)D y TFGe normales |
| Hipoparatiroidismo posible | Ca corregido bajo + PTH baja o inapropiadamente normal |
| Osteomalacia bioquímica posible | 25(OH)D deficiente + FA alta y/o fósforo bajo |
| Trastorno mineral y óseo renal | TFGe reducida + fósforo alto o PTH alta |
| Hipocalcemia con hipomagnesemia | Ca corregido bajo + Mg bajo |
| Hipervitaminosis D con hipercalcemia | 25(OH)D sobre rango + Ca corregido alto |

El módulo **no** emite indicaciones de dosis ni de tratamiento, y todo
el bloque va acompañado del descargo de que la interpretación corresponde
al médico tratante, con los rangos del laboratorio emisor y el contexto
clínico completo.

---

## 7. Sarcopenia

### 7.1 SARC-F

Cinco ítems de 0 a 2 puntos. Se reportan los dos cortes por separado
(≥4, más específico; ≥2, más sensible), porque la asimetría
sensibilidad/especificidad del instrumento es real y ocultarla sería
peor.

### 7.2 SARC-CalF

La circunferencia de pantorrilla entra como **sexto ítem**, puntuado 0 o
10, y el corte del total pasa a ≥11 (Barbosa-Silva et al., *J Am Med Dir
Assoc* 2016;17:1136).

Los cortes fijos de 33/34 cm tienen un sesgo conocido por adiposidad, así
que la medida se ajusta por IMC antes de aplicar el corte (González et
al., *J Cachexia Sarcopenia Muscle* 2021;12:1359):

| IMC (kg/m²) | Ajuste a la circunferencia |
|---|---|
| < 18.5 | +4 cm |
| 18.5–24.9 | 0 |
| 25–29.9 | −3 cm |
| ≥ 30 | −7 cm |

Sin peso y talla el corte se aplica sin ajustar y se señala: un ajuste
silencioso con datos ausentes es peor que no ajustar.

---

## 8. Riesgo óseo

### 8.1 Puntaje compuesto (propio, heurístico)

Suma de contribuciones ponderadas de adecuación de calcio, categoría
solar, vitamina D dietética, edad, sexo, ejercicio de fuerza, tabaco,
alcohol y grupo dietético (bloque conductual, sin cambios respecto a la
v3.1 para preservar la comparabilidad de las filas ya recogidas), más un
bloque bioquímico que puntúa **solo los analitos declarados**:
25-hidroxivitamina D, PTH, fosfatasa alcalina, filtración glomerular e
hipercalciuria.

```
fracción = (puntaje_conductual + puntaje_bioquímico)
         / (máximo_conductual + máximo_bioquímico_de_los_analitos_declarados)

categoría = bajo      si fracción ≤ 0.20
            moderado  si fracción ≤ 0.40
            alto      en otro caso
```

La categoría se decide sobre la **fracción del máximo alcanzable**, no
sobre el puntaje bruto: de lo contrario un participante con analítica
completa caería siempre en una categoría peor que otro idéntico sin
analítica, por el solo hecho de tener más datos.

Los dos cortes están declarados **heurísticos** y son el objeto
principal de la calibración pendiente contra densitometría.

### 8.2 Índices publicados como comparador externo

**OST** (Koh et al., *Osteoporos Int* 2001;12:699):

```
OST = ⌊ 0.2 × (peso_kg − edad_años) ⌋
```

Interpretación de la formulación original: > −1 riesgo bajo, −1 a −4
intermedio, < −4 alto. Derivado en mujeres asiáticas posmenopáusicas y
validado después en otras poblaciones; su desempeño es mejor en mujeres
posmenopáusicas que en varones.

**ORAI** (Cadarette et al., *CMAJ* 2000;162:1289):

| Ítem | Puntos |
|---|---|
| Edad ≥ 75 / 65–74 / 55–64 / < 55 | 15 / 9 / 5 / 0 |
| Peso < 60 kg / 60–69 kg / ≥ 70 kg | 9 / 3 / 0 |
| Sin terapia estrogénica actual | 2 |

Corte ≥9; sensibilidad 93.3 % y especificidad 46.4 % en la cohorte de
derivación, lo que lo hace útil para descartar y no para confirmar. El
motor **no** lo calcula en varones ni por debajo de los 45 años, porque
no se derivó en esas poblaciones.

**FRAX no se calcula**, y la decisión es deliberada: requiere licencia y
coeficientes no públicos.

---

## 9. Trazabilidad y registro de parámetros

Cada constante del modelo declara valor, unidad, fuente bibliográfica y
grado de evidencia:

| Grado | Significado | n |
|---|---|---|
| `medido` | valor experimental publicado (isótopos, ensayo clínico) | 17 |
| `consenso` | fijado por un organismo de referencia (IOM, EFSA, OMS) | 14 |
| `derivado` | calculado a partir de valores publicados | 7 |
| `estimado` | inferido por analogía con su grupo, sin medición directa | 7 |
| `heuristico` | calibración propia de cribado, **pendiente de validación** | 4 |

La huella de parámetros es FNV-1a de 32 bits sobre la serialización
canónica `clave=valor` ordenada. No es criptográfica: solo tiene que
cambiar cuando cambie cualquier parámetro y ser idéntica en cualquier
navegador y en Node, para que el dato exportado sea comparable. Cada
fila lleva `motorVersion` y `motorHuella`.

### 9.1 Parámetros pendientes de calibración

| Parámetro | Valor actual | Patrón de oro que debe calibrarlo |
|---|---|---|
| `UMBRAL_SOLAR_MODERADO_FRACCION_RDA` | 0.40 | 25-hidroxivitamina D sérica |
| `RIESGO_OSEO_CORTE_MODERADO` | 3 puntos | T-score de densitometría |
| `RIESGO_OSEO_CORTE_ALTO` | 5 puntos | T-score de densitometría |
| `PLAUSIBILIDAD_PROTEINA_FRACCION_MINIMA` | 0.50 | registro de 24 h o agua doblemente marcada |

---

## 10. Protocolo propuesto de validación

### 10.1 Desenlaces de referencia

| Constructo de la herramienta | Patrón de oro | Columnas del diccionario |
|---|---|---|
| Riesgo óseo compuesto | T-score de DXA (columna lumbar, fémur total, cuello femoral) | `dxaTScoreLumbar`, `dxaTScoreFemurTotal`, `dxaTScoreCuelloFemoral`, `dxaDmoBaja`, `dxaOsteoporosis` |
| Riesgo de vitamina D (solar + dieta) | 25-hidroxivitamina D sérica | `lab25OHVitD` |
| Riesgo de sarcopenia | EWGSOP2 (fuerza de prensión, masa muscular apendicular, velocidad de marcha) | `sarcopeniaEWGSOP2`, `fuerzaPrensionKg`, `masaMuscularApendicularKgM2`, `velocidadMarchaMs` |
| Reproducibilidad | repetición de la entrevista | `retestFecha`, `retestRiesgoOseoPuntaje` |

### 10.2 Análisis

Para cada par predictor–desenlace, el módulo `js/validation.js` produce:

1. **Discriminación.** Área bajo la curva ROC con intervalo de confianza
   por Hanley-McNeil y por remuestreo (semilla fija). El área se calcula
   por dos vías independientes —regla trapezoidal y estadístico U— y se
   reporta la discrepancia entre ambas: un valor no nulo delata un error
   de manejo de empates, el fallo clásico con puntuaciones enteras.
2. **Corte.** Índice de Youden, distancia mínima al vértice y corte de
   sensibilidad mínima exigida, **con la tabla completa de umbrales**,
   para que el corte publicado no parezca elegido a posteriori. Elegir
   un corte es una decisión sobre qué error importa más, no un resultado
   que el algoritmo encuentre.
3. **Exactitud en el corte.** Sensibilidad, especificidad, valores
   predictivos, razones de verosimilitud y razón de momios diagnóstica,
   con intervalos de Wilson. Los valores predictivos dependen de la
   prevalencia de la muestra y no son transferibles; la sensibilidad, la
   especificidad y las razones de verosimilitud sí.
4. **Calibración.** Proporción observada de desenlace por grupo de
   puntaje, con intervalo de confianza y comprobación de monotonía. La
   discriminación y la calibración son cosas distintas: un puntaje puede
   ordenar bien y asignar probabilidades equivocadas.
5. **Comparación con el comparador externo.** Diferencia de áreas entre
   el puntaje propio y el OST o el ORAI, remuestreando **individuos** y
   no predictores, porque las dos áreas están correlacionadas al
   proceder de los mismos participantes.
6. **Fiabilidad.** Coeficiente de correlación intraclase de dos vías
   para test-retest, devolviendo acuerdo absoluto y consistencia por
   separado para que el sesgo sistemático quede visible; kappa de Cohen
   ponderada para las categorías ordinales.
7. **Consistencia interna.** Alfa de Cronbach crudo y estandarizado con
   correlación ítem-total corregida, para el SARC-F.
8. **Concordancia entre mediciones continuas.** Bland-Altman con límites
   de acuerdo y prueba de sesgo proporcional.

### 10.3 Tamaño de muestra orientativo

Cifras de orientación para el diseño, no sustitutos de un cálculo formal
con los parámetros definitivos del protocolo:

- **Área bajo la curva.** Para detectar un área de 0.75 frente a 0.5 con
  potencia del 80 % y α = 0.05, con una razón de 1:2 entre casos y
  controles, el orden de magnitud es de unos 35–40 casos y 70–80
  controles. Con la prevalencia esperada de densidad mineral ósea baja
  en la población del estudio, eso fija el tamaño total.
- **Precisión de la sensibilidad.** Para una sensibilidad esperada del
  85 % con una semiamplitud de intervalo de ±10 puntos porcentuales se
  necesitan del orden de 50 casos.
- **Coeficiente de correlación intraclase.** Para un valor esperado de
  0.80 con límite inferior del intervalo en 0.60, dos mediciones por
  participante, el orden es de 45–50 participantes.
- **Calibración.** Al menos 10 participantes por grupo de puntaje; con
  cinco grupos, 50 como mínimo absoluto y preferiblemente el doble.

La muestra de 180 participantes que el estudio contempla es holgada para
el análisis de discriminación y suficiente para la calibración por
quintiles, siempre que la prevalencia del desenlace no sea muy baja.

### 10.4 Reproducibilidad del análisis

Cada informe de validación se estampa con el sello del motor y la fecha.
Toda la cadena —desde el cuestionario hasta el intervalo de confianza—
corre en archivos de texto plano sin paso de compilación, de modo que un
revisor puede reproducir las cifras abriendo el repositorio y ejecutando
`node tests/validacion.js`, `node tests/estadistica.js` y
`node tests/humo.js`.

---

## 11. Lo que esta herramienta no hace

1. No calcula FRAX ni ninguna probabilidad absoluta de fractura a 10
   años.
2. No sustituye a la densitometría: no mide densidad mineral ósea ni
   emite un valor T.
3. No diagnostica osteoporosis, sarcopenia ni deficiencia de vitamina D.
4. No emite indicaciones de dosis ni de tratamiento, ni para nutrientes
   ni para fármacos.
5. No mide la ingesta con precisión: un cuestionario de frecuencia corto
   subestima por diseño, y por eso la herramienta marca las entrevistas
   con señales de subregistro en vez de tratarlas como equivalentes a
   las completas.
6. No funciona sin conexión: la interfaz depende de bibliotecas externas
   que se cargan en cada arranque.

---

## 12. Referencias

Absorción de calcio y biodisponibilidad
: Heaney RP, Weaver CM, Fitzsimmons ML. *J Bone Miner Res*
  1990;5:1135. — Weaver CM, Heaney RP. *Am J Clin Nutr* 1999;70(3
  Suppl):543S. — Couzy F et al. *Am J Clin Nutr* 1995;62:1239. — Heaney
  RP, Dowell MS. *Osteoporos Int* 1994;4:323.

Ingestas de referencia
: Institute of Medicine (NASEM). *Dietary Reference Intakes for Calcium
  and Vitamin D*. Washington DC: National Academies Press, 2011. — EFSA
  NDA Panel. *EFSA Journal* 2015 y 2016 (valores de referencia de
  calcio y de vitamina D).

Inhibidores de la bomba de protones
: O'Connell MB et al. *Am J Med* 2005;118:778.

Fotobiología de la vitamina D
: Holick MF. *N Engl J Med* 2007;357:266. — Terushkin V et al. *J Am
  Acad Dermatol* 2010;62:929. — Cooper PI. *Solar Energy* 1969;12:333
  (declinación solar).

Vitamina D y masa corporal
: Drincic AT et al. *Obesity* 2012;20:1444. — Ekwaru JP et al. *PLoS
  One* 2014;9:e111265.

Calidad proteica y umbral anabólico
: FAO. *Dietary protein quality evaluation in human nutrition*. Roma,
  2013. — Herreman L et al. *Food Sci Nutr* 2020;8:5379. — Bauer J et al.
  (PROT-AGE) *J Am Med Dir Assoc* 2013;14:542. — Deutz NEP et al.
  (ESPEN) *Clin Nutr* 2014;33:929.

Sarcopenia
: Malmstrom TK, Morley JE. *J Am Med Dir Assoc* 2013;14:531 (SARC-F). —
  Barbosa-Silva TG et al. *J Am Med Dir Assoc* 2016;17:1136
  (SARC-CalF). — González MC et al. *J Cachexia Sarcopenia Muscle*
  2021;12:1359. — Cruz-Jentoft AJ et al. (EWGSOP2) *Age Ageing*
  2019;48:16.

Cribado de densidad mineral ósea baja
: Koh LKH et al. *Osteoporos Int* 2001;12:699 (OST/OSTA). — Cadarette SM
  et al. *CMAJ* 2000;162:1289 (ORAI).

Bioquímica mineral y función renal
: Payne RB et al. *BMJ* 1973;4:643. — Inker LA et al. *N Engl J Med*
  2021;385:1737 (CKD-EPI 2021). — KDIGO. *Kidney Int* 2013 y
  actualización 2024 (estadificación).

Dieta vegetal y riesgo de fractura
: Appleby P et al. (EPIC-Oxford) *Eur J Clin Nutr* 2007;61:1400. — Tong
  TYN et al. (EPIC-Oxford) *BMC Med* 2020;18:353.

Plausibilidad del registro dietético
: Goldberg GR et al. *Eur J Clin Nutr* 1991;45:569. — Black AE. *Int J
  Obes* 2000;24:1119.

Estadística y exactitud diagnóstica
: Hanley JA, McNeil BJ. *Radiology* 1982;143:29. — DeLong ER et al.
  *Biometrics* 1988;44:837. — Youden WJ. *Cancer* 1950;3:32. — Wilson EB.
  *J Am Stat Assoc* 1927;22:209. — Bland JM, Altman DG. *Lancet*
  1986;1:307. — Shrout PE, Fleiss JL. *Psychol Bull* 1979;86:420
  (coeficiente de correlación intraclase). — Cronbach LJ.
  *Psychometrika* 1951;16:297. — Cohen J. *Educ Psychol Meas*
  1960;20:37 y *Psychol Bull* 1968;70:213 (kappa ponderada).

---

**Autor.** MEd Jean Carlos Ruiz Mosley — Nutricionista-Dietista
especializado en nutrición basada en plantas.

© 2026 Jean Carlos Ruiz Mosley. Todos los derechos reservados.
