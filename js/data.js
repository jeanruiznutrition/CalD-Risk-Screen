// ============================================================
// CalD Risk Screen — Datos y constantes del modelo (CARDA v1.0)
// (Calcium & Vitamin D Absorption Risk Algorithm)
// Catálogo de alimentos, constantes fisiológicas, exposición
// solar, cuestionario SARC-F y estructura de la semana virtual.
// No contiene lógica de cálculo.
// ============================================================

// ------------------------------------------------------------
// CONSTANTES FISIOLÓGICAS — Módulo Calcio
// ------------------------------------------------------------
// La absorción activa transcelular de calcio es saturable: por encima
// de ~500 mg en una sola toma, la eficiencia de absorción cae y el
// excedente solo se absorbe por difusión paracelular pasiva. Esto es
// consistente con la evidencia de Heaney et al. sobre biodisponibilidad
// de calcio y es la razón por la que se recomienda fraccionar la ingesta
// de calcio (dieta + suplemento) en varias tomas al día.
const ABSORCION_MAXIMA_ACTIVA_POR_DOSIS = 500;   // mg (techo de saturación por toma)
const EFICIENCIA_ABSORCION_ACTIVA = 0.32;        // 32% de fracción absorbida (transporte activo, vitamina D-dependiente)
const EFICIENCIA_ABSORCION_PASIVA = 0.10;        // 10% de fracción absorbida (difusión paracelular pasiva, no saturable)
const META_ABSORCION_DIARIA_MG = 250;            // mg de calcio absorbido/día (meta fisiológica para balance óseo neto en adultos)
const META_INGESTA_DIARIA_MG = 1000;             // mg de calcio ingerido/día (RDA general adultos 19-50 años)
const META_INGESTA_DIARIA_MG_RIESGO = 1200;      // mg/día para mujeres >50 años u hombres >70 años (mayor requerimiento)

// ------------------------------------------------------------
// CATÁLOGO DE FUENTES DE CALCIO (FFQ)
// ------------------------------------------------------------
const ALIMENTOS_INICIALES = [
    {
        id: 'lacteos',
        nombreKey: 'food_dairy',
        calcioPorcion: 300,
        porcionUnidadKey: 'unit_dairy',
        icono: 'fa-solid fa-glass-water',
        permitePorciones: true,
        maxPorciones: 3,
        ocultoEnVegano: true
    },
    {
        id: 'bebida_veg_fortificada',
        nombreKey: 'food_fortified_plant_drink',
        calcioPorcion: 300,
        porcionUnidadKey: 'unit_plant_drink',
        icono: 'fa-solid fa-seedling',
        permitePorciones: true,
        maxPorciones: 3,
        editableCalcio: true // El contenido de calcio varía según la marca/fabricante
    },
    {
        id: 'tofu_calcico',
        nombreKey: 'food_tofu',
        calcioPorcion: 350,
        porcionUnidadKey: 'unit_tofu',
        icono: 'fa-solid fa-cube',
        permitePorciones: true,
        maxPorciones: 3,
        editableCalcio: true // Depende de si el tofu fue coagulado con sales de calcio
    },
    {
        id: 'vegetales_hoja_verde',
        nombreKey: 'food_leafy_greens',
        calcioPorcion: 180,
        porcionUnidadKey: 'unit_leafy_greens',
        icono: 'fa-solid fa-leaf',
        permitePorciones: true,
        maxPorciones: 3
    },
    {
        id: 'frutos_secos_semillas',
        nombreKey: 'food_nuts_seeds',
        calcioPorcion: 80,
        porcionUnidadKey: 'unit_nuts_seeds',
        icono: 'fa-solid fa-seedling',
        permitePorciones: true,
        maxPorciones: 3
    },
    {
        id: 'pescado_con_espina',
        nombreKey: 'food_bony_fish',
        calcioPorcion: 300,
        porcionUnidadKey: 'unit_bony_fish',
        icono: 'fa-solid fa-fish',
        permitePorciones: true,
        maxPorciones: 2,
        ocultoEnVegano: true,
        ocultoEnOvolacto: true
    },
    {
        id: 'alimento_fortificado_otro',
        nombreKey: 'food_fortified_other',
        calcioPorcion: 250,
        porcionUnidadKey: 'unit_fortified_other',
        icono: 'fa-solid fa-tag',
        permitePorciones: true,
        maxPorciones: 2,
        editableCalcio: true // Cereal, jugo u otro producto fortificado declarado por el usuario
    }
];

const DIAS_SEMANA = [
    { id: 0, shortKey: 'day_0_short', nameKey: 'day_0' },
    { id: 1, shortKey: 'day_1_short', nameKey: 'day_1' },
    { id: 2, fontBold: true, shortKey: 'day_2_short', nameKey: 'day_2' },
    { id: 3, shortKey: 'day_3_short', nameKey: 'day_3' },
    { id: 4, shortKey: 'day_4_short', nameKey: 'day_4' },
    { id: 5, shortKey: 'day_5_short', nameKey: 'day_5' },
    { id: 6, shortKey: 'day_6_short', nameKey: 'day_6' }
];

// ------------------------------------------------------------
// SUPLEMENTACIÓN DE CALCIO — Regímenes predefinidos (mg + frecuencia)
// ------------------------------------------------------------
const REGIMENES_SUPLEMENTO_CALCIO = [
    { id: 'ninguna', dosis: 0, vecesPorDia: 0, diasPorSemana: 0 },
    { id: '500_1x_diario', dosis: 500, vecesPorDia: 1, diasPorSemana: 7 },
    { id: '500_2x_diario', dosis: 500, vecesPorDia: 2, diasPorSemana: 7 },
    { id: '600_1x_diario', dosis: 600, vecesPorDia: 1, diasPorSemana: 7 },
    { id: '1200_1x_diario', dosis: 1200, vecesPorDia: 1, diasPorSemana: 7 } // dosis alta, ilustra la caída de eficiencia por saturación
];

// ------------------------------------------------------------
// CONSTANTES — Módulo Exposición Solar / Índice de Vitamina D
// ------------------------------------------------------------
// Modelo proxy (no mide 25-OH-D sérica real): estima una "carga de
// síntesis cutánea semanal" a partir de días, minutos, franja horaria,
// uso de protector solar y edad (la capacidad de síntesis cutánea de
// vitamina D3 declina con la edad por adelgazamiento epidérmico).
const FACTOR_HORARIO = {
    pico: 1.0,       // 10:00am - 4:00pm (mayor intensidad UVB)
    no_pico: 0.5     // antes de 10am o después de 4pm
};

const FACTOR_EDAD_SINTESIS = {
    menor_50: 1.0,
    entre_50_70: 0.75,
    mayor_70: 0.5
};

const FACTOR_PROTECTOR_SOLAR = {
    si: 0.3,
    no: 1.0
};

const UMBRAL_INDICE_SOLAR_BAJO = 60;    // por debajo de esto: riesgo alto de síntesis insuficiente
const UMBRAL_INDICE_SOLAR_MODERADO = 150; // entre bajo y este valor: riesgo moderado; por encima: riesgo bajo

// Interpretación clínica opcional de 25-OH-vitamina D sérica (ng/mL), si el
// usuario cuenta con el dato de laboratorio real (Opción A del estudio).
const CORTES_25OH_VITAMINA_D = {
    deficiente: 20,   // < 20 ng/mL
    insuficiente: 30  // 20-29 ng/mL; >= 30 ng/mL se considera suficiente
};

// ------------------------------------------------------------
// CUESTIONARIO SARC-F — Tamizaje de riesgo de sarcopenia
// (Malmstrom & Morley, 2013 — herramienta validada, 5 ítems, 0-2 c/u)
// Puntaje total >= 4 = riesgo probable de sarcopenia (sensibilidad
// moderada / alta especificidad reportada en la literatura).
// ------------------------------------------------------------
const PREGUNTAS_SARC_F = [
    {
        id: 'fuerza',
        nombreKey: 'sarcf_strength_q',
        opciones: [
            { valor: 0, key: 'sarcf_strength_opt0' }, // Ninguna dificultad
            { valor: 1, key: 'sarcf_strength_opt1' }, // Alguna dificultad
            { valor: 2, key: 'sarcf_strength_opt2' }  // Mucha dificultad / incapaz
        ]
    },
    {
        id: 'caminar',
        nombreKey: 'sarcf_walking_q',
        opciones: [
            { valor: 0, key: 'sarcf_walking_opt0' },
            { valor: 1, key: 'sarcf_walking_opt1' },
            { valor: 2, key: 'sarcf_walking_opt2' }
        ]
    },
    {
        id: 'levantarse_silla',
        nombreKey: 'sarcf_rise_q',
        opciones: [
            { valor: 0, key: 'sarcf_rise_opt0' },
            { valor: 1, key: 'sarcf_rise_opt1' },
            { valor: 2, key: 'sarcf_rise_opt2' }
        ]
    },
    {
        id: 'subir_escaleras',
        nombreKey: 'sarcf_stairs_q',
        opciones: [
            { valor: 0, key: 'sarcf_stairs_opt0' },
            { valor: 1, key: 'sarcf_stairs_opt1' },
            { valor: 2, key: 'sarcf_stairs_opt2' }
        ]
    },
    {
        id: 'caidas',
        nombreKey: 'sarcf_falls_q',
        opciones: [
            { valor: 0, key: 'sarcf_falls_opt0' }, // Ninguna
            { valor: 1, key: 'sarcf_falls_opt1' }, // 1-3 caídas en el último año
            { valor: 2, key: 'sarcf_falls_opt2' }  // 4 o más caídas
        ]
    }
];

const UMBRAL_SARC_F_RIESGO = 4; // puntaje total >= 4 => riesgo probable de sarcopenia

// ------------------------------------------------------------
// PERFIL — Frecuencia de ejercicio de fuerza (modificador contextual,
// no altera el puntaje SARC-F validado, solo acompaña la recomendación)
// ------------------------------------------------------------
const UMBRAL_EJERCICIO_FUERZA_SEMANAL = 2; // días/semana mínimos recomendados
