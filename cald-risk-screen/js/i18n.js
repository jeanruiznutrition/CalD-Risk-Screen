// ============================================================
// CalD Risk Screen — Registro de idiomas
// ============================================================
// Cada idioma vive en su propio archivo dentro de js/i18n/. Este
// archivo solo los ensambla y decide cuáles ofrecer.
//
// CRITERIO DE PUBLICACIÓN: un idioma solo aparece en el selector si
// está COMPLETO respecto al español, que es el idioma de referencia.
// Una interfaz a medio traducir, con frases sueltas en otro idioma,
// resulta peor que no ofrecer ese idioma. La verificación se hace
// automáticamente al cargar, comparando claves.
// ============================================================

const IDIOMA_REFERENCIA = 'es';

const IDIOMAS_DISPONIBLES = [
    { id: 'es', nombre: 'Español',   nombreIngles: 'Spanish',    bandera: '🇪🇸' },
    { id: 'en', nombre: 'English',   nombreIngles: 'English',    bandera: '🇬🇧' },
    { id: 'pt', nombre: 'Português', nombreIngles: 'Portuguese', bandera: '🇵🇹' },
    { id: 'fi', nombre: 'Suomi',     nombreIngles: 'Finnish',    bandera: '🇫🇮' },
    { id: 'de', nombre: 'Deutsch',   nombreIngles: 'German',     bandera: '🇩🇪' },
    { id: 'it', nombre: 'Italiano',  nombreIngles: 'Italian',    bandera: '🇮🇹' },
    { id: 'ko', nombre: '한국어',      nombreIngles: 'Korean',     bandera: '🇰🇷' },
    { id: 'ja', nombre: '日本語',      nombreIngles: 'Japanese',   bandera: '🇯🇵' }
];

// Ensamblado: cada archivo de idioma define una constante TRADUCCION_XX.
// Si el archivo no se cargó, la entrada simplemente no existe.
const TRANSLATIONS = {};
const _registrar = (id, obj) => { if (obj && typeof obj === 'object') TRANSLATIONS[id] = obj; };

_registrar('es', typeof TRADUCCION_ES !== 'undefined' ? TRADUCCION_ES : null);
_registrar('en', typeof TRADUCCION_EN !== 'undefined' ? TRADUCCION_EN : null);
_registrar('pt', typeof TRADUCCION_PT !== 'undefined' ? TRADUCCION_PT : null);
_registrar('fi', typeof TRADUCCION_FI !== 'undefined' ? TRADUCCION_FI : null);
_registrar('de', typeof TRADUCCION_DE !== 'undefined' ? TRADUCCION_DE : null);
_registrar('it', typeof TRADUCCION_IT !== 'undefined' ? TRADUCCION_IT : null);
_registrar('ko', typeof TRADUCCION_KO !== 'undefined' ? TRADUCCION_KO : null);
_registrar('ja', typeof TRADUCCION_JA !== 'undefined' ? TRADUCCION_JA : null);

// Cobertura de cada idioma respecto al de referencia.
const calcularCoberturaIdioma = (id) => {
    const ref = TRANSLATIONS[IDIOMA_REFERENCIA];
    const idioma = TRANSLATIONS[id];
    if (!ref || !idioma) return { cobertura: 0, faltantes: [], completo: false };

    const clavesRef = Object.keys(ref);
    const faltantes = clavesRef.filter(k => !idioma[k]);
    const cobertura = Math.round(((clavesRef.length - faltantes.length) / clavesRef.length) * 1000) / 10;
    return { cobertura, faltantes, completo: faltantes.length === 0 };
};

// Solo los idiomas completos llegan al selector.
const IDIOMAS_PUBLICADOS = IDIOMAS_DISPONIBLES.filter(l => calcularCoberturaIdioma(l.id).completo);

// Detección del idioma del navegador, con reserva al español.
const detectarIdiomaInicial = () => {
    try {
        const guardado = localStorage.getItem('cald_idioma');
        if (guardado && IDIOMAS_PUBLICADOS.some(l => l.id === guardado)) return guardado;
    } catch (e) { /* almacenamiento no disponible: se continúa con la detección */ }

    const nav = (navigator.language || navigator.userLanguage || 'es').slice(0, 2).toLowerCase();
    return IDIOMAS_PUBLICADOS.some(l => l.id === nav) ? nav : IDIOMA_REFERENCIA;
};

const guardarIdioma = (id) => {
    try { localStorage.setItem('cald_idioma', id); } catch (e) { /* sin persistencia */ }
};

// Traductor: busca en el idioma activo y recurre al español si falta la
// clave, de modo que una traducción incompleta nunca deja texto vacío.
const crearTraductor = (lang) => (clave) =>
    (TRANSLATIONS[lang] && TRANSLATIONS[lang][clave]) ||
    (TRANSLATIONS[IDIOMA_REFERENCIA] && TRANSLATIONS[IDIOMA_REFERENCIA][clave]) ||
    clave;
