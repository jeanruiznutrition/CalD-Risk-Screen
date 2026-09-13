// ============================================================
// CalD Risk Screen — Componente principal de la interfaz (React) v1.1
// Consume: TRANSLATIONS (i18n.js), catálogos de data.js y las
// funciones del motor CARDA (algorithm.js).
// ============================================================

const { useState, useEffect, useMemo } = React;

let contadorAlimentoExtra = 0;
const nuevoAlimentoExtra = () => {
    contadorAlimentoExtra += 1;
    return {
        ...PLANTILLA_ALIMENTO_EXTRA,
        id: `alimento_extra_${contadorAlimentoExtra}`,
        nombrePersonalizado: '',
        diasPorSemana: 0,
        vecesPorDia: 1,
        porcionesPorComida: 1.0
    };
};

function App() {
    const [darkMode, setDarkMode] = useState(false);
    const [lang, setLang] = useState(detectarIdiomaInicial);

    const cambiarIdioma = (nuevo) => {
        setLang(nuevo);
        guardarIdioma(nuevo);
        document.documentElement.setAttribute('lang', nuevo);
    };

    useEffect(() => { document.documentElement.setAttribute('lang', lang); }, [lang]);

    // --- Perfil del participante ---
    const [marcoReferencia, setMarcoReferencia] = useState('IOM');
    const [marcoVitD, setMarcoVitD] = useState(MARCO_VITD_POR_DEFECTO);

    // --- Identificación del participante y registro acumulado ---
    const [participante, setParticipante] = useState({
        codigo: '',
        fecha: new Date().toISOString().slice(0, 10),
        notas: ''
    });
    const [registroAcumulado, setRegistroAcumulado] = useState([]);


    // --- Inhibidores y pérdidas de calcio ---
    const [modificadores, setModificadores] = useState({
        usaIBP: false,
        nivelSodio: 'medio',
        tazasCafeDia: 0
    });

    const [perfil, setPerfil] = useState({
        edad: 30,
        sexo: 'femenino',
        pesoKg: 65,
        tallaCm: 165,
        circunferenciaPantorrilla: '',
        grupoEstudio: 'Vegano',
        fuma: false,
        alcoholFrecuente: false,
        proteinaAdecuada: true
    });

    // --- Ejercicio (categorías OMS: aeróbico y fortalecimiento muscular) ---
    const [ejercicio, setEjercicio] = useState({
        horasAerobicoSemana: 0,
        diasFuerzaSemana: 0,
        horasFuerzaSemana: 0
    });

    // --- FFQ de fuentes de calcio ---
    const [alimentos, setAlimentos] = useState(
        ALIMENTOS_INICIALES.map(al => ({
            ...al,
            diasPorSemana: 0,
            vecesPorDia: 1,
            porcionesPorComida: 1.0,
            unidadSeleccionada: al.unidadSeleccionadaPorDefecto || null
        }))
    );
    const [alimentosExtra, setAlimentosExtra] = useState([]);

    // --- Reubicaciones manuales de la semana virtual ---
    const [manualOverrides, setManualOverrides] = useState({});
    const [selectedInstance, setSelectedInstance] = useState(null);
    const [draggedInstance, setDraggedInstance] = useState(null);

    // --- Suplementación de calcio (tipo + mg/día + veces/día + días/semana) ---
    const [suplementoCalcio, setSuplementoCalcio] = useState({
        tipoId: 'ninguno',
        mgPorDia: 0,
        vecesPorDia: 1,
        diasPorSemana: 7
    });

    // --- FFQ de fuentes de vitamina D + suplementación ---
    // La dosis se captura en unidades internacionales porque es la unidad
    // que aparece en las etiquetas de los suplementos. El motor trabaja en
    // microgramos, así que se convierte al calcular (1 mcg = 40 UI).
    const [suplementoVitD, setSuplementoVitD] = useState({ uiPorDia: '', diasPorSemana: 0, forma: 'D3' });

    // --- Suplementos de entrenamiento (creatina y proteína en polvo) ---
    // Variables de control/confusión para el estudio de validación: la
    // creatina eleva la creatinina sérica/urinaria sin reflejar función
    // renal, lo que puede distorsionar la razón calcio/creatinina urinaria;
    // y tanto la creatina como la proteína en polvo pueden confundir la
    // comparación de composición muscular (SARC-F) entre grupos dietéticos.
    // No alimentan el motor CARDA: solo se registran para el análisis
    // estadístico. Distinto del alimento "proteína en polvo" del FFQ de
    // calcio (que mide su aporte de calcio como fuente dietética).
    const [suplementosEntrenamiento, setSuplementosEntrenamiento] = useState({
        creatina: false,
        creatinaGramosDia: 5,
        proteinaPolvoEntrenamiento: false,
        proteinaPolvoEntrenamientoGramosDia: 20
    });

    // --- Exposición solar (con fototipo, sin protector solar como variable) ---
    const [exposicionSolar, setExposicionSolar] = useState({
        diasPorSemana: 0,
        minutosPorSesion: 0,
        horario: 'no_pico',
        fototipo: 'III',
        superficieCorporal: 'parcial'
    });

    // --- Cuestionario SARC-F ---
    const [respuestasSarcF, setRespuestasSarcF] = useState({});

    // --- Laboratorio opcional: calcio sérico y 25-OH-vitamina D ---
    const [labCalcioSerico, setLabCalcioSerico] = useState('');
    const [labVitaminaD, setLabVitaminaD] = useState('');

    useEffect(() => {
        if (darkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [darkMode]);

    // Filtro dinámico de alimentos/fuentes basado en el patrón dietético
    const filtrarPorDieta = (lista) => lista.filter(al => {
        if (perfil.grupoEstudio === 'Vegano' && al.ocultoEnVegano) return false;
        if (perfil.grupoEstudio === 'Ovolactovegetariano' && al.ocultoEnOvolacto) return false;
        return true;
    });

    const alimentosFiltrados = useMemo(() => filtrarPorDieta(alimentos), [alimentos, perfil.grupoEstudio]);

    // Resuelve el calcioPorcion efectivo (considera unidad alternativa seleccionada)
    const resolverCalcioPorcion = (al) => {
        if (al.unidadesAlternativas) {
            const unidad = al.unidadesAlternativas.find(u => u.key === al.unidadSeleccionada) || al.unidadesAlternativas[0];
            return unidad.calcioPorUnidad;
        }
        return parseFloat(al.calcioPorcion) || 0;
    };

    // Los campos numéricos se guardan como texto para evitar el problema
    // de los ceros a la izquierda; aquí se convierten a número, que es lo
    // que el motor necesita.
    const aNumero = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    const alimentosParaAlgoritmo = useMemo(() => {
        const normalizar = (al) => ({
            ...al,
            calcioPorcion: resolverCalcioPorcion(al),
            vitDPorcion: aNumero(al.vitDPorcion),
            proteinaPorcion: aNumero(al.proteinaPorcion),
            gramosPorcion: aNumero(al.gramosPorcion)
        });
        const base = alimentosFiltrados.map(normalizar);
        const extra = alimentosExtra.map(al => ({ ...normalizar(al), nombreKey: null, nombreLibre: al.nombrePersonalizado || null }));
        return [...base, ...extra];
    }, [alimentosFiltrados, alimentosExtra]);

    // --- Handlers FFQ calcio ---

    // ------------------------------------------------------------
    // ENTRADA NUMÉRICA SIN CEROS A LA IZQUIERDA
    // ------------------------------------------------------------
    // Los campos numéricos guardan TEXTO, no números. Si guardaran
    // números, al escribir sobre un campo que muestra "0" el resultado
    // sería "0120" en lugar de "120". Guardando texto, lo que el
    // evaluador escribe es exactamente lo que queda, y la conversión a
    // número ocurre solo en el momento del cálculo.
    const limpiarNumero = (texto) => {
        if (texto === '' || texto === null || texto === undefined) return '';
        let t = String(texto).replace(',', '.');
        // Quita ceros a la izquierda salvo cuando son parte de un decimal
        t = t.replace(/^0+(?=\d)/, '');
        return t;
    };

    const alEnfocarNumero = (e) => {
        // Al entrar en un campo que muestra 0, se limpia para que el
        // primer dígito escrito no quede pegado detrás del cero.
        if (e.target.value === '0') e.target.select();
    };

    const handleAlimentoChange = (id, campo, valor) => {
        setAlimentos(prev => prev.map(al => (al.id === id ? { ...al, [campo]: valor } : al)));
        if (campo === 'diasPorSemana' || campo === 'vecesPorDia') {
            setManualOverrides(prev => {
                if (!prev[id]) return prev;
                const { [id]: _omitido, ...resto } = prev;
                return resto;
            });
        }
    };

    const handleAlimentoExtraChange = (id, campo, valor) => {
        setAlimentosExtra(prev => prev.map(al => (al.id === id ? { ...al, [campo]: valor } : al)));
    };

    const agregarAlimentoExtra = () => {
        setAlimentosExtra(prev => [...prev, nuevoAlimentoExtra()]);
    };

    const quitarAlimentoExtra = (id) => {
        setAlimentosExtra(prev => prev.filter(al => al.id !== id));
    };

    // --- Drag & drop / tocar-y-tocar (semana virtual) ---
    const moverInstancia = (foodId, occurrenceIndex, diaDestino, comidaDestino) => {
        setManualOverrides(prev => ({
            ...prev,
            [foodId]: { ...prev[foodId], [occurrenceIndex]: { dia: diaDestino, comida: comidaDestino } }
        }));
    };
    const resetearInstancia = (foodId, occurrenceIndex) => {
        setManualOverrides(prev => {
            if (!prev[foodId]) return prev;
            const { [occurrenceIndex]: _omitido, ...resto } = prev[foodId];
            return { ...prev, [foodId]: resto };
        });
    };
    const handleDragStart = (foodId, occurrenceIndex, nombreKey) => (e) => {
        setDraggedInstance({ foodId, occurrenceIndex, nombreKey });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `${foodId}:${occurrenceIndex}`);
    };
    const handleDragEnd = () => setDraggedInstance(null);
    const handleDropEnCelda = (diaDestino, comidaDestino) => (e) => {
        e.preventDefault();
        if (draggedInstance) moverInstancia(draggedInstance.foodId, draggedInstance.occurrenceIndex, diaDestino, comidaDestino);
        setDraggedInstance(null);
        setSelectedInstance(null);
    };
    const handleTapAlimento = (foodId, occurrenceIndex, nombreKey) => (e) => {
        e.stopPropagation();
        setSelectedInstance(prev => (prev && prev.foodId === foodId && prev.occurrenceIndex === occurrenceIndex) ? null : { foodId, occurrenceIndex, nombreKey });
    };
    const handleTapCelda = (diaDestino, comidaDestino) => () => {
        if (selectedInstance) {
            moverInstancia(selectedInstance.foodId, selectedInstance.occurrenceIndex, diaDestino, comidaDestino);
            setSelectedInstance(null);
        }
    };

    const handleGrupoEstudioChange = (nuevoGrupo) => {
        setPerfil(prev => ({ ...prev, grupoEstudio: nuevoGrupo }));
        setAlimentos(prev => prev.map(al => {
            const seOculta = (nuevoGrupo === 'Vegano' && al.ocultoEnVegano) || (nuevoGrupo === 'Ovolactovegetariano' && al.ocultoEnOvolacto);
            return seOculta ? { ...al, diasPorSemana: 0, vecesPorDia: 1, porcionesPorComida: 1.0 } : al;
        }));

    };

    const handlePerfilChange = (campo, valor) => setPerfil(prev => ({ ...prev, [campo]: valor }));
    const handleEjercicioChange = (campo, valor) => setEjercicio(prev => ({ ...prev, [campo]: valor }));
    const handleExposicionChange = (campo, valor) => setExposicionSolar(prev => ({ ...prev, [campo]: valor }));
    const handleSarcFChange = (preguntaId, valor) => setRespuestasSarcF(prev => ({ ...prev, [preguntaId]: valor }));
    const handleSuplementoCalcioChange = (campo, valor) => setSuplementoCalcio(prev => ({ ...prev, [campo]: valor }));
    const handleSuplementoVitDChange = (campo, valor) => setSuplementoVitD(prev => ({ ...prev, [campo]: valor }));
    const handleSuplementoEntrenamientoChange = (campo, valor) => setSuplementosEntrenamiento(prev => ({ ...prev, [campo]: valor }));

    // --- Cálculo reactivo de los módulos ---
    const suplementoCalcioActivo = useMemo(() => (
        suplementoCalcio.tipoId === 'ninguno' ? null : { ...suplementoCalcio, tipoId: suplementoCalcio.tipoId }
    ), [suplementoCalcio]);

    const referenciaCalcio = useMemo(
        () => obtenerReferenciaCalcio(Number(perfil.edad) || 30, perfil.sexo, marcoReferencia),
        [perfil.edad, perfil.sexo, marcoReferencia]
    );


    const resultadosCalcio = useMemo(
        () => ejecutarSemanaVirtualCalcio(alimentosParaAlgoritmo, suplementoCalcioActivo, manualOverrides, referenciaCalcio),
        [alimentosParaAlgoritmo, suplementoCalcioActivo, manualOverrides, referenciaCalcio]
    );

    const calcioConModificadores = useMemo(
        () => aplicarModificadoresCalcio(resultadosCalcio, {
            usaIBP: modificadores.usaIBP,
            tipoSuplemento: suplementoCalcio.tipoId,
            nivelSodio: modificadores.nivelSodio,
            tazasCafeDia: modificadores.tazasCafeDia
        }),
        [resultadosCalcio, modificadores, suplementoCalcio.tipoId]
    );

    const resultadoSolarEstandar = useMemo(
        () => calcularExposicionSolarEstandar({ ...exposicionSolar, edad: Number(perfil.edad) || 30 }),
        [exposicionSolar, perfil.edad]
    );


    const resultadoLabVitD = useMemo(() => interpretar25OHVitaminaD(labVitaminaD, marcoVitD), [labVitaminaD, marcoVitD]);
    const resultadoLabCalcio = useMemo(() => interpretarCalcioSerico(labCalcioSerico), [labCalcioSerico]);
    const combinacionVitDCalcio = useMemo(
        () => evaluarCombinacionVitDCalcio(resultadoLabVitD, resultadoLabCalcio),
        [resultadoLabVitD, resultadoLabCalcio]
    );

    const resultadoVitDDieta = useMemo(
        () => calcularAdecuacionVitaminaD(
            alimentosParaAlgoritmo,
            {
                mcgPorDia: (parseFloat(suplementoVitD.uiPorDia) || 0) / UI_POR_MCG_VITAMINA_D,
                diasPorSemana: suplementoVitD.diasPorSemana,
                forma: suplementoVitD.forma
            },
            Number(perfil.edad) || 0
        ),
        [alimentosParaAlgoritmo, suplementoVitD, perfil.edad]
    );

    // La clasificación solar se basa en las UI diarias estimadas frente a
    // la RDA, que es una comparación con significado, en lugar de un
    // índice en unidades arbitrarias.
    const categoriaSolar = (() => {
        const metaUI = resultadoVitDDieta.meta * 40;
        const ui = resultadoSolarEstandar.uiPromedioDia;
        if (ui >= metaUI) return { cat: 'bajo', color: 'emerald' };
        if (ui >= metaUI * 0.4) return { cat: 'moderado', color: 'amber' };
        return { cat: 'alto', color: 'rose' };
    })();
    
    // Razón de adecuación según el organismo elegido. Se calcula aquí, de
    // forma independiente, para que el riesgo óseo no dependa de valores
    // declarados más abajo en el archivo.
    const razonSegunMarco = useMemo(() => {
        if (marcoReferencia === 'EPIC') {
            const meta = UMBRAL_PROTECTOR_EPIC_OXFORD_MG;
            return meta > 0 ? Math.round((resultadosCalcio.promedioIngeridoSemanal / meta) * 1000) / 10 : 0;
        }
        const rda = obtenerReferenciaCalcio(Number(perfil.edad) || 30, perfil.sexo, marcoReferencia).rda;
        const metaAbs = rda * absorcionFraccionalPorCarga(rda / 3);
        return metaAbs > 0 ? Math.round((resultadosCalcio.promedioAbsorbidoSemanal / metaAbs) * 1000) / 10 : 0;
    }, [marcoReferencia, resultadosCalcio, perfil.edad, perfil.sexo]);

    const resultadoOseo = useMemo(() => calcularRiesgoOseo({
        porcentajeCumplimientoCalcio: razonSegunMarco,
        categoriaRiesgoSolar: categoriaSolar.cat,
        categoriaVitDDieta: resultadoVitDDieta.categoria,
        edad: Number(perfil.edad) || 0,
        sexo: perfil.sexo,
        diasEjercicioFuerza: Number(ejercicio.diasFuerzaSemana) || 0,
        fuma: perfil.fuma,
        alcoholFrecuente: perfil.alcoholFrecuente,
        bajoUmbralEpicOxford: resultadosCalcio.bajoUmbralEpicOxford,
        esVegano: perfil.grupoEstudio === 'Vegano'
    }), [razonSegunMarco, resultadosCalcio, categoriaSolar.cat, resultadoVitDDieta.categoria, perfil, ejercicio.diasFuerzaSemana]);

    const resultadoProteina = useMemo(() => calcularProteinaDesdeCuestionario(alimentosParaAlgoritmo, {
        pesoKg: perfil.pesoKg,
        edad: Number(perfil.edad) || 30,
        esDietaVegetal: perfil.grupoEstudio === 'Vegano'
    }), [alimentosParaAlgoritmo, perfil.pesoKg, perfil.edad, perfil.grupoEstudio]);

    const resultadoSarcopenia = useMemo(() => calcularRiesgoSarcopenia(respuestasSarcF, {
        proteinaAdecuada: resultadoProteina.categoria === 'adecuada',
        diasEjercicioFuerza: Number(ejercicio.diasFuerzaSemana) || 0,
        circunferenciaPantorrilla: perfil.circunferenciaPantorrilla,
        sexo: perfil.sexo
    }), [respuestasSarcF, perfil, ejercicio.diasFuerzaSemana]);



    const resultadoEjercicio = useMemo(() => calcularAdherenciaEjercicio({
        horasAerobicoSemana: Number(ejercicio.horasAerobicoSemana) || 0,
        diasFuerzaSemana: Number(ejercicio.diasFuerzaSemana) || 0,
        horasFuerzaSemana: Number(ejercicio.horasFuerzaSemana) || 0
    }), [ejercicio]);

    const t = useMemo(() => crearTraductor(lang), [lang]);

    // Comparación del resultado del participante contra la meta de cada
    // organismo. Se muestra para que quede explícito que las metas no
    // coinciden y que la clasificación depende de cuál se adopte.
    const comparacionMarcos = useMemo(() => {
        const absorbido = resultadosCalcio.promedioAbsorbidoSemanal;
        const ingerido = resultadosCalcio.promedioIngeridoSemanal;
        const filas = [
            { id: 'IOM', nombreKey: 'frameworks_iom_name', rda: obtenerReferenciaCalcio(Number(perfil.edad) || 30, perfil.sexo, 'IOM').rda },
            { id: 'EFSA', nombreKey: 'frameworks_efsa_name', rda: obtenerReferenciaCalcio(Number(perfil.edad) || 30, perfil.sexo, 'EFSA').rda },
            { id: 'EPIC', nombreKey: 'frameworks_epic_name', rda: UMBRAL_PROTECTOR_EPIC_OXFORD_MG }
        ];
        return filas.map(f => {
            const metaAbs = f.rda * absorcionFraccionalPorCarga(f.rda / 3);
            // El umbral de EPIC-Oxford es de INGESTA observada, no una meta
            // de absorción, por lo que se compara contra lo ingerido.
            const razon = f.id === 'EPIC'
                ? (f.rda > 0 ? Math.round((ingerido / f.rda) * 1000) / 10 : 0)
                : (metaAbs > 0 ? Math.round((absorbido / metaAbs) * 1000) / 10 : 0);
            return {
                ...f,
                metaAbsorbida: f.id === 'EPIC' ? '—' : Math.round(metaAbs),
                razon,
                colorKey: razon >= 100 ? 'emerald' : razon >= 75 ? 'amber' : 'rose',
                esActual: f.id === marcoReferencia
            };
        });
    }, [resultadosCalcio, perfil.edad, perfil.sexo, marcoReferencia]);
    const nombreAlimento = (al) => al.nombreLibre || t(al.nombreKey);

    // Las dos primeras tarjetas se evalúan contra el organismo elegido.
    // El umbral de EPIC-Oxford es de INGESTA observada, no una meta de
    // absorción, por lo que ahí la comparación se hace sobre lo ingerido.
    const filaMarcoActual = comparacionMarcos.find(m => m.esActual) || comparacionMarcos[0];

    const barraPorRazon = (r) => r >= 100 ? 'bg-emerald-500' : r >= 75 ? 'bg-amber-500' : 'bg-rose-500';

    const metricaIngesta = (() => {
        const meta = filaMarcoActual.rda;
        const pct = meta > 0 ? Math.round((resultadosCalcio.promedioIngeridoSemanal / meta) * 1000) / 10 : 0;
        return {
            porcentaje: pct,
            colorBarra: barraPorRazon(pct),
            leyenda: t('metrics_intake_legend')
                .replace('{pct}', pct)
                .replace('{meta}', meta)
                .replace('{org}', t(filaMarcoActual.nombreKey))
        };
    })();

    const metricaAbsorbida = (() => {
        if (filaMarcoActual.id === 'EPIC') {
            return {
                porcentaje: metricaIngesta.porcentaje,
                colorBarra: barraPorRazon(metricaIngesta.porcentaje),
                leyenda: t('metrics_absorbed_legend_epic')
            };
        }
        const meta = filaMarcoActual.metaAbsorbida;
        const pct = meta > 0 ? Math.round((resultadosCalcio.promedioAbsorbidoSemanal / meta) * 1000) / 10 : 0;
        return {
            porcentaje: pct,
            colorBarra: barraPorRazon(pct),
            leyenda: t('metrics_absorbed_legend')
                .replace('{pct}', pct)
                .replace('{meta}', meta)
                .replace('{org}', t(filaMarcoActual.nombreKey))
        };
    })();

    const clasifCalcio = clasificarAdecuacionCalcio(razonSegunMarco);
    const infoRiesgoCalcio = {
        clasificacion: t(`diag_cal_${clasifCalcio.categoria}`),
        descripcion: t(`diag_cal_${clasifCalcio.categoria}_desc`),
        color: {
            emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/20',
            amber: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-500/20',
            rose: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-500/20'
        }[clasifCalcio.colorKey]
    };

    const colorClasesPorKey = {
        emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/20',
        amber: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-500/20',
        rose: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-500/20'
    };
    const textoColorPorKey = { emerald: 'text-emerald-500', amber: 'text-amber-500', rose: 'text-rose-500' };

    const infoRiesgoOseo = {
        clasificacion: t(`diag_bone_${resultadoOseo.categoria}`),
        color: colorClasesPorKey[resultadoOseo.colorKey],
        descripcion: t(`diag_bone_${resultadoOseo.categoria}_desc`),
    };
    const infoRiesgoSarcopenia = {
        clasificacion: t(`diag_sarc_${resultadoSarcopenia.categoria}`),
        color: colorClasesPorKey[resultadoSarcopenia.colorKey],
        descripcion: t(`diag_sarc_${resultadoSarcopenia.categoria}_desc`)
    };
    const infoSolar = { clasificacion: t(`solar_${categoriaSolar.cat}`), color: colorClasesPorKey[categoriaSolar.color] };
    const infoVitDDieta = { clasificacion: t(`vitd_dieta_${resultadoVitDDieta.categoria}`), color: colorClasesPorKey[resultadoVitDDieta.colorKey] };


    // ------------------------------------------------------------
    // REGISTRO ACUMULADO DE PARTICIPANTES
    // ------------------------------------------------------------
    // Con 180 participantes, exportar un archivo por persona produce un
    // rompecabezas. Aquí las sesiones se acumulan en memoria y se
    // exportan como un único CSV de formato ancho, con una fila por
    // participante, listo para importar en SPSS, R o Jamovi.
    const construirFilaParticipante = () => ({
        codigo: participante.codigo || '(sin codigo)',
        fecha: participante.fecha,
        edad: perfil.edad,
        sexo: perfil.sexo,
        pesoKg: perfil.pesoKg,
        tallaCm: perfil.tallaCm,
        imc: (Number(perfil.pesoKg) > 0 && Number(perfil.tallaCm) > 0)
            ? Math.round((Number(perfil.pesoKg) / Math.pow(Number(perfil.tallaCm) / 100, 2)) * 10) / 10
            : '',
        patronDietetico: perfil.grupoEstudio,
        marcoReferencia: marcoReferencia,
        rdaCalcio: resultadosCalcio.referencia.rda,
        calcioIngeridoDia: resultadosCalcio.promedioIngeridoSemanal,
        calcioAbsorbidoDia: resultadosCalcio.promedioAbsorbidoSemanal,
        calcioAbsorbidoNetoDia: calcioConModificadores.absorbidoNeto,
        eficienciaAbsorcion: resultadosCalcio.eficienciaGlobal,
        razonAdecuacionCalcio: resultadosCalcio.razonAdecuacion,
        razonAdecuacionNeta: calcioConModificadores.razonAdecuacionNeta,
        bajoUmbral525: resultadosCalcio.bajoUmbralEpicOxford ? 1 : 0,
        suplementoTipo: suplementoCalcio.tipoId,
        suplementoMgDia: suplementoCalcio.mgPorDia,
        usaIBP: modificadores.usaIBP ? 1 : 0,
        nivelSodio: modificadores.nivelSodio,
        tazasCafeDia: modificadores.tazasCafeDia,
        perdidaCalcioDia: calcioConModificadores.perdidas.perdidaTotal,
        vitDDietaMcgDia: resultadoVitDDieta.dietaEq,
        vitDSuplMcgDia: resultadoVitDDieta.suplEq,
        vitDTotalMcgDia: resultadoVitDDieta.totalEq,
        vitDCategoria: resultadoVitDDieta.categoria,
        fototipo: exposicionSolar.fototipo,
        solarDiasSemana: exposicionSolar.diasPorSemana,
        solarMinutosSesion: exposicionSolar.minutosPorSesion,
        solarSuperficie: exposicionSolar.superficieCorporal,
        solarSedSemanal: resultadoSolarEstandar.sedSemanal,
        solarFraccionMED: resultadoSolarEstandar.fraccionMEDPorSesion,
        solarUIDia: resultadoSolarEstandar.uiPromedioDia,
        vitDTotalConSolUIDia: Math.round(resultadoVitDDieta.totalEq * 40 + resultadoSolarEstandar.uiPromedioDia),
        ejercicioAerobicoHoras: ejercicio.horasAerobicoSemana,
        ejercicioFuerzaDias: ejercicio.diasFuerzaSemana,
        sarcfPuntaje: resultadoSarcopenia.puntajeTotal,
        sarcfCategoria: resultadoSarcopenia.categoria,
        pantorrillaCm: perfil.circunferenciaPantorrilla,
        proteinaGkg: resultadoProteina.sinDatos ? '' : resultadoProteina.gPorKg,
        proteinaObjetivo: resultadoProteina.objetivo,
        usaCreatina: suplementosEntrenamiento.creatina ? 1 : 0,
        creatinaGramosDia: suplementosEntrenamiento.creatina ? suplementosEntrenamiento.creatinaGramosDia : '',
        usaProteinaPolvoEntrenamiento: suplementosEntrenamiento.proteinaPolvoEntrenamiento ? 1 : 0,
        proteinaPolvoEntrenamientoGramosDia: suplementosEntrenamiento.proteinaPolvoEntrenamiento ? suplementosEntrenamiento.proteinaPolvoEntrenamientoGramosDia : '',
        labCalcioSerico: labCalcioSerico,
        lab25OHVitD: labVitaminaD,
        notas: (participante.notas || '').replace(/[;\r\n]/g, ' ')
    });

    const guardarEnRegistro = () => {
        if (!participante.codigo.trim()) {
            alert(t('registry_need_code'));
            return;
        }
        const fila = construirFilaParticipante();
        setRegistroAcumulado(prev => {
            const idx = prev.findIndex(r => r.codigo === fila.codigo);
            if (idx >= 0) {
                const copia = [...prev];
                copia[idx] = fila;
                return copia;
            }
            return [...prev, fila];
        });
    };

    const quitarDelRegistro = (codigo) => {
        setRegistroAcumulado(prev => prev.filter(r => r.codigo !== codigo));
    };

    const exportarRegistroCompleto = () => {
        if (registroAcumulado.length === 0) { alert(t('registry_empty')); return; }
        const columnas = Object.keys(registroAcumulado[0]);
        let csv = '\ufeff' + columnas.join(';') + '\r\n';
        registroAcumulado.forEach(fila => {
            csv += columnas.map(c => (fila[c] === null || fila[c] === undefined ? '' : String(fila[c]))).join(';') + '\r\n';
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `CalD_Registro_${new Date().toISOString().slice(0,10)}_n${registroAcumulado.length}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };


    const imprimirHojaParticipante = () => {
        document.body.classList.add('modo-hoja-participante');
        window.print();
        setTimeout(() => document.body.classList.remove('modo-hoja-participante'), 500);
    };

    const handleModificadorChange = (campo, valor) => setModificadores(prev => ({ ...prev, [campo]: valor }));
    const handleParticipanteChange = (campo, valor) => setParticipante(prev => ({ ...prev, [campo]: valor }));

    const exportarExcel = () => {
        let csv = "data:text/csv;charset=utf-8,";
        csv += "CalD Risk Screen - Resultados del Algoritmo CARDA v2.7\r\n";
        csv += "(C) 2026 Jean Carlos Ruiz Mosley - Todos los derechos reservados\r\n";
        csv += `Patron Dietetico;${perfil.grupoEstudio}\r\nEdad;${perfil.edad}\r\nSexo;${perfil.sexo}\r\n\r\n`;
        csv += "MODULO 1: CALCIO\r\n";
        csv += `Razon de adecuacion (absorbido/meta);${resultadosCalcio.razonAdecuacion}%\r\nAbsorbido neto (tras IBP/sodio/cafeina);${calcioConModificadores.absorbidoNeto} mg/dia\r\nEficiencia de absorcion;${resultadosCalcio.eficienciaGlobal}%\r\nCumplimiento Semanal;${resultadosCalcio.porcentajeCumplimiento}%\r\nDias Adecuados;${resultadosCalcio.diasCumplidos}\r\nPromedio Absorbido (mg/dia);${resultadosCalcio.promedioAbsorbidoSemanal}\r\n\r\n`;
        csv += "MODULO 2: VITAMINA D\r\n";
        csv += `Exposicion solar SED/semana;${resultadoSolarEstandar.sedSemanal}\r\nFraccion de MED por sesion;${resultadoSolarEstandar.fraccionMEDPorSesion}\r\nVitamina D solar estimada;${resultadoSolarEstandar.uiPromedioDia} UI/dia\r\nCategoria solar;${categoriaSolar.cat}\r\n`;
        csv += `Vitamina D dietetica + suplemento (mcg/dia prom.);${resultadoVitDDieta.totalPromedioDia} / meta ${resultadoVitDDieta.meta}\r\n`;
        if (resultadoLabVitD) csv += `25-OH-Vitamina D serica (ng/mL);${labVitaminaD} (${resultadoLabVitD.categoria})\r\n`;
        if (resultadoLabCalcio) csv += `Calcio serico total (mg/dL);${labCalcioSerico} (${resultadoLabCalcio.categoria})\r\n`;
        csv += "\r\nMODULO 3: RIESGO OSEO (orientativo)\r\n";
        csv += `Puntaje;${resultadoOseo.puntaje} / ${resultadoOseo.puntajeMaximo}\r\nCategoria;${resultadoOseo.categoria}\r\n\r\n`;
        csv += "MODULO 4: SARCOPENIA (SARC-F)\r\n";
        csv += `Puntaje;${resultadoSarcopenia.puntajeTotal} / 10\r\nRiesgo probable;${resultadoSarcopenia.riesgoProbable ? 'SI' : 'NO'}\r\n`;
        csv += `Creatina (suplemento);${suplementosEntrenamiento.creatina ? `SI, ${suplementosEntrenamiento.creatinaGramosDia} g/dia` : 'NO'}\r\n`;
        csv += `Proteina en polvo (suplemento de entrenamiento);${suplementosEntrenamiento.proteinaPolvoEntrenamiento ? `SI, ${suplementosEntrenamiento.proteinaPolvoEntrenamientoGramosDia} g/dia` : 'NO'}\r\n\r\n`;
        csv += "Frecuencias Reportadas (FFQ Calcio):\r\nAlimento;Dias/Semana;Veces/Dia;Porciones;Calcio por Porcion (mg)\r\n";
        alimentosParaAlgoritmo.forEach(al => {
            csv += `${nombreAlimento(al)};${al.diasPorSemana};${al.vecesPorDia};${al.porcionesPorComida};${resolverCalcioPorcion(al) || al.calcioPorcion}\r\n`;
        });

        const encodedUri = encodeURI(csv);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `CalD_Risk_Screen_${perfil.grupoEstudio}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    const exportarPDF = () => window.print();

    return (
        <div class="min-h-screen flex flex-col">

            {/* --- ENCABEZADO --- */}
            <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-50 no-print">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20 text-white">
                            <i class="fa-solid fa-bone text-lg"></i>
                        </div>
                        <div>
                            <h1 class="font-bold text-lg leading-tight text-slate-900 dark:text-white flex items-center gap-2">
                                CalD Risk Screen
                                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">CARDA v2.7</span>
                            </h1>
                            <p class="text-xs text-slate-500 dark:text-slate-400">{t('app_subtitle')}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 sm:gap-4">
                        {IDIOMAS_PUBLICADOS.length > 1 && (
                            <select value={lang} onChange={(e) => cambiarIdioma(e.target.value)}
                                title="Idioma / Language"
                                class="px-2 py-2 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-0 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer">
                                {IDIOMAS_PUBLICADOS.map(l => (
                                    <option key={l.id} value={l.id}>{l.bandera} {l.nombre}</option>
                                ))}
                            </select>
                        )}
                        <button onClick={() => setDarkMode(!darkMode)} class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Alternar Tema">
                            <i class={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
                        </button>
                        <button onClick={exportarPDF} class="hidden lg:flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-900">
                            <i class="fa-solid fa-file-pdf"></i> {t('print_report')}
                        </button>
                        <button onClick={imprimirHojaParticipante} class="hidden lg:flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                            <i class="fa-solid fa-hand-holding-heart"></i> {t('handout_button')}
                        </button>
                        <button onClick={exportarExcel} class="hidden lg:flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                            <i class="fa-solid fa-file-csv"></i> {t('export_csv')}
                        </button>
                    </div>
                </div>
            </header>

            <main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

                <div class="mb-8 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl flex items-start gap-4">
                    <div class="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg shrink-0"><i class="fa-solid fa-circle-info text-lg"></i></div>
                    <div>
                        <h4 class="font-semibold text-blue-800 dark:text-blue-300 text-sm">{t('methodology_title')}</h4>
                        <p class="text-xs text-blue-700/85 dark:text-blue-400 mt-1 leading-relaxed">{t('methodology_desc')}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* ===================== COLUMNA IZQUIERDA: INPUTS ===================== */}
                    <section class="lg:col-span-5 flex flex-col gap-8 no-print">


                        {/* CARD: IDENTIFICACIÓN DEL PARTICIPANTE Y REGISTRO */}
                        <div class="bg-white dark:bg-slate-900 border-2 border-brand-300 dark:border-brand-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fa-solid fa-id-card text-brand-600"></i> {t('registry_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('registry_desc')}</p>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('registry_code')}</label>
                                    <input type="text" placeholder={t('registry_code_placeholder')} value={participante.codigo}
                                        onChange={(e) => handleParticipanteChange('codigo', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('registry_date')}</label>
                                    <input type="date" value={participante.fecha}
                                        onChange={(e) => handleParticipanteChange('fecha', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('registry_notes')}</label>
                                    <input type="text" placeholder={t('registry_notes_placeholder')} value={participante.notas}
                                        onChange={(e) => handleParticipanteChange('notas', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-800 dark:text-slate-100" />
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-2 mt-4">
                                <button onClick={guardarEnRegistro} class="flex-1 min-w-[130px] px-3 py-2 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-floppy-disk"></i> {t('registry_save')}
                                </button>
                                <button onClick={exportarRegistroCompleto} disabled={registroAcumulado.length === 0}
                                    class="flex-1 min-w-[130px] px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-file-csv"></i> {t('registry_export').replace('{n}', registroAcumulado.length)}
                                </button>
                            </div>
                            {registroAcumulado.length > 0 && (
                                <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{t('registry_saved_list').replace('{n}', registroAcumulado.length)}</p>
                                    <div class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                        {registroAcumulado.map(r => (
                                            <span key={r.codigo} class="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                                                {r.codigo}
                                                <button onClick={() => quitarDelRegistro(r.codigo)} class="text-rose-400 hover:text-rose-600"><i class="fa-solid fa-xmark"></i></button>
                                            </span>
                                        ))}
                                    </div>
                                    <p class="text-[10px] text-amber-600 dark:text-amber-400 mt-2 leading-relaxed">{t('registry_volatile_warning')}</p>
                                </div>
                            )}
                        </div>

                        {/* CARD: PERFIL */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2"><i class="fa-solid fa-user text-brand-600"></i> {t('profile_title')}</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('profile_age')}</label>
                                    <input type="number" min="0" max="120" value={perfil.edad} onChange={(e) => handlePerfilChange('edad', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('profile_sex')}</label>
                                    <select value={perfil.sexo} onChange={(e) => handlePerfilChange('sexo', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        <option value="femenino">{t('sex_female')}</option>
                                        <option value="masculino">{t('sex_male')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('profile_weight')}</label>
                                    <input type="number" min="0" step="0.5" value={perfil.pesoKg} onChange={(e) => handlePerfilChange('pesoKg', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('profile_height')}</label>
                                    <input type="number" min="0" step="0.5" value={perfil.tallaCm} onChange={(e) => handlePerfilChange('tallaCm', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('profile_calf')}</label>
                                    <input type="number" min="0" step="0.5" placeholder={t('profile_calf_placeholder')} value={perfil.circunferenciaPantorrilla}
                                        onChange={(e) => handlePerfilChange('circunferenciaPantorrilla', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('select_diet')}</label>
                                    <select value={perfil.grupoEstudio} onChange={(e) => handleGrupoEstudioChange(e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        <option value="Vegano">{t('diet_vegan')}</option>
                                        <option value="Ovolactovegetariano">{t('diet_ovolacto')}</option>
                                        <option value="Flexitariano">{t('diet_flexi')}</option>
                                        <option value="Omnívoro">{t('diet_omni')}</option>
                                    </select>
                                </div>
                                <div class="flex flex-col justify-end gap-1.5">
                                    <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        <input type="checkbox" checked={perfil.fuma} onChange={(e) => handlePerfilChange('fuma', e.target.checked)} class="rounded accent-brand-600" /> {t('profile_smokes')}
                                    </label>
                                    <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        <input type="checkbox" checked={perfil.alcoholFrecuente} onChange={(e) => handlePerfilChange('alcoholFrecuente', e.target.checked)} class="rounded accent-brand-600" /> {t('profile_alcohol')}
                                    </label>
                                </div>

                            </div>
                        </div>

                        {/* CARD: EJERCICIO */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fa-solid fa-dumbbell text-brand-600"></i> {t('exercise_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('exercise_desc')}</p>
                            <div class="space-y-3">
                                <div class="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                    <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('exercise_aerobic_label')}</label>
                                    <p class="text-[10px] text-slate-400 mb-2">{t('exercise_aerobic_examples')}</p>
                                    <div class="flex items-center gap-2">
                                        <input type="number" min="0" max="40" step="0.5" value={ejercicio.horasAerobicoSemana}
                                            onChange={(e) => handleEjercicioChange('horasAerobicoSemana', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                            class="w-24 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                        <span class="text-xs text-slate-500">{t('exercise_hours_week')}</span>
                                    </div>
                                </div>
                                <div class="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                    <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">{t('exercise_strength_label')}</label>
                                    <p class="text-[10px] text-slate-400 mb-2">{t('exercise_strength_examples')}</p>
                                    <div class="grid grid-cols-2 gap-2">
                                        <div class="flex items-center gap-2">
                                            <input type="number" min="0" max="7" value={ejercicio.diasFuerzaSemana}
                                                onChange={(e) => handleEjercicioChange('diasFuerzaSemana', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                class="w-16 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                            <span class="text-xs text-slate-500">{t('exercise_days_week')}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <input type="number" min="0" max="20" step="0.5" value={ejercicio.horasFuerzaSemana}
                                                onChange={(e) => handleEjercicioChange('horasFuerzaSemana', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                class="w-16 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                            <span class="text-xs text-slate-500">{t('exercise_hours_week')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between text-xs font-bold text-slate-500 pt-1">
                                    <span>{t('exercise_total_label')}</span>
                                    <span class="text-brand-600 dark:text-brand-400">{resultadoEjercicio.horasTotalesSemana} {t('exercise_hours_week')}</span>
                                </div>
                            </div>
                        </div>

                        {/* CARD: SUPLEMENTACIÓN DE CALCIO */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fa-solid fa-pills text-brand-600"></i> {t('supp_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('supp_desc')}</p>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('supp_type_label')}</label>
                                    <select value={suplementoCalcio.tipoId} onChange={(e) => handleSuplementoCalcioChange('tipoId', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        <option value="ninguno">{t('supp_none')}</option>
                                        <option value="carbonato">{t('supp_type_carbonate')}</option>
                                        <option value="citrato">{t('supp_type_citrate')}</option>
                                        <option value="otro">{t('supp_type_other')}</option>
                                    </select>
                                </div>
                                {suplementoCalcio.tipoId !== 'ninguno' && (
                                    <div class="grid grid-cols-3 gap-2">
                                        <div>
                                            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('supp_mg_day')}</label>
                                            <input type="number" min="0" step="50" value={suplementoCalcio.mgPorDia}
                                                onChange={(e) => handleSuplementoCalcioChange('mgPorDia', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100" />
                                        </div>
                                        <div>
                                            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('supp_times_day')}</label>
                                            <select value={suplementoCalcio.vecesPorDia} onChange={(e) => handleSuplementoCalcioChange('vecesPorDia', parseInt(e.target.value))}
                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100">
                                                <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('supp_days_week')}</label>
                                            <select value={suplementoCalcio.diasPorSemana} onChange={(e) => handleSuplementoCalcioChange('diasPorSemana', parseInt(e.target.value))}
                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100">
                                                {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                                {suplementoCalcio.tipoId === 'citrato' && (
                                    <p class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{t('supp_citrate_note')}</p>
                                )}

                                <div class="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800">
                                    <h4 class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('modifiers_title')}</h4>
                                    <label class="flex items-start gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-3">
                                        <input type="checkbox" checked={modificadores.usaIBP} onChange={(e) => handleModificadorChange('usaIBP', e.target.checked)} class="rounded accent-brand-600 mt-0.5" />
                                        <span>{t('modifier_ppi')}</span>
                                    </label>
                                    {calcioConModificadores.alertaIBPCarbonato && (
                                        <p class="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mb-3 leading-relaxed">{t('alert_ppi_carbonate')}</p>
                                    )}
                                    <div class="grid grid-cols-2 gap-2">
                                        <div>
                                            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('modifier_sodium')}</label>
                                            <select value={modificadores.nivelSodio} onChange={(e) => handleModificadorChange('nivelSodio', e.target.value)}
                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                <option value="bajo">{t('sodium_low')}</option>
                                                <option value="medio">{t('sodium_medium')}</option>
                                                <option value="alto">{t('sodium_high')}</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('modifier_coffee')}</label>
                                            <input type="number" min="0" max="15" value={modificadores.tazasCafeDia}
                                                onChange={(e) => handleModificadorChange('tazasCafeDia', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100" />
                                        </div>
                                    </div>
                                    {calcioConModificadores.perdidas.perdidaTotal > 0 && (
                                        <p class="text-[10px] text-slate-500 mt-2 leading-relaxed">{t('modifier_losses').replace('{total}', calcioConModificadores.perdidas.perdidaTotal).replace('{na}', calcioConModificadores.perdidas.perdidaSodio).replace('{caf}', calcioConModificadores.perdidas.perdidaCafeina)}</p>
                                    )}
                                </div>
                            </div>
                        </div>


                        {/* CARD: SUPLEMENTACIÓN DE VITAMINA D */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fa-solid fa-capsules text-brand-600"></i> {t('vitd_supp_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('vitd_supp_desc')}</p>

                            <div class="space-y-3">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('vitd_supp_form_label')}</label>
                                    <select value={suplementoVitD.forma} onChange={(e) => handleSuplementoVitDChange('forma', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        <option value="ninguna">{t('vitd_supp_none')}</option>
                                        {FORMAS_SUPLEMENTO_VITD.map(f => <option key={f.id} value={f.id}>{t(f.key)}</option>)}
                                    </select>
                                </div>

                                {suplementoVitD.forma !== 'ninguna' && (
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('vitd_supp_ui_day')}</label>
                                            <input type="text" inputMode="decimal" placeholder={t('vitd_supp_ui_placeholder')} value={suplementoVitD.uiPorDia}
                                                onChange={(e) => handleSuplementoVitDChange('uiPorDia', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100" />
                                            {parseFloat(suplementoVitD.uiPorDia) > 0 && (
                                                <p class="text-[10px] text-slate-400 mt-1">{t('vitd_supp_equals_mcg').replace('{mcg}', Math.round((parseFloat(suplementoVitD.uiPorDia) / 40) * 10) / 10)}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('supp_days_week')}</label>
                                            <select value={suplementoVitD.diasPorSemana} onChange={(e) => handleSuplementoVitDChange('diasPorSemana', parseInt(e.target.value))}
                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {suplementoVitD.forma === 'D2' && (
                                    <p class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-relaxed">{t('vitd_supp_d2_note')}</p>
                                )}
                                {suplementoVitD.forma === 'desconocida' && (
                                    <p class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-relaxed">{t('vitd_supp_unknown_note')}</p>
                                )}
                                {suplementoVitD.forma !== 'ninguna' && parseFloat(suplementoVitD.uiPorDia) > 0 && (
                                    <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {t('vitd_supp_contribution')
                                                .replace('{ui}', Math.round(resultadoVitDDieta.suplEq * 40))
                                                .replace('{mcg}', resultadoVitDDieta.suplEq)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CARD: SUPLEMENTOS DE ENTRENAMIENTO (creatina y proteína en polvo) */}
                        {/* Variables de control para el estudio, no alimentan el motor CARDA. */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fa-solid fa-dumbbell text-brand-600"></i> {t('training_supp_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('training_supp_desc')}</p>
                            <div class="space-y-3">
                                <div>
                                    <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                        <input type="checkbox" checked={suplementosEntrenamiento.creatina}
                                            onChange={(e) => handleSuplementoEntrenamientoChange('creatina', e.target.checked)}
                                            class="rounded accent-brand-600" /> {t('training_supp_creatine')}
                                    </label>
                                    {suplementosEntrenamiento.creatina && (
                                        <div class="flex items-center gap-2 mt-1 pl-6">
                                            <input type="number" min="0" step="0.5" value={suplementosEntrenamiento.creatinaGramosDia}
                                                onChange={(e) => handleSuplementoEntrenamientoChange('creatinaGramosDia', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                class="w-20 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100" />
                                            <span class="text-[10px] text-slate-500">{t('training_supp_g_day')}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                        <input type="checkbox" checked={suplementosEntrenamiento.proteinaPolvoEntrenamiento}
                                            onChange={(e) => handleSuplementoEntrenamientoChange('proteinaPolvoEntrenamiento', e.target.checked)}
                                            class="rounded accent-brand-600" /> {t('training_supp_protein')}
                                    </label>
                                    {suplementosEntrenamiento.proteinaPolvoEntrenamiento && (
                                        <div class="flex items-center gap-2 mt-1 pl-6">
                                            <input type="number" min="0" step="1" value={suplementosEntrenamiento.proteinaPolvoEntrenamientoGramosDia}
                                                onChange={(e) => handleSuplementoEntrenamientoChange('proteinaPolvoEntrenamientoGramosDia', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                class="w-20 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100" />
                                            <span class="text-[10px] text-slate-500">{t('training_supp_g_day')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* CARD: EXPOSICIÓN SOLAR */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fa-solid fa-sun text-brand-600"></i> {t('solar_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('solar_desc')}</p>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('solar_days_week')}</label>
                                    <select value={exposicionSolar.diasPorSemana} onChange={(e) => handleExposicionChange('diasPorSemana', parseInt(e.target.value))}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('solar_minutes')}</label>
                                    <input type="number" min="0" max="180" value={exposicionSolar.minutosPorSesion}
                                        onChange={(e) => handleExposicionChange('minutosPorSesion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('solar_schedule')}</label>
                                    <select value={exposicionSolar.horario} onChange={(e) => handleExposicionChange('horario', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        <option value="pico">{t('solar_schedule_peak')}</option>
                                        <option value="no_pico">{t('solar_schedule_offpeak')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('solar_body_surface')}</label>
                                    <select value={exposicionSolar.superficieCorporal} onChange={(e) => handleExposicionChange('superficieCorporal', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        <option value="minima">{t('solar_surface_minimal')}</option>
                                        <option value="parcial">{t('solar_surface_partial')}</option>
                                        <option value="amplia">{t('solar_surface_wide')}</option>
                                    </select>
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('solar_phototype')}</label>
                                    <select value={exposicionSolar.fototipo} onChange={(e) => handleExposicionChange('fototipo', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        <option value="I">{t('phototype_I')}</option>
                                        <option value="II">{t('phototype_II')}</option>
                                        <option value="III">{t('phototype_III')}</option>
                                        <option value="IV">{t('phototype_IV')}</option>
                                        <option value="V">{t('phototype_V')}</option>
                                        <option value="VI">{t('phototype_VI')}</option>
                                    </select>
                                </div>
                            </div>
                            <p class="text-[10px] text-slate-400 mt-3 italic">{t('solar_no_sunscreen_note')}</p>
                        </div>

                        {/* CARD: SARC-F */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2"><i class="fa-solid fa-person-walking text-brand-600"></i> {t('sarcf_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('sarcf_desc')}</p>
                            <div class="space-y-4">
                                {PREGUNTAS_SARC_F.map(pregunta => (
                                    <div key={pregunta.id}>
                                        <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{t(pregunta.nombreKey)}</label>
                                        <select value={respuestasSarcF[pregunta.id] ?? ''} onChange={(e) => handleSarcFChange(pregunta.id, parseInt(e.target.value))}
                                            class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 dark:text-slate-100">
                                            <option value="" disabled>{t('sarcf_select_placeholder')}</option>
                                            {pregunta.opciones.map(op => <option key={op.valor} value={op.valor}>{t(op.key)}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>


                        {/* CARD: CUESTIONARIO ÚNICO DE FRECUENCIA DE CONSUMO */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fa-solid fa-utensils text-brand-600"></i> {t('ffq_unified_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('ffq_unified_subtitle')}</p>

                            {GRUPOS_ALIMENTOS.map(grupo => {
                                const delGrupo = alimentosFiltrados.filter(a => a.grupoKey === grupo.id);
                                const extraDelGrupo = grupo.id === 'group_custom' ? alimentosExtra : [];
                                if (delGrupo.length === 0 && extraDelGrupo.length === 0 && grupo.id !== 'group_custom') return null;

                                return (
                                    <div key={grupo.id} class="mb-5">
                                        <h4 class="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100 dark:border-slate-800">{t(grupo.key)}</h4>
                                        <div class="space-y-3">
                                            {delGrupo.map(al => (
                                                <div key={al.id} class="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                                    <div class="flex items-start gap-2 mb-2">
                                                        <i class={`${al.icono} text-brand-600 dark:text-brand-400 w-4 text-center mt-0.5`}></i>
                                                        <div class="flex-1 min-w-0">
                                                            <span class="text-sm font-bold text-slate-700 dark:text-slate-200 block leading-tight">{t(al.nombreKey)}</span>
                                                            <span class="text-[10px] text-slate-400">{t('ffq_portion')} {t(al.porcionUnidadKey)}</span>
                                                        </div>
                                                    </div>

                                                    {al.ayudaKey && <p class="text-[10px] text-slate-400 mb-2 leading-relaxed">{t(al.ayudaKey)}</p>}
                                                    {al.advertenciaKey && <p class="text-[10px] text-amber-600 dark:text-amber-400 mb-2 leading-relaxed font-semibold">{t(al.advertenciaKey)}</p>}

                                                    {/* Frecuencia */}
                                                    <div class="grid grid-cols-3 gap-2 mb-2">
                                                        <div>
                                                            <label class="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_days_week')}</label>
                                                            <select value={al.diasPorSemana} onChange={(e) => handleAlimentoChange(al.id, 'diasPorSemana', parseInt(e.target.value))}
                                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                                <option value={0}>{t('ffq_no_consume')}</option>
                                                                {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label class="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_times_day')}</label>
                                                            <select value={al.vecesPorDia} onChange={(e) => handleAlimentoChange(al.id, 'vecesPorDia', parseInt(e.target.value))} disabled={al.diasPorSemana === 0}
                                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                                {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label class="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_portions')}</label>
                                                            <select value={al.porcionesPorComida} onChange={(e) => handleAlimentoChange(al.id, 'porcionesPorComida', parseFloat(e.target.value))} disabled={al.diasPorSemana === 0}
                                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                                {[0.5,1,1.5,2,2.5,3,4].filter(p => p <= (al.maxPorciones || 4)).map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Aporte declarado: los tres nutrientes, todos editables */}
                                                    {al.diasPorSemana > 0 && (
                                                        <div class="pt-2 border-t border-slate-100 dark:border-slate-800">
                                                            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('ffq_contributes_per_portion')}</p>
                                                            <div class="grid grid-cols-4 gap-1.5">
                                                                <div>
                                                                    <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_calcium_mg')}</label>
                                                                    <input type="text" inputMode="decimal" value={al.calcioPorcion}
                                                                        onChange={(e) => handleAlimentoChange(al.id, 'calcioPorcion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                                        class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                                </div>
                                                                <div>
                                                                    <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_vitd_mcg')}</label>
                                                                    <input type="text" inputMode="decimal" value={al.vitDPorcion}
                                                                        onChange={(e) => handleAlimentoChange(al.id, 'vitDPorcion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                                        class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                                </div>
                                                                <div>
                                                                    <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_protein_g')}</label>
                                                                    <input type="text" inputMode="decimal" value={al.proteinaPorcion}
                                                                        onChange={(e) => handleAlimentoChange(al.id, 'proteinaPorcion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                                        class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                                </div>
                                                                <div>
                                                                    <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_grams')}</label>
                                                                    <input type="text" inputMode="decimal" value={al.gramosPorcion}
                                                                        onChange={(e) => handleAlimentoChange(al.id, 'gramosPorcion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                                        class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {/* Alimentos agregados por el evaluador */}
                                            {extraDelGrupo.map(al => (
                                                <div key={al.id} class="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/10">
                                                    <div class="flex items-center gap-2 mb-2">
                                                        <i class="fa-solid fa-tag text-brand-600 dark:text-brand-400 w-4 text-center"></i>
                                                        <input type="text" placeholder={t('ffq_custom_name_placeholder')} value={al.nombrePersonalizado}
                                                            onChange={(e) => handleAlimentoExtraChange(al.id, 'nombrePersonalizado', e.target.value)}
                                                            class="text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 flex-1 min-w-0 text-slate-800 dark:text-slate-100" />
                                                        <button onClick={() => quitarAlimentoExtra(al.id)} class="text-rose-500 hover:text-rose-700 shrink-0" title={t('ffq_remove_custom')}><i class="fa-solid fa-trash-can"></i></button>
                                                    </div>
                                                    <div class="grid grid-cols-3 gap-2 mb-2">
                                                        <div>
                                                            <label class="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_days_week')}</label>
                                                            <select value={al.diasPorSemana} onChange={(e) => handleAlimentoExtraChange(al.id, 'diasPorSemana', parseInt(e.target.value))}
                                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                                <option value={0}>{t('ffq_no_consume')}</option>
                                                                {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label class="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_times_day')}</label>
                                                            <select value={al.vecesPorDia} onChange={(e) => handleAlimentoExtraChange(al.id, 'vecesPorDia', parseInt(e.target.value))} disabled={al.diasPorSemana === 0}
                                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                                {[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label class="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_portions')}</label>
                                                            <select value={al.porcionesPorComida} onChange={(e) => handleAlimentoExtraChange(al.id, 'porcionesPorComida', parseFloat(e.target.value))} disabled={al.diasPorSemana === 0}
                                                                class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                                {[0.5,1,1.5,2,3,4].map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div class="pt-2 border-t border-amber-200/50 dark:border-amber-900/50">
                                                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t('ffq_contributes_per_portion')}</p>
                                                        <div class="grid grid-cols-4 gap-1.5">
                                                            <div>
                                                                <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_calcium_mg')}</label>
                                                                <input type="text" inputMode="decimal" value={al.calcioPorcion}
                                                                    onChange={(e) => handleAlimentoExtraChange(al.id, 'calcioPorcion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                                    class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                            </div>
                                                            <div>
                                                                <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_vitd_mcg')}</label>
                                                                <input type="text" inputMode="decimal" value={al.vitDPorcion}
                                                                    onChange={(e) => handleAlimentoExtraChange(al.id, 'vitDPorcion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                                    class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                            </div>
                                                            <div>
                                                                <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_protein_g')}</label>
                                                                <input type="text" inputMode="decimal" value={al.proteinaPorcion}
                                                                    onChange={(e) => handleAlimentoExtraChange(al.id, 'proteinaPorcion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                                    class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                            </div>
                                                            <div>
                                                                <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_grams')}</label>
                                                                <input type="text" inputMode="decimal" value={al.gramosPorcion}
                                                                    onChange={(e) => handleAlimentoExtraChange(al.id, 'gramosPorcion', limpiarNumero(e.target.value))} onFocus={alEnfocarNumero}
                                                                    class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                            </div>
                                                        </div>
                                                        <div class="mt-2">
                                                            <label class="block text-[9px] text-slate-400 mb-0.5">{t('ffq_vitd_form')}</label>
                                                            <select value={al.formaVitD || 'D3'} onChange={(e) => handleAlimentoExtraChange(al.id, 'formaVitD', e.target.value)}
                                                                class="w-full text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100">
                                                                <option value="D3">{t('vitd_form_d3')}</option>
                                                                <option value="D2">{t('vitd_form_d2')}</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {grupo.id === 'group_custom' && (
                                                <button onClick={agregarAlimentoExtra} class="w-full text-xs font-bold text-brand-600 dark:text-brand-400 border border-dashed border-brand-300 dark:border-brand-800 rounded-xl py-2 hover:bg-brand-50 dark:hover:bg-brand-950/20 flex items-center justify-center gap-2">
                                                    <i class="fa-solid fa-plus"></i> {t('ffq_add_custom')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Qué mide este cuestionario */}
                            <div class="mt-4 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
                                <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{t('ffq_measures_title')}</p>
                                <div class="grid grid-cols-3 gap-2">
                                    <div class="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/30 text-center">
                                        <p class="text-[9px] text-slate-400 uppercase tracking-wider">{t('ffq_calcium_label')}</p>
                                        <p class="text-sm font-extrabold text-slate-700 dark:text-slate-200">{resultadosCalcio.promedioIngeridoSemanal}<span class="text-[10px] font-semibold"> mg/d</span></p>
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/30 text-center">
                                        <p class="text-[9px] text-slate-400 uppercase tracking-wider">{t('ffq_vitd_label')}</p>
                                        <p class="text-sm font-extrabold text-slate-700 dark:text-slate-200">{resultadoVitDDieta.dietaEq}<span class="text-[10px] font-semibold"> mcg/d</span></p>
                                    </div>
                                    <div class="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/30 text-center">
                                        <p class="text-[9px] text-slate-400 uppercase tracking-wider">{t('ffq_protein_label')}</p>
                                        <p class="text-sm font-extrabold text-slate-700 dark:text-slate-200">{resultadoProteina.gramosDia}<span class="text-[10px] font-semibold"> g/d</span></p>
                                    </div>
                                </div>
                                <p class="text-[10px] text-slate-400 mt-2 leading-relaxed">{t('ffq_measures_note')}</p>
                            </div>
                        </div>

                    </section>

                    {/* ===================== COLUMNA DERECHA: RESULTADOS ===================== */}
                    <section class="lg:col-span-7 flex flex-col gap-8">

                        {/* DASHBOARD DE MÉTRICAS — CALCIO */}
                        <div>
                            {/* Selector de organismo: gobierna toda la herramienta */}
                            <div class="flex flex-wrap items-center gap-2 mb-4">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">{t('framework_evaluate_by')}</span>
                                {[{ id: 'IOM', key: 'frameworks_iom_name' }, { id: 'EFSA', key: 'frameworks_efsa_name' }, { id: 'EPIC', key: 'frameworks_epic_name' }].map(m => (
                                    <button key={m.id} onClick={() => setMarcoReferencia(m.id)}
                                        class={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${marcoReferencia === m.id
                                            ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'}`}>
                                        {t(m.key)}
                                    </button>
                                ))}
                            </div>

                            {marcoReferencia === 'EPIC' && (
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed p-2 rounded-lg bg-slate-50 dark:bg-slate-950/30">{t('framework_epic_base_note')}</p>
                            )}

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                {/* 1. Promedio de ingesta diaria */}
                                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('metrics_daily_intake')}</span>
                                        <h2 class="text-4xl font-extrabold text-slate-800 dark:text-white mt-2">{resultadosCalcio.promedioIngeridoSemanal} <span class="text-lg font-semibold">mg</span></h2>
                                    </div>
                                    <div class="mt-4">
                                        <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                            <div class={`h-2 rounded-full transition-all duration-500 ${metricaIngesta.colorBarra}`} style={{ width: `${Math.min(100, metricaIngesta.porcentaje)}%` }}></div>
                                        </div>
                                        <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{metricaIngesta.leyenda}</p>
                                    </div>
                                </div>

                                {/* 2. Promedio de calcio absorbido */}
                                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('metrics_daily_absorbed')}</span>
                                        <h2 class="text-4xl font-extrabold text-slate-800 dark:text-white mt-2">{resultadosCalcio.promedioAbsorbidoSemanal} <span class="text-lg font-semibold">mg</span></h2>
                                        <p class="text-[11px] text-slate-400 mt-1">{t('metrics_efficiency_inline').replace('{pct}', resultadosCalcio.eficienciaGlobal)}</p>
                                    </div>
                                    <div class="mt-4">
                                        <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                            <div class={`h-2 rounded-full transition-all duration-500 ${metricaAbsorbida.colorBarra}`} style={{ width: `${Math.min(100, metricaAbsorbida.porcentaje)}%` }}></div>
                                        </div>
                                        <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{metricaAbsorbida.leyenda}</p>
                                    </div>
                                </div>

                                {/* 3. Días del participante cumplidos */}
                                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('metrics_days_title')}</span>
                                        <div class="flex items-baseline gap-1 mt-2">
                                            <span class="text-4xl font-extrabold text-emerald-500">{resultadosCalcio.diasCumplidos}</span>
                                            <span class="text-sm font-semibold text-slate-400">{t('metrics_days_subtitle')}</span>
                                        </div>
                                    </div>
                                    <div class="mt-4">
                                        <div class="flex gap-1.5">
                                            {resultadosCalcio.reporteDias.map((d, idx) => (
                                                <div key={idx} title={t(d.diaNombreKey)} class={`flex-1 h-3 rounded-full ${d.cumpleMeta ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                                            ))}
                                        </div>
                                        <p class="text-[10px] text-slate-500 mt-1.5 leading-relaxed">{t('metrics_days_note').replace('{meta}', resultadosCalcio.metaAbsorbidaDiaria)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COMPARACIÓN DE MARCOS DE REFERENCIA */}
                        {(
                            <div class="bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-900 rounded-2xl p-5 shadow-sm">
                                <h4 class="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2"><i class="fa-solid fa-scale-balanced text-brand-600"></i> {t('frameworks_title')}</h4>

                                <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">{t('frameworks_intro')}</p>

                                <div class="overflow-x-auto">
                                    <table class="w-full text-[11px]">
                                        <thead>
                                            <tr class="text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                                <th class="text-left py-1.5 font-bold">{t('frameworks_org')}</th>
                                                <th class="text-right py-1.5 font-bold">{t('frameworks_intake_target')}</th>
                                                <th class="text-right py-1.5 font-bold">{t('frameworks_absorbed_target')}</th>
                                                <th class="text-right py-1.5 font-bold">{t('frameworks_your_result')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {comparacionMarcos.map(m => (
                                                <tr key={m.id} class={`border-b border-slate-100 dark:border-slate-800/60 ${m.esActual ? 'bg-brand-50/60 dark:bg-brand-950/20 font-bold' : ''}`}>
                                                    <td class="py-1.5 text-slate-700 dark:text-slate-300">
                                                        {t(m.nombreKey)}
                                                        {m.esActual && <span class="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-brand-600 text-white">{t('frameworks_in_use')}</span>}
                                                    </td>
                                                    <td class="py-1.5 text-right text-slate-600 dark:text-slate-400">{m.rda} mg</td>
                                                    <td class="py-1.5 text-right text-slate-600 dark:text-slate-400">{m.metaAbsorbida} mg</td>
                                                    <td class={`py-1.5 text-right font-bold ${textoColorPorKey[m.colorKey]}`}>{m.razon}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                    <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed"><strong class="text-slate-700 dark:text-slate-300">{t('frameworks_iom_label')}</strong> {t('frameworks_iom_desc')}</p>
                                    <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed"><strong class="text-slate-700 dark:text-slate-300">{t('frameworks_efsa_label')}</strong> {t('frameworks_efsa_desc')}</p>
                                    <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed"><strong class="text-slate-700 dark:text-slate-300">{t('frameworks_epic_label')}</strong> {t('frameworks_epic_desc')}</p>
                                    <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed"><strong class="text-slate-700 dark:text-slate-300">{t('frameworks_absorbed_label')}</strong> {t('frameworks_absorbed_desc')}</p>
                                </div>
                            </div>
                        )}

                        {/* ALERTAS CLÍNICAS ACCIONABLES */}
                        {(resultadosCalcio.alertaFraccionamiento || (perfil.grupoEstudio === 'Vegano' && resultadosCalcio.bajoUmbralEpicOxford) || resultadoVitDDieta.proporcionD2 > 50 || resultadoVitDDieta.excedeUL) && (
                            <div class="flex flex-col gap-2">
                                {perfil.grupoEstudio === 'Vegano' && resultadosCalcio.bajoUmbralEpicOxford && (
                                    <div class="p-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 flex items-start gap-3">
                                        <i class="fa-solid fa-triangle-exclamation text-rose-500 mt-0.5"></i>
                                        <p class="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{t('alert_epic_oxford')}</p>
                                    </div>
                                )}
                                {resultadosCalcio.alertaFraccionamiento && (
                                    <div class="p-3 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-3">
                                        <i class="fa-solid fa-circle-exclamation text-amber-500 mt-0.5"></i>
                                        <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{t('alert_split_dose')}</p>
                                    </div>
                                )}
                                {resultadoVitDDieta.proporcionD2 > 50 && (
                                    <div class="p-3 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 flex items-start gap-3">
                                        <i class="fa-solid fa-circle-exclamation text-amber-500 mt-0.5"></i>
                                        <p class="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{t('alert_d2_dominant').replace('{pct}', resultadoVitDDieta.proporcionD2)}</p>
                                    </div>
                                )}
                                {resultadoVitDDieta.excedeUL && (
                                    <div class="p-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/20 flex items-start gap-3">
                                        <i class="fa-solid fa-triangle-exclamation text-rose-500 mt-0.5"></i>
                                        <p class="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{t('alert_vitd_ul').replace('{ul}', resultadoVitDDieta.ul)}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TRES TARJETAS DE DIAGNÓSTICO */}
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div class={`border p-5 rounded-2xl ${infoRiesgoCalcio.color}`}>
                                <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('diagnostic_calcium_title')}</span>
                                <h3 class="text-base font-bold leading-tight mt-1">{infoRiesgoCalcio.clasificacion}</h3>
                                <p class="text-[11px] mt-2 leading-relaxed opacity-90">{infoRiesgoCalcio.descripcion}</p>
                            </div>
                            <div class={`border p-5 rounded-2xl ${infoRiesgoOseo.color}`}>
                                <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('diagnostic_bone_title')}</span>
                                <h3 class="text-base font-bold leading-tight mt-1">{infoRiesgoOseo.clasificacion}</h3>
                                <p class="text-[11px] mt-2 leading-relaxed opacity-90">{infoRiesgoOseo.descripcion}</p>
                                <p class="text-[10px] mt-2 font-bold opacity-75">{t('bone_score_label')} {resultadoOseo.puntaje}/{resultadoOseo.puntajeMaximo}</p>
                            </div>
                            <div class={`border p-5 rounded-2xl ${infoRiesgoSarcopenia.color}`}>
                                <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('diagnostic_sarc_title')}</span>
                                <h3 class="text-base font-bold leading-tight mt-1">{infoRiesgoSarcopenia.clasificacion}</h3>
                                <p class="text-[11px] mt-2 leading-relaxed opacity-90">{infoRiesgoSarcopenia.descripcion}</p>
                                <p class="text-[10px] mt-2 font-bold opacity-75">{t('sarcf_score_label')} {resultadoSarcopenia.puntajeTotal}/10</p>
                            </div>
                        </div>

                        {/* SECCIÓN FINAL: VITAMINA D (solar + dieta/suplemento) */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2"><i class="fa-solid fa-sun text-brand-600"></i> {t('vitd_section_title')}</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class={`border p-4 rounded-xl ${infoSolar.color}`}>
                                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('solar_standard_title')}</span>
                                    <div class="flex items-end justify-between mt-1">
                                        <h4 class="text-base font-bold">{infoSolar.clasificacion}</h4>
                                        <span class="text-2xl font-extrabold opacity-80">{resultadoSolarEstandar.uiPromedioDia}<span class="text-xs font-semibold"> UI/d</span></span>
                                    </div>
                                    <div class="mt-3 pt-2 border-t border-current/10 space-y-1">
                                        <p class="text-[10px] opacity-90">{t('solar_sed_week').replace('{sed}', resultadoSolarEstandar.sedSemanal)}</p>
                                        <p class="text-[10px] opacity-90">{t('solar_med_fraction').replace('{pct}', Math.round(resultadoSolarEstandar.fraccionMEDPorSesion * 100)).replace('{med}', resultadoSolarEstandar.medEnSed)}</p>
                                        {resultadoSolarEstandar.minutosPara1000UI !== null && (
                                            <p class="text-[10px] font-bold opacity-95">{t('solar_minutes_for_1000').replace('{min}', resultadoSolarEstandar.minutosPara1000UI)}</p>
                                        )}
                                        {resultadoSolarEstandar.minutosPara1000UI === null && (
                                            <p class="text-[10px] font-bold opacity-95">{t('solar_expose_more_surface').replace('{max}', resultadoSolarEstandar.uiMaximaAlcanzable)}</p>
                                        )}
                                        {resultadoSolarEstandar.riesgoQuemadura && (
                                            <p class="text-[10px] font-bold text-rose-600 dark:text-rose-400">{t('solar_burn_warning')}</p>
                                        )}
                                        {!resultadoSolarEstandar.riesgoQuemadura && resultadoSolarEstandar.sobreexposicionSinBeneficio && (
                                            <p class="text-[10px] font-bold opacity-95">{t('solar_plateau_warning')}</p>
                                        )}
                                    </div>
                                </div>
                                <div class={`border p-4 rounded-xl ${infoVitDDieta.color}`}>
                                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('vitd_dieta_title')}</span>
                                    <div class="flex items-end justify-between mt-1">
                                        <h4 class="text-base font-bold">{infoVitDDieta.clasificacion}</h4>
                                        <span class="text-2xl font-extrabold opacity-80">{resultadoVitDDieta.totalPromedioDia}<span class="text-xs font-semibold"> /{resultadoVitDDieta.meta}mcg</span></span>
                                    </div>
                                    <p class="text-[10px] mt-2 opacity-75">{t('vitd_dieta_breakdown').replace('{dieta}', resultadoVitDDieta.mcgPromedioDiaDieta).replace('{supp}', resultadoVitDDieta.mcgPromedioDiaSuplemento)}</p>
                                </div>
                            </div>
                        </div>

                        {/* INTERPRETACIÓN DE LABORATORIO */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fa-solid fa-flask text-brand-600"></i> {t('lab_section_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('lab_section_desc')}</p>
                            <div class="mb-4 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('vitd_framework_label')}</label>
                                <select value={marcoVitD} onChange={(e) => setMarcoVitD(e.target.value)}
                                    class="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                    <option value="oseo">{t('vitd_framework_bone')}</option>
                                    <option value="poblacional">{t('vitd_framework_population')}</option>
                                </select>
                                <p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">{t('vitd_framework_note')}</p>
                            </div>

                            {combinacionVitDCalcio && (
                                <div class="mb-4 p-3 rounded-xl border-2 border-rose-400 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 flex items-start gap-3">
                                    <i class="fa-solid fa-triangle-exclamation text-rose-500 mt-0.5"></i>
                                    <p class="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-semibold">
                                        {combinacionVitDCalcio.alerta === 'hipervitaminosis' ? t('alert_vitd_calcium_combo') : t('alert_vitd_toxicity')}
                                    </p>
                                </div>
                            )}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('lab_calcio_label')}</label>
                                    <div class="flex items-center gap-2">
                                        <input type="number" step="0.1" min="0" placeholder={t('lab_calcio_placeholder')} value={labCalcioSerico}
                                            onChange={(e) => setLabCalcioSerico(e.target.value)}
                                            class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                        <span class="text-xs text-slate-400 shrink-0">mg/dL</span>
                                    </div>
                                    {resultadoLabCalcio && <p class={`mt-2 text-xs font-bold ${textoColorPorKey[resultadoLabCalcio.colorKey]}`}>{t(`lab_calcio_${resultadoLabCalcio.categoria}`)}</p>}
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('lab_vitd_label')}</label>
                                    <div class="flex items-center gap-2">
                                        <input type="number" step="0.1" min="0" placeholder={t('lab_vitd_placeholder')} value={labVitaminaD}
                                            onChange={(e) => setLabVitaminaD(e.target.value)}
                                            class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                        <span class="text-xs text-slate-400 shrink-0">ng/mL</span>
                                    </div>
                                    {resultadoLabVitD && (
                                        <div class="mt-2">
                                            <p class={`text-xs font-bold ${textoColorPorKey[resultadoLabVitD.colorKey]}`}>{t(`lab_vitd_${resultadoLabVitD.categoria}`)}</p>
                                            <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{t(`lab_vitd_${resultadoLabVitD.categoria}_nota`)}</p>
                                            {resultadoLabVitD.zonaDeDesacuerdo && !resultadoLabVitD.porEncimaDelRango && (
                                                <p class="text-[10px] text-blue-600 dark:text-blue-400 mt-1.5 leading-relaxed">
                                                    {t('vitd_disagreement_note')
                                                        .replace('{otro}', t(`vitd_framework_${resultadoLabVitD.otroMarcoId === 'oseo' ? 'bone_short' : 'population_short'}`))
                                                        .replace('{cat}', t(`lab_vitd_${resultadoLabVitD.categoriaOtroMarco}`))}
                                                </p>
                                            )}
                                            <p class="text-[10px] text-slate-400 mt-1">{t('vitd_target_range').replace('{min}', resultadoLabVitD.rangoObjetivo.min).replace('{max}', resultadoLabVitD.rangoObjetivo.max)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SEMANA VIRTUAL RECONSTRUIDA */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                                <div>
                                    <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2"><i class="fa-solid fa-calendar-week text-brand-600"></i> {t('week_reconstructed_title')}</h3>
                                    <p class="text-[10px] text-slate-400 mt-1">{t('week_reconstructed_desc')}</p>
                                </div>
                                {Object.keys(manualOverrides).length > 0 && (
                                    <button type="button" onClick={() => { setManualOverrides({}); setSelectedInstance(null); }}
                                        class="text-[10px] font-bold text-rose-500 hover:text-rose-600 border border-rose-200 dark:border-rose-900 rounded-lg px-2 py-1 flex items-center gap-1">
                                        <i class="fa-solid fa-rotate-left"></i> {t('week_reset_all')}
                                    </button>
                                )}
                            </div>

                            <div class="grid grid-cols-1 gap-3">
                                {resultadosCalcio.reporteDias.map((d, dIdx) => (
                                    <div key={dIdx} class={`p-4 rounded-xl border ${d.cumpleMeta ? 'bg-white dark:bg-slate-900 border-emerald-500/30 font-medium' : 'bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-850'} transition-all`}>
                                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                            <div class="flex items-center gap-2">
                                                <span class={`w-2.5 h-2.5 rounded-full ${d.cumpleMeta ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                                                <span class="font-bold text-sm text-slate-800 dark:text-slate-200">{t(d.diaNombreKey)}</span>
                                            </div>
                                            <div class="flex items-center gap-4 text-xs font-semibold">
                                                <span class="text-slate-500 dark:text-slate-400">{t('week_total_ingested')} <strong class="text-slate-700 dark:text-slate-300">{d.totalIngeridoDia} mg</strong></span>
                                                <span class="text-brand-600 dark:text-brand-400">{t('week_realized_abs')} <strong>{d.totalAbsorbidoDia} mg</strong></span>
                                            </div>
                                        </div>
                                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {d.comidas.map((c, cIdx) => {
                                                const esDestinoActivo = draggedInstance !== null || selectedInstance !== null;
                                                return (
                                                    <div key={cIdx} onDragOver={(e) => e.preventDefault()} onDrop={handleDropEnCelda(dIdx, cIdx)} onClick={handleTapCelda(dIdx, cIdx)}
                                                        class={`p-2.5 rounded-lg border transition-all ${esDestinoActivo ? 'border-brand-400 border-dashed bg-brand-50/40 dark:bg-brand-950/10 cursor-pointer' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80'}`}>
                                                        <div class="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase mb-1.5 border-b border-slate-100 dark:border-slate-800/40 pb-1">
                                                            <span>{t(c.nombreKey)}</span>
                                                            <span class="text-brand-600 dark:text-brand-400">Abs: {c.totalAbsorbido}mg</span>
                                                        </div>
                                                        {(c.alimentosConsumidos.length > 0 || c.suplemento) ? (
                                                            <ul class="space-y-1">
                                                                {c.suplemento && (
                                                                    <li class="text-[10px] flex justify-between items-center bg-teal-50 dark:bg-teal-950/50 p-1 rounded border border-teal-500/20 text-teal-800 dark:text-teal-300 font-bold">
                                                                        <span class="truncate pr-1"><i class="fa-solid fa-pills mr-1"></i>{t('suplemento_lbl')}</span>
                                                                        <span class="shrink-0">{c.suplemento.dosis}mg</span>
                                                                    </li>
                                                                )}
                                                                {c.alimentosConsumidos.map((al, alIdx) => {
                                                                    const esSeleccionado = selectedInstance && selectedInstance.foodId === al.id && selectedInstance.occurrenceIndex === al.occurrenceIndex;
                                                                    return (
                                                                        <li key={alIdx} draggable="true" onDragStart={handleDragStart(al.id, al.occurrenceIndex, al.nombreKey)} onDragEnd={handleDragEnd} onClick={handleTapAlimento(al.id, al.occurrenceIndex, al.nombreKey)}
                                                                            class={`text-[10px] flex justify-between items-center p-1 rounded border cursor-grab active:cursor-grabbing ${esSeleccionado ? 'bg-brand-100 dark:bg-brand-900/40 border-brand-500' : al.esManual ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'}`}>
                                                                            <span class="truncate pr-1 flex items-center gap-1">
                                                                                {al.esManual && <i class="fa-solid fa-arrows-up-down-left-right text-amber-500 text-[9px]"></i>}
                                                                                {al.nombreKey ? t(al.nombreKey) : (al.nombreLibre || '—')}
                                                                            </span>
                                                                            <span class="flex items-center gap-1 shrink-0">
                                                                                {Math.round(al.calcioIngerido)}mg
                                                                                {al.esManual && <button onClick={(e) => { e.stopPropagation(); resetearInstancia(al.id, al.occurrenceIndex); }} class="text-amber-500 hover:text-amber-700" title={t('week_reset_one')}><i class="fa-solid fa-xmark"></i></button>}
                                                                            </span>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        ) : (<p class="text-[10px] text-slate-300 dark:text-slate-700 italic">{t('week_empty_meal')}</p>)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* METODOLOGÍA */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2"><i class="fa-solid fa-diagram-project text-brand-600"></i> {t('methodology_section_title')}</h3>
                            <div class="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                <p><strong>{t('methodology_step1_title')}</strong> {t('methodology_step1_desc')}</p>
                                <p><strong>{t('methodology_step2_title')}</strong> {t('methodology_step2_desc')}</p>
                                <p><strong>{t('methodology_step3_title')}</strong> {t('methodology_step3_desc')}</p>
                                <p><strong>{t('methodology_step4_title')}</strong> {t('methodology_step4_desc')}</p>
                                <p><strong>{t('methodology_step5_title')}</strong> {t('methodology_step5_desc')}</p>
                                <p><strong>{t('methodology_step6_title')}</strong> {t('methodology_step6_desc')}</p>
                                <p><strong>{t('methodology_step7_title')}</strong> {t('methodology_step7_desc')}</p>
                            </div>
                        </div>

                        {/* BIBLIOGRAFÍA */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2"><i class="fa-solid fa-book text-brand-600"></i> {t('bibliography_title')}</h3>
                            <ol class="list-decimal list-inside space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                <li>{t('bib_1')}</li>
                                <li>{t('bib_2')}</li>
                                <li>{t('bib_3')}</li>
                                <li>{t('bib_4')}</li>
                                <li>{t('bib_5')}</li>
                                <li>{t('bib_6')}</li>
                                <li>{t('bib_7')}</li>
                                <li>{t('bib_8')}</li>
                                <li>{t('bib_9')}</li>
                                <li>{t('bib_10')}</li>
                                <li>{t('bib_11')}</li>
                            </ol>
                        </div>

                    </section>
                </div>


                {/* HOJA PARA EL PARTICIPANTE (una página, lenguaje sencillo) */}
                <div class="hidden hoja-participante mt-12 p-8 border border-slate-300 rounded-3xl bg-white text-slate-900">
                    <div class="text-center pb-5 border-b-2 border-slate-800">
                        <h1 class="text-xl font-extrabold">{t('handout_title')}</h1>
                        <p class="text-xs text-slate-500 mt-1">{t('handout_subtitle')}</p>
                    </div>

                    <div class="flex justify-between text-xs mt-4 mb-5">
                        <span><strong>{t('handout_code')}</strong> {participante.codigo || '—'}</span>
                        <span><strong>{t('pdf_date_tag')}</strong> {new Date(participante.fecha + 'T12:00:00').toLocaleDateString(lang === 'es' ? 'es-PA' : lang)}</span>
                    </div>

                    <div class="space-y-4">
                        <div class="p-4 border-2 border-slate-300 rounded-2xl">
                            <h2 class="text-sm font-extrabold uppercase tracking-wide mb-2">{t('handout_calcium_heading')}</h2>
                            <p class="text-sm leading-relaxed">
                                {t('handout_calcium_body')
                                    .replace('{ing}', resultadosCalcio.promedioIngeridoSemanal)
                                    .replace('{abs}', resultadosCalcio.promedioAbsorbidoSemanal)
                                    .replace('{meta}', resultadosCalcio.metaAbsorbidaDiaria)}
                            </p>
                            <p class="text-sm font-bold mt-2">{t('handout_result_label')} {infoRiesgoCalcio.clasificacion}</p>
                        </div>

                        <div class="p-4 border-2 border-slate-300 rounded-2xl">
                            <h2 class="text-sm font-extrabold uppercase tracking-wide mb-2">{t('handout_vitd_heading')}</h2>
                            <p class="text-sm leading-relaxed">
                                {t('handout_vitd_body')
                                    .replace('{dieta}', Math.round(resultadoVitDDieta.totalEq * 40))
                                    .replace('{sol}', resultadoSolarEstandar.uiPromedioDia)
                                    .replace('{meta}', resultadoVitDDieta.meta * 40)}
                            </p>
                            {resultadoSolarEstandar.minutosPara1000UI !== null && (
                                <p class="text-sm font-bold mt-2">{t('handout_sun_advice').replace('{min}', resultadoSolarEstandar.minutosPara1000UI)}</p>
                            )}
                        </div>

                        <div class="p-4 border-2 border-slate-300 rounded-2xl">
                            <h2 class="text-sm font-extrabold uppercase tracking-wide mb-2">{t('handout_actions_heading')}</h2>
                            <ul class="text-sm space-y-1.5 leading-relaxed">
                                {resultadosCalcio.razonAdecuacion < 100 && <li>• {t('handout_action_calcium')}</li>}
                                {resultadosCalcio.bajoUmbralEpicOxford && perfil.grupoEstudio === 'Vegano' && <li>• {t('handout_action_vegan')}</li>}
                                {resultadosCalcio.alertaFraccionamiento && <li>• {t('handout_action_split')}</li>}
                                {calcioConModificadores.alertaIBPCarbonato && <li>• {t('handout_action_ppi')}</li>}
                                {categoriaSolar.cat !== 'bajo' && <li>• {t('handout_action_sun')}</li>}
                                {resultadoVitDDieta.proporcionD2 > 50 && <li>• {t('handout_action_d3')}</li>}
                                {!resultadoEjercicio.cumpleFuerza && <li>• {t('handout_action_strength')}</li>}
                                {!resultadoEjercicio.cumpleAerobico && <li>• {t('handout_action_aerobic')}</li>}
                                {resultadoSarcopenia.categoria !== 'bajo' && <li>• {t('handout_action_sarcopenia')}</li>}
                                {resultadosCalcio.razonAdecuacion >= 100 && categoriaSolar.cat === 'bajo' && resultadoEjercicio.cumpleAmbas && <li>• {t('handout_action_keep_it_up')}</li>}
                            </ul>
                        </div>
                    </div>

                    <div class="mt-6 pt-4 border-t-2 border-slate-800">
                        <p class="text-[11px] leading-relaxed font-bold">{t('handout_disclaimer')}</p>
                        <p class="text-[10px] text-slate-500 mt-3">{t('handout_footer')}</p>
                    </div>
                </div>

                {/* SECCIÓN EXCLUSIVA PARA IMPRESIÓN / PDF */}
                <div class="hidden print-only mt-12 p-8 border border-slate-300 rounded-3xl bg-white text-slate-900 space-y-6">
                    <div class="text-center pb-6 border-b border-slate-200">
                        <h1 class="text-2xl font-extrabold text-slate-900">CalD Risk Screen</h1>
                        <p class="text-sm text-slate-500">{t('app_subtitle')}</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>{t('pdf_author_tag')}</strong> MEd Jean Carlos Ruiz Mosley</div>
                        <div><strong>{t('pdf_evaluated_pattern')}</strong> {t(`diet_${perfil.grupoEstudio.toLowerCase()}`)}</div>
                        <div><strong>{t('pdf_age_sex')}</strong> {perfil.edad} / {t(perfil.sexo === 'femenino' ? 'sex_female' : 'sex_male')}</div>
                        <div><strong>{t('pdf_date_tag')}</strong> {new Date().toLocaleDateString(lang === 'es' ? 'es-PA' : lang)}</div>
                    </div>
                    <div class="pt-4 border-t border-slate-200 space-y-3">
                        <h2 class="text-lg font-bold">{t('pdf_results_summary')}</h2>
                        <ul class="space-y-1 text-sm">
                            <li>• {t('pdf_bullet_calcium').replace('{val1}', resultadosCalcio.razonAdecuacion).replace('{val2}', infoRiesgoCalcio.clasificacion)}</li>
                            <li>• {t('pdf_bullet_bone').replace('{val}', infoRiesgoOseo.clasificacion)}</li>
                            <li>• {t('pdf_bullet_sarc').replace('{val}', infoRiesgoSarcopenia.clasificacion)}</li>
                            <li>• {t('pdf_bullet_solar').replace('{val}', infoSolar.clasificacion)}</li>
                            <li>• {t('pdf_bullet_vitd').replace('{val}', infoVitDDieta.clasificacion)}</li>
                        </ul>
                    </div>
                    <p class="pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center">© 2026 Jean Carlos Ruiz Mosley. Todos los derechos reservados. CalD Risk Screen (CARDA v2.7).</p>
                </div>

            </main>

            <footer class="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-900 py-8 text-xs text-slate-500 dark:text-slate-400 no-print">
                <div class="max-w-7xl mx-auto px-4">
                    <div class="text-left max-w-xl space-y-1">
                        <p class="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[10px]">{t('footer_author')}</p>
                        <p class="font-bold text-brand-600 dark:text-brand-400 text-sm">MEd Jean Carlos Ruiz Mosley</p>
                        <p class="text-slate-600 dark:text-slate-300 leading-relaxed">{t('footer_specialist')}</p>
                        <p class="text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 mt-2">{t('footer_license_panama')}</p>
                    </div>
                </div>
            </footer>

        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
