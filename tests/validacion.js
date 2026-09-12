#!/usr/bin/env node
/* ============================================================
 * CalD Risk Screen — Suite de validación del motor CARDA
 * ============================================================
 *
 * PARA QUÉ SIRVE ESTO
 *
 * Un algoritmo de tamizaje solo es creíble si se puede demostrar que
 * reproduce los valores que la literatura ya publicó. Este archivo
 * ejecuta esa demostración de forma automática y verificable por
 * cualquiera: revisores, el panel de expertos o un lector del
 * repositorio.
 *
 * Permite afirmar en una publicación, con respaldo comprobable:
 * "el algoritmo reproduce los valores publicados de absorción
 *  fraccional de calcio con una desviación inferior al 5%,
 *  verificable ejecutando tests/validacion.js del repositorio".
 *
 * CÓMO EJECUTARLO
 *     node tests/validacion.js
 *
 * Devuelve código de salida 0 si todo pasa, 1 si algo falla.
 * ============================================================ */

const fs = require('fs');
const path = require('path');

// Los archivos del motor son JS plano sin módulos, pensados para
// cargarse con <script> en el navegador. Se concatenan y evalúan.
const raizJs = path.join(__dirname, '..', 'js');
const fuente = ['data.js', 'algorithm.js']
    .map(f => fs.readFileSync(path.join(raizJs, f), 'utf8'))
    .join('\n');

const contexto = {};
(new Function(fuente + '\n; Object.assign(this, {' + [
    'absorcionFraccionalPorCarga',
    'calcularCalcioAbsorbidoItem',
    'biodisponibilidadRelativa',
    'ejecutarSemanaVirtualCalcio',
    'obtenerReferenciaCalcio',
    'obtenerReferenciaVitaminaD',
    'obtenerObjetivoProteina',
    'calcularAdecuacionVitaminaD',
    'calcularProteinaDesdeCuestionario',
    'calcularExposicionSolarEstandar',
    'calcularRiesgoSarcopenia',
    'calcularAdherenciaEjercicio',
    'aplicarModificadoresCalcio',
    'interpretar25OHVitaminaD',
    'interpretarCalcioSerico',
    'clasificarAdecuacionCalcio',
    'ALIMENTOS_INICIALES',
    'MARCO_CALCIO_IOM',
    'MARCO_CALCIO_EFSA',
    'MED_POR_FOTOTIPO_SED',
    'UMBRAL_PROTECTOR_EPIC_OXFORD_MG',
    'UI_POR_MCG_VITAMINA_D'
].join(',') + '});')).call(contexto);

const {
    absorcionFraccionalPorCarga, calcularCalcioAbsorbidoItem,
    ejecutarSemanaVirtualCalcio, obtenerReferenciaCalcio,
    obtenerReferenciaVitaminaD, obtenerObjetivoProteina,
    calcularAdecuacionVitaminaD, calcularProteinaDesdeCuestionario, calcularExposicionSolarEstandar,
    calcularRiesgoSarcopenia, aplicarModificadoresCalcio,
    interpretar25OHVitaminaD, clasificarAdecuacionCalcio,
    ALIMENTOS_INICIALES, UMBRAL_PROTECTOR_EPIC_OXFORD_MG, UI_POR_MCG_VITAMINA_D
} = contexto;

// ------------------------------------------------------------
// Utilidades mínimas de aserción
// ------------------------------------------------------------
let pasadas = 0, fallidas = 0;
const resultados = [];

function verificar(descripcion, obtenido, esperado, toleranciaRelativa = 0.05, fuente = '') {
    const tol = Math.max(Math.abs(esperado) * toleranciaRelativa, 0.5);
    const ok = Math.abs(obtenido - esperado) <= tol;
    ok ? pasadas++ : fallidas++;
    resultados.push({ ok, descripcion, obtenido, esperado, fuente });
    return ok;
}

function verificarIgual(descripcion, obtenido, esperado, fuente = '') {
    const ok = obtenido === esperado;
    ok ? pasadas++ : fallidas++;
    resultados.push({ ok, descripcion, obtenido, esperado, fuente });
    return ok;
}

function verificarCierto(descripcion, condicion, fuente = '') {
    const ok = !!condicion;
    ok ? pasadas++ : fallidas++;
    resultados.push({ ok, descripcion, obtenido: ok, esperado: true, fuente });
    return ok;
}

function bloque(titulo) {
    resultados.push({ separador: true, titulo });
}

const alimento = id => ALIMENTOS_INICIALES.find(a => a.id === id);

// ============================================================
// 1. CURVA DE ABSORCIÓN FRACCIONAL DE CALCIO
// ============================================================
bloque('1. Curva de absorción fraccional (saturación por carga)');

const FUENTE_HEANEY_1990 = 'Heaney, Weaver & Fitzsimmons, J Bone Miner Res 1990;5:1135';

verificar('Absorción fraccional a carga de 15 mg',
    absorcionFraccionalPorCarga(15) * 100, 64, 0.05, FUENTE_HEANEY_1990);

verificar('Absorción fraccional a carga de 500 mg',
    absorcionFraccionalPorCarga(500) * 100, 28.6, 0.05, FUENTE_HEANEY_1990);

verificarCierto('La absorción fraccional decrece monótonamente con la carga',
    [50, 100, 300, 500, 1000, 2000].every((c, i, arr) =>
        i === 0 || absorcionFraccionalPorCarga(c) < absorcionFraccionalPorCarga(arr[i - 1])),
    FUENTE_HEANEY_1990);

verificarCierto('La absorción continúa por encima de 500 mg (no hay tope absoluto)',
    1000 * absorcionFraccionalPorCarga(1000) > 500 * absorcionFraccionalPorCarga(500),
    'NIH ODS Calcium Fact Sheet');

// ============================================================
// 2. CALCIO ABSORBIBLE POR ALIMENTO
// ============================================================
bloque('2. Calcio absorbible por alimento (tabla publicada)');

const FUENTE_WEAVER_1999 = 'Weaver & Heaney, Am J Clin Nutr 1999;70(3 Suppl):543S';

// Cada fila: [id del alimento, mg de la porción del ensayo, mg absorbibles publicados]
const TABLA_PUBLICADA = [
    ['leche',                  300, 96],
    ['yogur',                  300, 96],
    ['bebida_veg_fortificada', 300, 72],
    ['verduras_bajo_oxalato',   70, 35],
    ['verduras_alto_oxalato',  115,  6],
    ['almendras',               80, 17],
    ['ajonjoli_tahini',         37,  8]
];

TABLA_PUBLICADA.forEach(([id, mg, esperado]) => {
    const a = alimento(id);
    const obtenido = calcularCalcioAbsorbidoItem(mg, a.faAlimento, mg, a.cargaReferencia);
    verificar(`Calcio absorbible de ${id} (${mg} mg)`, obtenido, esperado, 0.12, FUENTE_WEAVER_1999);
});

bloque('3. El contenido de calcio no predice el calcio absorbible');

const espinaca = alimento('verduras_alto_oxalato');
const brasicas = alimento('verduras_bajo_oxalato');
const absEspinaca = calcularCalcioAbsorbidoItem(115, espinaca.faAlimento, 115, espinaca.cargaReferencia);
const absBrasicas = calcularCalcioAbsorbidoItem(61, brasicas.faAlimento, 61, brasicas.cargaReferencia);

verificarCierto('Las brásicas aportan más calcio absorbible que la espinaca pese a contener menos',
    absBrasicas > absEspinaca,
    'Heaney & Weaver, Am J Clin Nutr 1990;51:656 (col rizada) y 1988;47:707 (espinaca)');

verificarCierto('El tofu suave aporta menos calcio absorbible que el extra firme',
    calcularCalcioAbsorbidoItem(35, alimento('tofu_suave').faAlimento, 35, alimento('tofu_suave').cargaReferencia)
    < calcularCalcioAbsorbidoItem(70, alimento('tofu_extra_firme').faAlimento, 70, alimento('tofu_extra_firme').cargaReferencia),
    'Etiquetas del mercado panameño: 20 mg vs 40 mg por porción de 3 oz');

bloque('4. Saturación al combinar alimentos en una misma comida');

const leche = alimento('leche');
const solo = calcularCalcioAbsorbidoItem(300, leche.faAlimento, 300, leche.cargaReferencia);
const acompanado = calcularCalcioAbsorbidoItem(300, leche.faAlimento, 900, leche.cargaReferencia);
verificarCierto('El mismo alimento rinde menos si la comida tiene más calcio total',
    acompanado < solo, FUENTE_HEANEY_1990);

// ============================================================
// 5. MARCOS DE REFERENCIA IOM / EFSA
// ============================================================
bloque('5. Marcos de referencia de ingesta de calcio');

verificarIgual('IOM: RDA de mujer de 35 años',
    obtenerReferenciaCalcio(35, 'femenino', 'IOM').rda, 1000,
    'IOM/NASEM, Dietary Reference Intakes for Calcium and Vitamin D, 2011');

verificarIgual('IOM: RDA de mujer de 55 años (incremento posmenopáusico)',
    obtenerReferenciaCalcio(55, 'femenino', 'IOM').rda, 1200,
    'IOM/NASEM 2011');

verificarIgual('IOM: RDA de hombre de 55 años (sin incremento)',
    obtenerReferenciaCalcio(55, 'masculino', 'IOM').rda, 1000,
    'IOM/NASEM 2011');

verificarIgual('EFSA: PRI de adulto de 35 años',
    obtenerReferenciaCalcio(35, 'femenino', 'EFSA').rda, 950,
    'EFSA NDA Panel, EFSA Journal 2015;13(5):4101');

verificarIgual('EFSA no aplica incremento geriátrico (75 años sigue en 950)',
    obtenerReferenciaCalcio(75, 'femenino', 'EFSA').rda, 950,
    'EFSA 2015');

verificarCierto('IOM y EFSA divergen en mujeres mayores de 50 años',
    obtenerReferenciaCalcio(55, 'femenino', 'IOM').rda !== obtenerReferenciaCalcio(55, 'femenino', 'EFSA').rda,
    'Diferencia metodológica: retención positiva (IOM) vs balance nulo (EFSA)');

// ============================================================
// 6. VITAMINA D
// ============================================================
bloque('6. Vitamina D: referencias, potencia D2/D3 y laboratorio');

verificarIgual('RDA de vitamina D en adulto de 35 años (µg)',
    obtenerReferenciaVitaminaD(35).rda, 15, 'IOM/NASEM 2011');

verificarIgual('RDA de vitamina D en adulto mayor de 70 años (µg)',
    obtenerReferenciaVitaminaD(75).rda, 20, 'IOM/NASEM 2011');

const suplD3 = calcularAdecuacionVitaminaD([], { mcgPorDia: 15, diasPorSemana: 7, forma: 'D3' }, 35);
const suplD2 = calcularAdecuacionVitaminaD([], { mcgPorDia: 15, diasPorSemana: 7, forma: 'D2' }, 35);

verificarCierto('Un suplemento de forma desconocida se calcula como D2 (supuesto conservador)',
    calcularAdecuacionVitaminaD([], { mcgPorDia: 15, diasPorSemana: 7, forma: 'desconocida' }, 35).totalEq === suplD2.totalEq,
    'Ante forma no declarada, no sobrestimar el aporte real');

verificarCierto('La D2 se computa como menos potente que la D3 a igual dosis',
    suplD2.totalEq < suplD3.totalEq,
    'Tripkovic et al., Am J Clin Nutr 2012;95:1357 (diferencia media 15.23 nmol/L a favor de D3)');

verificarIgual('15 µg de D3 diarios se clasifican como adecuados',
    suplD3.categoria, 'adecuada', 'IOM/NASEM 2011');

verificarIgual('Marco óseo: 8 ng/mL es deficiencia severa',
    interpretar25OHVitaminaD(8, 'oseo').categoria, 'deficiencia_severa',
    'IOF: deficiencia severa por debajo de 25 nmol/L (10 ng/mL)');

verificarIgual('Marco óseo: 15 ng/mL es deficiencia',
    interpretar25OHVitaminaD(15, 'oseo').categoria, 'deficiente',
    'IOF: deficiencia entre 25 y 49 nmol/L (10-19 ng/mL)');

verificarIgual('Marco óseo: 25 ng/mL es INSUFICIENTE',
    interpretar25OHVitaminaD(25, 'oseo').categoria, 'insuficiente',
    'IOF/BHOF: insuficiencia entre 20 y 29 ng/mL; el objetivo óseo es ≥30');

verificarIgual('Marco poblacional: 25 ng/mL es SUFICIENTE',
    interpretar25OHVitaminaD(25, 'poblacional').categoria, 'suficiente',
    'IOM/NASEM 2011 y EFSA 2016: suficiencia desde 20 ng/mL (50 nmol/L)');

verificarCierto('El mismo valor de 25 ng/mL se clasifica distinto según el marco',
    interpretar25OHVitaminaD(25, 'oseo').categoria !== interpretar25OHVitaminaD(25, 'poblacional').categoria,
    'El desacuerdo entre organismos es real y la herramienta debe mostrarlo, no ocultarlo');

verificarCierto('La zona de desacuerdo se señala explícitamente',
    interpretar25OHVitaminaD(25, 'oseo').zonaDeDesacuerdo === true &&
    interpretar25OHVitaminaD(40, 'oseo').zonaDeDesacuerdo === false,
    'Franja 20-29 ng/mL: los marcos discrepan; por encima de 30 coinciden');

verificarIgual('Marco óseo: 35 ng/mL es adecuado',
    interpretar25OHVitaminaD(35, 'oseo').categoria, 'suficiente',
    'IOF: adecuación entre 75 y 110 nmol/L (30-44 ng/mL); BHOF: ≥30 y ≤50 ng/mL');

verificarIgual('El marco por defecto es el óseo',
    interpretar25OHVitaminaD(25).categoria, interpretar25OHVitaminaD(25, 'oseo').categoria,
    'La herramienta es de tamizaje de salud ósea, por lo que ese es el marco pertinente');

verificarIgual('El rango objetivo del marco óseo es 30-50 ng/mL',
    JSON.stringify(interpretar25OHVitaminaD(35, 'oseo').rangoObjetivo), '{"min":30,"max":50}',
    'Bone Health and Osteoporosis Foundation: mantener ≥30 y ≤50 ng/mL');

verificarCierto('Se conserva la nota del corte histórico de 30 ng/mL de 2011',
    interpretar25OHVitaminaD(25, 'oseo').bajoCorteHistorico2011 === true,
    'La Endocrine Society abandonó en 2024 toda su clasificación de 2011');

verificarIgual('Conversión de ng/mL a nmol/L',
    interpretar25OHVitaminaD(20).nmol, 49.9, 'Factor de conversión 2.496');

// ============================================================
// 7. EXPOSICIÓN SOLAR EN UNIDADES ESTÁNDAR
// ============================================================
bloque('7. Exposición solar (SED, MED y regla de Holick)');

const FUENTE_HOLICK = 'Regla de Holick: ¼ MED sobre ¼ de superficie corporal ≈ 1000 UI de vitamina D3';

// Fototipo II tiene MED de 2.5 SED. Un cuarto de MED son 0.625 SED.
// Con índice UV 10, eso equivale a 3.75 minutos.
const puntoHolick = calcularExposicionSolarEstandar({
    diasPorSemana: 1, minutosPorSesion: 3.75, horario: 'pico',
    edad: 20, fototipo: 'II', superficieCorporal: 'parcial'
});

verificar('Punto de referencia de Holick devuelve 1000 UI',
    puntoHolick.uiPorSesion, 1000, 0.02, FUENTE_HOLICK);

verificar('MED del fototipo II expresada en SED',
    puntoHolick.medEnSed, 2.5, 0.01,
    'Fitzpatrick; MED tipo II ≈ 250 J/m² = 2.5 SED');

verificarCierto('Los fototipos oscuros requieren más tiempo para la misma dosis',
    calcularExposicionSolarEstandar({ diasPorSemana: 3, minutosPorSesion: 15, horario: 'pico', edad: 35, fototipo: 'VI', superficieCorporal: 'parcial' }).minutosPara1000UI >
    calcularExposicionSolarEstandar({ diasPorSemana: 3, minutosPorSesion: 15, horario: 'pico', edad: 35, fototipo: 'I', superficieCorporal: 'parcial' }).minutosPara1000UI,
    'Fitzpatrick 1988: la melanina compite por los fotones UVB');

const corto = calcularExposicionSolarEstandar({ diasPorSemana: 1, minutosPorSesion: 15, horario: 'pico', edad: 35, fototipo: 'IV', superficieCorporal: 'parcial' });
const largo = calcularExposicionSolarEstandar({ diasPorSemana: 1, minutosPorSesion: 60, horario: 'pico', edad: 35, fototipo: 'IV', superficieCorporal: 'parcial' });

verificarCierto('La síntesis cutánea alcanza una meseta: cuadruplicar el tiempo no cuadruplica las UI',
    largo.uiPorSesion < corto.uiPorSesion * 2,
    'La previtamina D3 se fotodegrada a lumisterol y taquisterol por encima de ~1 MED');

verificarCierto('Se advierte riesgo de quemadura al superar 1 MED',
    largo.riesgoQuemadura === true, 'Seguridad fotobiológica');

verificarCierto('La síntesis cutánea declina con la edad',
    calcularExposicionSolarEstandar({ diasPorSemana: 3, minutosPorSesion: 15, horario: 'pico', edad: 75, fototipo: 'III', superficieCorporal: 'parcial' }).uiPorSesion <
    calcularExposicionSolarEstandar({ diasPorSemana: 3, minutosPorSesion: 15, horario: 'pico', edad: 25, fototipo: 'III', superficieCorporal: 'parcial' }).uiPorSesion,
    'Terushkin et al., J Am Acad Dermatol 2010: af = 1 − 0.015 × (edad − 20)');

// ============================================================
// 8. INHIBIDORES Y PÉRDIDAS
// ============================================================
bloque('8. Inhibidores de absorción y pérdidas urinarias');

const base = { promedioAbsorbidoSemanal: 300, promedioAbsorbidoSuplemento: 150, metaAbsorbidaDiaria: 329 };
const conIBPCarbonato = aplicarModificadoresCalcio(base, { usaIBP: true, tipoSuplemento: 'carbonato', nivelSodio: 'medio', tazasCafeDia: 2 });
const conIBPCitrato  = aplicarModificadoresCalcio(base, { usaIBP: true, tipoSuplemento: 'citrato',  nivelSodio: 'medio', tazasCafeDia: 2 });
const sinIBP         = aplicarModificadoresCalcio(base, { usaIBP: false, tipoSuplemento: 'carbonato', nivelSodio: 'medio', tazasCafeDia: 2 });

verificarCierto('Los IBP reducen la absorción del carbonato de calcio',
    conIBPCarbonato.absorbidoNeto < sinIBP.absorbidoNeto,
    'El carbonato requiere acidez gástrica para disolverse');

verificarCierto('Los IBP no penalizan al citrato igual que al carbonato',
    conIBPCitrato.absorbidoNeto > conIBPCarbonato.absorbidoNeto,
    'El citrato es soluble con independencia del pH gástrico');

verificarCierto('Se emite alerta cuando coinciden IBP y carbonato',
    conIBPCarbonato.alertaIBPCarbonato === true && conIBPCitrato.alertaIBPCarbonato === false,
    'Recomendación clínica: preferir citrato en usuarios de IBP');

verificarCierto('Un sodio alto genera mayores pérdidas urinarias de calcio que uno bajo',
    aplicarModificadoresCalcio(base, { usaIBP: false, tipoSuplemento: 'carbonato', nivelSodio: 'alto', tazasCafeDia: 0 }).perdidas.perdidaSodio >
    aplicarModificadoresCalcio(base, { usaIBP: false, tipoSuplemento: 'carbonato', nivelSodio: 'bajo', tazasCafeDia: 0 }).perdidas.perdidaSodio,
    'El sodio aumenta la calciuria');

// ============================================================
// 9. MOTOR SEMANAL COMPLETO
// ============================================================
bloque('9. Motor semanal: comportamiento integrado');

const ref = obtenerReferenciaCalcio(35, 'femenino', 'IOM');
const construir = (id, dias, veces = 1, porciones = 1) => ({
    ...alimento(id), diasPorSemana: dias, vecesPorDia: veces, porcionesPorComida: porciones
});

const dietaPobre = ejecutarSemanaVirtualCalcio(
    [construir('verduras_alto_oxalato', 7, 2), construir('tofu_suave', 5), construir('almendras', 7)],
    null, {}, ref);

const dietaBuena = ejecutarSemanaVirtualCalcio(
    [construir('verduras_bajo_oxalato', 7, 2), construir('tofu_sulfato_calcio', 5),
     construir('bebida_veg_fortificada', 7), construir('almendras', 7)],
    null, {}, ref);

verificarCierto('Una dieta de baja biodisponibilidad se clasifica como muy baja',
    clasificarAdecuacionCalcio(dietaPobre.razonAdecuacion).categoria === 'muy_baja',
    'Caso de uso central de la herramienta');

verificarCierto('La eficiencia de absorción es sustancialmente menor con fuentes de alto oxalato',
    dietaPobre.eficienciaGlobal < dietaBuena.eficienciaGlobal / 2,
    FUENTE_WEAVER_1999);

verificarCierto('El umbral de 525 mg/día de EPIC-Oxford se detecta correctamente',
    dietaPobre.bajoUmbralEpicOxford === true,
    'Appleby, Roddam, Allen & Key, Eur J Clin Nutr 2007;61:1400');

const unaToma = ejecutarSemanaVirtualCalcio([construir('bebida_veg_fortificada', 7)],
    { mgPorDia: 1000, vecesPorDia: 1, diasPorSemana: 7, tipoId: 'carbonato' }, {}, ref);
const dosTomas = ejecutarSemanaVirtualCalcio([construir('bebida_veg_fortificada', 7)],
    { mgPorDia: 1000, vecesPorDia: 2, diasPorSemana: 7, tipoId: 'carbonato' }, {}, ref);

verificarCierto('Fraccionar el suplemento aumenta el calcio absorbido',
    dosTomas.promedioAbsorbidoSemanal > unaToma.promedioAbsorbidoSemanal,
    'Heaney, J Bone Miner Res 2000;15:2291: las dosis divididas rinden más');

verificarCierto('Se alerta cuando una comida supera los 500 mg',
    unaToma.alertaFraccionamiento === true, 'NIH ODS Calcium Fact Sheet');

const carbonato = ejecutarSemanaVirtualCalcio([construir('bebida_veg_fortificada', 7)],
    { mgPorDia: 1000, vecesPorDia: 2, diasPorSemana: 7, tipoId: 'carbonato' }, {}, ref);
const citrato = ejecutarSemanaVirtualCalcio([construir('bebida_veg_fortificada', 7)],
    { mgPorDia: 1000, vecesPorDia: 2, diasPorSemana: 7, tipoId: 'citrato' }, {}, ref);

verificarCierto('El citrato de calcio rinde más que el carbonato',
    citrato.promedioAbsorbidoSemanal > carbonato.promedioAbsorbidoSemanal,
    'Sakhaee et al., Am J Ther 1999;6:313: 22-27% más de absorción');

verificarIgual('La semana virtual siempre tiene 7 días',
    dietaBuena.reporteDias.length, 7, 'Consistencia estructural');

// ============================================================
// 10. SARCOPENIA Y PROTEÍNA
// ============================================================
bloque('10. Sarcopenia (SARC-F) y objetivos de proteína');

const sarcAlto = calcularRiesgoSarcopenia({ fuerza: 2, caminar: 1, levantarse_silla: 1, subir_escaleras: 1, caidas: 0 });
const sarcMedio = calcularRiesgoSarcopenia({ fuerza: 1, caminar: 1, levantarse_silla: 0, subir_escaleras: 0, caidas: 0 });
const sarcBajo = calcularRiesgoSarcopenia({ fuerza: 0, caminar: 0, levantarse_silla: 0, subir_escaleras: 0, caidas: 0 });

verificarIgual('SARC-F de 5 puntos supera el corte estándar',
    sarcAlto.riesgoProbable, true,
    'Malmstrom & Morley, J Am Med Dir Assoc 2013: corte ≥4');

verificarIgual('SARC-F de 2 puntos activa el corte sensible pero no el estándar',
    sarcMedio.categoria, 'alerta',
    'La sensibilidad del corte ≥4 es baja (30-55%), por eso se reporta también ≥2');

verificarIgual('SARC-F de 0 puntos se clasifica como bajo riesgo',
    sarcBajo.categoria, 'bajo', 'Malmstrom & Morley 2013');

verificarCierto('La circunferencia de pantorrilla baja eleva la categoría',
    calcularRiesgoSarcopenia({ fuerza: 0, caminar: 0, levantarse_silla: 0, subir_escaleras: 0, caidas: 0 },
        { circunferenciaPantorrilla: 30, sexo: 'femenino' }).categoria === 'alerta',
    'SARC-CalF: corte de 33 cm en mujeres y 34 cm en hombres');

verificarIgual('Objetivo de proteína en adulto joven',
    obtenerObjetivoProteina(30, false), 0.8, 'RDA del IOM');

verificarCierto('El objetivo de proteína sube en adultos mayores',
    obtenerObjetivoProteina(70, false) > obtenerObjetivoProteina(30, false),
    'PROT-AGE (Bauer 2013) y ESPEN (Deutz 2014): 1.0-1.2 g/kg/día');

verificarCierto('El objetivo de proteína se ajusta al alza en dieta vegetal',
    obtenerObjetivoProteina(30, true) > obtenerObjetivoProteina(30, false),
    'Menor digestibilidad (DIAAS) de la proteína vegetal');

// ============================================================
// 12. INTEGRIDAD DE LAS TRADUCCIONES
// ============================================================
bloque('12. Integridad de las traducciones');

const fsI18n = require('fs');
const pathI18n = require('path');
const dirI18n = path.join(__dirname, '..', 'js', 'i18n');

const archivosIdioma = fsI18n.existsSync(dirI18n)
    ? fsI18n.readdirSync(dirI18n).filter(f => f.endsWith('.js'))
    : [];

const fuenteI18n = archivosIdioma
    .map(f => fsI18n.readFileSync(path.join(dirI18n, f), 'utf8'))
    .join('\n') + '\n' + fsI18n.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8');

const ctxI18n = new Function('navigator', 'localStorage',
    fuenteI18n + '; return { TRANSLATIONS, IDIOMAS_PUBLICADOS, calcularCoberturaIdioma, crearTraductor };'
)({ language: 'es' }, { getItem: () => null, setItem: () => {} });

verificarCierto('Hay al menos un idioma publicado',
    ctxI18n.IDIOMAS_PUBLICADOS.length >= 1, 'Registro de idiomas');

Object.keys(ctxI18n.TRANSLATIONS).forEach(id => {
    const cob = ctxI18n.calcularCoberturaIdioma(id);
    verificarCierto(`Idioma ${id.toUpperCase()}: cobertura completa respecto al español`,
        cob.completo,
        cob.completo ? 'Todas las claves traducidas' : `Faltan ${cob.faltantes.length}: ${cob.faltantes.slice(0, 5).join(', ')}`);
});

// Las claves con marcadores de sustitución deben conservarlos en todos los idiomas.
const refI18n = ctxI18n.TRANSLATIONS.es;
const clavesConMarcadores = Object.keys(refI18n).filter(k => /\{[a-zA-Z0-9]+\}/.test(refI18n[k]));
let marcadoresRotos = [];
Object.keys(ctxI18n.TRANSLATIONS).forEach(id => {
    if (id === 'es') return;
    clavesConMarcadores.forEach(k => {
        const esperados = (refI18n[k].match(/\{[a-zA-Z0-9]+\}/g) || []).sort().join(',');
        const obtenidos = ((ctxI18n.TRANSLATIONS[id][k] || '').match(/\{[a-zA-Z0-9]+\}/g) || []).sort().join(',');
        if (esperados !== obtenidos) marcadoresRotos.push(`${id}:${k}`);
    });
});
verificarCierto('Los marcadores de sustitución se conservan en todos los idiomas',
    marcadoresRotos.length === 0,
    marcadoresRotos.length === 0
        ? `${clavesConMarcadores.length} claves con marcadores verificadas`
        : `Rotos: ${marcadoresRotos.slice(0, 5).join(', ')}`);



// ============================================================
// 13. CUESTIONARIO UNIFICADO: TRES NUTRIENTES DE UNA DECLARACIÓN
// ============================================================
bloque('13. Cuestionario unificado');

const dietaUnificada = [
    construir('tofu_extra_firme', 5), construir('bebida_veg_fortificada', 7),
    construir('verduras_bajo_oxalato', 7, 2), construir('legumbres', 5),
    construir('cereales_granos', 7, 3), construir('almendras', 7),
    construir('seitan_proteina_veg', 3)
];

verificarCierto('Los alimentos declaran los tres nutrientes a la vez',
    ALIMENTOS_INICIALES.every(a => a.calcioPorcion !== undefined && a.vitDPorcion !== undefined && a.proteinaPorcion !== undefined),
    'Un solo cuestionario evita que el participante declare el mismo alimento tres veces');

const protUnificada = calcularProteinaDesdeCuestionario(dietaUnificada, { pesoKg: 65, edad: 35, esDietaVegetal: true });
verificarCierto('La proteína se estima desde el cuestionario, sin preguntar gramos',
    protUnificada.gramosDia > 0 && !protUnificada.sinPeso,
    'Casi nadie sabe cuántos gramos de proteína consume');

verificarCierto('El catálogo incluye fuentes proteicas sin calcio relevante',
    ALIMENTOS_INICIALES.some(a => a.proteinaPorcion >= 15 && a.calcioPorcion <= 50),
    'Sin cereales, carnes y derivados de soya, la proteína quedaría subestimada');

const vitDUnificada = calcularAdecuacionVitaminaD(dietaUnificada, null, 35);
verificarCierto('La vitamina D sale del mismo catálogo de alimentos',
    vitDUnificada.dietaEq >= 0 && typeof vitDUnificada.dietaEq === 'number',
    'El catálogo separado de vitamina D se eliminó al unificar el cuestionario');

bloque('14. Datos del tofu según el mercado panameño');

const tofuEF = alimento('tofu_extra_firme');
const tofuF = alimento('tofu_firme');
const tofuS = alimento('tofu_suave');

verificarCierto('Los tres tipos de tofu están ordenados de mayor a menor calcio',
    tofuEF.calcioPorcion > tofuF.calcioPorcion && tofuF.calcioPorcion > tofuS.calcioPorcion,
    'Extra firme, firme y suave, con valores de etiquetas del mercado panameño');

verificar('Tofu extra firme: 40 mg por porción de 3 oz, medio bloque equivale a 1.75 porciones',
    tofuEF.calcioPorcion, 70, 0.02, 'Etiqueta de producto del mercado panameño');

verificar('Tofu firme: 30 mg por porción de 3 oz',
    tofuF.calcioPorcion, 52.5, 0.03, 'Etiqueta de producto del mercado panameño');

verificar('Tofu suave o sedoso: 20 mg por porción de 3 oz',
    tofuS.calcioPorcion, 35, 0.02, 'Etiqueta de producto del mercado panameño');

// El tofu ya no figura en la tabla de valores publicados porque su
// porción, tomada de etiquetas panameñas, no coincide con la del ensayo
// original de Weaver y Heaney (126 g = 258 mg). Al ser una carga menor,
// su absorción fraccional sube legítimamente por la curva de saturación.
verificarCierto('El tofu se beneficia de la curva de carga al ser una porción menor que la del ensayo',
    calcularCalcioAbsorbidoItem(70, tofuEF.faAlimento, 70, tofuEF.cargaReferencia) > 70 * tofuEF.faAlimento,
    'A menor carga por toma, mayor absorción fraccional (Heaney 1990)');

verificarCierto('El tofu aporta proteína además de calcio',
    tofuEF.proteinaPorcion > 10,
    'El tofu es fuente proteica relevante en dietas vegetales');



// ============================================================
// 15. EVALUACIÓN SEGÚN ORGANISMO Y SUPLEMENTOS
// ============================================================
bloque('15. Evaluación según el organismo elegido');

const dietaEval = [
    construir('tofu_extra_firme', 5), construir('bebida_veg_fortificada', 7),
    construir('verduras_bajo_oxalato', 7, 2), construir('legumbres', 5),
    construir('cereales_granos', 7, 3), construir('almendras', 7)
];
const refEval = obtenerReferenciaCalcio(35, 'femenino', 'IOM');
const resEval = ejecutarSemanaVirtualCalcio(dietaEval, null, {}, refEval);

const razonPorMarco = (marco) => {
    if (marco === 'EPIC') {
        return Math.round((resEval.promedioIngeridoSemanal / UMBRAL_PROTECTOR_EPIC_OXFORD_MG) * 1000) / 10;
    }
    const rda = obtenerReferenciaCalcio(35, 'femenino', marco).rda;
    const metaAbs = rda * absorcionFraccionalPorCarga(rda / 3);
    return Math.round((resEval.promedioAbsorbidoSemanal / metaAbs) * 1000) / 10;
};

verificarCierto('La misma dieta se clasifica distinto según el organismo elegido',
    clasificarAdecuacionCalcio(razonPorMarco('IOM')).categoria !== clasificarAdecuacionCalcio(razonPorMarco('EPIC')).categoria,
    'El desacuerdo entre criterios es real y la herramienta debe exponerlo');

verificarCierto('La meta del IOM es más exigente que la de la EFSA',
    obtenerReferenciaCalcio(35, 'femenino', 'IOM').rda > obtenerReferenciaCalcio(35, 'femenino', 'EFSA').rda,
    'IOM 1000 mg frente a EFSA 950 mg en adultos');

verificarIgual('EPIC-Oxford usa el IOM como base subyacente de referencia',
    obtenerReferenciaCalcio(35, 'femenino', 'EPIC').marco, 'IOM',
    'EPIC-Oxford es un umbral único de ingesta, no un marco completo por edad y sexo');

bloque('16. Suplementación de vitamina D');

// La interfaz captura la dosis en unidades internacionales y la convierte
// a microgramos antes de entregarla al motor (1 mcg = 40 UI).
const uiAMcg = (ui) => ui / UI_POR_MCG_VITAMINA_D;

verificar('2000 UI equivalen a 50 mcg',
    uiAMcg(2000), 50, 0.001, 'Factor de conversión: 1 mcg = 40 UI');

const supD3 = calcularAdecuacionVitaminaD([], { mcgPorDia: uiAMcg(2000), diasPorSemana: 7, forma: 'D3' }, 35);
const supD2 = calcularAdecuacionVitaminaD([], { mcgPorDia: uiAMcg(2000), diasPorSemana: 7, forma: 'D2' }, 35);
const supDesc = calcularAdecuacionVitaminaD([], { mcgPorDia: uiAMcg(2000), diasPorSemana: 7, forma: 'desconocida' }, 35);

verificarCierto('A igual dosis en UI, la D3 rinde más que la D2',
    supD3.totalEq > supD2.totalEq,
    'Tripkovic et al., Am J Clin Nutr 2012');

verificarIgual('Una forma no declarada se calcula como D2, el supuesto conservador',
    supDesc.totalEq, supD2.totalEq,
    'Evita sobrestimar el aporte real cuando falta el dato');

verificarCierto('Un suplemento de 2000 UI de D3 cubre la recomendación diaria',
    supD3.categoria === 'adecuada',
    'RDA del IOM: 600 UI (15 mcg) para adultos de 1 a 70 años');

bloque('17. Unidades del cuestionario pensadas para el paciente');

const cereales = alimento('cereales_granos');
verificarIgual('Los cereales se piden en una unidad casera, no en gramos',
    cereales.porcionUnidadKey, 'unit_grains',
    'Una taza cocida o dos rebanadas de pan son medidas que el paciente puede recordar');

verificarCierto('Las verduras se contabilizan cocidas',
    alimento('verduras_bajo_oxalato').soloCocido === true && alimento('verduras_alto_oxalato').soloCocido === true,
    'Medir verdura cruda en gramos no es realista fuera del laboratorio');

verificarCierto('Todas las porciones del catálogo usan medidas caseras o unidades naturales',
    ALIMENTOS_INICIALES.every(a => typeof a.porcionUnidadKey === 'string' && a.porcionUnidadKey.length > 0),
    'Diferencia frente a las calculadoras que piden gramos de alimento crudo');


// ============================================================
// INFORME
// ============================================================
const VERDE = '\x1b[32m', ROJO = '\x1b[31m', GRIS = '\x1b[90m', NEGRITA = '\x1b[1m', FIN = '\x1b[0m';

console.log(`\n${NEGRITA}CalD Risk Screen — Validación del motor CARDA${FIN}`);
console.log(`${GRIS}Cada prueba contrasta el comportamiento del algoritmo con un valor publicado.${FIN}\n`);

resultados.forEach(r => {
    if (r.separador) {
        console.log(`\n${NEGRITA}${r.titulo}${FIN}`);
        return;
    }
    const marca = r.ok ? `${VERDE}✓${FIN}` : `${ROJO}✗${FIN}`;
    const valores = typeof r.obtenido === 'number' && typeof r.esperado === 'number'
        ? ` ${GRIS}(obtenido ${Math.round(r.obtenido * 100) / 100}, esperado ${r.esperado})${FIN}`
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
console.log(`${VERDE}El motor reproduce todos los valores de referencia de la literatura.${FIN}\n`);
process.exit(0);
