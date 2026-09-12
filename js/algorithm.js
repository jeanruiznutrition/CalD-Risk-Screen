// ============================================================
// CalD Risk Screen — Calcium & Vitamin D Absorption Risk Algorithm
// CARDA v2.0
//
// Motor de cálculo determinista. Cambio central respecto a v1.x:
// el modelo estima CALCIO ABSORBIBLE aplicando (a) la curva de
// saturación de Heaney sobre la carga de cada comida y (b) la
// biodisponibilidad relativa de cada alimento medida con isótopos.
//
// © Jean Carlos Ruiz Mosley. Todos los derechos reservados.
// ============================================================


// ------------------------------------------------------------
// 0. UTILIDADES DE MARCO DE REFERENCIA
// ------------------------------------------------------------
const obtenerReferenciaCalcio = (edad, sexo, marcoId = 'IOM') => {
    const marco = marcoId === 'EFSA' ? MARCO_CALCIO_EFSA : MARCO_CALCIO_IOM;
    const e = Number(edad) || 30;
    const tramo = marco.tramos.find(tr =>
        e >= tr.edadMin && e <= tr.edadMax &&
        (tr.sexo === 'ambos' || tr.sexo === sexo)
    );
    // Fallback al tramo adulto general del marco elegido
    const fallback = marco.tramos.find(tr => tr.edadMin <= 30 && tr.edadMax >= 30 && tr.sexo === 'ambos');
    const elegido = tramo || fallback || { ear: 800, rda: 1000, ul: 2500 };
    return { ...elegido, marco: marco.id };
};

const obtenerReferenciaVitaminaD = (edad) => {
    const e = Number(edad) || 30;
    return {
        ear: VITD_EAR_MCG,
        rda: e > 70 ? VITD_RDA_MCG_MAYOR70 : VITD_RDA_MCG,
        ul: VITD_UL_MCG,
        aiEfsa: VITD_AI_EFSA_MCG
    };
};

const obtenerObjetivoProteina = (edad, esDietaVegetal) => {
    const e = Number(edad) || 30;
    let objetivo = e >= EDAD_CORTE_PROTEINA_MAYOR ? PROTEINA_OBJETIVO_MAYOR65 : PROTEINA_RDA_ADULTO;
    if (esDietaVegetal) objetivo = Math.round(objetivo * FACTOR_PROTEINA_DIETA_VEGETAL * 100) / 100;
    return objetivo;
};


// ------------------------------------------------------------
// 1. CURVA DE ABSORCIÓN FRACCIONAL (saturación por carga)
// ------------------------------------------------------------
// Heaney, Weaver & Fitzsimmons (J Bone Miner Res 1990;5:1135):
// la absorción fraccional decae con el logaritmo natural de la carga.
//        FA(carga) = 0.889 − 0.0964 × ln(carga_mg)
// No es un tope duro a los 500 mg: la absorción continúa, pero con
// eficiencia decreciente. Ésta es la base real del consejo de
// fraccionar la ingesta de calcio en varias tomas.
const absorcionFraccionalPorCarga = (cargaMg) => {
    if (!cargaMg || cargaMg <= 0) return 0;
    const fa = FA_INTERCEPTO - FA_PENDIENTE_LN * Math.log(cargaMg);
    return Math.min(FA_MAXIMA, Math.max(FA_MINIMA, fa));
};

// Biodisponibilidad relativa de un alimento respecto a la leche.
// RBV = FA_alimento / FA_leche (ambas medidas con isótopos en los
// mismos sujetos, Weaver & Heaney 1999). Se usa solo para mostrar al
// usuario qué tan buena es la matriz del alimento; el cálculo real
// usa la FA medida directamente (ver abajo).
const biodisponibilidadRelativa = (faAlimento) => {
    if (!faAlimento || faAlimento <= 0) return 1.0;
    return faAlimento / FA_REFERENCIA_LECHE;
};

// Calcio absorbido de un ítem dentro de una comida.
//
// PUNTO METODOLÓGICO IMPORTANTE: las absorciones fraccionales
// publicadas (32.1% leche, 49.3% col rizada, 5.1% espinaca) fueron
// medidas cada una A UNA CARGA CONCRETA (la porción del ensayo).
// Por tanto ya incorporan el efecto de la carga de esa porción.
// Aplicarles encima la curva de saturación completa contaría dos
// veces el mismo fenómeno y sobrestimaría la absorción.
//
// La corrección es normalizar: se ajusta la FA medida por el
// COCIENTE entre la absorción fraccional a la carga real de la
// comida y la absorción fraccional a la carga a la que se midió ese
// alimento.
//
//   absorbido = mg × FA_medida × [ FA(carga_comida) / FA(carga_medición) ]
//
// Así, un alimento consumido solo y en su porción de referencia
// reproduce exactamente el valor publicado; y cuando se combina con
// otros alimentos en la misma comida, la carga total sube y todos se
// escalan hacia abajo, capturando la saturación real del transporte.
const calcularCalcioAbsorbidoItem = (mgItem, faAlimento, cargaTotalComida, cargaReferencia) => {
    if (!mgItem || mgItem <= 0) return 0;
    const cargaRef = cargaReferencia && cargaReferencia > 0 ? cargaReferencia : mgItem;
    const faEnComida = absorcionFraccionalPorCarga(cargaTotalComida);
    const faEnReferencia = absorcionFraccionalPorCarga(cargaRef);
    if (faEnReferencia <= 0) return 0;
    const ajusteCarga = faEnComida / faEnReferencia;
    return mgItem * faAlimento * ajusteCarga;
};


// ------------------------------------------------------------
// 2. DISTRIBUCIÓN DE LA SEMANA VIRTUAL
// ------------------------------------------------------------
const distanciaCircular = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, 7 - d);
};

const asignarDiasDeSemana = (items) => {
    const cargaPorDia = Array(7).fill(0);
    const asignaciones = {};
    const ordenados = [...items].sort((a, b) => b.contribucionEstimadaPorDia - a.contribucionEstimadaPorDia);

    ordenados.forEach(({ id, diasPorSemana, contribucionEstimadaPorDia }) => {
        const dias = [];
        for (let i = 0; i < diasPorSemana && i < 7; i++) {
            const candidatos = [0, 1, 2, 3, 4, 5, 6].filter(d => !dias.includes(d));
            candidatos.sort((a, b) => {
                if (cargaPorDia[a] !== cargaPorDia[b]) return cargaPorDia[a] - cargaPorDia[b];
                const distMinA = dias.length ? Math.min(...dias.map(d => distanciaCircular(d, a))) : 0;
                const distMinB = dias.length ? Math.min(...dias.map(d => distanciaCircular(d, b))) : 0;
                return distMinB - distMinA;
            });
            const elegido = candidatos[0];
            dias.push(elegido);
            cargaPorDia[elegido] += contribucionEstimadaPorDia;
        }
        asignaciones[id] = dias;
    });
    return asignaciones;
};

const asignarComidasDelDia = (foodsDelDia) => {
    const carga = [0, 0, 0];
    const asignaciones = {};
    const ordenados = [...foodsDelDia].sort((a, b) => b.vecesPorDia - a.vecesPorDia);

    ordenados.forEach(({ id, vecesPorDia }) => {
        const slots = [];
        for (let i = 0; i < vecesPorDia && i < 3; i++) {
            const candidatos = [0, 1, 2].filter(s => !slots.includes(s));
            candidatos.sort((a, b) => {
                if (carga[a] !== carga[b]) return carga[a] - carga[b];
                const distMinA = slots.length ? Math.min(...slots.map(s => Math.abs(s - a))) : 0;
                const distMinB = slots.length ? Math.min(...slots.map(s => Math.abs(s - b))) : 0;
                return distMinB - distMinA;
            });
            const elegido = candidatos[0];
            slots.push(elegido);
            carga[elegido]++;
        }
        asignaciones[id] = slots;
    });
    return asignaciones;
};


// ------------------------------------------------------------
// 3. MOTOR PRINCIPAL — SEMANA VIRTUAL DE CALCIO
// ------------------------------------------------------------
// alimentos: [{ id, nombreKey, nombreLibre, calcioPorcion, faAlimento,
//               diasPorSemana, vecesPorDia, porcionesPorComida }]
// suplemento: { mgPorDia, vecesPorDia, diasPorSemana, tipoId } | null
// referencia: resultado de obtenerReferenciaCalcio()
const ejecutarSemanaVirtualCalcio = (alimentos, suplemento, overridesManual = {}, referencia = null) => {
    const ref = referencia || obtenerReferenciaCalcio(30, 'femenino', 'IOM');

    // La meta diaria de calcio ABSORBIDO se deriva de la RDA de ingesta
    // del marco elegido, asumiendo una distribución de referencia en
    // tres tomas de una dieta mixta. No es un valor arbitrario: es la
    // traducción de la RDA al plano de la absorción.
    const cargaReferenciaPorToma = ref.rda / 3;
    const metaAbsorbidaDiaria = ref.rda * absorcionFraccionalPorCarga(cargaReferenciaPorToma);

    let semanaVirtual = Array(7).fill(null).map(() =>
        Array(3).fill(null).map(() => ({
            alimentos: [],
            totalIngerido: 0,
            totalAbsorbido: 0,
            suplementoAgregado: null,
            excedeCargaRecomendada: false
        }))
    );

    // 3.1 Asignación de días
    const alimentosConDatos = alimentos
        .map(al => {
            const { diasPorSemana, vecesPorDia, porcionesPorComida, calcioPorcion } = al;
            if (!diasPorSemana || !vecesPorDia || !porcionesPorComida || !calcioPorcion) return null;
            return { ...al, contribucionEstimadaPorDia: calcioPorcion * porcionesPorComida * vecesPorDia };
        })
        .filter(Boolean);

    const diasAsignados = asignarDiasDeSemana(
        alimentosConDatos.map(al => ({
            id: al.id,
            diasPorSemana: al.diasPorSemana,
            contribucionEstimadaPorDia: al.contribucionEstimadaPorDia
        }))
    );

    const alimentosActivos = alimentosConDatos.map(al => ({
        ...al,
        diasAsignados: diasAsignados[al.id] || []
    }));

    // 3.2 Asignación de comidas
    const colocaciones = [];
    const contadorPorAlimento = {};

    for (let diaIdx = 0; diaIdx < 7; diaIdx++) {
        const delDia = alimentosActivos.filter(al => al.diasAsignados.includes(diaIdx));
        if (delDia.length === 0) continue;

        const comidasAsignadas = asignarComidasDelDia(
            delDia.map(al => ({ id: al.id, vecesPorDia: al.vecesPorDia }))
        );

        delDia.forEach(al => {
            (comidasAsignadas[al.id] || []).forEach(comidaIdx => {
                const occurrenceIndex = contadorPorAlimento[al.id] || 0;
                contadorPorAlimento[al.id] = occurrenceIndex + 1;
                colocaciones.push({
                    id: al.id,
                    nombreKey: al.nombreKey,
                    nombreLibre: al.nombreLibre || null,
                    faAlimento: al.faAlimento,
                    cargaReferencia: al.cargaReferencia,
                    porciones: al.porcionesPorComida,
                    calcioIngerido: al.calcioPorcion * al.porcionesPorComida,
                    diaAuto: diaIdx,
                    comidaAuto: comidaIdx,
                    occurrenceIndex
                });
            });
        });
    }

    // 3.3 Overrides manuales (arrastrar y soltar)
    colocaciones.forEach(c => {
        const ov = overridesManual?.[c.id]?.[c.occurrenceIndex];
        const dia = ov ? ov.dia : c.diaAuto;
        const comida = ov ? ov.comida : c.comidaAuto;

        semanaVirtual[dia][comida].alimentos.push({
            id: c.id,
            nombreKey: c.nombreKey,
            nombreLibre: c.nombreLibre,
            faAlimento: c.faAlimento,
            cargaReferencia: c.cargaReferencia,
            porciones: c.porciones,
            calcioIngerido: c.calcioIngerido,
            occurrenceIndex: c.occurrenceIndex,
            esManual: !!ov,
            diaAuto: c.diaAuto,
            comidaAuto: c.comidaAuto
        });
        semanaVirtual[dia][comida].totalIngerido += c.calcioIngerido;
    });

    // 3.4 Suplemento: se coloca en la comida con menor carga dietética
    // de ese día, que es la estrategia que maximiza la absorción por
    // la curva de saturación.
    if (suplemento && suplemento.mgPorDia > 0 && suplemento.diasPorSemana > 0) {
        const { mgPorDia, vecesPorDia, diasPorSemana, tipoId } = suplemento;
        const tipo = (typeof TIPOS_SUPLEMENTO_CALCIO !== 'undefined'
            ? TIPOS_SUPLEMENTO_CALCIO.find(t => t.id === tipoId)
            : null) || { rbv: 1.0 };
        const dosisPorToma = mgPorDia / Math.max(vecesPorDia, 1);

        const dias = diasPorSemana >= 7
            ? [0, 1, 2, 3, 4, 5, 6]
            : (asignarDiasDeSemana([{ id: 'supl', diasPorSemana, contribucionEstimadaPorDia: mgPorDia }])['supl'] || []);

        dias.forEach(d => {
            const orden = [0, 1, 2]
                .map(c => ({ index: c, carga: semanaVirtual[d][c].totalIngerido }))
                .sort((a, b) => a.carga - b.carga);

            for (let i = 0; i < vecesPorDia && i < 3; i++) {
                const destino = orden[i].index;
                semanaVirtual[d][destino].totalIngerido += dosisPorToma;
                semanaVirtual[d][destino].suplementoAgregado = {
                    dosis: Math.round(dosisPorToma),
                    // El RBV del suplemento se guarda para el cálculo de absorción
                    rbv: tipo.rbv,
                    tipoId: tipoId
                };
            }
        });
    }

    // 3.5 Cálculo de absorción por comida (aplicando saturación + RBV)
    let diasCumplidos = 0;
    const reporteDias = [];
    let alertaFraccionamiento = false;
    let absorbidoSuplementoSemanal = 0;

    semanaVirtual.forEach((dia, diaIdx) => {
        let absorbidoDia = 0;
        let ingeridoDia = 0;

        const comidasDetalle = dia.map((comida, comidaIdx) => {
            const cargaTotal = comida.totalIngerido;
            let absorbidoComida = 0;

            // Alimentos
            comida.alimentos.forEach(al => {
                al.calcioAbsorbido = Math.round(
                    calcularCalcioAbsorbidoItem(al.calcioIngerido, al.faAlimento, cargaTotal, al.cargaReferencia) * 10
                ) / 10;
                absorbidoComida += al.calcioAbsorbido;
            });

            // Suplemento
            if (comida.suplementoAgregado) {
                const s = comida.suplementoAgregado;
                const faCarga = absorcionFraccionalPorCarga(cargaTotal);
                const absSupl = s.dosis * faCarga * s.rbv;
                s.absorbido = Math.round(absSupl * 10) / 10;
                absorbidoComida += absSupl;
                absorbidoSuplementoSemanal += absSupl;
            }

            const excede = cargaTotal > CARGA_RECOMENDADA_MAXIMA_POR_TOMA;
            if (excede) alertaFraccionamiento = true;
            dia[comidaIdx].excedeCargaRecomendada = excede;
            dia[comidaIdx].totalAbsorbido = Math.round(absorbidoComida * 10) / 10;

            absorbidoDia += absorbidoComida;
            ingeridoDia += cargaTotal;

            return {
                nombreKey: `comida_${comidaIdx}`,
                alimentosConsumidos: comida.alimentos,
                suplemento: comida.suplementoAgregado,
                totalIngerido: Math.round(cargaTotal * 10) / 10,
                totalAbsorbido: Math.round(absorbidoComida * 10) / 10,
                excedeCargaRecomendada: excede,
                absorcionFraccional: Math.round(absorcionFraccionalPorCarga(cargaTotal) * 1000) / 10
            };
        });

        const cumple = absorbidoDia >= metaAbsorbidaDiaria;
        if (cumple) diasCumplidos++;

        reporteDias.push({
            diaNombreKey: DIAS_SEMANA[diaIdx].nameKey,
            diaCortoKey: DIAS_SEMANA[diaIdx].shortKey,
            comidas: comidasDetalle,
            totalIngeridoDia: Math.round(ingeridoDia * 10) / 10,
            totalAbsorbidoDia: Math.round(absorbidoDia * 10) / 10,
            cumpleMeta: cumple
        });
    });

    const promedioIngerido = reporteDias.reduce((a, d) => a + d.totalIngeridoDia, 0) / 7;
    const promedioAbsorbido = reporteDias.reduce((a, d) => a + d.totalAbsorbidoDia, 0) / 7;

    // Eficiencia global: cuánto del calcio ingerido se absorbe realmente.
    // Revela el problema de biodisponibilidad que el conteo bruto oculta.
    const eficienciaGlobal = promedioIngerido > 0
        ? Math.round((promedioAbsorbido / promedioIngerido) * 1000) / 10
        : 0;

    // Razón continua de adecuación. El conteo binario de días pierde
    // información: alguien al 68% de la meta y alguien al 8% pueden
    // tener ambos "0 días cumplidos". Esta razón es la métrica primaria
    // de clasificación; el conteo de días queda como dato de
    // distribución (regularidad a lo largo de la semana).
    const razonAdecuacion = metaAbsorbidaDiaria > 0
        ? Math.round((promedioAbsorbido / metaAbsorbidaDiaria) * 1000) / 10
        : 0;

    return {
        semanaVirtual,
        reporteDias,
        diasCumplidos,
        diasNoCumplidos: 7 - diasCumplidos,
        porcentajeCumplimiento: Math.round((diasCumplidos / 7) * 1000) / 10,
        promedioIngeridoSemanal: Math.round(promedioIngerido * 10) / 10,
        promedioAbsorbidoSemanal: Math.round(promedioAbsorbido * 10) / 10,
        promedioAbsorbidoSuplemento: Math.round((absorbidoSuplementoSemanal / 7) * 10) / 10,
        metaAbsorbidaDiaria: Math.round(metaAbsorbidaDiaria * 10) / 10,
        eficienciaGlobal,
        razonAdecuacion,
        referencia: ref,
        alertaFraccionamiento,
        // Bandera EPIC-Oxford: umbral protector de 525 mg/día de ingesta
        bajoUmbralEpicOxford: promedioIngerido < UMBRAL_PROTECTOR_EPIC_OXFORD_MG,
        // Comparación con la RDA de ingesta del marco elegido
        porcentajeRdaIngesta: Math.round((promedioIngerido / ref.rda) * 1000) / 10
    };
};


// ------------------------------------------------------------
// 4. ÍNDICE DE EXPOSICIÓN SOLAR (proxy de síntesis cutánea)
// ------------------------------------------------------------
const calcularIndiceExposicionSolar = ({ diasPorSemana, minutosPorSesion, horario, edad, fototipo, superficieCorporal }) => {
    const fHorario = FACTOR_HORARIO[horario] ?? FACTOR_HORARIO.no_pico;
    const fEdad = calcularFactorEdadSintesis(edad);
    const fFototipo = FACTOR_FOTOTIPO[fototipo] ?? FACTOR_FOTOTIPO.III;
    const fSuperficie = FACTOR_SUPERFICIE_CORPORAL[superficieCorporal] ?? FACTOR_SUPERFICIE_CORPORAL.parcial;

    const indice = (diasPorSemana || 0) * (minutosPorSesion || 0) * fHorario * fEdad * fFototipo * fSuperficie;

    let categoria, colorKey;
    if (indice < UMBRAL_INDICE_SOLAR_BAJO) { categoria = 'alto'; colorKey = 'rose'; }
    else if (indice < UMBRAL_INDICE_SOLAR_MODERADO) { categoria = 'moderado'; colorKey = 'amber'; }
    else { categoria = 'bajo'; colorKey = 'emerald'; }

    return {
        indice: Math.round(indice * 10) / 10,
        categoriaRiesgo: categoria,
        colorKey,
        factores: {
            horario: fHorario,
            edad: Math.round(fEdad * 100) / 100,
            fototipo: fFototipo,
            superficie: fSuperficie
        }
    };
};


// ------------------------------------------------------------
// 5. ADECUACIÓN DE VITAMINA D (dieta + suplemento)
// ------------------------------------------------------------
// Aplica la potencia relativa D2 vs D3: la D2 rinde aproximadamente
// 60% de la D3 para elevar la 25(OH)D sérica (Tripkovic et al. 2012).
const calcularAdecuacionVitaminaD = (alimentos, suplementoVitD, edad) => {
    const ref = obtenerReferenciaVitaminaD(edad);

    let mcgSemanalD3 = 0;
    let mcgSemanalD2 = 0;

    (alimentos || []).forEach(a => {
        if (!a.diasPorSemana || !a.vitDPorcion || !a.porcionesPorComida) return;
        const aporte = a.vitDPorcion * a.porcionesPorComida * (a.vecesPorDia || 1) * a.diasPorSemana;
        if (a.formaVitD === 'D2') mcgSemanalD2 += aporte;
        else if (a.formaVitD === 'D3') mcgSemanalD3 += aporte;
    });

    let mcgSemanalSuplD3 = 0;
    let mcgSemanalSuplD2 = 0;
    if (suplementoVitD && suplementoVitD.mcgPorDia > 0 && suplementoVitD.diasPorSemana > 0) {
        const total = suplementoVitD.mcgPorDia * suplementoVitD.diasPorSemana;
        // Una forma no declarada se trata como D2, que es el supuesto
        // conservador: evita sobrestimar el aporte real.
        if (suplementoVitD.forma === 'D3') mcgSemanalSuplD3 += total;
        else mcgSemanalSuplD2 += total;
    }

    const dietaBruta = (mcgSemanalD3 + mcgSemanalD2) / 7;
    const suplBruto = (mcgSemanalSuplD3 + mcgSemanalSuplD2) / 7;

    const dietaEq = (mcgSemanalD3 * POTENCIA_VITD3 + mcgSemanalD2 * POTENCIA_VITD2) / 7;
    const suplEq = (mcgSemanalSuplD3 * POTENCIA_VITD3 + mcgSemanalSuplD2 * POTENCIA_VITD2) / 7;
    const totalEq = dietaEq + suplEq;

    let categoria, colorKey;
    if (totalEq >= ref.rda) { categoria = 'adecuada'; colorKey = 'emerald'; }
    else if (totalEq >= ref.ear) { categoria = 'moderada'; colorKey = 'amber'; }
    else { categoria = 'baja'; colorKey = 'rose'; }

    const totalBruto = dietaBruta + suplBruto;

    return {
        dietaBruta: Math.round(dietaBruta * 10) / 10,
        suplBruto: Math.round(suplBruto * 10) / 10,
        totalBruto: Math.round(totalBruto * 10) / 10,
        dietaEq: Math.round(dietaEq * 10) / 10,
        suplEq: Math.round(suplEq * 10) / 10,
        totalEq: Math.round(totalEq * 10) / 10,
        totalUI: Math.round(totalEq * 40),
        meta: ref.rda,
        metaUI: ref.rda * 40,
        ear: ref.ear,
        ul: ref.ul,
        categoria,
        colorKey,
        proporcionD2: totalBruto > 0
            ? Math.round(((mcgSemanalD2 + mcgSemanalSuplD2) / 7 / totalBruto) * 1000) / 10
            : 0,
        excedeUL: totalBruto > ref.ul
    };
};


// ------------------------------------------------------------
// 5b. PROTEÍNA ESTIMADA DESDE EL CUESTIONARIO
// ------------------------------------------------------------
// Se estima a partir del mismo cuestionario de frecuencia en lugar de
// preguntar gramos, porque casi nadie sabe cuánta proteína consume.
// La estimación solo es válida si el catálogo incluye las fuentes
// proteicas principales, no únicamente las de calcio; de ahí que el
// catálogo unificado incorpore cereales, carnes y derivados de soya.
const calcularProteinaDesdeCuestionario = (alimentos, { pesoKg, edad, esDietaVegetal }) => {
    const gramosSemana = (alimentos || []).reduce((acc, a) => {
        if (!a.diasPorSemana || !a.proteinaPorcion || !a.porcionesPorComida) return acc;
        return acc + (a.proteinaPorcion * a.porcionesPorComida * (a.vecesPorDia || 1) * a.diasPorSemana);
    }, 0);

    const gramosDia = gramosSemana / 7;
    const objetivo = obtenerObjetivoProteina(edad, esDietaVegetal);
    const peso = Number(pesoKg) || 0;

    if (peso <= 0) {
        return { gramosDia: Math.round(gramosDia * 10) / 10, objetivo, sinPeso: true };
    }

    const gPorKg = gramosDia / peso;
    const objetivoGramos = Math.round(objetivo * peso);

    let categoria, colorKey;
    if (gPorKg >= objetivo) { categoria = 'adecuada'; colorKey = 'emerald'; }
    else if (gPorKg >= objetivo * 0.8) { categoria = 'limitrofe'; colorKey = 'amber'; }
    else { categoria = 'baja'; colorKey = 'rose'; }

    return {
        gramosDia: Math.round(gramosDia * 10) / 10,
        gPorKg: Math.round(gPorKg * 100) / 100,
        objetivo,
        objetivoGramos,
        categoria,
        colorKey,
        sinPeso: false,
        razonAdecuacion: Math.round((gPorKg / objetivo) * 1000) / 10
    };
};


// ------------------------------------------------------------
// 6. INTERPRETACIÓN DE LABORATORIO
// ------------------------------------------------------------
// Escala completa de 25(OH)D, de deficiencia a toxicidad, según el
// marco elegido. Incluye el extremo superior porque la relación con
// mortalidad sigue una curva en J invertida: el riesgo sube por ambos
// lados, y una escala que solo mira hacia abajo dejaría pasar una
// intoxicación por sobresuplementación.
const interpretar25OHVitaminaD = (valorNgMl, marcoId = MARCO_VITD_POR_DEFECTO) => {
    if (valorNgMl === '' || valorNgMl === null || isNaN(valorNgMl)) return null;
    const v = parseFloat(valorNgMl);
    const nmol = Math.round(v * 2.496 * 10) / 10;
    const m = MARCOS_VITD[marcoId] || MARCO_VITD_OSEO;

    let categoria, colorKey;
    if (m.deficienciaSevera > 0 && v < m.deficienciaSevera) { categoria = 'deficiencia_severa'; colorKey = 'rose'; }
    else if (v < m.deficiente) { categoria = 'deficiente'; colorKey = 'rose'; }
    else if (v < m.insuficiente) { categoria = 'insuficiente'; colorKey = 'amber'; }
    else if (v < m.suficiente) { categoria = 'suficiente'; colorKey = 'emerald'; }
    else if (v < m.excesivo) { categoria = 'sobre_optimo'; colorKey = 'amber'; }
    else if (v < m.toxico) { categoria = 'excesivo'; colorKey = 'rose'; }
    else { categoria = 'toxico'; colorKey = 'rose'; }

    // Un mismo valor puede clasificarse distinto según el marco. Si es
    // el caso, se señala, porque es información relevante: significa
    // que el resultado cae en la zona donde los organismos discrepan.
    const otroMarcoId = marcoId === 'oseo' ? 'poblacional' : 'oseo';
    const o = MARCOS_VITD[otroMarcoId];
    let categoriaOtroMarco;
    if (o.deficienciaSevera > 0 && v < o.deficienciaSevera) categoriaOtroMarco = 'deficiencia_severa';
    else if (v < o.deficiente) categoriaOtroMarco = 'deficiente';
    else if (v < o.insuficiente) categoriaOtroMarco = 'insuficiente';
    else if (v < o.suficiente) categoriaOtroMarco = 'suficiente';
    else if (v < o.excesivo) categoriaOtroMarco = 'sobre_optimo';
    else if (v < o.toxico) categoriaOtroMarco = 'excesivo';
    else categoriaOtroMarco = 'toxico';

    return {
        categoria,
        colorKey,
        valor: v,
        nmol,
        marco: m.id,
        rangoObjetivo: { min: m.insuficiente, max: m.suficiente },
        categoriaOtroMarco,
        otroMarcoId,
        // Verdadero cuando el valor cae en la franja donde los marcos
        // discrepan (típicamente 20-29 ng/mL).
        zonaDeDesacuerdo: categoria !== categoriaOtroMarco,
        porEncimaDelRango: v >= m.suficiente,
        requiereRevisionClinica: v >= m.excesivo,
        toxicidadProbable: v >= m.toxico,
        bajoCorteHistorico2011: v < CORTE_ENDOCRINE_SOCIETY_2011
    };
};

// La manifestación clínica de la toxicidad por vitamina D es la
// hipercalcemia. Evaluar ambos analitos juntos detecta una combinación
// que por separado podría pasar como dos hallazgos leves.
const evaluarCombinacionVitDCalcio = (interpVitD, interpCalcio) => {
    if (!interpVitD || !interpCalcio) return null;
    const vitDAlta = interpVitD.porEncimaDelRango;
    const calcioAlto = interpCalcio.categoria === 'alto';
    if (vitDAlta && calcioAlto) {
        return { alerta: 'hipervitaminosis', colorKey: 'rose', urgente: true };
    }
    if (interpVitD.toxicidadProbable) {
        return { alerta: 'toxicidad_sin_calcio', colorKey: 'rose', urgente: true };
    }
    return null;
};

const interpretarCalcioSerico = (valorMgDl) => {
    if (valorMgDl === '' || valorMgDl === null || isNaN(valorMgDl)) return null;
    const v = parseFloat(valorMgDl);
    if (v < RANGO_CALCIO_SERICO_NORMAL_MG_DL.min) return { categoria: 'bajo', colorKey: 'rose', valor: v };
    if (v > RANGO_CALCIO_SERICO_NORMAL_MG_DL.max) return { categoria: 'alto', colorKey: 'amber', valor: v };
    return { categoria: 'normal', colorKey: 'emerald', valor: v };
};


// ------------------------------------------------------------
// 7. RIESGO ÓSEO COMPUESTO (orientativo, NO diagnóstico)
// ------------------------------------------------------------
// Puntaje de tamizaje pensado para calibrarse contra datos reales de
// densitometría (DXA). El peso del calcio ahora se basa en el
// cumplimiento de calcio ABSORBIDO, no ingerido.
const calcularRiesgoOseo = ({ porcentajeCumplimientoCalcio, categoriaRiesgoSolar, categoriaVitDDieta,
                              edad, sexo, diasEjercicioFuerza, fuma, alcoholFrecuente, bajoUmbralEpicOxford, esVegano }) => {
    let puntaje = 0;
    const contribuciones = [];

    const add = (pts, key) => { if (pts > 0) { puntaje += pts; contribuciones.push({ key, pts }); } };

    if (porcentajeCumplimientoCalcio < 50) add(2, 'risk_calcium_low');
    else if (porcentajeCumplimientoCalcio < 80) add(1, 'risk_calcium_mod');

    if (categoriaRiesgoSolar === 'alto' && categoriaVitDDieta === 'baja') add(2, 'risk_vitd_both');
    else if (categoriaRiesgoSolar === 'alto' || categoriaVitDDieta === 'baja') add(1, 'risk_vitd_one');

    if (edad >= 65) add(1, 'risk_age');
    if (sexo === 'femenino' && edad >= 50) add(1, 'risk_postmenopause');
    if ((diasEjercicioFuerza ?? 0) < UMBRAL_EJERCICIO_FUERZA_SEMANAL) add(1, 'risk_no_strength');
    if (fuma) add(1, 'risk_smoking');
    if (alcoholFrecuente) add(1, 'risk_alcohol');

    // Hallazgo de EPIC-Oxford: el exceso de riesgo de fractura en
    // veganos se concentró en quienes ingerían <525 mg/día de calcio.
    if (esVegano && bajoUmbralEpicOxford) add(1, 'risk_epic_threshold');

    let categoria, colorKey;
    if (puntaje <= 2) { categoria = 'bajo'; colorKey = 'emerald'; }
    else if (puntaje <= 4) { categoria = 'moderado'; colorKey = 'amber'; }
    else { categoria = 'alto'; colorKey = 'rose'; }

    return { puntaje, puntajeMaximo: 10, categoria, colorKey, contribuciones };
};


// ------------------------------------------------------------
// 8. TAMIZAJE DE SARCOPENIA (SARC-F)
// ------------------------------------------------------------
// Se reportan AMBOS cortes: el validado estándar (≥4, alta
// especificidad ~85-95% pero sensibilidad baja ~30-55%) y el corte
// sensible (≥2) propuesto para no perder casos tempranos.
const calcularRiesgoSarcopenia = (respuestasSarcF, opciones = {}) => {
    const { proteinaAdecuada, diasEjercicioFuerza, circunferenciaPantorrilla, sexo } = opciones;
    const respondidas = Object.values(respuestasSarcF || {}).filter(v => v !== '' && v !== null && v !== undefined);
    const puntajeTotal = respondidas.reduce((acc, v) => acc + (Number(v) || 0), 0);
    const completo = respondidas.length === PREGUNTAS_SARC_F.length;

    const riesgoEspecifico = puntajeTotal >= UMBRAL_SARC_F_ESPECIFICO;
    const riesgoSensible = puntajeTotal >= UMBRAL_SARC_F_SENSIBLE;

    // Circunferencia de pantorrilla (componente SARC-CalF)
    let pantorrillaBaja = null;
    if (circunferenciaPantorrilla && Number(circunferenciaPantorrilla) > 0) {
        const corte = CORTE_PANTORRILLA_CM[sexo] ?? CORTE_PANTORRILLA_CM.femenino;
        pantorrillaBaja = Number(circunferenciaPantorrilla) < corte;
    }

    let categoria, colorKey;
    if (riesgoEspecifico) { categoria = 'riesgo'; colorKey = 'rose'; }
    else if (riesgoSensible || pantorrillaBaja) { categoria = 'alerta'; colorKey = 'amber'; }
    else { categoria = 'bajo'; colorKey = 'emerald'; }

    return {
        puntajeTotal,
        puntajeMaximo: 10,
        completo,
        riesgoProbable: riesgoEspecifico,
        superaCorteSensible: riesgoSensible,
        pantorrillaBaja,
        categoria,
        colorKey,
        senales: {
            proteinaInadecuada: proteinaAdecuada === false,
            ejercicioFuerzaInsuficiente: (diasEjercicioFuerza ?? 0) < UMBRAL_EJERCICIO_FUERZA_SEMANAL
        }
    };
};


// ------------------------------------------------------------
// 9. EJERCICIO — ADHERENCIA A LAS GUÍAS DE LA OMS
// ------------------------------------------------------------
const calcularAdherenciaEjercicio = ({ horasAerobicoSemana, diasFuerzaSemana, horasFuerzaSemana }) => {
    const aerobico = Number(horasAerobicoSemana) || 0;
    const diasFuerza = Number(diasFuerzaSemana) || 0;
    const horasFuerza = Number(horasFuerzaSemana) || 0;

    return {
        cumpleAerobico: aerobico >= UMBRAL_EJERCICIO_AEROBICO_HORAS_SEMANA,
        cumpleFuerza: diasFuerza >= UMBRAL_EJERCICIO_FUERZA_SEMANAL,
        cumpleAmbas: aerobico >= UMBRAL_EJERCICIO_AEROBICO_HORAS_SEMANA && diasFuerza >= UMBRAL_EJERCICIO_FUERZA_SEMANAL,
        minutosAerobicoSemana: Math.round(aerobico * 60),
        horasTotalesSemana: Math.round((aerobico + horasFuerza) * 10) / 10
    };
};


// ------------------------------------------------------------
// 10. PROTEÍNA
// ------------------------------------------------------------
const calcularAdecuacionProteina = ({ gramosProteinaDia, pesoKg, edad, esDietaVegetal }) => {
    const objetivo = obtenerObjetivoProteina(edad, esDietaVegetal);
    const peso = Number(pesoKg) || 0;
    const gramos = Number(gramosProteinaDia) || 0;
    if (peso <= 0) return { objetivo, sinDatos: true };

    const gPorKg = gramos / peso;
    const objetivoGramos = Math.round(objetivo * peso);

    let categoria, colorKey;
    if (gPorKg >= objetivo) { categoria = 'adecuada'; colorKey = 'emerald'; }
    else if (gPorKg >= objetivo * 0.8) { categoria = 'limitrofe'; colorKey = 'amber'; }
    else { categoria = 'baja'; colorKey = 'rose'; }

    return {
        gPorKg: Math.round(gPorKg * 100) / 100,
        objetivo,
        objetivoGramos,
        categoria,
        colorKey,
        sinDatos: false
    };
};


// ------------------------------------------------------------
// 11. CLASIFICACIÓN DEL MÓDULO DE CALCIO
// ------------------------------------------------------------
// Usa la razón continua de adecuación (calcio absorbido / meta) como
// criterio primario, y el conteo de días como matiz de regularidad.
const clasificarAdecuacionCalcio = (razonAdecuacion) => {
    if (razonAdecuacion >= 100) return { categoria: 'optima', colorKey: 'emerald' };
    if (razonAdecuacion >= 75)  return { categoria: 'adecuada', colorKey: 'emerald' };
    if (razonAdecuacion >= 50)  return { categoria: 'limitrofe', colorKey: 'amber' };
    if (razonAdecuacion >= 25)  return { categoria: 'baja', colorKey: 'rose' };
    return { categoria: 'muy_baja', colorKey: 'rose' };
};


// ------------------------------------------------------------
// 12. EXPOSICIÓN SOLAR EN UNIDADES ESTÁNDAR (SED / MED / UI)
// ------------------------------------------------------------
// Sustituye el índice en unidades arbitrarias por tres magnitudes que
// sí tienen significado reconocido en la literatura y para el usuario:
//
//   1. SED recibidos por semana — unidad estándar internacional,
//      independiente del fototipo (1 SED = 100 J/m²).
//   2. Fracción de MED por sesión — indica si la exposición se acerca
//      al umbral de quemadura para ESE fototipo.
//   3. Equivalente en UI de vitamina D — aplicando la regla de Holick
//      (¼ MED sobre ¼ de superficie corporal ≈ 1000 UI), que traduce
//      la exposición a la misma unidad de los suplementos.
// Constante de calibración de la regla de Holick: se fija de modo que
// en el punto de referencia de la regla (¼ MED sobre ¼ de superficie
// corporal) el modelo devuelva exactamente 1000 UI, manteniendo a la
// vez la saturación fisiológica de la síntesis cutánea.
const K_HOLICK = 0.4735;

const FOTOTIPO_VALIDO = (f) => (MED_POR_FOTOTIPO_SED[f] ? f : 'III');

const calcularExposicionSolarEstandar = ({ diasPorSemana, minutosPorSesion, horario, edad, fototipo, superficieCorporal, indiceUVPersonalizado }) => {
    const dias = Number(diasPorSemana) || 0;
    const minutos = Number(minutosPorSesion) || 0;
    const ft = FOTOTIPO_VALIDO(fototipo);

    // El índice UV equivale aproximadamente a los SED recibidos en una
    // hora de exposición a esa intensidad.
    const indiceUV = Number(indiceUVPersonalizado) > 0
        ? Number(indiceUVPersonalizado)
        : (INDICE_UV_TIPICO[horario] ?? INDICE_UV_TIPICO.no_pico);

    const sedPorSesion = indiceUV * (minutos / 60);
    const sedSemanal = sedPorSesion * dias;

    const medEnSed = MED_POR_FOTOTIPO_SED[ft];
    const fraccionMEDPorSesion = medEnSed > 0 ? sedPorSesion / medEnSed : 0;

    // Regla de Holick: ¼ MED sobre ¼ de superficie corporal ≈ 1000 UI.
    // Se generaliza proporcionalmente a la dosis y superficie reales.
    const fraccionSuperficie = FRACCION_SUPERFICIE_CORPORAL[superficieCorporal] ?? FRACCION_SUPERFICIE_CORPORAL.parcial;
    const factorEdad = calcularFactorEdadSintesis(edad);

    // SATURACIÓN DE LA SÍNTESIS CUTÁNEA: la regla de Holick es lineal
    // solo en el tramo bajo. Más allá de aproximadamente 1 MED la
    // previtamina D3 se fotodegrada a lumisterol y taquisterol, de modo
    // que la síntesis alcanza una meseta y exponerse más tiempo solo
    // añade riesgo de quemadura sin aportar vitamina D adicional.
    // Se modela con una saturación exponencial que alcanza ~95% del
    // máximo en 1 MED.
    const fraccionEfectiva = 1 - Math.exp(-3 * fraccionMEDPorSesion);
    const uiPorSesion = (fraccionEfectiva / 0.25) * (fraccionSuperficie / 0.25) * 1000 * factorEdad * K_HOLICK;
    const uiSemanal = uiPorSesion * dias;
    const uiPromedioDia = uiSemanal / 7;
    const mcgPromedioDia = uiPromedioDia / UI_POR_MCG_VITAMINA_D;

    // Tiempo que necesitaría ESTA persona para obtener 1000 UI en una
    // sola sesión, dado su fototipo, superficie expuesta, edad y el
    // índice UV de la franja horaria elegida. Es la cifra más
    // accionable de todo el módulo.
    // Se invierte la curva de saturación para hallar los minutos
    // necesarios. Si la meseta fisiológica no alcanza las 1000 UI con la
    // superficie expuesta declarada, se devuelve null y la interfaz
    // recomienda exponer más superficie en vez de más tiempo.
    const uiMaximaAlcanzable = (1 / 0.25) * (fraccionSuperficie / 0.25) * 1000 * factorEdad * K_HOLICK;
    let minutosPara1000UI = null;
    if (uiMaximaAlcanzable > 1000 && indiceUV > 0 && medEnSed > 0) {
        const fraccionEfectivaNecesaria = 1000 / ((1 / 0.25) * (fraccionSuperficie / 0.25) * 1000 * factorEdad * K_HOLICK);
        const fraccionMEDNecesaria = -Math.log(1 - fraccionEfectivaNecesaria) / 3;
        const sedNecesarios = fraccionMEDNecesaria * medEnSed;
        minutosPara1000UI = (sedNecesarios / indiceUV) * 60;
    }

    // Advertencia de seguridad: exposiciones por encima de 1 MED
    // producen eritema sin aportar vitamina D adicional, porque la
    // síntesis cutánea se autolimita por fotodegradación.
    const riesgoQuemadura = fraccionMEDPorSesion >= 1.0;
    const sobreexposicionSinBeneficio = fraccionMEDPorSesion > 0.5;

    return {
        sedPorSesion: Math.round(sedPorSesion * 100) / 100,
        sedSemanal: Math.round(sedSemanal * 10) / 10,
        fraccionMEDPorSesion: Math.round(fraccionMEDPorSesion * 100) / 100,
        medEnSed,
        indiceUV,
        uiPorSesion: Math.round(uiPorSesion),
        uiSemanal: Math.round(uiSemanal),
        uiPromedioDia: Math.round(uiPromedioDia),
        mcgPromedioDia: Math.round(mcgPromedioDia * 10) / 10,
        minutosPara1000UI: minutosPara1000UI !== null ? Math.round(minutosPara1000UI) : null,
        uiMaximaAlcanzable: Math.round(uiMaximaAlcanzable),
        riesgoQuemadura,
        sobreexposicionSinBeneficio,
        factorEdad: Math.round(factorEdad * 100) / 100
    };
};



// ------------------------------------------------------------
// 13. INHIBIDORES Y PÉRDIDAS DE CALCIO
// ------------------------------------------------------------
// El uso de inhibidores de la bomba de protones (IBP) reduce la
// absorción del CARBONATO de calcio, que requiere acidez gástrica para
// disolverse; no afecta al citrato. El sodio y la cafeína no reducen la
// absorción sino que aumentan la PÉRDIDA urinaria de calcio, por lo que
// se restan del calcio absorbido neto.
const calcularFactorIBP = (usaIBP, tipoSuplemento) => {
    if (!usaIBP) return { alimentos: 1.0, suplemento: 1.0 };
    return {
        alimentos: FACTOR_IBP_SOBRE_ALIMENTOS,
        suplemento: tipoSuplemento === 'citrato' ? FACTOR_IBP_SOBRE_CITRATO : FACTOR_IBP_SOBRE_CARBONATO
    };
};

const calcularPerdidasCalcio = ({ nivelSodio, tazasCafeDia }) => {
    const nivel = NIVELES_SODIO.find(n => n.id === nivelSodio);
    const gramosSodio = nivel ? nivel.gramosDia : 0;
    const perdidaSodio = gramosSodio * CALCIO_PERDIDO_POR_GRAMO_SODIO;
    const perdidaCafeina = (Number(tazasCafeDia) || 0) * CALCIO_PERDIDO_POR_TAZA_CAFE;

    return {
        perdidaSodio: Math.round(perdidaSodio * 10) / 10,
        perdidaCafeina: Math.round(perdidaCafeina * 10) / 10,
        perdidaTotal: Math.round((perdidaSodio + perdidaCafeina) * 10) / 10,
        gramosSodio,
        tazasCafe: Number(tazasCafeDia) || 0
    };
};

// Aplica inhibidores y pérdidas al resultado bruto del motor de calcio,
// devolviendo el balance NETO estimado.
const aplicarModificadoresCalcio = (resultadosCalcio, { usaIBP, tipoSuplemento, nivelSodio, tazasCafeDia }) => {
    const factores = calcularFactorIBP(usaIBP, tipoSuplemento);
    const perdidas = calcularPerdidasCalcio({ nivelSodio, tazasCafeDia });

    // El ajuste por IBP se aplica de forma PONDERADA: la porción del
    // calcio absorbido que proviene del suplemento recibe el factor del
    // suplemento (que protege al citrato), y el resto recibe el factor
    // de los alimentos. Sin esta separación, el citrato y el carbonato
    // darían el mismo resultado y se perdería toda la utilidad clínica.
    const absSuplemento = resultadosCalcio.promedioAbsorbidoSuplemento || 0;
    const absAlimentos = Math.max(0, resultadosCalcio.promedioAbsorbidoSemanal - absSuplemento);
    const absorbidoAjustado = (absAlimentos * factores.alimentos) + (absSuplemento * factores.suplemento);
    const absorbidoNeto = Math.max(0, absorbidoAjustado - perdidas.perdidaTotal);

    const razonNeta = resultadosCalcio.metaAbsorbidaDiaria > 0
        ? Math.round((absorbidoNeto / resultadosCalcio.metaAbsorbidaDiaria) * 1000) / 10
        : 0;

    return {
        ...resultadosCalcio,
        absorbidoBruto: resultadosCalcio.promedioAbsorbidoSemanal,
        absorbidoNeto: Math.round(absorbidoNeto * 10) / 10,
        razonAdecuacionNeta: razonNeta,
        perdidas,
        factorIBPAplicado: factores,
        // Alerta accionable: usuario de IBP tomando carbonato
        alertaIBPCarbonato: !!usaIBP && tipoSuplemento === 'carbonato'
    };
};


