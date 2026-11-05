const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function cargar(nombre) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/modules/cliente/${nombre}.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: ruta => cargar(ruta.replace('./', '')) });
  return exports;
}

const { taxiCompatible } = cargar('compatibilidadTaxi');
const taxi = { origenRuta: 'Mérida', destinoRuta: 'Progreso' };
const origen = { tipo: 'ruta', nombre: 'Mérida' };

test('solo permite el trayecto del taxi en el sentido seleccionado', () => {
  assert.equal(taxiCompatible(taxi, origen, 'Progreso'), true);
  assert.equal(taxiCompatible(taxi, origen, 'Valladolid'), false);
  assert.equal(taxiCompatible(taxi, { tipo: 'ruta', nombre: 'Valladolid' }, 'Progreso'), false);
  assert.equal(taxiCompatible(taxi, { tipo: 'ruta', nombre: 'Progreso' }, 'Mérida'), false);
});

test('compara nombres sin diferencias de acentos, mayúsculas ni espacios', () => {
  assert.equal(taxiCompatible(taxi, { tipo: 'ruta', nombre: '  MERIDA ' }, ' PROGRESO '), true);
});

test('GPS y paradero requieren que el destino corresponda al taxi', () => {
  for (const origen of [
    { tipo: 'ubicacion', coordenadas: { latitud: 21, longitud: -89 }, direccion: null },
    { tipo: 'paradero', paradero: { id: 'p', nombre: 'Centro', referencia: null } },
  ]) {
    assert.equal(taxiCompatible(taxi, origen, 'Progreso'), true);
    assert.equal(taxiCompatible(taxi, origen, 'Valladolid'), false);
  }
});

test('rechaza taxis sin datos de ruta', () => {
  assert.equal(taxiCompatible({ origenRuta: null, destinoRuta: null }, origen, 'Progreso'), false);
  assert.equal(taxiCompatible({ origenRuta: null, destinoRuta: 'Progreso' }, origen, 'Progreso'), false);
});

test('distancias cero y submétricas se presentan en metros', () => {
  const { formatearDistancia } = cargar('ubicacion');
  assert.equal(formatearDistancia(0), '0 m');
  assert.equal(formatearDistancia(0.001), '0 m');
  assert.equal(formatearDistancia(1250), '1.3 km');
});
