// ============================================================
// CalD Risk Screen — Módulo de biomarcadores (nuevo en la v6.0)
// ============================================================
//
// POR QUÉ EXISTE ESTE ARCHIVO
//
// Hasta la v3.1 la herramienta capturaba dos analitos: calcio sérico
// total y 25(OH)D. Faltaban precisamente los que convierten esos dos
// números en una interpretación:
//
//   · ALBÚMINA. Cerca de la mitad del calcio circulante viaja unido a
//     albúmina. Sin corregir, la hipoalbuminemia produce falsos
//     positivos de hipocalcemia — relevante en una población de estudio
//     con dietas 100% vegetales.
//
//   · PTH INTACTA. Es el mecanismo por el que la insuficiencia de
//     vitamina D produce pérdida ósea, y su ascenso PRECEDE a cualquier
//     cambio del calcio sérico. Un tamizaje de salud ósea que no la mira
//     está renunciando al dato más informativo del panel.
//
//   · CREATININA Y TASA DE FILTRACIÓN GLOMERULAR. La 1α-hidroxilación de
//     la vitamina D es renal: una filtración baja cambia por completo la
//     interpretación de la 25(OH)D. Además la herramienta ya registra el
//     uso de creatina, que eleva la creatinina sérica sin que exista
//     daño renal y por tanto SUBESTIMA la filtración.
//
//   · CALCIO URINARIO Y RAZÓN CALCIO/CREATININA. La hipercalciuria es
//     una causa tratable de pérdida ósea. La v2.7 ya registraba el uso de
//     creatina justificándolo por su efecto sobre esta razón, pero la
//     razón no se calculaba en ninguna parte.
//
//   · FOSFATASA ALCALINA, FÓSFORO Y MAGNESIO. Completan los patrones:
//     recambio óseo, osteomalacia y el cofactor obligado de la
//     activación de la vitamina D.
//
// QUÉ HACE Y QUÉ NO HACE
//
// Clasifica cada analito contra su rango de referencia y, sobre todo,
// evalúa los analitos EN CONJUNTO, porque el valor de un panel está en
// el patrón y no en siete hallazgos aislados: una PTH alta significa una
// cosa con calcio alto y otra distinta con calcio normal y 25(OH)D baja.
//
// NO emite indicaciones de tratamiento ni dosis. Cada patrón devuelve un
// nivel de derivación, y la interpretación clínica corresponde al médico
// tratante con el rango del laboratorio que emitió el informe. Los
// rangos de referencia varían entre laboratorios y métodos.
//
// © Jean Carlos Ruiz Mosley. Todos los derechos reservados.
// ============================================================


// ------------------------------------------------------------
// 0. UTILIDADES
// ------------------------------------------------------------
const esValorNumerico = (v) =>
    v !== '' && v !== null && v !== undefined && !isNaN(parseFloat(v));

// Clasifica un valor contra un rango de referencia. Devuelve siempre la
// misma forma, con `disponible: false` cuando el analito no se declaró,
// para que el evaluador de patrones no tenga que comprobar nulos.
const clasificarEnRango = (valor, rango) => {
    if (!esValorNumerico(valor)) {
        return { disponible: false, valor: null, categoria: null, colorKey: null };
    }
    const v = parseFloat(valor);
    let categoria, colorKey;
    if (v < rango.min) { categoria = 'baja'; colorKey = 'amber'; }
    else if (v > rango.max) { categoria = 'alta'; colorKey = 'amber'; }
    else { categoria = 'normal'; colorKey = 'emerald'; }
    return {
        disponible: true,
        valor: v,
        categoria,
        colorKey,
        rango,
        unidad: rango.unidad
    };
};


// ------------------------------------------------------------
// 1. CALCIO SÉRICO CORREGIDO POR ALBÚMINA
// ------------------------------------------------------------
// Fórmula de Payne (Payne RB et al., BMJ 1973;4:643):
//     Ca_corregido = Ca_medido + 0.8 × (4.0 − albúmina)
//
// LÍMITE QUE HAY QUE DECLARAR: la fórmula es una aproximación de
// regresión poblacional y su concordancia con el calcio iónico —que es el
// patrón— es imperfecta, sobre todo en enfermedad renal, hipoalbuminemia
// marcada y alteraciones del equilibrio ácido-base. Cuando una decisión
// clínica depende del valor, el analito correcto es el calcio iónico.
// La herramienta reporta ambos números y esta advertencia, en vez de
// sustituir uno por otro en silencio.
const calcularCalcioCorregido = (calcioMgDl, albuminaGDl) => {
    if (!esValorNumerico(calcioMgDl)) return { disponible: false };
    const ca = parseFloat(calcioMgDl);

    if (!esValorNumerico(albuminaGDl)) {
        return {
            disponible: true,
            calcioMedido: ca,
            calcioCorregido: null,
            correccionAplicada: false,
            // Sin albúmina no se puede corregir: se dice, no se asume
            // que la albúmina es normal.
            avisoKey: 'lab_calcium_needs_albumin'
        };
    }

    const alb = parseFloat(albuminaGDl);
    const corregido = ca + PAYNE_PENDIENTE * (PAYNE_ALBUMINA_REFERENCIA - alb);
    const delta = corregido - ca;

    return {
        disponible: true,
        calcioMedido: ca,
        albumina: alb,
        calcioCorregido: Math.round(corregido * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        correccionAplicada: true,
        // La corrección es relevante cuando cambia la clasificación
        cambiaClasificacion:
            (ca < RANGO_CALCIO_SERICO_NORMAL_MG_DL.min) !== (corregido < RANGO_CALCIO_SERICO_NORMAL_MG_DL.min) ||
            (ca > RANGO_CALCIO_SERICO_NORMAL_MG_DL.max) !== (corregido > RANGO_CALCIO_SERICO_NORMAL_MG_DL.max),
        advertenciaKey: 'lab_payne_is_approximation'
    };
};

// Interpretación del calcio sérico usando el valor corregido cuando hay
// albúmina. Sustituye a `interpretarCalcioSerico` de la v3.1, que se
// conserva en algorithm.js por compatibilidad.
const interpretarCalcioSericoCorregido = (calcioMgDl, albuminaGDl) => {
    const corr = calcularCalcioCorregido(calcioMgDl, albuminaGDl);
    if (!corr.disponible) return { disponible: false };

    const valorAInterpretar = corr.correccionAplicada ? corr.calcioCorregido : corr.calcioMedido;
    let categoria, colorKey;
    if (valorAInterpretar < RANGO_CALCIO_SERICO_NORMAL_MG_DL.min) { categoria = 'bajo'; colorKey = 'rose'; }
    else if (valorAInterpretar > RANGO_CALCIO_SERICO_NORMAL_MG_DL.max) { categoria = 'alto'; colorKey = 'amber'; }
    else { categoria = 'normal'; colorKey = 'emerald'; }

    return {
        ...corr,
        valor: valorAInterpretar,
        categoria,
        colorKey,
        rango: RANGO_CALCIO_SERICO_NORMAL_MG_DL,
        // El calcio sérico está bajo control homeostático estrecho y NO
        // refleja el estatus nutricional de calcio: un valor normal no
        // descarta ingesta insuficiente ni pérdida ósea. Se repite aquí
        // porque es el malentendido más frecuente del panel.
        notaKey: 'lab_calcium_not_nutritional_status'
    };
};


// ------------------------------------------------------------
// 2. TASA DE FILTRACIÓN GLOMERULAR ESTIMADA (CKD-EPI 2021)
// ------------------------------------------------------------
// Ecuación vigente, SIN término racial (Inker LA et al., N Engl J Med
// 2021;385:1737), recomendada por el grupo de trabajo NKF-ASN:
//
//   TFGe = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^(−1.200)
//               × 0.9938^edad × (1.012 si mujer)
//
// CONFUSIÓN QUE ESTA FUNCIÓN SEÑALA SOLA: la creatina suplementaria eleva
// la creatinina sérica por conversión no enzimática, sin que exista
// reducción de la filtración. En un usuario de creatina la TFGe estimada
// está SUBESTIMADA y no debe interpretarse como daño renal. La
// herramienta ya registra el uso de creatina desde la v2.7; aquí ese dato
// por fin se usa para algo.
const calcularTFGe = ({ creatininaMgDl, edad, sexo, usaCreatina }) => {
    if (!esValorNumerico(creatininaMgDl)) return { disponible: false };
    const scr = parseFloat(creatininaMgDl);
    const e = Number(edad) || 0;
    if (scr <= 0 || e <= 0) return { disponible: false };

    const sx = sexo === 'masculino' ? 'masculino' : 'femenino';
    const kappa = CKD_EPI_2021.kappa[sx];
    const alfa = CKD_EPI_2021.alfa[sx];
    const ratio = scr / kappa;

    const tfge = CKD_EPI_2021.coeficiente *
        Math.pow(Math.min(ratio, 1), alfa) *
        Math.pow(Math.max(ratio, 1), CKD_EPI_2021.exponenteSuperior) *
        Math.pow(CKD_EPI_2021.factorEdad, e) *
        (sx === 'femenino' ? CKD_EPI_2021.factorSexoFemenino : 1);

    const valor = Math.round(tfge * 10) / 10;
    const estadio = ESTADIOS_KDIGO.find(s => valor >= s.min && valor <= s.max) || ESTADIOS_KDIGO[0];

    let colorKey;
    if (valor >= 60) colorKey = 'emerald';
    else if (valor >= 30) colorKey = 'amber';
    else colorKey = 'rose';

    return {
        disponible: true,
        valor,
        creatinina: scr,
        estadio: estadio.id,
        estadioKey: estadio.key,
        colorKey,
        unidad: 'mL/min/1.73 m²',
        reducida: valor < 60,
        // Confusión por creatina
        confundidaPorCreatina: !!usaCreatina,
        avisoCreatinaKey: usaCreatina ? 'lab_egfr_creatine_confound' : null,
        // La ecuación se derivó en adultos; no es aplicable en embarazo,
        // amputaciones, masa muscular extrema ni cambios agudos.
        limitacionKey: 'lab_egfr_limitations',
        ecuacion: 'CKD-EPI 2021 (sin término racial)'
    };
};


// ------------------------------------------------------------
// 3. PARATOHORMONA INTACTA
// ------------------------------------------------------------
// La PTH solo se interpreta EN CONJUNTO con el calcio corregido, la
// 25(OH)D y la función renal. Aislada no distingue un
// hiperparatiroidismo primario de una respuesta fisiológica normal a la
// deficiencia de vitamina D, que son dos situaciones con conducta
// clínica completamente distinta.
const interpretarPTH = (pthPgMl) => {
    const base = clasificarEnRango(pthPgMl, RANGOS_LABORATORIO.ptHormonaIntacta);
    if (!base.disponible) return base;
    return {
        ...base,
        colorKey: base.categoria === 'alta' ? 'rose' : base.colorKey,
        // No interpretable sin el resto del panel
        requiereContextoKey: 'lab_pth_needs_context'
    };
};

const interpretarFosforo = (v) => clasificarEnRango(v, RANGOS_LABORATORIO.fosforo);
const interpretarAlbumina = (v) => clasificarEnRango(v, RANGOS_LABORATORIO.albumina);

const interpretarFosfatasaAlcalina = (v) => {
    const base = clasificarEnRango(v, RANGOS_LABORATORIO.fosfatasaAlcalina);
    if (!base.disponible) return base;
    return {
        ...base,
        // La fosfatasa alcalina total tiene origen óseo y hepático. Su
        // elevación solo es marcador de recambio óseo si se ha descartado
        // colestasis; la fracción ósea requiere isoenzimas.
        notaKey: 'lab_alp_bone_or_liver'
    };
};

const interpretarMagnesio = (v) => {
    const base = clasificarEnRango(v, RANGOS_LABORATORIO.magnesio);
    if (!base.disponible) return base;
    return {
        ...base,
        colorKey: base.categoria === 'baja' ? 'rose' : base.colorKey,
        // El magnesio es cofactor obligado de la 1α-hidroxilación renal y
        // de la secreción de PTH: la hipomagnesemia produce resistencia a
        // la vitamina D y una hipocalcemia que no responde al calcio.
        notaKey: 'lab_magnesium_cofactor'
    };
};


// ------------------------------------------------------------
// 4. CALCIO URINARIO
// ------------------------------------------------------------
// Tres criterios, por orden de robustez: excreción de 24 h ajustada por
// peso, excreción de 24 h absoluta y razón calcio/creatinina en muestra
// aislada. La razón es la menos precisa pero la única disponible cuando
// no se recoge orina de 24 h.
//
// La creatina suplementaria eleva la creatinina urinaria, de modo que
// INFRAESTIMA la razón calcio/creatinina y puede ocultar una
// hipercalciuria. Es la razón por la que la v2.7 registraba el uso de
// creatina; aquí se aplica.
const interpretarCalcioUrinario = ({ calcio24hMg, calcioOrinaMgDl, creatininaOrinaMgDl, pesoKg, sexo, usaCreatina }) => {
    const resultado = {
        disponible: false,
        hipercalciuria: false,
        criterios: [],
        confundidoPorCreatina: !!usaCreatina,
        avisoCreatinaKey: usaCreatina ? 'lab_urine_creatine_confound' : null
    };

    // Criterio 1 y 2: orina de 24 horas
    if (esValorNumerico(calcio24hMg)) {
        const v = parseFloat(calcio24hMg);
        resultado.disponible = true;
        resultado.calcio24h = v;

        const limiteAbsoluto = CALCIO_URINARIO_24H_MAX[sexo === 'masculino' ? 'masculino' : 'femenino'];
        const superaAbsoluto = v > limiteAbsoluto;
        resultado.criterios.push({
            id: 'absoluto_24h', valor: v, limite: limiteAbsoluto,
            supera: superaAbsoluto, unidad: 'mg/24h'
        });

        if (Number(pesoKg) > 0) {
            const porKg = v / Number(pesoKg);
            const superaPorKg = porKg > CALCIO_URINARIO_POR_KG_MAX;
            resultado.calcioPorKg = Math.round(porKg * 100) / 100;
            resultado.criterios.push({
                id: 'por_kg_24h', valor: Math.round(porKg * 100) / 100,
                limite: CALCIO_URINARIO_POR_KG_MAX, supera: superaPorKg, unidad: 'mg/kg/24h'
            });
        }
    }

    // Criterio 3: razón calcio/creatinina en muestra aislada
    if (esValorNumerico(calcioOrinaMgDl) && esValorNumerico(creatininaOrinaMgDl) && parseFloat(creatininaOrinaMgDl) > 0) {
        const razon = parseFloat(calcioOrinaMgDl) / parseFloat(creatininaOrinaMgDl);
        resultado.disponible = true;
        resultado.razonCalcioCreatinina = Math.round(razon * 1000) / 1000;
        resultado.criterios.push({
            id: 'razon_ca_cr', valor: Math.round(razon * 1000) / 1000,
            limite: RAZON_CALCIO_CREATININA_MAX, supera: razon > RAZON_CALCIO_CREATININA_MAX, unidad: 'mg/mg'
        });
    }

    resultado.hipercalciuria = resultado.criterios.some(c => c.supera);
    resultado.colorKey = resultado.hipercalciuria ? 'amber' : (resultado.disponible ? 'emerald' : null);
    return resultado;
};


// ------------------------------------------------------------
// 5. EVALUACIÓN INTEGRADA DEL PANEL
// ------------------------------------------------------------
// El valor de un panel está en el PATRÓN, no en siete hallazgos
// aislados. Una PTH alta significa una cosa con calcio alto y otra
// distinta con calcio normal y 25(OH)D baja, y notificarlas como dos
// alertas separadas —que es lo que haría una lista de rangos— deja el
// trabajo de integrarlas al lector.
//
// Cada patrón declara qué analitos lo sostienen, para que sea
// verificable, y un nivel de derivación. NINGUNO emite indicaciones de
// tratamiento ni dosis.
const evaluarPanelOseo = ({
    calcioSerico, albumina, vitD25OH, pth, fosforo, fosfatasaAlcalina,
    magnesio, creatinina, calcio24hMg, calcioOrinaMgDl, creatininaOrinaMgDl,
    edad, sexo, pesoKg, usaCreatina, marcoVitD
}) => {
    const ca = interpretarCalcioSericoCorregido(calcioSerico, albumina);
    const alb = interpretarAlbumina(albumina);
    const vitd = typeof interpretar25OHVitaminaD === 'function'
        ? interpretar25OHVitaminaD(vitD25OH, marcoVitD || MARCO_VITD_POR_DEFECTO)
        : null;
    const pt = interpretarPTH(pth);
    const p = interpretarFosforo(fosforo);
    const fa = interpretarFosfatasaAlcalina(fosfatasaAlcalina);
    const mg = interpretarMagnesio(magnesio);
    const tfge = calcularTFGe({ creatininaMgDl: creatinina, edad, sexo, usaCreatina });
    const uCa = interpretarCalcioUrinario({
        calcio24hMg, calcioOrinaMgDl, creatininaOrinaMgDl, pesoKg, sexo, usaCreatina
    });

    const patrones = [];
    const add = (id, urgencia, soportes) => patrones.push({ id, urgencia, key: `pattern_${id}`, soportes });

    const caAlto = ca.disponible && ca.categoria === 'alto';
    const caBajo = ca.disponible && ca.categoria === 'bajo';
    const caNormal = ca.disponible && ca.categoria === 'normal';
    const pthAlta = pt.disponible && pt.categoria === 'alta';
    const pthBaja = pt.disponible && pt.categoria === 'baja';
    const vitdBaja = !!vitd && (vitd.categoria === 'deficiente' || vitd.categoria === 'deficiencia_severa');
    const vitdInsuf = !!vitd && vitd.categoria === 'insuficiente';
    const vitdAlta = !!vitd && vitd.porEncimaDelRango;

    // --- Patrones con PTH elevada ---
    if (pthAlta && caAlto) {
        // Calcio alto con PTH alta: la PTH no está respondiendo al
        // calcio, que es lo que define el hiperparatiroidismo primario.
        add('hiperparatiroidismo_primario_posible', 'derivacion_urgente', ['pth', 'calcio_corregido']);
    } else if (pthAlta && (caNormal || caBajo) && (vitdBaja || vitdInsuf)) {
        // El patrón esperado de la deficiencia de vitamina D: la PTH sube
        // para mantener el calcio. Es pérdida ósea en curso y, a la vez,
        // la situación más tratable del panel.
        add('hiperparatiroidismo_secundario_vitd', 'derivacion', ['pth', 'vitd25oh', 'calcio_corregido']);
    } else if (pthAlta && tfge.disponible && tfge.valor < 45) {
        add('hiperparatiroidismo_secundario_renal', 'derivacion', ['pth', 'tfge']);
    } else if (pthAlta && caNormal && !vitdBaja && !vitdInsuf && (!tfge.disponible || tfge.valor >= 60)) {
        // PTH alta sin causa secundaria identificable en el panel
        add('hiperparatiroidismo_normocalcemico_posible', 'derivacion', ['pth', 'calcio_corregido', 'vitd25oh']);
    } else if (pthAlta) {
        add('pth_elevada_sin_patron_definido', 'derivacion', ['pth']);
    }

    // --- Hipocalcemia y sus causas en el panel ---
    if (caBajo && pthBaja) {
        add('hipoparatiroidismo_posible', 'derivacion_urgente', ['calcio_corregido', 'pth']);
    }
    if (caBajo && mg.disponible && mg.categoria === 'baja') {
        // La hipomagnesemia produce hipocalcemia que no responde al
        // calcio hasta corregir el magnesio.
        add('hipocalcemia_con_hipomagnesemia', 'derivacion_urgente', ['calcio_corregido', 'magnesio']);
    }

    // --- Osteomalacia bioquímica ---
    if (vitdBaja && fa.disponible && fa.categoria === 'alta' && (pthAlta || (p.disponible && p.categoria === 'baja'))) {
        add('osteomalacia_bioquimica_posible', 'derivacion_urgente',
            ['vitd25oh', 'fosfatasa_alcalina', 'pth', 'fosforo']);
    }

    // --- Exceso de vitamina D ---
    if (vitdAlta && caAlto) {
        add('hipervitaminosis_d_con_hipercalcemia', 'derivacion_urgente', ['vitd25oh', 'calcio_corregido']);
    } else if (vitd && vitd.toxicidadProbable) {
        add('toxicidad_vitd_probable', 'derivacion_urgente', ['vitd25oh']);
    }

    // --- Enfermedad mineral ósea asociada a enfermedad renal ---
    if (tfge.disponible && tfge.valor < 45 && (pthAlta || (p.disponible && p.categoria === 'alta'))) {
        add('trastorno_mineral_oseo_renal', 'derivacion', ['tfge', 'pth', 'fosforo']);
    }

    // --- Hipercalciuria ---
    if (uCa.hipercalciuria) {
        add('hipercalciuria', 'derivacion', ['calcio_urinario']);
    }

    // --- Magnesio bajo aislado ---
    if (mg.disponible && mg.categoria === 'baja' && !caBajo) {
        add('hipomagnesemia_aislada', 'seguimiento', ['magnesio']);
    }

    // --- Hipoalbuminemia que cambiaba la clasificación ---
    if (ca.disponible && ca.cambiaClasificacion) {
        add('correccion_albumina_cambia_clasificacion', 'seguimiento', ['calcio_corregido', 'albumina']);
    }

    const analitos = { ca, albumina: alb, vitd, pth: pt, fosforo: p, fosfatasaAlcalina: fa, magnesio: mg, tfge, calcioUrinario: uCa };
    const declarados = Object.values(analitos).filter(a => a && (a.disponible || a.categoria)).length;

    const urgencias = patrones.map(p2 => p2.urgencia);
    const nivelMaximo = urgencias.includes('derivacion_urgente') ? 'derivacion_urgente'
        : urgencias.includes('derivacion') ? 'derivacion'
        : urgencias.includes('seguimiento') ? 'seguimiento' : 'sin_hallazgos';

    return {
        analitos,
        patrones,
        nivelDerivacion: nivelMaximo,
        colorKey: nivelMaximo === 'derivacion_urgente' ? 'rose'
            : nivelMaximo === 'derivacion' ? 'amber'
            : nivelMaximo === 'seguimiento' ? 'amber' : 'emerald',
        analitosDeclarados: declarados,
        panelCompleto: declarados >= 6,
        // Recordatorio permanente que acompaña a todo el bloque.
        descargoKey: 'lab_disclaimer_clinical'
    };
};


// ------------------------------------------------------------
// 6. RESUMEN PARA EL RIESGO ÓSEO
// ------------------------------------------------------------
// Adapta la salida del panel a la forma que espera `calcularRiesgoOseoV6`
// en algorithm.js, para que el motor no tenga que conocer la estructura
// interna de este módulo.
const resumirBioquimicaParaRiesgoOseo = (panel) => {
    if (!panel || !panel.analitos) return null;
    const a = panel.analitos;
    return {
        vitD: a.vitd ? { categoria: a.vitd.categoria } : null,
        pth: a.pth && a.pth.disponible ? { disponible: true, categoria: a.pth.categoria } : null,
        fosfatasaAlcalina: a.fosfatasaAlcalina && a.fosfatasaAlcalina.disponible
            ? { disponible: true, categoria: a.fosfatasaAlcalina.categoria } : null,
        tfge: a.tfge && a.tfge.disponible ? { disponible: true, valor: a.tfge.valor } : null,
        calcioUrinario: a.calcioUrinario && a.calcioUrinario.disponible
            ? { disponible: true, hipercalciuria: a.calcioUrinario.hipercalciuria } : null
    };
};
