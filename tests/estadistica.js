#!/usr/bin/env node
/* ============================================================
 * CalD Risk Screen — Validación del módulo estadístico
 * ============================================================
 *
 * PARA QUÉ SIRVE ESTO
 *
 * El módulo de validación es el que va a producir las cifras de la
 * publicación: el área bajo la curva, el corte óptimo, la sensibilidad
 * y sus intervalos. Si ese código tiene un error, el error entra en el
 * manuscrito. Por eso cada estadístico se contrasta aquí contra un
 * VALOR EXTERNO —publicado en la literatura o derivado analíticamente a
 * mano— y nunca contra su propia implementación, que es la forma de
 * prueba que no demuestra nada.
 *
 * Donde no existe un valor publicado con el que comparar, se contrasta
 * contra una IDENTIDAD ALGEBRAICA conocida (por ejemplo, la fórmula de
 * Spearman-Brown para el alfa de dos ítems, o la coincidencia obligada
 * entre el área calculada por la regla trapezoidal y por el estadístico
 * U). Cada prueba declara cuál de los dos casos es.
 *
 *     node tests/estadistica.js
 *
 * Devuelve 0 si todo pasa, 1 si algo falla.
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const raizJs = path.join(__dirname, '..', 'js');
const fuente = ['data.js', 'algorithm.js', 'validation.js']
    .map(f => fs.readFileSync(path.join(raizJs, f), 'utf8'))
    .join('\n');

const contexto = {};
(new Function(fuente + '\n; Object.assign(this, {' + [
    'normalCDF', 'chiCuadradoP', 'intervaloWilson', 'descriptivos',
    'metricasDiagnosticas', 'matrizDesdeCorte', 'curvaROC', 'bootstrapAUC',
    'compararAUCPareado', 'buscarCorteOptimo', 'kappaCohen', 'iccDosVias',
    'alfaCronbach', 'pearson', 'spearman', 'blandAltman',
    'calibracionPorGrupos', 'mannWhitney', 'kruskalWallis',
    'chiCuadradoIndependencia', 'informeValidacion', 'generadorConSemilla'
].join(',') + '});')).call(contexto);

const {
    normalCDF, chiCuadradoP, intervaloWilson, descriptivos,
    metricasDiagnosticas, matrizDesdeCorte, curvaROC, bootstrapAUC,
    compararAUCPareado, buscarCorteOptimo, kappaCohen, iccDosVias,
    alfaCronbach, pearson, spearman, blandAltman,
    calibracionPorGrupos, mannWhitney, kruskalWallis,
    chiCuadradoIndependencia, informeValidacion
} = contexto;

// ------------------------------------------------------------
// Utilidades de aserción
// ------------------------------------------------------------
let pasadas = 0, fallidas = 0;
const resultados = [];

function verificar(descripcion, obtenido, esperado, tolerancia = 0.001, fuenteRef = '') {
    const ok = Number.isFinite(obtenido) && Math.abs(obtenido - esperado) <= tolerancia;
    ok ? pasadas++ : fallidas++;
    resultados.push({ ok, descripcion, obtenido, esperado, fuente: fuenteRef });
}

function verificarIgual(descripcion, obtenido, esperado, fuenteRef = '') {
    const ok = obtenido === esperado;
    ok ? pasadas++ : fallidas++;
    resultados.push({ ok, descripcion, obtenido, esperado, fuente: fuenteRef });
}

function verificarCierto(descripcion, condicion, fuenteRef = '') {
    condicion ? pasadas++ : fallidas++;
    resultados.push({ ok: !!condicion, descripcion, obtenido: !!condicion, esperado: true, fuente: fuenteRef });
}

function bloque(titulo) { resultados.push({ separador: true, titulo }); }


// ============================================================
// 1. FUNCIONES DE DISTRIBUCIÓN
// ============================================================
bloque('1. Funciones de distribución');

verificar('Normal acumulada en z = 1.96', normalCDF(1.959963985), 0.975, 1e-5,
    'Valor de tabla: el cuantil 0.975 de la normal estándar es 1.95996');
verificar('Normal acumulada en z = 0', normalCDF(0), 0.5, 1e-9,
    'Simetría de la distribución normal');
verificar('Normal acumulada en z = −1', normalCDF(-1), 0.1586553, 1e-5,
    'Valor de tabla de la normal estándar');
verificar('Normal acumulada en z = 2.5758', normalCDF(2.5758293), 0.995, 1e-5,
    'Valor de tabla: cuantil 0.995 de la normal estándar');

verificar('Cola de chi cuadrado: χ²=3.8415, gl=1 → p=0.05', chiCuadradoP(3.841459, 1), 0.05, 1e-5,
    'Valor crítico de tabla al 5% con 1 grado de libertad');
verificar('Cola de chi cuadrado: χ²=5.9915, gl=2 → p=0.05', chiCuadradoP(5.991465, 2), 0.05, 1e-5,
    'Valor crítico de tabla al 5% con 2 grados de libertad');
verificar('Cola de chi cuadrado: χ²=11.0705, gl=5 → p=0.05', chiCuadradoP(11.070498, 5), 0.05, 1e-5,
    'Valor crítico de tabla al 5% con 5 grados de libertad');


// ============================================================
// 2. INTERVALO DE WILSON
// ============================================================
bloque('2. Intervalo de confianza de una proporción (Wilson)');

const w5de10 = intervaloWilson(5, 10);
verificar('Wilson 95% para 5/10: límite inferior', w5de10.inferior, 0.2366, 0.0005,
    'Wilson EB, J Am Stat Assoc 1927;22:209 — valor publicado del ejemplo p=0.5, n=10');
verificar('Wilson 95% para 5/10: límite superior', w5de10.superior, 0.7634, 0.0005,
    'Wilson 1927; el intervalo es simétrico alrededor de 0.5 en este caso');

const w9de10 = intervaloWilson(9, 10);
verificar('Wilson 95% para 9/10: límite inferior', w9de10.inferior, 0.5958, 0.0005,
    'Wilson 1927 — caso asimétrico cerca del borde, donde Wald falla');
verificar('Wilson 95% para 9/10: límite superior', w9de10.superior, 0.9821, 0.0005,
    'Wilson 1927');

const w0de20 = intervaloWilson(0, 20);
verificarIgual('Wilson con 0 éxitos no baja de cero', w0de20.inferior, 0,
    'A diferencia de Wald, Wilson nunca devuelve límites imposibles');
verificar('Wilson 95% para 0/20: límite superior', w0de20.superior, 0.1611, 0.0005,
    'Wilson 1927 — el caso donde Wald daría un intervalo de anchura cero');

verificarCierto('Wilson nunca produce límites fuera de [0,1]',
    [[0, 5], [5, 5], [1, 3], [17, 17], [0, 1]].every(([x, n]) => {
        const r = intervaloWilson(x, n);
        return r.inferior >= 0 && r.superior <= 1 && r.inferior <= r.superior;
    }),
    'Propiedad que motiva el uso de Wilson en lugar de la aproximación normal');


// ============================================================
// 3. ÁREA BAJO LA CURVA ROC
// ============================================================
bloque('3. Curva ROC y área bajo la curva');

const rocPerfecta = curvaROC([1, 2, 3, 4], [0, 0, 1, 1]);
verificar('Separación perfecta da área = 1', rocPerfecta.auc, 1.0, 1e-9,
    'Definición: el área es la probabilidad de ordenar correctamente un par caso-control');

const rocAlterna = curvaROC([1, 2, 3, 4], [0, 1, 0, 1]);
verificar('Área calculada a mano para [1,2,3,4] con desenlace [0,1,0,1]', rocAlterna.auc, 0.75, 1e-9,
    'U = suma de rangos de los casos (2+4) − nP(nP+1)/2 = 6−3 = 3; área = 3/(2×2) = 0.75');

const rocEmpates = curvaROC([1, 1, 2, 2], [0, 1, 0, 1]);
verificar('Empates completos dan área = 0.5', rocEmpates.auc, 0.5, 1e-9,
    'Los empates cuentan como medio acierto: es la definición no paramétrica del área');

const rocInvertida = curvaROC([1, 2, 3, 4], [1, 1, 0, 0]);
verificar('Predictor invertido da área = 0', rocInvertida.auc, 0.0, 1e-9,
    'Comprobación del sentido del predictor');
verificar('Con mayorEsPositivo=false el mismo predictor da área = 1',
    curvaROC([1, 2, 3, 4], [1, 1, 0, 0], { mayorEsPositivo: false }).auc, 1.0, 1e-9,
    'El T-score de densitometría y la 25(OH)D van en sentido inverso al riesgo');

// Identidad algebraica obligada: las dos vías de cálculo deben coincidir
const muestraMixta = [3, 7, 2, 9, 4, 4, 8, 1, 6, 5, 7, 2];
const desenlaceMixto = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1];
const rocMixta = curvaROC(muestraMixta, desenlaceMixto);
verificar('Regla trapezoidal y estadístico U coinciden (con empates)',
    rocMixta.discrepanciaVias, 0, 1e-9,
    'IDENTIDAD: el área trapezoidal de la curva empírica es igual al U normalizado. Si difieren, hay un error de manejo de empates');

verificarCierto('Se rechaza el cálculo cuando falta una de las dos clases',
    curvaROC([1, 2, 3], [1, 1, 1]).valido === false,
    'Sin controles no existe el área bajo la curva; devolver un número sería inventarlo');

verificarIgual('Los pares con dato faltante se descartan y se cuentan',
    curvaROC([1, 2, '', 4, null], [0, 1, 1, 1, 0]).descartados, 2,
    'Un análisis que pierde participantes por datos faltantes tiene que declarar cuántos');

// El error estándar debe decrecer al aumentar el tamaño, a igualdad de
// área. Se usa separación IMPERFECTA a propósito: con área exactamente 1
// la varianza de Hanley-McNeil es cero por construcción y la comparación
// no diría nada.
const rocChica = curvaROC([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1]);
const grande = { v: [], d: [] };
for (let i = 0; i < 10; i++) grande.v.push(...[1, 2, 3, 4, 5, 6]), grande.d.push(...[0, 0, 1, 0, 1, 1]);
const rocGrande = curvaROC(grande.v, grande.d);
verificar('Al replicar la muestra diez veces el área no cambia',
    rocGrande.auc, rocChica.auc, 1e-9,
    'El área es una propiedad de la distribución, no del tamaño muestral');
verificarCierto('El error estándar del área decrece al crecer la muestra',
    rocGrande.errorEstandar < rocChica.errorEstandar,
    'Hanley JA, McNeil BJ. Radiology 1982;143:29 — la varianza es inversa a nP·nN');


// ============================================================
// 4. REMUESTREO REPRODUCIBLE
// ============================================================
bloque('4. Remuestreo con semilla fija');

const boot1 = bootstrapAUC(muestraMixta, desenlaceMixto, { iteraciones: 500, semilla: 12345 });
const boot2 = bootstrapAUC(muestraMixta, desenlaceMixto, { iteraciones: 500, semilla: 12345 });
verificarIgual('Dos ejecuciones con la misma semilla dan el mismo intervalo',
    JSON.stringify(boot1.ic95), JSON.stringify(boot2.ic95),
    'Un intervalo por remuestreo que cambia en cada ejecución no es reportable en una publicación');

const boot3 = bootstrapAUC(muestraMixta, desenlaceMixto, { iteraciones: 500, semilla: 99999 });
verificarCierto('Semillas distintas dan intervalos distintos (el remuestreo es real)',
    JSON.stringify(boot1.ic95) !== JSON.stringify(boot3.ic95),
    'Comprobación de que la semilla no está desactivando el remuestreo');

verificarCierto('El intervalo por remuestreo contiene al área puntual',
    boot1.ic95.inferior <= rocMixta.auc && rocMixta.auc <= boot1.ic95.superior,
    'Propiedad esperada del intervalo por percentiles');


// ============================================================
// 5. EXACTITUD DIAGNÓSTICA
// ============================================================
bloque('5. Exactitud diagnóstica');

// Ejemplo del instrumento ORAI en su cohorte de derivación:
// sensibilidad 93.3% y especificidad 46.4% (Cadarette et al., CMAJ 2000).
// Se reconstruye una matriz con esas proporciones.
const mORAI = metricasDiagnosticas({ vp: 140, fn: 10, fp: 268, vn: 232 });
verificar('Sensibilidad reconstruida del ejemplo de ORAI', mORAI.sensibilidad.estimacion, 0.9333, 0.0005,
    'Cadarette SM et al. CMAJ 2000;162:1289 — sensibilidad publicada 93.3%');
verificar('Especificidad reconstruida del ejemplo de ORAI', mORAI.especificidad.estimacion, 0.464, 0.0005,
    'Cadarette et al. 2000 — especificidad publicada 46.4%');

const m2 = metricasDiagnosticas({ vp: 45, fn: 5, fp: 20, vn: 80 });
verificar('Sensibilidad 45/50', m2.sensibilidad.estimacion, 0.9, 1e-9, 'Cálculo directo');
verificar('Especificidad 80/100', m2.especificidad.estimacion, 0.8, 1e-9, 'Cálculo directo');
verificar('Valor predictivo positivo 45/65', m2.valorPredictivoPositivo.estimacion, 0.6923, 0.0005, 'Cálculo directo');
verificar('Razón de verosimilitud positiva = sens/(1−espec) = 0.9/0.2', m2.razonVerosimilitudPositiva, 4.5, 0.001,
    'Definición; es independiente de la prevalencia, a diferencia de los valores predictivos');
verificar('Razón de verosimilitud negativa = (1−sens)/espec = 0.1/0.8', m2.razonVerosimilitudNegativa, 0.125, 0.001,
    'Definición');
verificar('Índice de Youden = sens + espec − 1', m2.indiceYouden, 0.7, 1e-9,
    'Youden WJ. Cancer 1950;3:32');
verificar('Razón de momios diagnóstica = (45×80)/(20×5)', m2.razonMomiosDiagnostica, 36, 0.001,
    'Definición');
verificar('La prevalencia de la muestra se reporta junto a los valores predictivos',
    m2.prevalencia, 0.3333, 0.0005,
    'Los valores predictivos solo son trasladables a poblaciones de prevalencia parecida');

// Matriz a partir de un corte
const mCorte = matrizDesdeCorte([1, 2, 3, 4, 5], [0, 0, 1, 1, 1], 3, true);
verificarIgual('Matriz desde corte ≥3: verdaderos positivos', mCorte.vp, 3, 'Cálculo directo');
verificarIgual('Matriz desde corte ≥3: verdaderos negativos', mCorte.vn, 2, 'Cálculo directo');
verificarIgual('Matriz desde corte ≥3: sin falsos', mCorte.fp + mCorte.fn, 0, 'Cálculo directo');


// ============================================================
// 6. CORTE ÓPTIMO
// ============================================================
bloque('6. Búsqueda del corte óptimo');

const cortes = buscarCorteOptimo([1, 2, 3, 4, 5, 6], [0, 0, 0, 1, 1, 1]);
verificarIgual('El corte de Youden se sitúa donde la separación es perfecta',
    cortes.porYouden.corte, 4,
    'Con separación perfecta el corte óptimo es el valor mínimo de los casos');
verificar('El índice de Youden en ese corte vale 1', cortes.porYouden.youden, 1.0, 1e-9,
    'Sensibilidad 1 y especificidad 1');
verificarIgual('La tabla recorre todos los umbrales observados',
    cortes.tabla.length, 6,
    'El corte publicado tiene que poder justificarse frente a los demás');
verificarCierto('El criterio de sensibilidad mínima devuelve un corte distinto cuando procede',
    buscarCorteOptimo([1, 2, 3, 4, 5, 6], [0, 1, 0, 1, 1, 1], { sensibilidadMinima: 1.0 })
        .porSensibilidadMinima.sensibilidad === 1,
    'En un tamizaje, perder un caso cuesta más que una prueba de más');


// ============================================================
// 7. KAPPA DE COHEN
// ============================================================
bloque('7. Concordancia entre categorías (kappa)');

// Tabla 2×2 con a=20, b=5, c=10, d=15:
//   acuerdo observado = 35/50 = 0.70
//   acuerdo esperado  = (25×30 + 25×20)/50² = 0.50
//   kappa = (0.70 − 0.50)/(1 − 0.50) = 0.40
const catA = [], catB = [];
for (let i = 0; i < 20; i++) { catA.push('si'); catB.push('si'); }
for (let i = 0; i < 5; i++) { catA.push('si'); catB.push('no'); }
for (let i = 0; i < 10; i++) { catA.push('no'); catB.push('si'); }
for (let i = 0; i < 15; i++) { catA.push('no'); catB.push('no'); }
const k2x2 = kappaCohen(catA, catB);
verificar('Kappa calculado a mano para la tabla 20/5/10/15', k2x2.kappa, 0.40, 1e-9,
    'Cohen J. Educ Psychol Meas 1960;20:37 — po=0.70, pe=0.50, kappa=0.40');
verificar('Acuerdo observado de esa tabla', k2x2.acuerdoObservado, 0.70, 1e-9, 'Cohen 1960');
verificar('Acuerdo esperado por azar de esa tabla', k2x2.acuerdoEsperado, 0.50, 1e-9, 'Cohen 1960');
verificarIgual('La etiqueta de Landis y Koch se declara como convención de lectura',
    k2x2.etiquetaLandisKoch, 'aceptable',
    'Landis JR, Koch GG. Biometrics 1977;33:159 — 0.21-0.40 es "fair"');

verificar('Acuerdo perfecto da kappa = 1',
    kappaCohen(['a', 'b', 'c', 'a', 'b'], ['a', 'b', 'c', 'a', 'b']).kappa, 1.0, 1e-9,
    'Definición');

// El kappa ponderado debe ser MAYOR que el simple en una escala ordinal
// donde los desacuerdos son de un solo grado.
const ordA = ['bajo', 'bajo', 'moderado', 'moderado', 'alto', 'alto', 'moderado', 'bajo'];
const ordB = ['bajo', 'moderado', 'moderado', 'alto', 'alto', 'moderado', 'moderado', 'bajo'];
const orden = ['bajo', 'moderado', 'alto'];
const kSimple = kappaCohen(ordA, ordB, { ordenCategorias: orden });
const kLineal = kappaCohen(ordA, ordB, { ponderacion: 'lineal', ordenCategorias: orden });
verificarCierto('El kappa ponderado supera al simple cuando los desacuerdos son de un grado',
    kLineal.kappa > kSimple.kappa,
    'Cohen J. Psychol Bull 1968;70:213 — el kappa simple trata igual confundir bajo con alto que bajo con moderado');
verificarCierto('El kappa cuadrático penaliza aún menos el desacuerdo de un grado',
    kappaCohen(ordA, ordB, { ponderacion: 'cuadratica', ordenCategorias: orden }).kappa > kLineal.kappa,
    'La ponderación cuadrática concentra el peso en los desacuerdos extremos');


// ============================================================
// 8. COEFICIENTE DE CORRELACIÓN INTRACLASE
// ============================================================
bloque('8. Fiabilidad test-retest (ICC)');

verificar('Mediciones idénticas dan ICC = 1',
    iccDosVias([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]).iccAcuerdoAbsoluto, 1.0, 1e-9,
    'Definición');

// Desplazamiento sistemático de +1 sobre [1..5]:
//   MS_sujetos = 5, MS_ocasiones = 2.5, MS_error = 0, n = 5, k = 2
//   ICC(2,1) acuerdo absoluto = 5 / (5 + 0 + 2×2.5/5) = 5/6 = 0.8333
//   ICC(3,1) consistencia     = 5 / 5 = 1
const iccSesgo = iccDosVias([1, 2, 3, 4, 5], [2, 3, 4, 5, 6]);
verificar('Sesgo sistemático de +1: ICC de acuerdo absoluto calculado a mano',
    iccSesgo.iccAcuerdoAbsoluto, 0.8333, 0.0005,
    'Shrout PE, Fleiss JL. Psychol Bull 1979;86:420 — ICC(2,1) = (MSs−MSe)/(MSs+(k−1)MSe+k(MSo−MSe)/n)');
verificar('El mismo caso da ICC de consistencia = 1',
    iccSesgo.iccConsistencia, 1.0, 1e-9,
    'Shrout-Fleiss ICC(3,1): el modelo de consistencia no penaliza el sesgo sistemático');
verificar('El sesgo sistemático entre ocasiones se cuantifica',
    iccSesgo.sesgoSistematico, 1.0, 1e-9,
    'La diferencia entre el modelo absoluto y el de consistencia ES este sesgo');
verificarCierto('Se rechaza el cálculo con menos de tres sujetos',
    iccDosVias([1, 2], [1, 2]).valido === false,
    'El modelo de dos vías necesita grados de libertad para el error');


// ============================================================
// 9. ALFA DE CRONBACH
// ============================================================
bloque('9. Consistencia interna (alfa de Cronbach)');

const itemsIdenticos = [[1, 1], [2, 2], [3, 3], [4, 4], [0, 0]];
verificar('Ítems idénticos dan alfa = 1', alfaCronbach(itemsIdenticos).alfa, 1.0, 1e-9,
    'Definición');

// IDENTIDAD DE SPEARMAN-BROWN: con dos ítems, el alfa ESTANDARIZADO es
// exactamente 2r/(1+r). Se contrasta contra esa fórmula independiente,
// calculada con la correlación de Pearson del propio módulo, que a su vez
// se valida por separado más abajo contra valores calculados a mano.
//
// El alfa crudo NO cumple esa identidad salvo que los dos ítems tengan la
// misma varianza, porque se calcula sobre covarianzas y no sobre
// correlaciones. Distinguir los dos es justamente lo que esta prueba
// comprueba: al escribirla salió a la luz que el módulo solo devolvía el
// crudo, y por eso la v6.0 devuelve los dos.
const dosItems = [[3, 4], [5, 4], [2, 3], [6, 7], [4, 5], [1, 3], [7, 6], [5, 6]];
const resDos = alfaCronbach(dosItems);
const rDos = pearson(dosItems.map(f => f[0]), dosItems.map(f => f[1])).r;
verificar('Alfa estandarizado de dos ítems cumple la identidad de Spearman-Brown 2r/(1+r)',
    resDos.alfaEstandarizado, (2 * rDos) / (1 + rDos), 5e-5,
    'IDENTIDAD: Spearman-Brown; la tolerancia es el redondeo a cuatro decimales del módulo');
verificarCierto('El alfa crudo y el estandarizado difieren cuando las varianzas de los ítems difieren',
    Math.abs(resDos.alfa - resDos.alfaEstandarizado) > 0.001,
    'El crudo se calcula sobre covarianzas; su diferencia con el estandarizado indica que un ítem domina la escala');
// Los dos ítems de abajo son permutaciones del mismo multiconjunto
// {0,1,2,0,1,2}, de modo que tienen exactamente la misma varianza sin
// estar perfectamente correlacionados: es la condición bajo la que el
// alfa crudo y el estandarizado deben coincidir.
const varianzaIgual = [[0, 0], [1, 1], [2, 2], [0, 1], [1, 2], [2, 0]];
const resVarIgual = alfaCronbach(varianzaIgual);
verificar('En ítems de varianza idéntica los dos alfas coinciden',
    resVarIgual.alfa, resVarIgual.alfaEstandarizado, 5e-5,
    'Los dos coeficientes convergen cuando la condición de igual varianza se cumple');

// SARC-F simulado: cinco ítems correlacionados
const sarcSimulado = [
    [0, 0, 0, 0, 0], [1, 1, 0, 1, 0], [2, 2, 1, 2, 1], [0, 1, 0, 0, 0],
    [2, 1, 2, 2, 1], [1, 0, 1, 1, 0], [0, 0, 0, 1, 0], [2, 2, 2, 2, 2],
    [1, 1, 1, 0, 1], [0, 1, 1, 0, 0]
];
const alfaSarc = alfaCronbach(sarcSimulado);
verificarIgual('El alfa del SARC-F se calcula sobre sus cinco ítems', alfaSarc.nItems, 5,
    'Malmstrom & Morley 2013: el SARC-F suma cinco ítems en un único puntaje');
verificarCierto('Se reporta la correlación ítem-total CORREGIDA de cada ítem',
    alfaSarc.porItem.every(it => it.correlacionItemTotalCorregida !== null),
    'Correlacionar el ítem con un total que lo incluye infla artificialmente el valor');
verificarCierto('Se reporta el alfa que resultaría de eliminar cada ítem',
    alfaSarc.porItem.every(it => it.alfaSiSeElimina !== null),
    'Es lo que indica si algún ítem está deteriorando la escala');
verificarCierto('El alfa cae al añadir un ítem de ruido no relacionado',
    alfaCronbach(sarcSimulado.map((f, i) => [...f, [5, 1, 4, 0, 3, 5, 2, 0, 4, 1][i]])).alfa < alfaSarc.alfa,
    'Propiedad esperada de la consistencia interna');


// ============================================================
// 10. CORRELACIONES
// ============================================================
bloque('10. Correlaciones');

verificar('Pearson de una relación lineal exacta', pearson([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]).r, 1.0, 1e-9,
    'Definición');
verificar('Pearson de una relación lineal inversa', pearson([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]).r, -1.0, 1e-9,
    'Definición');

// Caso con valor calculado a mano: x=[1,2,3,4,5], y=[2,1,4,3,5]
//   medias 3 y 3; dx=[−2,−1,0,1,2]; dy=[−1,−2,1,0,2]
//   Σ(dx·dy) = 2+2+0+0+4 = 8;  Σdx² = 10;  Σdy² = 10
//   r = 8/√(10×10) = 0.8
verificar('Pearson calculado a mano para [1,2,3,4,5] y [2,1,4,3,5]',
    pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]).r, 0.8, 1e-9,
    'Σ(dx·dy)=8, √(Σdx²·Σdy²)=√(10×10)=10 → r=0.8');
// Ejemplo con r negativo, también a mano:
//   x=[1,2,3,4], y=[4,2,3,1]: dx=[−1.5,−0.5,0.5,1.5], dy=[1.5,−0.5,0.5,−1.5]
//   Σ(dx·dy) = −2.25+0.25+0.25−2.25 = −4;  Σdx²=Σdy²=5
verificar('Pearson negativo calculado a mano para [1,2,3,4] y [4,2,3,1]',
    pearson([1, 2, 3, 4], [4, 2, 3, 1]).r, -0.8, 1e-9,
    'Σ(dx·dy)=−4, √(5×5)=5 → r=−0.8');

verificar('Spearman de una relación monótona no lineal es exactamente 1',
    spearman([1, 2, 3, 4], [1, 4, 9, 16]).rho, 1.0, 1e-9,
    'La correlación de rangos no exige linealidad, solo monotonía');
verificar('Spearman con empates usa el rango medio',
    spearman([1, 1, 2, 2], [1, 1, 2, 2]).rho, 1.0, 1e-9,
    'Ignorar los empates infla el estadístico; en datos de cuestionario los empates son la norma');


// ============================================================
// 11. BLAND-ALTMAN
// ============================================================
bloque('11. Concordancia entre mediciones continuas (Bland-Altman)');

// x=[10,12,14], y=[9,10,13] → diferencias [1,2,1]
//   sesgo = 4/3 = 1.3333; desvío muestral = 0.57735
//   límites = 1.3333 ± 1.96×0.57735 = [0.2017, 2.4650]
const ba = blandAltman([10, 12, 14], [9, 10, 13]);
verificar('Sesgo medio calculado a mano', ba.sesgo, 1.3333, 0.0005,
    'Bland JM, Altman DG. Lancet 1986;1:307 — media de las diferencias');
verificar('Desvío de las diferencias calculado a mano', ba.desvioDiferencias, 0.5774, 0.0005,
    'Bland & Altman 1986');
verificar('Límite de acuerdo inferior = sesgo − 1.96·DE', ba.limiteAcuerdoInferior, 0.2017, 0.001,
    'Bland & Altman 1986');
verificar('Límite de acuerdo superior = sesgo + 1.96·DE', ba.limiteAcuerdoSuperior, 2.4650, 0.001,
    'Bland & Altman 1986');

verificar('Mediciones idénticas dan sesgo cero',
    blandAltman([5, 6, 7, 8], [5, 6, 7, 8]).sesgo, 0, 1e-9, 'Definición');
verificarCierto('Se detecta el sesgo proporcional, que invalida los límites constantes',
    blandAltman([10, 20, 30, 40, 50], [10, 19, 27, 34, 40]).sesgoProporcional === true,
    'Bland & Altman 1986: si la diferencia crece con la magnitud hay que transformar antes');
verificarCierto('Dos métodos donde uno da el doble correlacionan perfecto y NO concuerdan',
    pearson([1, 2, 3, 4], [2, 4, 6, 8]).r === 1 &&
    blandAltman([1, 2, 3, 4], [2, 4, 6, 8]).sesgo !== 0,
    'Es la razón por la que la correlación no mide concordancia');


// ============================================================
// 12. CONTRASTES ENTRE GRUPOS
// ============================================================
bloque('12. Contrastes entre grupos');

const mw = mannWhitney([1, 2, 3, 4], [5, 6, 7, 8]);
verificarIgual('U de Mann-Whitney con separación completa', mw.U, 0,
    'Suma de rangos del grupo A = 10; U_A = 10 − 4×5/2 = 0');
verificar('La probabilidad de superioridad equivale al área bajo la curva',
    mw.probabilidadSuperioridad, 0, 1e-9,
    'U/(nA·nB) es la misma cantidad que el área ROC');
verificarCierto('Separación completa da p < 0.05 con n=4 por grupo',
    mw.p < 0.05,
    'Aproximación normal; con grupos pequeños el valor p se declara como orientativo');
verificarIgual('Se avisa cuando algún grupo tiene menos de 10 observaciones',
    mw.avisoMuestraPequenaKey, 'stats_small_sample_p',
    'La aproximación normal es asintótica');

// Kruskal-Wallis con tres grupos de tres, separados:
//   rangos 1..9, sumas 6/15/24, N=9
//   H = 12/(9×10) × (36/3 + 225/3 + 576/3) − 3×10 = 37.2 − 30 = 7.2
const kw = kruskalWallis([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
verificar('H de Kruskal-Wallis calculado a mano', kw.H, 7.2, 0.001,
    'H = 12/(N(N+1)) × Σ(R²/n) − 3(N+1); sin empates, corrección = 1');
verificarIgual('Grados de libertad = número de grupos − 1', kw.gl, 2, 'Definición');
verificar('Valor p asociado a H=7.2 con 2 grados de libertad', kw.p, 0.0273, 0.001,
    'Cola de la distribución de chi cuadrado');

// Chi cuadrado: tabla 2×2 con 20/10/10/20
//   χ² = N(ad−bc)²/((a+b)(c+d)(a+c)(b+d)) = 60×300²/30⁴ = 6.667
const chi = chiCuadradoIndependencia([[20, 10], [10, 20]]);
verificar('Chi cuadrado calculado a mano para la tabla 20/10/10/20', chi.chi2, 6.667, 0.001,
    'χ² = N(ad−bc)²/(productos marginales)');
verificar('Valor p de χ²=6.667 con 1 grado de libertad', chi.p, 0.00983, 0.0005,
    'Cola de la distribución de chi cuadrado');
verificar('V de Cramér como tamaño del efecto', chi.vCramer, 0.3333, 0.0005,
    'V = √(χ²/(N·min(f−1,c−1)))');
verificarIgual('Se avisa cuando hay frecuencias esperadas por debajo de 5',
    chiCuadradoIndependencia([[8, 2], [1, 1]]).avisoKey, 'stats_chi2_low_expected',
    'La aproximación de chi cuadrado no es válida con celdas escasas: corresponde una prueba exacta');


// ============================================================
// 13. CALIBRACIÓN
// ============================================================
bloque('13. Calibración');

const calib = calibracionPorGrupos(
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10],
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    { grupos: 5 }
);
verificarIgual('La calibración agrupa en el número de grupos pedido', calib.grupos.length, 5,
    'Gráfico de calibración al estilo de Hosmer-Lemeshow');
verificarCierto('La proporción observada crece con el puntaje (monotonía)',
    calib.monotona === true,
    'Comprobación mínima de que el puntaje va en el sentido correcto');
verificarCierto('Cada grupo declara su tamaño y su intervalo de confianza',
    calib.grupos.every(g => g.n > 0 && g.ic95.inferior !== null),
    'Con muestras pequeñas los grupos quedan poco poblados y eso tiene que verse');


// ============================================================
// 14. COMPARACIÓN DE DOS PREDICTORES
// ============================================================
bloque('14. Comparación pareada de dos predictores');

const desenlaceComp = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
const predBueno = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const predMalo = [5, 3, 8, 2, 9, 4, 6, 1, 7, 5];
const comp = compararAUCPareado(predBueno, predMalo, desenlaceComp, { iteraciones: 500, semilla: 777 });
verificar('El área del predictor perfecto es 1', comp.aucA, 1.0, 1e-9, 'Separación completa');
verificarCierto('La diferencia de áreas se estima con intervalo por remuestreo pareado',
    comp.diferencia > 0 && comp.ic95.inferior !== null,
    'El remuestreo es por individuo, no por predictor: los dos se miden en la misma persona');
verificarCierto('El remuestreo pareado es reproducible con la misma semilla',
    JSON.stringify(compararAUCPareado(predBueno, predMalo, desenlaceComp, { iteraciones: 500, semilla: 777 }).ic95) ===
    JSON.stringify(comp.ic95),
    'Requisito para poder reportar el intervalo');


// ============================================================
// 15. INFORME COMPLETO
// ============================================================
bloque('15. Informe completo de validación');

const informe = informeValidacion(
    [2, 3, 3, 4, 5, 5, 6, 7, 8, 9, 1, 2, 2, 3, 4, 4, 5, 6, 1, 3],
    [0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0],
    { iteracionesBootstrap: 300, semilla: 2026, nombrePredictor: 'riesgoOseoPuntaje', nombreDesenlace: 'dxaOsteopenia' }
);
verificarCierto('El informe encadena discriminación, corte, exactitud y calibración',
    informe.valido && informe.discriminacion.valido && informe.cortes.valido &&
    informe.exactitudEnCorte !== null && informe.calibracion.valido,
    'Es el análisis mínimo de un estudio de validación');
verificarCierto('El informe estampa el sello del motor que lo produjo',
    typeof informe.sello === 'string' && informe.sello.indexOf('CARDA-v') === 0,
    'Sin la versión y la huella de parámetros, la cifra no es reproducible');
verificarCierto('El informe declara la prevalencia y los descartados por dato faltante',
    informe.prevalencia !== null && informe.descartadosPorDatoFaltante === 0,
    'Ambos condicionan la interpretación de los valores predictivos');
verificarIgual('El informe recomienda un corte concreto',
    typeof informe.corteRecomendado, 'number',
    'Derivado con el mismo código que produjo las puntuaciones');


// ============================================================
// 16. DESCRIPTIVOS
// ============================================================
bloque('16. Descriptivos');

const d = descriptivos([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
verificar('Media de 1..10', d.media, 5.5, 1e-9, 'Cálculo directo');
verificar('Mediana de 1..10 por interpolación', d.mediana, 5.5, 1e-9, 'Cálculo directo');
verificar('Desvío muestral de 1..10 (denominador n−1)', d.desvio, 3.0277, 0.0005,
    '√(82.5/9) = 3.02765');
verificar('Primer cuartil de 1..10', d.q1, 3.25, 1e-9, 'Interpolación lineal entre órdenes');
verificarIgual('Los datos faltantes se cuentan, no se ignoran en silencio',
    descriptivos([1, 2, '', null, 5]).faltantes, 2,
    'El número de faltantes forma parte del resultado');


// ============================================================
// INFORME
// ============================================================
const VERDE = '\x1b[32m', ROJO = '\x1b[31m', GRIS = '\x1b[90m', NEGRITA = '\x1b[1m', FIN = '\x1b[0m';

console.log(`\n${NEGRITA}CalD Risk Screen — Validación del módulo estadístico${FIN}`);
console.log(`${GRIS}Cada prueba contrasta el estadístico contra un valor publicado o una${FIN}`);
console.log(`${GRIS}identidad algebraica conocida, nunca contra su propia implementación.${FIN}\n`);

resultados.forEach(r => {
    if (r.separador) { console.log(`\n${NEGRITA}${r.titulo}${FIN}`); return; }
    const marca = r.ok ? `${VERDE}✓${FIN}` : `${ROJO}✗${FIN}`;
    const valores = (typeof r.obtenido === 'number' && typeof r.esperado === 'number')
        ? ` ${GRIS}(obtenido ${Math.round(r.obtenido * 1e6) / 1e6}, esperado ${r.esperado})${FIN}`
        : (r.ok ? '' : ` ${GRIS}(obtenido ${r.obtenido}, esperado ${r.esperado})${FIN}`);
    console.log(`  ${marca} ${r.descripcion}${valores}`);
    if (r.fuente) console.log(`    ${GRIS}${r.fuente}${FIN}`);
});

const total = pasadas + fallidas;
console.log(`\n${NEGRITA}Resultado: ${pasadas} de ${total} pruebas superadas${FIN}`);
if (fallidas > 0) {
    console.log(`${ROJO}${fallidas} prueba(s) fallida(s).${FIN}\n`);
    process.exit(1);
}
console.log(`${VERDE}El módulo estadístico reproduce los valores de referencia.${FIN}\n`);
process.exit(0);
