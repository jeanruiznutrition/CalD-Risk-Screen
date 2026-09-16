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

// ============================================================
// CATÁLOGO UNIFICADO DE ALIMENTOS
// ============================================================
// Un solo cuestionario de frecuencia de consumo que mide los TRES
// nutrientes a la vez: calcio, vitamina D y proteína. Antes había tres
// cuestionarios separados, lo que obligaba al participante a declarar
// el mismo alimento varias veces.
//
// La proteína se estima desde este cuestionario en lugar de
// preguntarla en gramos, porque casi nadie sabe cuánta proteína come.
// Para que esa estimación sea utilizable, el catálogo incluye fuentes
// proteicas que no aportan calcio (cereales, carnes, seitán), sin las
// cuales la proteína quedaría sistemáticamente subestimada.
//
// CADA CAMPO ES EDITABLE POR EL EVALUADOR. Esto es deliberado: el
// contenido real varía por marca y por país, y la herramienta debe
// poder ajustarse al producto que el participante realmente consume.
//
// PROCEDENCIA DE LAS CIFRAS DE CALCIO DEL TOFU:
// Los valores por defecto provienen de etiquetas de producto
// disponibles en el mercado panameño, no de tablas de composición de
// otros países. Se documenta como decisión metodológica: el estudio
// contempla un levantamiento de mercado en Panamá para fijar la base
// de cálculo definitiva. Un mismo tipo de tofu puede variar diez
// veces en calcio según el coagulante que use el fabricante, de modo
// que el campo editable no es un adorno sino el mecanismo previsto
// para registrar el producto concreto de cada participante.
//
// Campos por alimento:
//   calcioPorcion   mg de calcio por porción
//   faAlimento      absorción fraccional medida (Weaver & Heaney)
//   cargaReferencia mg de la porción del ensayo original
//   vitDPorcion     microgramos de vitamina D por porción
//   formaVitD       'D3' | 'D2' | null
//   proteinaPorcion gramos de proteína por porción
//   gramosPorcion   gramos que pesa la porción (editable: varía por marca)

const ALIMENTOS_INICIALES = [
    // ---------- LÁCTEOS Y DERIVADOS ----------
    {
        id: 'leche',
        nombreKey: 'food_milk',
        grupoKey: 'group_dairy',
        calcioPorcion: 300, faAlimento: 0.321, cargaReferencia: 300,
        vitDPorcion: 2.5, formaVitD: 'D3',
        proteinaPorcion: 8,
        gramosPorcion: 240,
        porcionUnidadKey: 'unit_milk',
        icono: 'fa-solid fa-glass-water',
        maxPorciones: 3,
        ocultoEnVegano: true,
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'yogur',
        nombreKey: 'food_yogurt',
        grupoKey: 'group_dairy',
        calcioPorcion: 300, faAlimento: 0.321, cargaReferencia: 300,
        vitDPorcion: 0.1, formaVitD: 'D3',
        proteinaPorcion: 9,
        gramosPorcion: 240,
        porcionUnidadKey: 'unit_yogurt',
        icono: 'fa-solid fa-bowl-rice',
        maxPorciones: 3,
        ocultoEnVegano: true,
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'queso_blanco',
        nombreKey: 'food_white_cheese',
        grupoKey: 'group_dairy',
        calcioPorcion: 200, faAlimento: 0.321, cargaReferencia: 300,
        vitDPorcion: 0.1, formaVitD: 'D3',
        proteinaPorcion: 6,
        gramosPorcion: 28,
        porcionUnidadKey: 'unit_white_cheese',
        icono: 'fa-solid fa-cheese',
        maxPorciones: 4,
        ocultoEnVegano: true,
        fuenteKey: 'src_usda'
    },

    // ---------- HUEVOS, PESCADOS Y CARNES ----------
    {
        id: 'huevo',
        nombreKey: 'food_egg',
        grupoKey: 'group_animal',
        calcioPorcion: 28, faAlimento: 0.321, cargaReferencia: 300,
        vitDPorcion: 1.1, formaVitD: 'D3',
        proteinaPorcion: 6.3,
        gramosPorcion: 50,
        porcionUnidadKey: 'unit_egg',
        icono: 'fa-solid fa-egg',
        maxPorciones: 4,
        ocultoEnVegano: true,
        fuenteKey: 'src_usda'
    },
    {
        id: 'pescado_con_espina',
        nombreKey: 'food_bony_fish',
        grupoKey: 'group_animal',
        calcioPorcion: 325, faAlimento: 0.270, cargaReferencia: 325,
        vitDPorcion: 12.5, formaVitD: 'D3',
        proteinaPorcion: 22,
        gramosPorcion: 100,
        porcionUnidadKey: 'unit_bony_fish_half_cup',
        icono: 'fa-solid fa-fish',
        maxPorciones: 2,
        ocultoEnVegano: true, ocultoEnOvolacto: true,
        fuenteKey: 'src_usda'
    },
    {
        id: 'pescado_sin_espina',
        nombreKey: 'food_fish_fillet',
        grupoKey: 'group_animal',
        calcioPorcion: 15, faAlimento: 0.270, cargaReferencia: 300,
        vitDPorcion: 10, formaVitD: 'D3',
        proteinaPorcion: 22,
        gramosPorcion: 100,
        porcionUnidadKey: 'unit_100g',
        icono: 'fa-solid fa-fish',
        maxPorciones: 2,
        ocultoEnVegano: true, ocultoEnOvolacto: true,
        fuenteKey: 'src_usda'
    },
    {
        id: 'carne_pollo',
        nombreKey: 'food_meat_poultry',
        grupoKey: 'group_animal',
        calcioPorcion: 15, faAlimento: 0.321, cargaReferencia: 300,
        vitDPorcion: 0.2, formaVitD: 'D3',
        proteinaPorcion: 26,
        gramosPorcion: 100,
        porcionUnidadKey: 'unit_100g',
        icono: 'fa-solid fa-drumstick-bite',
        maxPorciones: 3,
        ocultoEnVegano: true, ocultoEnOvolacto: true,
        fuenteKey: 'src_usda'
    },

    // ---------- BEBIDAS VEGETALES Y SOYA ----------
    {
        id: 'bebida_veg_fortificada',
        nombreKey: 'food_fortified_plant_drink',
        grupoKey: 'group_plant',
        calcioPorcion: 300, faAlimento: 0.240, cargaReferencia: 300,
        vitDPorcion: 2.5, formaVitD: 'D2',
        proteinaPorcion: 7,
        gramosPorcion: 250,
        porcionUnidadKey: 'unit_plant_drink',
        icono: 'fa-solid fa-seedling',
        maxPorciones: 3,
        advertenciaKey: 'warn_shake_plant_drink',
        fuenteKey: 'src_label_panama'
    },
    {
        id: 'tofu_extra_firme',
        nombreKey: 'food_tofu_extra_firm',
        grupoKey: 'group_plant',
        // 40 mg por porción de 3 oz; medio bloque equivale a 1.75 porciones
        calcioPorcion: 70, faAlimento: 0.310, cargaReferencia: 258,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 17,
        gramosPorcion: 150,
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        maxPorciones: 3,
        ayudaKey: 'help_tofu_calcium_label',
        fuenteKey: 'src_label_panama'
    },
    {
        id: 'tofu_firme',
        nombreKey: 'food_tofu_firm',
        grupoKey: 'group_plant',
        // 30 mg por porción de 3 oz × 1.75
        calcioPorcion: 53, faAlimento: 0.310, cargaReferencia: 258,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 14,
        gramosPorcion: 150,
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        maxPorciones: 3,
        ayudaKey: 'help_tofu_calcium_label',
        fuenteKey: 'src_label_panama'
    },
    {
        id: 'tofu_suave',
        nombreKey: 'food_tofu_soft',
        grupoKey: 'group_plant',
        // 20 mg por porción de 3 oz × 1.75
        calcioPorcion: 35, faAlimento: 0.310, cargaReferencia: 258,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 8,
        gramosPorcion: 150,
        porcionUnidadKey: 'unit_tofu_half_block',
        icono: 'fa-solid fa-cube',
        maxPorciones: 3,
        ayudaKey: 'help_tofu_calcium_label',
        fuenteKey: 'src_label_panama'
    },
    {
        id: 'seitan_proteina_veg',
        nombreKey: 'food_seitan_veg_protein',
        grupoKey: 'group_plant',
        calcioPorcion: 30, faAlimento: 0.240, cargaReferencia: 300,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 21,
        gramosPorcion: 100,
        porcionUnidadKey: 'unit_100g',
        icono: 'fa-solid fa-bowl-food',
        maxPorciones: 3,
        fuenteKey: 'src_usda'
    },
    {
        id: 'proteina_polvo',
        nombreKey: 'food_protein_powder',
        grupoKey: 'group_plant',
        calcioPorcion: 100, faAlimento: 0.240, cargaReferencia: 300,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 25,
        gramosPorcion: 30,
        porcionUnidadKey: 'unit_scoop',
        icono: 'fa-solid fa-jar',
        maxPorciones: 3,
        fuenteKey: 'src_label_panama'
    },

    // ---------- VEGETALES (SIEMPRE COCIDOS) ----------
    {
        id: 'verduras_bajo_oxalato',
        nombreKey: 'food_low_oxalate_greens',
        grupoKey: 'group_vegetables',
        calcioPorcion: 70, faAlimento: 0.500, cargaReferencia: 70,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 2,
        gramosPorcion: 90,
        porcionUnidadKey: 'unit_half_cup_cooked',
        icono: 'fa-solid fa-leaf',
        maxPorciones: 4,
        soloCocido: true,
        ayudaKey: 'help_low_oxalate_greens',
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'verduras_alto_oxalato',
        nombreKey: 'food_high_oxalate_greens',
        grupoKey: 'group_vegetables',
        calcioPorcion: 115, faAlimento: 0.051, cargaReferencia: 115,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 3,
        gramosPorcion: 90,
        porcionUnidadKey: 'unit_half_cup_cooked',
        icono: 'fa-solid fa-leaf',
        maxPorciones: 4,
        soloCocido: true,
        advertenciaKey: 'warn_high_oxalate',
        ayudaKey: 'help_high_oxalate_greens',
        fuenteKey: 'src_heaney_spinach'
    },
    {
        id: 'hongos_uv',
        nombreKey: 'food_uv_mushrooms',
        grupoKey: 'group_vegetables',
        calcioPorcion: 3, faAlimento: 0.240, cargaReferencia: 300,
        vitDPorcion: 10, formaVitD: 'D2',
        proteinaPorcion: 2,
        gramosPorcion: 70,
        porcionUnidadKey: 'unit_uv_mushrooms',
        icono: 'fa-solid fa-carrot',
        maxPorciones: 2,
        advertenciaKey: 'warn_uv_mushrooms',
        ayudaKey: 'help_uv_mushrooms',
        fuenteKey: 'src_uv_mushrooms'
    },

    // ---------- LEGUMBRES, FRUTOS SECOS Y SEMILLAS ----------
    {
        id: 'legumbres',
        nombreKey: 'food_legumes',
        grupoKey: 'group_legumes',
        calcioPorcion: 60, faAlimento: 0.240, cargaReferencia: 80,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 8,
        gramosPorcion: 90,
        porcionUnidadKey: 'unit_half_cup_cooked',
        icono: 'fa-solid fa-bowl-food',
        maxPorciones: 4,
        soloCocido: true,
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'almendras',
        nombreKey: 'food_almonds',
        grupoKey: 'group_legumes',
        calcioPorcion: 200, faAlimento: 0.212, cargaReferencia: 80,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 15,
        gramosPorcion: 70,
        porcionUnidadKey: 'unit_half_cup',
        icono: 'fa-solid fa-seedling',
        maxPorciones: 4,
        unidadesAlternativas: [
            { key: 'media_taza', calcioPorUnidad: 200, proteinaPorUnidad: 15, labelKey: 'unit_half_cup' },
            { key: 'gramo', calcioPorUnidad: 2.86, proteinaPorUnidad: 0.21, labelKey: 'unit_gram' }
        ],
        unidadSeleccionadaPorDefecto: 'media_taza',
        fuenteKey: 'src_weaver_heaney'
    },
    {
        id: 'ajonjoli_tahini',
        nombreKey: 'food_sesame_tahini',
        grupoKey: 'group_legumes',
        calcioPorcion: 350, faAlimento: 0.208, cargaReferencia: 37,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 13,
        gramosPorcion: 70,
        porcionUnidadKey: 'unit_half_cup',
        icono: 'fa-solid fa-seedling',
        maxPorciones: 4,
        unidadesAlternativas: [
            { key: 'media_taza', calcioPorUnidad: 350, proteinaPorUnidad: 13, labelKey: 'unit_half_cup' },
            { key: 'gramo', calcioPorUnidad: 5.0, proteinaPorUnidad: 0.19, labelKey: 'unit_gram' }
        ],
        unidadSeleccionadaPorDefecto: 'media_taza',
        ayudaKey: 'help_sesame',
        fuenteKey: 'src_weaver_heaney'
    },

    // ---------- CEREALES Y FORTIFICADOS ----------
    {
        id: 'cereales_granos',
        nombreKey: 'food_grains',
        grupoKey: 'group_grains',
        calcioPorcion: 20, faAlimento: 0.240, cargaReferencia: 300,
        vitDPorcion: 0, formaVitD: null,
        proteinaPorcion: 4,
        gramosPorcion: 100,
        porcionUnidadKey: 'unit_grains',
        icono: 'fa-solid fa-wheat-awn',
        maxPorciones: 4,
        fuenteKey: 'src_usda'
    },
    {
        id: 'cereal_fortificado',
        nombreKey: 'food_fortified_cereal',
        grupoKey: 'group_grains',
        calcioPorcion: 250, faAlimento: 0.240, cargaReferencia: 300,
        vitDPorcion: 1.75, formaVitD: 'D2',
        proteinaPorcion: 3,
        gramosPorcion: 40,
        porcionUnidadKey: 'unit_serving',
        icono: 'fa-solid fa-bowl-rice',
        maxPorciones: 2,
        advertenciaKey: 'warn_check_label_vitd',
        fuenteKey: 'src_label_panama'
    }
];

// Plantilla para alimentos que el evaluador agrega. Los tres nutrientes
// son editables, igual que en el resto del catálogo.
const PLANTILLA_ALIMENTO_EXTRA = {
    nombreKey: 'food_custom',
    grupoKey: 'group_custom',
    calcioPorcion: 0, faAlimento: 0.240, cargaReferencia: 300,
    vitDPorcion: 0, formaVitD: 'D3',
    proteinaPorcion: 0,
    gramosPorcion: 100,
    porcionUnidadKey: 'unit_serving',
    icono: 'fa-solid fa-tag',
    maxPorciones: 4,
    editableNombre: true
};
// Alias por compatibilidad con versiones anteriores
const PLANTILLA_ALIMENTO_FORTIFICADO_EXTRA = PLANTILLA_ALIMENTO_EXTRA;

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

// NOTA v6.0: el modelo de "índice solar" en unidades arbitrarias que
// vivía aquí (FACTOR_HORARIO, FACTOR_FOTOTIPO, FACTOR_SUPERFICIE_CORPORAL
// y sus dos umbrales) fue RETIRADO. Era código muerto: ninguna parte de la
// aplicación lo llamaba, porque la interfaz ya usaba el modelo
// estandarizado SED/MED/UI de la sección 12. Mantener dos modelos, uno de
// ellos sin usar pero documentado en el README como si calculara, impide
// que un revisor sepa qué ruta produjo el resultado. Ahora hay una sola.
// La franja horaria ya no aplica un factor multiplicativo: determina el
// ángulo horario solar con el que se estima el índice UV (sección 12b).

// Declive de la síntesis cutánea con la edad. Terushkin et al.
// (J Am Acad Dermatol 2010) usan af = 1 − 0.015 × (edad − 20);
// una persona de 70 años produce ~75% menos que una de 20.
const calcularFactorEdadSintesis = (edad) => {
    const e = Number(edad) || 20;
    if (e <= 20) return 1.0;
    return Math.max(0.25, 1 - 0.015 * (e - 20));
};

// El efecto del fototipo se modela donde corresponde: en la MED expresada
// en SED (sección 12, MED_POR_FOTOTIPO_SED), que es la magnitud que la
// literatura fotobiológica publica. La superficie corporal, igual: en
// FRACCION_SUPERFICIE_CORPORAL, como fracción real y no como multiplicador
// adimensional.


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
// Se conserva SOLO como reserva para cuando no se declaren latitud y mes;
// el cálculo normal usa el modelo de cielo claro de la sección 12b, que
// reproduce estos mismos valores para Panamá y además generaliza a
// cualquier latitud y época del año.
const INDICE_UV_TIPICO = {
    pico: 10,      // 10:00-16:00 en latitud tropical
    no_pico: 3     // antes de las 10:00 o después de las 16:00
};


// ============================================================
// 12b. ÍNDICE UV DE CIELO CLARO A PARTIR DE LATITUD, MES Y HORA
// ============================================================
// PROBLEMA QUE RESUELVE: fijar el índice UV a la latitud de Panamá hace
// que la herramienta dé el mismo resultado en Helsinki en diciembre que
// en Ciudad de Panamá en marzo, cuando la diferencia real es de más de un
// orden de magnitud. Como la aplicación se publica en varios idiomas, el
// índice UV tiene que derivarse de la geometría solar.
//
// El índice UV de cielo claro se aproxima bien con una parametrización
// empírica en el coseno del ángulo cenital solar (μ) y el ozono total:
//
//     UVI ≈ UVI_COEF × μ^UVI_EXP × (ozono / 300 DU)^UVI_EXP_OZONO
//
// Es la forma funcional de las parametrizaciones de transferencia
// radiativa al uso en fotobiología. Los coeficientes están fijados para
// reproducir los máximos observados: Panamá (9°N) da 11.6 al mediodía
// solar en equinoccio, frente a los 10-12 que se miden allí; Helsinki
// (60°N) da 7.3 en el solsticio de junio, frente a los 6-7 observados.
// Es una cota superior: asume cielo despejado, nivel del mar y ausencia
// de aerosoles. La interfaz permite anularlo con el valor medido.
//
// Geometría solar (Cooper 1969 para la declinación; relación estándar
// del ángulo cenital):
//     δ   = 23.45° × sin(360° × (284 + N) / 365)        N = día del año
//     h   = 15° × (hora solar − 12)
//     μ   = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(h)
const UVI_COEF = 12.5;
const UVI_EXP_MU = 2.42;
const UVI_EXP_OZONO = -1.23;
const OZONO_REFERENCIA_DU = 300;
const DECLINACION_MAXIMA_GRADOS = 23.45;
// La radiación UV aumenta aproximadamente 6% por cada 1000 m de altitud.
const FACTOR_UV_POR_KM_ALTITUD = 0.06;

// Día del año representativo de cada mes (día 15), para no pedir la fecha
// exacta: la declinación solar cambia poco dentro de un mes.
const DIA_REPRESENTATIVO_POR_MES = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349];

// Horas solares de referencia de cada franja, expresadas como distancia
// al mediodía solar. La franja pico (10:00-16:00) se representa con un
// desplazamiento pequeño porque la exposición declarada en esa franja se
// concentra alrededor del mediodía; la franja no pico, con 3 horas.
const DESPLAZAMIENTO_HORARIO_SOLAR = { pico: 0.75, no_pico: 3.0 };

// Latitud por defecto: Ciudad de Panamá, donde se realiza el estudio.
const LATITUD_POR_DEFECTO = 8.98;


// ============================================================
// 12c. CATEGORIZACIÓN DE LA EXPOSICIÓN SOLAR
// ============================================================
// La categoría solar se deriva del equivalente en UI de vitamina D por
// día frente a la ingesta de referencia, que es una comparación con
// significado. Sustituye a los umbrales en unidades arbitrarias.
// Los cortes (100% y 40% de la referencia) son de CRIBADO y quedan
// pendientes de calibrar contra la 25(OH)D sérica del estudio: grado
// heurístico declarado.
const UMBRAL_SOLAR_SUFICIENTE_FRACCION_RDA = 1.00;
const UMBRAL_SOLAR_MODERADO_FRACCION_RDA = 0.40;

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


// ------------------------------------------------------------
// FORMAS DE SUPLEMENTO DE VITAMINA D
// ------------------------------------------------------------
// La D3 (colecalciferol) eleva la 25(OH)D sérica con más eficacia que
// la D2 (ergocalciferol). Existe D3 obtenida de liquen, apta para
// dietas veganas, por lo que ser vegano no obliga a usar D2.
const FORMAS_SUPLEMENTO_VITD = [
    { id: 'D3', potencia: POTENCIA_VITD3, key: 'vitd_form_d3' },
    { id: 'D2', potencia: POTENCIA_VITD2, key: 'vitd_form_d2' },
    { id: 'desconocida', potencia: POTENCIA_VITD2, key: 'vitd_form_unknown' }
];

// ------------------------------------------------------------
// GRUPOS DEL CUESTIONARIO UNIFICADO
// ------------------------------------------------------------
const GRUPOS_ALIMENTOS = [
    { id: 'group_dairy',      key: 'group_dairy' },
    { id: 'group_animal',     key: 'group_animal' },
    { id: 'group_plant',      key: 'group_plant' },
    { id: 'group_vegetables', key: 'group_vegetables' },
    { id: 'group_legumes',    key: 'group_legumes' },
    { id: 'group_grains',     key: 'group_grains' },
    { id: 'group_custom',     key: 'group_custom' }
];


// ============================================================
// 13. PÉRDIDAS URINARIAS: INGESTAS DE REFERENCIA
// ============================================================
// CORRECCIÓN METODOLÓGICA DE LA v6.0. Hasta la v3.1 la pérdida urinaria
// de calcio atribuible al sodio y a la cafeína se restaba COMPLETA del
// calcio absorbido, y el resultado se comparaba contra una meta derivada
// de la RDA del IOM. Eso cuenta dos veces la misma pérdida: las RDA de
// calcio del IOM/NASEM (2011) se derivaron de estudios de balance hechos
// en poblaciones con ingestas habituales de sodio y cafeína, de modo que
// la excreción urinaria típica YA está incorporada en los 1000-1200 mg.
//
// La v6.0 modela el EXCESO (o el defecto) respecto a la ingesta de
// referencia con la que se derivaron esos balances:
//
//     perdida = (sodio − SODIO_REF) × k_Na + (tazas − CAFE_REF) × k_caf
//
// El signo se conserva a propósito: quien consume menos sodio que la
// referencia recibe un crédito, no un castigo. Sin esta corrección, un
// participante que cumplía exactamente la ingesta de referencia salía
// clasificado como deficitario por 30 mg/día que nunca perdió.
const SODIO_REFERENCIA_G_DIA = 3.0;   // mediana de ingesta adulta en los estudios de balance
const CAFE_REFERENCIA_TAZAS_DIA = 1;  // consumo habitual de referencia


// ============================================================
// 14. CALCIO DEL AGUA DE CONSUMO
// ============================================================
// Fuente de calcio sistemáticamente ignorada por los cuestionarios de
// frecuencia. Un agua dura puede aportar 100-300 mg/día, cifra del mismo
// orden que una porción de lácteo, y su biodisponibilidad es alta: la
// absorción fraccional del calcio del agua mineral es comparable a la de
// la leche (Couzy et al., Am J Clin Nutr 1995; Heaney & Dowell,
// Osteoporos Int 1994). Se pregunta como concentración en mg/L —que es lo
// que trae la etiqueta del agua envasada o el informe de la red— y
// litros/día, en vez de pedir un total que nadie conoce.
const FA_AGUA = 0.30;                  // absorción fraccional del calcio del agua
const CARGA_REFERENCIA_AGUA_MG = 120;  // carga de los ensayos de referencia
const CONCENTRACION_AGUA_POR_DEFECTO_MG_L = 0;  // se declara explícitamente
const LITROS_AGUA_POR_DEFECTO = 0;

// Tipos de agua con su concentración orientativa de calcio, para cuando
// el participante no tiene el dato de la etiqueta.
const TIPOS_AGUA = [
    { id: 'no_declarada', mgPorLitro: 0,   key: 'water_undeclared' },
    { id: 'blanda',       mgPorLitro: 20,  key: 'water_soft' },
    { id: 'media',        mgPorLitro: 60,  key: 'water_medium' },
    { id: 'dura',         mgPorLitro: 120, key: 'water_hard' },
    { id: 'mineral_alta', mgPorLitro: 300, key: 'water_high_mineral' },
    { id: 'personalizada', mgPorLitro: null, key: 'water_custom' }
];


// ============================================================
// 15. INHIBIDORES DE LA BOMBA DE PROTONES: AYUNO VS CON COMIDA
// ============================================================
// El factor único de la v3.1 (0.55 sobre el carbonato) proviene de
// estudios en AYUNO. O'Connell et al. (Am J Med 2005) midieron en
// mujeres mayores que el omeprazol reducía la absorción fraccional de
// carbonato de calcio del 9.1% al 3.5% cuando se tomaba en ayuno. Pero
// ese mismo carbonato tomado CON alimentos se disuelve con el ácido que
// la propia comida estimula, y la penalización casi desaparece.
//
// Aplicar el factor de ayuno a todo el mundo sobrestima el problema en la
// mayoría de los usuarios, que toman el suplemento con la comida —que es
// además lo que la etiqueta indica. La v6.0 condiciona el factor al
// momento de la toma, que ahora se pregunta.
const FACTOR_IBP_CARBONATO_AYUNO = 0.40;
const FACTOR_IBP_CARBONATO_CON_COMIDA = 0.85;
// Se conserva el nombre de la v3.1 para no romper la suite de pruebas
// existente; su valor es ahora el caso con comida, que es el escenario
// por defecto de la herramienta.
// (FACTOR_IBP_SOBRE_CARBONATO y FACTOR_IBP_SOBRE_CITRATO están declarados
//  en la sección 11.)
const MOMENTOS_TOMA_SUPLEMENTO = [
    { id: 'con_comida', key: 'supp_timing_with_meal' },
    { id: 'ayuno',      key: 'supp_timing_fasting' }
];


// ============================================================
// 16. CALIDAD PROTEICA: DIAAS Y LEUCINA
// ============================================================
// La v3.1 corregía la menor calidad de la proteína vegetal con un factor
// global de 1.1 sobre el objetivo. Es una aproximación gruesa: la
// digestibilidad y el perfil de aminoácidos varían mucho MÁS entre
// fuentes vegetales que entre vegetal y animal (el gluten de trigo y la
// proteína de soja no se parecen en nada).
//
// La v6.0 calcula PROTEÍNA UTILIZABLE ponderando cada porción por el
// DIAAS de su fuente (Digestible Indispensable Amino Acid Score, el
// indicador que la FAO adoptó en 2013 en sustitución del PDCAAS):
//
//     proteina_utilizable = Σ (gramos_alimento × DIAAS_alimento)
//
// Valores en fracción (1.00 = 100%). Los marcados como medidos provienen
// de la recopilación de Herreman et al. (Food Sci Nutr 2020;8:5379) y del
// informe de la FAO (2013); los marcados como estimados corresponden a
// alimentos cuyo DIAAS no está publicado y se infiere de su grupo.
// El DIAAS se define para un patrón de aminoácidos y un grupo de edad
// concretos; aquí se usa el patrón de adulto.
const DIAAS_POR_ALIMENTO = {
    leche:                    { valor: 1.14, grado: 'medido' },
    yogur:                    { valor: 1.06, grado: 'medido' },
    queso_blanco:             { valor: 1.08, grado: 'medido' },
    huevo:                    { valor: 1.13, grado: 'medido' },
    pescado_con_espina:       { valor: 1.00, grado: 'medido' },
    pescado_sin_espina:       { valor: 1.00, grado: 'medido' },
    carne_pollo:              { valor: 1.08, grado: 'medido' },
    bebida_veg_fortificada:   { valor: 0.84, grado: 'medido' },   // base de soja; el resto de bases es mucho menor
    tofu_extra_firme:         { valor: 0.56, grado: 'medido' },
    tofu_firme:               { valor: 0.56, grado: 'medido' },
    tofu_suave:               { valor: 0.56, grado: 'medido' },
    seitan_proteina_veg:      { valor: 0.25, grado: 'medido' },   // gluten de trigo: limitante en lisina
    proteina_polvo:           { valor: 0.90, grado: 'estimado' }, // depende del tipo; ver DIAAS_PROTEINA_POLVO
    verduras_bajo_oxalato:    { valor: 0.70, grado: 'estimado' },
    verduras_alto_oxalato:    { valor: 0.70, grado: 'estimado' },
    hongos_uv:               { valor: 0.60, grado: 'estimado' },
    legumbres:                { valor: 0.70, grado: 'medido' },   // mediana de guisante, garbanzo y lenteja
    almendras:                { valor: 0.40, grado: 'medido' },
    ajonjoli_tahini:          { valor: 0.50, grado: 'estimado' },
    cereales_granos:          { valor: 0.50, grado: 'medido' },   // mediana de trigo, arroz y avena
    cereal_fortificado:       { valor: 0.50, grado: 'estimado' }
};
const DIAAS_POR_DEFECTO = 0.70;  // alimento añadido por el evaluador

// DIAAS por tipo de proteína en polvo, para el suplemento de
// entrenamiento que la herramienta ya registra con detalle.
const DIAAS_PROTEINA_POLVO = {
    whey_hidrolizada: 1.05,
    whey_aislada:     1.09,
    whey_concentrada: 1.05,
    caseina:          1.17,
    huevo:            1.13,
    carne:            0.90,
    soja:             0.90,
    chicharo:         0.82,
    mezcla_vegetal:   0.85
};

// Contenido de leucina, en gramos por gramo de proteína. Relevante por el
// umbral anabólico: para estimular la síntesis proteica muscular en el
// adulto mayor hace falta una cantidad mínima de leucina POR COMIDA, no
// solo un total diario suficiente (Bauer et al., PROT-AGE, J Am Med Dir
// Assoc 2013; Deutz et al., ESPEN, Clin Nutr 2014). Un participante puede
// alcanzar su meta diaria repartida en porciones pequeñas y no cruzar el
// umbral en ninguna comida.
const LEUCINA_POR_G_PROTEINA = {
    leche: 0.100, yogur: 0.100, queso_blanco: 0.100, huevo: 0.086,
    pescado_con_espina: 0.082, pescado_sin_espina: 0.082, carne_pollo: 0.082,
    bebida_veg_fortificada: 0.080, tofu_extra_firme: 0.080, tofu_firme: 0.080,
    tofu_suave: 0.080, seitan_proteina_veg: 0.070, proteina_polvo: 0.100,
    verduras_bajo_oxalato: 0.070, verduras_alto_oxalato: 0.070, hongos_uv: 0.070,
    legumbres: 0.075, almendras: 0.072, ajonjoli_tahini: 0.070,
    cereales_granos: 0.070, cereal_fortificado: 0.070
};
const LEUCINA_POR_G_PROTEINA_DEFECTO = 0.080;

// Umbral de leucina por comida en el adulto mayor y objetivo de proteína
// por comida asociado (PROT-AGE / ESPEN).
const LEUCINA_UMBRAL_POR_COMIDA_G = 2.5;
const PROTEINA_OBJETIVO_POR_COMIDA_MAYOR_G = 25;
const EDAD_CORTE_UMBRAL_LEUCINA = 65;


// ============================================================
// 17. PLAUSIBILIDAD DEL CUESTIONARIO DE FRECUENCIA
// ============================================================
// El catálogo es corto a propósito, lo que es defendible, pero implica
// que la proteína estimada queda por debajo de la real. Sin una
// verificación, una entrevista en la que el participante se cansó y
// respondió 0 a la mitad del cuestionario entra al análisis con el mismo
// peso que una completa.
//
// Se aplica la lógica de los puntos de corte de Goldberg (Goldberg et
// al., Eur J Clin Nutr 1991; Black, Int J Obes 2000): comparar lo
// declarado con el requerimiento mínimo plausible del participante. Aquí
// se instrumenta sobre la proteína, que es lo que el cuestionario
// estima, y no sobre la energía, que no se mide.
// No descarta al participante: lo MARCA, y la decisión de excluir queda
// documentada en el análisis.
const PLAUSIBILIDAD_PROTEINA_FRACCION_MINIMA = 0.50;  // <50% del objetivo: subregistro probable
const PLAUSIBILIDAD_MINIMO_ALIMENTOS_DECLARADOS = 3;  // menos de 3 alimentos: cuestionario incompleto
const PLAUSIBILIDAD_PROTEINA_FRACCION_MAXIMA = 3.00;  // >300%: sobredeclaración o error de unidad


// ============================================================
// 18. RANGOS DE REFERENCIA DE LABORATORIO
// ============================================================
// Rangos de adulto. Varían entre laboratorios: son los del método más
// habitual y la herramienta los muestra como referencia, no como
// criterio diagnóstico. La interpretación clínica corresponde al médico
// tratante con el rango del laboratorio que emitió el informe.
const RANGOS_LABORATORIO = {
    // Albúmina: necesaria para corregir el calcio total (ver biomarkers.js)
    albumina:          { min: 3.5, max: 5.0, unidad: 'g/dL' },
    // Paratohormona intacta. El ascenso de la PTH es el mecanismo por el
    // que la insuficiencia de vitamina D produce pérdida ósea, y precede
    // a cualquier cambio del calcio sérico.
    ptHormonaIntacta:  { min: 15,  max: 65,  unidad: 'pg/mL' },
    // Fósforo sérico
    fosforo:           { min: 2.5, max: 4.5, unidad: 'mg/dL' },
    // Fosfatasa alcalina total: marcador de recambio óseo cuando no hay
    // colestasis. Su elevación con 25(OH)D baja y PTH alta es el patrón
    // del hiperparatiroidismo secundario con osteomalacia.
    fosfatasaAlcalina: { min: 40,  max: 129, unidad: 'U/L' },
    // Magnesio: cofactor obligado de la 1α-hidroxilación renal y de la
    // secreción de PTH. La hipomagnesemia produce resistencia al
    // tratamiento con vitamina D.
    magnesio:          { min: 1.7, max: 2.2, unidad: 'mg/dL' },
    // Creatinina sérica, para la tasa de filtración glomerular estimada
    creatinina:        { min: 0.6, max: 1.2, unidad: 'mg/dL' }
};

// Calcio urinario de 24 horas. La hipercalciuria es una causa tratable de
// pérdida ósea y un contraindicador relativo de la suplementación.
const CALCIO_URINARIO_24H_MAX = { femenino: 250, masculino: 300, unidad: 'mg/24h' };
// Umbral por peso, más robusto que el valor absoluto
const CALCIO_URINARIO_POR_KG_MAX = 4;  // mg/kg/24 h
// Razón calcio/creatinina en muestra aislada (mg/mg)
const RAZON_CALCIO_CREATININA_MAX = 0.20;

// Ecuación CKD-EPI 2021, SIN término racial (Inker et al., N Engl J Med
// 2021;385:1737). Es la ecuación vigente recomendada por NKF-ASN:
//
//   TFGe = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^(−1.200)
//               × 0.9938^edad × (1.012 si mujer)
//
// Importa aquí por dos razones: (1) la 1α-hidroxilación de la vitamina D
// es renal, así que una TFGe baja cambia por completo la interpretación
// de la 25(OH)D; (2) la herramienta ya registra el uso de creatina, que
// eleva la creatinina sérica sin que exista daño renal, y por tanto
// SUBESTIMA la TFGe — lo que la v6.0 señala explícitamente.
const CKD_EPI_2021 = {
    coeficiente: 142,
    kappa:    { femenino: 0.7,    masculino: 0.9 },
    alfa:     { femenino: -0.241, masculino: -0.302 },
    exponenteSuperior: -1.200,
    factorEdad: 0.9938,
    factorSexoFemenino: 1.012
};

// Estadios KDIGO de la enfermedad renal crónica por TFGe
// (mL/min/1.73 m²). KDIGO 2012 / 2024.
const ESTADIOS_KDIGO = [
    { id: 'G1',  min: 90,  max: Infinity, key: 'kdigo_g1' },
    { id: 'G2',  min: 60,  max: 89.99,    key: 'kdigo_g2' },
    { id: 'G3a', min: 45,  max: 59.99,    key: 'kdigo_g3a' },
    { id: 'G3b', min: 30,  max: 44.99,    key: 'kdigo_g3b' },
    { id: 'G4',  min: 15,  max: 29.99,    key: 'kdigo_g4' },
    { id: 'G5',  min: 0,   max: 14.99,    key: 'kdigo_g5' }
];

// Fórmula de Payne para el calcio corregido por albúmina
// (Payne et al., BMJ 1973;4:643):
//   Ca_corregido = Ca_medido + 0.8 × (4.0 − albúmina)
// Aproximación: el patrón es el calcio iónico cuando la decisión
// depende del valor.
const PAYNE_PENDIENTE = 0.8;
const PAYNE_ALBUMINA_REFERENCIA = 4.0;


// ============================================================
// 19. ÍNDICES VALIDADOS DE CRIBADO DE DENSIDAD MINERAL ÓSEA BAJA
// ============================================================
// El puntaje óseo compuesto de la herramienta es una construcción propia
// pendiente de calibrar con DXA. Para que el estudio tenga un comparador
// externo desde el primer participante, la v6.0 añade dos índices
// publicados, de dominio público y calculables sin licencia —a diferencia
// de FRAX, cuya exclusión sigue siendo correcta.
//
// OST (Osteoporosis Self-assessment Tool; Koh et al., Osteoporos Int
// 2001, derivado en mujeres asiáticas y validado después en otras
// poblaciones):
//       OST = 0.2 × (peso_kg − edad_años), truncado a entero
// Interpretación en la formulación original (OSTA): > −1 riesgo bajo,
// −1 a −4 riesgo intermedio, < −4 riesgo alto de densidad mineral ósea
// baja. Su desempeño es mejor en mujeres posmenopáusicas que en varones.
const OST_COEFICIENTE = 0.2;
const OST_CORTE_BAJO = -1;
const OST_CORTE_ALTO = -4;

// ORAI (Osteoporosis Risk Assessment Instrument; Cadarette et al., CMAJ
// 2000;162:1289). Derivado y validado en mujeres de 45 años o más;
// sensibilidad reportada 93.3% y especificidad 46.4% para detectar
// densidad mineral ósea baja con un corte de ≥9.
// NO es aplicable a varones: la herramienta lo omite en ese caso en vez
// de calcularlo fuera de su población de derivación.
const ORAI_PUNTOS_EDAD = [
    { min: 75, max: 200, puntos: 15 },
    { min: 65, max: 74,  puntos: 9 },
    { min: 55, max: 64,  puntos: 5 },
    { min: 0,  max: 54,  puntos: 0 }
];
const ORAI_PUNTOS_PESO = [
    { min: 0,  max: 59.99, puntos: 9 },
    { min: 60, max: 69.99, puntos: 3 },
    { min: 70, max: 999,   puntos: 0 }
];
const ORAI_PUNTOS_SIN_ESTROGENOS = 2;
const ORAI_CORTE = 9;
const ORAI_EDAD_MINIMA_APLICABLE = 45;


// ============================================================
// 20. SARC-CalF Y CIRCUNFERENCIA DE PANTORRILLA AJUSTADA POR IMC
// ============================================================
// La v3.1 usaba la circunferencia de pantorrilla como bandera paralela.
// El instrumento validado funciona de otro modo: SARC-CalF
// (Barbosa-Silva et al., J Am Med Dir Assoc 2016;17:1136) incorpora la
// circunferencia como SEXTO ÍTEM puntuado 0 o 10, y el corte del total
// pasa de ≥4 a ≥11. Con esa formulación la sensibilidad sube de forma
// sustancial respecto al SARC-F solo, que es exactamente la limitación
// que la herramienta ya documentaba.
const SARC_CALF_PUNTOS_PANTORRILLA_BAJA = 10;
const UMBRAL_SARC_CALF = 11;

// Los cortes fijos de 33/34 cm tienen un sesgo conocido por adiposidad:
// en obesidad la pantorrilla es gruesa aunque la masa muscular sea baja,
// y en delgadez ocurre lo inverso. González et al. (J Cachexia Sarcopenia
// Muscle 2021;12:1359) propusieron ajustar la circunferencia medida en
// función del IMC antes de aplicar el corte.
const AJUSTE_PANTORRILLA_POR_IMC = [
    { imcMin: 0,    imcMax: 18.49, ajusteCm: 4 },
    { imcMin: 18.5, imcMax: 24.99, ajusteCm: 0 },
    { imcMin: 25,   imcMax: 29.99, ajusteCm: -3 },
    { imcMin: 30,   imcMax: 999,   ajusteCm: -7 }
];


// ============================================================
// 21. VITAMINA D Y TAMAÑO CORPORAL
// ============================================================
// La vitamina D es liposoluble y se distribuye en el compartimento
// graso, de modo que a igual dosis la concentración sérica alcanzada es
// inversamente proporcional a la masa corporal: es dilución volumétrica,
// no un defecto de absorción (Drincic et al., Obesity 2012;20:1444).
// Ekwaru et al. (PLoS One 2014;9:e111265) cuantificaron que alcanzar la
// misma 25(OH)D requiere del orden de 1.5 veces la dosis en sobrepeso y
// 2-3 veces en obesidad.
//
// La herramienta ya captura peso y talla y ya calcula el IMC para el
// CSV, pero no lo usaba en ningún cálculo. Ahora escala la meta de
// ingesta. El multiplicador es un ajuste ORIENTATIVO derivado de esos
// estudios observacionales, no un valor de guía: se declara como tal y
// se reporta siempre junto a la meta sin ajustar.
const MULTIPLICADOR_VITD_POR_IMC = [
    { imcMin: 0,    imcMax: 24.99, factor: 1.0, key: 'vitd_bw_normal' },
    { imcMin: 25,   imcMax: 29.99, factor: 1.5, key: 'vitd_bw_overweight' },
    { imcMin: 30,   imcMax: 34.99, factor: 2.0, key: 'vitd_bw_obese1' },
    { imcMin: 35,   imcMax: 999,   factor: 2.5, key: 'vitd_bw_obese2' }
];

// Categorías de IMC de la OMS, para el informe y la estratificación.
const CATEGORIAS_IMC = [
    { min: 0,    max: 18.49, id: 'bajo_peso',  key: 'bmi_underweight' },
    { min: 18.5, max: 24.99, id: 'normal',     key: 'bmi_normal' },
    { min: 25,   max: 29.99, id: 'sobrepeso',  key: 'bmi_overweight' },
    { min: 30,   max: 34.99, id: 'obesidad_1', key: 'bmi_obese1' },
    { min: 35,   max: 39.99, id: 'obesidad_2', key: 'bmi_obese2' },
    { min: 40,   max: 999,   id: 'obesidad_3', key: 'bmi_obese3' }
];


// ============================================================
// 22. REGISTRO DE PARÁMETROS Y HUELLA DEL MODELO
// ============================================================
// POR QUÉ EXISTE ESTA SECCIÓN
//
// Un estudio de validación que dure meses va a ajustar parámetros: el
// README de la v2.0 ya anuncia que las cifras de composición panameñas
// DEBEN contrastarse con etiquetas del mercado local. Si eso ocurre a
// mitad del reclutamiento y las filas exportadas no llevan constancia de
// con qué valores se calcularon, las filas de antes y de después quedan
// mezcladas sin forma de distinguirlas. Eso invalida el análisis o
// obliga a recalcular todo a mano.
//
// La solución es que cada fila exportada lleve (a) la versión del motor
// y (b) una huella determinista del conjunto completo de parámetros. Si
// alguien cambia un solo coeficiente, la huella cambia, y el análisis
// puede separar los subconjuntos o detener el reclutamiento.
//
// Cada parámetro declara además su GRADO DE EVIDENCIA, que es la pieza
// que faltaba para poder afirmar que la herramienta está basada en
// evidencia sin que sea una frase de propaganda:
//
//   'medido'      valor experimental publicado (isótopos, ensayo clínico)
//   'consenso'    valor fijado por un organismo de referencia (IOM, EFSA, OMS)
//   'derivado'    calculado a partir de valores publicados
//   'estimado'    inferido por analogía con su grupo, sin medición directa
//   'heuristico'  calibración propia de cribado, PENDIENTE de validación
//
// Los parámetros de grado 'heuristico' son exactamente los que el estudio
// en curso debe calibrar. La herramienta los enumera sola: no hay que
// buscarlos en el código.

// ------------------------------------------------------------
// Cortes de decisión de la conducta sugerida
// ------------------------------------------------------------
// Deciden qué se le dice al participante: si mantiene su patrón, si lo
// ajusta, o si se le deriva para evaluar suplementación. Son de CRIBADO
// y grado heurístico declarado: el estudio de validación debe calibrarlos
// contra la 25-hidroxivitamina D sérica y el método dietético de
// referencia. Van en el registro de parámetros, de modo que la huella del
// modelo cambia si alguien los mueve y las filas exportadas antes y
// después quedan distinguibles.
const CONDUCTA_CALCIO_CUBRE = 100;       // % de la meta absorbida: cubre
const CONDUCTA_CALCIO_LIMITE = 75;       // por debajo: brecha real
const CONDUCTA_CALCIO_DIETA_VIABLE = 50; // por debajo: la dieta sola difícilmente basta

const CARDA_VERSION = '6.0';

const REGISTRO_PARAMETROS = [
    // --- Absorción de calcio ---
    { clave: 'FA_INTERCEPTO', valor: FA_INTERCEPTO, unidad: 'fracción', grado: 'medido',
      fuente: 'Heaney RP, Weaver CM, Fitzsimmons ML. J Bone Miner Res 1990;5:1135' },
    { clave: 'FA_PENDIENTE_LN', valor: FA_PENDIENTE_LN, unidad: 'fracción/ln(mg)', grado: 'medido',
      fuente: 'Heaney RP, Weaver CM, Fitzsimmons ML. J Bone Miner Res 1990;5:1135' },
    { clave: 'FA_MINIMA', valor: FA_MINIMA, unidad: 'fracción', grado: 'estimado',
      fuente: 'Piso fisiológico por difusión paracelular residual' },
    { clave: 'FA_MAXIMA', valor: FA_MAXIMA, unidad: 'fracción', grado: 'estimado',
      fuente: 'Techo fisiológico del transporte activo a cargas muy bajas' },
    { clave: 'FA_REFERENCIA_LECHE', valor: FA_REFERENCIA_LECHE, unidad: 'fracción', grado: 'medido',
      fuente: 'Weaver CM, Heaney RP. Am J Clin Nutr 1999;70(3 Suppl):543S' },
    { clave: 'CARGA_RECOMENDADA_MAXIMA_POR_TOMA', valor: CARGA_RECOMENDADA_MAXIMA_POR_TOMA, unidad: 'mg', grado: 'consenso',
      fuente: 'Umbral convencional de fraccionamiento derivado de la curva de saturación' },
    { clave: 'FA_AGUA', valor: FA_AGUA, unidad: 'fracción', grado: 'medido',
      fuente: 'Couzy F et al. Am J Clin Nutr 1995;62:1239; Heaney RP, Dowell MS. Osteoporos Int 1994;4:323' },

    // --- Marcos de referencia de ingesta ---
    { clave: 'UMBRAL_PROTECTOR_EPIC_OXFORD_MG', valor: UMBRAL_PROTECTOR_EPIC_OXFORD_MG, unidad: 'mg/día', grado: 'medido',
      fuente: 'Appleby P et al. Eur J Clin Nutr 2007;61:1400 (EPIC-Oxford)' },
    { clave: 'MARCO_CALCIO_IOM.rda_adulto', valor: 1000, unidad: 'mg/día', grado: 'consenso',
      fuente: 'IOM/NASEM. Dietary Reference Intakes for Calcium and Vitamin D. 2011' },
    { clave: 'MARCO_CALCIO_EFSA.pri_adulto', valor: 950, unidad: 'mg/día', grado: 'consenso',
      fuente: 'EFSA NDA Panel. EFSA Journal 2015;13(5):4101' },

    // --- Pérdidas urinarias ---
    { clave: 'CALCIO_PERDIDO_POR_GRAMO_SODIO', valor: CALCIO_PERDIDO_POR_GRAMO_SODIO, unidad: 'mg Ca/g Na', grado: 'derivado',
      fuente: '20-30 mg de calcio por 2300 mg de sodio excretado; IOM/NASEM 2011, cap. 4' },
    { clave: 'SODIO_REFERENCIA_G_DIA', valor: SODIO_REFERENCIA_G_DIA, unidad: 'g/día', grado: 'derivado',
      fuente: 'Ingesta habitual de los estudios de balance con que se derivó la RDA; corrige el doble conteo de la v3.1' },
    { clave: 'CALCIO_PERDIDO_POR_TAZA_CAFE', valor: CALCIO_PERDIDO_POR_TAZA_CAFE, unidad: 'mg Ca/taza', grado: 'derivado',
      fuente: '2-3 mg de calcio por 100 mg de cafeína; 95 mg de cafeína por taza' },
    { clave: 'CAFE_REFERENCIA_TAZAS_DIA', valor: CAFE_REFERENCIA_TAZAS_DIA, unidad: 'tazas/día', grado: 'derivado',
      fuente: 'Consumo de referencia para el modelo de exceso' },

    // --- Inhibidores ---
    { clave: 'FACTOR_IBP_CARBONATO_AYUNO', valor: FACTOR_IBP_CARBONATO_AYUNO, unidad: 'factor', grado: 'medido',
      fuente: "O'Connell MB et al. Am J Med 2005;118:778 (absorción 9.1% → 3.5% con omeprazol en ayuno)" },
    { clave: 'FACTOR_IBP_CARBONATO_CON_COMIDA', valor: FACTOR_IBP_CARBONATO_CON_COMIDA, unidad: 'factor', grado: 'estimado',
      fuente: 'La comida estimula la acidez que el carbonato necesita; efecto residual respecto al ayuno' },
    { clave: 'FACTOR_IBP_SOBRE_CITRATO', valor: FACTOR_IBP_SOBRE_CITRATO, unidad: 'factor', grado: 'medido',
      fuente: 'El citrato es soluble con independencia del pH gástrico; Sakhaee K et al. Am J Ther 1999;6:313' },
    { clave: 'FACTOR_IBP_SOBRE_ALIMENTOS', valor: FACTOR_IBP_SOBRE_ALIMENTOS, unidad: 'factor', grado: 'estimado',
      fuente: 'Efecto menor sobre el calcio de la matriz alimentaria que sobre la sal de carbonato' },

    // --- Vitamina D ---
    { clave: 'VITD_RDA_MCG', valor: VITD_RDA_MCG, unidad: 'µg/día', grado: 'consenso',
      fuente: 'IOM/NASEM 2011: 600 UI (15 µg) para 1-70 años, bajo el supuesto de exposición solar mínima' },
    { clave: 'VITD_RDA_MCG_MAYOR70', valor: VITD_RDA_MCG_MAYOR70, unidad: 'µg/día', grado: 'consenso',
      fuente: 'IOM/NASEM 2011: 800 UI (20 µg) para >70 años' },
    { clave: 'VITD_UL_MCG', valor: VITD_UL_MCG, unidad: 'µg/día', grado: 'consenso',
      fuente: 'IOM/NASEM 2011 y EFSA 2012: nivel máximo tolerable 100 µg (4000 UI)' },
    { clave: 'POTENCIA_VITD2', valor: POTENCIA_VITD2, unidad: 'relativa a D3', grado: 'medido',
      fuente: 'Tripkovic L et al. Am J Clin Nutr 2012;95:1357 (metaanálisis D2 vs D3)' },
    { clave: 'MARCO_VITD_OSEO.insuficiente', valor: MARCO_VITD_OSEO.insuficiente, unidad: 'ng/mL', grado: 'consenso',
      fuente: 'International Osteoporosis Foundation; Bone Health and Osteoporosis Foundation: objetivo ≥30 ng/mL en salud ósea' },
    { clave: 'MARCO_VITD_POBLACIONAL.insuficiente', valor: MARCO_VITD_POBLACIONAL.insuficiente, unidad: 'ng/mL', grado: 'consenso',
      fuente: 'IOM/NASEM 2011 y EFSA 2016: 20 ng/mL (50 nmol/L) cubre al 97.5% de la población' },

    // --- Exposición solar ---
    { clave: 'K_HOLICK', valor: 0.4735, unidad: 'factor de calibración', grado: 'derivado',
      fuente: 'Fijado para que ¼ MED sobre ¼ de superficie corporal devuelva 1000 UI (regla de Holick), conservando la saturación' },
    { clave: 'MED_POR_FOTOTIPO_SED.III', valor: MED_POR_FOTOTIPO_SED.III, unidad: 'SED', grado: 'medido',
      fuente: 'Dosis eritematosa mínima por fototipo de Fitzpatrick; 1 SED = 100 J/m² ponderados por el espectro CIE' },
    { clave: 'UVI_COEF', valor: UVI_COEF, unidad: 'índice UV', grado: 'derivado',
      fuente: 'Parametrización empírica de cielo claro; reproduce 11.6 en Panamá (9°N) y 7.3 en Helsinki (60°N) en sus máximos' },
    { clave: 'UVI_EXP_MU', valor: UVI_EXP_MU, unidad: 'exponente', grado: 'derivado',
      fuente: 'Dependencia del índice UV en el coseno del ángulo cenital solar' },
    { clave: 'DECLINACION_MAXIMA_GRADOS', valor: DECLINACION_MAXIMA_GRADOS, unidad: 'grados', grado: 'medido',
      fuente: 'Oblicuidad de la eclíptica; ecuación de la declinación de Cooper (1969)' },
    { clave: 'UMBRAL_SOLAR_MODERADO_FRACCION_RDA', valor: UMBRAL_SOLAR_MODERADO_FRACCION_RDA, unidad: 'fracción de la RDA', grado: 'heuristico',
      fuente: 'CALIBRACIÓN PENDIENTE contra la 25(OH)D sérica del estudio en curso' },

    // --- Proteína ---
    { clave: 'PROTEINA_RDA_ADULTO', valor: PROTEINA_RDA_ADULTO, unidad: 'g/kg/día', grado: 'consenso',
      fuente: 'IOM. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein and Amino Acids. 2005' },
    { clave: 'PROTEINA_OBJETIVO_MAYOR65', valor: PROTEINA_OBJETIVO_MAYOR65, unidad: 'g/kg/día', grado: 'consenso',
      fuente: 'Bauer J et al. PROT-AGE. J Am Med Dir Assoc 2013;14:542; Deutz NEP et al. ESPEN. Clin Nutr 2014;33:929' },
    { clave: 'LEUCINA_UMBRAL_POR_COMIDA_G', valor: LEUCINA_UMBRAL_POR_COMIDA_G, unidad: 'g/comida', grado: 'consenso',
      fuente: 'PROT-AGE 2013: 2.5-2.8 g de leucina por comida para superar el umbral anabólico en el adulto mayor' },
    { clave: 'FACTOR_PROTEINA_DIETA_VEGETAL', valor: FACTOR_PROTEINA_DIETA_VEGETAL, unidad: 'factor', grado: 'estimado',
      fuente: 'Ajuste global por menor DIAAS; en la v6.0 queda subordinado al cálculo de proteína utilizable por alimento' },
    { clave: 'DIAAS_POR_DEFECTO', valor: DIAAS_POR_DEFECTO, unidad: 'fracción', grado: 'estimado',
      fuente: 'Herreman L et al. Food Sci Nutr 2020;8:5379; FAO. Dietary protein quality evaluation in human nutrition. 2013' },

    // --- Sarcopenia ---
    { clave: 'UMBRAL_SARC_F_ESPECIFICO', valor: UMBRAL_SARC_F_ESPECIFICO, unidad: 'puntos', grado: 'medido',
      fuente: 'Malmstrom TK, Morley JE. J Am Med Dir Assoc 2013;14:531; EWGSOP2 (Cruz-Jentoft AJ et al. Age Ageing 2019;48:16)' },
    { clave: 'UMBRAL_SARC_CALF', valor: UMBRAL_SARC_CALF, unidad: 'puntos', grado: 'medido',
      fuente: 'Barbosa-Silva TG et al. J Am Med Dir Assoc 2016;17:1136 (SARC-CalF)' },
    { clave: 'CORTE_PANTORRILLA_CM.femenino', valor: CORTE_PANTORRILLA_CM.femenino, unidad: 'cm', grado: 'medido',
      fuente: 'Barbosa-Silva TG et al. 2016; ajuste por IMC según González MC et al. J Cachexia Sarcopenia Muscle 2021;12:1359' },

    // --- Cribado óseo ---
    { clave: 'OST_COEFICIENTE', valor: OST_COEFICIENTE, unidad: 'coeficiente', grado: 'medido',
      fuente: 'Koh LKH et al. Osteoporos Int 2001;12:699 (OST/OSTA)' },
    { clave: 'ORAI_CORTE', valor: ORAI_CORTE, unidad: 'puntos', grado: 'medido',
      fuente: 'Cadarette SM et al. CMAJ 2000;162:1289 (ORAI; sensibilidad 93.3%, especificidad 46.4%)' },

    // --- Laboratorio ---
    { clave: 'PAYNE_PENDIENTE', valor: PAYNE_PENDIENTE, unidad: 'mg/dL por g/dL', grado: 'medido',
      fuente: 'Payne RB et al. BMJ 1973;4:643 (calcio corregido por albúmina)' },
    { clave: 'CKD_EPI_2021.coeficiente', valor: CKD_EPI_2021.coeficiente, unidad: 'mL/min/1.73m²', grado: 'medido',
      fuente: 'Inker LA et al. N Engl J Med 2021;385:1737 (CKD-EPI 2021 sin término racial)' },
    { clave: 'RAZON_CALCIO_CREATININA_MAX', valor: RAZON_CALCIO_CREATININA_MAX, unidad: 'mg/mg', grado: 'consenso',
      fuente: 'Umbral convencional de hipercalciuria en muestra aislada' },

    // --- Actividad física ---
    { clave: 'UMBRAL_EJERCICIO_AEROBICO_HORAS_SEMANA', valor: UMBRAL_EJERCICIO_AEROBICO_HORAS_SEMANA, unidad: 'h/semana', grado: 'consenso',
      fuente: 'OMS. Guidelines on physical activity and sedentary behaviour. 2020 (≥150 min/semana moderada)' },
    { clave: 'UMBRAL_EJERCICIO_FUERZA_SEMANAL', valor: UMBRAL_EJERCICIO_FUERZA_SEMANAL, unidad: 'días/semana', grado: 'consenso',
      fuente: 'OMS 2020 (≥2 días/semana de fortalecimiento muscular)' },

    // --- Vitamina D y tamaño corporal ---
    { clave: 'MULTIPLICADOR_VITD_POR_IMC.obesidad', valor: 2.0, unidad: 'factor', grado: 'estimado',
      fuente: 'Drincic AT et al. Obesity 2012;20:1444 (dilución volumétrica); Ekwaru JP et al. PLoS One 2014;9:e111265' },

    // --- Cribado compuesto propio ---
    { clave: 'RIESGO_OSEO_CORTE_MODERADO', valor: 3, unidad: 'puntos', grado: 'heuristico',
      fuente: 'CALIBRACIÓN PENDIENTE contra T-score de DXA del estudio en curso' },
    { clave: 'RIESGO_OSEO_CORTE_ALTO', valor: 5, unidad: 'puntos', grado: 'heuristico',
      fuente: 'CALIBRACIÓN PENDIENTE contra T-score de DXA del estudio en curso' },
    { clave: 'PLAUSIBILIDAD_PROTEINA_FRACCION_MINIMA', valor: PLAUSIBILIDAD_PROTEINA_FRACCION_MINIMA, unidad: 'fracción del objetivo', grado: 'heuristico',
      fuente: 'Lógica de los puntos de corte de Goldberg (Goldberg GR et al. Eur J Clin Nutr 1991;45:569) aplicada a proteína' },

    // --- Cortes de decisión de la conducta sugerida ---
    { clave: 'CONDUCTA_CALCIO_CUBRE', valor: CONDUCTA_CALCIO_CUBRE, unidad: '% de la meta absorbida', grado: 'heuristico',
      fuente: 'Corte de cribado propio: 100% de la meta derivada de la ingesta de referencia. Pendiente de calibrar contra el método dietético de referencia' },
    { clave: 'CONDUCTA_CALCIO_LIMITE', valor: CONDUCTA_CALCIO_LIMITE, unidad: '% de la meta absorbida', grado: 'heuristico',
      fuente: 'Corte de cribado propio que separa la brecha cerrable con alimentos de la que requiere derivación. Pendiente de calibración' },
    { clave: 'CONDUCTA_CALCIO_DIETA_VIABLE', valor: CONDUCTA_CALCIO_DIETA_VIABLE, unidad: '% de la meta absorbida', grado: 'heuristico',
      fuente: 'Corte de cribado propio por debajo del cual el ajuste dietético aislado difícilmente basta en una dieta basada en plantas. Pendiente de calibración' }
];

// Huella determinista del conjunto de parámetros (FNV-1a de 32 bits sobre
// la serialización canónica). No es criptográfica: solo tiene que cambiar
// cuando cambie cualquier parámetro, y ser idéntica en cualquier
// navegador y en Node para que el dato exportado sea comparable.
const calcularHuellaParametros = (registro) => {
    const canonico = registro
        .map(p => `${p.clave}=${p.valor}`)
        .sort()
        .join('|');
    let h = 0x811c9dc5;
    for (let i = 0; i < canonico.length; i++) {
        h ^= canonico.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
};

const CARDA_HUELLA_PARAMETROS = calcularHuellaParametros(REGISTRO_PARAMETROS);

// Parámetros agrupados por grado de evidencia. `heuristico` es la lista
// de trabajo del estudio de validación.
const parametrosPorGrado = (grado) => REGISTRO_PARAMETROS.filter(p => p.grado === grado);

// Identificador completo del motor, para estampar en cada fila exportada.
const CARDA_SELLO = `CARDA-v${CARDA_VERSION}+${CARDA_HUELLA_PARAMETROS}`;
