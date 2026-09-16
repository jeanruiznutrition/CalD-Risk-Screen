// ============================================================
// CalD Risk Screen — Calcium & Vitamin D Absorption Risk Algorithm
// CARDA v6.0
//
// Motor de cálculo determinista. Cambio central respecto a v1.x:
// el modelo estima CALCIO ABSORBIBLE aplicando (a) la curva de
// saturación de Heaney sobre la carga de cada comida y (b) la
// biodisponibilidad relativa de cada alimento medida con isótopos.
//
// CAMBIOS DE LA v6.0 QUE ALTERAN RESULTADOS NUMÉRICOS
//   1. Las pérdidas urinarias por sodio y cafeína se modelan como EXCESO
//      sobre la ingesta de referencia con la que se derivó la RDA, no
//      como pérdida absoluta. La v3.1 contaba dos veces la misma pérdida.
//   2. El factor de los inhibidores de la bomba de protones depende de
//      si el suplemento se toma en ayuno o con comida.
//   3. El índice UV se estima por geometría solar (latitud, mes, hora)
//      en vez de fijarse a la latitud de Panamá.
//   4. La proteína se pondera por DIAAS de cada fuente (proteína
//      utilizable), no por un factor global de dieta vegetal.
//   5. La circunferencia de pantorrilla se puntúa como SARC-CalF
//      (0/10 puntos, corte ≥11) y se ajusta por IMC.
//   6. El calcio del agua de consumo entra al balance.
//   7. La meta de vitamina D se escala por tamaño corporal.
//   8. Se retiró el segundo modelo solar en unidades arbitrarias, que
//      era código muerto.
//   9. Se corrigió `totalPromedioDia`, campo inexistente que la interfaz
//      y el informe de la v3.1 leían y mostraban como "undefined".
//
// El detalle de cada cambio, con su fuente y su efecto numérico, está en
// CHANGELOG.md; las ecuaciones completas, en METODOS.md.
//
// © Jean Carlos Ruiz Mosley. Todos los derechos reservados.
// ============================================================


// ------------------------------------------------------------
// 0. UTILIDADES DE MARCO DE REFERENCIA
// ------------------------------------------------------------
const obtenerReferenciaCalcio = (edad, sexo, marcoId = 'IOM') => {
    // EPIC-Oxford no es un marco completo de ingestas de referencia sino
    // un umbral único de 525 mg/día derivado de una cohorte. No define
    // valores por edad ni sexo, de modo que cuando se elige como criterio
    // de evaluación se usa el IOM como base de referencia subyacente y el
    // umbral se aplica aparte, sobre la ingesta.
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

// El segundo argumento es el IMC. Nuevo en la v6.0: la vitamina D es
// liposoluble y se distribuye en el compartimento graso, de modo que a
// igual dosis la concentración sérica alcanzada es inversamente
// proporcional a la masa corporal. Es dilución volumétrica, no un defecto
// de absorción (Drincic et al., Obesity 2012). Ekwaru et al. (PLoS One
// 2014) cuantificaron que alcanzar la misma 25(OH)D requiere del orden de
// 1.5 veces la dosis en sobrepeso y 2-3 veces en obesidad.
//
// `rda` se mantiene SIN AJUSTAR para no romper la comparación con la
// cifra de guía, que es lo que un revisor espera ver. El ajuste se
// devuelve aparte, declarado como orientativo, y la interfaz muestra
// ambos. Sin IMC, el factor es 1 y el comportamiento es el de la v3.1.
const obtenerReferenciaVitaminaD = (edad, imc = null) => {
    const e = Number(edad) || 30;
    const rda = e > 70 ? VITD_RDA_MCG_MAYOR70 : VITD_RDA_MCG;

    let factorTamanoCorporal = 1.0;
    let tramoIMCKey = 'vitd_bw_normal';
    if (Number(imc) > 0) {
        const tramo = MULTIPLICADOR_VITD_POR_IMC.find(t => imc >= t.imcMin && imc <= t.imcMax);
        if (tramo) { factorTamanoCorporal = tramo.factor; tramoIMCKey = tramo.key; }
    }

    return {
        ear: VITD_EAR_MCG,
        rda,
        ul: VITD_UL_MCG,
        aiEfsa: VITD_AI_EFSA_MCG,
        factorTamanoCorporal,
        tramoIMCKey,
        // Meta ajustada por tamaño corporal, limitada por el nivel máximo
        // tolerable: un ajuste que llevara la meta por encima del UL no
        // sería una recomendación defendible.
        rdaAjustada: Math.min(VITD_UL_MCG, Math.round(rda * factorTamanoCorporal * 10) / 10),
        ajusteAplicado: factorTamanoCorporal !== 1.0
    };
};

// IMC y su categoría de la OMS. Se centraliza aquí porque hasta la v3.1
// el cálculo vivía escrito en línea dentro del constructor de la fila del
// CSV, donde ninguna prueba lo alcanzaba, y no se usaba en ningún cálculo.
const calcularIMC = (pesoKg, tallaCm) => {
    const p = Number(pesoKg) || 0;
    const t = Number(tallaCm) || 0;
    if (p <= 0 || t <= 0) return { imc: null, categoria: null, categoriaKey: null };
    const imc = p / Math.pow(t / 100, 2);
    const cat = CATEGORIAS_IMC.find(c => imc >= c.min && imc <= c.max) || CATEGORIAS_IMC[1];
    return {
        imc: Math.round(imc * 10) / 10,
        categoria: cat.id,
        categoriaKey: cat.key
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
const ejecutarSemanaVirtualCalcio = (alimentos, suplemento, overridesManual = {}, referencia = null, agua = null) => {
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
    // ROBUSTEZ v6.0: los índices se validan antes de indexar. Un valor
    // fuera de 0-6 / 0-2 —posible al restaurar el estado guardado por
    // otra versión de la herramienta— lanzaba TypeError y dejaba la
    // pantalla en gris sin mensaje. Ahora una reubicación inválida se
    // descarta y el ítem vuelve a su posición automática.
    const indiceValido = (v, max) => Number.isInteger(v) && v >= 0 && v <= max;
    colocaciones.forEach(c => {
        const ovBruto = overridesManual?.[c.id]?.[c.occurrenceIndex];
        const ov = (ovBruto && indiceValido(ovBruto.dia, 6) && indiceValido(ovBruto.comida, 2))
            ? ovBruto
            : null;
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

    // 3.3b AGUA DE CONSUMO (nuevo en la v6.0)
    // Fuente que los cuestionarios de frecuencia ignoran por sistema. Un
    // agua dura aporta 100-300 mg/día, del mismo orden que una porción de
    // lácteo, y con absorción fraccional comparable a la de la leche
    // (Couzy et al. 1995; Heaney & Dowell 1994). Se reparte de forma
    // uniforme entre las tres comidas de los siete días, porque el agua se
    // bebe a lo largo del día y no en una toma. Entra a la carga de la
    // comida, de modo que también desplaza hacia abajo la absorción
    // fraccional del resto de los alimentos: el efecto de saturación es
    // real y el modelo lo captura.
    let mgAguaPorComida = 0;
    if (agua && Number(agua.litrosPorDia) > 0 && Number(agua.mgPorLitro) > 0) {
        const mgDia = Number(agua.litrosPorDia) * Number(agua.mgPorLitro);
        mgAguaPorComida = mgDia / 3;
        for (let d = 0; d < 7; d++) {
            for (let cm = 0; cm < 3; cm++) {
                semanaVirtual[d][cm].alimentos.push({
                    id: 'agua_consumo',
                    nombreKey: 'food_drinking_water',
                    nombreLibre: null,
                    faAlimento: FA_AGUA,
                    cargaReferencia: CARGA_REFERENCIA_AGUA_MG,
                    porciones: 1,
                    calcioIngerido: mgAguaPorComida,
                    occurrenceIndex: d * 3 + cm,
                    esManual: false,
                    esAgua: true,
                    diaAuto: d,
                    comidaAuto: cm
                });
                semanaVirtual[d][cm].totalIngerido += mgAguaPorComida;
            }
        }
    }

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
        aguaMgPorDia: Math.round(mgAguaPorComida * 3 * 10) / 10,
        alertaFraccionamiento,
        // Bandera EPIC-Oxford: umbral protector de 525 mg/día de ingesta
        bajoUmbralEpicOxford: promedioIngerido < UMBRAL_PROTECTOR_EPIC_OXFORD_MG,
        // Comparación con la RDA de ingesta del marco elegido
        porcentajeRdaIngesta: Math.round((promedioIngerido / ref.rda) * 1000) / 10
    };
};


// ------------------------------------------------------------
// 4. GEOMETRÍA SOLAR E ÍNDICE UV DE CIELO CLARO
// ------------------------------------------------------------
// RETIRADO EN LA v6.0: aquí vivía `calcularIndiceExposicionSolar`, un
// segundo modelo solar en unidades arbitrarias. Era código muerto —la
// interfaz ya usaba el modelo estandarizado SED/MED/UI de la sección 12—
// pero el README lo documentaba como si calculara, de modo que un revisor
// no podía saber qué ruta produjo el resultado. Ahora hay una sola ruta,
// y lo que ocupa su lugar es la pieza que faltaba: estimar el índice UV a
// partir de la geometría solar en vez de fijarlo a la latitud de Panamá.
//
// La v3.1 usaba INDICE_UV_TIPICO = { pico: 10, no_pico: 3 }, razonable
// para Panamá (9°N) y equivocado en cualquier otro sitio. Con esos
// valores, un participante en Helsinki en diciembre recibía la misma
// estimación de síntesis cutánea que uno en Ciudad de Panamá en marzo,
// cuando la diferencia real es de más de un orden de magnitud.

const GRADOS_A_RADIANES = Math.PI / 180;

// Declinación solar por la ecuación de Cooper (1969).
//     δ = 23.45° × sin(360° × (284 + N) / 365)
const calcularDeclinacionSolar = (diaDelAno) => {
    const n = Number(diaDelAno) || 1;
    return DECLINACION_MAXIMA_GRADOS * Math.sin(360 * (284 + n) / 365 * GRADOS_A_RADIANES);
};

// Coseno del ángulo cenital solar.
//     μ = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(h)
// Devuelve 0 cuando el sol está bajo el horizonte.
const calcularCosenoCenitalSolar = (latitudGrados, diaDelAno, horasDesdeMediodiaSolar) => {
    const lat = Number(latitudGrados) || 0;
    const delta = calcularDeclinacionSolar(diaDelAno);
    const h = 15 * (Number(horasDesdeMediodiaSolar) || 0);
    const mu = Math.sin(lat * GRADOS_A_RADIANES) * Math.sin(delta * GRADOS_A_RADIANES) +
               Math.cos(lat * GRADOS_A_RADIANES) * Math.cos(delta * GRADOS_A_RADIANES) *
               Math.cos(h * GRADOS_A_RADIANES);
    return Math.max(0, mu);
};

// Índice UV de cielo claro.
//     UVI ≈ UVI_COEF × μ^UVI_EXP_MU × (ozono/300)^UVI_EXP_OZONO × f_altitud
// Es una COTA SUPERIOR: asume cielo despejado, nivel del mar y ausencia
// de aerosoles. Nubosidad, contaminación y sombra la reducen, por lo que
// la herramienta sobrestimaría la síntesis si el participante declara
// exposición en un día nublado. Por eso se conserva el campo de anulación
// manual con el índice UV observado, que siempre tiene prioridad.
const estimarIndiceUVCieloClaro = ({ latitud, mes, horasDesdeMediodiaSolar, ozonoDU, altitudMetros }) => {
    const mesIdx = Math.min(11, Math.max(0, (Number(mes) || 1) - 1));
    const diaDelAno = DIA_REPRESENTATIVO_POR_MES[mesIdx];
    const mu = calcularCosenoCenitalSolar(latitud, diaDelAno, horasDesdeMediodiaSolar);
    if (mu <= 0) return 0;

    const ozono = Number(ozonoDU) > 0 ? Number(ozonoDU) : OZONO_REFERENCIA_DU;
    const factorOzono = Math.pow(ozono / OZONO_REFERENCIA_DU, UVI_EXP_OZONO);
    const factorAltitud = 1 + FACTOR_UV_POR_KM_ALTITUD * ((Number(altitudMetros) || 0) / 1000);

    const uvi = UVI_COEF * Math.pow(mu, UVI_EXP_MU) * factorOzono * factorAltitud;
    return Math.round(uvi * 100) / 100;
};

// Resuelve el índice UV a usar, por orden de fiabilidad del dato:
//   1. el valor observado que declara el evaluador,
//   2. el modelo de cielo claro si hay latitud y mes,
//   3. el valor típico de Panamá como última reserva.
// Se devuelve también la PROCEDENCIA, porque un resultado calculado con
// el valor de reserva no es comparable con uno medido y el informe tiene
// que poder decirlo.
const resolverIndiceUV = ({ indiceUVPersonalizado, latitud, mes, horario, ozonoDU, altitudMetros }) => {
    if (Number(indiceUVPersonalizado) > 0) {
        return { indiceUV: Number(indiceUVPersonalizado), procedencia: 'observado' };
    }
    if (latitud !== undefined && latitud !== null && latitud !== '' && Number(mes) > 0) {
        const desplazamiento = DESPLAZAMIENTO_HORARIO_SOLAR[horario] ?? DESPLAZAMIENTO_HORARIO_SOLAR.no_pico;
        const uvi = estimarIndiceUVCieloClaro({
            latitud, mes, horasDesdeMediodiaSolar: desplazamiento, ozonoDU, altitudMetros
        });
        return { indiceUV: uvi, procedencia: 'modelo_cielo_claro' };
    }
    return {
        indiceUV: INDICE_UV_TIPICO[horario] ?? INDICE_UV_TIPICO.no_pico,
        procedencia: 'valor_tipico_panama'
    };
};


// ------------------------------------------------------------
// 5. ADECUACIÓN DE VITAMINA D (dieta + suplemento)
// ------------------------------------------------------------
// Aplica la potencia relativa D2 vs D3: la D2 rinde aproximadamente
// 60% de la D3 para elevar la 25(OH)D sérica (Tripkovic et al. 2012).
const calcularAdecuacionVitaminaD = (alimentos, suplementoVitD, edad, imc = null) => {
    const ref = obtenerReferenciaVitaminaD(edad, imc);

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
        totalUI: Math.round(totalEq * UI_POR_MCG_VITAMINA_D),
        meta: ref.rda,
        metaUI: ref.rda * UI_POR_MCG_VITAMINA_D,
        // Meta escalada por tamaño corporal (dilución volumétrica en el
        // compartimento graso). Se reporta junto a la sin ajustar, nunca
        // en su lugar: el ajuste es orientativo y derivado de estudios
        // observacionales, no un valor de guía.
        metaAjustada: ref.rdaAjustada,
        metaAjustadaUI: Math.round(ref.rdaAjustada * UI_POR_MCG_VITAMINA_D),
        factorTamanoCorporal: ref.factorTamanoCorporal,
        tramoIMCKey: ref.tramoIMCKey,
        ajusteTamanoAplicado: ref.ajusteAplicado,
        cubreMetaAjustada: totalEq >= ref.rdaAjustada,
        ear: ref.ear,
        ul: ref.ul,
        categoria,
        colorKey,
        // ALIAS DE COMPATIBILIDAD. Hasta la v3.1 la interfaz y el informe
        // leían `totalPromedioDia`, un campo que esta función NUNCA
        // devolvió: en pantalla se mostraba literalmente "undefined /15mcg"
        // y el CSV del informe individual exportaba la cadena "undefined".
        // El nombre correcto es `totalEq` (equivalente de potencia D3). Se
        // mantiene el alias para que ninguna versión anterior del informe
        // quede rota, y la interfaz de la v6.0 ya usa `totalEq`.
        totalPromedioDia: Math.round(totalEq * 10) / 10,
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
// AÑADIDO EN LA v6.0 — PROTEÍNA UTILIZABLE POR DIAAS.
//
// La v3.1 corregía la menor calidad de la proteína vegetal con un factor
// global de 1.1 sobre el objetivo. Es una aproximación gruesa, porque la
// variación de calidad ENTRE fuentes vegetales es mayor que la que hay
// entre vegetal y animal: el gluten de trigo (DIAAS 0.25) y la proteína
// de soja (0.90) no se parecen en nada, y el factor único los trata
// igual. Ahora se pondera cada porción por el DIAAS de su fuente:
//
//     proteina_utilizable = Σ (gramos_alimento × DIAAS_alimento)
//
// IMPORTANTE, PARA NO CONTAR DOS VECES LA MISMA CORRECCIÓN: la proteína
// utilizable se compara contra el objetivo SIN el factor de dieta
// vegetal, porque el DIAAS ya hace ese trabajo. La proteína bruta se
// sigue comparando contra el objetivo ajustado, que es el comportamiento
// de la v3.1, y ambas rutas se reportan juntas. Son dos maneras de
// corregir lo mismo; aplicarlas en cadena sería un error.
const calcularProteinaDesdeCuestionario = (alimentos, { pesoKg, edad, esDietaVegetal }) => {
    let gramosSemana = 0;
    let gramosUtilizablesSemana = 0;
    let leucinaSemana = 0;
    // Mayor aporte de proteína en una sola comida, para el umbral de leucina
    let mejorComidaProteina = 0;
    let mejorComidaLeucina = 0;

    (alimentos || []).forEach(a => {
        if (!a.diasPorSemana || !a.proteinaPorcion || !a.porcionesPorComida) return;
        const porComida = a.proteinaPorcion * a.porcionesPorComida;
        const total = porComida * (a.vecesPorDia || 1) * a.diasPorSemana;
        const diaas = (DIAAS_POR_ALIMENTO[a.id] && DIAAS_POR_ALIMENTO[a.id].valor) || DIAAS_POR_DEFECTO;
        const leucinaPorG = LEUCINA_POR_G_PROTEINA[a.id] || LEUCINA_POR_G_PROTEINA_DEFECTO;

        gramosSemana += total;
        gramosUtilizablesSemana += total * diaas;
        leucinaSemana += total * leucinaPorG;

        if (porComida > mejorComidaProteina) {
            mejorComidaProteina = porComida;
            mejorComidaLeucina = porComida * leucinaPorG;
        }
    });

    const gramosDia = gramosSemana / 7;
    const gramosUtilizablesDia = gramosUtilizablesSemana / 7;
    const objetivo = obtenerObjetivoProteina(edad, esDietaVegetal);
    // Objetivo sin ajustar por patrón dietético: es el referente correcto
    // para la proteína ya corregida por DIAAS.
    const objetivoBase = obtenerObjetivoProteina(edad, false);
    const peso = Number(pesoKg) || 0;

    // Umbral anabólico de leucina por comida en el adulto mayor
    // (PROT-AGE 2013; ESPEN 2014). Un participante puede alcanzar su meta
    // diaria repartida en porciones pequeñas y no cruzar el umbral en
    // ninguna comida, que es un hallazgo distinto de "come poca proteína".
    const aplicaUmbralLeucina = (Number(edad) || 30) >= EDAD_CORTE_UMBRAL_LEUCINA;
    const cumpleUmbralLeucina = mejorComidaLeucina >= LEUCINA_UMBRAL_POR_COMIDA_G;

    const comunes = {
        gramosDia: Math.round(gramosDia * 10) / 10,
        gramosUtilizablesDia: Math.round(gramosUtilizablesDia * 10) / 10,
        leucinaDia: Math.round((leucinaSemana / 7) * 10) / 10,
        mejorComidaProteinaG: Math.round(mejorComidaProteina * 10) / 10,
        mejorComidaLeucinaG: Math.round(mejorComidaLeucina * 100) / 100,
        umbralLeucinaAplica: aplicaUmbralLeucina,
        cumpleUmbralLeucina,
        alertaLeucina: aplicaUmbralLeucina && !cumpleUmbralLeucina,
        objetivo,
        objetivoBase
    };

    if (peso <= 0) {
        return { ...comunes, sinPeso: true };
    }

    const gPorKg = gramosDia / peso;
    const gPorKgUtilizable = gramosUtilizablesDia / peso;
    const objetivoGramos = Math.round(objetivo * peso);

    const clasificar = (valor, meta) => {
        if (valor >= meta) return { categoria: 'adecuada', colorKey: 'emerald' };
        if (valor >= meta * 0.8) return { categoria: 'limitrofe', colorKey: 'amber' };
        return { categoria: 'baja', colorKey: 'rose' };
    };
    const bruta = clasificar(gPorKg, objetivo);
    const utilizable = clasificar(gPorKgUtilizable, objetivoBase);

    return {
        ...comunes,
        gPorKg: Math.round(gPorKg * 100) / 100,
        gPorKgUtilizable: Math.round(gPorKgUtilizable * 100) / 100,
        objetivoGramos,
        objetivoGramosUtilizable: Math.round(objetivoBase * peso),
        categoria: bruta.categoria,
        colorKey: bruta.colorKey,
        categoriaUtilizable: utilizable.categoria,
        colorKeyUtilizable: utilizable.colorKey,
        sinPeso: false,
        razonAdecuacion: Math.round((gPorKg / objetivo) * 1000) / 10,
        razonAdecuacionUtilizable: Math.round((gPorKgUtilizable / objetivoBase) * 1000) / 10,
        // Calidad proteica media de la dieta declarada. Es la cifra que
        // explica la diferencia entre las dos rutas y la que distingue una
        // dieta vegetal bien construida de una basada en cereales.
        diaasMedio: gramosDia > 0 ? Math.round((gramosUtilizablesDia / gramosDia) * 100) / 100 : null
    };
};


// ------------------------------------------------------------
// 5c. PLAUSIBILIDAD DEL CUESTIONARIO
// ------------------------------------------------------------
// El catálogo es corto a propósito, lo que es defendible, pero implica
// que la proteína estimada queda por debajo de la real. Sin verificación,
// una entrevista en la que el participante se cansó y respondió 0 a la
// mitad del cuestionario entra al análisis con el mismo peso que una
// completa. Se aplica la lógica de los puntos de corte de Goldberg
// (Goldberg et al., Eur J Clin Nutr 1991) instrumentada sobre la
// proteína, que es lo que el cuestionario estima.
//
// NO descarta al participante: lo MARCA. La decisión de excluir es del
// investigador y queda documentada en el análisis.
const evaluarPlausibilidadCuestionario = (alimentos, resultadoProteina) => {
    const declarados = (alimentos || []).filter(a => Number(a.diasPorSemana) > 0).length;
    const razon = resultadoProteina && !resultadoProteina.sinPeso
        ? resultadoProteina.razonAdecuacion / 100
        : null;

    const banderas = [];
    if (declarados < PLAUSIBILIDAD_MINIMO_ALIMENTOS_DECLARADOS) banderas.push('cuestionario_incompleto');
    if (razon !== null && razon < PLAUSIBILIDAD_PROTEINA_FRACCION_MINIMA) banderas.push('subregistro_probable');
    if (razon !== null && razon > PLAUSIBILIDAD_PROTEINA_FRACCION_MAXIMA) banderas.push('sobredeclaracion_probable');

    return {
        alimentosDeclarados: declarados,
        razonProteina: razon !== null ? Math.round(razon * 1000) / 10 : null,
        banderas,
        plausible: banderas.length === 0,
        // Grado heurístico declarado: los cortes son de cribado y no
        // provienen de una validación externa.
        grado: 'heuristico'
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
    const { proteinaAdecuada, diasEjercicioFuerza, circunferenciaPantorrilla, sexo, imc } = opciones;
    const respondidas = Object.values(respuestasSarcF || {}).filter(v => v !== '' && v !== null && v !== undefined);
    const puntajeTotal = respondidas.reduce((acc, v) => acc + (Number(v) || 0), 0);
    const completo = respondidas.length === PREGUNTAS_SARC_F.length;

    const riesgoEspecifico = puntajeTotal >= UMBRAL_SARC_F_ESPECIFICO;
    const riesgoSensible = puntajeTotal >= UMBRAL_SARC_F_SENSIBLE;

    // ------------------------------------------------------------
    // SARC-CalF CON SU PUNTUACIÓN VALIDADA (corregido en la v6.0)
    // ------------------------------------------------------------
    // La v3.1 usaba la circunferencia de pantorrilla como una bandera
    // paralela que degradaba la categoría. El instrumento validado
    // funciona de otro modo (Barbosa-Silva et al., J Am Med Dir Assoc
    // 2016): la circunferencia entra como SEXTO ÍTEM puntuado 0 o 10, y
    // el corte del total pasa de ≥4 a ≥11. Con esa formulación la
    // sensibilidad sube de forma sustancial respecto al SARC-F solo, que
    // es exactamente la limitación que la herramienta ya documentaba.
    //
    // AJUSTE POR ADIPOSIDAD: los cortes fijos de 33/34 cm tienen un sesgo
    // conocido, porque en obesidad la pantorrilla es gruesa aunque la masa
    // muscular sea baja, y en delgadez ocurre lo inverso. González et al.
    // (J Cachexia Sarcopenia Muscle 2021) propusieron corregir la medida
    // en función del IMC antes de aplicar el corte. Sin IMC declarado se
    // aplica el corte sin ajustar y se señala.
    let pantorrillaBaja = null;
    let pantorrillaAjustadaCm = null;
    let ajusteIMCAplicado = 0;
    const corte = CORTE_PANTORRILLA_CM[sexo] ?? CORTE_PANTORRILLA_CM.femenino;

    if (circunferenciaPantorrilla && Number(circunferenciaPantorrilla) > 0) {
        const medida = Number(circunferenciaPantorrilla);
        if (Number(imc) > 0) {
            const tramo = AJUSTE_PANTORRILLA_POR_IMC.find(t => imc >= t.imcMin && imc <= t.imcMax);
            ajusteIMCAplicado = tramo ? tramo.ajusteCm : 0;
        }
        pantorrillaAjustadaCm = Math.round((medida + ajusteIMCAplicado) * 10) / 10;
        pantorrillaBaja = pantorrillaAjustadaCm < corte;
    }

    const puntajeSarcCalF = pantorrillaBaja === null
        ? null
        : puntajeTotal + (pantorrillaBaja ? SARC_CALF_PUNTOS_PANTORRILLA_BAJA : 0);
    const riesgoSarcCalF = puntajeSarcCalF !== null && puntajeSarcCalF >= UMBRAL_SARC_CALF;

    let categoria, colorKey;
    if (riesgoEspecifico || riesgoSarcCalF) { categoria = 'riesgo'; colorKey = 'rose'; }
    else if (riesgoSensible || pantorrillaBaja) { categoria = 'alerta'; colorKey = 'amber'; }
    else { categoria = 'bajo'; colorKey = 'emerald'; }

    return {
        puntajeTotal,
        puntajeMaximo: 10,
        completo,
        riesgoProbable: riesgoEspecifico,
        superaCorteSensible: riesgoSensible,
        pantorrillaBaja,
        // SARC-CalF
        puntajeSarcCalF,
        puntajeMaximoSarcCalF: 20,
        riesgoSarcCalF,
        umbralSarcCalF: UMBRAL_SARC_CALF,
        pantorrillaMedidaCm: circunferenciaPantorrilla ? Number(circunferenciaPantorrilla) : null,
        pantorrillaAjustadaCm,
        ajusteIMCAplicado,
        corteAplicadoCm: corte,
        ajustePorIMCDisponible: Number(imc) > 0,
        categoria,
        colorKey,
        senales: {
            proteinaInadecuada: proteinaAdecuada === false,
            ejercicioFuerzaInsuficiente: (diasEjercicioFuerza ?? 0) < UMBRAL_EJERCICIO_FUERZA_SEMANAL
        }
    };
};


// ------------------------------------------------------------
// 8b. ÍNDICES VALIDADOS DE CRIBADO DE DENSIDAD MINERAL ÓSEA BAJA
// ------------------------------------------------------------
// El puntaje óseo compuesto de la herramienta es una construcción propia
// pendiente de calibrar con DXA. Estos dos índices están publicados, son
// de dominio público y se calculan sin licencia —a diferencia de FRAX,
// cuya exclusión sigue siendo la decisión correcta—, de modo que el
// estudio tiene un comparador externo desde el primer participante.

// OST / OSTA (Koh et al., Osteoporos Int 2001):
//     OST = 0.2 × (peso_kg − edad_años), truncado a entero
const calcularOST = ({ pesoKg, edad }) => {
    const p = Number(pesoKg) || 0;
    const e = Number(edad) || 0;
    if (p <= 0 || e <= 0) return { aplicable: false, motivoKey: 'ost_needs_weight_age' };

    const indice = Math.trunc(OST_COEFICIENTE * (p - e));
    let categoria, colorKey;
    if (indice > OST_CORTE_BAJO) { categoria = 'bajo'; colorKey = 'emerald'; }
    else if (indice >= OST_CORTE_ALTO) { categoria = 'intermedio'; colorKey = 'amber'; }
    else { categoria = 'alto'; colorKey = 'rose'; }

    return {
        aplicable: true,
        indice,
        categoria,
        colorKey,
        // El desempeño publicado del OST es mejor en mujeres
        // posmenopáusicas que en varones. Se declara en vez de callarlo.
        poblacionDeDerivacionKey: 'ost_derivation_note'
    };
};

// ORAI (Cadarette et al., CMAJ 2000). Derivado y validado en MUJERES de
// 45 años o más. No se calcula fuera de esa población: aplicar un índice
// fuera de su cohorte de derivación y reportar el número como si valiera
// es peor que no calcularlo.
const calcularORAI = ({ edad, pesoKg, sexo, usaEstrogenos }) => {
    const e = Number(edad) || 0;
    const p = Number(pesoKg) || 0;

    if (sexo !== 'femenino') return { aplicable: false, motivoKey: 'orai_women_only' };
    if (e < ORAI_EDAD_MINIMA_APLICABLE) return { aplicable: false, motivoKey: 'orai_age_min' };
    if (p <= 0) return { aplicable: false, motivoKey: 'orai_needs_weight' };

    const puntosEdad = (ORAI_PUNTOS_EDAD.find(t => e >= t.min && e <= t.max) || { puntos: 0 }).puntos;
    const puntosPeso = (ORAI_PUNTOS_PESO.find(t => p >= t.min && p <= t.max) || { puntos: 0 }).puntos;
    const puntosEstrogenos = usaEstrogenos ? 0 : ORAI_PUNTOS_SIN_ESTROGENOS;
    const puntaje = puntosEdad + puntosPeso + puntosEstrogenos;

    return {
        aplicable: true,
        puntaje,
        puntajeMaximo: 26,
        corte: ORAI_CORTE,
        superaCorte: puntaje >= ORAI_CORTE,
        categoria: puntaje >= ORAI_CORTE ? 'riesgo' : 'bajo',
        colorKey: puntaje >= ORAI_CORTE ? 'amber' : 'emerald',
        desglose: { edad: puntosEdad, peso: puntosPeso, sinEstrogenos: puntosEstrogenos },
        // Sensibilidad 93.3% y especificidad 46.4% en la cohorte de
        // derivación: sirve para DESCARTAR, no para confirmar.
        desempenoKey: 'orai_performance_note'
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

const calcularExposicionSolarEstandar = ({ diasPorSemana, minutosPorSesion, horario, edad, fototipo, superficieCorporal, indiceUVPersonalizado, latitud, mes, ozonoDU, altitudMetros, usaProtectorSolar, fpsDeclarado }) => {
    const dias = Number(diasPorSemana) || 0;
    const minutos = Number(minutosPorSesion) || 0;
    const ft = FOTOTIPO_VALIDO(fototipo);

    // El índice UV equivale aproximadamente a los SED recibidos en una
    // hora de exposición a esa intensidad. Su procedencia (observado,
    // modelo de cielo claro o valor típico de reserva) se propaga al
    // resultado, porque condiciona cuánto vale la estimación.
    const { indiceUV, procedencia: procedenciaIndiceUV } = resolverIndiceUV({
        indiceUVPersonalizado, latitud, mes, horario, ozonoDU, altitudMetros
    });

    // PROTECTOR SOLAR. La v3.1 no lo preguntaba, con el argumento de que
    // el protector bloquea la síntesis y por tanto la exposición con
    // protector no cuenta. Es cierto en condiciones de laboratorio y
    // falso en la práctica: la cantidad que la gente se aplica es del
    // orden de 0.5-1.0 mg/cm² frente a los 2 mg/cm² con que se determina
    // el FPS de la etiqueta, de modo que la protección real es una
    // fracción de la nominal. Tratarla como bloqueo total subestima la
    // síntesis; ignorarla la sobrestima. Se modela la transmisión como la
    // raíz del FPS nominal, que es la aproximación al uso para la
    // aplicación incompleta.
    const fps = Number(fpsDeclarado) > 1 ? Number(fpsDeclarado) : 30;
    const transmisionProtector = usaProtectorSolar ? 1 / Math.sqrt(fps) : 1;

    const sedPorSesion = indiceUV * (minutos / 60) * transmisionProtector;
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
        // El protector reduce los SED que llegan a la piel, así que
        // alarga proporcionalmente el tiempo necesario.
        minutosPara1000UI = (sedNecesarios / (indiceUV * transmisionProtector)) * 60;
    }

    // Advertencia de seguridad: exposiciones por encima de 1 MED
    // producen eritema sin aportar vitamina D adicional, porque la
    // síntesis cutánea se autolimita por fotodegradación.
    const riesgoQuemadura = fraccionMEDPorSesion >= 1.0;
    const sobreexposicionSinBeneficio = fraccionMEDPorSesion > 0.5;

    // CATEGORIZACIÓN DENTRO DEL MOTOR (v6.0). Antes vivía escrita en línea
    // dentro de app.js, donde la suite de pruebas no podía alcanzarla.
    // El criterio es el equivalente en UI por día frente a la ingesta de
    // referencia, que es una comparación con significado, a diferencia de
    // los umbrales en unidades arbitrarias que se retiraron.
    // Los dos cortes son de CRIBADO y están declarados como heurísticos
    // en el registro de parámetros: deben calibrarse contra la 25(OH)D
    // sérica del estudio.
    const metaUIDia = obtenerReferenciaVitaminaD(edad).rda * UI_POR_MCG_VITAMINA_D;
    let categoriaRiesgo, colorKey;
    if (uiPromedioDia >= metaUIDia * UMBRAL_SOLAR_SUFICIENTE_FRACCION_RDA) { categoriaRiesgo = 'bajo'; colorKey = 'emerald'; }
    else if (uiPromedioDia >= metaUIDia * UMBRAL_SOLAR_MODERADO_FRACCION_RDA) { categoriaRiesgo = 'moderado'; colorKey = 'amber'; }
    else { categoriaRiesgo = 'alto'; colorKey = 'rose'; }

    return {
        categoriaRiesgo,
        colorKey,
        metaUIDia: Math.round(metaUIDia),
        procedenciaIndiceUV,
        usaProtectorSolar: !!usaProtectorSolar,
        transmisionProtector: Math.round(transmisionProtector * 1000) / 1000,
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
// CORRECCIÓN v6.0 — EL FACTOR DEPENDE DE CUÁNDO SE TOMA EL SUPLEMENTO.
//
// El factor único de la v3.1 (0.55) proviene de estudios en AYUNO:
// O'Connell et al. (Am J Med 2005) midieron que el omeprazol reducía la
// absorción fraccional del carbonato del 9.1% al 3.5% tomado en ayuno.
// El mismo carbonato tomado CON alimentos se disuelve con el ácido que la
// propia comida estimula, y la penalización casi desaparece. Aplicar el
// factor de ayuno a todos sobrestima el problema en la mayoría de los
// usuarios, que lo toman con la comida porque es lo que indica la
// etiqueta. Ahora se pregunta el momento de la toma.
const calcularFactorIBP = (usaIBP, tipoSuplemento, momentoToma = 'con_comida') => {
    if (!usaIBP) return { alimentos: 1.0, suplemento: 1.0, momentoToma };
    const enAyuno = momentoToma === 'ayuno';
    return {
        alimentos: FACTOR_IBP_SOBRE_ALIMENTOS,
        suplemento: tipoSuplemento === 'citrato'
            ? FACTOR_IBP_SOBRE_CITRATO
            : (enAyuno ? FACTOR_IBP_CARBONATO_AYUNO : FACTOR_IBP_CARBONATO_CON_COMIDA),
        momentoToma
    };
};

// CORRECCIÓN v6.0 — MODELO DE EXCESO, NO DE PÉRDIDA ABSOLUTA.
//
// Hasta la v3.1 se restaba la pérdida urinaria COMPLETA atribuible al
// sodio y a la cafeína, y el resultado se comparaba contra una meta
// derivada de la RDA del IOM. Eso cuenta dos veces la misma pérdida: las
// RDA de calcio se derivaron de estudios de balance en poblaciones con
// ingestas habituales de sodio y cafeína, de modo que la excreción
// urinaria típica ya está dentro de los 1000-1200 mg. Un participante que
// consumía exactamente la ingesta de referencia salía penalizado por
// 30 mg/día que nunca perdió.
//
// Ahora se modela la DESVIACIÓN respecto a la ingesta de referencia. El
// signo se conserva a propósito: quien consume menos sodio que la
// referencia recibe un crédito, no un castigo, porque su excreción es
// genuinamente menor que la del balance con que se fijó la RDA.
const calcularPerdidasCalcio = ({ nivelSodio, tazasCafeDia }) => {
    const nivel = NIVELES_SODIO.find(n => n.id === nivelSodio);
    const gramosSodio = nivel ? nivel.gramosDia : SODIO_REFERENCIA_G_DIA;
    const tazas = Number(tazasCafeDia) || 0;

    const excesoSodio = gramosSodio - SODIO_REFERENCIA_G_DIA;
    const excesoCafe = tazas - CAFE_REFERENCIA_TAZAS_DIA;

    const perdidaSodio = excesoSodio * CALCIO_PERDIDO_POR_GRAMO_SODIO;
    const perdidaCafeina = excesoCafe * CALCIO_PERDIDO_POR_TAZA_CAFE;

    return {
        perdidaSodio: Math.round(perdidaSodio * 10) / 10,
        perdidaCafeina: Math.round(perdidaCafeina * 10) / 10,
        perdidaTotal: Math.round((perdidaSodio + perdidaCafeina) * 10) / 10,
        gramosSodio,
        tazasCafe: tazas,
        // Se exponen las referencias para que el informe pueda explicar
        // por qué un valor sale en cero o en negativo.
        sodioReferencia: SODIO_REFERENCIA_G_DIA,
        cafeReferencia: CAFE_REFERENCIA_TAZAS_DIA,
        esCredito: (perdidaSodio + perdidaCafeina) < 0
    };
};

// Aplica inhibidores y pérdidas al resultado bruto del motor de calcio,
// devolviendo el balance NETO estimado.
const aplicarModificadoresCalcio = (resultadosCalcio, { usaIBP, tipoSuplemento, nivelSodio, tazasCafeDia, momentoToma }) => {
    const factores = calcularFactorIBP(usaIBP, tipoSuplemento, momentoToma || 'con_comida');
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




// ------------------------------------------------------------
// 14. ENTRADA TOTAL ESTIMADA DE VITAMINA D
// ------------------------------------------------------------
// Hasta la v3.1 la vitamina D dietética y la síntesis cutánea se
// evaluaban por separado y nunca se sumaban. Para el participante eso es
// confuso: puede tener "vitamina D dietética baja" y "exposición solar
// buena" y no saber si en conjunto está cubierto.
//
// ADVERTENCIA METODOLÓGICA QUE ESTA FUNCIÓN DEBE LLEVAR SIEMPRE: las RDA
// de vitamina D del IOM se derivaron bajo el supuesto explícito de
// EXPOSICIÓN SOLAR MÍNIMA. Comparar directamente la suma de ingesta más
// síntesis cutánea contra la RDA no es una comparación legítima: la RDA
// no está definida para ese total. Por eso el resultado se reporta como
// ENTRADA TOTAL ESTIMADA, con la RDA solo como escala de referencia y con
// la advertencia visible, en vez de emitir una categoría de adecuación
// que no se sostendría ante un revisor.
//
// Las dos vías tampoco tienen la misma incertidumbre: la ingesta se
// estima de un cuestionario y la síntesis cutánea de un modelo
// fotobiológico con varios supuestos encadenados. Se devuelven separadas
// y con su peso relativo para que eso sea visible.
const calcularEntradaTotalVitaminaD = (resultadoVitDDieta, resultadoSolar) => {
    if (!resultadoVitDDieta) return null;

    const uiDieta = Math.round((resultadoVitDDieta.dietaEq || 0) * UI_POR_MCG_VITAMINA_D);
    const uiSuplemento = Math.round((resultadoVitDDieta.suplEq || 0) * UI_POR_MCG_VITAMINA_D);
    const uiCutanea = Math.round((resultadoSolar && resultadoSolar.uiPromedioDia) || 0);
    const uiTotal = uiDieta + uiSuplemento + uiCutanea;

    const metaUI = resultadoVitDDieta.metaUI || 0;
    const metaAjustadaUI = resultadoVitDDieta.metaAjustadaUI || metaUI;

    return {
        uiDieta,
        uiSuplemento,
        uiCutanea,
        uiTotal,
        mcgTotal: Math.round((uiTotal / UI_POR_MCG_VITAMINA_D) * 10) / 10,
        metaUI,
        metaAjustadaUI,
        // Escala de referencia, NO una categoría de adecuación.
        fraccionDeLaReferencia: metaUI > 0 ? Math.round((uiTotal / metaUI) * 1000) / 10 : null,
        fraccionDeLaReferenciaAjustada: metaAjustadaUI > 0 ? Math.round((uiTotal / metaAjustadaUI) * 1000) / 10 : null,
        // Peso de cada vía. Un total dominado por la vía cutánea arrastra
        // toda la incertidumbre del modelo fotobiológico.
        proporcionCutanea: uiTotal > 0 ? Math.round((uiCutanea / uiTotal) * 1000) / 10 : 0,
        proporcionIngesta: uiTotal > 0 ? Math.round(((uiDieta + uiSuplemento) / uiTotal) * 1000) / 10 : 0,
        // La suma NO se compara con la RDA como criterio de adecuación.
        advertenciaKey: 'vitd_total_input_warning',
        procedenciaIndiceUV: (resultadoSolar && resultadoSolar.procedenciaIndiceUV) || null,
        // El nivel máximo tolerable se aplica solo a la INGESTA: la
        // síntesis cutánea se autolimita por fotodegradación y no produce
        // intoxicación. Confundirlo llevaría a una alerta falsa.
        excedeULPorIngesta: (uiDieta + uiSuplemento) > (resultadoVitDDieta.ul || 100) * UI_POR_MCG_VITAMINA_D
    };
};


// ------------------------------------------------------------
// 15. RIESGO ÓSEO COMPUESTO, VERSIÓN v6.0
// ------------------------------------------------------------
// Se mantiene el puntaje conductual/dietético de la v3.1 sin cambios en
// sus pesos, para que las filas ya recogidas sigan siendo comparables, y
// se añade un BLOQUE BIOQUÍMICO OPCIONAL que solo puntúa cuando el
// analito está declarado. Un tamizaje de salud ósea que ignora la PTH
// disponible desperdicia el dato más informativo del panel: el ascenso
// de la paratohormona es el mecanismo por el que la insuficiencia de
// vitamina D produce pérdida ósea, y precede a cualquier cambio del
// calcio sérico.
//
// Los dos bloques se reportan por separado, con su máximo alcanzable
// dependiente de cuántos analitos haya: sumarlos en un único número sin
// decir cuántos datos lo sostienen produciría puntajes no comparables
// entre participantes con y sin laboratorio.
const calcularRiesgoOseoV6 = (entradaConductual, bioquimica = null) => {
    const base = calcularRiesgoOseo(entradaConductual);

    const contribucionesBio = [];
    let puntajeBio = 0;
    let analitosDisponibles = 0;
    const addBio = (pts, key) => { if (pts > 0) { puntajeBio += pts; contribucionesBio.push({ key, pts }); } };

    if (bioquimica) {
        // 25(OH)D sérica: dato medido, sustituye en fuerza a cualquier
        // estimación de ingesta o de exposición solar.
        if (bioquimica.vitD && bioquimica.vitD.categoria) {
            analitosDisponibles++;
            const cat = bioquimica.vitD.categoria;
            if (cat === 'deficiencia_severa') addBio(3, 'risk_bio_vitd_severe');
            else if (cat === 'deficiente') addBio(2, 'risk_bio_vitd_deficient');
            else if (cat === 'insuficiente') addBio(1, 'risk_bio_vitd_insufficient');
        }
        // PTH elevada con calcio normal o bajo: patrón de
        // hiperparatiroidismo secundario, que es pérdida ósea en curso.
        if (bioquimica.pth && bioquimica.pth.disponible) {
            analitosDisponibles++;
            if (bioquimica.pth.categoria === 'alta') addBio(2, 'risk_bio_pth_high');
        }
        // Fosfatasa alcalina elevada: recambio óseo aumentado.
        if (bioquimica.fosfatasaAlcalina && bioquimica.fosfatasaAlcalina.disponible) {
            analitosDisponibles++;
            if (bioquimica.fosfatasaAlcalina.categoria === 'alta') addBio(1, 'risk_bio_alp_high');
        }
        // Función renal reducida: la 1α-hidroxilación es renal.
        if (bioquimica.tfge && bioquimica.tfge.disponible) {
            analitosDisponibles++;
            if (bioquimica.tfge.valor < 45) addBio(2, 'risk_bio_egfr_low');
            else if (bioquimica.tfge.valor < 60) addBio(1, 'risk_bio_egfr_mild');
        }
        // Hipercalciuria: causa tratable de pérdida ósea.
        if (bioquimica.calcioUrinario && bioquimica.calcioUrinario.disponible) {
            analitosDisponibles++;
            if (bioquimica.calcioUrinario.hipercalciuria) addBio(1, 'risk_bio_hypercalciuria');
        }
    }

    // Máximo alcanzable del bloque bioquímico según los analitos
    // realmente declarados.
    const maximoPorAnalito = { vitD: 3, pth: 2, fosfatasaAlcalina: 1, tfge: 2, calcioUrinario: 1 };
    let puntajeMaximoBio = 0;
    if (bioquimica) {
        if (bioquimica.vitD && bioquimica.vitD.categoria) puntajeMaximoBio += maximoPorAnalito.vitD;
        if (bioquimica.pth && bioquimica.pth.disponible) puntajeMaximoBio += maximoPorAnalito.pth;
        if (bioquimica.fosfatasaAlcalina && bioquimica.fosfatasaAlcalina.disponible) puntajeMaximoBio += maximoPorAnalito.fosfatasaAlcalina;
        if (bioquimica.tfge && bioquimica.tfge.disponible) puntajeMaximoBio += maximoPorAnalito.tfge;
        if (bioquimica.calcioUrinario && bioquimica.calcioUrinario.disponible) puntajeMaximoBio += maximoPorAnalito.calcioUrinario;
    }

    const puntajeTotal = base.puntaje + puntajeBio;
    const puntajeMaximoTotal = base.puntajeMaximo + puntajeMaximoBio;

    // La categoría se decide sobre la FRACCIÓN del máximo alcanzable, no
    // sobre el puntaje bruto: si no fuera así, un participante con
    // laboratorio completo caería siempre en una categoría peor que otro
    // idéntico sin laboratorio, por el solo hecho de tener más datos.
    const fraccion = puntajeMaximoTotal > 0 ? puntajeTotal / puntajeMaximoTotal : 0;
    let categoria, colorKey;
    if (fraccion <= 0.2) { categoria = 'bajo'; colorKey = 'emerald'; }
    else if (fraccion <= 0.4) { categoria = 'moderado'; colorKey = 'amber'; }
    else { categoria = 'alto'; colorKey = 'rose'; }

    return {
        // Campos de la v3.1, para que la interfaz y el CSV no cambien de forma
        puntaje: puntajeTotal,
        puntajeMaximo: puntajeMaximoTotal,
        categoria,
        colorKey,
        contribuciones: [...base.contribuciones, ...contribucionesBio],
        // Desglose nuevo
        puntajeConductual: base.puntaje,
        puntajeMaximoConductual: base.puntajeMaximo,
        puntajeBioquimico: puntajeBio,
        puntajeMaximoBioquimico: puntajeMaximoBio,
        analitosDisponibles,
        fraccionDelMaximo: Math.round(fraccion * 1000) / 10,
        conBioquimica: analitosDisponibles > 0,
        // Recordatorio permanente: los cortes son heurísticos y están en
        // la lista de calibración pendiente del registro de parámetros.
        grado: 'heuristico'
    };
};
