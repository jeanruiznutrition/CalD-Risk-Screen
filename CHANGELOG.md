# Registro de cambios

## v6.0 — motor CARDA v6.0

Sello del motor de esta versión: `CARDA-v6.0+564fedd1`

Cada fila exportada lleva ahora ese sello. La parte tras el `+` es una
huella determinista del conjunto completo de parámetros del modelo: si
alguien ajusta un solo coeficiente, la huella cambia y las filas
recogidas antes y después quedan distinguibles. Sin eso, ajustar las
cifras de composición panameñas a mitad del reclutamiento —algo que el
README ya anunciaba como necesario— habría mezclado dos modelos en un
mismo análisis.

Estado de las pruebas: **188 de 188** en la suite del motor, **103 de
103** en la del módulo estadístico y la prueba de humo del componente en
verde, sin advertencias.

---

## A. Cambios que alteran el número reportado

Un mismo participante puede dar un resultado distinto que en la v3.1.
Estas son todas las razones por las que eso ocurre, con el efecto
esperado.

### A1. Las pérdidas urinarias se modelan como exceso, no como pérdida absoluta

**Antes.** Se restaba del calcio absorbido la pérdida urinaria completa
atribuible al sodio y a la cafeína, y el resultado se comparaba contra
una meta derivada de la RDA del IOM.

**Problema.** Las RDA de calcio del IOM/NASEM (2011) se derivaron de
estudios de balance realizados en poblaciones con ingestas habituales de
sodio y cafeína, de modo que la excreción urinaria típica ya está
incorporada en los 1000–1200 mg. Restarla otra vez penalizaba dos veces
al mismo participante: con sodio «medio» y sin café, la v3.1 restaba
30 mg/día a **todo** participante, incluido el que consumía exactamente
la ingesta de referencia.

**Ahora.** Se modela la desviación respecto a la ingesta de referencia
(3.0 g/día de sodio, 1 taza/día de café), conservando el signo: quien
consume menos que la referencia recibe un crédito, porque su excreción
es genuinamente menor que la del balance con que se fijó la RDA.

**Efecto numérico.** El participante mediano gana ~30 mg/día de calcio
absorbido neto. Uno con sodio alto y 3 tazas de café pierde 20 mg en vez
de 50. La razón de adecuación neta sube en consecuencia.

### A2. El factor de los inhibidores de la bomba de protones depende del momento de la toma

**Antes.** Un factor único de 0.55 sobre el carbonato, aplicado a todo
usuario de inhibidores.

**Problema.** Ese factor proviene de estudios en ayuno (O'Connell et
al., *Am J Med* 2005: la absorción fraccional del carbonato cayó del
9.1 % al 3.5 % con omeprazol, en ayuno). El mismo carbonato tomado con
alimentos se disuelve con el ácido que la propia comida estimula, y la
penalización casi desaparece. Aplicar el factor de ayuno a todo el mundo
sobrestimaba el problema en la mayoría de los usuarios, que lo toman con
la comida porque es lo que indica la etiqueta.

**Ahora.** Se pregunta el momento de la toma. Factor 0.40 en ayuno y
0.85 con comida. El citrato es independiente del momento porque su
absorción no depende del pH gástrico.

**Efecto numérico.** Un usuario de inhibidores que toma carbonato con la
comida recupera cerca de la mitad del calcio del suplemento que la v3.1
le descontaba.

### A3. El índice UV se estima por geometría solar

**Antes.** `INDICE_UV_TIPICO = { pico: 10, no_pico: 3 }`, fijado a la
latitud de Panamá.

**Problema.** La aplicación se publica en tres idiomas y la estructura
admite ocho. Con valores fijos, un participante en Helsinki en diciembre
recibía la misma estimación de síntesis cutánea que uno en Ciudad de
Panamá en marzo, cuando la diferencia real es de más de un orden de
magnitud.

**Ahora.** El índice UV de cielo claro se estima a partir de latitud,
mes y franja horaria mediante la declinación solar (Cooper 1969) y el
coseno del ángulo cenital, con corrección por ozono y altitud. La
resolución del dato sigue una cadena de fiabilidad —valor observado por
el evaluador, modelo de cielo claro, valor de reserva de Panamá— y la
procedencia se propaga al resultado y a la fila exportada, porque
condiciona cuánto vale la estimación.

**Verificación.** El modelo da 11.9 al mediodía en Panamá (9° N, marzo),
frente a los 10–12 observados; 7.3 en Helsinki (60° N) en el solsticio
de junio, frente a los 6–7 observados; y menos de 0.1 en Helsinki en
diciembre, que es el «invierno de vitamina D» documentado por encima de
~40° de latitud.

**Efecto numérico.** Dentro de Panamá, cambios de pocos puntos
porcentuales. Fuera del trópico, cambios de más de un orden de magnitud
en la vitamina D cutánea estimada.

### A4. El protector solar entra como transmisión parcial

**Antes.** No se preguntaba, con el argumento de que el protector
bloquea la síntesis y por tanto la exposición con protector no cuenta.

**Problema.** Eso es cierto en condiciones de laboratorio y falso en la
práctica: la cantidad que la gente se aplica es del orden de
0.5–1.0 mg/cm² frente a los 2 mg/cm² con que se determina el factor de
protección de la etiqueta, así que la protección real es una fracción de
la nominal. Tratarla como bloqueo total subestima la síntesis; ignorarla
la sobrestima.

**Ahora.** Se pregunta, y la transmisión se modela como la raíz del
factor nominal, que es la aproximación al uso para la aplicación
incompleta. El mismo factor alarga el tiempo necesario para alcanzar
1000 UI.

### A5. La categoría de riesgo solar se calcula en el motor

**Antes.** El criterio estaba escrito en línea dentro de `app.js`, donde
la suite de pruebas no podía alcanzarlo. Y coexistían dos modelos
solares completos: el que la interfaz usaba y otro en unidades
arbitrarias que nadie llamaba pero que el README documentaba como si
calculara.

**Ahora.** El modelo de unidades arbitrarias se retiró (era código
muerto). La categorización vive en el motor, se deriva del equivalente
en UI/día frente a la ingesta de referencia, y la suite la cubre. Los
dos cortes (100 % y 40 % de la referencia) están declarados como
**heurísticos** en el registro de parámetros: deben calibrarse contra la
25-hidroxivitamina D sérica del estudio.

### A6. El calcio del agua de consumo entra al balance

**Antes.** No se preguntaba.

**Problema.** Es una fuente que los cuestionarios de frecuencia ignoran
por sistema. Un agua dura aporta 100–300 mg/día, del mismo orden que una
porción de lácteo, y su absorción fraccional es comparable a la de la
leche (Couzy et al. 1995; Heaney y Dowell 1994).

**Ahora.** Se pregunta como concentración en mg/L —que es lo que trae la
etiqueta o el informe de la red— y litros/día, con tipos orientativos
para quien no tenga el dato. El calcio se reparte de forma uniforme
entre las tres comidas de los siete días, de modo que entra a la carga
de cada comida y también desplaza hacia abajo la absorción fraccional
del resto de los alimentos: el efecto de saturación de la curva de
Heaney es real y el modelo lo captura.

**Efecto numérico.** Dos litros de agua dura añaden 240 mg/día de calcio
ingerido y aumentan el absorbido, con una caída leve de la eficiencia
global por saturación.

### A7. La proteína se pondera por DIAAS de cada fuente

**Antes.** Un factor global de 1.1 sobre el objetivo para dietas
vegetales.

**Problema.** Es una aproximación gruesa, porque la variación de calidad
**entre** fuentes vegetales es mayor que la que hay entre vegetal y
animal: el gluten de trigo (DIAAS 0.25) y la proteína de soja (0.90) no
se parecen en nada, y el factor único los trataba igual.

**Ahora.** Se calcula además **proteína utilizable**, ponderando cada
porción por el DIAAS de su fuente (FAO 2013; Herreman et al. 2020).
Importante para no contar dos veces la misma corrección: la proteína
utilizable se compara contra el objetivo **sin** el factor de dieta
vegetal, y la proteína bruta se sigue comparando contra el objetivo
ajustado, que es el comportamiento de la v3.1. Ambas rutas se reportan
juntas.

**Efecto numérico.** Dos dietas con proteína bruta prácticamente
idéntica pero fuentes distintas quedan separadas por cerca de un factor
de dos en proteína utilizable. Esa discriminación es nueva: el factor
global la destruía.

Se añade también la verificación del umbral de leucina por comida en
mayores de 65 años (PROT-AGE 2013; ESPEN 2014), porque el total diario
puede ser suficiente y no estimular la síntesis proteica muscular si se
reparte en porciones pequeñas.

### A8. La circunferencia de pantorrilla se puntúa como SARC-CalF

**Antes.** Se usaba como bandera paralela que degradaba la categoría a
«alerta».

**Problema.** El instrumento validado funciona de otro modo
(Barbosa-Silva et al., *J Am Med Dir Assoc* 2016): la circunferencia
entra como **sexto ítem** puntuado 0 o 10, y el corte del total pasa de
≥4 a ≥11. Con esa formulación la sensibilidad sube de forma sustancial
respecto al SARC-F solo, que es exactamente la limitación que la
herramienta ya documentaba.

**Ahora.** Puntuación SARC-CalF completa, y la circunferencia se ajusta
por IMC antes de aplicar el corte (González et al. 2021), porque los
cortes fijos de 33/34 cm sobrestiman la masa muscular en obesidad y la
subestiman en delgadez. Sin peso y talla el corte se aplica sin ajustar
y se señala: un ajuste silencioso con datos ausentes es peor que no
ajustar.

**Efecto numérico.** Un participante con SARC-F de 1 punto y pantorrilla
baja pasa de «alerta» a superar el corte del instrumento. En obesidad,
una pantorrilla de 35 cm puede ahora clasificarse como baja.

### A9. La meta de vitamina D se escala por tamaño corporal

**Antes.** Dependía solo de la edad, aunque la herramienta ya capturaba
peso y talla y ya calculaba el IMC para el CSV.

**Problema.** La vitamina D es liposoluble y se distribuye en el
compartimento graso, de modo que a igual dosis la concentración sérica
alcanzada es inversamente proporcional a la masa corporal. Es dilución
volumétrica, no un defecto de absorción (Drincic et al. 2012); Ekwaru et
al. (2014) cuantificaron que alcanzar la misma 25-hidroxivitamina D
requiere del orden de 1.5 veces la dosis en sobrepeso y 2–3 veces en
obesidad.

**Ahora.** La meta se escala por tramo de IMC, limitada por el nivel
máximo tolerable, y se reporta **junto** a la meta sin ajustar, nunca en
su lugar: el ajuste es orientativo y derivado de estudios
observacionales, no un valor de guía, y un revisor espera ver la cifra
del organismo.

### A10. Corregidos dos defectos que la v3.1 arrastraba en silencio

**`resultadoVitDDieta.totalPromedioDia`.** La interfaz y el informe
leían un campo que la función del motor nunca devolvió. En pantalla, la
tarjeta de vitamina D mostraba literalmente **`undefined /15mcg`**, y el
CSV del informe individual exportaba la cadena `undefined`. El nombre
correcto es `totalEq`. Se corrigieron los dos sitios y se dejó un alias
de compatibilidad para que ningún informe anterior quede roto. La suite
lo cubre ahora con una prueba que comprueba que el valor es un número.

**`vitDSupGenerico`.** La condición comparaba `suplementoVitD.forma`
contra `'ninguna'`. Ese valor **sí** es alcanzable —el desplegable lo
ofrece—, pero el valor por defecto es `'D3'`, de modo que la condición
resultaba verdadera para todo participante que no tocara ese control, y
la columna de procedencia del dato se rellenaba con 1 incluso sin
suplemento de vitamina D. En el CSV y en el informe la condición es ahora
sobre la **dosis**, que es lo que define la existencia del suplemento; en
el envoltorio de los campos de entrada sigue siendo sobre la forma.

> La primera corrección de este defecto aplicó la condición de dosis
> también al envoltorio de los propios campos de dosis y frecuencia, con
> lo que esos campos solo aparecían si el dato ya existía y no había
> manera de introducirlo. Está reparado, y `tests/humo.js` lo comprueba
> ahora interrogando el árbol renderizado con la ficha vacía. El
> diagnóstico completo, en `AUDITORIA_v3.1.md`, sección A3.

---

## B. Componentes nuevos

### B1. Panel bioquímico (`js/biomarkers.js`)

La v3.1 capturaba dos analitos: calcio sérico total y
25-hidroxivitamina D. Faltaban precisamente los que convierten esos dos
números en una interpretación. Se añaden albúmina, paratohormona
intacta, fósforo, fosfatasa alcalina, magnesio, creatinina con
filtración glomerular estimada, y calcio urinario de 24 h y en muestra
aislada con razón calcio/creatinina.

Lo que hace el módulo no es clasificar siete analitos por separado, sino
evaluarlos **en conjunto**, porque el valor de un panel está en el
patrón: una paratohormona alta significa una cosa con calcio alto y otra
distinta con calcio normal y vitamina D baja. Devuelve catorce patrones
posibles con los analitos que los sostienen y un nivel de derivación, y
no emite en ningún caso indicaciones de dosis ni de tratamiento.

Piezas concretas:

- **Calcio corregido por albúmina** (fórmula de Payne, 1973). Cerca de
  la mitad del calcio circulante viaja unido a albúmina, así que en
  hipoalbuminemia el calcio total cae sin que exista hipocalcemia real
  —relevante en una población con dietas 100 % vegetales. La corrección
  se declara como aproximación de regresión y se señala explícitamente
  cuando cambia la clasificación. Ejemplo verificado en la suite:
  7.8 mg/dL con albúmina de 2.8 g/dL corrige a 8.76 y pasa de «bajo» a
  «normal».
- **Filtración glomerular estimada** por CKD-EPI 2021 sin término racial
  (Inker et al., *N Engl J Med* 2021), con estadificación KDIGO. Importa
  porque la 1α-hidroxilación de la vitamina D es renal: una filtración
  baja cambia por completo la interpretación de la
  25-hidroxivitamina D.
- **El uso de creatina, por fin aprovechado.** La herramienta registraba
  ese dato desde la v2.7, justificándolo en el README por su efecto
  sobre la razón calcio/creatinina, pero la razón no se calculaba en
  ninguna parte. Ahora se calcula, y cuando el participante declara
  creatina el módulo señala que la filtración estimada queda
  **subestimada** y la razón calcio/creatinina **infraestimada**.

### B1a. Retirada del módulo de sarcopenia

Decisión del autor: el SARC-F y el SARC-CalF son instrumentos validados
por terceros, no son aporte de esta herramienta, y no sirven a su
propósito. Había además un problema metodológico que la retirada resuelve:
**el SARC-F se derivó y se validó en adultos mayores**, así que mostrarlo
a participantes jóvenes lo usaba fuera de su población de derivación —el
mismo error que el motor ya evita al negarse a calcular el ORAI en varones
y por debajo de los 45 años. Un instrumento incluido pero sin validar es,
además, lo primero que un revisor pregunta.

La **proteína no se retiró y no debe retirarse**: no es sarcopenia. La
calidad proteica es central en una dieta basada en plantas —el DIAAS
separa fuentes por casi un factor de dos— y la proteína es determinante de
la masa ósea. Se conserva para todas las edades.

Se retiraron: las constantes del SARC-F y del SARC-CalF, los cortes y el
ajuste por índice de masa corporal de la circunferencia de pantorrilla, la
función del motor, el cuestionario y las dos tarjetas de la interfaz, las
columnas del CSV, sus entradas del registro de parámetros y sus pruebas.

### B1b. Conclusión y conducta sugerida

**El hueco que cerraba.** La herramienta devolvía categorías por
nutriente y alertas sueltas, y dejaba al profesional la tarea de
integrarlas en una decisión. Para un informe técnico está bien; para el
propósito declarado del instrumento —decidir si hace falta modificar el
patrón alimentario o evaluar suplementación— no, porque la conclusión
nunca se enunciaba.

**Qué devuelve ahora.** Un veredicto en una frase y un bloque por
nutriente con tres piezas: el estado (cubre, al límite, no cubre,
indeterminado), la conducta que corresponde, y el motivo de la
derivación cuando la hay. Y lo hace **también cuando la respuesta es que
no hace falta hacer nada**: confirmar que alguien sí cubre su
requerimiento es un resultado, no la ausencia de una alerta.

**La asimetría entre los dos nutrientes es deliberada.** El calcio de una
dieta basada en plantas es alcanzable por vía dietética —entre bebidas
vegetales fortificadas, tofu cuajado con sales de calcio, tahini y
verduras de bajo oxalato hay margen—, y suplementarlo tiene riesgos
propios, así que ante una brecha de calcio lo primero es el ajuste del
patrón y la suplementación es la segunda opción. La vitamina D no
funciona así: en una dieta 100 % vegetal sin alimentos fortificados ni
suplemento, alcanzar la ingesta de referencia por vía dietética es
prácticamente imposible, así que ante una brecha la vía realista es la
suplementación y la conducta es derivar.

**El biomarcador manda sobre la estimación.** Si hay una
25-hidroxivitamina D sérica declarada, ese valor tiene precedencia sobre
lo que estime el cuestionario, y en las dos direcciones: un valor
suficiente con ingesta estimada baja concluye que cubre, y un valor
deficiente con ingesta estimada alta concluye que no. Una herramienta que
mantuviera su propia conclusión frente a un biomarcador que la contradice
no sería defendible. La salida declara sobre qué se decidió.

**Lo que no hace.** No indica dosis, y no debe. Recomendar una cantidad
concreta exigiría haber demostrado en un ensayo clínico que esa dosis
alcanza la concentración objetivo en esta población, y eso no es lo que
valida un cuestionario de frecuencia. El reparto es: la herramienta
cuantifica la brecha, el nutricionista o el médico establecen la dosis.
El descargo acompaña a la salida siempre, cubra o no cubra, y la suite lo
comprueba.

**Caso que conviene conocer.** Cuando la ingesta de vitamina D queda por
debajo de la referencia pero la síntesis cutánea estimada es apreciable,
la herramienta **no concluye**: declara el estado indeterminado y pide la
25-hidroxivitamina D sérica. La razón es que la ingesta de referencia se
derivó suponiendo exposición solar mínima, así que la suma de ambas vías
no admite comparación directa con ella.

Los tres cortes de decisión están declarados como heurísticos en el
registro de parámetros, porque son los que deciden qué se le dice al
participante y nadie los ha validado todavía.

### B1c. Distribución, recomendaciones y dos pestañas nuevas

**Distribución de las fuentes.** La tercera métrica de calcio dejó de
llamarse «días cumplidos». La semana virtual no es un registro de los días
del participante: es una reconstrucción que reparte las frecuencias
declaradas, así que «cumplidos» prometía una medición que no existe. Ahora
se enuncia como *días por semana en que el patrón declarado alcanzaría la
meta*, y se acompaña de un veredicto de distribución —adecuada, ajustable
o concentrada— con la concentración en la comida de mayor aporte y el
margen recuperable por redistribución.

El encuadre es educativo, que es para lo que se pidió. Por la curva de
saturación de Heaney, la misma cantidad de calcio repartida en más comidas
rinde más absorbido: en la comprobación de la suite, 300 mg de calcio
declarados en dos tomas diarias rinden sustancialmente más calcio
absorbido que los mismos 300 mg en una sola. **El participante puede
mejorar sin cambiar lo que come ni gastar más**, y esa es una recomendación
que la herramienta antes no sabía dar.

**Recomendaciones.** Una tarjeta nueva, después de los tres riesgos y
antes de la semana virtual, con tres salidas: a qué profesional acudir, si
conviene solicitar 25-hidroxivitamina D sérica, y si corresponde
densitometría.

La derivación distingue el patrón alimentario. Cuando el participante sigue
un patrón flexitariano, vegetariano o vegano, dirige a un **nutricionista
con formación y experiencia en nutrición basada en plantas**, por razón de
competencia: la biodisponibilidad del calcio vegetal, la fortificación
variable de las bebidas vegetales y el manejo de la vitamina D sin fuentes
animales requieren conocimiento específico. Se redacta como competencia y
no como credencial, porque no existe un registro formal de esa
especialidad que la herramienta pueda invocar.

**La densitometría NO se recomienda por patrón dietético, y la omisión es
deliberada.** Los criterios de edad y sexo son de guía publicada —mujeres
de 65 años o más, varones de 70 o más, y entre 50 y 69 con factores de
riesgo— más el riesgo calculado y el antecedente de fractura por
fragilidad, que es un dato nuevo que la herramienta ahora pregunta. No hay
regla «vegano → densitometría» porque en EPIC-Oxford el exceso de riesgo
de fractura en veganos se atenuaba cuando la ingesta de calcio y proteína
era adecuada: lo que determina el riesgo es no cubrir el requerimiento, no
la etiqueta dietética. El patrón entra por donde debe, a través de la
estimación de ingesta. Recomendar densitometría por ser vegano
estigmatizaría el patrón y afirmaría lo que el estudio de validación está
diseñado para averiguar. La salida declara esa omisión en pantalla, porque
un revisor va a preguntar por ella.

La suite lo fija con una prueba explícita: una participante vegana de 28
años con los requerimientos cubiertos **no** recibe recomendación de
densitometría, ni de laboratorio, ni derivación.

**Pestaña de Laboratorio.** La interpretación bioquímica salió de la
pantalla de tamizaje y tiene pestaña propia: analito por analito con su
rango y su significado, los seis patrones que tienen sentido propio
—incluido el hiperparatiroidismo primario, que es el que NO debe
confundirse con el secundario porque la conducta es opuesta— y las tres
fórmulas que la herramienta aplica.

**Pestaña de Bibliografía.** 53 fuentes que respaldan los 55 parámetros del
modelo, con su grado de evidencia. **No está escrita a mano: se genera
desde el registro de parámetros**, de modo que no puede quedar
desincronizada con el código. Si se añade un parámetro con su fuente, la
referencia aparece sola.

**Porciones.** Carne, pollo y pescado pasan a 3 onzas (85 g), que es la
medida de uso en Panamá, con los valores reescalados. El cereal fortificado
pasa a 1 taza y queda marcado por omisión como valor genérico a verificar
con etiqueta: es el dato menos fiable del catálogo, porque una taza no es
una masa fija y la fortificación varía mucho entre marcas.

**Cómo funciona la herramienta.** Sección nueva al final del recorrido, con
los seis pasos del motor en lenguaje llano y lo que el motor no hace. Los
bloques de metodología y bibliografía que vivían ahí se disolvieron al
darles pestaña propia.

### B2. Módulo de exactitud diagnóstica y psicometría (`js/validation.js`)

El objetivo declarado del estudio es calibrar los umbrales del riesgo
óseo contra densitometría. La v3.1 no calculaba ningún estadístico: el
investigador exportaba el CSV y hacía todo fuera, de modo que la
herramienta no podía demostrar su propio desempeño ni el corte publicado
se derivaba con ella.

Todo corre en el navegador, sin enviar datos a ningún servidor, y de
forma determinista: el remuestreo usa un generador con semilla fija, así
que dos ejecuciones sobre los mismos datos dan exactamente el mismo
intervalo de confianza. Un intervalo que cambia cada vez que se pulsa el
botón no es reportable.

Contenido: curva ROC con el área calculada por dos vías independientes
—regla trapezoidal y estadístico U— cuya coincidencia se expone como
comprobación interna, dirigida al fallo clásico de manejo de empates con
puntuaciones enteras; intervalos de confianza por Hanley-McNeil y por
remuestreo, que parten de supuestos distintos; comparación pareada de
dos áreas sobre los mismos participantes, remuestreando individuos y no
predictores; búsqueda de corte por índice de Youden, por distancia al
vértice y por sensibilidad mínima exigida, con la tabla completa de
umbrales para que el corte publicado no parezca elegido a posteriori;
sensibilidad, especificidad, valores predictivos, razones de
verosimilitud y razón de momios diagnóstica con intervalos de Wilson;
kappa de Cohen simple y ponderada; coeficiente de correlación
intraclase para test-retest, devolviendo a la vez acuerdo absoluto y
consistencia para que el sesgo sistemático quede visible; alfa de
Cronbach crudo y estandarizado con correlación ítem-total corregida;
concordancia de Bland-Altman con prueba de sesgo proporcional;
calibración por grupos con comprobación de monotonía; y contrastes no
paramétricos con corrección por empates.

Cada estadístico se contrasta en `tests/estadistica.js` contra un valor
publicado o una identidad algebraica conocida, nunca contra su propia
implementación.

### B3. Diccionario de datos (`js/codebook.js`)

La v3.1 exportaba unas sesenta columnas con nombres en castellano sin
acentos y sin definición, unidad ni codificación. Quien importara ese
CSV en SPSS o en R tenía que inferir qué era `razonAdecuacionNeta`.

Ahora se documentan **136 campos** —124 de la herramienta y 12 columnas
del patrón de oro— con etiqueta, tipo, unidad, rango válido, codificación
de los valores categóricos y origen del dato (capturado por el
evaluador, calculado por el motor, del patrón de oro o de trazabilidad).
Se exporta en CSV plano para material suplementario y en el formato de
importación de diccionarios de REDCap. Se añade conversión a formato
largo —una fila por participante y variable— y una comprobación de
cobertura que la prueba de humo ejecuta en cada cambio, para que el
diccionario no se quede obsoleto en la primera versión que añada una
columna.

Las doce columnas del patrón de oro se exportan **vacías** a propósito:
el investigador pega ahí los valores de densitometría y vuelve a
importar el archivo en la pestaña de Validación. Sin ellas, cada
análisis obligaba a cruzar dos archivos a mano, que es donde se cometen
los errores de emparejado.

### B4. Índices validados de cribado óseo

El puntaje óseo compuesto de la herramienta es una construcción propia,
algo que el README ya reconocía. El problema para el estudio no era que
fuera heurístico, sino que no había nada validado al lado con lo que
compararlo.

Se añaden el **OST** (Koh et al. 2001) y el **ORAI** (Cadarette et al.
2000): publicados, de dominio público y calculables sin licencia, a
diferencia de FRAX, cuya exclusión sigue siendo correcta. El ORAI **no**
se calcula en varones ni por debajo de los 45 años, porque no se derivó
en esas poblaciones: calcular un índice fuera de su población de
derivación es peor que no calcularlo.

### B5. Registro de parámetros con grado de evidencia

Cada constante del modelo —**55 parámetros**— declara valor, unidad,
fuente bibliográfica y grado de evidencia en una escala explícita:
`medido` (17), `consenso` (14), `derivado` (7), `estimado` (7) y
`heuristico` (10). Es la pieza que permite auditar la afirmación de estar
basado en evidencia sin que sea una frase de propaganda.

Los diez parámetros heurísticos son la lista de trabajo del estudio de
validación, y la herramienta los enumera sola en la pestaña de
Metodología: no hay que buscarlos en el código.

| Parámetro | Valor | Qué debe calibrarlo |
|---|---|---|
| `CONDUCTA_CALCIO_CUBRE` | 100 % de la meta | Método dietético de referencia |
| `CONDUCTA_CALCIO_LIMITE` | 75 % de la meta | Método dietético de referencia |
| `CONDUCTA_CALCIO_DIETA_VIABLE` | 50 % de la meta | Método dietético de referencia |
| `DXA_FRACCION_RIESGO` | 0.40 del puntaje máximo | T-score de densitometría |
| `VITD_LAB_FRACCION_INGESTA` | 0.70 de la referencia | 25-hidroxivitamina D sérica |
| `VITD_LAB_FRACCION_RIESGO_OSEO` | 0.40 del puntaje máximo | T-score de densitometría |
| `UMBRAL_SOLAR_MODERADO_FRACCION_RDA` | 0.40 | 25-hidroxivitamina D sérica |
| `RIESGO_OSEO_CORTE_MODERADO` | 3 puntos | T-score de densitometría |
| `RIESGO_OSEO_CORTE_ALTO` | 5 puntos | T-score de densitometría |
| `PLAUSIBILIDAD_PROTEINA_FRACCION_MINIMA` | 0.50 | Contraste con registro de 24 h |

Los tres primeros son nuevos y son los más consecuentes de todo el
registro: deciden qué se le dice al participante —mantener el patrón,
ajustarlo, o consultar para evaluar suplementación—. Están declarados
como heurísticos precisamente porque nadie los ha validado todavía.

---

## C. Robustez e interfaz

### C1. La pantalla gris, sustituida por un mensaje útil

El README de la v3.1 documentaba la pantalla gris como síntoma conocido,
con instrucciones para abrir la consola del navegador. Para una
herramienta que se usa delante del participante en una entrevista, la
diferencia entre «pantalla gris» y «no cargó js/i18n/pt.js» es la
diferencia entre perder la sesión y seguir trabajando.

Se añaden dos redes distintas: un límite de error de React que captura
los fallos **durante** el render y muestra el archivo y la línea, y un
bloque en `index.html` que captura los que ocurren **antes** de que
React monte —incluido un archivo de `js/` que no llega al navegador— más
una comprobación a los 8 segundos que informa de qué biblioteca no
cargó.

### C2. Autoguardado

Todo el estado vivía en memoria: el registro acumulado, pensado para 180
participantes, desaparecía con un F5. Ahora se persiste en el
almacenamiento local del navegador, que no sale del dispositivo y por
tanto no cambia el modelo de privacidad.

Se persiste lo **capturado**, no lo calculado: los resultados se
recalculan al cargar, así que una fila vieja nunca arrastra números de
otra versión. Y el registro acumulado se restaura solo si la huella de
parámetros coincide; si cambió, se conservan los datos del formulario,
se descartan las filas ya calculadas y se avisa en pantalla.

### C3. Las reubicaciones manuales se validan

`ejecutarSemanaVirtualCalcio` indexaba la semana virtual con los valores
que vinieran en los overrides, sin comprobar rango. Un valor fuera de
0–6 / 0–2 —posible al restaurar estado guardado por otra versión—
lanzaba `TypeError` y dejaba la pantalla en gris. Ahora una reubicación
inválida se descarta y el ítem vuelve a su posición automática.

### C4. Pestañas

Con el panel bioquímico, la validación y el registro de parámetros, una
sola pantalla deja de caber. Se separa en Tamizaje, Validación y
Metodología, para que el evaluador no tenga que desplazarse por
metodología para llegar al cuestionario.

### C5. Recorrido vertical: cuestionarios arriba, resultados al final

**Antes.** Rejilla de dos columnas: entradas a la izquierda, resultados a
la derecha, ambas desplazándose a la vez.

**Problema.** En una entrevista real eso obliga a saltar la vista de un
lado al otro mientras se pregunta, y ninguna de las dos columnas se lee
cómoda: la de entradas queda estrecha y la de resultados, descolgada de
la pregunta que la produjo.

**Ahora.** Una sola columna de ancho contenido, con el recorrido que
sigue la entrevista: **(1)** participante, **(2)** cuestionario de
frecuencia de consumo, **(3)** suplementación, **(4)** exposición solar y
geografía, **(5)** actividad física y función, **(6)** laboratorio, y al
final **todos los resultados juntos**, bajo una divisoria, con un enlace
de vuelta al cuestionario.

Cada paso lleva su número, su icono y una línea que explica qué alimenta
del motor, de modo que el evaluador sepa por qué está preguntando algo.

Como los resultados dejan de estar a la vista mientras se escribe, se
añade una **franja de resumen** que se queda pegada bajo el encabezado
con las cuatro cifras clave —calcio absorbido, vitamina D, riesgo óseo y
SARC-F—, la marca de dato a revisar cuando la hay, y un botón que baja al
detalle. Aparece solo cuando ya hay algo que resumir.

### C6. La tarjeta de «métricas de la v6.0», disuelta

Las métricas nuevas se presentaban juntas en una tarjeta aparte titulada
como novedades de la versión. Eso convertía en dos herramientas lo que es
una: el evaluador tenía que leer el riesgo óseo en un sitio y su desglose
en otro. Cada bloque está ahora donde le corresponde:

| Bloque | Dónde vive ahora |
|---|---|
| Entrada total de vitamina D y meta ajustada por tamaño corporal | tarjeta de vitamina D |
| Proteína utilizable, DIAAS medio, umbral de leucina | tarjeta nueva *Proteína y masa muscular*, junto al SARC-CalF |
| Desglose conductual/bioquímico del riesgo óseo, OST y ORAI | tarjeta nueva *Salud ósea* |
| Plausibilidad del cuestionario | franja de calidad del dato, **al principio** de los resultados |

La plausibilidad se movió al principio a propósito: si el cuestionario
está incompleto, todo lo que viene después hereda ese problema, y el
evaluador tiene que verlo antes de leer cualquier cifra.

### C7. Retirados los avisos sobre la forma D2 de la vitamina D

La herramienta mostraba un aviso del tipo «el N % del aporte de vitamina D
proviene de fuentes con D2 (ergocalciferol)» cuando la proporción
estimada de D2 superaba el 50 %, y otro al elegir un suplemento de D2.

El primero no es sostenible: la forma química de la vitamina D de un
alimento fortificado rara vez figura en la etiqueta, y el catálogo la
asigna por grupo de alimento, así que afirmar un porcentaje concreto es
una conclusión que el dato no soporta. Los dos avisos se retiran.

La corrección de potencia D2/D3 **se sigue aplicando al cálculo** cuando
el evaluador declara la forma del suplemento, que sí figura en su
etiqueta, y el resultado separa el total sin corregir del equivalente de
potencia D3.

### C8. Traducciones

Se añaden **293 claves nuevas** en los tres idiomas (de 481 a 774). La prueba de humo
comprueba ahora la cobertura de los tres, no solo del de referencia: una
clave presente solo en español dejaba el inglés y el portugués mostrando
texto castellano sin avisar, porque el traductor recurre al idioma de
referencia en silencio.

Las redacciones de los instrumentos validados (los ítems del SARC-F y
equivalentes) **no** se han retraducido: una traducción no validada
lingüísticamente de un instrumento no es usable como instrumento en una
publicación.

---

## D. Lo que no cambió, a propósito

- **La normalización de la absorción fraccional por la carga de
  medición.** Es la mejor idea del motor y sigue intacta.
- **La decisión de no calcular FRAX.**
- **Las unidades caseras en vez de gramos** en el cuestionario.
- **Los dos cortes de SARC-F reportados por separado.** La asimetría
  sensibilidad/especificidad del instrumento es real y ocultarla sería
  peor.
- **Los dos marcos de 25-hidroxivitamina D con señalización de la zona
  de desacuerdo.**
- **Los pesos conductuales del riesgo óseo.** No se tocaron, para que
  las filas ya recogidas sigan siendo comparables en ese componente.

## E. Limitación operativa que sigue abierta

La interfaz depende de cuatro bibliotecas externas que se cargan desde
tres dominios en cada arranque, y el JSX se compila en el navegador cada
vez. Sin conexión —o con el centro de salud tras un cortafuegos— la
herramienta no abre. No se resuelve en esta versión porque vendorizar
esas bibliotecas añade cerca de un megabyte al repositorio y cambia el
modelo de publicación, pero es la limitación de mayor riesgo para el
trabajo de campo y ahora al menos falla con un mensaje que lo dice.
