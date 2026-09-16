// ============================================================
// CalD Risk Screen — Módulo de validación estadística (v6.0)
// ============================================================
//
// POR QUÉ EXISTE ESTE ARCHIVO
//
// El objetivo declarado del estudio es calibrar los umbrales del riesgo
// óseo contra densitometría. Hasta la v3.1 la herramienta no calculaba
// ningún estadístico: el investigador exportaba el CSV y hacía todo
// fuera. Eso significa que la herramienta no podía demostrar su propio
// desempeño, y que el corte óptimo reportado en la publicación no se
// derivaba con ella.
//
// Este módulo cierra ese hueco. Todo corre en el navegador, sin enviar
// datos a ningún servidor —requisito no negociable cuando se manejan
// datos de participantes— y es DETERMINISTA: el remuestreo usa un
// generador con semilla fija, de modo que dos ejecuciones sobre los
// mismos datos dan exactamente el mismo intervalo de confianza. Un
// intervalo que cambia cada vez que se pulsa el botón no es reportable.
//
// QUÉ NO ES
//
// No sustituye a R, SPSS ni Jamovi para el análisis final. Es el
// instrumento que permite (a) ver el desempeño mientras el estudio
// avanza, (b) derivar el corte óptimo con el mismo código que produjo
// las puntuaciones y (c) que un revisor reproduzca esas cifras abriendo
// un archivo. Los contrastes implementados usan aproximaciones
// asintóticas cuyo supuesto se declara en cada función.
//
// Cada estadístico se contrasta en tests/estadistica.js contra un valor
// publicado o una identidad algebraica conocida, no contra su propia
// implementación.
//
// © Jean Carlos Ruiz Mosley. Todos los derechos reservados.
// ============================================================


// ------------------------------------------------------------
// 0. UTILIDADES NUMÉRICAS
// ------------------------------------------------------------
const Z_95 = 1.959963984540054;

const esNumero = (v) => v !== '' && v !== null && v !== undefined && !isNaN(parseFloat(v));
const aNum = (v) => parseFloat(v);

// Empareja dos vectores descartando los pares con dato faltante. Es la
// operación que hay que hacer ANTES de cualquier estadístico pareado, y
// el número de pares descartados se devuelve: un análisis que pierde
// sesenta participantes por datos faltantes no es el mismo análisis.
const emparejarCompletos = (x, y) => {
    const xs = [], ys = [];
    let descartados = 0;
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) {
        if (esNumero(x[i]) && esNumero(y[i])) { xs.push(aNum(x[i])); ys.push(aNum(y[i])); }
        else descartados++;
    }
    return { x: xs, y: ys, n: xs.length, descartados };
};

const suma = (a) => a.reduce((s, v) => s + v, 0);
const media = (a) => (a.length ? suma(a) / a.length : NaN);

// Varianza muestral (denominador n−1)
const varianza = (a) => {
    if (a.length < 2) return NaN;
    const m = media(a);
    return suma(a.map(v => (v - m) * (v - m))) / (a.length - 1);
};
const desvio = (a) => Math.sqrt(varianza(a));

const percentil = (aOrdenado, p) => {
    if (!aOrdenado.length) return NaN;
    if (aOrdenado.length === 1) return aOrdenado[0];
    const idx = (aOrdenado.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return aOrdenado[lo];
    return aOrdenado[lo] + (aOrdenado[hi] - aOrdenado[lo]) * (idx - lo);
};

// Función de distribución normal acumulada. Se implementa a partir de la
// función error con la aproximación de Abramowitz y Stegun (7.1.26),
// cuyo error absoluto es inferior a 1.5×10⁻⁷.
const normalCDF = (z) => {
    const signo = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + signo * erf);
};

// Función gamma incompleta regularizada P(a,x), necesaria para la
// distribución de chi cuadrado. Serie para x < a+1 y fracción continua
// de Lentz en caso contrario (Numerical Recipes, cap. 6).
const logGamma = (x) => {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
               -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
};

const gammaIncompletaP = (a, x) => {
    if (x <= 0) return 0;
    if (x < a + 1) {
        let ap = a, sum = 1 / a, del = sum;
        for (let n = 1; n <= 300; n++) {
            ap++; del *= x / ap; sum += del;
            if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
        }
        return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    }
    // Fracción continua para Q(a,x); P = 1 − Q
    let b = x + 1 - a, c = 1e30, d = 1 / b, h = d;
    for (let i = 1; i <= 300; i++) {
        const an = -i * (i - a);
        b += 2; d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
        c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        const del = d * c; h *= del;
        if (Math.abs(del - 1) < 1e-12) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
};

// Cola superior de la distribución de chi cuadrado
const chiCuadradoP = (chi2, gl) => {
    if (chi2 <= 0 || gl <= 0) return 1;
    return 1 - gammaIncompletaP(gl / 2, chi2 / 2);
};

// Generador congruencial con semilla (mulberry32). El remuestreo tiene
// que ser reproducible: un intervalo de confianza por bootstrap que
// cambia en cada pulsación no se puede reportar en una publicación.
const generadorConSemilla = (semilla) => {
    let a = semilla >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

// Rangos con corrección por empates (rango medio). Necesario para
// Spearman, Mann-Whitney y Kruskal-Wallis: ignorar los empates infla el
// estadístico, y en datos de cuestionario los empates son la norma.
const rangosConEmpates = (a) => {
    const idx = a.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v);
    const r = new Array(a.length);
    const gruposEmpate = [];
    let i = 0;
    while (i < idx.length) {
        let j = i;
        while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
        const rangoMedio = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++) r[idx[k].i] = rangoMedio;
        if (j > i) gruposEmpate.push(j - i + 1);
        i = j + 1;
    }
    return { rangos: r, gruposEmpate };
};


// ------------------------------------------------------------
// 1. DESCRIPTIVOS
// ------------------------------------------------------------
const descriptivos = (valores) => {
    const v = (valores || []).filter(esNumero).map(aNum);
    if (!v.length) return { n: 0 };
    const ord = [...v].sort((a, b) => a - b);
    return {
        n: v.length,
        media: Math.round(media(v) * 10000) / 10000,
        desvio: v.length > 1 ? Math.round(desvio(v) * 10000) / 10000 : null,
        minimo: ord[0],
        maximo: ord[ord.length - 1],
        mediana: Math.round(percentil(ord, 0.5) * 10000) / 10000,
        q1: Math.round(percentil(ord, 0.25) * 10000) / 10000,
        q3: Math.round(percentil(ord, 0.75) * 10000) / 10000,
        faltantes: (valores || []).length - v.length
    };
};


// ------------------------------------------------------------
// 2. INTERVALO DE CONFIANZA DE UNA PROPORCIÓN (WILSON)
// ------------------------------------------------------------
// Se usa Wilson y no la aproximación normal de Wald porque la
// sensibilidad y la especificidad se estiman a menudo sobre
// denominadores pequeños y con proporciones cercanas a 0 o a 1, que es
// justo donde Wald produce límites imposibles (por debajo de 0 o por
// encima de 1) y una cobertura muy inferior a la nominal.
// Wilson EB. J Am Stat Assoc 1927;22:209.
const intervaloWilson = (exitos, n, z = Z_95) => {
    if (!n || n <= 0) return { estimacion: null, inferior: null, superior: null, n: 0 };
    const p = exitos / n;
    const z2 = z * z;
    const denom = 1 + z2 / n;
    const centro = (p + z2 / (2 * n)) / denom;
    const semi = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return {
        estimacion: Math.round(p * 10000) / 10000,
        inferior: Math.round(Math.max(0, centro - semi) * 10000) / 10000,
        superior: Math.round(Math.min(1, centro + semi) * 10000) / 10000,
        n,
        exitos,
        metodo: 'Wilson'
    };
};


// ------------------------------------------------------------
// 3. EXACTITUD DIAGNÓSTICA A PARTIR DE LA MATRIZ DE CONFUSIÓN
// ------------------------------------------------------------
// VP = verdaderos positivos, FP = falsos positivos,
// FN = falsos negativos, VN = verdaderos negativos.
//
// Los valores predictivos dependen de la PREVALENCIA de la muestra, de
// modo que solo son trasladables a otra población si su prevalencia es
// parecida. Se devuelve la prevalencia junto a ellos para que eso quede
// a la vista, y se ofrecen las razones de verosimilitud, que son
// independientes de la prevalencia y por tanto las cifras que conviene
// reportar en una validación.
const metricasDiagnosticas = ({ vp, fp, fn, vn }) => {
    const VP = Number(vp) || 0, FP = Number(fp) || 0, FN = Number(fn) || 0, VN = Number(vn) || 0;
    const positivosReales = VP + FN;
    const negativosReales = FP + VN;
    const total = VP + FP + FN + VN;

    const sens = intervaloWilson(VP, positivosReales);
    const espec = intervaloWilson(VN, negativosReales);
    const vpp = intervaloWilson(VP, VP + FP);
    const vpn = intervaloWilson(VN, VN + FN);
    const exactitud = intervaloWilson(VP + VN, total);

    const s = positivosReales ? VP / positivosReales : NaN;
    const e = negativosReales ? VN / negativosReales : NaN;

    const rvPositiva = (1 - e) > 0 ? s / (1 - e) : null;
    const rvNegativa = e > 0 ? (1 - s) / e : null;

    return {
        matriz: { vp: VP, fp: FP, fn: FN, vn: VN },
        total,
        prevalencia: total ? Math.round((positivosReales / total) * 10000) / 10000 : null,
        sensibilidad: sens,
        especificidad: espec,
        valorPredictivoPositivo: vpp,
        valorPredictivoNegativo: vpn,
        exactitud,
        razonVerosimilitudPositiva: rvPositiva !== null && isFinite(rvPositiva) ? Math.round(rvPositiva * 1000) / 1000 : null,
        razonVerosimilitudNegativa: rvNegativa !== null && isFinite(rvNegativa) ? Math.round(rvNegativa * 1000) / 1000 : null,
        indiceYouden: (isFinite(s) && isFinite(e)) ? Math.round((s + e - 1) * 10000) / 10000 : null,
        // Razón de momios diagnóstica
        razonMomiosDiagnostica: (FP > 0 && FN > 0) ? Math.round(((VP * VN) / (FP * FN)) * 1000) / 1000 : null,
        notaKey: 'stats_ppv_depends_on_prevalence'
    };
};

// Construye la matriz de confusión aplicando un corte a un predictor
// continuo. `mayorEsPositivo` indica el sentido del predictor: en un
// puntaje de riesgo, más alto es más enfermo; en un T-score de
// densitometría o en una 25(OH)D, es lo contrario.
const matrizDesdeCorte = (predictor, desenlace, corte, mayorEsPositivo = true) => {
    let vp = 0, fp = 0, fn = 0, vn = 0;
    const par = emparejarCompletos(predictor, desenlace);
    for (let i = 0; i < par.n; i++) {
        const positivoPrueba = mayorEsPositivo ? par.x[i] >= corte : par.x[i] <= corte;
        const positivoReal = par.y[i] === 1;
        if (positivoPrueba && positivoReal) vp++;
        else if (positivoPrueba && !positivoReal) fp++;
        else if (!positivoPrueba && positivoReal) fn++;
        else vn++;
    }
    return { vp, fp, fn, vn, descartados: par.descartados, corte };
};


// ------------------------------------------------------------
// 4. CURVA ROC Y ÁREA BAJO LA CURVA
// ------------------------------------------------------------
// El área se calcula por DOS vías independientes que deben coincidir:
//
//   (a) regla trapezoidal sobre los puntos de la curva empírica;
//   (b) estadístico U de Mann-Whitney normalizado, contando los empates
//       como medio acierto —que es la definición no paramétrica del área
//       y la que hace el cálculo exacto con datos discretos.
//
// Que coincidan es una comprobación interna útil: si difieren, hay un
// error de manejo de empates, que es el fallo clásico de las
// implementaciones de ROC sobre puntuaciones enteras como las de esta
// herramienta.
//
// El error estándar es el de Hanley y McNeil (Radiology 1982;143:29),
// que asume una distribución exponencial subyacente; se acompaña del
// intervalo por remuestreo, que no hace ese supuesto.
const curvaROC = (predictor, desenlace, { mayorEsPositivo = true } = {}) => {
    const par = emparejarCompletos(predictor, desenlace);
    const valores = par.x.map((v, i) => ({ v: mayorEsPositivo ? v : -v, d: par.y[i] === 1 ? 1 : 0 }));

    const positivos = valores.filter(o => o.d === 1);
    const negativos = valores.filter(o => o.d === 0);
    const nP = positivos.length, nN = negativos.length;

    if (nP === 0 || nN === 0) {
        return {
            valido: false,
            motivoKey: 'stats_roc_needs_both_classes',
            nPositivos: nP, nNegativos: nN, descartados: par.descartados
        };
    }

    // (b) Área por el estadístico U, con empates a 0.5
    const rango = rangosConEmpates(valores.map(o => o.v));
    const sumaRangosPositivos = suma(valores.map((o, i) => (o.d === 1 ? rango.rangos[i] : 0)));
    const U = sumaRangosPositivos - (nP * (nP + 1)) / 2;
    const aucU = U / (nP * nN);

    // (a) Puntos de la curva: un punto por umbral único, más los extremos
    const umbrales = [...new Set(valores.map(o => o.v))].sort((a, b) => b - a);
    const puntos = [{ fpr: 0, tpr: 0, corte: null }];
    umbrales.forEach(u => {
        let vp = 0, fp = 0;
        valores.forEach(o => {
            if (o.v >= u) { if (o.d === 1) vp++; else fp++; }
        });
        puntos.push({
            fpr: fp / nN,
            tpr: vp / nP,
            // Se devuelve el corte en la escala ORIGINAL del predictor
            corte: mayorEsPositivo ? u : -u
        });
    });
    puntos.push({ fpr: 1, tpr: 1, corte: null });

    let aucTrapecio = 0;
    for (let i = 1; i < puntos.length; i++) {
        aucTrapecio += (puntos[i].fpr - puntos[i - 1].fpr) * (puntos[i].tpr + puntos[i - 1].tpr) / 2;
    }

    // Error estándar de Hanley-McNeil
    const A = aucU;
    const Q1 = A / (2 - A);
    const Q2 = (2 * A * A) / (1 + A);
    const varHM = (A * (1 - A) + (nP - 1) * (Q1 - A * A) + (nN - 1) * (Q2 - A * A)) / (nP * nN);
    const seHM = Math.sqrt(Math.max(0, varHM));

    // Contraste frente a la hipótesis nula de área = 0.5
    const zAUC = seHM > 0 ? (A - 0.5) / seHM : null;
    const pAUC = zAUC !== null ? 2 * (1 - normalCDF(Math.abs(zAUC))) : null;

    return {
        valido: true,
        auc: Math.round(aucU * 10000) / 10000,
        aucTrapecio: Math.round(aucTrapecio * 10000) / 10000,
        // Discrepancia entre las dos vías: debe ser del orden del error
        // de redondeo. Se expone para que el revisor pueda comprobarlo.
        discrepanciaVias: Math.round(Math.abs(aucU - aucTrapecio) * 1e6) / 1e6,
        errorEstandar: Math.round(seHM * 10000) / 10000,
        ic95: {
            inferior: Math.round(Math.max(0, A - Z_95 * seHM) * 10000) / 10000,
            superior: Math.round(Math.min(1, A + Z_95 * seHM) * 10000) / 10000,
            metodo: 'Hanley-McNeil'
        },
        z: zAUC !== null ? Math.round(zAUC * 1000) / 1000 : null,
        p: pAUC !== null ? pAUC : null,
        U,
        nPositivos: nP,
        nNegativos: nN,
        descartados: par.descartados,
        puntos,
        mayorEsPositivo
    };
};

// Intervalo de confianza del área por remuestreo con semilla fija. No
// asume la distribución subyacente de Hanley-McNeil. Se remuestrea por
// ESTRATO (positivos y negativos por separado) para conservar la
// prevalencia de la muestra original, que es lo correcto cuando el
// diseño fijó el número de casos y controles.
const bootstrapAUC = (predictor, desenlace, { mayorEsPositivo = true, iteraciones = 2000, semilla = 20260101 } = {}) => {
    const par = emparejarCompletos(predictor, desenlace);
    const pos = [], neg = [];
    for (let i = 0; i < par.n; i++) (par.y[i] === 1 ? pos : neg).push(par.x[i]);
    if (!pos.length || !neg.length) return { valido: false, motivoKey: 'stats_roc_needs_both_classes' };

    const rnd = generadorConSemilla(semilla);
    const areas = [];
    for (let b = 0; b < iteraciones; b++) {
        const mp = Array.from({ length: pos.length }, () => pos[Math.floor(rnd() * pos.length)]);
        const mn = Array.from({ length: neg.length }, () => neg[Math.floor(rnd() * neg.length)]);
        const r = curvaROC([...mp, ...mn],
            [...mp.map(() => 1), ...mn.map(() => 0)], { mayorEsPositivo });
        if (r.valido) areas.push(r.auc);
    }
    areas.sort((a, b) => a - b);
    return {
        valido: true,
        iteraciones: areas.length,
        semilla,
        media: Math.round(media(areas) * 10000) / 10000,
        ic95: {
            inferior: Math.round(percentil(areas, 0.025) * 10000) / 10000,
            superior: Math.round(percentil(areas, 0.975) * 10000) / 10000,
            metodo: 'bootstrap por percentiles, estratificado'
        }
    };
};

// Comparación de dos áreas sobre LOS MISMOS participantes (por ejemplo,
// el puntaje compuesto propio frente al OST). El remuestreo es pareado:
// se remuestrean los individuos, no los predictores por separado, porque
// los dos predictores están correlacionados al medirse en la misma
// persona y tratarlos como independientes sobrestimaría el intervalo.
const compararAUCPareado = (predictorA, predictorB, desenlace, { mayorEsPositivoA = true, mayorEsPositivoB = true, iteraciones = 2000, semilla = 20260101 } = {}) => {
    const filas = [];
    const n = Math.min(predictorA.length, predictorB.length, desenlace.length);
    for (let i = 0; i < n; i++) {
        if (esNumero(predictorA[i]) && esNumero(predictorB[i]) && esNumero(desenlace[i])) {
            filas.push({ a: aNum(predictorA[i]), b: aNum(predictorB[i]), d: aNum(desenlace[i]) === 1 ? 1 : 0 });
        }
    }
    if (filas.length < 4) return { valido: false, motivoKey: 'stats_not_enough_pairs' };

    const rocA = curvaROC(filas.map(f => f.a), filas.map(f => f.d), { mayorEsPositivo: mayorEsPositivoA });
    const rocB = curvaROC(filas.map(f => f.b), filas.map(f => f.d), { mayorEsPositivo: mayorEsPositivoB });
    if (!rocA.valido || !rocB.valido) return { valido: false, motivoKey: 'stats_roc_needs_both_classes' };

    const rnd = generadorConSemilla(semilla);
    const difs = [];
    for (let k = 0; k < iteraciones; k++) {
        const m = Array.from({ length: filas.length }, () => filas[Math.floor(rnd() * filas.length)]);
        const ra = curvaROC(m.map(f => f.a), m.map(f => f.d), { mayorEsPositivo: mayorEsPositivoA });
        const rb = curvaROC(m.map(f => f.b), m.map(f => f.d), { mayorEsPositivo: mayorEsPositivoB });
        if (ra.valido && rb.valido) difs.push(ra.auc - rb.auc);
    }
    difs.sort((x, y) => x - y);
    const inf = percentil(difs, 0.025), sup = percentil(difs, 0.975);

    return {
        valido: true,
        aucA: rocA.auc,
        aucB: rocB.auc,
        diferencia: Math.round((rocA.auc - rocB.auc) * 10000) / 10000,
        ic95: { inferior: Math.round(inf * 10000) / 10000, superior: Math.round(sup * 10000) / 10000 },
        // El intervalo excluye el cero: las áreas difieren al 5%
        diferenciaSignificativa: (inf > 0 && sup > 0) || (inf < 0 && sup < 0),
        n: filas.length,
        iteraciones: difs.length,
        semilla,
        metodo: 'bootstrap pareado por percentiles'
    };
};


// ------------------------------------------------------------
// 5. CORTE ÓPTIMO
// ------------------------------------------------------------
// Se recorren TODOS los umbrales observados y se devuelve el mejor por
// tres criterios distintos, porque no hay un único corte "óptimo": la
// elección depende del coste relativo de un falso negativo frente a un
// falso positivo, y esa es una decisión del investigador, no del
// programa.
//
//   · Youden (sensibilidad + especificidad − 1): pondera ambos errores
//     por igual.
//   · Distancia mínima al vértice (0,1) de la curva.
//   · Sensibilidad mínima exigida: el criterio pertinente en un
//     tamizaje, donde perder un caso cuesta más que una prueba de más.
//
// Se devuelve la tabla completa de umbrales para que el corte publicado
// pueda justificarse y no parezca elegido a posteriori.
const buscarCorteOptimo = (predictor, desenlace, { mayorEsPositivo = true, sensibilidadMinima = 0.90 } = {}) => {
    const par = emparejarCompletos(predictor, desenlace);
    if (!par.n) return { valido: false, motivoKey: 'stats_no_data' };

    const umbrales = [...new Set(par.x)].sort((a, b) => a - b);
    const tabla = umbrales.map(corte => {
        const m = matrizDesdeCorte(par.x, par.y, corte, mayorEsPositivo);
        const met = metricasDiagnosticas(m);
        const s = met.sensibilidad.estimacion, e = met.especificidad.estimacion;
        return {
            corte,
            sensibilidad: s,
            especificidad: e,
            youden: (s !== null && e !== null) ? Math.round((s + e - 1) * 10000) / 10000 : null,
            distanciaAlVertice: (s !== null && e !== null)
                ? Math.round(Math.sqrt(Math.pow(1 - s, 2) + Math.pow(1 - e, 2)) * 10000) / 10000
                : null,
            matriz: m
        };
    }).filter(f => f.youden !== null);

    if (!tabla.length) return { valido: false, motivoKey: 'stats_no_data' };

    const porYouden = [...tabla].sort((a, b) => b.youden - a.youden)[0];
    const porDistancia = [...tabla].sort((a, b) => a.distanciaAlVertice - b.distanciaAlVertice)[0];
    const candidatosSens = tabla.filter(f => f.sensibilidad >= sensibilidadMinima);
    const porSensibilidadMinima = candidatosSens.length
        ? [...candidatosSens].sort((a, b) => b.especificidad - a.especificidad)[0]
        : null;

    return {
        valido: true,
        tabla,
        porYouden,
        porDistancia,
        porSensibilidadMinima,
        sensibilidadMinimaExigida: sensibilidadMinima,
        notaKey: 'stats_cutoff_is_a_decision'
    };
};


// ------------------------------------------------------------
// 6. CONCORDANCIA ENTRE CATEGORÍAS: KAPPA
// ------------------------------------------------------------
// Kappa de Cohen (Educ Psychol Meas 1960;20:37) y su versión ponderada
// (Cohen, Psychol Bull 1968;70:213) para categorías ORDENADAS, que es el
// caso de esta herramienta: bajo / moderado / alto no son categorías
// intercambiables, y confundir bajo con alto es un error mayor que
// confundir bajo con moderado. El kappa sin ponderar trata los dos
// errores igual y por eso subestima la concordancia de una escala
// ordinal.
const kappaCohen = (categoriasA, categoriasB, { ponderacion = 'ninguna', ordenCategorias = null } = {}) => {
    const filas = [];
    const n = Math.min(categoriasA.length, categoriasB.length);
    for (let i = 0; i < n; i++) {
        const a = categoriasA[i], b = categoriasB[i];
        if (a !== '' && a !== null && a !== undefined && b !== '' && b !== null && b !== undefined) {
            filas.push([String(a), String(b)]);
        }
    }
    if (filas.length < 2) return { valido: false, motivoKey: 'stats_not_enough_pairs' };

    const categorias = ordenCategorias && ordenCategorias.length
        ? ordenCategorias.map(String)
        : [...new Set(filas.flat())].sort();
    const k = categorias.length;
    const indice = {};
    categorias.forEach((c, i) => { indice[c] = i; });

    const tabla = Array.from({ length: k }, () => new Array(k).fill(0));
    filas.forEach(([a, b]) => {
        if (indice[a] !== undefined && indice[b] !== undefined) tabla[indice[a]][indice[b]]++;
    });
    const N = filas.length;

    // Matriz de pesos: 0 en la diagonal, 1 en el desacuerdo máximo
    const peso = (i, j) => {
        if (ponderacion === 'lineal') return Math.abs(i - j) / (k - 1);
        if (ponderacion === 'cuadratica') return Math.pow(i - j, 2) / Math.pow(k - 1, 2);
        return i === j ? 0 : 1;
    };

    const marginalA = tabla.map(f => suma(f));
    const marginalB = categorias.map((_, j) => suma(tabla.map(f => f[j])));

    let desacuerdoObservado = 0, desacuerdoEsperado = 0;
    for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
            const w = peso(i, j);
            desacuerdoObservado += w * tabla[i][j] / N;
            desacuerdoEsperado += w * (marginalA[i] / N) * (marginalB[j] / N);
        }
    }

    const kappa = desacuerdoEsperado > 0 ? 1 - desacuerdoObservado / desacuerdoEsperado : null;

    // Error estándar asintótico del kappa sin ponderar
    let se = null;
    if (ponderacion === 'ninguna') {
        const po = 1 - desacuerdoObservado, pe = 1 - desacuerdoEsperado;
        if (pe < 1) se = Math.sqrt(po * (1 - po) / (N * Math.pow(1 - pe, 2)));
    }

    // Escala de Landis y Koch (Biometrics 1977;33:159). Es una convención
    // de lectura, no un criterio estadístico: se etiqueta como tal.
    const etiqueta = kappa === null ? null
        : kappa < 0 ? 'peor_que_azar'
        : kappa < 0.21 ? 'leve'
        : kappa < 0.41 ? 'aceptable'
        : kappa < 0.61 ? 'moderada'
        : kappa < 0.81 ? 'sustancial' : 'casi_perfecta';

    return {
        valido: true,
        kappa: kappa !== null ? Math.round(kappa * 10000) / 10000 : null,
        acuerdoObservado: Math.round((1 - desacuerdoObservado) * 10000) / 10000,
        acuerdoEsperado: Math.round((1 - desacuerdoEsperado) * 10000) / 10000,
        errorEstandar: se !== null ? Math.round(se * 10000) / 10000 : null,
        ic95: se !== null ? {
            inferior: Math.round((kappa - Z_95 * se) * 10000) / 10000,
            superior: Math.round((kappa + Z_95 * se) * 10000) / 10000
        } : null,
        n: N,
        categorias,
        tablaContingencia: tabla,
        ponderacion,
        etiquetaLandisKoch: etiqueta,
        notaKey: 'stats_landis_koch_is_convention'
    };
};


// ------------------------------------------------------------
// 7. FIABILIDAD TEST-RETEST: COEFICIENTE DE CORRELACIÓN INTRACLASE
// ------------------------------------------------------------
// ICC(2,1) de Shrout y Fleiss (Psychol Bull 1979;86:420): modelo de dos
// vías de efectos aleatorios, ACUERDO ABSOLUTO, medición única.
//
// La elección del modelo importa y se declara: el de acuerdo absoluto
// penaliza el sesgo sistemático entre ocasiones, y el de consistencia no.
// Para un test-retest de la misma herramienta con el mismo evaluador, el
// acuerdo absoluto es el correcto: si la segunda medición da
// sistemáticamente dos puntos más, eso es un problema de la herramienta
// y no debe quedar oculto. Se devuelven los dos para que la diferencia
// entre ellos —que es exactamente la magnitud del sesgo sistemático— sea
// visible.
const iccDosVias = (medicion1, medicion2) => {
    const par = emparejarCompletos(medicion1, medicion2);
    const n = par.n;
    if (n < 3) return { valido: false, motivoKey: 'stats_icc_needs_3' };

    const k = 2;
    const todos = [...par.x, ...par.y];
    const granMedia = media(todos);

    const mediasSujeto = par.x.map((v, i) => (v + par.y[i]) / 2);
    const mediasOcasion = [media(par.x), media(par.y)];

    // Sumas de cuadrados del modelo de dos vías
    const ssTotal = suma(todos.map(v => Math.pow(v - granMedia, 2)));
    const ssSujetos = k * suma(mediasSujeto.map(m => Math.pow(m - granMedia, 2)));
    const ssOcasiones = n * suma(mediasOcasion.map(m => Math.pow(m - granMedia, 2)));
    const ssError = ssTotal - ssSujetos - ssOcasiones;

    const glSujetos = n - 1;
    const glOcasiones = k - 1;
    const glError = glSujetos * glOcasiones;

    const msSujetos = ssSujetos / glSujetos;
    const msOcasiones = ssOcasiones / glOcasiones;
    const msError = glError > 0 ? ssError / glError : 0;

    // ICC(2,1): acuerdo absoluto, medición única
    const denomAbsoluto = msSujetos + (k - 1) * msError + (k * (msOcasiones - msError)) / n;
    const iccAbsoluto = denomAbsoluto !== 0 ? (msSujetos - msError) / denomAbsoluto : null;

    // ICC(3,1): consistencia, medición única
    const denomConsistencia = msSujetos + (k - 1) * msError;
    const iccConsistencia = denomConsistencia !== 0 ? (msSujetos - msError) / denomConsistencia : null;

    // Error estándar de la medida y cambio mínimo detectable
    const varianzaError = msError;
    const sem = Math.sqrt(Math.max(0, varianzaError));
    const cambioMinimoDetectable = 1.96 * Math.SQRT2 * sem;

    const etiqueta = iccAbsoluto === null ? null
        : iccAbsoluto < 0.5 ? 'pobre'
        : iccAbsoluto < 0.75 ? 'moderada'
        : iccAbsoluto < 0.9 ? 'buena' : 'excelente';

    return {
        valido: true,
        n,
        iccAcuerdoAbsoluto: iccAbsoluto !== null ? Math.round(iccAbsoluto * 10000) / 10000 : null,
        iccConsistencia: iccConsistencia !== null ? Math.round(iccConsistencia * 10000) / 10000 : null,
        // La diferencia entre ambos ES el sesgo sistemático entre ocasiones
        sesgoSistematico: Math.round((mediasOcasion[1] - mediasOcasion[0]) * 10000) / 10000,
        errorEstandarMedida: Math.round(sem * 10000) / 10000,
        cambioMinimoDetectable: Math.round(cambioMinimoDetectable * 10000) / 10000,
        modelo: 'ICC(2,1) Shrout-Fleiss, dos vías aleatorio, acuerdo absoluto, medición única',
        etiqueta,
        descartados: par.descartados
    };
};


// ------------------------------------------------------------
// 8. CONSISTENCIA INTERNA: ALFA DE CRONBACH
// ------------------------------------------------------------
// Cronbach LJ. Psychometrika 1951;16:297.
//
// Se aplica al SARC-F, cuyos cinco ítems se suman en un único puntaje:
// esa suma solo tiene sentido si los ítems miden lo mismo. Se devuelve
// además la correlación ítem-total corregida (cada ítem contra la suma
// de los OTROS ítems, no contra el total que lo incluye, porque incluirlo
// infla artificialmente la correlación) y el alfa que resultaría de
// eliminar cada ítem, que es lo que indica si algún ítem está
// deteriorando la escala.
//
// LÍMITE QUE HAY QUE DECLARAR: el alfa depende del número de ítems y no
// es una medida de unidimensionalidad. Con cinco ítems, valores
// alrededor de 0.7 son los esperables incluso en una escala que funciona.
const alfaCronbach = (matrizItems) => {
    // matrizItems: array de sujetos, cada uno con un array de puntuaciones
    const filas = (matrizItems || []).filter(f => Array.isArray(f) && f.every(esNumero)).map(f => f.map(aNum));
    if (filas.length < 3) return { valido: false, motivoKey: 'stats_alpha_needs_3' };
    const k = filas[0].length;
    if (k < 2 || filas.some(f => f.length !== k)) return { valido: false, motivoKey: 'stats_alpha_ragged' };

    const columna = (j) => filas.map(f => f[j]);
    const totales = filas.map(f => suma(f));

    const sumaVarianzasItems = suma(Array.from({ length: k }, (_, j) => varianza(columna(j))));
    const varianzaTotal = varianza(totales);
    const alfa = varianzaTotal > 0 ? (k / (k - 1)) * (1 - sumaVarianzasItems / varianzaTotal) : null;

    // ALFA ESTANDARIZADO. El alfa de arriba (el "crudo") se calcula sobre
    // covarianzas y por tanto depende de que los ítems tengan varianzas
    // parecidas. El estandarizado se calcula sobre la correlación media
    // entre ítems y es el que cumple exactamente la fórmula de
    // Spearman-Brown:
    //        alfa = k·r̄ / (1 + (k−1)·r̄)
    // Los dos coinciden cuando las varianzas de los ítems son iguales, y
    // su diferencia indica hasta qué punto un ítem con varianza mayor
    // está dominando la escala. En el SARC-F, donde los cinco ítems
    // comparten la misma escala de 0 a 2, deberían quedar próximos.
    let correlacionMediaEntreItems = null;
    if (k >= 2) {
        const correlaciones = [];
        for (let i = 0; i < k; i++) {
            for (let j = i + 1; j < k; j++) {
                const r = pearson(columna(i), columna(j));
                if (r.valido) correlaciones.push(r.r);
            }
        }
        if (correlaciones.length) correlacionMediaEntreItems = media(correlaciones);
    }
    const alfaEstandarizado = correlacionMediaEntreItems !== null
        ? (k * correlacionMediaEntreItems) / (1 + (k - 1) * correlacionMediaEntreItems)
        : null;

    // Correlación ítem-total corregida y alfa sin cada ítem
    const porItem = Array.from({ length: k }, (_, j) => {
        const item = columna(j);
        const restoTotales = filas.map(f => suma(f.filter((_, jj) => jj !== j)));
        const r = pearson(item, restoTotales);

        let alfaSinItem = null;
        if (k > 2) {
            const sinJ = filas.map(f => f.filter((_, jj) => jj !== j));
            const kk = k - 1;
            const sumaVar = suma(Array.from({ length: kk }, (_, jj) => varianza(sinJ.map(f => f[jj]))));
            const varTot = varianza(sinJ.map(f => suma(f)));
            alfaSinItem = varTot > 0 ? Math.round(((kk / (kk - 1)) * (1 - sumaVar / varTot)) * 10000) / 10000 : null;
        }

        return {
            item: j,
            varianza: Math.round(varianza(item) * 10000) / 10000,
            correlacionItemTotalCorregida: r.valido ? r.r : null,
            alfaSiSeElimina: alfaSinItem
        };
    });

    return {
        valido: true,
        alfa: alfa !== null ? Math.round(alfa * 10000) / 10000 : null,
        alfaEstandarizado: alfaEstandarizado !== null ? Math.round(alfaEstandarizado * 10000) / 10000 : null,
        correlacionMediaEntreItems: correlacionMediaEntreItems !== null
            ? Math.round(correlacionMediaEntreItems * 10000) / 10000 : null,
        nItems: k,
        nSujetos: filas.length,
        sumaVarianzasItems: Math.round(sumaVarianzasItems * 10000) / 10000,
        varianzaTotal: Math.round(varianzaTotal * 10000) / 10000,
        porItem,
        notaKey: 'stats_alpha_not_unidimensionality'
    };
};


// ------------------------------------------------------------
// 9. CORRELACIONES
// ------------------------------------------------------------
const pearson = (x, y) => {
    const par = emparejarCompletos(x, y);
    if (par.n < 3) return { valido: false, motivoKey: 'stats_not_enough_pairs', n: par.n };
    const mx = media(par.x), my = media(par.y);
    const dx = par.x.map(v => v - mx), dy = par.y.map(v => v - my);
    const num = suma(dx.map((v, i) => v * dy[i]));
    const den = Math.sqrt(suma(dx.map(v => v * v)) * suma(dy.map(v => v * v)));
    if (den === 0) return { valido: false, motivoKey: 'stats_zero_variance', n: par.n };
    const r = num / den;

    // Intervalo por la transformación z de Fisher
    const n = par.n;
    const z = 0.5 * Math.log((1 + r) / (1 - r));
    const se = 1 / Math.sqrt(n - 3);
    const lo = Math.tanh(z - Z_95 * se), hi = Math.tanh(z + Z_95 * se);
    // Contraste de r = 0 por el estadístico t
    const t = r * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r));

    return {
        valido: true,
        r: Math.round(r * 10000) / 10000,
        r2: Math.round(r * r * 10000) / 10000,
        n,
        ic95: { inferior: Math.round(lo * 10000) / 10000, superior: Math.round(hi * 10000) / 10000, metodo: 'z de Fisher' },
        t: Math.round(t * 1000) / 1000,
        gl: n - 2,
        descartados: par.descartados
    };
};

// Spearman: Pearson sobre los rangos, con rango medio en los empates.
// Es la correlación pertinente para las puntuaciones ordinales de esta
// herramienta y para el T-score frente a un puntaje de cribado.
const spearman = (x, y) => {
    const par = emparejarCompletos(x, y);
    if (par.n < 3) return { valido: false, motivoKey: 'stats_not_enough_pairs', n: par.n };
    const rx = rangosConEmpates(par.x).rangos;
    const ry = rangosConEmpates(par.y).rangos;
    const base = pearson(rx, ry);
    if (!base.valido) return base;
    return { ...base, rho: base.r, metodo: 'Spearman (Pearson sobre rangos, empates con rango medio)' };
};


// ------------------------------------------------------------
// 10. CONCORDANCIA ENTRE MEDICIONES CONTINUAS: BLAND-ALTMAN
// ------------------------------------------------------------
// Bland JM, Altman DG. Lancet 1986;1:307.
//
// La correlación NO mide concordancia: dos métodos donde uno da siempre
// el doble que el otro correlacionan perfectamente y no concuerdan en
// nada. Bland-Altman separa el sesgo medio de la dispersión del
// desacuerdo, que es la información que hace falta para decidir si dos
// mediciones son intercambiables.
//
// Se incluye la prueba de sesgo proporcional: si la diferencia crece con
// la magnitud, los límites de acuerdo constantes no son válidos y hay
// que transformar. Es el error más común al aplicar el método.
const blandAltman = (metodo1, metodo2) => {
    const par = emparejarCompletos(metodo1, metodo2);
    if (par.n < 3) return { valido: false, motivoKey: 'stats_not_enough_pairs', n: par.n };

    const diferencias = par.x.map((v, i) => v - par.y[i]);
    const promedios = par.x.map((v, i) => (v + par.y[i]) / 2);

    const sesgo = media(diferencias);
    const sd = desvio(diferencias);
    const n = par.n;
    const seSesgo = sd / Math.sqrt(n);

    // Sesgo proporcional: regresión de la diferencia sobre el promedio
    const regresion = pearson(promedios, diferencias);

    return {
        valido: true,
        n,
        sesgo: Math.round(sesgo * 10000) / 10000,
        desvioDiferencias: Math.round(sd * 10000) / 10000,
        ic95Sesgo: {
            inferior: Math.round((sesgo - Z_95 * seSesgo) * 10000) / 10000,
            superior: Math.round((sesgo + Z_95 * seSesgo) * 10000) / 10000
        },
        limiteAcuerdoInferior: Math.round((sesgo - 1.96 * sd) * 10000) / 10000,
        limiteAcuerdoSuperior: Math.round((sesgo + 1.96 * sd) * 10000) / 10000,
        // El sesgo medio difiere de cero: hay diferencia sistemática
        sesgoSignificativo: Math.abs(sesgo) > Z_95 * seSesgo,
        correlacionDiferenciaPromedio: regresion.valido ? regresion.r : null,
        sesgoProporcional: regresion.valido && Math.abs(regresion.r) > 0.3,
        avisoSesgoProporcionalKey: (regresion.valido && Math.abs(regresion.r) > 0.3)
            ? 'stats_ba_proportional_bias' : null,
        puntos: promedios.map((p, i) => ({ promedio: p, diferencia: diferencias[i] })),
        descartados: par.descartados
    };
};


// ------------------------------------------------------------
// 11. CALIBRACIÓN
// ------------------------------------------------------------
// Un puntaje puede ORDENAR bien a los participantes (buena área bajo la
// curva) y a la vez estar mal CALIBRADO, es decir, predecir una
// proporción de casos que no se corresponde con la observada. Son dos
// propiedades distintas y las dos hacen falta.
//
// Se agrupa por cuantiles del puntaje y se compara la proporción
// observada de casos con el puntaje medio del grupo, en la línea del
// gráfico de calibración de Hosmer-Lemeshow. Con muestras pequeñas los
// grupos quedan poco poblados: el número de cada grupo se devuelve para
// que eso sea visible.
const calibracionPorGrupos = (predictor, desenlace, { grupos = 5 } = {}) => {
    const par = emparejarCompletos(predictor, desenlace);
    if (par.n < grupos * 2) return { valido: false, motivoKey: 'stats_calibration_needs_n', n: par.n };

    const filas = par.x.map((v, i) => ({ v, d: par.y[i] === 1 ? 1 : 0 })).sort((a, b) => a.v - b.v);
    const tamano = Math.floor(filas.length / grupos);

    const resultado = [];
    for (let g = 0; g < grupos; g++) {
        const desde = g * tamano;
        const hasta = g === grupos - 1 ? filas.length : (g + 1) * tamano;
        const trozo = filas.slice(desde, hasta);
        if (!trozo.length) continue;
        const casos = suma(trozo.map(f => f.d));
        const ic = intervaloWilson(casos, trozo.length);
        resultado.push({
            grupo: g + 1,
            n: trozo.length,
            puntajeMedio: Math.round(media(trozo.map(f => f.v)) * 10000) / 10000,
            puntajeMinimo: trozo[0].v,
            puntajeMaximo: trozo[trozo.length - 1].v,
            casos,
            proporcionObservada: ic.estimacion,
            ic95: { inferior: ic.inferior, superior: ic.superior }
        });
    }

    // Monotonía: la proporción observada debe crecer con el puntaje. Es
    // la comprobación mínima de que el puntaje va en el sentido correcto.
    let monotona = true;
    for (let i = 1; i < resultado.length; i++) {
        if (resultado[i].proporcionObservada < resultado[i - 1].proporcionObservada) monotona = false;
    }

    return {
        valido: true,
        grupos: resultado,
        monotona,
        n: par.n,
        notaKey: 'stats_calibration_vs_discrimination'
    };
};


// ------------------------------------------------------------
// 12. CONTRASTES ENTRE GRUPOS
// ------------------------------------------------------------
// El estudio compara cuatro patrones dietéticos. Con tamaños de grupo
// desiguales y puntuaciones ordinales, los contrastes no paramétricos
// son los pertinentes. Las aproximaciones son asintóticas: con grupos
// muy pequeños el valor p es orientativo y se declara.

// U de Mann-Whitney con corrección por empates y aproximación normal.
const mannWhitney = (grupoA, grupoB) => {
    const a = (grupoA || []).filter(esNumero).map(aNum);
    const b = (grupoB || []).filter(esNumero).map(aNum);
    if (a.length < 2 || b.length < 2) return { valido: false, motivoKey: 'stats_not_enough_per_group' };

    const todos = [...a, ...b];
    const { rangos, gruposEmpate } = rangosConEmpates(todos);
    const sumaA = suma(rangos.slice(0, a.length));
    const nA = a.length, nB = b.length, N = nA + nB;

    const U_A = sumaA - (nA * (nA + 1)) / 2;
    const U = Math.min(U_A, nA * nB - U_A);

    const mediaU = (nA * nB) / 2;
    const correccionEmpates = suma(gruposEmpate.map(t => (t * t * t - t))) / (N * (N - 1));
    const varU = (nA * nB / 12) * ((N + 1) - correccionEmpates);
    const z = varU > 0 ? (U_A - mediaU) / Math.sqrt(varU) : 0;
    const p = 2 * (1 - normalCDF(Math.abs(z)));

    return {
        valido: true,
        U,
        U_A,
        z: Math.round(z * 1000) / 1000,
        p,
        nA, nB,
        // Tamaño del efecto: probabilidad de superioridad, que es la
        // misma cantidad que el área bajo la curva ROC.
        probabilidadSuperioridad: Math.round((U_A / (nA * nB)) * 10000) / 10000,
        medianaA: descriptivos(a).mediana,
        medianaB: descriptivos(b).mediana,
        metodo: 'U de Mann-Whitney, aproximación normal con corrección por empates',
        avisoMuestraPequenaKey: (nA < 10 || nB < 10) ? 'stats_small_sample_p' : null
    };
};

// H de Kruskal-Wallis para tres o más grupos independientes.
const kruskalWallis = (grupos) => {
    const gs = (grupos || []).map(g => (g || []).filter(esNumero).map(aNum)).filter(g => g.length >= 2);
    if (gs.length < 2) return { valido: false, motivoKey: 'stats_not_enough_groups' };

    const todos = gs.flat();
    const N = todos.length;
    const { rangos, gruposEmpate } = rangosConEmpates(todos);

    let offset = 0;
    const sumasRango = gs.map(g => {
        const s = suma(rangos.slice(offset, offset + g.length));
        offset += g.length;
        return s;
    });

    let H = (12 / (N * (N + 1))) * suma(sumasRango.map((R, i) => (R * R) / gs[i].length)) - 3 * (N + 1);
    const correccion = 1 - suma(gruposEmpate.map(t => (t * t * t - t))) / (N * N * N - N);
    if (correccion > 0) H = H / correccion;

    const gl = gs.length - 1;
    return {
        valido: true,
        H: Math.round(H * 1000) / 1000,
        gl,
        p: chiCuadradoP(H, gl),
        nGrupos: gs.length,
        nPorGrupo: gs.map(g => g.length),
        medianas: gs.map(g => descriptivos(g).mediana),
        correccionEmpates: Math.round(correccion * 10000) / 10000,
        metodo: 'H de Kruskal-Wallis con corrección por empates',
        // Rechazar la hipótesis nula no dice QUÉ grupos difieren: eso
        // requiere comparaciones por pares con ajuste del nivel.
        notaKey: 'stats_kw_needs_posthoc'
    };
};

// Chi cuadrado de independencia sobre una tabla de contingencia.
const chiCuadradoIndependencia = (tabla) => {
    const t = (tabla || []).filter(f => Array.isArray(f) && f.length);
    if (t.length < 2 || t[0].length < 2) return { valido: false, motivoKey: 'stats_table_too_small' };

    const filas = t.length, columnas = t[0].length;
    const totalFila = t.map(f => suma(f));
    const totalColumna = Array.from({ length: columnas }, (_, j) => suma(t.map(f => f[j] || 0)));
    const N = suma(totalFila);
    if (!N) return { valido: false, motivoKey: 'stats_table_empty' };

    let chi2 = 0;
    let celdasEsperadoBajo = 0;
    const esperados = [];
    for (let i = 0; i < filas; i++) {
        esperados.push([]);
        for (let j = 0; j < columnas; j++) {
            const e = (totalFila[i] * totalColumna[j]) / N;
            esperados[i].push(Math.round(e * 100) / 100);
            if (e < 5) celdasEsperadoBajo++;
            if (e > 0) chi2 += Math.pow((t[i][j] || 0) - e, 2) / e;
        }
    }
    const gl = (filas - 1) * (columnas - 1);

    return {
        valido: true,
        chi2: Math.round(chi2 * 1000) / 1000,
        gl,
        p: chiCuadradoP(chi2, gl),
        n: N,
        esperados,
        celdasConEsperadoMenorQue5: celdasEsperadoBajo,
        // La aproximación de chi cuadrado exige frecuencias esperadas
        // suficientes. Con celdas por debajo de 5 el valor p no es de
        // fiar y corresponde una prueba exacta.
        avisoKey: celdasEsperadoBajo > 0 ? 'stats_chi2_low_expected' : null,
        // V de Cramér como tamaño del efecto
        vCramer: Math.round(Math.sqrt(chi2 / (N * Math.min(filas - 1, columnas - 1))) * 10000) / 10000
    };
};


// ------------------------------------------------------------
// 13. INFORME COMPLETO DE VALIDACIÓN
// ------------------------------------------------------------
// Encadena el análisis que un estudio de validación necesita para un
// predictor y un desenlace: discriminación, corte óptimo, exactitud en
// ese corte y calibración. Es lo que la pestaña de Validación muestra.
const informeValidacion = (predictor, desenlace, opciones = {}) => {
    const {
        mayorEsPositivo = true,
        sensibilidadMinima = 0.90,
        iteracionesBootstrap = 2000,
        semilla = 20260101,
        gruposCalibracion = 5,
        nombrePredictor = 'predictor',
        nombreDesenlace = 'desenlace'
    } = opciones;

    const roc = curvaROC(predictor, desenlace, { mayorEsPositivo });
    if (!roc.valido) return { valido: false, motivoKey: roc.motivoKey, roc };

    const boot = bootstrapAUC(predictor, desenlace, { mayorEsPositivo, iteraciones: iteracionesBootstrap, semilla });
    const cortes = buscarCorteOptimo(predictor, desenlace, { mayorEsPositivo, sensibilidadMinima });
    const corteYouden = cortes.valido ? cortes.porYouden.corte : null;
    const exactitudEnCorte = corteYouden !== null
        ? metricasDiagnosticas(matrizDesdeCorte(predictor, desenlace, corteYouden, mayorEsPositivo))
        : null;
    const calibracion = calibracionPorGrupos(predictor, desenlace, { grupos: gruposCalibracion });
    const correlacion = spearman(predictor, desenlace);

    return {
        valido: true,
        nombrePredictor,
        nombreDesenlace,
        n: roc.nPositivos + roc.nNegativos,
        descartadosPorDatoFaltante: roc.descartados,
        prevalencia: Math.round((roc.nPositivos / (roc.nPositivos + roc.nNegativos)) * 10000) / 10000,
        discriminacion: roc,
        bootstrap: boot,
        cortes,
        corteRecomendado: corteYouden,
        exactitudEnCorte,
        calibracion,
        correlacion,
        sello: typeof CARDA_SELLO !== 'undefined' ? CARDA_SELLO : null,
        generado: new Date().toISOString()
    };
};
