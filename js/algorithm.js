// ============================================================
// CalD Risk Screen — Calcium & Vitamin D Absorption Risk Algorithm (CARDA v1.1)
// Motor de cálculo determinista: distribución en semana virtual,
// absorción fisiológica de calcio (según tipo de suplemento), índice
// de exposición solar (con fototipo), adecuación dietética de vitamina
// D, riesgo óseo compuesto, y tamizaje de sarcopenia (SARC-F).
//
// Adaptado de la arquitectura de B12 Risk Screen (BREA v3.0) del mismo
// autor. © Jean Carlos Ruiz Mosley. Todos los derechos reservados.
// ============================================================

// ------------------------------------------------------------
// 1. DISTRIBUCIÓN DE LA SEMANA VIRTUAL (genérica)
// ------------------------------------------------------------
const distanciaCircular = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, 7 - d);
};

const asignarDiasDeSemana = (alimentosConContribucion) => {
    const cargaPorDia = Array(7).fill(0);
    const asignaciones = {};

    const ordenados = [...alimentosConContribucion].sort(
        (a, b) => b.contribucionEstimadaPorDia - a.contribucionEstimadaPorDia
    );

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
// 2. ABSORCIÓN FISIOLÓGICA DE CALCIO POR DOSIS (saturable)
// ------------------------------------------------------------
// Basado en la evidencia de biodisponibilidad de calcio (NIH ODS;
// Heaney et al.): la fracción absorbida por transporte activo se
// satura cerca de 500 mg por toma; el excedente se absorbe solo por
// difusión paracelular pasiva. "factorTipo" ajusta la eficiencia activa
// según el tipo de sal usada en el suplemento (ver TIPOS_SUPLEMENTO_CALCIO
// en data.js): el citrato de calcio se absorbe ~20-27% mejor que el
// carbonato (Sakhaee et al. 1999; Heller et al. 2000).
const calcularAbsorcionCalcio = (ingerido, factorTipo = 1.0) => {
    if (ingerido <= 0) return 0;

    const activo = Math.min(ingerido, ABSORCION_MAXIMA_ACTIVA_POR_DOSIS) * EFICIENCIA_ABSORCION_ACTIVA * factorTipo;
    const pasivo = ingerido > ABSORCION_MAXIMA_ACTIVA_POR_DOSIS
        ? (ingerido - ABSORCION_MAXIMA_ACTIVA_POR_DOSIS) * EFICIENCIA_ABSORCION_PASIVA
        : 0;

    return Math.round((activo + pasivo) * 100) / 100;
};

// ------------------------------------------------------------
// 3. MOTOR PRINCIPAL — SEMANA VIRTUAL DE CALCIO
// ------------------------------------------------------------
// suplemento: { mgPorDia, vecesPorDia, diasPorSemana, tipoId } | null
const ejecutarSemanaVirtualCalcio = (alimentos, suplemento, overridesManual = {}) => {
    let semanaVirtual = Array(7).fill(null).map(() =>
        Array(3).fill(null).map(() => ({
            alimentos: [],
            totalIngerido: 0,       // suma simple de mg (para mostrar al usuario)
            totalEfectivo: 0,       // suma ponderada por factorTipo (para el cálculo de absorción)
            totalAbsorbido: 0,
            suplementoAgregado: null
        }))
    );

    // 3.1 Determinar en qué días participa cada alimento
    const alimentosConDatos = alimentos
        .map(alimento => {
            const { diasPorSemana, vecesPorDia, porcionesPorComida, calcioPorcion } = alimento;
            if (diasPorSemana === 0 || vecesPorDia === 0 || porcionesPorComida === 0 || !calcioPorcion) return null;

            const contribucionEstimadaPorDia = calcioPorcion * porcionesPorComida * vecesPorDia;
            return { ...alimento, contribucionEstimadaPorDia };
        })
        .filter(Boolean);

    const diasAsignadosPorAlimento = asignarDiasDeSemana(
        alimentosConDatos.map(al => ({
            id: al.id,
            diasPorSemana: al.diasPorSemana,
            contribucionEstimadaPorDia: al.contribucionEstimadaPorDia
        }))
    );

    const alimentosActivos = alimentosConDatos.map(alimento => ({
        ...alimento,
        diasAsignados: diasAsignadosPorAlimento[alimento.id] || []
    }));

    // 3.2 Para cada día, repartir dinámicamente las comidas
    const colocacionesAutomaticas = [];
    const contadorPorAlimento = {};

    for (let diaIdx = 0; diaIdx < 7; diaIdx++) {
        const foodsDelDia = alimentosActivos
            .filter(al => al.diasAsignados.includes(diaIdx))
            .map(al => ({ id: al.id, vecesPorDia: al.vecesPorDia }));

        if (foodsDelDia.length === 0) continue;

        const comidasAsignadasPorAlimento = asignarComidasDelDia(foodsDelDia);

        alimentosActivos
            .filter(al => al.diasAsignados.includes(diaIdx))
            .forEach(alimento => {
                const { id, nombreKey, porcionesPorComida, calcioPorcion } = alimento;
                const comidasAsignadas = comidasAsignadasPorAlimento[id] || [];

                comidasAsignadas.forEach(comidaIdx => {
                    const occurrenceIndex = contadorPorAlimento[id] || 0;
                    contadorPorAlimento[id] = occurrenceIndex + 1;

                    colocacionesAutomaticas.push({
                        id,
                        nombreKey,
                        porciones: porcionesPorComida,
                        calcioIngerido: calcioPorcion * porcionesPorComida,
                        diaAuto: diaIdx,
                        comidaAuto: comidaIdx,
                        occurrenceIndex
                    });
                });
            });
    }

    // 3.3 Aplicar overrides manuales del usuario
    colocacionesAutomaticas.forEach(colocacion => {
        const override = overridesManual?.[colocacion.id]?.[colocacion.occurrenceIndex];
        const diaFinal = override ? override.dia : colocacion.diaAuto;
        const comidaFinal = override ? override.comida : colocacion.comidaAuto;
        const esManual = !!override;

        semanaVirtual[diaFinal][comidaFinal].alimentos.push({
            id: colocacion.id,
            nombreKey: colocacion.nombreKey,
            porciones: colocacion.porciones,
            calcioIngerido: colocacion.calcioIngerido,
            occurrenceIndex: colocacion.occurrenceIndex,
            esManual: esManual,
            diaAuto: colocacion.diaAuto,
            comidaAuto: colocacion.comidaAuto
        });
        semanaVirtual[diaFinal][comidaFinal].totalIngerido += colocacion.calcioIngerido;
        semanaVirtual[diaFinal][comidaFinal].totalEfectivo += colocacion.calcioIngerido; // factorTipo=1 para alimentos
    });

    // 3.4 Distribuir el suplemento de calcio (si aplica)
    if (suplemento && suplemento.mgPorDia > 0 && suplemento.diasPorSemana > 0) {
        const { mgPorDia, vecesPorDia, diasPorSemana, tipoId } = suplemento;
        const tipoInfo = (typeof TIPOS_SUPLEMENTO_CALCIO !== 'undefined'
            ? TIPOS_SUPLEMENTO_CALCIO.find(t => t.id === tipoId)
            : null) || { factorAbsorcion: 1.0 };
        const dosisPorToma = mgPorDia / Math.max(vecesPorDia, 1);

        const diasConSuplemento = diasPorSemana >= 7
            ? [0, 1, 2, 3, 4, 5, 6]
            : (asignarDiasDeSemana([{ id: 'supl', diasPorSemana, contribucionEstimadaPorDia: mgPorDia }])['supl'] || []);

        diasConSuplemento.forEach(d => {
            const comidasOrdenadas = [0, 1, 2].map(c => ({
                index: c,
                cargaActual: semanaVirtual[d][c].totalIngerido
            })).sort((a, b) => a.cargaActual - b.cargaActual);

            for (let i = 0; i < vecesPorDia && i < 3; i++) {
                const comidaDestino = comidasOrdenadas[i].index;
                semanaVirtual[d][comidaDestino].totalIngerido += dosisPorToma;
                semanaVirtual[d][comidaDestino].totalEfectivo += dosisPorToma * tipoInfo.factorAbsorcion;
                semanaVirtual[d][comidaDestino].suplementoAgregado = {
                    dosis: Math.round(dosisPorToma),
                    etiqueta: `${Math.round(dosisPorToma)} mg`
                };
            }
        });
    }

    // 3.5 Aplicar el cálculo de absorción fisiológica por comida
    let diasCumplidosCount = 0;
    let diasNoCumplidosCount = 0;
    const reporteDias = [];

    semanaVirtual.forEach((dia, diaIdx) => {
        let absorbidoDia = 0;
        let ingeridoDia = 0;

        const comidasDetalle = dia.map((comida, comidaIdx) => {
            // El "efectivo" ya incorpora el factor de mejor/peor absorción del
            // tipo de suplemento; se le aplica igual la curva de saturación.
            const absorbidoComida = calcularAbsorcionCalcio(comida.totalEfectivo, 1.0);
            dia[comidaIdx].totalAbsorbido = absorbidoComida;
            absorbidoDia += absorbidoComida;
            ingeridoDia += comida.totalIngerido;

            return {
                nombreKey: `comida_${comidaIdx}`,
                alimentosConsumidos: comida.alimentos,
                suplemento: comida.suplementoAgregado,
                totalIngerido: comida.totalIngerido,
                totalAbsorbido: absorbidoComida
            };
        });

        const cumpleMeta = absorbidoDia >= META_ABSORCION_DIARIA_MG;

        if (cumpleMeta) diasCumplidosCount++; else diasNoCumplidosCount++;

        reporteDias.push({
            diaNombreKey: DIAS_SEMANA[diaIdx].nameKey,
            diaCortoKey: DIAS_SEMANA[diaIdx].shortKey,
            comidas: comidasDetalle,
            totalIngeridoDia: Math.round(ingeridoDia * 10) / 10,
            totalAbsorbidoDia: Math.round(absorbidoDia * 100) / 100,
            cumpleMeta: cumpleMeta
        });
    });

    const porcentajeCumplimiento = (diasCumplidosCount / 7) * 100;

    return {
        semanaVirtual,
        reporteDias,
        diasCumplidos: diasCumplidosCount,
        diasNoCumplidos: diasNoCumplidosCount,
        porcentajeCumplimiento: Math.round(porcentajeCumplimiento * 10) / 10,
        promedioIngeridoSemanal: Math.round((reporteDias.reduce((acc, d) => acc + d.totalIngeridoDia, 0) / 7) * 10) / 10,
        promedioAbsorbidoSemanal: Math.round((reporteDias.reduce((acc, d) => acc + d.totalAbsorbidoDia, 0) / 7) * 100) / 100
    };
};

// ------------------------------------------------------------
// 4. ÍNDICE DE EXPOSICIÓN SOLAR (proxy de síntesis de vitamina D)
// ------------------------------------------------------------
// No mide 25-OH-D sérica; estima una "carga de síntesis cutánea
// semanal" a partir de hábitos de exposición SIN protector solar
// (el protector bloquea la síntesis, por eso no se pregunta como
// variable — se asume ausente en esta estimación).
const calcularIndiceExposicionSolar = ({ diasPorSemana, minutosPorSesion, horario, edadBracket, fototipo }) => {
    const factorHorario = FACTOR_HORARIO[horario] ?? FACTOR_HORARIO.no_pico;
    const factorEdad = FACTOR_EDAD_SINTESIS[edadBracket] ?? FACTOR_EDAD_SINTESIS.menor_50;
    const factorFototipo = FACTOR_FOTOTIPO[fototipo] ?? FACTOR_FOTOTIPO.III;

    const indice = (diasPorSemana || 0) * (minutosPorSesion || 0) * factorHorario * factorEdad * factorFototipo;

    let categoria, colorKey;
    if (indice < UMBRAL_INDICE_SOLAR_BAJO) {
        categoria = 'alto';
        colorKey = 'rose';
    } else if (indice < UMBRAL_INDICE_SOLAR_MODERADO) {
        categoria = 'moderado';
        colorKey = 'amber';
    } else {
        categoria = 'bajo';
        colorKey = 'emerald';
    }

    return { indice: Math.round(indice * 10) / 10, categoriaRiesgo: categoria, colorKey };
};

// Interpretación opcional de 25-OH-vitamina D sérica real (ng/mL)
const interpretar25OHVitaminaD = (valorNgMl) => {
    if (valorNgMl === '' || valorNgMl === null || isNaN(valorNgMl)) return null;
    const v = parseFloat(valorNgMl);
    if (v < CORTES_25OH_VITAMINA_D.deficiente) return { categoria: 'deficiente', colorKey: 'rose' };
    if (v < CORTES_25OH_VITAMINA_D.insuficiente) return { categoria: 'insuficiente', colorKey: 'amber' };
    return { categoria: 'suficiente', colorKey: 'emerald' };
};

// Interpretación opcional de calcio sérico total (mg/dL)
const interpretarCalcioSerico = (valorMgDl) => {
    if (valorMgDl === '' || valorMgDl === null || isNaN(valorMgDl)) return null;
    const v = parseFloat(valorMgDl);
    if (v < RANGO_CALCIO_SERICO_NORMAL_MG_DL.min) return { categoria: 'bajo', colorKey: 'rose' };
    if (v > RANGO_CALCIO_SERICO_NORMAL_MG_DL.max) return { categoria: 'alto', colorKey: 'amber' };
    return { categoria: 'normal', colorKey: 'emerald' };
};

// ------------------------------------------------------------
// 5. ADECUACIÓN DIETÉTICA DE VITAMINA D (dieta + suplemento)
// ------------------------------------------------------------
// Suma simple del promedio diario estimado de vitamina D dietética
// (mcg/día, a partir de fuentes semanales) más el suplemento de
// vitamina D (si aplica), comparado contra la RDA (IOM 2011).
const calcularAdecuacionVitaminaDDieta = (fuentes, suplementoVitD, edad) => {
    const mcgSemanalDieta = (fuentes || []).reduce((acc, f) => {
        if (!f.diasPorSemana || !f.vitDPorcion || !f.porcionesPorComida) return acc;
        return acc + (f.vitDPorcion * f.porcionesPorComida * (f.vecesPorDia || 1) * f.diasPorSemana);
    }, 0);
    const mcgPromedioDiaDieta = mcgSemanalDieta / 7;

    let mcgPromedioDiaSuplemento = 0;
    if (suplementoVitD && suplementoVitD.mcgPorDia > 0 && suplementoVitD.diasPorSemana > 0) {
        mcgPromedioDiaSuplemento = (suplementoVitD.mcgPorDia * suplementoVitD.diasPorSemana) / 7;
    }

    const totalPromedioDia = mcgPromedioDiaDieta + mcgPromedioDiaSuplemento;
    const meta = (edad ?? 0) > 70 ? META_VITAMINA_D_MCG_DIA_MAYOR70 : META_VITAMINA_D_MCG_DIA;

    let categoria, colorKey;
    if (totalPromedioDia >= meta) {
        categoria = 'adecuada';
        colorKey = 'emerald';
    } else if (totalPromedioDia >= meta * 0.5) {
        categoria = 'moderada';
        colorKey = 'amber';
    } else {
        categoria = 'baja';
        colorKey = 'rose';
    }

    return {
        mcgPromedioDiaDieta: Math.round(mcgPromedioDiaDieta * 10) / 10,
        mcgPromedioDiaSuplemento: Math.round(mcgPromedioDiaSuplemento * 10) / 10,
        totalPromedioDia: Math.round(totalPromedioDia * 10) / 10,
        meta,
        categoria,
        colorKey
    };
};

// ------------------------------------------------------------
// 6. RIESGO ÓSEO COMPUESTO (osteopenia / osteoporosis)
// ------------------------------------------------------------
// Estimación de tamizaje orientativa, NO diagnóstica. Pensada para
// calibrarse a futuro contra datos reales de DXA.
const calcularRiesgoOseo = ({ porcentajeCumplimientoCalcio, categoriaRiesgoSolar, edad, sexo, diasEjercicioFuerza, fuma, alcoholFrecuente }) => {
    let puntaje = 0;

    if (porcentajeCumplimientoCalcio < 50) puntaje += 2;
    else if (porcentajeCumplimientoCalcio < 80) puntaje += 1;

    if (categoriaRiesgoSolar === 'alto') puntaje += 2;
    else if (categoriaRiesgoSolar === 'moderado') puntaje += 1;

    if (edad >= 65) puntaje += 1;
    if (sexo === 'femenino' && edad >= 50) puntaje += 1; // mayor pérdida ósea post-menopausia

    if ((diasEjercicioFuerza ?? 0) < UMBRAL_EJERCICIO_FUERZA_SEMANAL) puntaje += 1;
    if (fuma) puntaje += 1;
    if (alcoholFrecuente) puntaje += 1;

    let categoria, colorKey;
    if (puntaje <= 2) { categoria = 'bajo'; colorKey = 'emerald'; }
    else if (puntaje <= 4) { categoria = 'moderado'; colorKey = 'amber'; }
    else { categoria = 'alto'; colorKey = 'rose'; }

    return { puntaje, puntajeMaximo: 8, categoria, colorKey };
};

// ------------------------------------------------------------
// 7. TAMIZAJE DE SARCOPENIA (SARC-F)
// ------------------------------------------------------------
const calcularRiesgoSarcopenia = (respuestasSarcF, { proteinaAdecuada, diasEjercicioFuerza } = {}) => {
    const puntajeTotal = Object.values(respuestasSarcF || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
    const riesgoProbable = puntajeTotal >= UMBRAL_SARC_F_RIESGO;

    return {
        puntajeTotal,
        puntajeMaximo: 10,
        riesgoProbable,
        categoria: riesgoProbable ? 'riesgo' : 'bajo',
        colorKey: riesgoProbable ? 'rose' : 'emerald',
        senales: {
            proteinaInadecuada: proteinaAdecuada === false,
            ejercicioFuerzaInsuficiente: (diasEjercicioFuerza ?? 0) < UMBRAL_EJERCICIO_FUERZA_SEMANAL
        }
    };
};

// ------------------------------------------------------------
// 8. EJERCICIO — Adherencia a las guías de actividad física de la OMS
// ------------------------------------------------------------
const calcularAdherenciaEjercicio = ({ horasAerobicoSemana, diasFuerzaSemana, horasFuerzaSemana }) => {
    const cumpleAerobico = (horasAerobicoSemana ?? 0) >= UMBRAL_EJERCICIO_AEROBICO_HORAS_SEMANA;
    const cumpleFuerza = (diasFuerzaSemana ?? 0) >= UMBRAL_EJERCICIO_FUERZA_SEMANAL;
    const horasTotalesSemana = Math.round(((horasAerobicoSemana ?? 0) + (horasFuerzaSemana ?? 0)) * 10) / 10;

    return { cumpleAerobico, cumpleFuerza, horasTotalesSemana };
};
