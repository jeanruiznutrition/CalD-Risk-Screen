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
const fuenteMotor = ['data.js', 'algorithm.js']
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

// --- Hooks simulados ---
// useState devuelve el valor inicial; useMemo y useEffect ejecutan su
// función de inmediato. Es suficiente para recorrer todas las
// declaraciones en el orden en que están escritas.
const React = {
    useState: (inicial) => [typeof inicial === 'function' ? inicial() : inicial, () => {}],
    useEffect: (fn) => { try { fn(); } catch (e) { /* efectos del DOM no aplican aquí */ } },
    useMemo: (fn) => fn()
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

    function interno(x) {
        let r = '', p = 0;
        while (p < x.length) {
            if (x[p] === '<' && /^<\s*[A-Za-z]/.test(x.slice(p))) {
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
        fuenteMotor + '\n' + fuenteI18n + '\n' +
        'const { useState, useEffect, useMemo } = React;\n' +
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
let errorRender = null;
try {
    const finFuncion = fuenteApp.lastIndexOf('\n}\n\nconst root');
    const cuerpoCompleto = fuenteApp.slice(inicioCuerpo + 'function App() {'.length, finFuncion);
    const transformado = transformarJSX(cuerpoCompleto);

    const h = (tag, props, ...hijos) => {
        const recorrer = (x) => { if (Array.isArray(x)) x.forEach(recorrer); };
        hijos.forEach(recorrer);
        return { tag, props, hijos };
    };

    const fnRender = new Function(
        'React', 'h', 'document', 'navigator', 'localStorage', 'window', 'Blob', 'alert', 'ReactDOM',
        fuenteMotor + '\n' + fuenteI18n + '\n' +
        'const { useState, useEffect, useMemo } = React;\n' +
        'function App() {\n' + transformado + '\n}\n' +
        'return App();'
    );
    fnRender(React, h, documentSimulado, entorno.navigator, entorno.localStorage,
             entorno.window, entorno.Blob, entorno.alert, entorno.ReactDOM);
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
const jsx = fuenteApp.slice(marcadorReturn);

// Toda clave de traducción estática debe existir en el idioma de referencia
try {
    const ctx = new Function('navigator', 'localStorage',
        fuenteI18n + '; return TRANSLATIONS;'
    )(entorno.navigator, entorno.localStorage);
    const ref = ctx.es || {};
    // El patrón exige un límite de palabra antes de la t para no capturar
    // llamadas como createElement('a'), que no son traducciones.
    const clavesUsadas = [...fuenteApp.matchAll(/(?<![a-zA-Z0-9_.])t\('([a-zA-Z0-9_]+)'\)/g)].map(m => m[1]);
    const faltantes = [...new Set(clavesUsadas.filter(k => !ref[k]))];
    if (faltantes.length) {
        advertencias.push(`Claves de traducción sin definir: ${faltantes.join(', ')}`);
    }
} catch (e) {
    advertencias.push('No se pudieron verificar las claves de traducción: ' + e.message);
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

advertencias.filter(a => !a.startsWith('ARCHIVOS_OK:')).forEach(a => console.log(`  ${AMARILLO}!${FIN} ${a}`));

if (errores.length > 0) {
    console.log(`\n${ROJO}${NEGRITA}La aplicación fallaría al cargar.${FIN}\n`);
    process.exit(1);
}
if (advertencias.filter(a => !a.startsWith('ARCHIVOS_OK:')).length > 0) {
    console.log(`\n${AMARILLO}Se ejecuta, pero hay advertencias que revisar.${FIN}\n`);
    process.exit(0);
}
console.log(`\n${VERDE}${NEGRITA}El componente carga correctamente.${FIN}\n`);
process.exit(0);
