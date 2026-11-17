const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const modulo = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync('src/modules/cliente/mapa.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }
).outputText, { exports: modulo.exports });
const { aLngLat, encuadreMapa } = modulo.exports;
const normalizar = (valor) => JSON.parse(JSON.stringify(valor));

test('MapLibre recibe longitud antes de latitud', () => {
  assert.deepEqual(normalizar(aLngLat({ latitud: 20.97, longitud: -89.62 })), [-89.62, 20.97]);
});

test('sin posiciones conserva la vista inicial', () => {
  assert.equal(encuadreMapa([]), null);
});

test('una posición o varias coincidentes tienen zoom de calle', () => {
  const punto = { latitud: 20.97, longitud: -89.62 };
  const esperado = { center: [-89.62, 20.97], zoom: 16 };
  assert.deepEqual(normalizar(encuadreMapa([punto])), esperado);
  assert.deepEqual(normalizar(encuadreMapa([punto, punto])), esperado);
});

test('el encuadre contiene todas las posiciones en cualquier orden', () => {
  const puntos = [
    { latitud: 20.9, longitud: -89.7 },
    { latitud: 21.1, longitud: -89.5 },
    { latitud: 21, longitud: -89.6 },
  ];
  const esperado = { bounds: [-89.7, 20.9, -89.5, 21.1] };
  assert.deepEqual(normalizar(encuadreMapa(puntos)), esperado);
  assert.deepEqual(normalizar(encuadreMapa(puntos.reverse())), esperado);
});

function pagina() {
  const elementos = new Map();
  const eventos = {};
  const movimientos = [];
  let posicion;
  let opciones;
  const documento = {
    hidden: false,
    querySelector(selector) {
      if (!elementos.has(selector)) elementos.set(selector, {});
      return elementos.get(selector);
    },
    createElement() { return { setAttribute() {} }; },
    addEventListener() {},
  };
  class Mapa {
    constructor(config) { opciones = config; }
    addControl() {}
    on(evento, fn) { eventos[evento] = fn; }
    jumpTo(config) { movimientos.push(config); }
    easeTo(config) { movimientos.push(config); }
  }
  class Marcador {
    setLngLat(valor) { posicion = valor; return this; }
    addTo() { return this; }
  }
  const html = fs.readFileSync('web/compartir/index.html', 'utf8');
  const codigo = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const maplibregl = { Map: Mapa, Marker: Marcador, NavigationControl: class {} };
  const contexto = vm.createContext({
    document: documento,
    location: { search: '' },
    URLSearchParams,
    Date,
    console,
    setTimeout,
    clearTimeout,
    exports: {},
    require(url) {
      assert.equal(url, 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs');
      return maplibregl;
    },
  });
  vm.runInContext(ts.transpileModule(codigo, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, contexto);
  return {
    pintar(datos) {
      contexto.datosPrueba = datos;
      return vm.runInContext('pintar(datosPrueba)', contexto);
    },
    eventos, movimientos, opciones, elementos,
    posicion: () => normalizar(posicion),
  };
}

const datos = {
  nombre: 'Familiar', activa: true, latitud: 20.97, longitud: -89.62,
  ubicacion_actualizada_en: new Date().toISOString(),
  expira_en: new Date(Date.now() + 3600000).toISOString(),
};

test('la página coloca y actualiza la ubicación sin intercambiar los ejes', () => {
  const p = pagina();
  assert.match(p.opciones.style, /^https:\/\/tiles.openfreemap.org\//);
  assert.equal(p.opciones.attributionControl, true);
  p.pintar(datos);
  assert.deepEqual(p.posicion(), [-89.62, 20.97]);
  assert.match(p.elementos.get('#abrir').href, /^https:\/\/www.openstreetmap.org\//);
  p.pintar({ ...datos, longitud: -89.61 });
  assert.deepEqual(p.posicion(), [-89.61, 20.97]);
  assert.equal(p.movimientos.length, 2);
});

test('explorar el mapa detiene el centrado pero conserva las actualizaciones', () => {
  const p = pagina();
  p.pintar(datos);
  p.eventos.dragstart();
  p.pintar({ ...datos, latitud: 21 });
  assert.deepEqual(p.posicion(), [-89.62, 21]);
  assert.equal(p.movimientos.length, 1);
});

test('al terminar el enlace la página oculta el acceso a la ubicación', () => {
  const p = pagina();
  p.pintar(datos);
  assert.equal(p.pintar({ ...datos, activa: false }), false);
  assert.equal(p.elementos.get('#abrir').hidden, true);
});
