// ============================================================
// CalD Risk Screen — Calcium & Vitamin D Absorption Risk Algorithm (CARDA v1.0)
// Motor de cálculo determinista: distribución en semana virtual,
// fórmula de absorción fisiológica de calcio, índice de exposición
// solar (proxy de vitamina D), riesgo óseo compuesto y tamizaje
// de sarcopenia (SARC-F).
//
// Adaptado de la arquitectura de B12 Risk Screen (BREA v3.0) del
// mismo autor. © Jean Carlos Ruiz Mosley. Todos los derechos reservados.
// ============================================================

// ------------------------------------------------------------
// 1. DISTRIBUCIÓN DE LA SEMANA VIRTUAL (genérica, reutilizada del
//    motor de B12: reparte cada alimento en los días/comidas de
//    menor carga acumulada para nivelar el consumo)
// ------------------------------------------------------------
const distanciaCircular = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, 7 - d);
};

const asignarDiasDeSemana = (alimentosConContribucion) => {
    // alimentosConContribucion: [{ id, diasPorSemana, contribucionEstimadaPorDia }, ...]
    const cargaPorDia = Array(7).fill(0); // mg de calcio estimados acumulados por día
    const asignaciones = {}; // id -> [diaIdx, ...]

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
    // foodsDelDia: [{ id, vecesPorDia }, ...]
    const carga = [0, 0, 0]; // conteo de alimentos ya colocados por comida (0,1,2)
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
// Modelo simplificado basado en la evidencia de biodisponibilidad de
// calcio (Heaney et al.): la fracción absorbida por transporte activo
// (vitamina D-dependiente) se satura cerca de 500 mg por toma; el
// excedente se absorbe solo por difusión paracelular pasiva, con menor
// eficiencia. Esta es la base fisiológica de la recomendación de
// fraccionar el calcio (dieta + suplemento) en varias tomas al día.
const calcularAbsorcionCalcio = (ingerido) => {
    if (ingerido <= 0) return 0;

    const activo = Math.min(ingerido, ABSORCION_MAXIMA_ACTIVA_POR_DOSIS) * EFICIENCIA_ABSORCION_ACTIVA;
    const pasivo = ingerido > ABSORCION_MAXIMA_ACTIVA_POR_DOSIS
        ? (ingerido - ABSORCION_MAXIMA_ACTIVA_POR_DOSIS) * EFICIENCIA_ABSORCION_PASIVA
        : 0;

    return Math.round((activo + pasivo) * 100) / 100;
};

// ------------------------------------------------------------
// 3. MOTOR PRINCIPAL — SEMANA VIRTUAL DE CALCIO
// ------------------------------------------------------------
const ejecutarSemanaVirtualCalcio = (alimentos, regimenSuplemento, overridesManual = {}) => {
    // overridesManual: { [foodId]: { [occurrenceIndex]: { dia, comida } } }
    let semanaVirtual = Array(7).fill(null).map(() =>
        Array(3).fill(null).map(() => ({
            alimentos: [],
            totalIngerido: 0,
            totalAbsorbido: 0,
            suplementoAgregado: null
        }))
    );

    // 3.1 Determinar en qué días participa cada alimento, balanceando la carga
    const alimentosConDatos = alimentos
        .map(alimento => {
            const { diasPorSemana, vecesPorDia, porcionesPorComida, calcioPorcion } = alimento;
            if (diasPorSemana === 0 || vecesPorDia === 0 || porcionesPorComida === 0) return null;

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

    // 3.2 Para cada día, repartir dinámicamente las comidas entre los alimentos activos
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

    // 3.3 Aplicar overrides manuales del usuario (drag & drop / tocar-y-tocar)
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
    });

    // 3.4 Distribuir el suplemento de calcio (si aplica), buscando siempre la comida
    //     con menor carga dietética ese día para maximizar la eficiencia de absorción
    if (regimenSuplemento && regimenSuplemento.dosis > 0) {
        const { dosis, vecesPorDia, diasPorSemana } = regimenSuplemento;
        const diasConSuplemento = diasPorSemana >= 7
            ? [0, 1, 2, 3, 4, 5, 6]
            : asignarDiasDeSemana([{ id: 'supl', diasPorSemana, contribucionEstimadaPorDia: dosis }])['supl'] || [];

        diasConSuplemento.forEach(d => {
            const comidasOrdenadas = [0, 1, 2].map(c => ({
                index: c,
                calcioAlimentos: semanaVirtual[d][c].totalIngerido
            })).sort((a, b) => a.calcioAlimentos - b.calcioAlimentos);

            for (let i = 0; i < vecesPorDia && i < 3; i++) {
                const comidaDestino = comidasOrdenadas[i].index;
                semanaVirtual[d][comidaDestino].totalIngerido += dosis;
                semanaVirtual[d][comidaDestino].suplementoAgregado = {
                    dosis: dosis,
                    etiqueta: `${dosis} mg`
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
            const absorbidoComida = calcularAbsorcionCalcio(comida.totalIngerido);
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

        if (cumpleMeta) {
            diasCumplidosCount++;
        } else {
            diasNoCumplidosCount++;
        }

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
// No mide 25-OH-D sérica; es una estimación indirecta de "carga de
// síntesis cutánea semanal" a partir de hábitos declarados de exposición.
const calcularIndiceExposicionSolar = ({ diasPorSemana, minutosPorSesion, horario, usaProtector, edadBracket }) => {
    const factorHorario = FACTOR_HORARIO[horario] ?? FACTOR_HORARIO.no_pico;
    const factorEdad = FACTOR_EDAD_SINTESIS[edadBracket] ?? FACTOR_EDAD_SINTESIS.menor_50;
    const factorProtector = FACTOR_PROTECTOR_SOLAR[usaProtector ? 'si' : 'no'];

    const indice = (diasPorSemana || 0) * (minutosPorSesion || 0) * factorHorario * factorEdad * factorProtector;

    let categoria, colorKey;
    if (indice < UMBRAL_INDICE_SOLAR_BAJO) {
        categoria = 'alto'; // riesgo alto de síntesis insuficiente
        colorKey = 'rose';
    } else if (indice < UMBRAL_INDICE_SOLAR_MODERADO) {
        categoria = 'moderado';
        colorKey = 'amber';
    } else {
        categoria = 'bajo';
        colorKey = 'emerald';
    }

    return {
        indice: Math.round(indice * 10) / 10,
        categoriaRiesgo: categoria, // 'bajo' | 'moderado' | 'alto' (riesgo de síntesis insuficiente)
        colorKey
    };
};

// Interpretación opcional de 25-OH-vitamina D sérica real (ng/mL)
const interpretar25OHVitaminaD = (valorNgMl) => {
    if (valorNgMl === '' || valorNgMl === null || isNaN(valorNgMl)) return null;
    const v = parseFloat(valorNgMl);
    if (v < CORTES_25OH_VITAMINA_D.deficiente) {
        return { categoria: 'deficiente', colorKey: 'rose' };
    }
    if (v < CORTES_25OH_VITAMINA_D.insuficiente) {
        return { categoria: 'insuficiente', colorKey: 'amber' };
    }
    return { categoria: 'suficiente', colorKey: 'emerald' };
};

// ------------------------------------------------------------
// 5. RIESGO ÓSEO COMPUESTO (osteopenia / osteoporosis)
// ------------------------------------------------------------
// IMPORTANTE: esta es una estimación de tamizaje orientativa basada en
// factores de riesgo conocidos, NO un diagnóstico. El diagnóstico real
// requiere densitometría ósea (DXA). Este puntaje está pensado para ser
// calibrado/validado a futuro contra los resultados de DXA del estudio.
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
    if (puntaje <= 2) {
        categoria = 'bajo';
        colorKey = 'emerald';
    } else if (puntaje <= 4) {
        categoria = 'moderado'; // orientativo hacia osteopenia
        colorKey = 'amber';
    } else {
        categoria = 'alto'; // orientativo hacia osteoporosis
        colorKey = 'rose';
    }

    return { puntaje, puntajeMaximo: 8, categoria, colorKey };
};

// ------------------------------------------------------------
// 6. TAMIZAJE DE SARCOPENIA (SARC-F)
// ------------------------------------------------------------
// Puntaje validado (Malmstrom & Morley, 2013). >= 4 = riesgo probable
// de sarcopenia. La proteína y el ejercicio de fuerza se devuelven
// como señales contextuales, sin alterar el punto de corte validado.
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
