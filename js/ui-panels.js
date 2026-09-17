// ============================================================
// CalD Risk Screen — Paneles de interfaz (nuevo en la v6.0)
// ============================================================
//
// Componentes que no caben en app.js sin volverlo inmanejable:
//
//   · LimiteDeError      sustituye la pantalla gris por un mensaje útil
//   · TarjetaBiomarcadores  panel bioquímico completo
//   · PanelValidacion    exactitud diagnóstica contra el patrón de oro
//   · PanelMetodologia   registro de parámetros y diccionario de datos
//   · Gráficos en SVG    curva ROC, Bland-Altman y calibración
//
// Todos consumen `t` (el traductor) como propiedad, de modo que no
// dependen del estado de idioma de app.js.
//
// © Jean Carlos Ruiz Mosley. Todos los derechos reservados.
// ============================================================


// ------------------------------------------------------------
// 1. LÍMITE DE ERROR
// ------------------------------------------------------------
// El README de la v3.1 documentaba la pantalla gris como síntoma
// conocido, con instrucciones para abrir la consola del navegador. Para
// una herramienta que se usa delante del participante en una entrevista,
// la diferencia entre "pantalla gris" y "no cargó js/i18n/pt.js" es la
// diferencia entre perder la sesión y seguir trabajando.
class LimiteDeError extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        this.setState({ error, info });
        // Se deja también en la consola, para quien sepa abrirla.
        if (typeof console !== 'undefined' && console.error) console.error(error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;
        const e = this.state.error;
        const pila = (this.state.info && this.state.info.componentStack) || (e && e.stack) || '';
        return (
            <div class="min-h-screen flex items-center justify-center p-6 bg-slate-50">
                <div class="max-w-2xl w-full bg-white border border-rose-300 rounded-2xl p-6 shadow-lg">
                    <h1 class="text-lg font-bold text-rose-700 mb-2">
                        <i class="fa-solid fa-triangle-exclamation mr-2"></i>
                        Error en la aplicación
                    </h1>
                    <p class="text-sm text-slate-700 mb-4">
                        La herramienta encontró un error y detuvo la pantalla para no mostrar
                        datos incorrectos. Los datos que haya guardado en el registro acumulado
                        siguen en el almacenamiento local del navegador.
                    </p>
                    <div class="bg-slate-900 text-slate-100 rounded-lg p-3 text-[11px] font-mono overflow-auto max-h-64">
                        <div class="text-rose-300 font-bold">{String(e && e.name)}: {String(e && e.message)}</div>
                        <pre class="whitespace-pre-wrap mt-2 text-slate-300">{String(pila).slice(0, 2000)}</pre>
                    </div>
                    <p class="text-xs text-slate-500 mt-4">
                        Copie este texto al informar el problema. Si el mensaje menciona un
                        archivo de <span class="font-mono">js/</span>, lo más probable es que ese
                        archivo no llegara a cargarse.
                    </p>
                    <button onClick={() => window.location.reload()}
                        class="mt-4 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg">
                        Recargar la aplicación
                    </button>
                </div>
            </div>
        );
    }
}


// ------------------------------------------------------------
// 2. CONTROLES REUTILIZABLES
// ------------------------------------------------------------
const CampoNumerico = ({ etiqueta, valor, onChange, unidad, rango, paso, aviso, colorKey }) => {
    const fueraDeRango = rango && valor !== '' && valor !== null && valor !== undefined &&
        (parseFloat(valor) < rango.min || parseFloat(valor) > rango.max);
    const color = colorKey === 'rose' ? 'text-rose-600'
        : colorKey === 'amber' ? 'text-amber-600'
        : colorKey === 'emerald' ? 'text-emerald-600' : 'text-slate-500';
    return (
        <div>
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {etiqueta} {unidad ? <span class="font-normal text-slate-400">({unidad})</span> : null}
            </label>
            <input type="number" step={paso || 'any'} value={valor === null || valor === undefined ? '' : valor}
                onChange={(ev) => onChange(ev.target.value)}
                class={'w-full px-2 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-800 ' +
                    (fueraDeRango ? 'border-amber-400 ring-1 ring-amber-300' : 'border-slate-300 dark:border-slate-700')} />
            {rango ? (
                <div class="text-[10px] text-slate-400 mt-0.5">
                    Referencia {rango.min}–{rango.max}
                    {fueraDeRango ? <span class="text-amber-600 font-semibold"> · fuera del rango de referencia</span> : null}
                </div>
            ) : null}
            {aviso ? <div class={'text-[10px] mt-0.5 font-semibold ' + color}>{aviso}</div> : null}
        </div>
    );
};

const Etiqueta = ({ texto, colorKey }) => {
    const clases = colorKey === 'rose' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
        : colorKey === 'amber' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : colorKey === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    return <span class={'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ' + clases}>{texto}</span>;
};


// ------------------------------------------------------------
// 3. TARJETA DE BIOMARCADORES
// ------------------------------------------------------------
const TarjetaBiomarcadores = ({ t, lab, onChange, panel }) => {
    const a = (panel && panel.analitos) || {};
    return (
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1 flex items-center gap-2">
                <i class="fa-solid fa-vial text-brand-600"></i> {t('bio_panel_title')}
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-4">{t('bio_panel_intro')}</p>

            <div class="grid grid-cols-2 gap-3">
                <CampoNumerico etiqueta={t('bio_calcium')} unidad="mg/dL" paso="0.1"
                    valor={lab.calcioSerico} onChange={(v) => onChange('calcioSerico', v)}
                    rango={RANGO_CALCIO_SERICO_NORMAL_MG_DL} />
                <CampoNumerico etiqueta={t('bio_albumin')} unidad="g/dL" paso="0.1"
                    valor={lab.albumina} onChange={(v) => onChange('albumina', v)}
                    rango={RANGOS_LABORATORIO.albumina}
                    aviso={a.ca && a.ca.disponible && !a.ca.correccionAplicada ? t('bio_needs_albumin') : null}
                    colorKey="amber" />
                <CampoNumerico etiqueta={t('bio_vitd')} unidad="ng/mL" paso="0.1"
                    valor={lab.vitD25OH} onChange={(v) => onChange('vitD25OH', v)} />
                <CampoNumerico etiqueta={t('bio_pth')} unidad="pg/mL" paso="0.1"
                    valor={lab.pth} onChange={(v) => onChange('pth', v)}
                    rango={RANGOS_LABORATORIO.ptHormonaIntacta} />
                <CampoNumerico etiqueta={t('bio_phosphorus')} unidad="mg/dL" paso="0.1"
                    valor={lab.fosforo} onChange={(v) => onChange('fosforo', v)}
                    rango={RANGOS_LABORATORIO.fosforo} />
                <CampoNumerico etiqueta={t('bio_alp')} unidad="U/L" paso="1"
                    valor={lab.fosfatasaAlcalina} onChange={(v) => onChange('fosfatasaAlcalina', v)}
                    rango={RANGOS_LABORATORIO.fosfatasaAlcalina} />
                <CampoNumerico etiqueta={t('bio_magnesium')} unidad="mg/dL" paso="0.01"
                    valor={lab.magnesio} onChange={(v) => onChange('magnesio', v)}
                    rango={RANGOS_LABORATORIO.magnesio} />
                <CampoNumerico etiqueta={t('bio_creatinine')} unidad="mg/dL" paso="0.01"
                    valor={lab.creatinina} onChange={(v) => onChange('creatinina', v)}
                    rango={RANGOS_LABORATORIO.creatinina} />
                <CampoNumerico etiqueta={t('bio_urine_ca_24h')} unidad="mg/24h" paso="1"
                    valor={lab.calcio24hMg} onChange={(v) => onChange('calcio24hMg', v)} />
                <div class="grid grid-cols-2 gap-2">
                    <CampoNumerico etiqueta={t('bio_urine_ca_spot')} unidad="mg/dL" paso="0.1"
                        valor={lab.calcioOrinaMgDl} onChange={(v) => onChange('calcioOrinaMgDl', v)} />
                    <CampoNumerico etiqueta={t('bio_urine_cr_spot')} unidad="mg/dL" paso="0.1"
                        valor={lab.creatininaOrinaMgDl} onChange={(v) => onChange('creatininaOrinaMgDl', v)} />
                </div>
            </div>

            {/* Valores derivados */}
            {(a.ca && a.ca.correccionAplicada) || (a.tfge && a.tfge.disponible) || (a.calcioUrinario && a.calcioUrinario.razonCalcioCreatinina !== undefined) ? (
                <div class="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div class="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('bio_derived')}</div>

                    {a.ca && a.ca.correccionAplicada ? (
                        <div class="flex items-start justify-between gap-2 text-xs">
                            <div>
                                <div class="font-semibold text-slate-700 dark:text-slate-300">{t('bio_corrected_calcium')}</div>
                                <div class="text-[10px] text-slate-500">{t('bio_payne_note')}</div>
                                {a.ca.cambiaClasificacion ? (
                                    <div class="text-[10px] text-amber-600 font-semibold mt-0.5">{t('bio_correction_changes_class')}</div>
                                ) : null}
                            </div>
                            <div class="text-right shrink-0">
                                <div class="font-bold text-sm">{a.ca.calcioCorregido} <span class="text-[10px] font-normal">mg/dL</span></div>
                                <Etiqueta texto={t('bio_cat_' + a.ca.categoria)} colorKey={a.ca.colorKey} />
                            </div>
                        </div>
                    ) : null}

                    {a.tfge && a.tfge.disponible ? (
                        <div class="flex items-start justify-between gap-2 text-xs">
                            <div>
                                <div class="font-semibold text-slate-700 dark:text-slate-300">{t('bio_egfr')}</div>
                                <div class="text-[10px] text-slate-500">{a.tfge.ecuacion}</div>
                                {a.tfge.confundidaPorCreatina ? (
                                    <div class="text-[10px] text-amber-600 font-semibold mt-0.5">{t('bio_egfr_creatine')}</div>
                                ) : null}
                            </div>
                            <div class="text-right shrink-0">
                                <div class="font-bold text-sm">{a.tfge.valor} <span class="text-[10px] font-normal">mL/min/1.73m²</span></div>
                                <Etiqueta texto={a.tfge.estadio} colorKey={a.tfge.colorKey} />
                            </div>
                        </div>
                    ) : null}

                    {a.calcioUrinario && a.calcioUrinario.disponible ? (
                        <div class="flex items-start justify-between gap-2 text-xs">
                            <div>
                                <div class="font-semibold text-slate-700 dark:text-slate-300">{t('bio_urine_calcium')}</div>
                                {a.calcioUrinario.confundidoPorCreatina ? (
                                    <div class="text-[10px] text-amber-600 font-semibold">{t('bio_urine_creatine')}</div>
                                ) : null}
                                <div class="text-[10px] text-slate-500">
                                    {a.calcioUrinario.criterios.map(cr => `${cr.id}: ${cr.valor} ${cr.unidad} (límite ${cr.limite})`).join(' · ')}
                                </div>
                            </div>
                            <div class="text-right shrink-0">
                                <Etiqueta texto={a.calcioUrinario.hipercalciuria ? t('bio_hypercalciuria') : t('bio_normal')}
                                    colorKey={a.calcioUrinario.colorKey} />
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* Patrones integrados */}
            {panel && panel.patrones && panel.patrones.length ? (
                <div class="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('bio_patterns')}</div>
                        <Etiqueta texto={t('bio_referral_' + panel.nivelDerivacion)} colorKey={panel.colorKey} />
                    </div>
                    <ul class="space-y-1.5">
                        {panel.patrones.map(p => (
                            <li key={p.id} class="text-xs flex items-start gap-2">
                                <i class={'fa-solid fa-circle text-[5px] mt-1.5 ' +
                                    (p.urgencia === 'derivacion_urgente' ? 'text-rose-500'
                                        : p.urgencia === 'derivacion' ? 'text-amber-500' : 'text-slate-400')}></i>
                                <div>
                                    <span class="font-semibold text-slate-700 dark:text-slate-300">{t(p.key)}</span>
                                    <span class="text-[10px] text-slate-400"> · {t('bio_supported_by')}: {p.soportes.join(', ')}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <p class="text-[10px] text-slate-500 mt-3 leading-relaxed">{t('lab_disclaimer_clinical')}</p>
                </div>
            ) : null}

            {panel && panel.analitosDeclarados === 0 ? (
                <p class="text-[11px] text-slate-400 mt-4">{t('bio_no_data')}</p>
            ) : null}
        </div>
    );
};


// ------------------------------------------------------------
// 4. GRÁFICOS EN SVG
// ------------------------------------------------------------
// Se dibujan a mano en SVG y no con una biblioteca de gráficos: añadir
// una dependencia más de CDN a una herramienta que ya depende de cuatro
// empeoraría el problema que el propio README señala como el mayor
// riesgo operativo para el trabajo de campo.

const GraficoROC = ({ roc, t }) => {
    if (!roc || !roc.valido) return null;
    const L = 40, T = 12, W = 240, H = 240;
    const px = (fpr) => L + fpr * W;
    const py = (tpr) => T + (1 - tpr) * H;
    const camino = roc.puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.fpr).toFixed(1)} ${py(p.tpr).toFixed(1)}`).join(' ');
    const area = camino + ` L ${px(1).toFixed(1)} ${py(0).toFixed(1)} Z`;

    return (
        <svg viewBox="0 0 300 300" class="w-full max-w-[320px]" role="img" aria-label={t('val_roc_title')}>
            <rect x={L} y={T} width={W} height={H} fill="none" stroke="#cbd5e1" stroke-width="1" />
            {[0.25, 0.5, 0.75].map(g => (
                <g key={g}>
                    <line x1={px(g)} y1={T} x2={px(g)} y2={T + H} stroke="#e2e8f0" stroke-width="0.5" />
                    <line x1={L} y1={py(g)} x2={L + W} y2={py(g)} stroke="#e2e8f0" stroke-width="0.5" />
                </g>
            ))}
            <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3" />
            <path d={area} fill="#007AFF" fill-opacity="0.10" />
            <path d={camino} fill="none" stroke="#007AFF" stroke-width="2" stroke-linejoin="round" />
            {roc.puntos.filter(p => p.corte !== null).map((p, i) => (
                <circle key={i} cx={px(p.fpr)} cy={py(p.tpr)} r="2.5" fill="#007AFF" />
            ))}
            {[0, 0.5, 1].map(g => (
                <g key={'et' + g}>
                    <text x={px(g)} y={T + H + 14} font-size="9" text-anchor="middle" fill="#64748b">{g}</text>
                    <text x={L - 6} y={py(g) + 3} font-size="9" text-anchor="end" fill="#64748b">{g}</text>
                </g>
            ))}
            <text x={L + W / 2} y={T + H + 28} font-size="10" text-anchor="middle" fill="#334155">{t('val_fpr')}</text>
            <text x={12} y={T + H / 2} font-size="10" text-anchor="middle" fill="#334155"
                transform={`rotate(-90 12 ${T + H / 2})`}>{t('val_tpr')}</text>
            <text x={L + W - 6} y={T + H - 8} font-size="11" text-anchor="end" font-weight="bold" fill="#007AFF">
                AUC {roc.auc.toFixed(3)}
            </text>
        </svg>
    );
};

const GraficoBlandAltman = ({ ba, t }) => {
    if (!ba || !ba.valido) return null;
    const L = 46, T = 12, W = 234, H = 200;
    const xs = ba.puntos.map(p => p.promedio), ys = ba.puntos.map(p => p.diferencia);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const limInf = ba.limiteAcuerdoInferior, limSup = ba.limiteAcuerdoSuperior;
    const minY = Math.min(limInf, ...ys), maxY = Math.max(limSup, ...ys);
    const rx = (maxX - minX) || 1, ry = (maxY - minY) || 1;
    const px = (v) => L + ((v - minX) / rx) * W;
    const py = (v) => T + (1 - (v - minY) / ry) * H;

    return (
        <svg viewBox="0 0 300 260" class="w-full max-w-[320px]" role="img" aria-label={t('val_ba_title')}>
            <rect x={L} y={T} width={W} height={H} fill="none" stroke="#cbd5e1" stroke-width="1" />
            <line x1={L} y1={py(ba.sesgo)} x2={L + W} y2={py(ba.sesgo)} stroke="#007AFF" stroke-width="1.5" />
            <line x1={L} y1={py(limSup)} x2={L + W} y2={py(limSup)} stroke="#f43f5e" stroke-width="1" stroke-dasharray="4 3" />
            <line x1={L} y1={py(limInf)} x2={L + W} y2={py(limInf)} stroke="#f43f5e" stroke-width="1" stroke-dasharray="4 3" />
            {ba.puntos.map((p, i) => (
                <circle key={i} cx={px(p.promedio)} cy={py(p.diferencia)} r="2.5" fill="#0A84FF" fill-opacity="0.7" />
            ))}
            <text x={L + W - 4} y={py(ba.sesgo) - 4} font-size="9" text-anchor="end" fill="#007AFF">
                {t('val_ba_bias')} {ba.sesgo}
            </text>
            <text x={L + W - 4} y={py(limSup) - 4} font-size="9" text-anchor="end" fill="#f43f5e">+1.96 DE {limSup}</text>
            <text x={L + W - 4} y={py(limInf) + 10} font-size="9" text-anchor="end" fill="#f43f5e">−1.96 DE {limInf}</text>
            <text x={L + W / 2} y={T + H + 26} font-size="10" text-anchor="middle" fill="#334155">{t('val_ba_x')}</text>
            <text x={14} y={T + H / 2} font-size="10" text-anchor="middle" fill="#334155"
                transform={`rotate(-90 14 ${T + H / 2})`}>{t('val_ba_y')}</text>
        </svg>
    );
};

const GraficoCalibracion = ({ calib, t }) => {
    if (!calib || !calib.valido) return null;
    const L = 40, T = 12, W = 240, H = 200;
    const gs = calib.grupos;
    const anchoBarra = W / gs.length;
    return (
        <svg viewBox="0 0 300 260" class="w-full max-w-[320px]" role="img" aria-label={t('val_calib_title')}>
            <rect x={L} y={T} width={W} height={H} fill="none" stroke="#cbd5e1" stroke-width="1" />
            {gs.map((g, i) => {
                const x = L + i * anchoBarra + anchoBarra * 0.2;
                const w = anchoBarra * 0.6;
                const alto = g.proporcionObservada * H;
                return (
                    <g key={g.grupo}>
                        <rect x={x} y={T + H - alto} width={w} height={alto} fill="#007AFF" fill-opacity="0.65" />
                        <line x1={x + w / 2} y1={T + H - g.ic95.inferior * H} x2={x + w / 2} y2={T + H - g.ic95.superior * H}
                            stroke="#1e293b" stroke-width="1" />
                        <text x={x + w / 2} y={T + H + 12} font-size="8" text-anchor="middle" fill="#64748b">{g.puntajeMedio}</text>
                        <text x={x + w / 2} y={T + H + 22} font-size="7" text-anchor="middle" fill="#94a3b8">n={g.n}</text>
                    </g>
                );
            })}
            {[0, 0.5, 1].map(g => (
                <text key={g} x={L - 6} y={T + H - g * H + 3} font-size="9" text-anchor="end" fill="#64748b">{g}</text>
            ))}
            <text x={L + W / 2} y={T + H + 40} font-size="10" text-anchor="middle" fill="#334155">{t('val_calib_x')}</text>
            <text x={12} y={T + H / 2} font-size="10" text-anchor="middle" fill="#334155"
                transform={`rotate(-90 12 ${T + H / 2})`}>{t('val_calib_y')}</text>
        </svg>
    );
};


// ------------------------------------------------------------
// 5. PANEL DE VALIDACIÓN
// ------------------------------------------------------------
const PanelValidacion = ({ t, registro }) => {
    const [fuente, setFuente] = useState('registro');
    const [texto, setTexto] = useState('');
    const [datos, setDatos] = useState(null);
    const [predictor, setPredictor] = useState('');
    const [desenlace, setDesenlace] = useState('');
    const [mayorEsPositivo, setMayorEsPositivo] = useState(true);
    const [sensibilidadMinima, setSensibilidadMinima] = useState(90);
    const [informe, setInforme] = useState(null);
    const [comparador, setComparador] = useState('');
    const [comparacion, setComparacion] = useState(null);
    const [mensaje, setMensaje] = useState(null);

    // El registro acumulado en memoria es la fuente por defecto. La
    // alternativa es pegar el CSV ya editado con las columnas del patrón
    // de oro, que es el caso real: la densitometría llega semanas después
    // de la entrevista.
    const cargarDesdeRegistro = () => {
        if (!registro || !registro.length) { setMensaje(t('val_registry_empty')); return; }
        const columnas = Object.keys(registro[0]);
        const registros = registro.map(r => {
            const o = {};
            columnas.forEach(c => { o[c] = r[c] === null || r[c] === undefined ? '' : String(r[c]); });
            return o;
        });
        const numericas = columnas.filter(c => {
            const vals = registros.map(r => r[c]).filter(v => v !== '');
            return vals.length > 0 && vals.every(v => !isNaN(parseFloat(v)));
        });
        const binarias = columnas.filter(c => {
            const vals = [...new Set(registros.map(r => r[c]).filter(v => v !== ''))];
            return vals.length > 0 && vals.length <= 2 && vals.every(v => v === '0' || v === '1');
        });
        setDatos({ valido: true, columnas, registros, n: registros.length, columnasNumericas: numericas, columnasBinarias: binarias, codigosDuplicados: [] });
        setMensaje(null);
        setInforme(null);
    };

    const cargarDesdeTexto = () => {
        const r = parsearCSV(texto);
        if (!r.valido) { setMensaje(t(r.motivoKey)); setDatos(null); return; }
        setDatos(r);
        setMensaje(null);
        setInforme(null);
    };

    const ejecutar = () => {
        if (!datos || !predictor || !desenlace) { setMensaje(t('val_pick_columns')); return; }
        const x = columnaNumerica(datos.registros, predictor);
        const y = columnaNumerica(datos.registros, desenlace);
        const res = informeValidacion(x, y, {
            mayorEsPositivo,
            sensibilidadMinima: (Number(sensibilidadMinima) || 90) / 100,
            nombrePredictor: predictor,
            nombreDesenlace: desenlace
        });
        if (!res.valido) { setMensaje(t(res.motivoKey)); setInforme(null); return; }
        setInforme(res);
        setMensaje(null);

        if (comparador && comparador !== predictor) {
            const z = columnaNumerica(datos.registros, comparador);
            setComparacion(compararAUCPareado(x, z, y, { mayorEsPositivoA: mayorEsPositivo, mayorEsPositivoB: mayorEsPositivo }));
        } else setComparacion(null);
    };

    const descargar = (nombre, contenido) => {
        const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
        const enlace = document.createElement('a');
        enlace.href = URL.createObjectURL(blob);
        enlace.setAttribute('download', nombre);
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
    };

    const exportarInforme = () => {
        if (!informe) return;
        const d = informe.discriminacion, e = informe.exactitudEnCorte;
        const f = [];
        f.push(['estadistico', 'valor', 'ic95_inferior', 'ic95_superior', 'metodo'].join(';'));
        f.push(['n', informe.n, '', '', ''].join(';'));
        f.push(['prevalencia', informe.prevalencia, '', '', ''].join(';'));
        f.push(['auc', d.auc, d.ic95.inferior, d.ic95.superior, d.ic95.metodo].join(';'));
        if (informe.bootstrap && informe.bootstrap.valido) {
            f.push(['auc', d.auc, informe.bootstrap.ic95.inferior, informe.bootstrap.ic95.superior,
                `${informe.bootstrap.ic95.metodo} (semilla ${informe.bootstrap.semilla})`].join(';'));
        }
        f.push(['auc_p', d.p, '', '', 'H0: area = 0.5'].join(';'));
        f.push(['corte_recomendado', informe.corteRecomendado, '', '', 'indice de Youden'].join(';'));
        if (e) {
            f.push(['sensibilidad', e.sensibilidad.estimacion, e.sensibilidad.inferior, e.sensibilidad.superior, 'Wilson'].join(';'));
            f.push(['especificidad', e.especificidad.estimacion, e.especificidad.inferior, e.especificidad.superior, 'Wilson'].join(';'));
            f.push(['vpp', e.valorPredictivoPositivo.estimacion, e.valorPredictivoPositivo.inferior, e.valorPredictivoPositivo.superior, 'Wilson'].join(';'));
            f.push(['vpn', e.valorPredictivoNegativo.estimacion, e.valorPredictivoNegativo.inferior, e.valorPredictivoNegativo.superior, 'Wilson'].join(';'));
            f.push(['razon_verosimilitud_positiva', e.razonVerosimilitudPositiva, '', '', ''].join(';'));
            f.push(['razon_verosimilitud_negativa', e.razonVerosimilitudNegativa, '', '', ''].join(';'));
            f.push(['vp;fp;fn;vn', `${e.matriz.vp};${e.matriz.fp};${e.matriz.fn};${e.matriz.vn}`].join(';'));
        }
        f.push(['correlacion_spearman', informe.correlacion.valido ? informe.correlacion.rho : '', '', '', ''].join(';'));
        f.push(['sello_motor', informe.sello, '', '', ''].join(';'));
        f.push(['predictor', informe.nombrePredictor, '', '', ''].join(';'));
        f.push(['desenlace', informe.nombreDesenlace, '', '', ''].join(';'));
        f.push('');
        f.push(['corte', 'sensibilidad', 'especificidad', 'youden', 'vp', 'fp', 'fn', 'vn'].join(';'));
        informe.cortes.tabla.forEach(r => f.push([r.corte, r.sensibilidad, r.especificidad, r.youden,
            r.matriz.vp, r.matriz.fp, r.matriz.fn, r.matriz.vn].join(';')));
        descargar(`validacion_${informe.nombrePredictor}_${informe.nombreDesenlace}.csv`, f.join('\r\n'));
    };

    const ic = (o) => o ? `${(o.estimacion * 100).toFixed(1)}% (${(o.inferior * 100).toFixed(1)}–${(o.superior * 100).toFixed(1)})` : '—';

    return (
        <div class="space-y-6">
            <div class="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl">
                <h2 class="font-bold text-sm uppercase tracking-wider text-blue-900 dark:text-blue-200 mb-1">{t('val_title')}</h2>
                <p class="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{t('val_intro')}</p>
            </div>

            {/* Fuente de datos */}
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-3">{t('val_data_source')}</h3>
                <div class="flex gap-2 mb-3">
                    <button onClick={() => setFuente('registro')}
                        class={'px-3 py-1.5 text-xs font-semibold rounded-lg ' + (fuente === 'registro' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>
                        {t('val_source_registry')} ({(registro || []).length})
                    </button>
                    <button onClick={() => setFuente('pegar')}
                        class={'px-3 py-1.5 text-xs font-semibold rounded-lg ' + (fuente === 'pegar' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>
                        {t('val_source_paste')}
                    </button>
                </div>

                {fuente === 'registro' ? (
                    <div>
                        <p class="text-[11px] text-slate-500 mb-2">{t('val_registry_note')}</p>
                        <button onClick={cargarDesdeRegistro} class="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg">
                            {t('val_load')}
                        </button>
                    </div>
                ) : (
                    <div>
                        <p class="text-[11px] text-slate-500 mb-2">{t('val_paste_note')}</p>
                        <textarea value={texto} onChange={(ev) => setTexto(ev.target.value)} rows="6"
                            placeholder={'codigo;riesgoOseoPuntaje;dxaDmoBaja\nP001;7;1\nP002;3;0'}
                            class="w-full text-[11px] font-mono p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"></textarea>
                        <button onClick={cargarDesdeTexto} class="mt-2 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg">
                            {t('val_load')}
                        </button>
                    </div>
                )}

                {datos && datos.valido ? (
                    <div class="mt-3 text-[11px] text-slate-600 dark:text-slate-400">
                        <span class="font-semibold">{datos.n}</span> {t('val_rows_loaded')} · {datos.columnas.length} {t('val_columns')}
                        {datos.codigosDuplicados && datos.codigosDuplicados.length ? (
                            <div class="text-amber-600 font-semibold mt-1">
                                {t('val_duplicates')}: {datos.codigosDuplicados.join(', ')}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {/* Selección de variables */}
            {datos && datos.valido ? (
                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                    <h3 class="font-bold text-sm uppercase tracking-wider mb-3">{t('val_variables')}</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">{t('val_predictor')}</label>
                            <select value={predictor} onChange={(ev) => setPredictor(ev.target.value)}
                                class="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <option value="">—</option>
                                {datos.columnasNumericas.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">{t('val_outcome')}</label>
                            <select value={desenlace} onChange={(ev) => setDesenlace(ev.target.value)}
                                class="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <option value="">—</option>
                                {datos.columnasBinarias.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div class="text-[10px] text-slate-400 mt-0.5">{t('val_outcome_note')}</div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-600 mb-1">{t('val_comparator')}</label>
                            <select value={comparador} onChange={(ev) => setComparador(ev.target.value)}
                                class="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <option value="">—</option>
                                {datos.columnasNumericas.filter(c => c !== predictor).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div class="text-[10px] text-slate-400 mt-0.5">{t('val_comparator_note')}</div>
                        </div>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                                <input type="checkbox" checked={mayorEsPositivo} onChange={(ev) => setMayorEsPositivo(ev.target.checked)} />
                                {t('val_higher_is_positive')}
                            </label>
                            <div class="text-[10px] text-slate-400">{t('val_direction_note')}</div>
                            <div>
                                <label class="block text-[11px] font-semibold text-slate-600 mb-1">{t('val_min_sensitivity')}</label>
                                <input type="number" min="50" max="100" value={sensibilidadMinima}
                                    onChange={(ev) => setSensibilidadMinima(ev.target.value)}
                                    class="w-24 px-2 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" />
                            </div>
                        </div>
                    </div>
                    <button onClick={ejecutar} class="mt-4 px-5 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg">
                        <i class="fa-solid fa-chart-line mr-2"></i>{t('val_run')}
                    </button>
                </div>
            ) : null}

            {mensaje ? (
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">{mensaje}</div>
            ) : null}

            {/* Resultados */}
            {informe ? (
                <div class="space-y-6">
                    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <div class="flex items-start justify-between flex-wrap gap-3 mb-4">
                            <div>
                                <h3 class="font-bold text-sm uppercase tracking-wider">{t('val_discrimination')}</h3>
                                <p class="text-[11px] text-slate-500">
                                    {informe.nombrePredictor} → {informe.nombreDesenlace} · n={informe.n} ·
                                    {' '}{t('val_prevalence')} {(informe.prevalencia * 100).toFixed(1)}%
                                    {informe.descartadosPorDatoFaltante > 0
                                        ? ` · ${informe.descartadosPorDatoFaltante} ${t('val_discarded')}` : ''}
                                </p>
                            </div>
                            <button onClick={exportarInforme} class="px-3 py-1.5 bg-slate-800 text-white text-[11px] font-semibold rounded-lg">
                                <i class="fa-solid fa-download mr-1"></i>{t('val_export')}
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <GraficoROC roc={informe.discriminacion} t={t} />
                            <div class="space-y-2 text-xs">
                                <div class="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                    <span class="text-slate-500">{t('val_auc')}</span>
                                    <span class="font-bold">{informe.discriminacion.auc.toFixed(3)}</span>
                                </div>
                                <div class="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                    <span class="text-slate-500">IC 95% (Hanley-McNeil)</span>
                                    <span class="font-semibold">{informe.discriminacion.ic95.inferior.toFixed(3)}–{informe.discriminacion.ic95.superior.toFixed(3)}</span>
                                </div>
                                {informe.bootstrap && informe.bootstrap.valido ? (
                                    <div class="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                        <span class="text-slate-500">IC 95% ({t('val_bootstrap')})</span>
                                        <span class="font-semibold">{informe.bootstrap.ic95.inferior.toFixed(3)}–{informe.bootstrap.ic95.superior.toFixed(3)}</span>
                                    </div>
                                ) : null}
                                <div class="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                    <span class="text-slate-500">{t('val_p_vs_chance')}</span>
                                    <span class="font-semibold">{informe.discriminacion.p !== null ? informe.discriminacion.p.toExponential(2) : '—'}</span>
                                </div>
                                <div class="flex justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                                    <span class="text-slate-500">{t('val_spearman')}</span>
                                    <span class="font-semibold">{informe.correlacion.valido ? informe.correlacion.rho.toFixed(3) : '—'}</span>
                                </div>
                                <div class="flex justify-between py-1">
                                    <span class="text-slate-500">{t('val_two_routes')}</span>
                                    <span class="font-mono text-[10px]">{informe.discriminacion.discrepanciaVias}</span>
                                </div>
                                <p class="text-[10px] text-slate-400 leading-relaxed pt-2">{t('val_bootstrap_note')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Exactitud en el corte */}
                    {informe.exactitudEnCorte ? (
                        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 class="font-bold text-sm uppercase tracking-wider mb-1">{t('val_accuracy')}</h3>
                            <p class="text-[11px] text-slate-500 mb-4">
                                {t('val_at_cutoff')} <span class="font-bold">{mayorEsPositivo ? '≥' : '≤'} {informe.corteRecomendado}</span> ({t('val_by_youden')})
                            </p>
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {[
                                    ['val_sensitivity', informe.exactitudEnCorte.sensibilidad],
                                    ['val_specificity', informe.exactitudEnCorte.especificidad],
                                    ['val_ppv', informe.exactitudEnCorte.valorPredictivoPositivo],
                                    ['val_npv', informe.exactitudEnCorte.valorPredictivoNegativo]
                                ].map(([clave, obj]) => (
                                    <div key={clave} class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                        <div class="text-[10px] uppercase font-bold text-slate-500">{t(clave)}</div>
                                        <div class="text-sm font-bold">{ic(obj)}</div>
                                    </div>
                                ))}
                            </div>
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div><span class="text-slate-500">RV+</span> <span class="font-bold">{informe.exactitudEnCorte.razonVerosimilitudPositiva ?? '—'}</span></div>
                                <div><span class="text-slate-500">RV−</span> <span class="font-bold">{informe.exactitudEnCorte.razonVerosimilitudNegativa ?? '—'}</span></div>
                                <div><span class="text-slate-500">Youden</span> <span class="font-bold">{informe.exactitudEnCorte.indiceYouden}</span></div>
                                <div><span class="text-slate-500">{t('val_dor')}</span> <span class="font-bold">{informe.exactitudEnCorte.razonMomiosDiagnostica ?? '—'}</span></div>
                            </div>

                            <div class="mt-4 overflow-x-auto">
                                <table class="text-[11px] border-collapse">
                                    <tbody>
                                        <tr>
                                            <td class="p-1"></td>
                                            <td class="p-1 font-bold text-center">{t('val_outcome_pos')}</td>
                                            <td class="p-1 font-bold text-center">{t('val_outcome_neg')}</td>
                                        </tr>
                                        <tr>
                                            <td class="p-1 font-bold">{t('val_test_pos')}</td>
                                            <td class="p-2 text-center bg-emerald-50 dark:bg-emerald-900/20 font-bold">{informe.exactitudEnCorte.matriz.vp}</td>
                                            <td class="p-2 text-center bg-rose-50 dark:bg-rose-900/20 font-bold">{informe.exactitudEnCorte.matriz.fp}</td>
                                        </tr>
                                        <tr>
                                            <td class="p-1 font-bold">{t('val_test_neg')}</td>
                                            <td class="p-2 text-center bg-rose-50 dark:bg-rose-900/20 font-bold">{informe.exactitudEnCorte.matriz.fn}</td>
                                            <td class="p-2 text-center bg-emerald-50 dark:bg-emerald-900/20 font-bold">{informe.exactitudEnCorte.matriz.vn}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p class="text-[10px] text-slate-400 mt-3 leading-relaxed">{t('stats_ppv_depends_on_prevalence')}</p>
                        </div>
                    ) : null}

                    {/* Tabla de cortes */}
                    <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                        <h3 class="font-bold text-sm uppercase tracking-wider mb-1">{t('val_cutoff_table')}</h3>
                        <p class="text-[11px] text-slate-500 mb-3">{t('stats_cutoff_is_a_decision')}</p>
                        <div class="overflow-x-auto">
                            <table class="w-full text-[11px]">
                                <thead>
                                    <tr class="text-left border-b border-slate-200 dark:border-slate-800">
                                        <th class="py-1.5 pr-3">{t('val_cutoff')}</th>
                                        <th class="py-1.5 pr-3">{t('val_sensitivity')}</th>
                                        <th class="py-1.5 pr-3">{t('val_specificity')}</th>
                                        <th class="py-1.5 pr-3">Youden</th>
                                        <th class="py-1.5 pr-3">VP/FP/FN/VN</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {informe.cortes.tabla.map(r => {
                                        const esYouden = r.corte === informe.cortes.porYouden.corte;
                                        const esSens = informe.cortes.porSensibilidadMinima && r.corte === informe.cortes.porSensibilidadMinima.corte;
                                        return (
                                            <tr key={r.corte} class={'border-b border-slate-100 dark:border-slate-800 ' + (esYouden ? 'bg-brand-50 dark:bg-brand-950/20 font-semibold' : '')}>
                                                <td class="py-1.5 pr-3">
                                                    {mayorEsPositivo ? '≥' : '≤'} {r.corte}
                                                    {esYouden ? <span class="ml-1 text-[9px] text-brand-700 font-bold">YOUDEN</span> : null}
                                                    {esSens ? <span class="ml-1 text-[9px] text-emerald-700 font-bold">SENS</span> : null}
                                                </td>
                                                <td class="py-1.5 pr-3">{(r.sensibilidad * 100).toFixed(1)}%</td>
                                                <td class="py-1.5 pr-3">{(r.especificidad * 100).toFixed(1)}%</td>
                                                <td class="py-1.5 pr-3">{r.youden.toFixed(3)}</td>
                                                <td class="py-1.5 pr-3 font-mono text-[10px]">{r.matriz.vp}/{r.matriz.fp}/{r.matriz.fn}/{r.matriz.vn}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Calibración */}
                    {informe.calibracion && informe.calibracion.valido ? (
                        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 class="font-bold text-sm uppercase tracking-wider mb-1">{t('val_calibration')}</h3>
                            <p class="text-[11px] text-slate-500 mb-4">{t('stats_calibration_vs_discrimination')}</p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <GraficoCalibracion calib={informe.calibracion} t={t} />
                                <div class="text-xs">
                                    <div class={'mb-2 font-semibold ' + (informe.calibracion.monotona ? 'text-emerald-600' : 'text-amber-600')}>
                                        {informe.calibracion.monotona ? t('val_monotonic_ok') : t('val_monotonic_fail')}
                                    </div>
                                    <table class="w-full text-[11px]">
                                        <thead>
                                            <tr class="text-left border-b border-slate-200 dark:border-slate-800">
                                                <th class="py-1">{t('val_group')}</th>
                                                <th class="py-1">n</th>
                                                <th class="py-1">{t('val_mean_score')}</th>
                                                <th class="py-1">{t('val_observed')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {informe.calibracion.grupos.map(g => (
                                                <tr key={g.grupo} class="border-b border-slate-100 dark:border-slate-800">
                                                    <td class="py-1">{g.grupo}</td>
                                                    <td class="py-1">{g.n}</td>
                                                    <td class="py-1">{g.puntajeMedio}</td>
                                                    <td class="py-1">{(g.proporcionObservada * 100).toFixed(0)}% ({(g.ic95.inferior * 100).toFixed(0)}–{(g.ic95.superior * 100).toFixed(0)})</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Comparación de predictores */}
                    {comparacion && comparacion.valido ? (
                        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                            <h3 class="font-bold text-sm uppercase tracking-wider mb-1">{t('val_comparison')}</h3>
                            <p class="text-[11px] text-slate-500 mb-3">{t('val_comparison_note')}</p>
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div><div class="text-[10px] uppercase text-slate-500">{predictor}</div><div class="font-bold">{comparacion.aucA.toFixed(3)}</div></div>
                                <div><div class="text-[10px] uppercase text-slate-500">{comparador}</div><div class="font-bold">{comparacion.aucB.toFixed(3)}</div></div>
                                <div><div class="text-[10px] uppercase text-slate-500">{t('val_difference')}</div><div class="font-bold">{comparacion.diferencia.toFixed(3)}</div></div>
                                <div>
                                    <div class="text-[10px] uppercase text-slate-500">IC 95%</div>
                                    <div class="font-bold">{comparacion.ic95.inferior.toFixed(3)}–{comparacion.ic95.superior.toFixed(3)}</div>
                                </div>
                            </div>
                            <div class={'mt-3 text-xs font-semibold ' + (comparacion.diferenciaSignificativa ? 'text-brand-700' : 'text-slate-500')}>
                                {comparacion.diferenciaSignificativa ? t('val_diff_significant') : t('val_diff_not_significant')}
                            </div>
                        </div>
                    ) : null}

                    <div class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] text-slate-500 font-mono">
                        {informe.sello} · {informe.generado}
                    </div>
                </div>
            ) : null}
        </div>
    );
};


// ------------------------------------------------------------
// 6. PANEL DE METODOLOGÍA
// ------------------------------------------------------------
const PanelMetodologia = ({ t, filaEjemplo }) => {
    const [grado, setGrado] = useState('todos');

    const descargar = (nombre, contenido) => {
        const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' });
        const enlace = document.createElement('a');
        enlace.href = URL.createObjectURL(blob);
        enlace.setAttribute('download', nombre);
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
    };

    const grados = ['todos', 'medido', 'consenso', 'derivado', 'estimado', 'heuristico'];
    const visibles = grado === 'todos' ? REGISTRO_PARAMETROS : REGISTRO_PARAMETROS.filter(p => p.grado === grado);
    const pendientes = parametrosPorGrado('heuristico');
    const conteo = {};
    REGISTRO_PARAMETROS.forEach(p => { conteo[p.grado] = (conteo[p.grado] || 0) + 1; });
    const cobertura = typeof auditarCoberturaDiccionario === 'function' && filaEjemplo
        ? auditarCoberturaDiccionario(filaEjemplo) : null;

    const colorGrado = (g) => g === 'medido' ? 'emerald'
        : g === 'consenso' ? 'emerald'
        : g === 'derivado' ? 'amber'
        : g === 'estimado' ? 'amber' : 'rose';

    return (
        <div class="space-y-6">
            <div class="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl">
                <h2 class="font-bold text-sm uppercase tracking-wider text-blue-900 dark:text-blue-200 mb-1">{t('meth_title')}</h2>
                <p class="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{t('meth_intro')}</p>
                <div class="mt-3 font-mono text-[11px] text-blue-900 dark:text-blue-200">{CARDA_SELLO}</div>
            </div>

            {/* Parámetros pendientes de calibración */}
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900 p-5">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-1 text-rose-700 dark:text-rose-300">
                    <i class="fa-solid fa-flask-vial mr-2"></i>{t('meth_pending_title')}
                </h3>
                <p class="text-[11px] text-slate-500 mb-3">{t('meth_pending_intro')}</p>
                <ul class="space-y-2">
                    {pendientes.map(p => (
                        <li key={p.clave} class="text-xs">
                            <span class="font-mono font-bold">{p.clave}</span>
                            <span class="text-slate-500"> = {String(p.valor)} {p.unidad}</span>
                            <div class="text-[10px] text-slate-500">{p.fuente}</div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Registro de parámetros */}
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-1">{t('meth_registry_title')}</h3>
                <p class="text-[11px] text-slate-500 mb-3">{t('meth_registry_intro')}</p>
                <div class="flex flex-wrap gap-1.5 mb-3">
                    {grados.map(g => (
                        <button key={g} onClick={() => setGrado(g)}
                            class={'px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ' +
                                (grado === g ? 'bg-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>
                            {t('meth_grade_' + g)}{g !== 'todos' ? ` (${conteo[g] || 0})` : ` (${REGISTRO_PARAMETROS.length})`}
                        </button>
                    ))}
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-[11px]">
                        <thead>
                            <tr class="text-left border-b border-slate-200 dark:border-slate-800">
                                <th class="py-1.5 pr-3">{t('meth_param')}</th>
                                <th class="py-1.5 pr-3">{t('meth_value')}</th>
                                <th class="py-1.5 pr-3">{t('meth_grade')}</th>
                                <th class="py-1.5">{t('meth_source')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibles.map(p => (
                                <tr key={p.clave} class="border-b border-slate-100 dark:border-slate-800 align-top">
                                    <td class="py-1.5 pr-3 font-mono">{p.clave}</td>
                                    <td class="py-1.5 pr-3 whitespace-nowrap">{String(p.valor)} <span class="text-slate-400">{p.unidad}</span></td>
                                    <td class="py-1.5 pr-3"><Etiqueta texto={t('meth_grade_' + p.grado)} colorKey={colorGrado(p.grado)} /></td>
                                    <td class="py-1.5 text-slate-500">{p.fuente}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Diccionario de datos */}
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-1">{t('meth_codebook_title')}</h3>
                <p class="text-[11px] text-slate-500 mb-3">{t('meth_codebook_intro')}</p>
                <div class="flex flex-wrap gap-2">
                    <button onClick={() => descargar('cald_diccionario_datos.csv', generarCodebookCSV())}
                        class="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg">
                        <i class="fa-solid fa-download mr-1"></i>{t('meth_download_codebook')}
                    </button>
                    <button onClick={() => descargar('cald_redcap_diccionario.csv', generarREDCapDiccionarioCSV())}
                        class="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700">
                        <i class="fa-solid fa-download mr-1"></i>{t('meth_download_redcap')}
                    </button>
                </div>
                <div class="mt-3 text-[11px] text-slate-500">
                    {DICCIONARIO_DATOS.length} {t('meth_tool_fields')} · {CAMPOS_PATRON_ORO.length} {t('meth_goldstandard_fields')}
                </div>
                {cobertura && cobertura.sinDocumentar.length ? (
                    <div class="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800">
                        {t('meth_undocumented')}: {cobertura.sinDocumentar.join(', ')}
                    </div>
                ) : null}
            </div>

            {/* Lo que la herramienta no hace */}
            <div class="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-2">{t('meth_limits_title')}</h3>
                <ul class="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {['meth_limit_1', 'meth_limit_2', 'meth_limit_3', 'meth_limit_4', 'meth_limit_5', 'meth_limit_6'].map(k => (
                        <li key={k} class="flex items-start gap-2">
                            <i class="fa-solid fa-xmark text-rose-500 mt-0.5 text-[10px]"></i>
                            <span>{t(k)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};


// ------------------------------------------------------------
// 6. PANEL DE INTERPRETACIÓN DE LABORATORIO
// ------------------------------------------------------------
// Hasta la v6.0 la interpretación bioquímica vivía dentro de la pantalla
// de tamizaje, mezclada con la captura de datos. Se traslada a su propia
// pestaña por dos razones: la consulta de referencia se hace con el
// informe del laboratorio delante y sin estar rellenando la ficha, y el
// contenido es doctrinal —qué significa cada analito y qué patrones
// forman entre ellos—, no dependiente del participante.
//
// El énfasis está en los PATRONES, no en los valores aislados: el
// hiperparatiroidismo secundario a insuficiencia de vitamina D no se
// diagnostica mirando la paratohormona ni la vitamina D por separado,
// sino su combinación con el calcio corregido.
const PanelLaboratorio = ({ t }) => {
    const analitos = [
        { key: 'lab_i_vitd',    rango: '30–50 ng/mL', grupo: 'lab_g_vitd' },
        { key: 'lab_i_pth',     rango: '15–65 pg/mL', grupo: 'lab_g_vitd' },
        { key: 'lab_i_calcium', rango: '8.5–10.5 mg/dL', grupo: 'lab_g_mineral' },
        { key: 'lab_i_albumin', rango: '3.5–5.0 g/dL', grupo: 'lab_g_mineral' },
        { key: 'lab_i_phos',    rango: '2.5–4.5 mg/dL', grupo: 'lab_g_mineral' },
        { key: 'lab_i_alp',     rango: '40–129 U/L', grupo: 'lab_g_turnover' },
        { key: 'lab_i_mg',      rango: '1.7–2.2 mg/dL', grupo: 'lab_g_cofactor' },
        { key: 'lab_i_creat',   rango: '0.6–1.2 mg/dL', grupo: 'lab_g_renal' },
        { key: 'lab_i_ucalcium', rango: '<250 mg/24 h (M) · <300 (H)', grupo: 'lab_g_renal' }
    ];
    const patrones = ['lab_p_shpt', 'lab_p_osteomalacia', 'lab_p_hypercalciuria',
                      'lab_p_primary_hpt', 'lab_p_mg_resistant', 'lab_p_ckd'];

    return (
        <div class="max-w-5xl mx-auto flex flex-col gap-6">
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 class="text-lg font-extrabold text-slate-900 dark:text-white mb-1">{t('lab_title')}</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('lab_intro')}</p>
                <div class="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                    <p class="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i>{t('lab_disclaimer_clinical')}
                    </p>
                </div>
            </div>

            {/* Analito por analito */}
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-4 text-slate-800 dark:text-slate-200">{t('lab_analytes_title')}</h3>
                <div class="flex flex-col gap-3">
                    {analitos.map(a => (
                        <div key={a.key} class="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
                            <div class="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                                <span class="text-sm font-bold text-slate-800 dark:text-slate-200">{t(a.key + '_name')}</span>
                                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">{a.rango}</span>
                            </div>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{t(a.key + '_desc')}</p>
                        </div>
                    ))}
                </div>
                <p class="text-[10px] text-slate-400 mt-4 leading-relaxed">{t('lab_ranges_note')}</p>
            </div>

            {/* Patrones: es donde está el valor interpretativo */}
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-1 text-slate-800 dark:text-slate-200">{t('lab_patterns_title')}</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">{t('lab_patterns_intro')}</p>
                <div class="flex flex-col gap-3">
                    {patrones.map(k => (
                        <div key={k} class="p-4 rounded-xl border-l-4 border-brand-400 bg-brand-50/40 dark:bg-brand-950/20">
                            <p class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">{t(k + '_name')}</p>
                            <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{t(k + '_desc')}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Fórmulas que la herramienta aplica */}
            <div class="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-3 text-slate-800 dark:text-slate-200">{t('lab_formulas_title')}</h3>
                <div class="flex flex-col gap-3">
                    {['lab_f_payne', 'lab_f_ckdepi', 'lab_f_cacr'].map(k => (
                        <div key={k}>
                            <p class="text-xs font-bold text-slate-700 dark:text-slate-300">{t(k + '_name')}</p>
                            <p class="text-[10px] font-mono text-brand-700 dark:text-brand-400 my-1">{t(k + '_eq')}</p>
                            <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{t(k + '_desc')}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


// ------------------------------------------------------------
// 7. PANEL DE BIBLIOGRAFÍA
// ------------------------------------------------------------
// Las referencias estaban repartidas entre los comentarios del código, el
// registro de parámetros y los textos de la interfaz. Reunirlas en una
// pestaña cumple dos funciones: el profesional puede comprobar de dónde
// sale cada cifra, y el estudio de validación tiene la lista de citas
// lista para la sección de métodos.
//
// El listado se genera DESDE el registro de parámetros, no se escribe a
// mano: así no puede quedar desincronizado con el modelo. Si alguien
// añade un parámetro con su fuente, la referencia aparece aquí sola.
const PanelBibliografia = ({ t }) => {
    const registro = typeof REGISTRO_PARAMETROS !== 'undefined' ? REGISTRO_PARAMETROS : [];

    // Una fuente puede respaldar varios parámetros: se agrupa para no
    // repetir la misma cita tantas veces como constantes sostiene.
    const porFuente = {};
    registro.forEach(p => {
        const f = (p.fuente || '').trim();
        if (!f) return;
        if (!porFuente[f]) porFuente[f] = { fuente: f, claves: [], grados: new Set() };
        porFuente[f].claves.push(p.clave);
        porFuente[f].grados.add(p.grado);
    });
    const fuentes = Object.values(porFuente).sort((a, b) => a.fuente.localeCompare(b.fuente));

    const colorGrado = {
        medido: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        consenso: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
        derivado: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
        estimado: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
        heuristico: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
    };

    return (
        <div class="max-w-5xl mx-auto flex flex-col gap-6">
            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 class="text-lg font-extrabold text-slate-900 dark:text-white mb-1">{t('biblio_title')}</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('biblio_intro')}</p>
                <p class="text-[11px] text-slate-400 mt-3 leading-relaxed">
                    {t('biblio_generated_note').replace('{n}', String(fuentes.length)).replace('{p}', String(registro.length))}
                </p>
            </div>

            <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <ol class="flex flex-col gap-3">
                    {fuentes.map((f, i) => (
                        <li key={f.fuente} class="flex gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <span class="shrink-0 w-6 text-right text-[11px] font-mono text-slate-400 pt-0.5">{i + 1}.</span>
                            <div class="min-w-0">
                                <p class="text-[12px] text-slate-700 dark:text-slate-300 leading-relaxed">{f.fuente}</p>
                                <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                                    {[...f.grados].map(g => (
                                        <span key={g} class={'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ' + (colorGrado[g] || 'bg-slate-100 text-slate-700')}>
                                            {t('grade_' + g)}
                                        </span>
                                    ))}
                                    <span class="text-[9px] font-mono text-slate-400">{f.claves.join(' · ')}</span>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            </div>

            <div class="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 class="font-bold text-sm uppercase tracking-wider mb-3 text-slate-800 dark:text-slate-200">{t('biblio_instruments_title')}</h3>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">{t('biblio_instruments_intro')}</p>
                <ul class="flex flex-col gap-2">
                    {['biblio_inst_ost', 'biblio_inst_orai', 'biblio_inst_frax_excluded'].map(k => (
                        <li key={k} class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed flex gap-2">
                            <i class="fa-solid fa-angle-right text-brand-500 mt-1 text-[9px]"></i><span>{t(k)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
