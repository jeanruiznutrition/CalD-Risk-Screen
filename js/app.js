// ============================================================
// CalD Risk Screen — Componente principal de la interfaz (React) v1.1
// Consume: TRANSLATIONS (i18n.js), catálogos de data.js y las
// funciones del motor CARDA (algorithm.js).
// ============================================================

const { useState, useEffect, useMemo } = React;

let contadorFortificadoExtra = 0;
const nuevoAlimentoFortificadoExtra = () => {
    contadorFortificadoExtra += 1;
    return {
        ...PLANTILLA_ALIMENTO_FORTIFICADO_EXTRA,
        id: `fortificado_extra_${contadorFortificadoExtra}`,
        nombrePersonalizado: '',
        diasPorSemana: 0,
        vecesPorDia: 1,
        porcionesPorComida: 1.0
    };
};

function App() {
    const [darkMode, setDarkMode] = useState(false);
    const lang = 'es'; // v1.1: español únicamente.

    // --- Perfil del participante ---
    const [perfil, setPerfil] = useState({
        edad: 30,
        sexo: 'femenino',
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
    const [alimentosFortificadosExtra, setAlimentosFortificadosExtra] = useState([]);

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
    const [fuentesVitD, setFuentesVitD] = useState(
        FUENTES_VITAMINA_D.map(f => ({ ...f, diasPorSemana: 0, vecesPorDia: 1, porcionesPorComida: 1.0 }))
    );
    const [suplementoVitD, setSuplementoVitD] = useState({ mcgPorDia: 0, diasPorSemana: 0 });

    // --- Exposición solar (con fototipo, sin protector solar como variable) ---
    const [exposicionSolar, setExposicionSolar] = useState({
        diasPorSemana: 0,
        minutosPorSesion: 0,
        horario: 'no_pico',
        edadBracket: 'menor_50',
        fototipo: 'III'
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
    const fuentesVitDFiltradas = useMemo(() => filtrarPorDieta(fuentesVitD), [fuentesVitD, perfil.grupoEstudio]);

    // Resuelve el calcioPorcion efectivo (considera unidad alternativa seleccionada)
    const resolverCalcioPorcion = (al) => {
        if (al.unidadesAlternativas) {
            const unidad = al.unidadesAlternativas.find(u => u.key === al.unidadSeleccionada) || al.unidadesAlternativas[0];
            return unidad.calcioPorUnidad;
        }
        return al.calcioPorcion;
    };

    const alimentosParaAlgoritmo = useMemo(() => {
        const base = alimentosFiltrados.map(al => ({ ...al, calcioPorcion: resolverCalcioPorcion(al) }));
        const extra = alimentosFortificadosExtra.map(al => ({ ...al, nombreKey: null, nombreLibre: al.nombrePersonalizado || null }));
        return [...base, ...extra];
    }, [alimentosFiltrados, alimentosFortificadosExtra]);

    // --- Handlers FFQ calcio ---
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

    const handleFortificadoExtraChange = (id, campo, valor) => {
        setAlimentosFortificadosExtra(prev => prev.map(al => (al.id === id ? { ...al, [campo]: valor } : al)));
    };

    const agregarFortificadoExtra = () => {
        setAlimentosFortificadosExtra(prev => [...prev, nuevoAlimentoFortificadoExtra()]);
    };

    const quitarFortificadoExtra = (id) => {
        setAlimentosFortificadosExtra(prev => prev.filter(al => al.id !== id));
    };

    // --- Handlers FFQ vitamina D ---
    const handleFuenteVitDChange = (id, campo, valor) => {
        setFuentesVitD(prev => prev.map(f => (f.id === id ? { ...f, [campo]: valor } : f)));
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
        setFuentesVitD(prev => prev.map(f => {
            const seOculta = (nuevoGrupo === 'Vegano' && f.ocultoEnVegano) || (nuevoGrupo === 'Ovolactovegetariano' && f.ocultoEnOvolacto);
            return seOculta ? { ...f, diasPorSemana: 0, vecesPorDia: 1, porcionesPorComida: 1.0 } : f;
        }));
    };

    const handlePerfilChange = (campo, valor) => setPerfil(prev => ({ ...prev, [campo]: valor }));
    const handleEjercicioChange = (campo, valor) => setEjercicio(prev => ({ ...prev, [campo]: valor }));
    const handleExposicionChange = (campo, valor) => setExposicionSolar(prev => ({ ...prev, [campo]: valor }));
    const handleSarcFChange = (preguntaId, valor) => setRespuestasSarcF(prev => ({ ...prev, [preguntaId]: valor }));
    const handleSuplementoCalcioChange = (campo, valor) => setSuplementoCalcio(prev => ({ ...prev, [campo]: valor }));
    const handleSuplementoVitDChange = (campo, valor) => setSuplementoVitD(prev => ({ ...prev, [campo]: valor }));

    // --- Cálculo reactivo de los módulos ---
    const suplementoCalcioActivo = useMemo(() => (
        suplementoCalcio.tipoId === 'ninguno' ? null : { ...suplementoCalcio, tipoId: suplementoCalcio.tipoId }
    ), [suplementoCalcio]);

    const resultadosCalcio = useMemo(
        () => ejecutarSemanaVirtualCalcio(alimentosParaAlgoritmo, suplementoCalcioActivo, manualOverrides),
        [alimentosParaAlgoritmo, suplementoCalcioActivo, manualOverrides]
    );

    const resultadoSolar = useMemo(() => calcularIndiceExposicionSolar(exposicionSolar), [exposicionSolar]);
    const resultadoLabVitD = useMemo(() => interpretar25OHVitaminaD(labVitaminaD), [labVitaminaD]);
    const resultadoLabCalcio = useMemo(() => interpretarCalcioSerico(labCalcioSerico), [labCalcioSerico]);

    const resultadoVitDDieta = useMemo(
        () => calcularAdecuacionVitaminaDDieta(fuentesVitDFiltradas, suplementoVitD, Number(perfil.edad) || 0),
        [fuentesVitDFiltradas, suplementoVitD, perfil.edad]
    );

    const resultadoOseo = useMemo(() => calcularRiesgoOseo({
        porcentajeCumplimientoCalcio: resultadosCalcio.porcentajeCumplimiento,
        categoriaRiesgoSolar: resultadoSolar.categoriaRiesgo,
        edad: Number(perfil.edad) || 0,
        sexo: perfil.sexo,
        diasEjercicioFuerza: Number(ejercicio.diasFuerzaSemana) || 0,
        fuma: perfil.fuma,
        alcoholFrecuente: perfil.alcoholFrecuente
    }), [resultadosCalcio.porcentajeCumplimiento, resultadoSolar.categoriaRiesgo, perfil, ejercicio.diasFuerzaSemana]);

    const resultadoSarcopenia = useMemo(() => calcularRiesgoSarcopenia(respuestasSarcF, {
        proteinaAdecuada: perfil.proteinaAdecuada,
        diasEjercicioFuerza: Number(ejercicio.diasFuerzaSemana) || 0
    }), [respuestasSarcF, perfil.proteinaAdecuada, ejercicio.diasFuerzaSemana]);

    const resultadoEjercicio = useMemo(() => calcularAdherenciaEjercicio({
        horasAerobicoSemana: Number(ejercicio.horasAerobicoSemana) || 0,
        diasFuerzaSemana: Number(ejercicio.diasFuerzaSemana) || 0,
        horasFuerzaSemana: Number(ejercicio.horasFuerzaSemana) || 0
    }), [ejercicio]);

    const t = (key) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS['es']?.[key] || key;
    const nombreAlimento = (al) => al.nombreLibre || t(al.nombreKey);

    const clasificarRiesgoCalcio = (pct) => {
        if (pct >= 80) return { clasificacion: t('diag_cal_excellent'), color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/20', descripcion: t('diag_cal_excellent_desc'), severidad: t('diag_sev_low') };
        if (pct >= 50) return { clasificacion: t('diag_cal_moderate'), color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-500/20', descripcion: t('diag_cal_moderate_desc'), severidad: t('diag_sev_mod') };
        return { clasificacion: t('diag_cal_low'), color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-500/20', descripcion: t('diag_cal_low_desc'), severidad: t('diag_sev_high') };
    };
    const infoRiesgoCalcio = clasificarRiesgoCalcio(resultadosCalcio.porcentajeCumplimiento);

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
    const infoSolar = { clasificacion: t(`solar_${resultadoSolar.categoriaRiesgo}`), color: colorClasesPorKey[resultadoSolar.colorKey] };
    const infoVitDDieta = { clasificacion: t(`vitd_dieta_${resultadoVitDDieta.categoria}`), color: colorClasesPorKey[resultadoVitDDieta.colorKey] };

    const exportarExcel = () => {
        let csv = "data:text/csv;charset=utf-8,";
        csv += "CalD Risk Screen - Resultados del Algoritmo CARDA v1.1\r\n";
        csv += "(C) 2026 Jean Carlos Ruiz Mosley - Todos los derechos reservados\r\n";
        csv += `Patron Dietetico;${perfil.grupoEstudio}\r\nEdad;${perfil.edad}\r\nSexo;${perfil.sexo}\r\n\r\n`;
        csv += "MODULO 1: CALCIO\r\n";
        csv += `Cumplimiento Semanal;${resultadosCalcio.porcentajeCumplimiento}%\r\nDias Adecuados;${resultadosCalcio.diasCumplidos}\r\nPromedio Absorbido (mg/dia);${resultadosCalcio.promedioAbsorbidoSemanal}\r\n\r\n`;
        csv += "MODULO 2: VITAMINA D\r\n";
        csv += `Indice de Exposicion Solar;${resultadoSolar.indice} (${resultadoSolar.categoriaRiesgo})\r\n`;
        csv += `Vitamina D dietetica + suplemento (mcg/dia prom.);${resultadoVitDDieta.totalPromedioDia} / meta ${resultadoVitDDieta.meta}\r\n`;
        if (resultadoLabVitD) csv += `25-OH-Vitamina D serica (ng/mL);${labVitaminaD} (${resultadoLabVitD.categoria})\r\n`;
        if (resultadoLabCalcio) csv += `Calcio serico total (mg/dL);${labCalcioSerico} (${resultadoLabCalcio.categoria})\r\n`;
        csv += "\r\nMODULO 3: RIESGO OSEO (orientativo)\r\n";
        csv += `Puntaje;${resultadoOseo.puntaje} / ${resultadoOseo.puntajeMaximo}\r\nCategoria;${resultadoOseo.categoria}\r\n\r\n`;
        csv += "MODULO 4: SARCOPENIA (SARC-F)\r\n";
        csv += `Puntaje;${resultadoSarcopenia.puntajeTotal} / 10\r\nRiesgo probable;${resultadoSarcopenia.riesgoProbable ? 'SI' : 'NO'}\r\n\r\n`;
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
                                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">CARDA v1.1</span>
                            </h1>
                            <p class="text-xs text-slate-500 dark:text-slate-400">{t('app_subtitle')}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 sm:gap-4">
                        <button onClick={() => setDarkMode(!darkMode)} class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Alternar Tema">
                            <i class={`fa-solid ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
                        </button>
                        <button onClick={exportarPDF} class="hidden lg:flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 border border-brand-200 dark:border-brand-900">
                            <i class="fa-solid fa-file-pdf"></i> {t('print_report')}
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

                        {/* CARD: PERFIL */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2"><i class="fa-solid fa-user text-brand-600"></i> {t('profile_title')}</h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('profile_age')}</label>
                                    <input type="number" min="0" max="120" value={perfil.edad} onChange={(e) => handlePerfilChange('edad', e.target.value)}
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
                                <div class="col-span-2">
                                    <label class="flex items-start gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        <input type="checkbox" checked={perfil.proteinaAdecuada} onChange={(e) => handlePerfilChange('proteinaAdecuada', e.target.checked)} class="rounded accent-brand-600 mt-0.5" />
                                        <span>{t('profile_protein_adequate')}</span>
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
                                            onChange={(e) => handleEjercicioChange('horasAerobicoSemana', parseFloat(e.target.value) || 0)}
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
                                                onChange={(e) => handleEjercicioChange('diasFuerzaSemana', parseInt(e.target.value) || 0)}
                                                class="w-16 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                            <span class="text-xs text-slate-500">{t('exercise_days_week')}</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <input type="number" min="0" max="20" step="0.5" value={ejercicio.horasFuerzaSemana}
                                                onChange={(e) => handleEjercicioChange('horasFuerzaSemana', parseFloat(e.target.value) || 0)}
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
                                                onChange={(e) => handleSuplementoCalcioChange('mgPorDia', parseFloat(e.target.value) || 0)}
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
                                        onChange={(e) => handleExposicionChange('minutosPorSesion', parseInt(e.target.value) || 0)}
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
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('solar_age_bracket')}</label>
                                    <select value={exposicionSolar.edadBracket} onChange={(e) => handleExposicionChange('edadBracket', e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        <option value="menor_50">{t('solar_age_under50')}</option>
                                        <option value="entre_50_70">{t('solar_age_50to70')}</option>
                                        <option value="mayor_70">{t('solar_age_over70')}</option>
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

                        {/* CARD: FFQ DE FUENTES DE CALCIO */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fa-solid fa-carrot text-brand-600"></i> {t('ffq_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('ffq_subtitle')}</p>
                            <div class="space-y-4">
                                {alimentosFiltrados.map(al => (
                                    <div key={al.id} class="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                        <div class="flex items-center gap-2 mb-2 flex-wrap">
                                            <i class={`${al.icono} text-brand-600 dark:text-brand-400 w-4 text-center`}></i>
                                            <span class="text-sm font-bold text-slate-700 dark:text-slate-200">{t(al.nombreKey)}</span>
                                            {!al.unidadesAlternativas && !al.editableCalcio && (
                                                <span class="text-[10px] text-slate-400 ml-auto">{t('ffq_portion')} {al.calcioPorcion}mg / {t(al.porcionUnidadKey)}</span>
                                            )}
                                            {al.editableCalcio && (
                                                <div class="flex items-center gap-1 ml-auto">
                                                    <input type="number" min="0" step="10" value={al.calcioPorcion}
                                                        onChange={(e) => handleAlimentoChange(al.id, 'calcioPorcion', parseFloat(e.target.value) || 0)}
                                                        class="w-16 text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                    <span class="text-[10px] text-slate-400">mg / {t(al.porcionUnidadKey)}</span>
                                                </div>
                                            )}
                                        </div>
                                        {al.unidadesAlternativas && (
                                            <div class="flex items-center gap-3 mb-2">
                                                <span class="text-[10px] text-slate-400">{t('ffq_unit_label')}</span>
                                                {al.unidadesAlternativas.map(u => (
                                                    <label key={u.key} class="flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                                                        <input type="radio" name={`unidad_${al.id}`} checked={al.unidadSeleccionada === u.key}
                                                            onChange={() => handleAlimentoChange(al.id, 'unidadSeleccionada', u.key)} class="accent-brand-600" />
                                                        {t(u.labelKey)} ({u.calcioPorUnidad}mg)
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        <div class="grid grid-cols-3 gap-2">
                                            <div>
                                                <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_days_week')}</label>
                                                <select value={al.diasPorSemana} onChange={(e) => handleAlimentoChange(al.id, 'diasPorSemana', parseInt(e.target.value))}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100">
                                                    <option value={0}>{t('ffq_no_consume')}</option>
                                                    {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} {n === 1 ? t('ffq_day') : t('ffq_days')}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_times_day')}</label>
                                                <select value={al.vecesPorDia} onChange={(e) => handleAlimentoChange(al.id, 'vecesPorDia', parseInt(e.target.value))} disabled={al.diasPorSemana === 0}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100">
                                                    <option value={1}>{`1 ${t('ffq_time')}`}</option><option value={2}>{`2 ${t('ffq_times')}`}</option><option value={3}>{`3 ${t('ffq_times')}`}</option>
                                                </select>
                                            </div>
                                            {al.permitePorciones && (
                                                <div>
                                                    <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_portions')}</label>
                                                    <select value={al.porcionesPorComida} onChange={(e) => handleAlimentoChange(al.id, 'porcionesPorComida', parseFloat(e.target.value))} disabled={al.diasPorSemana === 0}
                                                        class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100">
                                                        {Array.from({ length: al.maxPorciones }, (_, i) => i + 1).map(p => (
                                                            <option key={p} value={p}>{p} {p === 1 ? t('ffq_portion_unit') : t('ffq_portions_unit')}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Alimentos fortificados extra (dinámicos) */}
                                {alimentosFortificadosExtra.map(al => (
                                    <div key={al.id} class="p-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/10">
                                        <div class="flex items-center gap-2 mb-2 flex-wrap">
                                            <i class="fa-solid fa-tag text-brand-600 dark:text-brand-400 w-4 text-center"></i>
                                            <input type="text" placeholder={t('ffq_custom_name_placeholder')} value={al.nombrePersonalizado}
                                                onChange={(e) => handleFortificadoExtraChange(al.id, 'nombrePersonalizado', e.target.value)}
                                                class="text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 flex-1 min-w-[120px] text-slate-800 dark:text-slate-100" />
                                            <div class="flex items-center gap-1">
                                                <input type="number" min="0" step="10" value={al.calcioPorcion}
                                                    onChange={(e) => handleFortificadoExtraChange(al.id, 'calcioPorcion', parseFloat(e.target.value) || 0)}
                                                    class="w-16 text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                <span class="text-[10px] text-slate-400">mg/{t('ffq_portion')}</span>
                                            </div>
                                            <button onClick={() => quitarFortificadoExtra(al.id)} class="text-rose-500 hover:text-rose-700" title={t('ffq_remove_custom')}><i class="fa-solid fa-trash-can"></i></button>
                                        </div>
                                        <div class="grid grid-cols-3 gap-2">
                                            <div>
                                                <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_days_week')}</label>
                                                <select value={al.diasPorSemana} onChange={(e) => handleFortificadoExtraChange(al.id, 'diasPorSemana', parseInt(e.target.value))}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                    <option value={0}>{t('ffq_no_consume')}</option>
                                                    {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} {n === 1 ? t('ffq_day') : t('ffq_days')}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_times_day')}</label>
                                                <select value={al.vecesPorDia} onChange={(e) => handleFortificadoExtraChange(al.id, 'vecesPorDia', parseInt(e.target.value))} disabled={al.diasPorSemana === 0}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                    <option value={1}>{`1 ${t('ffq_time')}`}</option><option value={2}>{`2 ${t('ffq_times')}`}</option><option value={3}>{`3 ${t('ffq_times')}`}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_portions')}</label>
                                                <select value={al.porcionesPorComida} onChange={(e) => handleFortificadoExtraChange(al.id, 'porcionesPorComida', parseFloat(e.target.value))} disabled={al.diasPorSemana === 0}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                    {[1,2,3].map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button onClick={agregarFortificadoExtra} class="w-full text-xs font-bold text-brand-600 dark:text-brand-400 border border-dashed border-brand-300 dark:border-brand-800 rounded-xl py-2 hover:bg-brand-50 dark:hover:bg-brand-950/20 flex items-center justify-center gap-2">
                                    <i class="fa-solid fa-plus"></i> {t('ffq_add_custom')}
                                </button>
                            </div>
                        </div>

                        {/* CARD: FFQ DE FUENTES DE VITAMINA D + SUPLEMENTO */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2"><i class="fa-solid fa-sun-plant-wilt text-brand-600"></i> {t('ffq_vitd_title')}</h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('ffq_vitd_subtitle')}</p>

                            <div class="mb-4 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                <label class="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">{t('vitd_supp_label')}</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('vitd_supp_mcg_day')}</label>
                                        <input type="number" min="0" step="5" value={suplementoVitD.mcgPorDia}
                                            onChange={(e) => handleSuplementoVitDChange('mcgPorDia', parseFloat(e.target.value) || 0)}
                                            class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100" />
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('supp_days_week')}</label>
                                        <select value={suplementoVitD.diasPorSemana} onChange={(e) => handleSuplementoVitDChange('diasPorSemana', parseInt(e.target.value))}
                                            class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                            {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-4">
                                {fuentesVitDFiltradas.map(f => (
                                    <div key={f.id} class="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                        <div class="flex items-center gap-2 mb-2 flex-wrap">
                                            <i class={`${f.icono} text-brand-600 dark:text-brand-400 w-4 text-center`}></i>
                                            <span class="text-sm font-bold text-slate-700 dark:text-slate-200">{t(f.nombreKey)}</span>
                                            {!f.editableVitD ? (
                                                <span class="text-[10px] text-slate-400 ml-auto">{f.vitDPorcion}mcg / {t(f.porcionUnidadKey)}</span>
                                            ) : (
                                                <div class="flex items-center gap-1 ml-auto">
                                                    <input type="number" min="0" step="0.5" value={f.vitDPorcion}
                                                        onChange={(e) => handleFuenteVitDChange(f.id, 'vitDPorcion', parseFloat(e.target.value) || 0)}
                                                        class="w-16 text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-1 font-semibold text-slate-800 dark:text-slate-100" />
                                                    <span class="text-[10px] text-slate-400">mcg / {t(f.porcionUnidadKey)}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div class="grid grid-cols-3 gap-2">
                                            <div>
                                                <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_days_week')}</label>
                                                <select value={f.diasPorSemana} onChange={(e) => handleFuenteVitDChange(f.id, 'diasPorSemana', parseInt(e.target.value))}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                    <option value={0}>{t('ffq_no_consume')}</option>
                                                    {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n} {n === 1 ? t('ffq_day') : t('ffq_days')}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_times_day')}</label>
                                                <select value={f.vecesPorDia} onChange={(e) => handleFuenteVitDChange(f.id, 'vecesPorDia', parseInt(e.target.value))} disabled={f.diasPorSemana === 0}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                    <option value={1}>{`1 ${t('ffq_time')}`}</option><option value={2}>{`2 ${t('ffq_times')}`}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_portions')}</label>
                                                <select value={f.porcionesPorComida} onChange={(e) => handleFuenteVitDChange(f.id, 'porcionesPorComida', parseFloat(e.target.value))} disabled={f.diasPorSemana === 0}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold text-slate-800 dark:text-slate-100">
                                                    {[1,2,3].map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </section>

                    {/* ===================== COLUMNA DERECHA: RESULTADOS ===================== */}
                    <section class="lg:col-span-7 flex flex-col gap-8">

                        {/* DASHBOARD DE MÉTRICAS — CALCIO */}
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                                <div class="absolute -right-6 -bottom-6 text-brand-100 dark:text-brand-900/10 text-8xl pointer-events-none font-bold">%</div>
                                <div>
                                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('metrics_compliance')}</span>
                                    <h2 class="text-4xl font-extrabold text-slate-800 dark:text-white mt-2">{resultadosCalcio.porcentajeCumplimiento}%</h2>
                                </div>
                                <div class="mt-4">
                                    <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                        <div class="bg-brand-500 h-2 rounded-full transition-all duration-500" style={{ width: `${resultadosCalcio.porcentajeCumplimiento}%` }}></div>
                                    </div>
                                    <p class="text-[10px] text-slate-500 mt-1.5">{t('metrics_target')}</p>
                                </div>
                            </div>
                            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('metrics_days_title')}</span>
                                    <div class="flex items-baseline gap-1 mt-2">
                                        <span class="text-4xl font-extrabold text-emerald-500">{resultadosCalcio.diasCumplidos}</span>
                                        <span class="text-sm font-semibold text-slate-400">{t('metrics_days_subtitle')}</span>
                                    </div>
                                </div>
                                <div class="mt-4 flex gap-1.5">
                                    {resultadosCalcio.reporteDias.map((d, idx) => (
                                        <div key={idx} title={t(d.diaNombreKey)} class={`flex-1 h-3 rounded-full ${d.cumpleMeta ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                                    ))}
                                </div>
                            </div>
                            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('metrics_absorption_title')}</span>
                                    <h2 class="text-4xl font-extrabold text-slate-800 dark:text-white mt-2">{resultadosCalcio.promedioAbsorbidoSemanal} <span class="text-lg font-semibold">mg/d</span></h2>
                                </div>
                                <div class="mt-4"><p class="text-[11px] text-slate-500 leading-relaxed">{t('metrics_absorption_subtitle')}</p></div>
                            </div>
                        </div>

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
                                    <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('solar_index_title')}</span>
                                    <div class="flex items-end justify-between mt-1">
                                        <h4 class="text-base font-bold">{infoSolar.clasificacion}</h4>
                                        <span class="text-2xl font-extrabold opacity-80">{resultadoSolar.indice}</span>
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
                                    {resultadoLabVitD && <p class={`mt-2 text-xs font-bold ${textoColorPorKey[resultadoLabVitD.colorKey]}`}>{t(`lab_vitd_${resultadoLabVitD.categoria}`)}</p>}
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
                            </ol>
                        </div>

                    </section>
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
                        <div><strong>{t('pdf_date_tag')}</strong> {new Date().toLocaleDateString('es-PA')}</div>
                    </div>
                    <div class="pt-4 border-t border-slate-200 space-y-3">
                        <h2 class="text-lg font-bold">{t('pdf_results_summary')}</h2>
                        <ul class="space-y-1 text-sm">
                            <li>• {t('pdf_bullet_calcium').replace('{val1}', resultadosCalcio.porcentajeCumplimiento).replace('{val2}', infoRiesgoCalcio.clasificacion)}</li>
                            <li>• {t('pdf_bullet_bone').replace('{val}', infoRiesgoOseo.clasificacion)}</li>
                            <li>• {t('pdf_bullet_sarc').replace('{val}', infoRiesgoSarcopenia.clasificacion)}</li>
                            <li>• {t('pdf_bullet_solar').replace('{val}', infoSolar.clasificacion)}</li>
                            <li>• {t('pdf_bullet_vitd').replace('{val}', infoVitDDieta.clasificacion)}</li>
                        </ul>
                    </div>
                    <p class="pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center">© 2026 Jean Carlos Ruiz Mosley. Todos los derechos reservados. CalD Risk Screen (CARDA v1.1).</p>
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
