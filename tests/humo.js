#!/usr/bin/env node
/* ============================================================
 * CalD Risk Screen — Prueba de humo del componente
 * ============================================================
 *
 * POR QUÉ EXISTE ESTA PRUEBA
 *
 * La suite de validacion.js comprueba que el MOTOR calcule bien, y
 * verificar el balance de llaves comprueba que el archivo esté bien
 * formado. Ninguna de las dos detecta el fallo más común y más grave
 * de la interfaz: usar una constante antes de declararla.
 *
 * En JavaScript, `const` no se eleva. Si un useMemo usa el resultado de
 * otro que está escrito más abajo, el archivo es sintácticamente válido
 * y pasa todas las revisiones estáticas, pero al ejecutarse lanza
 * "Cannot access before initialization" y React no monta nada: el
 * usuario ve una pantalla en blanco o gris, sin ninguna pista.
 *
 * Esta prueba ejecuta el cuerpo real del componente con hooks
 * simulados, hasta el punto donde empieza el JSX. Con eso basta para
 * detectar referencias rotas, orden incorrecto de declaraciones y
 * funciones inexistentes, que es donde se concentran esos fallos.
 *
 *     node tests/humo.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const rutaJs = path.join(raiz, 'js');

// --- Motor y datos: se cargan tal cual ---
// El orden es el mismo que el de index.html: data.js define las
// constantes que algorithm.js consume, y biomarkers.js depende de las dos.
const ARCHIVOS_MOTOR = ['data.js', 'algorithm.js', 'biomarkers.js', 'validation.js', 'codebook.js'];
const fuenteMotor = ARCHIVOS_MOTOR
    .map(f => fs.readFileSync(path.join(rutaJs, f), 'utf8'))
    .join('\n');

// --- Idiomas ---
const dirI18n = path.join(rutaJs, 'i18n');
const fuenteI18n = fs.readdirSync(dirI18n)
    .filter(f => f.endsWith('.js'))
    .map(f => fs.readFileSync(path.join(dirI18n, f), 'utf8'))
    .join('\n') + '\n' + fs.readFileSync(path.join(rutaJs, 'i18n.js'), 'utf8');

// --- Componente: se toma solo la lógica, sin el JSX ---
const fuenteApp = fs.readFileSync(path.join(rutaJs, 'app.js'), 'utf8');

const inicioCuerpo = fuenteApp.indexOf('function App() {');
if (inicioCuerpo < 0) {
    console.error('No se encontró la función App en app.js');
    process.exit(1);
}

// El JSX empieza en el `return (` de la función. Todo lo anterior es
// lógica ejecutable en Node sin necesidad de compilar JSX.
const marcadorReturn = fuenteApp.indexOf('\n    return (', inicioCuerpo);
if (marcadorReturn < 0) {
    console.error('No se encontró el return del componente');
    process.exit(1);
}

const cuerpoLogica = fuenteApp.slice(
    inicioCuerpo + 'function App() {'.length,
    marcadorReturn
);

// Todo lo que app.js declara ANTES del componente (constantes de módulo,
// ayudantes de autoguardado, fábricas de alimentos). Se ejecuta aparte,
// porque el cuerpo del componente los usa y sin ellos la prueba fallaría
// con un ReferenceError que no corresponde a un defecto real.
const preludioApp = fuenteApp.slice(0, inicioCuerpo);

// --- Hooks simulados ---
// useState devuelve el valor inicial; useMemo y useEffect ejecutan su
// función de inmediato. Es suficiente para recorrer todas las
// declaraciones en el orden en que están escritas.
const React = {
    useState: (inicial) => [typeof inicial === 'function' ? inicial() : inicial, () => {}],
    useEffect: (fn) => { try { fn(); } catch (e) { /* efectos del DOM no aplican aquí */ } },
    useMemo: (fn) => fn(),
    // El límite de error de la v6.0 es un componente de clase, que es la
    // única forma de capturar errores de render en React.
    Component: class ComponenteSimulado {
        constructor(props) { this.props = props || {}; this.state = {}; }
        setState(parcial) { Object.assign(this.state, typeof parcial === 'function' ? parcial(this.state) : parcial); }
    }
};

const documentSimulado = {
    documentElement: { classList: { add() {}, remove() {} }, setAttribute() {} },
    createElement: () => ({ setAttribute() {}, click() {}, style: {} }),
    body: { appendChild() {}, removeChild() {}, classList: { add() {}, remove() {} } },
    getElementById: () => ({})
};

const entorno = {
    React,
    document: documentSimulado,
    navigator: { language: 'es' },
    localStorage: { getItem: () => null, setItem: () => {} },
    window: { print() {}, open() {}, URL: { createObjectURL: () => '' } },
    Blob: function () {},
    alert: () => {},
    ReactDOM: { createRoot: () => ({ render() {} }) }
};


// ------------------------------------------------------------
// TRANSFORMADOR MÍNIMO DE JSX
// ------------------------------------------------------------
// Convierte el JSX del componente en llamadas h(etiqueta, props, hijos)
// para poder EJECUTAR el render en Node, sin depender de Babel. Cubre el
// subconjunto de JSX que usa este proyecto: atributos con comillas o
// llaves, expresiones incrustadas, anidamiento y etiquetas autocerradas.
function transformarJSX(texto) {
    const finEtiqueta = (t, k) => {
        let j = k, d = 0, q = null;
        while (j < t.length) {
            const c = t[j];
            if (q) { if (c === q && t[j - 1] !== '\\') q = null; }
            else if (c === '"' || c === "'") q = c;
            else if (c === '{') d++;
            else if (c === '}') d--;
            else if (c === '>' && d === 0) return j;
            j++;
        }
        return -1;
    };

    const finLlave = (t, k) => {
        let j = k, d = 0, q = null;
        while (j < t.length) {
            const c = t[j];
            if (q) { if (c === q && t[j - 1] !== '\\') q = null; }
            else if (c === '"' || c === "'") q = c;
            else if (c === '{') d++;
            else if (c === '}') { d--; if (d === 0) return j; }
            j++;
        }
        return -1;
    };

    const parseProps = (raw) => {
        const props = [];
        let i = 0;
        while (i < raw.length) {
            const m = /^\s*([A-Za-z_][\w:-]*)\s*=\s*/.exec(raw.slice(i));
            if (!m) break;
            const nombre = m[1];
            i += m[0].length;
            if (raw[i] === '{') {
                const j = finLlave(raw, i);
                props.push(JSON.stringify(nombre) + ': (' + interno(raw.slice(i + 1, j)) + ')');
                i = j + 1;
            } else if (raw[i] === '"' || raw[i] === "'") {
                const q = raw[i], j = raw.indexOf(q, i + 1);
                props.push(JSON.stringify(nombre) + ': ' + JSON.stringify(raw.slice(i + 1, j)));
                i = j + 1;
            } else break;
        }
        return props.length ? '{' + props.join(', ') + '}' : 'null';
    };

    function parse(t, k) {
        const m = /^<\s*([A-Za-z][\w.]*)/.exec(t.slice(k));
        const nombre = m[1];
        const iniProps = k + m[0].length;
        const fin = finEtiqueta(t, iniProps);
        let raw = t.slice(iniProps, fin);
        const auto = raw.trimEnd().endsWith('/');
        if (auto) raw = raw.trimEnd().slice(0, -1);
        const props = parseProps(raw);
        const etiqueta = /^[a-z]/.test(nombre) ? JSON.stringify(nombre) : nombre;
        if (auto) return ['h(' + etiqueta + ', ' + props + ')', fin + 1];

        const hijos = [];
        let p = fin + 1;
        const reCierre = new RegExp('^</\\s*' + nombre.replace('.', '\\.') + '\\s*>');
        while (p < t.length) {
            if (t[p] === '<') {
                const mc = reCierre.exec(t.slice(p));
                if (mc) {
                    return ['h(' + etiqueta + ', ' + props + (hijos.length ? ', ' + hijos.join(', ') : '') + ')', p + mc[0].length];
                }
                const [code, p2] = parse(t, p);
                hijos.push(code); p = p2; continue;
            }
            if (t[p] === '{') {
                const j = finLlave(t, p);
                const expr = t.slice(p + 1, j);
                if (!expr.trim().startsWith('/*')) hijos.push('(' + interno(expr) + ')');
                p = j + 1; continue;
            }
            let j = p;
            while (j < t.length && t[j] !== '<' && t[j] !== '{') j++;
            const txt = t.slice(p, j).trim();
            if (txt) hijos.push(JSON.stringify(txt));
            p = j;
        }
        return ['h(' + etiqueta + ', ' + props + ')', p];
    }

    // Un `<` solo abre JSX si lo que viene antes NO puede ser un operando.
    // Sin esta comprobación, una comparación como `if (a < b)` se
    // interpretaba como el inicio de una etiqueta `<b>` y el
    // transformador destruía el código. El criterio es el carácter no
    // blanco anterior: si es alfanumérico, `)`, `]` o `.`, entonces el
    // `<` es un operador de comparación.
    const abreJSX = (x, p) => {
        if (!/^<\s*[A-Za-z]/.test(x.slice(p))) return false;
        let k = p - 1;
        while (k >= 0 && /\s/.test(x[k])) k--;
        if (k < 0) return true;
        if ('({[=>&|?:;,!+'.indexOf(x[k]) >= 0) return true;
        // `return <div>` sin paréntesis: el carácter anterior es una letra,
        // pero la palabra completa es una palabra clave y no un operando.
        return /(?:^|[^\w$])(return|case|yield|await|typeof|else|do)$/
            .test(x.slice(Math.max(0, k - 12), k + 1));
    };

    function interno(x) {
        let r = '', p = 0;
        while (p < x.length) {
            if (abreJSX(x, p)) {
                const [c, p2] = parse(x, p); r += c; p = p2;
            } else { r += x[p]; p++; }
        }
        return r;
    }

    return interno(texto);
}

let errores = [];
let advertencias = [];

try {
    const fn = new Function(
        'React', 'document', 'navigator', 'localStorage', 'window', 'Blob', 'alert', 'ReactDOM',
        fuenteMotor + '\n' + fuenteI18n + '\n' + preludioApp + '\n' +
        'function ejecutarLogica() {\n' + cuerpoLogica + '\n}\n' +
        'return ejecutarLogica();'
    );
    fn(entorno.React, entorno.document, entorno.navigator, entorno.localStorage,
       entorno.window, entorno.Blob, entorno.alert, entorno.ReactDOM);
} catch (e) {
    errores.push(e);
}



// ============================================================
// RENDER COMPLETO
// ============================================================
// La comprobación anterior ejecuta la lógica; ésta ejecuta además el
// JSX, que es donde aparecen los accesos a propiedades de objetos
// indefinidos. Ambos fallos dejan la pantalla en gris.
// Los paneles de la v6.0 viven en ui-panels.js, también con JSX. Se
// transforman igual y se declaran antes del componente principal, que es
// quien los usa.
const fuentePaneles = fs.readFileSync(path.join(rutaJs, 'ui-panels.js'), 'utf8');

let errorRender = null;
let panelesProbados = 0;
try {
    const finFuncion = fuenteApp.lastIndexOf('\n}\n\nconst root');
    const cuerpoCompleto = fuenteApp.slice(inicioCuerpo + 'function App() {'.length, finFuncion);
    const transformado = transformarJSX(cuerpoCompleto);
    const panelesTransformados = transformarJSX(fuentePaneles);

    const h = (tag, props, ...hijos) => {
        const recorrer = (x) => { if (Array.isArray(x)) x.forEach(recorrer); };
        hijos.forEach(recorrer);
        return { tag, props, hijos };
    };

    // Las pestañas solo montan el panel activo, así que renderizar App no
    // ejercita los paneles nuevos. Se renderizan a mano, con datos
    // plausibles, porque un fallo en la pestaña de Validación es tan
    // grave como uno en la de Tamizaje: deja la pantalla en gris igual.
    const pruebaDePaneles = `
        const t = crearTraductor('es');
        const panelEjemplo = evaluarPanelOseo({
            calcioSerico: 9.1, albumina: 3.9, vitD25OH: 14, pth: 88,
            fosforo: 3.1, fosfatasaAlcalina: 135, magnesio: 1.9,
            creatinina: 0.85, calcio24hMg: 190, edad: 61, sexo: 'femenino',
            pesoKg: 58, usaCreatina: true
        });
        const filaEjemplo = { codigo: 'P001', fecha: '2026-01-10', edad: 61, labPTH: 88 };
        const registroEjemplo = [
            { codigo: 'P001', riesgoOseoPuntaje: 7, dxaDmoBaja: 1 },
            { codigo: 'P002', riesgoOseoPuntaje: 2, dxaDmoBaja: 0 },
            { codigo: 'P003', riesgoOseoPuntaje: 5, dxaDmoBaja: 1 },
            { codigo: 'P004', riesgoOseoPuntaje: 3, dxaDmoBaja: 0 }
        ];
        LimiteDeError.prototype.render.call({ props: { children: null }, state: { error: null } });
        LimiteDeError.prototype.render.call({
            props: {}, state: { error: new Error('prueba'), info: { componentStack: 'x' } }
        });
        TarjetaBiomarcadores({ t, lab: { calcioSerico: 9.1, albumina: 3.9 }, onChange: () => {}, panel: panelEjemplo });
        PanelMetodologia({ t, filaEjemplo });
        PanelValidacion({ t, registro: registroEjemplo });
        const informe = informeValidacion([7, 2, 5, 3, 8, 1], [1, 0, 1, 0, 1, 0], { iteracionesBootstrap: 50 });
        GraficoROC({ roc: informe.discriminacion, t });
        GraficoCalibracion({ calib: calibracionPorGrupos([1,2,3,4,5,6,7,8], [0,0,0,1,0,1,1,1], { grupos: 2 }), t });
        GraficoBlandAltman({ ba: blandAltman([10, 12, 14, 16], [9, 10, 13, 17]), t });
        return 9;
    `;

    const fnRender = new Function(
        'React', 'h', 'document', 'navigator', 'localStorage', 'window', 'Blob', 'alert', 'ReactDOM', 'console',
        fuenteMotor + '\n' + fuenteI18n + '\n' + panelesTransformados + '\n' + preludioApp + '\n' +
        'function App() {\n' + transformado + '\n}\n' +
        'App();\n' +
        'return (function () {' + pruebaDePaneles + '})();'
    );
    panelesProbados = fnRender(React, h, documentSimulado, entorno.navigator, entorno.localStorage,
             entorno.window, entorno.Blob, entorno.alert, entorno.ReactDOM, { error() {} });
} catch (e) {
    errorRender = e;
    errores.push(e);
}

// ============================================================
// ARCHIVOS QUE index.html NECESITA
// ============================================================
// Si cualquiera de estos no llega al servidor, la aplicación no arranca
// y el usuario ve una pantalla en gris sin ninguna pista.
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const referenciados = [...html.matchAll(/src="([^"]+\.js)[^"]*"/g)]
    .map(m => m[1])
    .filter(r => !r.startsWith('http'));
const ausentes = referenciados.filter(r => !fs.existsSync(path.join(raiz, r)));
if (ausentes.length) {
    errores.push(new Error('index.html referencia archivos que no existen: ' + ausentes.join(', ')));
} else {
    advertencias.push(`ARCHIVOS_OK:${referenciados.length}`);
}

// --- Comprobaciones estáticas adicionales sobre el JSX ---

// Toda clave de traducción estática debe existir en el idioma de
// referencia, y además en los otros dos: una clave presente solo en
// español deja el inglés y el portugués mostrando texto castellano sin
// avisar, porque el traductor recurre al idioma de referencia en
// silencio. Eso es correcto en producción y hay que verlo en la prueba.
try {
    const ctx = new Function('navigator', 'localStorage',
        fuenteI18n + '; return TRANSLATIONS;'
    )(entorno.navigator, entorno.localStorage);
    const ref = ctx.es || {};
    // El patrón exige un límite de palabra antes de la t para no capturar
    // llamadas como createElement('a'), que no son traducciones.
    const fuenteConJSX = fuenteApp + '\n' + fuentePaneles;
    const clavesUsadas = [...fuenteConJSX.matchAll(/(?<![a-zA-Z0-9_.])t\('([a-zA-Z0-9_]+)'\)/g)].map(m => m[1]);
    const faltantes = [...new Set(clavesUsadas.filter(k => !ref[k]))];
    if (faltantes.length) {
        advertencias.push(`Claves de traducción sin definir en español: ${faltantes.join(', ')}`);
    }

    const clavesReferencia = Object.keys(ref);
    ['en', 'pt'].forEach(idioma => {
        const tabla = ctx[idioma] || {};
        const sinTraducir = clavesReferencia.filter(k => !tabla[k]);
        if (sinTraducir.length) {
            advertencias.push(`Idioma ${idioma}: ${sinTraducir.length} clave(s) sin traducir` +
                (sinTraducir.length <= 12 ? ` (${sinTraducir.join(', ')})` : ''));
        }
    });
} catch (e) {
    advertencias.push('No se pudieron verificar las claves de traducción: ' + e.message);
}

// NINGÚN NÚMERO DE VERSIÓN ESCRITO A MANO EN TEXTO VISIBLE.
// Esta comprobación existe por un fallo real: la v6.0 se publicó con la
// insignia del encabezado anunciando «CARDA v3.1», porque la versión
// estaba escrita como literal en cuatro sitios distintos —el encabezado,
// el informe exportado, la hoja del participante y las tres tablas de
// traducción— y cada uno se había quedado en un número diferente (v1.1,
// v2.6, v3.1). Todos derivan ahora de CARDA_VERSION; esto impide que
// alguien vuelva a escribirlo a mano.
try {
    const versionReal = new Function(
        fs.readFileSync(path.join(rutaJs, 'data.js'), 'utf8') + '; return CARDA_VERSION;'
    )();
    const literales = [];
    // En el JSX: CARDA v seguido de un dígito es un literal; la forma
    // correcta es CARDA v{CARDA_VERSION}.
    [['js/app.js', fuenteApp], ['js/ui-panels.js', fuentePaneles],
     ['js/i18n/es.js', fs.readFileSync(path.join(rutaJs, 'i18n', 'es.js'), 'utf8')],
     ['js/i18n/en.js', fs.readFileSync(path.join(rutaJs, 'i18n', 'en.js'), 'utf8')],
     ['js/i18n/pt.js', fs.readFileSync(path.join(rutaJs, 'i18n', 'pt.js'), 'utf8')]
    ].forEach(([nombre, texto]) => {
        texto.split('\n').forEach((linea, i) => {
            // Se ignoran los comentarios: ahí las referencias históricas
            // («hasta la v3.1 se restaba…») son legítimas y necesarias.
            const sinComentario = linea.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
            const m = sinComentario.match(/CARDA[ -]v(\d+\.\d+)/);
            if (m && m[1] !== versionReal) {
                literales.push(`${nombre}:${i + 1} anuncia la v${m[1]} en vez de la v${versionReal}`);
            }
        });
    });
    if (literales.length) {
        errores.push(new Error('Versión escrita a mano en texto visible: ' + literales.join(' · ')));
    } else {
        advertencias.push(`VERSION_OK:${versionReal}`);
    }
} catch (e) {
    advertencias.push('No se pudo verificar la coherencia de la versión: ' + e.message);
}

// El diccionario de datos tiene que cubrir todos los campos que se
// exportan. Sin esta comprobación el diccionario se queda obsoleto en la
// primera versión que añada una columna.
try {
    const ctxCodebook = new Function(
        fs.readFileSync(path.join(rutaJs, 'codebook.js'), 'utf8') +
        '; return { DICCIONARIO_COMPLETO };'
    )();
    const documentados = new Set(ctxCodebook.DICCIONARIO_COMPLETO.map(f => f.campo));
    // Campos que el constructor de la fila produce, leídos del código
    const bloqueFila = fuenteApp.slice(
        fuenteApp.indexOf('const construirFilaParticipante'),
        fuenteApp.indexOf('const guardarEnRegistro')
    );
    const camposExportados = [...bloqueFila.matchAll(/^\s{8}([a-zA-Z][a-zA-Z0-9_]*):/gm)].map(m => m[1]);
    const sinDocumentar = [...new Set(camposExportados.filter(c => !documentados.has(c)))];
    if (sinDocumentar.length) {
        advertencias.push(`Campos exportados sin entrada en el diccionario de datos: ${sinDocumentar.join(', ')}`);
    }
} catch (e) {
    advertencias.push('No se pudo verificar la cobertura del diccionario: ' + e.message);
}

// --- Informe ---
const VERDE = '\x1b[32m', ROJO = '\x1b[31m', AMARILLO = '\x1b[33m', GRIS = '\x1b[90m', NEGRITA = '\x1b[1m', FIN = '\x1b[0m';

console.log(`\n${NEGRITA}CalD Risk Screen — Prueba de humo del componente${FIN}`);
console.log(`${GRIS}Ejecuta la lógica real del componente para detectar referencias rotas${FIN}`);
console.log(`${GRIS}y declaraciones fuera de orden, que dejan la pantalla en blanco.${FIN}\n`);

if (errores.length === 0) {
    console.log(`  ${VERDE}✓${FIN} La lógica del componente se ejecuta sin errores`);
    console.log(`  ${VERDE}✓${FIN} Todas las constantes se declaran antes de usarse`);
    console.log(`  ${VERDE}✓${FIN} Todas las funciones del motor existen y son accesibles`);
    console.log(`  ${VERDE}✓${FIN} El render completo del JSX se ejecuta sin errores`);
    if (panelesProbados) {
        console.log(`  ${VERDE}✓${FIN} Los ${panelesProbados} componentes de ui-panels.js se renderizan sin errores`);
    }
    const okVersion = advertencias.find(a => a.startsWith('VERSION_OK:'));
    if (okVersion) {
        console.log(`  ${VERDE}✓${FIN} Todo texto visible anuncia la versión v${okVersion.split(':')[1]} del motor`);
    }
    const okArchivos = advertencias.find(a => a.startsWith('ARCHIVOS_OK:'));
    if (okArchivos) console.log(`  ${VERDE}✓${FIN} Los ${okArchivos.split(':')[1]} archivos que index.html carga existen`);
} else {
    errores.forEach(e => {
        console.log(`  ${ROJO}✗${FIN} ${NEGRITA}${e.name}: ${e.message}${FIN}`);
        if (/before initialization/i.test(e.message)) {
            console.log(`    ${AMARILLO}Causa probable: una constante se usa antes de declararse.${FIN}`);
            console.log(`    ${AMARILLO}En JavaScript las declaraciones const no se elevan, así que${FIN}`);
            console.log(`    ${AMARILLO}el orden en que están escritas importa. Mueva la declaración${FIN}`);
            console.log(`    ${AMARILLO}por encima de su primer uso.${FIN}`);
        }
        if (/is not defined/i.test(e.message)) {
            console.log(`    ${AMARILLO}Causa probable: se eliminó o renombró algo que aún se usa.${FIN}`);
        }
    });
}

advertencias.filter(a => !a.startsWith('ARCHIVOS_OK:') && !a.startsWith('VERSION_OK:')).forEach(a => console.log(`  ${AMARILLO}!${FIN} ${a}`));

if (errores.length > 0) {
    console.log(`\n${ROJO}${NEGRITA}La aplicación fallaría al cargar.${FIN}\n`);
    process.exit(1);
}
if (advertencias.filter(a => !a.startsWith('ARCHIVOS_OK:') && !a.startsWith('VERSION_OK:')).length > 0) {
    console.log(`\n${AMARILLO}Se ejecuta, pero hay advertencias que revisar.${FIN}\n`);
    process.exit(0);
}
console.log(`\n${VERDE}${NEGRITA}El componente carga correctamente.${FIN}\n`);
process.exit(0);
