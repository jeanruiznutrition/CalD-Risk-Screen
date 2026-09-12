// ============================================================
// CalD Risk Screen — Datos y constantes del modelo (CARDA v2.0)
//
// CAMBIO CENTRAL v2.0: el modelo ya no estima "calcio ingerido"
// sino CALCIO ABSORBIBLE. Cada alimento lleva su biodisponibilidad
// relativa (RBV) derivada de los estudios de absorción fraccional
// con isótopos de Heaney y Weaver. Esto corrige el sesgo mayor de
// los cuestionarios de calcio: 115 mg de espinaca aportan ~6 mg
// absorbibles, mientras 61 mg de col rizada aportan ~30 mg.
//
// Marco de referencia primario: IOM/NASEM (2011).
// Marco comparativo: EFSA (2015 calcio / 2016 vitamina D).
// Todas las cifras están citadas en la bibliografía (i18n.js).
// No contiene lógica de cálculo (ver algorithm.js).
// ============================================================


// ============================================================
// 1. MARCOS DE REFERENCIA DE INGESTA DE CALCIO
// ============================================================
// El IOM y la EFSA NO son intercambiables: diferen en criterio
// (retención positiva vs balance nulo) y la EFSA no añade
// incremento geriátrico. Se exponen ambos; el algoritmo usa el
// marco que el usuario seleccione (por defecto IOM).

const MARCO_CALCIO_IOM = {
    id: 'IOM',
    // [edadMin, edadMax, sexo('ambos'|'femenino'|'masculino'), EAR, RDA, UL]
    tramos: [
        { edadMin: 1,  edadMax: 3,   sexo: 'ambos',     ear: 500,  rda: 700,  ul: 2500 },
        { edadMin: 4,  edadMax: 8,   sexo: 'ambos',     ear: 800,  rda: 1000, ul: 2500 },
        { edadMin: 9,  edadMax: 18,  sexo: 'ambos',     ear: 1100, rda: 1300, ul: 3000 },
        { edadMin: 19, edadMax: 50,  sexo: 'ambos',     ear: 800,  rda: 1000, ul: 2500 },
        { edadMin: 51, edadMax: 70,  sexo: 'femenino',  ear: 1000, rda: 1200, ul: 2000 },
        { edadMin: 51, edadMax: 70,  sexo: 'masculino', ear: 800,  rda: 1000, ul: 2000 },
        { edadMin: 71, edadMax: 120, sexo: 'ambos',     ear: 1000, rda: 1200, ul: 2000 }
    ]
};

const MARCO_CALCIO_EFSA = {
    id: 'EFSA',
    // La EFSA usa AR (Average Requirement) y PRI (Population Reference Intake).
    // No añade incremento por edad avanzada: ≥25 años permanece en 950 mg.
    tramos: [
        { edadMin: 1,  edadMax: 3,   sexo: 'ambos', ear: 390, rda: 450,  ul: 2500 },
        { edadMin: 4,  edadMax: 10,  sexo: 'ambos', ear: 680, rda: 800,  ul: 2500 },
        { edadMin: 11, edadMax: 17,  sexo: 'ambos', ear: 960, rda: 1150, ul: 2500 },
        { edadMin: 18, edadMax: 24,  sexo: 'ambos', ear: 860, rda: 1000, ul: 2500 },
        { edadMin: 25, edadMax: 120, sexo: 'ambos', ear: 750, rda: 950,  ul: 2500 }
    ]
};

// Umbral protector observado en EPIC-Oxford (Appleby et al. 2007):
// entre quienes consumían ≥525 mg/día de calcio, el riesgo de fractura
// de cadera en veganos vs omnívoros fue IRR 1.00 (IC95% 0.69-1.44).
// El exceso de riesgo se concentró por debajo de este valor.
const UMBRAL_PROTECTOR_EPIC_OXFORD_MG = 525;


// ============================================================
// 2. MODELO DE ABSORCIÓN DE CALCIO
// ============================================================
// (a) EFECTO DE LA CARGA (saturación):
// Heaney, Weaver & Fitzsimmons (J Bone Miner Res 1990;5:1135)
// establecieron que la absorción fraccional decae con el logaritmo
// natural de la carga ingerida en esa toma:
//        FA(carga) = 0.889 − 0.0964 × ln(carga_mg)
// Verificación: a 15 mg → 62.8% (reportado ~64%);
//               a 500 mg → 29.0% (reportado 28.6%).
// Esto NO es un tope duro a los 500 mg: la absorción continúa por
// encima, pero con eficiencia fraccional decreciente. Es la base
// real de la recomendación de fraccionar la dosis.
const FA_INTERCEPTO = 0.889;
const FA_PENDIENTE_LN = 0.0964;
const FA_MINIMA = 0.05;  // piso fisiológico (difusión paracelular residual)
const FA_MAXIMA = 0.70;  // techo fisiológico a cargas muy bajas

// Carga por encima de la cual se emite la advertencia de fraccionamiento
const CARGA_RECOMENDADA_MAXIMA_POR_TOMA = 500; // mg

// (b) BIODISPONIBILIDAD RELATIVA POR ALIMENTO (RBV):
// Cociente entre la absorción fraccional del alimento y la de la
// leche (32.1%), medidas con isótopos en los mismos sujetos.
// Fuente: Weaver CM & Heaney RP, Am J Clin Nutr 1999;70(3 Suppl):543S.
// El RBV captura el efecto de la matriz alimentaria (oxalato, fitato,
// forma química del calcio) independientemente de la carga.
const FA_REFERENCIA_LECHE = 0.321;


// ============================================================
// 3. CATÁLOGO DE FUENTES DE CALCIO
// ============================================================
// calcioPorcion  = mg de calcio POR PORCIÓN (contenido bruto)
// faAlimento     = absorción fraccional medida del alimento
// rbv            = faAlimento / FA_REFERENCIA_LECHE (se calcula abajo)
//
// NOTA SOBRE EL TOFU: el contenido de calcio del tofu depende del
// COAGULANTE, no de la firmeza. El tofu cuajado con sulfato de calcio
// (E516) aporta 350-683 mg/100 g; el cuajado con nigari (cloruro de
// magnesio) 87-201 mg/100 g; el sedoso cuajado con glucono-delta-lactona
// ~31 mg/100 g. Por eso las preguntas se organizan por coagulante.

const ALIMENTOS_INICIALES = [
    // ---------- LÁCTEOS ----------
    {
        id: 'leche',
        nombreKey: 'food_milk',
        calcioPorcion: 300,
        faAlimento: 0.321,
        cargaReferencia: 300,  // Weaver & Heaney 1999: 240 mL = 300 mg
        porcionUnidadKey: 'unit_milk',
        icono: 'fa-solid fa-glass-water',
        permitePorciones: true,
        maxPorciones: 3,
        ocultoEnVegano: true,
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'yogur',
        nombreKey: 'food_yogurt',
        calcioPorcion: 300,
        faAlimento: 0.321,
        cargaReferencia: 300,  // Weaver & Heaney 1999: 240 mL = 300 mg
        porcionUnidadKey: 'unit_yogurt',
        icono: 'fa-solid fa-bowl-rice',
        permitePorciones: true,
        maxPorciones: 3,
        ocultoEnVegano: true,
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'queso_blanco',
        nombreKey: 'food_white_cheese',
        calcioPorcion: 200,
        faAlimento: 0.321,
        cargaReferencia: 300,  // equiparado a lácteos (42 g queso = 303 mg)
        porcionUnidadKey: 'unit_white_cheese',
        icono: 'fa-solid fa-cheese',
        permitePorciones: true,
        maxPorciones: 4,
        ocultoEnVegano: true,
        fuenteKey: 'src_usda'
    },

    // ---------- BEBIDAS VEGETALES FORTIFICADAS ----------
    {
        id: 'bebida_veg_fortificada',
        nombreKey: 'food_fortified_plant_drink',
        calcioPorcion: 300,
        faAlimento: 0.240,
        cargaReferencia: 300,  // Weaver & Heaney 1999: 240 mL = 300 mg // fosfato tricálcico en suspensión (Weaver & Heaney 1999)
        porcionUnidadKey: 'unit_plant_drink',
        icono: 'fa-solid fa-seedling',
        permitePorciones: true,
        maxPorciones: 3,
        editableCalcio: true,
        advertenciaKey: 'warn_shake_plant_drink',
        fuenteKey: 'src_weaver_heaney'
    },

    // ---------- TOFU (POR COAGULANTE, NO POR FIRMEZA) ----------
    {
        id: 'tofu_sulfato_calcio',
        nombreKey: 'food_tofu_calcium_set',
        calcioPorcion: 525, // 350 mg/100 g × 150 g (½ bloque); rango USDA 350-683
        faAlimento: 0.310,
        cargaReferencia: 258,  // Weaver & Heaney 1999: 126 g = 258 mg
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        permitePorciones: true,
        maxPorciones: 3,
        editableCalcio: true,
        ayudaKey: 'help_tofu_calcium_set',
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'tofu_nigari',
        nombreKey: 'food_tofu_nigari',
        calcioPorcion: 225, // 150 mg/100 g × 150 g; rango 87-201 mg/100 g
        faAlimento: 0.310,
        cargaReferencia: 258,  // misma matriz de tofu, medida a 258 mg
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        permitePorciones: true,
        maxPorciones: 3,
        editableCalcio: true,
        ayudaKey: 'help_tofu_nigari',
        fuenteKey: 'src_usda'
    },
    {
        id: 'tofu_sedoso',
        nombreKey: 'food_tofu_silken',
        calcioPorcion: 47, // ~31 mg/100 g × 150 g (coagulado con GDL, sin calcio)
        faAlimento: 0.310,
        cargaReferencia: 258,  // misma matriz de tofu, medida a 258 mg
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        permitePorciones: true,
        maxPorciones: 3,
        editableCalcio: true,
        ayudaKey: 'help_tofu_silken',
        advertenciaKey: 'warn_tofu_silken',
        fuenteKey: 'src_usda'
    },

    // ---------- VEGETALES: SEPARADOS POR CONTENIDO DE OXALATO ----------
    {
        id: 'verduras_bajo_oxalato',
        nombreKey: 'food_low_oxalate_greens',
        calcioPorcion: 70, // ½ taza cocida (promedio de bok choy, kale, brócoli, berza)
        faAlimento: 0.500,
        cargaReferencia: 70,  // promedio de las porciones del ensayo (bok choy 79, kale 61, brocoli 35) // rango medido 40.2-63.8% según especie
        porcionUnidadKey: 'unit_half_cup_cooked',
        icono: 'fa-solid fa-leaf',
        permitePorciones: true,
        maxPorciones: 4,
        soloCocido: true,
        ayudaKey: 'help_low_oxalate_greens',
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'verduras_alto_oxalato',
        nombreKey: 'food_high_oxalate_greens',
        calcioPorcion: 115, // ½ taza cocida (espinaca, acelga, ruibarbo)
        faAlimento: 0.051,
        cargaReferencia: 115,  // Heaney et al. 1988: 85 g espinaca = 115 mg // ¡solo 5.1%! El oxalato secuestra el calcio
        porcionUnidadKey: 'unit_half_cup_cooked',
        icono: 'fa-solid fa-leaf',
        permitePorciones: true,
        maxPorciones: 4,
        soloCocido: true,
        advertenciaKey: 'warn_high_oxalate',
        ayudaKey: 'help_high_oxalate_greens',
        fuenteKey: 'src_heaney_spinach'
    },

    // ---------- FRUTOS SECOS Y SEMILLAS ----------
    {
        id: 'almendras',
        nombreKey: 'food_almonds',
        faAlimento: 0.212,
        cargaReferencia: 80,  // Weaver & Heaney 1999: 28 g = 80 mg
        porcionUnidadKey: 'unit_half_cup',
        icono: 'fa-solid fa-seedling',
        permitePorciones: true,
        maxPorciones: 4,
        unidadesAlternativas: [
            { key: 'media_taza', calcioPorUnidad: 200, labelKey: 'unit_half_cup' },
            { key: 'gramo', calcioPorUnidad: 2.86, labelKey: 'unit_gram' }
        ],
        unidadSeleccionadaPorDefecto: 'media_taza',
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'ajonjoli_tahini',
        nombreKey: 'food_sesame_tahini',
        faAlimento: 0.208,
        cargaReferencia: 37,  // Weaver & Heaney 1999: 28 g = 37 mg
        porcionUnidadKey: 'unit_half_cup',
        icono: 'fa-solid fa-seedling',
        permitePorciones: true,
        maxPorciones: 4,
        unidadesAlternativas: [
            { key: 'media_taza', calcioPorUnidad: 350, labelKey: 'unit_half_cup' },
            { key: 'gramo', calcioPorUnidad: 5.0, labelKey: 'unit_gram' }
        ],
        unidadSeleccionadaPorDefecto: 'media_taza',
        ayudaKey: 'help_sesame',
        fuenteKey: 'src_weaver_heaney'
    },

    // ---------- LEGUMBRES ----------
    {
        id: 'legumbres',
        nombreKey: 'food_legumes',
        calcioPorcion: 60, // ½ taza cocida (frijoles blancos/pintos)
        faAlimento: 0.240,
        cargaReferencia: 80,  // promedio del ensayo (frijol blanco 113, pinto 45) // promedio 21.8-26.7%
        porcionUnidadKey: 'unit_half_cup_cooked',
        icono: 'fa-solid fa-bowl-food',
        permitePorciones: true,
        maxPorciones: 4,
        fuenteKey: 'src_weaver_heaney'
    },

    // ---------- PESCADO ENLATADO CON ESPINA ----------
    {
        id: 'pescado_con_espina',
        nombreKey: 'food_bony_fish',
        calcioPorcion: 325,
        faAlimento: 0.270,
        cargaReferencia: 325,  // estimado a la porcion de referencia // estimado; fosfato cálcico óseo, algo menor que lácteos
        porcionUnidadKey: 'unit_half_cup',
        icono: 'fa-solid fa-fish',
        permitePorciones: true,
        maxPorciones: 2,
        ocultoEnVegano: true,
        ocultoEnOvolacto: true,
        fuenteKey: 'src_usda'
    }
];

// Plantilla para alimentos fortificados extra que el usuario agrega.
// El mg de calcio y el nombre son 100% editables; la absorción fraccional
// se asume la del fosfato/carbonato tricálcico en fortificados (24%).
const PLANTILLA_ALIMENTO_FORTIFICADO_EXTRA = {
    nombreKey: 'food_fortified_other',
    calcioPorcion: 250,
    faAlimento: 0.240,
    cargaReferencia: 300,  // equiparado a fortificados medidos a 300 mg
    porcionUnidadKey: 'unit_fortified_other',
    icono: 'fa-solid fa-tag',
    permitePorciones: true,
    maxPorciones: 3,
    editableCalcio: true,
    editableNombre: true,
    fuenteKey: 'src_weaver_heaney'
};

const DIAS_SEMANA = [
    { id: 0, shortKey: 'day_0_short', nameKey: 'day_0' },
    { id: 1, shortKey: 'day_1_short', nameKey: 'day_1' },
    { id: 2, fontBold: true, shortKey: 'day_2_short', nameKey: 'day_2' },
    { id: 3, shortKey: 'day_3_short', nameKey: 'day_3' },
    { id: 4, shortKey: 'day_4_short', nameKey: 'day_4' },
    { id: 5, shortKey: 'day_5_short', nameKey: 'day_5' },
    { id: 6, shortKey: 'day_6_short', nameKey: 'day_6' }
];


// ============================================================
// 4. SUPLEMENTOS DE CALCIO
// ============================================================
// Calcio elemental por sal y biodisponibilidad relativa.
// Sakhaee et al. (Am J Ther 1999;6:313), meta-análisis de 15 estudios:
// el citrato se absorbe 22-27% mejor que el carbonato (27.2% en ayuno,
// 21.6% con comida). Heaney (Osteoporos Int 1999) mostró equivalencia
// cuando ambos se toman CON alimentos. Consenso: ambos válidos con
// comida; citrato preferible en aclorhidria, uso de IBP, cirugía
// bariátrica o toma en ayuno.
const TIPOS_SUPLEMENTO_CALCIO = [
    { id: 'ninguno',   rbv: 1.00, elementalPct: null },
    { id: 'carbonato', rbv: 1.00, elementalPct: 40, requiereComida: true },
    { id: 'citrato',   rbv: 1.22, elementalPct: 21, requiereComida: false },
    { id: 'otro',      rbv: 1.00, elementalPct: null }
];


// ============================================================
// 5. VITAMINA D — INGESTA
// ============================================================
// IOM/NASEM 2011: EAR 400 UI (10 µg); RDA 600 UI (15 µg) para 1-70
// años y 800 UI (20 µg) para >70; UL 4000 UI (100 µg).
// Derivados bajo el supuesto explícito de EXPOSICIÓN SOLAR MÍNIMA.
// EFSA 2016: Adequate Intake de 15 µg/día para ≥1 año (no fija EAR/PRI
// por incertidumbre en la relación ingesta-estatus). Ambos organismos
// coinciden en el objetivo sérico de 50 nmol/L (20 ng/mL).
const VITD_EAR_MCG = 10;
const VITD_RDA_MCG = 15;
const VITD_RDA_MCG_MAYOR70 = 20;
const VITD_UL_MCG = 100;
const VITD_AI_EFSA_MCG = 15;

// Potencia relativa D3 vs D2 para elevar 25(OH)D sérica.
// Tripkovic et al. (Am J Clin Nutr 2012;95:1357): D3 superior, con
// diferencia media ponderada de 15.23 nmol/L. Meta-análisis 2024
// (Adv Nutr): la D2 rinde ~40% menos en dosis diaria.
// Relevante para veganos: existe D3 de liquen, preferible a D2.
const POTENCIA_VITD3 = 1.00;
const POTENCIA_VITD2 = 0.60;

// Cortes de 25-hidroxivitamina D sérica (ng/mL).
// IOM/NASEM 2011 y EFSA 2016: ≥20 ng/mL (50 nmol/L) suficiente para
// ≥97.5% de la población; <12 ng/mL (30 nmol/L) deficiencia.
// La Endocrine Society proponía ≥30 ng/mL en su guía de 2011, pero
// ABANDONÓ ese umbral en su guía de 2024 (Demay et al., JCEM 2024),
// que además recomienda CONTRA el tamizaje rutinario de 25(OH)D en
// adultos sanos. Por eso la herramienta adopta el consenso IOM/EFSA.
// ------------------------------------------------------------
// CORTES DE 25(OH)D: DOS MARCOS, PORQUE NO HAY UNO ÚNICO
// ------------------------------------------------------------
// No existe consenso sobre el umbral de suficiencia, y el desacuerdo
// no es menor. La postura depende de PARA QUÉ se pregunta:
//
//   MARCO POBLACIONAL (IOM/NASEM 2011, EFSA 2016): 20 ng/mL cubre las
//   necesidades óseas del 97.5% de la población general.
//
//   MARCO ÓSEO (International Osteoporosis Foundation; Bone Health and
//   Osteoporosis Foundation): 30 ng/mL, con el argumento de que por
//   debajo de 75 nmol/L no se optimizan la absorción intestinal de
//   calcio ni la supresión de la paratohormona. La guía clínica de la
//   BHOF lo formula de modo explícito: en individuos sanos ≥20 ng/mL
//   puede bastar, pero ante enfermedad ósea metabólica conocida o
//   sospechada lo apropiado es ≥30 ng/mL.
//
//   ENDOCRINE SOCIETY 2024: abandonó no solo los 30 ng/mL de su guía
//   de 2011, sino TODA la clasificación de deficiencia/insuficiencia/
//   suficiencia, al no hallar evidencia de ensayos clínicos que
//   sostenga ningún umbral concreto. También recomienda no medir
//   25(OH)D de forma rutinaria en adultos sanos. Se documenta como
//   advertencia, no como escala utilizable.
//
// Por defecto se usa el MARCO ÓSEO, que es el pertinente para una
// herramienta de tamizaje de salud ósea. El marco elegido debe
// declararse explícitamente en cualquier análisis publicado.

const MARCO_VITD_OSEO = {
    id: 'oseo',
    deficienciaSevera: 10,   // < 10 ng/mL (< 25 nmol/L)
    deficiente: 20,          // 10-19 ng/mL (25-49 nmol/L)
    insuficiente: 30,        // 20-29 ng/mL (50-74 nmol/L)
    suficiente: 50,          // 30-50 ng/mL (75-125 nmol/L): rango objetivo
    excesivo: 100,           // 50-99 ng/mL: por encima de lo recomendado
    toxico: 150              // 100-149 excesivo; ≥150 toxicidad franca
};

const MARCO_VITD_POBLACIONAL = {
    id: 'poblacional',
    deficienciaSevera: 0,    // este marco no separa deficiencia severa
    deficiente: 12,          // < 12 ng/mL (< 30 nmol/L)
    insuficiente: 20,        // 12-19 ng/mL (30-50 nmol/L)
    suficiente: 50,          // 20-49 ng/mL: rango normal del IOM
    excesivo: 100,
    toxico: 150
};

const MARCOS_VITD = { oseo: MARCO_VITD_OSEO, poblacional: MARCO_VITD_POBLACIONAL };
const MARCO_VITD_POR_DEFECTO = 'oseo';

// Se conserva por compatibilidad y para el cálculo de adecuación dietética.
const CORTES_25OH_VITAMINA_D = MARCO_VITD_OSEO;

const CORTE_ENDOCRINE_SOCIETY_2011 = 30; // solo referencia histórica

// Rango de referencia de calcio sérico total en adultos (mg/dL).
// El calcio sérico está bajo control homeostático estrecho y NO
// refleja el estatus nutricional de calcio: un valor normal no
// descarta ingesta insuficiente ni pérdida ósea.
const RANGO_CALCIO_SERICO_NORMAL_MG_DL = { min: 8.5, max: 10.5 };


// ============================================================
// 6. FUENTES DIETÉTICAS DE VITAMINA D
// ============================================================
// vitDPorcion en microgramos (µg). 1 µg = 40 UI.
// Fuentes: USDA FoodData Central; NIH ODS Vitamin D Fact Sheet.
const FUENTES_VITAMINA_D = [
    {
        id: 'pescado_graso',
        nombreKey: 'vitd_food_fatty_fish',
        vitDPorcion: 12.5, // ~500 UI/100 g (salmón, sardina, caballa); salvaje > cultivado
        formaVitD: 'D3',
        porcionUnidadKey: 'unit_fatty_fish',
        icono: 'fa-solid fa-fish',
        maxPorciones: 2,
        ocultoEnVegano: true,
        ocultoEnOvolacto: true,
        fuenteKey: 'src_usda'
    },
    {
        id: 'yema_huevo',
        nombreKey: 'vitd_food_egg_yolk',
        vitDPorcion: 1.0, // ~41 UI por yema
        formaVitD: 'D3',
        porcionUnidadKey: 'unit_egg_yolk',
        icono: 'fa-solid fa-egg',
        maxPorciones: 4,
        ocultoEnVegano: true,
        fuenteKey: 'src_usda'
    },
    {
        id: 'leche_fortificada_vitd',
        nombreKey: 'vitd_food_milk',
        vitDPorcion: 2.5, // ~100 UI por taza
        formaVitD: 'D3',
        porcionUnidadKey: 'unit_milk',
        icono: 'fa-solid fa-glass-water',
        maxPorciones: 3,
        ocultoEnVegano: true,
        fuenteKey: 'src_usda'
    },
    {
        id: 'bebida_veg_fortificada_vitd',
        nombreKey: 'vitd_food_fortified_plant_drink',
        vitDPorcion: 2.5, // ~100 UI por taza; varía mucho por marca
        formaVitD: 'D2',  // frecuentemente D2; verificar etiqueta
        porcionUnidadKey: 'unit_plant_drink',
        icono: 'fa-solid fa-seedling',
        maxPorciones: 3,
        editableVitD: true,
        advertenciaKey: 'warn_check_label_vitd',
        fuenteKey: 'src_usda'
    },
    {
        id: 'hongos_uv',
        nombreKey: 'vitd_food_uv_mushrooms',
        vitDPorcion: 10, // ~400 UI/taza SOLO si fueron irradiados con UV
        formaVitD: 'D2',
        porcionUnidadKey: 'unit_uv_mushrooms',
        icono: 'fa-solid fa-carrot',
        maxPorciones: 2,
        editableVitD: true,
        advertenciaKey: 'warn_uv_mushrooms',
        ayudaKey: 'help_uv_mushrooms',
        fuenteKey: 'src_uv_mushrooms'
    },
    {
        id: 'cereal_fortificado_vitd',
        nombreKey: 'vitd_food_fortified_cereal',
        vitDPorcion: 1.75, // ~70 UI por porción; varía por marca
        formaVitD: 'D2',
        porcionUnidadKey: 'unit_fortified_cereal',
        icono: 'fa-solid fa-wheat-awn',
        maxPorciones: 2,
        editableVitD: true,
        advertenciaKey: 'warn_check_label_vitd',
        fuenteKey: 'src_usda'
    }
];


// ============================================================
// 7. EXPOSICIÓN SOLAR / FOTOTIPO
// ============================================================
// Modelo proxy de "carga de síntesis cutánea semanal". NO mide
// 25(OH)D sérica. Asume exposición SIN protector solar (el protector
// bloquea la síntesis; por eso no se pregunta como variable).
//
// PARADOJA DEL PAÍS SOLEADO: Panamá está a ~9°N con radiación UVB
// alta todo el año, pero la deficiencia de vitamina D en Sudamérica
// alcanza 34.76% (IC95% 29.68-40.21; Mendes et al., Nutrition Reviews
// 2023). La latitud tropical NO garantiza suficiencia: pesan más la
// evitación del sol, la vida bajo techo, la vestimenta, la
// pigmentación y la obesidad. Por eso se evalúa el COMPORTAMIENTO
// solar real, no la ubicación geográfica.

const FACTOR_HORARIO = {
    pico: 1.0,       // 10:00-16:00, menor ángulo cenital solar, máximo UVB
    no_pico: 0.4     // fuera de esa franja el UVB cae drásticamente
};

// Declive de la síntesis cutánea con la edad. Terushkin et al.
// (J Am Acad Dermatol 2010) usan af = 1 − 0.015 × (edad − 20);
// una persona de 70 años produce ~75% menos que una de 20.
const calcularFactorEdadSintesis = (edad) => {
    const e = Number(edad) || 20;
    if (e <= 20) return 1.0;
    return Math.max(0.25, 1 - 0.015 * (e - 20));
};

// Escala de Fitzpatrick (1975/1988). La melanina compite con el
// 7-dehidrocolesterol por los fotones UVB: a mayor fototipo, más
// tiempo de exposición se requiere para la misma síntesis.
// Regla práctica con índice UV ≥3: fototipos I-II <10 min,
// III-IV <15 min, V-VI <30 min.
const FACTOR_FOTOTIPO = {
    I:   1.00,
    II:  1.00,
    III: 0.70,
    IV:  0.70,
    V:   0.35,
    VI:  0.35
};

// Fracción de superficie corporal expuesta. Terushkin et al. modelan
// 25.5% (cara, brazos, manos) como escenario de referencia.
const FACTOR_SUPERFICIE_CORPORAL = {
    minima: 0.4,   // solo cara y manos (~10%)
    parcial: 1.0,  // cara, brazos y manos (~25%) — referencia
    amplia: 1.8    // además piernas / torso (~50%)
};

// Umbrales del índice solar (unidades arbitrarias del modelo proxy).
// Calibrados de modo que ~15 min/día, 5 días/semana, en franja pico,
// fototipo III, superficie parcial y <50 años caiga en "bajo riesgo".
const UMBRAL_INDICE_SOLAR_BAJO = 60;
const UMBRAL_INDICE_SOLAR_MODERADO = 150;


// ============================================================
// 8. SARCOPENIA — SARC-F Y PROTEÍNA
// ============================================================
// SARC-F (Malmstrom & Morley, J Am Med Dir Assoc 2013), recomendado
// por EWGSOP2 (Cruz-Jentoft et al., Age Ageing 2019) como cribado.
// LIMITACIÓN IMPORTANTE: con corte ≥4 la especificidad es alta
// (85-95%) pero la sensibilidad es BAJA (30-55%). Sirve para
// DESCARTAR sarcopenia, no para detectarla. Por eso la herramienta
// reporta también el corte sensible de ≥2 como señal de alerta
// temprana, siguiendo la literatura que propone bajar el punto de
// corte o combinarlo con circunferencia de pantorrilla (SARC-CalF).
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

const UMBRAL_SARC_F_ESPECIFICO = 4; // corte validado estándar (alta especificidad)
const UMBRAL_SARC_F_SENSIBLE = 2;   // corte sensible propuesto para cribado temprano

// Circunferencia de pantorrilla (SARC-CalF): puntos de corte
// clásicos para masa muscular apendicular baja.
const CORTE_PANTORRILLA_CM = { femenino: 33, masculino: 34 };

// Proteína: la RDA del IOM es 0.8 g/kg/día para adultos, pero se
// considera insuficiente para adultos mayores. PROT-AGE (Bauer et al.
// 2013) y ESPEN (Deutz et al., Clin Nutr 2014) recomiendan 1.0-1.2
// g/kg/día en mayores sanos. Estudios de oxidación de aminoácidos
// (IAAO) sugieren que la RDA real podría ser ~1.2 g/kg/día.
// En dietas vegetales, la menor digestibilidad justifica apuntar al
// extremo alto del rango.
const PROTEINA_RDA_ADULTO = 0.8;
const PROTEINA_OBJETIVO_MAYOR65 = 1.0;
const PROTEINA_OBJETIVO_MAYOR65_ALTO = 1.2;
const EDAD_CORTE_PROTEINA_MAYOR = 65;
// Ajuste sugerido para dietas 100% vegetales por menor DIAAS
const FACTOR_PROTEINA_DIETA_VEGETAL = 1.1;


// ============================================================
// 9. EJERCICIO — GUÍAS OMS 2020
// ============================================================
// WHO Guidelines on Physical Activity and Sedentary Behaviour (2020):
// las dos categorías centrales son actividad aeróbica y actividad de
// fortalecimiento muscular. Metas en adultos: ≥150 min/semana de
// actividad aeróbica de intensidad moderada (o 75 min vigorosa) y
// ≥2 días/semana de fortalecimiento muscular de grupos mayores.
const UMBRAL_EJERCICIO_AEROBICO_HORAS_SEMANA = 2.5;
const UMBRAL_EJERCICIO_FUERZA_SEMANAL = 2;


// ============================================================
// 10. FRAX® — CAPTURA DE FACTORES DE RIESGO CLÍNICO
// ============================================================
// AVISO LEGAL Y METODOLÓGICO IMPORTANTE:
// FRAX® es un algoritmo PROPIETARIO registrado a nombre del Prof.
// John A. Kanis, Centre for Metabolic Bone Diseases, University of
// Sheffield. Sus coeficientes NO son de dominio público y su
// incrustación o automatización requiere revisar los términos de
// licencia con la Universidad de Sheffield.
//
// Por tanto, esta herramienta NO calcula FRAX. Lo que hace es:
//   (a) capturar exactamente los 11 factores de riesgo clínico que
//       FRAX utiliza, con las mismas definiciones operativas;
//   (b) exportarlos junto al resto de los datos del participante;
//   (c) enlazar a la calculadora oficial para obtener la probabilidad.
//
// Ventaja adicional: FRAX no dispone de modelo calibrado para Panamá
// (existen 73 modelos nacionales; en Latinoamérica está Ecuador, entre
// otros). La calibración requiere datos nacionales de incidencia de
// fractura de cadera, que Panamá no tiene publicados. Esto es, en sí
// mismo, un argumento de justificación para el presente estudio.
const FRAX_URL_OFICIAL = 'https://frax.shef.ac.uk/FRAX/tool.aspx?lang=sp';

// Países con modelo FRAX disponible más cercanos a Panamá, para que el
// investigador elija un sustituto documentado mientras Panamá no tenga
// modelo propio. La elección debe declararse explícitamente en el análisis.
const FRAX_PAISES_SUSTITUTOS = [
    { id: 'ecuador', key: 'frax_country_ecuador' },
    { id: 'colombia', key: 'frax_country_colombia' },
    { id: 'mexico', key: 'frax_country_mexico' },
    { id: 'venezuela', key: 'frax_country_venezuela' },
    { id: 'usa_hispanic', key: 'frax_country_usa_hispanic' }
];

// Los 11 factores de riesgo clínico de FRAX, con sus definiciones
// operativas tal como las especifica la documentación oficial.
const FACTORES_FRAX = [
    { id: 'fracturaPrevia',      nombreKey: 'frax_prior_fracture',   ayudaKey: 'frax_prior_fracture_help' },
    { id: 'fracturaCaderaPadres', nombreKey: 'frax_parent_hip',      ayudaKey: 'frax_parent_hip_help' },
    { id: 'fumadorActual',       nombreKey: 'frax_current_smoking',  ayudaKey: 'frax_current_smoking_help' },
    { id: 'glucocorticoides',    nombreKey: 'frax_glucocorticoids',  ayudaKey: 'frax_glucocorticoids_help' },
    { id: 'artritisReumatoide',  nombreKey: 'frax_rheumatoid',       ayudaKey: 'frax_rheumatoid_help' },
    { id: 'osteoporosisSecundaria', nombreKey: 'frax_secondary',     ayudaKey: 'frax_secondary_help' },
    { id: 'alcohol3Unidades',    nombreKey: 'frax_alcohol',          ayudaKey: 'frax_alcohol_help' }
];
// (Los otros 4 factores —edad, sexo, peso y talla— ya se capturan en
//  el perfil del participante y se reutilizan para FRAX.)


// ============================================================
// 11. INHIBIDORES Y MODIFICADORES DE LA ABSORCIÓN DE CALCIO
// ============================================================
// El más relevante clínicamente es el uso de inhibidores de la bomba
// de protones (IBP): reducen la acidez gástrica, de la cual depende la
// disolución del CARBONATO de calcio. No afectan al citrato, que es
// soluble con independencia del pH gástrico. De ahí que en usuarios de
// IBP se prefiera el citrato.
const FACTOR_IBP_SOBRE_CARBONATO = 0.55; // reducción sustancial de la absorción del carbonato
const FACTOR_IBP_SOBRE_CITRATO = 1.00;   // el citrato no depende del pH gástrico
const FACTOR_IBP_SOBRE_ALIMENTOS = 0.90; // efecto menor sobre el calcio de los alimentos

// El sodio aumenta la excreción urinaria de calcio: aproximadamente
// 20-30 mg de calcio se pierden por cada 2300 mg (100 mmol) de sodio
// excretado. Se modela como PÉRDIDA, no como menor absorción.
const CALCIO_PERDIDO_POR_GRAMO_SODIO = 10; // mg de calcio por gramo de sodio

// La cafeína tiene un efecto pequeño pero medible sobre el balance de
// calcio: del orden de 2-3 mg de calcio por cada 100 mg de cafeína.
// Una taza de café aporta aproximadamente 95 mg de cafeína.
const CALCIO_PERDIDO_POR_TAZA_CAFE = 2.5; // mg de calcio por taza
const CAFEINA_POR_TAZA_MG = 95;

const NIVELES_SODIO = [
    { id: 'bajo',  gramosDia: 1.5, key: 'sodium_low' },
    { id: 'medio', gramosDia: 3.0, key: 'sodium_medium' },
    { id: 'alto',  gramosDia: 5.0, key: 'sodium_high' }
];


// ============================================================
// 12. EXPOSICIÓN SOLAR EN UNIDADES ESTÁNDAR (SED / MED)
// ============================================================
// La literatura fotobiológica usa dos unidades estandarizadas:
//
//  SED (Standard Erythema Dose) = 100 J/m² de radiación ponderada por
//      el espectro de acción eritematosa de la CIE. Es INDEPENDIENTE
//      del fototipo, por lo que sirve para comparar entre personas.
//
//  MED (Minimal Erythemal Dose) = dosis mínima que produce eritema
//      perceptible en un individuo. DEPENDE del fototipo.
//
// Relación práctica: el índice UV equivale aproximadamente a los SED
// recibidos en la hora de máxima intensidad. Es decir, con índice UV 6
// se reciben unos 6 SED en esa hora.
//
// REGLA DE HOLICK: exponer ¼ de la superficie corporal a ¼ de una MED
// equivale a ingerir aproximadamente 1000 UI de vitamina D3 oral.
// Esta regla permite convertir la exposición solar declarada a
// UNIDADES INTERNACIONALES, que es una unidad que el usuario ya
// entiende porque es la misma de los suplementos.

// MED por fototipo, expresada en SED.
const MED_POR_FOTOTIPO_SED = {
    I:   2.0,  // ~200 J/m²
    II:  2.5,  // ~250 J/m²
    III: 3.0,  // ~300 J/m²
    IV:  4.5,  // ~450 J/m²
    V:   6.0,  // ~600 J/m²
    VI:  8.0   // ~800 J/m²
};

// Índice UV típico según franja horaria en latitud tropical (Panamá,
// ~9°N). El índice UV en Panamá alcanza habitualmente valores de 10-12
// al mediodía durante todo el año, por la baja latitud.
const INDICE_UV_TIPICO = {
    pico: 10,      // 10:00-16:00 en latitud tropical
    no_pico: 3     // antes de las 10:00 o después de las 16:00
};

// Fracción real de superficie corporal expuesta (regla de los nueves
// simplificada), para aplicar la regla de Holick.
const FRACCION_SUPERFICIE_CORPORAL = {
    minima: 0.10,   // cara y manos
    parcial: 0.25,  // cara, brazos y manos — referencia de la regla de Holick
    amplia: 0.50    // además piernas o torso
};

// Meta semanal de vitamina D por vía cutánea, expresada en UI, para
// contrastar con la RDA. Se usa la RDA diaria × 7.
const UI_POR_MCG_VITAMINA_D = 40;
