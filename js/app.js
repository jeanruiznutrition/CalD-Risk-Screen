// ============================================================
// CalD Risk Screen — Componente principal de la interfaz (React)
// Consume: TRANSLATIONS (i18n.js), ALIMENTOS_INICIALES / DIAS_SEMANA /
// REGIMENES_SUPLEMENTO_CALCIO / PREGUNTAS_SARC_F (data.js) y las
// funciones del motor CARDA (algorithm.js).
// ============================================================

const { useState, useEffect, useMemo } = React;

function App() {
    const [darkMode, setDarkMode] = useState(false);
    const lang = 'es'; // v1.0: español únicamente. Arquitectura de i18n lista para más idiomas.

    // --- Perfil del participante (necesario para riesgo óseo y de sarcopenia) ---
    const [perfil, setPerfil] = useState({
        edad: 30,
        sexo: 'femenino',
        grupoEstudio: 'Vegano',
        diasEjercicioFuerza: 0,
        fuma: false,
        alcoholFrecuente: false,
        proteinaAdecuada: true
    });

    // --- FFQ de fuentes de calcio ---
    const [alimentos, setAlimentos] = useState(
        ALIMENTOS_INICIALES.map(al => ({
            ...al,
            diasPorSemana: 0,
            vecesPorDia: 1,
            porcionesPorComida: 1.0
        }))
    );

    // --- Reubicaciones manuales de la semana virtual (drag & drop / tocar-y-tocar) ---
    const [manualOverrides, setManualOverrides] = useState({});
    const [selectedInstance, setSelectedInstance] = useState(null);
    const [draggedInstance, setDraggedInstance] = useState(null);

    // --- Suplementación de calcio ---
    const [regimenSuplementoId, setRegimenSuplementoId] = useState('ninguna');

    // --- Exposición solar ---
    const [exposicionSolar, setExposicionSolar] = useState({
        diasPorSemana: 0,
        minutosPorSesion: 0,
        horario: 'no_pico',
        usaProtector: false,
        edadBracket: 'menor_50'
    });

    // --- Cuestionario SARC-F ---
    const [respuestasSarcF, setRespuestasSarcF] = useState({});

    // --- Laboratorio opcional: 25-OH-vitamina D sérica (ng/mL) ---
    const [labVitaminaD, setLabVitaminaD] = useState('');

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Filtro dinámico de alimentos basado en el patrón dietético
    const alimentosFiltrados = useMemo(() => {
        return alimentos.filter(al => {
            if (perfil.grupoEstudio === 'Vegano' && al.ocultoEnVegano) return false;
            if (perfil.grupoEstudio === 'Ovolactovegetariano' && (al.ocultoEnOvolacto || al.ocultoEnVegano === true && al.id === 'lacteos' ? false : al.ocultoEnOvolacto)) {
                if (al.ocultoEnOvolacto) return false;
            }
            return true;
        });
    }, [alimentos, perfil.grupoEstudio]);

    // Gestión de actualizaciones en el cuestionario de consumo
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

    const moverInstancia = (foodId, occurrenceIndex, diaDestino, comidaDestino) => {
        setManualOverrides(prev => ({
            ...prev,
            [foodId]: {
                ...prev[foodId],
                [occurrenceIndex]: { dia: diaDestino, comida: comidaDestino }
            }
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
        if (draggedInstance) {
            moverInstancia(draggedInstance.foodId, draggedInstance.occurrenceIndex, diaDestino, comidaDestino);
        }
        setDraggedInstance(null);
        setSelectedInstance(null);
    };

    const handleTapAlimento = (foodId, occurrenceIndex, nombreKey) => (e) => {
        e.stopPropagation();
        setSelectedInstance(prev => {
            if (prev && prev.foodId === foodId && prev.occurrenceIndex === occurrenceIndex) return null;
            return { foodId, occurrenceIndex, nombreKey };
        });
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
            const seOculta =
                (nuevoGrupo === 'Vegano' && al.ocultoEnVegano) ||
                (nuevoGrupo === 'Ovolactovegetariano' && al.ocultoEnOvolacto);
            if (seOculta) {
                return { ...al, diasPorSemana: 0, vecesPorDia: 1, porcionesPorComida: 1.0 };
            }
            return al;
        }));
    };

    const handlePerfilChange = (campo, valor) => {
        setPerfil(prev => ({ ...prev, [campo]: valor }));
    };

    const handleExposicionChange = (campo, valor) => {
        setExposicionSolar(prev => ({ ...prev, [campo]: valor }));
    };

    const handleSarcFChange = (preguntaId, valor) => {
        setRespuestasSarcF(prev => ({ ...prev, [preguntaId]: valor }));
    };

    const regimenSuplemento = useMemo(
        () => REGIMENES_SUPLEMENTO_CALCIO.find(r => r.id === regimenSuplementoId) || REGIMENES_SUPLEMENTO_CALCIO[0],
        [regimenSuplementoId]
    );

    // --- Cálculo reactivo de los tres módulos de riesgo ---
    const resultadosCalcio = useMemo(
        () => ejecutarSemanaVirtualCalcio(alimentosFiltrados, regimenSuplemento, manualOverrides),
        [alimentosFiltrados, regimenSuplemento, manualOverrides]
    );

    const resultadoSolar = useMemo(
        () => calcularIndiceExposicionSolar(exposicionSolar),
        [exposicionSolar]
    );

    const resultadoLabVitD = useMemo(() => interpretar25OHVitaminaD(labVitaminaD), [labVitaminaD]);

    const resultadoOseo = useMemo(() => calcularRiesgoOseo({
        porcentajeCumplimientoCalcio: resultadosCalcio.porcentajeCumplimiento,
        categoriaRiesgoSolar: resultadoSolar.categoriaRiesgo,
        edad: Number(perfil.edad) || 0,
        sexo: perfil.sexo,
        diasEjercicioFuerza: Number(perfil.diasEjercicioFuerza) || 0,
        fuma: perfil.fuma,
        alcoholFrecuente: perfil.alcoholFrecuente
    }), [resultadosCalcio.porcentajeCumplimiento, resultadoSolar.categoriaRiesgo, perfil]);

    const resultadoSarcopenia = useMemo(() => calcularRiesgoSarcopenia(respuestasSarcF, {
        proteinaAdecuada: perfil.proteinaAdecuada,
        diasEjercicioFuerza: Number(perfil.diasEjercicioFuerza) || 0
    }), [respuestasSarcF, perfil.proteinaAdecuada, perfil.diasEjercicioFuerza]);

    const t = (key) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS['es']?.[key] || key;

    // Clasificación diagnóstica del módulo Calcio/Vitamina D (basada en % de cumplimiento semanal)
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

    const infoRiesgoOseo = {
        clasificacion: t(`diag_bone_${resultadoOseo.categoria}`),
        color: colorClasesPorKey[resultadoOseo.colorKey],
        descripcion: t(`diag_bone_${resultadoOseo.categoria}_desc`),
        severidad: t(`diag_sev_${resultadoOseo.categoria === 'moderado' ? 'mod' : resultadoOseo.categoria}`)
    };

    const infoRiesgoSarcopenia = {
        clasificacion: t(`diag_sarc_${resultadoSarcopenia.categoria}`),
        color: colorClasesPorKey[resultadoSarcopenia.colorKey],
        descripcion: t(`diag_sarc_${resultadoSarcopenia.categoria}_desc`)
    };

    const infoSolar = {
        clasificacion: t(`solar_${resultadoSolar.categoriaRiesgo}`),
        color: colorClasesPorKey[resultadoSolar.colorKey]
    };

    const exportarExcel = () => {
        let csv = "data:text/csv;charset=utf-8,";
        csv += "CalD Risk Screen - Resultados del Algoritmo CARDA v1.0\r\n";
        csv += "(C) 2026 Jean Carlos Ruiz Mosley - Todos los derechos reservados\r\n";
        csv += "Investigador Principal;Jean Carlos Ruiz Mosley\r\n";
        csv += `Patron Dietetico;${perfil.grupoEstudio}\r\n`;
        csv += `Edad;${perfil.edad}\r\n`;
        csv += `Sexo;${perfil.sexo}\r\n\r\n`;

        csv += "MODULO 1: CALCIO Y VITAMINA D\r\n";
        csv += `Cumplimiento Semanal de Calcio;${resultadosCalcio.porcentajeCumplimiento}%\r\n`;
        csv += `Dias Adecuados (>=250mg absorbido);${resultadosCalcio.diasCumplidos}\r\n`;
        csv += `Promedio Ingerido Semanal (mg/dia);${resultadosCalcio.promedioIngeridoSemanal}\r\n`;
        csv += `Promedio Absorbido Semanal (mg/dia);${resultadosCalcio.promedioAbsorbidoSemanal}\r\n`;
        csv += `Indice de Exposicion Solar;${resultadoSolar.indice}\r\n`;
        csv += `Categoria de Riesgo de Sintesis de Vitamina D;${resultadoSolar.categoriaRiesgo}\r\n`;
        if (resultadoLabVitD) csv += `25-OH-Vitamina D serica (ng/mL);${labVitaminaD} (${resultadoLabVitD.categoria})\r\n`;
        csv += "\r\n";

        csv += "MODULO 2: RIESGO OSEO (orientativo, no diagnostico)\r\n";
        csv += `Puntaje;${resultadoOseo.puntaje} / ${resultadoOseo.puntajeMaximo}\r\n`;
        csv += `Categoria;${resultadoOseo.categoria}\r\n\r\n`;

        csv += "MODULO 3: RIESGO DE SARCOPENIA (SARC-F)\r\n";
        csv += `Puntaje SARC-F;${resultadoSarcopenia.puntajeTotal} / 10\r\n`;
        csv += `Riesgo probable de sarcopenia;${resultadoSarcopenia.riesgoProbable ? 'SI' : 'NO'}\r\n\r\n`;

        csv += "Frecuencias Reportadas (FFQ Calcio):\r\n";
        csv += "Alimento;Dias por Semana;Veces al Dia;Porciones;Calcio por Porcion (mg)\r\n";
        alimentosFiltrados.forEach(al => {
            csv += `${t(al.nombreKey)};${al.diasPorSemana};${al.vecesPorDia};${al.porcionesPorComida};${al.calcioPorcion}\r\n`;
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
                                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">CARDA v1.0</span>
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

            {/* --- CONTENIDO PRINCIPAL --- */}
            <main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

                {/* ADVERTENCIA DE METODOLOGÍA */}
                <div class="mb-8 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl flex items-start gap-4">
                    <div class="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg shrink-0">
                        <i class="fa-solid fa-circle-info text-lg"></i>
                    </div>
                    <div>
                        <h4 class="font-semibold text-blue-800 dark:text-blue-300 text-sm">{t('methodology_title')}</h4>
                        <p class="text-xs text-blue-700/85 dark:text-blue-400 mt-1 leading-relaxed">{t('methodology_desc')}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* ===================== COLUMNA IZQUIERDA: INPUTS ===================== */}
                    <section class="lg:col-span-5 flex flex-col gap-8 no-print">

                        {/* CARD: PERFIL DEL PARTICIPANTE */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <i class="fa-solid fa-user text-brand-600"></i> {t('profile_title')}
                            </h3>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('profile_age')}</label>
                                    <input type="number" min="0" max="120" value={perfil.edad}
                                        onChange={(e) => handlePerfilChange('edad', e.target.value)}
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
                                <div>
                                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('profile_strength_days')}</label>
                                    <select value={perfil.diasEjercicioFuerza} onChange={(e) => handlePerfilChange('diasEjercicioFuerza', parseInt(e.target.value))}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                        {[0,1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                </div>
                                <div class="flex flex-col justify-end gap-1.5">
                                    <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        <input type="checkbox" checked={perfil.fuma} onChange={(e) => handlePerfilChange('fuma', e.target.checked)} class="rounded accent-brand-600" />
                                        {t('profile_smokes')}
                                    </label>
                                    <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        <input type="checkbox" checked={perfil.alcoholFrecuente} onChange={(e) => handlePerfilChange('alcoholFrecuente', e.target.checked)} class="rounded accent-brand-600" />
                                        {t('profile_alcohol')}
                                    </label>
                                </div>
                                <div class="col-span-2">
                                    <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        <input type="checkbox" checked={perfil.proteinaAdecuada} onChange={(e) => handlePerfilChange('proteinaAdecuada', e.target.checked)} class="rounded accent-brand-600" />
                                        {t('profile_protein_adequate')}
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* CARD: SUPLEMENTACIÓN DE CALCIO */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <i class="fa-solid fa-pills text-brand-600"></i> {t('supp_title')}
                            </h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('supp_desc')}</p>
                            <select value={regimenSuplementoId} onChange={(e) => setRegimenSuplementoId(e.target.value)}
                                class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100">
                                <option value="ninguna">{t('supp_none')}</option>
                                <option value="500_1x_diario">{t('supp_500_1x')}</option>
                                <option value="500_2x_diario">{t('supp_500_2x')}</option>
                                <option value="600_1x_diario">{t('supp_600_1x')}</option>
                                <option value="1200_1x_diario">{t('supp_1200_1x')}</option>
                            </select>
                        </div>

                        {/* CARD: EXPOSICIÓN SOLAR */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <i class="fa-solid fa-sun text-brand-600"></i> {t('solar_title')}
                            </h3>
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
                                    <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                        <input type="checkbox" checked={exposicionSolar.usaProtector} onChange={(e) => handleExposicionChange('usaProtector', e.target.checked)} class="rounded accent-brand-600" />
                                        {t('solar_sunscreen')}
                                    </label>
                                </div>
                            </div>

                            {/* Laboratorio opcional: 25-OH-vitamina D sérica */}
                            <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('lab_vitd_label')}</label>
                                <div class="flex items-center gap-2">
                                    <input type="number" step="0.1" min="0" placeholder={t('lab_vitd_placeholder')} value={labVitaminaD}
                                        onChange={(e) => setLabVitaminaD(e.target.value)}
                                        class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-800 dark:text-slate-100" />
                                    <span class="text-xs text-slate-400 shrink-0">ng/mL</span>
                                </div>
                                {resultadoLabVitD && (
                                    <p class={`mt-2 text-xs font-bold ${resultadoLabVitD.colorKey === 'rose' ? 'text-rose-500' : resultadoLabVitD.colorKey === 'amber' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                        {t(`lab_vitd_${resultadoLabVitD.categoria}`)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* CARD: CUESTIONARIO SARC-F */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <i class="fa-solid fa-person-walking text-brand-600"></i> {t('sarcf_title')}
                            </h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('sarcf_desc')}</p>
                            <div class="space-y-4">
                                {PREGUNTAS_SARC_F.map(pregunta => (
                                    <div key={pregunta.id}>
                                        <label class="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{t(pregunta.nombreKey)}</label>
                                        <select
                                            value={respuestasSarcF[pregunta.id] ?? ''}
                                            onChange={(e) => handleSarcFChange(pregunta.id, parseInt(e.target.value))}
                                            class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 dark:text-slate-100"
                                        >
                                            <option value="" disabled>{t('sarcf_select_placeholder')}</option>
                                            {pregunta.opciones.map(op => (
                                                <option key={op.valor} value={op.valor}>{t(op.key)}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CARD: FFQ DE FUENTES DE CALCIO */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <i class="fa-solid fa-carrot text-brand-600"></i> {t('ffq_title')}
                            </h3>
                            <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">{t('ffq_subtitle')}</p>
                            <div class="space-y-4">
                                {alimentosFiltrados.map(al => (
                                    <div key={al.id} class="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                                        <div class="flex items-center gap-2 mb-2">
                                            <i class={`${al.icono} text-brand-600 dark:text-brand-400 w-4 text-center`}></i>
                                            <span class="text-sm font-bold text-slate-700 dark:text-slate-200">{t(al.nombreKey)}</span>
                                            <span class="text-[10px] text-slate-400 ml-auto">{t('ffq_portion')} {al.calcioPorcion}mg / {t(al.porcionUnidadKey)}</span>
                                        </div>
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
                                                <select value={al.vecesPorDia} onChange={(e) => handleAlimentoChange(al.id, 'vecesPorDia', parseInt(e.target.value))}
                                                    disabled={al.diasPorSemana === 0}
                                                    class="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-800 dark:text-slate-100">
                                                    <option value={1}>{`1 ${t('ffq_time')}`}</option>
                                                    <option value={2}>{`2 ${t('ffq_times')}`}</option>
                                                    <option value={3}>{`3 ${t('ffq_times')}`}</option>
                                                </select>
                                            </div>
                                            {al.permitePorciones && (
                                                <div>
                                                    <label class="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('ffq_portions')}</label>
                                                    <select value={al.porcionesPorComida} onChange={(e) => handleAlimentoChange(al.id, 'porcionesPorComida', parseFloat(e.target.value))}
                                                        disabled={al.diasPorSemana === 0}
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
                                <div class="mt-4">
                                    <p class="text-[11px] text-slate-500 leading-relaxed">{t('metrics_absorption_subtitle')}</p>
                                </div>
                            </div>
                        </div>

                        {/* TRES TARJETAS DE DIAGNÓSTICO */}
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div class={`border p-5 rounded-2xl ${infoRiesgoCalcio.color} transition-all duration-300`}>
                                <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('diagnostic_calcium_title')}</span>
                                <h3 class="text-base font-bold leading-tight mt-1">{infoRiesgoCalcio.clasificacion}</h3>
                                <p class="text-[11px] mt-2 leading-relaxed opacity-90">{infoRiesgoCalcio.descripcion}</p>
                            </div>
                            <div class={`border p-5 rounded-2xl ${infoRiesgoOseo.color} transition-all duration-300`}>
                                <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('diagnostic_bone_title')}</span>
                                <h3 class="text-base font-bold leading-tight mt-1">{infoRiesgoOseo.clasificacion}</h3>
                                <p class="text-[11px] mt-2 leading-relaxed opacity-90">{infoRiesgoOseo.descripcion}</p>
                                <p class="text-[10px] mt-2 font-bold opacity-75">{t('bone_score_label')} {resultadoOseo.puntaje}/{resultadoOseo.puntajeMaximo}</p>
                            </div>
                            <div class={`border p-5 rounded-2xl ${infoRiesgoSarcopenia.color} transition-all duration-300`}>
                                <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('diagnostic_sarc_title')}</span>
                                <h3 class="text-base font-bold leading-tight mt-1">{infoRiesgoSarcopenia.clasificacion}</h3>
                                <p class="text-[11px] mt-2 leading-relaxed opacity-90">{infoRiesgoSarcopenia.descripcion}</p>
                                <p class="text-[10px] mt-2 font-bold opacity-75">{t('sarcf_score_label')} {resultadoSarcopenia.puntajeTotal}/10</p>
                            </div>
                        </div>

                        {/* ÍNDICE DE EXPOSICIÓN SOLAR */}
                        <div class={`border p-5 rounded-2xl flex items-center justify-between ${infoSolar.color}`}>
                            <div>
                                <span class="text-[10px] font-bold uppercase tracking-wider opacity-75">{t('solar_index_title')}</span>
                                <h3 class="text-base font-bold leading-tight mt-1">{infoSolar.clasificacion}</h3>
                            </div>
                            <div class="text-3xl font-extrabold opacity-80">{resultadoSolar.indice}</div>
                        </div>

                        {/* SEMANA VIRTUAL RECONSTRUIDA */}
                        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <div class="flex items-center justify-between mb-2">
                                <div>
                                    <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                        <i class="fa-solid fa-calendar-week text-brand-600"></i> {t('week_reconstructed_title')}
                                    </h3>
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
                                                    <div key={cIdx}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={handleDropEnCelda(dIdx, cIdx)}
                                                        onClick={handleTapCelda(dIdx, cIdx)}
                                                        class={`p-2.5 rounded-lg border transition-all ${esDestinoActivo ? 'border-brand-400 border-dashed bg-brand-50/40 dark:bg-brand-950/10 cursor-pointer' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80'}`}
                                                    >
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
                                                                        <li key={alIdx}
                                                                            draggable="true"
                                                                            onDragStart={handleDragStart(al.id, al.occurrenceIndex, al.nombreKey)}
                                                                            onDragEnd={handleDragEnd}
                                                                            onClick={handleTapAlimento(al.id, al.occurrenceIndex, al.nombreKey)}
                                                                            class={`text-[10px] flex justify-between items-center p-1 rounded border cursor-grab active:cursor-grabbing ${esSeleccionado ? 'bg-brand-100 dark:bg-brand-900/40 border-brand-500' : al.esManual ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'}`}
                                                                        >
                                                                            <span class="truncate pr-1 flex items-center gap-1">
                                                                                {al.esManual && <i class="fa-solid fa-arrows-up-down-left-right text-amber-500 text-[9px]"></i>}
                                                                                {t(al.nombreKey)}
                                                                            </span>
                                                                            <span class="flex items-center gap-1 shrink-0">
                                                                                {Math.round(al.calcioIngerido)}mg
                                                                                {al.esManual && (
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); resetearInstancia(al.id, al.occurrenceIndex); }}
                                                                                        class="text-amber-500 hover:text-amber-700"
                                                                                        title={t('week_reset_one')}
                                                                                    >
                                                                                        <i class="fa-solid fa-xmark"></i>
                                                                                    </button>
                                                                                )}
                                                                            </span>
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        ) : (
                                                            <p class="text-[10px] text-slate-300 dark:text-slate-700 italic">{t('week_empty_meal')}</p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                        </ul>
                    </div>
                    <p class="pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                        © 2026 Jean Carlos Ruiz Mosley. Todos los derechos reservados. CalD Risk Screen (CARDA v1.0).
                    </p>
                </div>

            </main>

            {/* --- PIE DE PÁGINA --- */}
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
