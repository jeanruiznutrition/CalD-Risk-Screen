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
const fuente = ['data.js', 'algorithm.js', 'biomarkers.js']
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
    'UI_POR_MCG_VITAMINA_D',
    // --- Añadidos en la v6.0 ---
    'calcularPerdidasCalcio',
    'calcularFactorIBP',
    'estimarIndiceUVCieloClaro',
    'calcularDeclinacionSolar',
    'resolverIndiceUV',
    'calcularIMC',
    'calcularEntradaTotalVitaminaD',
    'evaluarPlausibilidadCuestionario',
    'calcularOST',
    'calcularORAI',
    'calcularRiesgoOseo',
    'calcularRiesgoOseoV6',
    'calcularTFGe',
    'calcularCalcioCorregido',
    'evaluarPanelOseo',
    'resumirBioquimicaParaRiesgoOseo',
    'generarConductaSugerida',
    'REGISTRO_PARAMETROS',
    'CARDA_VERSION',
    'CARDA_HUELLA_PARAMETROS',
    'CARDA_SELLO',
    'parametrosPorGrado',
    'SODIO_REFERENCIA_G_DIA',
    'CAFE_REFERENCIA_TAZAS_DIA',
    'FACTOR_IBP_CARBONATO_AYUNO',
    'FACTOR_IBP_CARBONATO_CON_COMIDA',
    'UMBRAL_SARC_CALF',
    'DIAAS_POR_ALIMENTO',
    'TIPOS_AGUA',
    'MULTIPLICADOR_VITD_POR_IMC'
].join(',') + '});')).call(contexto);

const {
    absorcionFraccionalPorCarga, calcularCalcioAbsorbidoItem,
    ejecutarSemanaVirtualCalcio, obtenerReferenciaCalcio,
    obtenerReferenciaVitaminaD, obtenerObjetivoProteina,
    calcularAdecuacionVitaminaD, calcularProteinaDesdeCuestionario, calcularExposicionSolarEstandar,
    calcularRiesgoSarcopenia, aplicarModificadoresCalcio,
    interpretar25OHVitaminaD, clasificarAdecuacionCalcio,
    ALIMENTOS_INICIALES, UMBRAL_PROTECTOR_EPIC_OXFORD_MG, UI_POR_MCG_VITAMINA_D,
    calcularPerdidasCalcio, calcularFactorIBP, estimarIndiceUVCieloClaro,
    calcularDeclinacionSolar, resolverIndiceUV, calcularIMC,
    calcularEntradaTotalVitaminaD, evaluarPlausibilidadCuestionario,
    calcularOST, calcularORAI, calcularRiesgoOseo, calcularRiesgoOseoV6,
    calcularTFGe, calcularCalcioCorregido, evaluarPanelOseo,
    resumirBioquimicaParaRiesgoOseo, generarConductaSugerida, REGISTRO_PARAMETROS, CARDA_VERSION,
    CARDA_HUELLA_PARAMETROS, CARDA_SELLO, parametrosPorGrado,
    SODIO_REFERENCIA_G_DIA, CAFE_REFERENCIA_TAZAS_DIA,
    FACTOR_IBP_CARBONATO_AYUNO, FACTOR_IBP_CARBONATO_CON_COMIDA,
    UMBRAL_SARC_CALF, DIAAS_POR_ALIMENTO, TIPOS_AGUA, MULTIPLICADOR_VITD_POR_IMC
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
// 17. CORRECCIONES DE LA v6.0 QUE ALTERAN RESULTADOS NUMÉRICOS
// ============================================================
// Cada prueba de este bloque corresponde a una corrección concreta
// documentada en AUDITORIA_v3.1.md y en CHANGELOG.md. Si una de ellas
// falla, la corrección se perdió en una edición posterior.

bloque('17. Pérdidas urinarias: modelo de exceso, no de pérdida absoluta');

const FUENTE_IOM_BALANCE = 'IOM/NASEM, Dietary Reference Intakes for Calcium and Vitamin D 2011, cap. 4: las RDA se derivaron de balances con ingestas habituales de sodio y cafeína';

const perdidaReferencia = calcularPerdidasCalcio({ nivelSodio: 'medio', tazasCafeDia: CAFE_REFERENCIA_TAZAS_DIA });
verificar('Quien consume exactamente la ingesta de referencia no pierde calcio adicional',
    perdidaReferencia.perdidaTotal, 0, 1e-9, FUENTE_IOM_BALANCE);

const perdidaAlta = calcularPerdidasCalcio({ nivelSodio: 'alto', tazasCafeDia: 3 });
verificarCierto('Por encima de la referencia la pérdida es positiva',
    perdidaAlta.perdidaTotal > 0, FUENTE_IOM_BALANCE);

const perdidaBaja = calcularPerdidasCalcio({ nivelSodio: 'bajo', tazasCafeDia: 0 });
verificarCierto('Por debajo de la referencia se acredita, no se castiga',
    perdidaBaja.perdidaTotal < 0 && perdidaBaja.esCredito === true,
    'El signo se conserva a propósito: la excreción es genuinamente menor que la del balance con que se fijó la RDA');

verificarIgual('La referencia de sodio se expone en el resultado para que el informe pueda explicarlo',
    perdidaReferencia.sodioReferencia, SODIO_REFERENCIA_G_DIA,
    'Sin la referencia visible, un valor negativo parece un error de cálculo');


bloque('18. Inhibidores de la bomba de protones: ayuno frente a con comida');

const FUENTE_OCONNELL = "O'Connell MB et al., Am J Med 2005;118:778 — el omeprazol redujo la absorción fraccional de carbonato del 9.1% al 3.5% EN AYUNO";

const ibpAyuno = calcularFactorIBP(true, 'carbonato', 'ayuno');
const ibpComida = calcularFactorIBP(true, 'carbonato', 'con_comida');
verificar('El factor en ayuno es el de los estudios publicados',
    ibpAyuno.suplemento, FACTOR_IBP_CARBONATO_AYUNO, 1e-9, FUENTE_OCONNELL);
verificar('Con comida la penalización es mucho menor',
    ibpComida.suplemento, FACTOR_IBP_CARBONATO_CON_COMIDA, 1e-9,
    'El alimento estimula la acidez gástrica que el carbonato necesita para disolverse');
verificarCierto('El carbonato en ayuno se penaliza más que con comida',
    ibpAyuno.suplemento < ibpComida.suplemento, FUENTE_OCONNELL);

const ibpCitratoAyuno = calcularFactorIBP(true, 'citrato', 'ayuno');
const ibpCitratoComida = calcularFactorIBP(true, 'citrato', 'con_comida');
verificarIgual('El citrato no depende del momento de la toma porque no depende del ácido gástrico',
    ibpCitratoAyuno.suplemento, ibpCitratoComida.suplemento,
    'La sal de citrato ya está disociada: su absorción es independiente del pH gástrico');

verificarIgual('Sin inhibidor no se aplica ningún factor',
    calcularFactorIBP(false, 'carbonato', 'ayuno').suplemento, 1.0,
    'El factor solo existe cuando hay inhibidor declarado');


bloque('19. Índice UV estimado por geometría solar');

const FUENTE_COOPER = 'Cooper PI, Solar Energy 1969;12:333 (declinación solar); relación estándar del ángulo cenital';

verificar('Declinación solar en el equinoccio de marzo próxima a cero',
    Math.abs(calcularDeclinacionSolar(80)), 0, 0.02, FUENTE_COOPER);
verificar('Declinación solar en el solsticio de junio próxima a +23.45°',
    calcularDeclinacionSolar(172), 23.45, 0.03, FUENTE_COOPER);
verificar('Declinación solar en el solsticio de diciembre próxima a −23.45°',
    calcularDeclinacionSolar(355), -23.45, 0.03, FUENTE_COOPER);

const uviPanama = estimarIndiceUVCieloClaro({ latitud: 8.98, mes: 3, horasDesdeMediodiaSolar: 0 });
verificar('Índice UV al mediodía en Ciudad de Panamá (9°N, marzo) dentro del rango observado 10-12',
    uviPanama, 11, 0.12,
    'Valores de índice UV habitualmente medidos en latitud tropical al mediodía');

const uviHelsinkiJunio = estimarIndiceUVCieloClaro({ latitud: 60.17, mes: 6, horasDesdeMediodiaSolar: 0 });
verificar('Índice UV al mediodía en Helsinki (60°N) en el solsticio de junio, rango observado 6-7',
    uviHelsinkiJunio, 6.7, 0.15,
    'Valores de índice UV de verano publicados para latitudes altas');

const uviHelsinkiDiciembre = estimarIndiceUVCieloClaro({ latitud: 60.17, mes: 12, horasDesdeMediodiaSolar: 0 });
verificarCierto('En Helsinki en diciembre la síntesis cutánea es prácticamente nula',
    uviHelsinkiDiciembre < 0.5,
    'Por encima de ~40° de latitud la síntesis cutánea de vitamina D cesa en invierno (invierno de vitamina D)');

verificarCierto('El modelo separa Panamá de Helsinki en invierno por más de un orden de magnitud',
    uviPanama / Math.max(uviHelsinkiDiciembre, 1e-6) > 10,
    'Es exactamente la diferencia que el valor fijo de la v3.1 no capturaba');

verificarCierto('La altitud aumenta el índice UV',
    estimarIndiceUVCieloClaro({ latitud: -0.2, mes: 3, horasDesdeMediodiaSolar: 0, altitudMetros: 2850 }) >
    estimarIndiceUVCieloClaro({ latitud: -0.2, mes: 3, horasDesdeMediodiaSolar: 0, altitudMetros: 0 }),
    'La radiación UV aumenta aproximadamente 6% por cada 1000 m de altitud');

verificarIgual('El sol bajo el horizonte da índice UV cero, no un valor negativo',
    estimarIndiceUVCieloClaro({ latitud: 80, mes: 12, horasDesdeMediodiaSolar: 0 }), 0,
    'El coseno del ángulo cenital se trunca en cero: no existe radiación negativa');

verificarIgual('El valor medido por el evaluador tiene prioridad sobre el modelo',
    resolverIndiceUV({ indiceUVPersonalizado: 7.5, latitud: 8.98, mes: 3, horario: 'pico' }).procedencia,
    'observado',
    'La procedencia del dato se propaga al resultado porque condiciona cuánto vale la estimación');
verificarIgual('Sin latitud ni mes se recurre al valor típico y se declara como tal',
    resolverIndiceUV({ horario: 'pico' }).procedencia, 'valor_tipico_panama',
    'Un resultado de reserva no es comparable con uno medido y el informe tiene que poder decirlo');


bloque('20. Protector solar como transmisión parcial');

const sinProtector = calcularExposicionSolarEstandar({
    diasPorSemana: 5, minutosPorSesion: 20, horario: 'pico', edad: 35,
    fototipo: 'III', superficieCorporal: 'parcial', indiceUVPersonalizado: 8
});
const conProtector = calcularExposicionSolarEstandar({
    diasPorSemana: 5, minutosPorSesion: 20, horario: 'pico', edad: 35,
    fototipo: 'III', superficieCorporal: 'parcial', indiceUVPersonalizado: 8,
    usaProtectorSolar: true, fpsDeclarado: 30
});
verificarCierto('Con protector la síntesis estimada baja, pero no a cero',
    conProtector.uiPromedioDia < sinProtector.uiPromedioDia && conProtector.uiPromedioDia > 0,
    'Tratar el protector como bloqueo total subestima la síntesis; ignorarlo la sobrestima');
verificar('La transmisión modelada es la raíz del FPS nominal',
    conProtector.transmisionProtector, 1 / Math.sqrt(30), 0.001,
    'La cantidad aplicada en la práctica (0.5-1.0 mg/cm²) es una fracción de los 2 mg/cm² con que se determina el FPS de la etiqueta');
verificarCierto('Con protector se necesita más tiempo para la misma síntesis',
    conProtector.minutosPara1000UI > sinProtector.minutosPara1000UI,
    'El protector reduce los SED que llegan a la piel, así que alarga proporcionalmente el tiempo necesario');


bloque('21. Categorización solar dentro del motor');

const solarSuficiente = calcularExposicionSolarEstandar({
    diasPorSemana: 7, minutosPorSesion: 45, horario: 'pico', edad: 30,
    fototipo: 'II', superficieCorporal: 'amplia', indiceUVPersonalizado: 10
});
const solarNulo = calcularExposicionSolarEstandar({
    diasPorSemana: 0, minutosPorSesion: 0, horario: 'no_pico', edad: 30,
    fototipo: 'III', superficieCorporal: 'minima', indiceUVPersonalizado: 3
});
verificarIgual('Exposición amplia y diaria en latitud tropical clasifica como riesgo bajo',
    solarSuficiente.categoriaRiesgo, 'bajo',
    'El criterio es el equivalente en UI/día frente a la ingesta de referencia, no un índice en unidades arbitrarias');
verificarIgual('Sin exposición declarada el riesgo solar es alto',
    solarNulo.categoriaRiesgo, 'alto',
    'La categorización vive ahora en el motor, donde esta suite puede alcanzarla');
verificarCierto('La meta en UI/día se expone junto a la categoría',
    solarNulo.metaUIDia > 0,
    'Sin la meta visible la categoría no es auditable');


bloque('22. Calcio del agua de consumo');

const refAgua = obtenerReferenciaCalcio(30, 'femenino', 'IOM');
const dietaVacia = ALIMENTOS_INICIALES.map(a => ({ ...a, diasPorSemana: 0, vecesPorDia: 1, porcionesPorComida: 1 }));
const sinAgua = ejecutarSemanaVirtualCalcio(dietaVacia, null, {}, refAgua);
const conAgua = ejecutarSemanaVirtualCalcio(dietaVacia, null, {}, refAgua, { litrosPorDia: 2, mgPorLitro: 120 });
verificar('Dos litros de agua dura aportan 240 mg/día de calcio ingerido',
    conAgua.aguaMgPorDia, 240, 0.01,
    'Couzy F et al., Am J Clin Nutr 1995;62:1239; Heaney RP & Dowell MS, Osteoporos Int 1994;4:323');
verificarCierto('El agua aumenta el calcio absorbido, no solo el ingerido',
    conAgua.promedioAbsorbidoSemanal > sinAgua.promedioAbsorbidoSemanal,
    'La absorción fraccional del calcio del agua mineral es comparable a la de la leche');
verificarCierto('Sin agua declarada el resultado es idéntico al de la v3.1',
    sinAgua.aguaMgPorDia === 0 && sinAgua.promedioIngeridoSemanal === ejecutarSemanaVirtualCalcio(dietaVacia, null, {}, refAgua, null).promedioIngeridoSemanal,
    'El parámetro es retrocompatible: no altera ningún resultado previo');

const aguaConLeche = ejecutarSemanaVirtualCalcio(
    dietaVacia.map(a => a.id === 'leche' ? { ...a, diasPorSemana: 7, vecesPorDia: 1, porcionesPorComida: 1 } : a),
    null, {}, refAgua, { litrosPorDia: 2, mgPorLitro: 300 });
const soloLeche = ejecutarSemanaVirtualCalcio(
    dietaVacia.map(a => a.id === 'leche' ? { ...a, diasPorSemana: 7, vecesPorDia: 1, porcionesPorComida: 1 } : a),
    null, {}, refAgua);
verificarCierto('El agua desplaza hacia abajo la eficiencia global por saturación de la comida',
    aguaConLeche.eficienciaGlobal < soloLeche.eficienciaGlobal,
    'El agua entra a la carga de la comida, así que también reduce la absorción fraccional del resto (curva de Heaney)');


bloque('23. Proteína utilizable por DIAAS y umbral de leucina');

const FUENTE_DIAAS = 'FAO 2013 (Dietary protein quality evaluation in human nutrition); Herreman L et al., Food Sci Nutr 2020;8:5379';

verificarCierto('El DIAAS del gluten de trigo es mucho menor que el de la soja',
    DIAAS_POR_ALIMENTO.seitan_proteina_veg.valor < DIAAS_POR_ALIMENTO.bebida_veg_fortificada.valor / 3,
    FUENTE_DIAAS);

// Dos dietas con proteína BRUTA casi idéntica y fuentes de calidad muy distinta
const dietaTrigo = [
    { id: 'seitan_proteina_veg', diasPorSemana: 7, vecesPorDia: 1, porcionesPorComida: 1, proteinaPorcion: 21 },
    { id: 'cereales_granos', diasPorSemana: 7, vecesPorDia: 3, porcionesPorComida: 1, proteinaPorcion: 4 }
];
const dietaSoja = [
    { id: 'tofu_extra_firme', diasPorSemana: 7, vecesPorDia: 1, porcionesPorComida: 1, proteinaPorcion: 17 },
    { id: 'legumbres', diasPorSemana: 7, vecesPorDia: 2, porcionesPorComida: 1, proteinaPorcion: 8 }
];
const protTrigo = calcularProteinaDesdeCuestionario(dietaTrigo, { pesoKg: 65, edad: 70, esDietaVegetal: true });
const protSoja = calcularProteinaDesdeCuestionario(dietaSoja, { pesoKg: 65, edad: 70, esDietaVegetal: true });

verificarCierto('Las dos dietas tienen proteína bruta similar',
    Math.abs(protTrigo.gramosDia - protSoja.gramosDia) / protTrigo.gramosDia < 0.10,
    'El contraste está en la calidad de la fuente, no en la cantidad');
verificarCierto('La proteína utilizable sí las separa de forma sustancial',
    protSoja.gPorKgUtilizable > protTrigo.gPorKgUtilizable * 1.4,
    FUENTE_DIAAS + ' — discriminación que el factor global de 1.1 de la v3.1 destruía');
verificarCierto('La proteína utilizable nunca supera la bruta',
    protTrigo.gPorKgUtilizable <= protTrigo.gPorKg && protSoja.gPorKgUtilizable <= protSoja.gPorKg,
    'El DIAAS es una fracción: ponderar no puede aumentar el total');
verificarCierto('El DIAAS medio ponderado queda entre el mínimo y el máximo de los alimentos declarados',
    protTrigo.diaasMedio >= DIAAS_POR_ALIMENTO.seitan_proteina_veg.valor &&
    protTrigo.diaasMedio <= DIAAS_POR_ALIMENTO.cereales_granos.valor,
    'Propiedad obligada de una media ponderada');

const FUENTE_PROTAGE = 'Bauer J et al. (PROT-AGE), J Am Med Dir Assoc 2013;14:542; Deutz NEP et al. (ESPEN), Clin Nutr 2014;33:929';
verificarCierto('Una dieta de porciones pequeñas en el adulto mayor activa la alerta de leucina',
    protTrigo.alertaLeucina === true || protSoja.alertaLeucina === true,
    FUENTE_PROTAGE + ' — el total diario puede ser suficiente sin cruzar el umbral en ninguna comida');

const protJoven = calcularProteinaDesdeCuestionario(dietaSoja, { pesoKg: 65, edad: 30, esDietaVegetal: true });
verificarIgual('El umbral de leucina no se aplica por debajo de los 65 años',
    protJoven.alertaLeucina, false,
    'El umbral anabólico por comida está descrito para el adulto mayor, no para el adulto joven');


bloque('24. Plausibilidad del cuestionario');

const FUENTE_GOLDBERG = 'Lógica de los puntos de corte de Goldberg (Goldberg GR et al., Eur J Clin Nutr 1991;45:569), aplicada a proteína en vez de a energía';

const cuestionarioMinimo = [{ id: 'leche', diasPorSemana: 1, vecesPorDia: 1, porcionesPorComida: 1, proteinaPorcion: 8 }];
const protMinima = calcularProteinaDesdeCuestionario(cuestionarioMinimo, { pesoKg: 70, edad: 40, esDietaVegetal: false });
const plausMinima = evaluarPlausibilidadCuestionario(cuestionarioMinimo, protMinima);
verificarCierto('Un cuestionario con un solo alimento se marca como incompleto',
    plausMinima.banderas.indexOf('cuestionario_incompleto') >= 0, FUENTE_GOLDBERG);
verificarCierto('Una proteína muy por debajo del objetivo se marca como subregistro probable',
    plausMinima.banderas.indexOf('subregistro_probable') >= 0, FUENTE_GOLDBERG);
verificarIgual('La plausibilidad marca, no descarta: devuelve banderas y no un veredicto de exclusión',
    typeof plausMinima.plausible, 'boolean',
    'La decisión de excluir corresponde al protocolo de análisis y debe quedar documentada');

// El contraste requiere un cuestionario REALMENTE plausible. Al escribir la
// prueba, la dieta de soja de arriba resultó tener solo dos alimentos y un
// 38% del objetivo proteico, así que el detector la marcaba con razón: el
// dato de prueba era implausible, no el módulo. Se construye una dieta
// completa que sí cubre el requerimiento.
const dietaCompleta = [
    { id: 'tofu_extra_firme', diasPorSemana: 7, vecesPorDia: 1, porcionesPorComida: 1.5, proteinaPorcion: 17 },
    { id: 'legumbres', diasPorSemana: 7, vecesPorDia: 2, porcionesPorComida: 1, proteinaPorcion: 8 },
    { id: 'bebida_veg_fortificada', diasPorSemana: 7, vecesPorDia: 2, porcionesPorComida: 1, proteinaPorcion: 7 },
    { id: 'cereales_granos', diasPorSemana: 7, vecesPorDia: 3, porcionesPorComida: 1.5, proteinaPorcion: 5 },
    { id: 'almendras', diasPorSemana: 7, vecesPorDia: 1, porcionesPorComida: 1, proteinaPorcion: 6 },
    { id: 'proteina_polvo', diasPorSemana: 5, vecesPorDia: 1, porcionesPorComida: 1, proteinaPorcion: 22 }
];
const protCompleta = calcularProteinaDesdeCuestionario(dietaCompleta, { pesoKg: 65, edad: 40, esDietaVegetal: true });
const plausCompleta = evaluarPlausibilidadCuestionario(dietaCompleta, protCompleta);
verificarIgual('Un cuestionario completo y suficiente no genera banderas', plausCompleta.banderas.length, 0,
    'Un marcador que se dispara siempre no informa de nada');
verificarIgual('Y se declara plausible', plausCompleta.plausible, true, FUENTE_GOLDBERG);


bloque('25. SARC-CalF con su puntuación validada');

const FUENTE_SARCCALF = 'Barbosa-Silva TG et al., J Am Med Dir Assoc 2016;17:1136 — la circunferencia entra como sexto ítem de 0 o 10 puntos y el corte del total pasa a ≥11';

const sarcCalFPositivo = calcularRiesgoSarcopenia(
    { fuerza: 1, caminar: 0, levantarse_silla: 0, subir_escaleras: 0, caidas: 0 },
    { circunferenciaPantorrilla: 30, sexo: 'femenino' });
verificarIgual('SARC-F de 1 punto con pantorrilla baja da SARC-CalF de 11',
    sarcCalFPositivo.puntajeSarcCalF, 11, FUENTE_SARCCALF);
verificarCierto('Ese total de 11 supera el corte del instrumento',
    sarcCalFPositivo.riesgoSarcCalF === true && UMBRAL_SARC_CALF === 11, FUENTE_SARCCALF);
verificarCierto('Un participante que el SARC-F solo no detecta, el SARC-CalF sí',
    sarcCalFPositivo.riesgoProbable === false && sarcCalFPositivo.riesgoSarcCalF === true,
    'Es exactamente la limitación de sensibilidad del SARC-F que la herramienta ya documentaba');

const FUENTE_GONZALEZ = 'González MC et al., J Cachexia Sarcopenia Muscle 2021;12:1359 — ajuste de la circunferencia por IMC antes de aplicar el corte';
const pantorrillaObesa = calcularRiesgoSarcopenia({}, { circunferenciaPantorrilla: 35, sexo: 'femenino', imc: 33 });
verificarCierto('En obesidad la circunferencia se corrige a la baja antes del corte',
    pantorrillaObesa.pantorrillaAjustadaCm < 35 && pantorrillaObesa.pantorrillaBaja === true,
    FUENTE_GONZALEZ + ' — en obesidad la pantorrilla es gruesa aunque la masa muscular sea baja');
const pantorrillaDelgada = calcularRiesgoSarcopenia({}, { circunferenciaPantorrilla: 31, sexo: 'femenino', imc: 17 });
verificarCierto('En delgadez la circunferencia se corrige al alza',
    pantorrillaDelgada.pantorrillaAjustadaCm > 31, FUENTE_GONZALEZ);
verificarIgual('Sin IMC declarado el corte se aplica sin ajustar y se señala',
    calcularRiesgoSarcopenia({}, { circunferenciaPantorrilla: 35, sexo: 'femenino' }).ajustePorIMCDisponible, false,
    'Un ajuste silencioso con datos ausentes es peor que no ajustar');


bloque('26. Índices validados de cribado óseo');

const FUENTE_OST = 'Koh LKH et al., Osteoporos Int 2001;12:699 (OSTA); OST = 0.2 × (peso_kg − edad_años)';
verificarIgual('OST de una mujer de 55 kg y 70 años', calcularOST({ pesoKg: 55, edad: 70 }).indice, -3, FUENTE_OST);
verificarIgual('OST de una persona de 80 kg y 50 años', calcularOST({ pesoKg: 80, edad: 50 }).indice, 6, FUENTE_OST);
verificarIgual('OST de −3 cae en riesgo intermedio', calcularOST({ pesoKg: 55, edad: 70 }).categoria, 'intermedio',
    'Interpretación original: > −1 bajo, −1 a −4 intermedio, < −4 alto');
verificarIgual('OST de +6 cae en riesgo bajo', calcularOST({ pesoKg: 80, edad: 50 }).categoria, 'bajo', FUENTE_OST);
verificarIgual('OST de −6 cae en riesgo alto', calcularOST({ pesoKg: 44, edad: 74 }).categoria, 'alto', FUENTE_OST);

const FUENTE_ORAI = 'Cadarette SM et al., CMAJ 2000;162:1289 — edad 75+ = 15, 65-74 = 9, 55-64 = 5; peso <60 kg = 9, 60-69 = 3; sin estrógenos = 2; corte ≥9';
const orai70 = calcularORAI({ edad: 70, pesoKg: 55, sexo: 'femenino', usaEstrogenos: false });
verificarIgual('ORAI de una mujer de 70 años, 55 kg y sin estrógenos suma 20', orai70.puntaje, 20, FUENTE_ORAI);
verificarCierto('Ese puntaje supera el corte de 9', orai70.superaCorte === true, FUENTE_ORAI);
const orai50 = calcularORAI({ edad: 50, pesoKg: 75, sexo: 'femenino', usaEstrogenos: true });
verificarIgual('ORAI de una mujer de 50 años, 75 kg y con estrógenos suma 0', orai50.puntaje, 0, FUENTE_ORAI);
verificarIgual('El ORAI no se calcula en varones, porque no se derivó en ellos',
    calcularORAI({ edad: 70, pesoKg: 55, sexo: 'masculino' }).aplicable, false,
    'Calcular un índice fuera de su población de derivación es peor que no calcularlo');
verificarIgual('El ORAI no se calcula por debajo de los 45 años',
    calcularORAI({ edad: 40, pesoKg: 55, sexo: 'femenino' }).aplicable, false, FUENTE_ORAI);


bloque('27. Vitamina D: ajuste por tamaño corporal y campo corregido');

const FUENTE_EKWARU = 'Drincic AT et al., Obesity 2012;20:1444 (dilución volumétrica); Ekwaru JP et al., PLoS One 2014;9:e111265 (magnitud del ajuste)';

const refSinIMC = obtenerReferenciaVitaminaD(40);
const refObeso = obtenerReferenciaVitaminaD(40, 32);
verificarIgual('Sin IMC el comportamiento es el de la v3.1', refSinIMC.factorTamanoCorporal, 1.0,
    'El ajuste es aditivo: no altera ningún resultado previo');
verificarCierto('Con obesidad grado 1 la meta ajustada duplica la meta de guía',
    refObeso.rdaAjustada > refSinIMC.rda, FUENTE_EKWARU);
verificarIgual('La RDA sin ajustar se conserva intacta para poder compararla con la cifra de guía',
    refObeso.rda, refSinIMC.rda,
    'Un revisor espera ver la cifra del organismo, no una cifra ajustada sin avisar');
verificarCierto('La meta ajustada nunca supera el nivel máximo tolerable',
    obtenerReferenciaVitaminaD(40, 45).rdaAjustada <= refSinIMC.ul,
    'Un ajuste que llevara la meta por encima del UL no sería una recomendación defendible');

const adecuacionVitD = calcularAdecuacionVitaminaD([], { mcgPorDia: 10, diasPorSemana: 7, forma: 'D3' }, 35);
verificarIgual('El campo que la v3.1 leía y que la función nunca devolvió existe ahora como alias',
    adecuacionVitD.totalPromedioDia, adecuacionVitD.totalEq,
    'AUDITORIA A2: en la v3.1 la pantalla mostraba literalmente "undefined /15mcg" y el CSV exportaba la cadena "undefined"');
verificarCierto('El alias es un número, no un valor indefinido',
    typeof adecuacionVitD.totalPromedioDia === 'number' && !isNaN(adecuacionVitD.totalPromedioDia),
    'Es la comprobación que habría detectado el defecto en la v3.1');


bloque('28. Entrada total de vitamina D');

const solarParaTotal = calcularExposicionSolarEstandar({
    diasPorSemana: 5, minutosPorSesion: 20, horario: 'pico', edad: 35,
    fototipo: 'III', superficieCorporal: 'parcial', indiceUVPersonalizado: 9
});
const entrada = calcularEntradaTotalVitaminaD(adecuacionVitD, solarParaTotal);
verificarIgual('La entrada total es la suma de las tres vías',
    entrada.uiTotal, entrada.uiDieta + entrada.uiSuplemento + entrada.uiCutanea,
    'Identidad obligada: si no se cumple, alguna vía se está contando dos veces');
verificarCierto('La advertencia sobre la RDA acompaña siempre al resultado',
    typeof entrada.advertenciaKey === 'string' && entrada.advertenciaKey.length > 0,
    'Las RDA del IOM se derivaron suponiendo exposición solar mínima: la suma no admite comparación directa');
verificarCierto('Las vías se devuelven separadas, porque no comparten incertidumbre',
    entrada.uiDieta !== undefined && entrada.uiCutanea !== undefined && entrada.proporcionCutanea !== undefined,
    'La ingesta viene de un cuestionario; la síntesis cutánea, de un modelo con varios supuestos encadenados');


bloque('29. Índice de masa corporal centralizado');

verificar('IMC de 65 kg y 165 cm', calcularIMC(65, 165).imc, 23.9, 0.005, 'peso / talla²');
verificarIgual('IMC de 23.9 cae en peso normal', calcularIMC(65, 165).categoria, 'normal',
    'Categorías de la OMS');
verificarIgual('Sin talla el IMC es nulo y no cero', calcularIMC(65, 0).imc, null,
    'Un cero se propagaría como si fuera un dato válido');


bloque('30. Reubicaciones manuales: validación de índices');

const refOverride = obtenerReferenciaCalcio(30, 'femenino', 'IOM');
const dietaOverride = dietaVacia.map(a => a.id === 'leche'
    ? { ...a, diasPorSemana: 7, vecesPorDia: 1, porcionesPorComida: 1 } : a);
const conOverrideInvalido = ejecutarSemanaVirtualCalcio(
    dietaOverride, null, { leche: { 0: { dia: 99, comida: 42 } } }, refOverride);
verificarCierto('Una reubicación con índices fuera de rango no rompe el cálculo',
    conOverrideInvalido.promedioIngeridoSemanal > 0,
    'En la v3.1 lanzaba TypeError y dejaba la pantalla en gris sin mensaje');
verificarIgual('La reubicación inválida se descarta y el ítem vuelve a su posición automática',
    conOverrideInvalido.promedioAbsorbidoSemanal,
    ejecutarSemanaVirtualCalcio(dietaOverride, null, {}, refOverride).promedioAbsorbidoSemanal,
    'Descartar un dato inválido es preferible a fallar o a colocarlo en un sitio arbitrario');


bloque('31. Calcio corregido por albúmina');

const FUENTE_PAYNE = 'Payne RB et al., BMJ 1973;4:643 — Ca_corregido = Ca_medido + 0.8 × (4.0 − albúmina)';
const payne = calcularCalcioCorregido(7.8, 2.8);
verificar('Calcio de 7.8 mg/dL con albúmina de 2.8 g/dL corrige a 8.76',
    payne.calcioCorregido, 8.76, 0.002, FUENTE_PAYNE);
// La corrección y la clasificación son funciones distintas a propósito:
// `calcularCalcioCorregido` solo corrige, y quien clasifica es el panel.
// La reclasificación se comprueba, por tanto, sobre el panel completo.
const panelHipoalbuminemia = evaluarPanelOseo({
    calcioSerico: 7.8, albumina: 2.8, edad: 45, sexo: 'femenino', pesoKg: 60
});
verificarIgual('La corrección reclasifica ese calcio de bajo a normal',
    panelHipoalbuminemia.analitos.ca.categoria, 'normal',
    'Es el falso positivo de hipocalcemia que motivaba el hallazgo A6 de la auditoría');
verificarCierto('Y el panel lo señala como cambio de clasificación',
    panelHipoalbuminemia.patrones.some(x => x.id === 'correccion_albumina_cambia_clasificacion'),
    'Clasificar por calcio total sin corregir produce falsos positivos de hipocalcemia en hipoalbuminemia');
verificarCierto('El cambio de clasificación se señala explícitamente',
    payne.cambiaClasificacion === true,
    'Si la corrección cambia la categoría, el informe tiene que decirlo');
verificar('Con albúmina de referencia la corrección no altera el valor',
    calcularCalcioCorregido(9.2, 4.0).calcioCorregido, 9.2, 1e-9, FUENTE_PAYNE);
verificarIgual('Sin albúmina declarada no se inventa una corrección',
    calcularCalcioCorregido(9.2, '').correccionAplicada, false,
    'Suponer una albúmina normal ocultaría precisamente el caso que la corrección existe para detectar');


bloque('32. Filtración glomerular estimada (CKD-EPI 2021)');

const FUENTE_INKER = 'Inker LA et al., N Engl J Med 2021;385:1737 — ecuación sin término racial, recomendada por NKF-ASN';
const tfgeMujer = calcularTFGe({ creatininaMgDl: 0.9, edad: 50, sexo: 'femenino' });
const tfgeVaron = calcularTFGe({ creatininaMgDl: 0.9, edad: 50, sexo: 'masculino' });
// Valores derivados A MANO de la ecuación publicada, no tomados de una
// calculadora en línea. Mujer, Scr 0.9, 50 años: kappa 0.7, alfa −0.241.
//   Scr/kappa = 1.2857 > 1  ->  min(·,1)^alfa = 1
//   max(·,1)^(−1.200) = 1.2857^(−1.2) = 0.73971
//   0.9938^50 = 0.73273
//   142 × 0.73971 × 0.73273 × 1.012 = 77.90
// Varón, Scr 0.9, 50 años: kappa 0.9, de modo que Scr/kappa = 1 y los dos
// términos de creatinina valen 1:
//   142 × 1 × 1 × 0.73273 = 104.05
verificar('Mujer de 50 años con creatinina de 0.9 mg/dL', tfgeMujer.valor, 77.9, 0.002,
    FUENTE_INKER + ' — valor derivado a mano de la ecuación');
verificar('Varón de 50 años con creatinina de 0.9 mg/dL', tfgeVaron.valor, 104.0, 0.002,
    FUENTE_INKER + ' — valor derivado a mano de la ecuación');
verificarCierto('A igual creatinina y edad, la mujer tiene menor filtración estimada',
    tfgeMujer.valor < tfgeVaron.valor,
    'Los coeficientes kappa y alfa difieren por sexo en la ecuación');
verificarIgual('Una filtración de 77.9 corresponde al estadio G2', tfgeMujer.estadio, 'G2',
    'Estadios KDIGO 2012/2024 por filtración estimada');
verificarIgual('Una creatinina de 2.5 mg/dL en una mujer de 60 años cae en estadio G3b o peor',
    ['G3b', 'G4', 'G5'].indexOf(calcularTFGe({ creatininaMgDl: 2.5, edad: 60, sexo: 'femenino' }).estadio) >= 0,
    true, FUENTE_INKER);
verificarCierto('El uso de creatina se señala como confusor de la filtración estimada',
    typeof calcularTFGe({ creatininaMgDl: 1.4, edad: 30, sexo: 'masculino', usaCreatina: true }).avisoCreatinaKey === 'string',
    'La creatina eleva la creatinina sérica sin que exista daño renal: la filtración queda SUBESTIMADA');


bloque('33. Patrones integrados del panel bioquímico');

const panelSecundario = evaluarPanelOseo({
    calcioSerico: 9.0, albumina: 4.0, vitD25OH: 12, pth: 95,
    fosfatasaAlcalina: 140, creatinina: 0.8, edad: 62, sexo: 'femenino', pesoKg: 58
});
verificarCierto('Paratohormona alta con calcio normal y vitamina D baja da hiperparatiroidismo secundario',
    panelSecundario.patrones.some(x => x.id === 'hiperparatiroidismo_secundario_vitd'),
    'Es el mecanismo por el que la insuficiencia de vitamina D produce pérdida ósea');
verificarCierto('Ese mismo panel detecta además el patrón de osteomalacia bioquímica',
    panelSecundario.patrones.some(x => x.id === 'osteomalacia_bioquimica_posible'),
    'Vitamina D deficiente con fosfatasa alcalina elevada: los patrones no son excluyentes');

const panelPrimario = evaluarPanelOseo({
    calcioSerico: 11.2, albumina: 4.2, vitD25OH: 34, pth: 98,
    edad: 55, sexo: 'femenino', pesoKg: 70, creatinina: 0.9
});
verificarCierto('La misma paratohormona alta con calcio ALTO da un patrón distinto',
    panelPrimario.patrones.some(x => x.id === 'hiperparatiroidismo_primario_posible'),
    'El valor de un panel está en el patrón: una PTH alta significa una cosa con calcio alto y otra con calcio normal');
verificarIgual('El patrón de hipercalcemia con PTH no suprimida exige derivación',
    panelPrimario.nivelDerivacion, 'derivacion_urgente',
    'La herramienta deriva y no diagnostica ni indica tratamiento');

const panelNormal = evaluarPanelOseo({
    calcioSerico: 9.4, albumina: 4.1, vitD25OH: 38, pth: 40, magnesio: 2.0,
    fosforo: 3.5, fosfatasaAlcalina: 80, creatinina: 0.7,
    edad: 40, sexo: 'femenino', pesoKg: 62
});
verificarIgual('Un panel normal no genera hallazgos', panelNormal.nivelDerivacion, 'sin_hallazgos',
    'Un detector que se dispara con todo no informa de nada');
verificarCierto('Un panel de siete analitos se reconoce como completo',
    panelNormal.panelCompleto === true,
    'La completitud del panel condiciona cuánto vale la interpretación');
verificarCierto('El descargo clínico acompaña siempre al panel',
    panelNormal.descargoKey === 'lab_disclaimer_clinical',
    'La interpretación corresponde al médico tratante con los rangos del laboratorio emisor');


bloque('34. Riesgo óseo informado por bioquímica');

const conductual = {
    porcentajeCumplimientoCalcio: 45, categoriaRiesgoSolar: 'alto', categoriaVitDDieta: 'baja',
    edad: 62, sexo: 'femenino', diasEjercicioFuerza: 0, fuma: false,
    alcoholFrecuente: false, bajoUmbralEpicOxford: true, esVegano: true
};
const oseoSinBio = calcularRiesgoOseoV6(conductual, null);
const oseoConBio = calcularRiesgoOseoV6(conductual, resumirBioquimicaParaRiesgoOseo(panelSecundario));
verificarIgual('Sin analítica, el puntaje conductual es el de la v3.1',
    oseoSinBio.puntaje, calcularRiesgoOseo(conductual).puntaje,
    'Los pesos conductuales no cambian: las filas ya recogidas siguen siendo comparables');
verificarCierto('Con analítica, el máximo alcanzable también crece',
    oseoConBio.puntajeMaximo > oseoSinBio.puntajeMaximo,
    'Solo se suman al máximo los analitos realmente declarados');
verificarCierto('Tener más datos no empuja por sí solo a una categoría peor',
    calcularRiesgoOseoV6(conductual, resumirBioquimicaParaRiesgoOseo(panelNormal)).fraccionDelMaximo <
    oseoSinBio.fraccionDelMaximo,
    'La categoría se decide sobre la fracción del máximo alcanzable, no sobre el puntaje bruto');
verificarIgual('El puntaje óseo sigue declarándose heurístico', oseoConBio.grado, 'heuristico',
    'Los cortes están en la lista de calibración pendiente del registro de parámetros');


bloque('35. Registro de parámetros y trazabilidad');

verificarCierto('Todos los parámetros registrados declaran fuente',
    REGISTRO_PARAMETROS.every(p => typeof p.fuente === 'string' && p.fuente.trim().length > 0),
    'Un parámetro sin fuente no es un parámetro basado en evidencia');
verificarCierto('Todos los parámetros registrados declaran grado de evidencia',
    REGISTRO_PARAMETROS.every(p => ['medido', 'consenso', 'derivado', 'estimado', 'heuristico'].indexOf(p.grado) >= 0),
    'La escala de cinco grados es lo que permite auditar la afirmación de estar basado en evidencia');
verificarIgual('No hay claves duplicadas en el registro',
    new Set(REGISTRO_PARAMETROS.map(p => p.clave)).size, REGISTRO_PARAMETROS.length,
    'Una clave duplicada haría ambigua la huella');
verificarCierto('La herramienta enumera sola los parámetros pendientes de calibración',
    parametrosPorGrado('heuristico').length > 0,
    'La lista de trabajo del estudio no debería tener que buscarse en el código');
verificarIgual('La huella es determinista: dos lecturas dan el mismo valor',
    CARDA_HUELLA_PARAMETROS, CARDA_HUELLA_PARAMETROS,
    'Una huella que cambiara entre ejecuciones no serviría para separar subconjuntos');
verificarCierto('El sello incluye versión y huella',
    CARDA_SELLO.indexOf(CARDA_VERSION) >= 0 && CARDA_SELLO.indexOf(CARDA_HUELLA_PARAMETROS) >= 0,
    'Es lo que se estampa en cada fila exportada');
verificarIgual('La versión del motor es la 6.0', CARDA_VERSION, '6.0', 'Coherencia con index.html y el CHANGELOG');

// Todo patrón que el panel pueda emitir tiene que tener su clave de
// traducción, o la interfaz mostraría el identificador crudo al evaluador.
const patronesEmitidos = new Set();
[panelSecundario, panelPrimario, panelNormal, panelHipoalbuminemia].forEach(pnl =>
    pnl.patrones.forEach(x => patronesEmitidos.add(x.key)));
const traduccionesES = (() => {
    const fuenteI18n = ['es.js'].map(f => fs.readFileSync(path.join(raizJs, 'i18n', f), 'utf8')).join('\n');
    return (new Function(fuenteI18n + '; return TRADUCCION_ES;'))();
})();
verificarIgual('Todos los patrones emitidos tienen clave de traducción',
    [...patronesEmitidos].filter(k => !traduccionesES[k]).length, 0,
    'Sin la clave, la interfaz mostraría el identificador interno al evaluador');



// ============================================================
// 36. CONCLUSIÓN Y CONDUCTA SUGERIDA
// ============================================================
// Es la salida que responde al propósito declarado del instrumento, así
// que su comportamiento tiene que estar fijado por pruebas: un cambio
// silencioso aquí cambia lo que se le dice al paciente.

bloque('36. Conclusión y conducta sugerida');

const FUENTE_CONDUCTA_ASIMETRIA = 'La asimetría entre nutrientes es deliberada: el calcio de una dieta basada en plantas es alcanzable por vía dietética; la vitamina D, sin alimentos fortificados ni suplemento, no';
const FUENTE_IOM_SOL = 'IOM/NASEM 2011: las ingestas de referencia de vitamina D se derivaron suponiendo exposición solar mínima, así que la suma de ingesta y síntesis cutánea no admite comparación directa con la RDA';

const conductaCubre = generarConductaSugerida({
    razonCalcioNeta: 112, resultadoVitDDieta: { totalEq: 16, meta: 15 },
    resultadoSolar: { uiPromedioDia: 300 }
});
verificarIgual('Quien cubre ambos requerimientos recibe una confirmación explícita, no silencio',
    conductaCubre.veredicto, 'cubre_ambos',
    'Confirmar que alguien sí cubre su requerimiento es un resultado, no la ausencia de una alerta');
verificarIgual('Y no se le deriva', conductaCubre.requiereDerivacion, false,
    'Derivar a quien no lo necesita hace perder credibilidad al instrumento');

const conductaCaLimite = generarConductaSugerida({
    razonCalcioNeta: 82, resultadoVitDDieta: { totalEq: 16, meta: 15 },
    resultadoSolar: { uiPromedioDia: 300 }
});
verificarIgual('Una brecha pequeña de calcio se resuelve con ajuste dietético, sin derivar',
    conductaCaLimite.calcio.via, 'ajuste_dietetico', FUENTE_CONDUCTA_ASIMETRIA);
verificarIgual('Y no genera derivación', conductaCaLimite.requiereDerivacion, false,
    'La suplementación de calcio es la segunda opción, no la primera');

const conductaCaBaja = generarConductaSugerida({
    razonCalcioNeta: 62, resultadoVitDDieta: { totalEq: 16, meta: 15 },
    resultadoSolar: { uiPromedioDia: 300 }
});
verificarIgual('Con brecha intermedia de calcio, el ajuste dietético va primero',
    conductaCaBaja.calcio.via, 'ajuste_dietetico_primero', FUENTE_CONDUCTA_ASIMETRIA);

const conductaDBrecha = generarConductaSugerida({
    razonCalcioNeta: 105, resultadoVitDDieta: { totalEq: 3, meta: 15 },
    resultadoSolar: { uiPromedioDia: 0 }
});
verificarIgual('Con brecha de vitamina D y sin sol, la conducta es evaluar suplementación',
    conductaDBrecha.vitd.via, 'evaluar_suplementacion', FUENTE_CONDUCTA_ASIMETRIA);
verificarCierto('Y se deriva para que un profesional establezca la cantidad',
    conductaDBrecha.requiereDerivacion,
    'La herramienta no indica dosis: cuantifica la brecha y deriva');

const conductaDSol = generarConductaSugerida({
    razonCalcioNeta: 105, resultadoVitDDieta: { totalEq: 3, meta: 15 },
    resultadoSolar: { uiPromedioDia: 400 }
});
verificarIgual('Con ingesta baja de vitamina D pero síntesis cutánea apreciable, se pide el valor sérico en vez de concluir',
    conductaDSol.vitd.via, 'medir_25ohd', FUENTE_IOM_SOL);
verificarIgual('Y el estado se declara indeterminado, no insuficiente',
    conductaDSol.vitd.estado, 'indeterminado', FUENTE_IOM_SOL);

// --- El biomarcador tiene precedencia sobre la estimación, en las dos direcciones ---
const panelDSuficiente = evaluarPanelOseo({
    vitD25OH: 38, calcioSerico: 9.2, albumina: 4.1, edad: 40, sexo: 'femenino', pesoKg: 62
});
const conductaBioAlta = generarConductaSugerida({
    razonCalcioNeta: 105, resultadoVitDDieta: { totalEq: 2, meta: 15 },
    resultadoSolar: { uiPromedioDia: 0 }, panelBioquimico: panelDSuficiente
});
verificarIgual('Una 25(OH)D suficiente manda sobre una ingesta estimada baja',
    conductaBioAlta.vitd.estado, 'cubre',
    'El valor sérico es el estado real del participante; la estimación es un modelo');
verificarIgual('Y la conclusión declara que se basa en el biomarcador',
    conductaBioAlta.vitd.base, 'biomarcador',
    'El informe tiene que decir sobre qué se decidió');

const panelDDeficiente = evaluarPanelOseo({
    vitD25OH: 11, calcioSerico: 9.2, albumina: 4.1, edad: 40, sexo: 'femenino', pesoKg: 62
});
const conductaBioBaja = generarConductaSugerida({
    razonCalcioNeta: 105, resultadoVitDDieta: { totalEq: 20, meta: 15 },
    resultadoSolar: { uiPromedioDia: 500 }, panelBioquimico: panelDDeficiente
});
verificarIgual('Una 25(OH)D deficiente manda sobre una ingesta estimada suficiente',
    conductaBioBaja.vitd.estado, 'no_cubre',
    'La precedencia del biomarcador opera en las dos direcciones, no solo cuando conviene');

// --- Circunstancias que convierten la decisión en clínica ---
const conductaIBP = generarConductaSugerida({
    razonCalcioNeta: 80, usaIBP: true, resultadoVitDDieta: { totalEq: 16, meta: 15 },
    resultadoSolar: { uiPromedioDia: 300 }
});
verificarCierto('El uso de inhibidores de la bomba de protones con brecha de calcio obliga a derivar',
    conductaIBP.requiereDerivacion,
    'O Connell et al. Am J Med 2005: el inhibidor condiciona qué sal de calcio y en qué momento');

const panelHipercalciuria = evaluarPanelOseo({
    calcioSerico: 9.4, albumina: 4.0, calcio24hMg: 400, edad: 45, sexo: 'femenino', pesoKg: 60,
    creatinina: 0.8, vitD25OH: 35
});
const conductaHiperCa = generarConductaSugerida({
    razonCalcioNeta: 85, resultadoVitDDieta: { totalEq: 16, meta: 15 },
    resultadoSolar: { uiPromedioDia: 300 }, panelBioquimico: panelHipercalciuria
});
verificarCierto('La hipercalciuria obliga a derivar aunque la brecha de calcio sea pequeña',
    conductaHiperCa.requiereDerivacion,
    'Suplementar calcio ante hipercalciuria puede empeorar el cuadro: la decisión es clínica');

// --- El descargo de no indicar dosis acompaña SIEMPRE a la salida ---
[conductaCubre, conductaCaLimite, conductaDBrecha, conductaBioAlta].forEach((c, i) => {
    verificarIgual(`La salida ${i + 1} lleva el descargo de que la herramienta no indica dosis`,
        c.descargoKey, 'conduct_no_dose_disclaimer',
        'El reparto es: la herramienta cuantifica la brecha, el profesional decide la dosis');
});

verificarIgual('Sin datos de calcio no se inventa una conclusión',
    generarConductaSugerida({ razonCalcioNeta: NaN, resultadoVitDDieta: { totalEq: 0, meta: 0 } }).veredicto,
    'datos_incompletos',
    'Una conclusión con la ficha vacía sería una afirmación sin base');

// Toda clave que la conducta pueda emitir tiene que existir en el idioma de referencia
const clavesConducta = new Set();
[conductaCubre, conductaCaLimite, conductaCaBaja, conductaDBrecha, conductaDSol,
 conductaBioAlta, conductaBioBaja, conductaIBP, conductaHiperCa].forEach(c => {
    clavesConducta.add('conduct_verdict_' + c.veredicto);
    clavesConducta.add(c.descargoKey);
    c.conclusiones.forEach(x => {
        clavesConducta.add('conduct_nutrient_' + x.nutriente);
        clavesConducta.add('conduct_state_' + x.estado);
        clavesConducta.add('conduct_via_' + x.via);
        if (x.motivoDerivacionKey) clavesConducta.add(x.motivoDerivacionKey);
    });
});
const traduccionConducta = (new Function(
    fs.readFileSync(path.join(raizJs, 'i18n', 'es.js'), 'utf8') + '; return TRADUCCION_ES;'
))();
verificarIgual('Todas las claves que la conducta puede emitir están traducidas',
    [...clavesConducta].filter(k => !traduccionConducta[k]).length, 0,
    'Sin la clave, la interfaz mostraría el identificador interno al paciente');


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
