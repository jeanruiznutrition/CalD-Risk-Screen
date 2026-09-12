// ============================================================
// CalD Risk Screen — Datos y constantes del modelo (CARDA v1.1)
// Catálogo de alimentos (calcio y vitamina D), constantes
// fisiológicas, exposición solar, fototipo, ejercicio, SARC-F.
// Todas las cifras nutricionales están documentadas y citadas
// en la sección de Bibliografía de la app (ver app.js).
// No contiene lógica de cálculo (ver algorithm.js).
// ============================================================

// ------------------------------------------------------------
// CONSTANTES FISIOLÓGICAS — Módulo Calcio
// ------------------------------------------------------------
// La absorción activa transcelular de calcio es saturable: por encima
// de ~500 mg en una sola toma, la eficiencia de absorción cae y el
// excedente solo se absorbe por difusión paracelular pasiva (NIH ODS
// Calcium Fact Sheet; Heaney et al.). Por esto se recomienda fraccionar
// el calcio (dieta + suplemento) en varias tomas al día.
const ABSORCION_MAXIMA_ACTIVA_POR_DOSIS = 500;   // mg (techo de saturación por toma)
const EFICIENCIA_ABSORCION_ACTIVA = 0.32;        // 32% fracción absorbida (transporte activo, dieta y calcio carbonato)
const EFICIENCIA_ABSORCION_PASIVA = 0.10;        // 10% fracción absorbida (difusión paracelular pasiva, no saturable)
const META_ABSORCION_DIARIA_MG = 250;            // mg de calcio absorbido/día (meta fisiológica orientativa para balance óseo neto)
const META_INGESTA_DIARIA_MG = 1000;             // mg de calcio ingerido/día (RDA general adultos 19-50 años, NIH ODS)
const META_INGESTA_DIARIA_MG_RIESGO = 1200;      // mg/día mujeres >50 años u hombres >70 años (NIH ODS)

// Rango de referencia de calcio sérico total en adultos (uso orientativo)
const RANGO_CALCIO_SERICO_NORMAL_MG_DL = { min: 8.5, max: 10.5 };

// ------------------------------------------------------------
// TIPOS DE SUPLEMENTO DE CALCIO
// ------------------------------------------------------------
// El citrato de calcio se absorbe ~20-27% mejor que el carbonato de
// calcio (meta-análisis Sakhaee et al. 1999; Heller et al. 2000), y no
// depende de la acidez gástrica para disolverse. El carbonato requiere
// tomarse con alimentos y aporta más calcio elemental por comprimido (40%).
const TIPOS_SUPLEMENTO_CALCIO = [
    { id: 'carbonato', factorAbsorcion: 1.00, elementalPct: 40 },
    { id: 'citrato', factorAbsorcion: 1.25, elementalPct: 21 },
    { id: 'otro', factorAbsorcion: 1.00, elementalPct: null }
];

// ------------------------------------------------------------
// CATÁLOGO DE FUENTES DE CALCIO (FFQ)
// Cifras verificadas: USDA FoodData Central / NIH ODS Calcium Fact
// Sheet / etiquetas oficiales del fabricante para Mori-Nu.
// ------------------------------------------------------------
const ALIMENTOS_INICIALES = [
    {
        id: 'leche',
        nombreKey: 'food_milk',
        calcioPorcion: 300,
        porcionUnidadKey: 'unit_milk',
        icono: 'fa-solid fa-glass-water',
        permitePorciones: true,
        maxPorciones: 3,
        ocultoEnVegano: true
    },
    {
        id: 'yogur',
        nombreKey: 'food_yogurt',
        calcioPorcion: 300,
        porcionUnidadKey: 'unit_yogurt',
        icono: 'fa-solid fa-bowl-rice',
        permitePorciones: true,
        maxPorciones: 3,
        ocultoEnVegano: true
    },
    {
        id: 'queso_blanco',
        nombreKey: 'food_white_cheese',
        calcioPorcion: 200,
        porcionUnidadKey: 'unit_white_cheese',
        icono: 'fa-solid fa-cheese',
        permitePorciones: true,
        maxPorciones: 4,
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
        id: 'tofu_morinu_extra_firme',
        nombreKey: 'food_tofu_morinu_extra_firme',
        calcioPorcion: 53, // 30mg/porción de 3oz (etiqueta oficial Mori-Nu) × 1.75 porciones = medio bloque
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        permitePorciones: true,
        maxPorciones: 3
    },
    {
        id: 'tofu_morinu_firme',
        nombreKey: 'food_tofu_morinu_firme',
        calcioPorcion: 53, // 30mg/porción de 3oz × 1.75
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        permitePorciones: true,
        maxPorciones: 3
    },
    {
        id: 'tofu_morinu_super_suave',
        nombreKey: 'food_tofu_morinu_super_suave',
        calcioPorcion: 35, // 20mg/porción de 3oz × 1.75
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        permitePorciones: true,
        maxPorciones: 3
    },
    {
        id: 'vegetales_hoja_verde',
        nombreKey: 'food_leafy_greens',
        calcioPorcion: 100,
        porcionUnidadKey: 'unit_leafy_greens_half_cup',
        icono: 'fa-solid fa-leaf',
        permitePorciones: true,
        maxPorciones: 4
    },
    {
        id: 'frutos_secos_semillas',
        nombreKey: 'food_nuts_seeds',
        porcionUnidadKey: 'unit_nuts_seeds_half_cup',
        icono: 'fa-solid fa-seedling',
        permitePorciones: true,
        maxPorciones: 4,
        // Unidad dual: referencia = almendras. Para semillas muy densas en
        // calcio (chía, ajonjolí/tahini) usar el modo "otro alimento
        // fortificado" con el valor real del producto.
        unidadesAlternativas: [
            { key: 'media_taza', calcioPorUnidad: 180, labelKey: 'unit_nuts_seeds_half_cup' },
            { key: 'gramo', calcioPorUnidad: 2.5, labelKey: 'unit_nuts_seeds_gram' }
        ],
        unidadSeleccionadaPorDefecto: 'media_taza'
    },
    {
        id: 'pescado_con_espina',
        nombreKey: 'food_bony_fish',
        calcioPorcion: 400,
        porcionUnidadKey: 'unit_bony_fish_half_cup',
        icono: 'fa-solid fa-fish',
        permitePorciones: true,
        maxPorciones: 2,
        ocultoEnVegano: true,
        ocultoEnOvolacto: true
    }
];

// Plantilla para alimentos fortificados extra agregados dinámicamente por
// el usuario (mg de calcio 100% editable, se pueden agregar varios)
const PLANTILLA_ALIMENTO_FORTIFICADO_EXTRA = {
    nombreKey: 'food_fortified_other',
    calcioPorcion: 250, // valor inicial sugerido, editable por el usuario
    porcionUnidadKey: 'unit_fortified_other',
    icono: 'fa-solid fa-tag',
    permitePorciones: true,
    maxPorciones: 3,
    editableCalcio: true,
    editableNombre: true
};

const DIAS_SEMANA = [
    { id: 0, shortKey: 'day_0_short', nameKey: 'day_0' }, // Lunes
    { id: 1, shortKey: 'day_1_short', nameKey: 'day_1' }, // Martes
    { id: 2, fontBold: true, shortKey: 'day_2_short', nameKey: 'day_2' }, // Miércoles
    { id: 3, shortKey: 'day_3_short', nameKey: 'day_3' }, // Jueves
    { id: 4, shortKey: 'day_4_short', nameKey: 'day_4' }, // Viernes
    { id: 5, shortKey: 'day_5_short', nameKey: 'day_5' }, // Sábado
    { id: 6, shortKey: 'day_6_short', nameKey: 'day_6' }  // Domingo
];

// ------------------------------------------------------------
// CONSTANTES — Módulo Vitamina D (dieta y suplementación)
// ------------------------------------------------------------
// RDA de vitamina D: 600 UI (15 mcg)/día para 1-70 años; 800 UI (20
// mcg)/día para mayores de 70 años (Institute of Medicine, 2011).
const META_VITAMINA_D_MCG_DIA = 15;
const META_VITAMINA_D_MCG_DIA_MAYOR70 = 20;

// Catálogo de fuentes dietéticas de vitamina D (mcg por porción).
// 1 mcg = 40 UI. Cifras: USDA FoodData Central / NIH ODS Vitamin D Fact Sheet.
const FUENTES_VITAMINA_D = [
    {
        id: 'bebida_veg_fortificada_vitd',
        nombreKey: 'vitd_food_fortified_plant_drink',
        vitDPorcion: 2.5, // mcg (~100 UI) por taza (250ml)
        porcionUnidadKey: 'unit_plant_drink',
        icono: 'fa-solid fa-seedling',
        maxPorciones: 3
    },
    {
        id: 'leche_fortificada_vitd',
        nombreKey: 'vitd_food_milk',
        vitDPorcion: 2.5, // mcg (~100 UI) por taza
        porcionUnidadKey: 'unit_milk',
        icono: 'fa-solid fa-glass-water',
        maxPorciones: 3,
        ocultoEnVegano: true
    },
    {
        id: 'pescado_graso',
        nombreKey: 'vitd_food_fatty_fish',
        vitDPorcion: 9, // mcg (~360 UI) por 100g (salmón/sardina/macarela)
        porcionUnidadKey: 'unit_fatty_fish',
        icono: 'fa-solid fa-fish',
        maxPorciones: 2,
        ocultoEnVegano: true,
        ocultoEnOvolacto: true
    },
    {
        id: 'yema_huevo',
        nombreKey: 'vitd_food_egg_yolk',
        vitDPorcion: 1, // mcg (~41 UI) por unidad
        porcionUnidadKey: 'unit_egg_yolk',
        icono: 'fa-solid fa-egg',
        maxPorciones: 4,
        ocultoEnVegano: true
    },
    {
        id: 'hongos_uv',
        nombreKey: 'vitd_food_uv_mushrooms',
        vitDPorcion: 10, // mcg (~400 UI) por taza — solo si están etiquetados "expuestos a luz UV"
        porcionUnidadKey: 'unit_uv_mushrooms',
        icono: 'fa-solid fa-carrot',
        maxPorciones: 2,
        editableVitD: true // el contenido real depende del tratamiento UV del producto
    },
    {
        id: 'cereal_fortificado_vitd',
        nombreKey: 'vitd_food_fortified_cereal',
        vitDPorcion: 1.75, // mcg (~70 UI) por porción — varía por marca
        porcionUnidadKey: 'unit_fortified_cereal',
        icono: 'fa-solid fa-wheat-awn',
        maxPorciones: 2,
        editableVitD: true
    }
];

// Interpretación clínica opcional de 25-OH-vitamina D sérica (ng/mL).
// Cortes: Endocrine Society Clinical Practice Guideline (Holick et al.,
// 2011) / Institute of Medicine.
const CORTES_25OH_VITAMINA_D = {
    deficiente: 20,   // < 20 ng/mL
    insuficiente: 30  // 20-29 ng/mL; >= 30 ng/mL se considera suficiente
};

// ------------------------------------------------------------
// CONSTANTES — Módulo Exposición Solar / Fototipo / Índice de Vitamina D
// ------------------------------------------------------------
// Modelo proxy (no mide 25-OH-D sérica real): estima una "carga de
// síntesis cutánea semanal" a partir de días, minutos, franja horaria,
// fototipo de piel y edad. La exposición se asume SIN protector solar,
// ya que el protector bloquea casi completamente la síntesis cutánea de
// vitamina D (por eso no se pregunta como variable, se asume ausente).
const FACTOR_HORARIO = {
    pico: 1.0,       // 10:00am - 4:00pm (mayor intensidad UVB)
    no_pico: 0.5     // antes de 10am o después de 4pm
};

const FACTOR_EDAD_SINTESIS = {
    menor_50: 1.0,
    entre_50_70: 0.75,
    mayor_70: 0.5
};

// Escala de Fitzpatrick (1975): a mayor fototipo (más melanina), mayor
// fotoprotección natural y menor síntesis cutánea de vitamina D por
// unidad de tiempo de exposición solar.
const FACTOR_FOTOTIPO = {
    I: 1.0,    // Blanca marfil, siempre se quema, nunca broncea
    II: 1.0,   // Blanca, se quema fácil, broncea mínimamente
    III: 0.85, // Blanca/trigueña clara, se quema moderado, broncea moderado
    IV: 0.85,  // Oliva/trigueña, se quema mínimo, broncea con facilidad
    V: 0.6,    // Morena, rara vez se quema, broncea profusamente
    VI: 0.6    // Negra/muy oscura, casi nunca se quema
};

const UMBRAL_INDICE_SOLAR_BAJO = 60;      // por debajo de esto: riesgo alto de síntesis insuficiente
const UMBRAL_INDICE_SOLAR_MODERADO = 150; // entre bajo y este valor: riesgo moderado; por encima: riesgo bajo

// ------------------------------------------------------------
// CUESTIONARIO SARC-F — Tamizaje de riesgo de sarcopenia
// (Malmstrom & Morley, 2013 — herramienta validada, 5 ítems, 0-2 c/u)
// ------------------------------------------------------------
const PREGUNTAS_SARC_F = [
    { id: 'fuerza', nombreKey: 'sarcf_strength_q', opciones: [
        { valor: 0, key: 'sarcf_strength_opt0' },
        { valor: 1, key: 'sarcf_strength_opt1' },
        { valor: 2, key: 'sarcf_strength_opt2' }
    ]},
    { id: 'caminar', nombreKey: 'sarcf_walking_q', opciones: [
        { valor: 0, key: 'sarcf_walking_opt0' },
        { valor: 1, key: 'sarcf_walking_opt1' },
        { valor: 2, key: 'sarcf_walking_opt2' }
    ]},
    { id: 'levantarse_silla', nombreKey: 'sarcf_rise_q', opciones: [
        { valor: 0, key: 'sarcf_rise_opt0' },
        { valor: 1, key: 'sarcf_rise_opt1' },
        { valor: 2, key: 'sarcf_rise_opt2' }
    ]},
    { id: 'subir_escaleras', nombreKey: 'sarcf_stairs_q', opciones: [
        { valor: 0, key: 'sarcf_stairs_opt0' },
        { valor: 1, key: 'sarcf_stairs_opt1' },
        { valor: 2, key: 'sarcf_stairs_opt2' }
    ]},
    { id: 'caidas', nombreKey: 'sarcf_falls_q', opciones: [
        { valor: 0, key: 'sarcf_falls_opt0' },
        { valor: 1, key: 'sarcf_falls_opt1' },
        { valor: 2, key: 'sarcf_falls_opt2' }
    ]}
];

const UMBRAL_SARC_F_RIESGO = 4; // puntaje total >= 4 => riesgo probable de sarcopenia

// ------------------------------------------------------------
// EJERCICIO — Categorías agrupadas según la OMS (WHO Guidelines on
// Physical Activity and Sedentary Behaviour, 2020): actividad física
// aeróbica y actividad de fortalecimiento muscular son las dos
// categorías centrales de las guías internacionales.
// ------------------------------------------------------------
const UMBRAL_EJERCICIO_AEROBICO_HORAS_SEMANA = 2.5; // 150 min/semana de intensidad moderada (meta OMS)
const UMBRAL_EJERCICIO_FUERZA_SEMANAL = 2;           // días/semana mínimos de fortalecimiento muscular (meta OMS)
