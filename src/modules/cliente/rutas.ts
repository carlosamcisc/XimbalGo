export interface VehiculoRuta {
  id: string;
  matricula: string;
  descripcion: string | null;
  asientosDisponibles: number;
  totalAsientos: number;
}

export interface TaxistaRuta {
  id: string;
  nombre: string;
  telefono: string | null;
  horario: string | null;
  precio: number | null;
  enServicio: boolean;
  /** Ruta del catálogo; null en taxistas registrados antes de `ruta_id`. */
  rutaId: string | null;
  origen: string;
  destino: string;
  vehiculos: VehiculoRuta[];
}

export interface RutaCatalogo {
  id: string;
  nombre: string;
  origen: string;
  destino: string;
  distanciaKm: number | null;
  tiempoEstimadoMin: number | null;
  precioBase: number;
}

export interface RutaCliente {
  /** Id del catálogo, o el origen y destino si solo la ofrecen taxistas. */
  clave: string;
  nombre: string;
  origen: string;
  destino: string;
  distanciaKm: number | null;
  tiempoEstimadoMin: number | null;
  /** El menor precio entre la tarifa base y lo que cobran los taxistas. */
  precioDesde: number | null;
  enCatalogo: boolean;
  taxistas: TaxistaRuta[];
  taxistasEnServicio: number;
  /** Asientos libres en los vehículos de taxistas en servicio. */
  asientosDisponibles: number;
}

// Para buscar y para unir taxistas sin `ruta_id`, cuyo origen y destino se
// escribieron a mano: se compara sin mayúsculas, acentos ni espacios repetidos.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const claveTrayecto = (origen: string, destino: string) =>
  `${normalizarTexto(origen)}|${normalizarTexto(destino)}`;

function resumirRuta(
  base: Omit<RutaCliente, "precioDesde" | "taxistasEnServicio" | "asientosDisponibles">,
  precioBase: number | null
): RutaCliente {
  const enServicio = base.taxistas.filter((taxista) => taxista.enServicio);
  const precios = [
    precioBase,
    ...base.taxistas.map((taxista) => taxista.precio),
  ].filter((precio): precio is number => precio !== null);

  return {
    ...base,
    precioDesde: precios.length > 0 ? Math.min(...precios) : null,
    taxistasEnServicio: enServicio.length,
    asientosDisponibles: enServicio
      .flatMap((taxista) => taxista.vehiculos)
      .reduce((total, vehiculo) => total + vehiculo.asientosDisponibles, 0),
  };
}

const ordenarTaxistas = (a: TaxistaRuta, b: TaxistaRuta) =>
  Number(b.enServicio) - Number(a.enServicio) || a.nombre.localeCompare(b.nombre, "es");

const agregar = <K,>(mapa: Map<K, TaxistaRuta[]>, clave: K, taxista: TaxistaRuta) =>
  mapa.set(clave, [...(mapa.get(clave) ?? []), taxista]);

/**
 * Une el catálogo `rutas` con sus taxistas por `ruta_id`. Los taxistas sin
 * `ruta_id`, o con una ruta que ya no está activa, se unen comparando su
 * origen y destino; si no coinciden con ninguna, su trayecto se muestra como
 * una ruta propia.
 */
export function construirRutas(
  catalogo: RutaCatalogo[],
  taxistas: TaxistaRuta[]
): RutaCliente[] {
  const idsCatalogo = new Set(catalogo.map((ruta) => ruta.id));
  const taxistasPorRuta = new Map<string, TaxistaRuta[]>();
  const taxistasPorTrayecto = new Map<string, TaxistaRuta[]>();
  for (const taxista of taxistas) {
    if (taxista.rutaId && idsCatalogo.has(taxista.rutaId)) {
      agregar(taxistasPorRuta, taxista.rutaId, taxista);
    } else {
      agregar(taxistasPorTrayecto, claveTrayecto(taxista.origen, taxista.destino), taxista);
    }
  }

  const rutas: RutaCliente[] = catalogo.map((ruta) => {
    const clave = claveTrayecto(ruta.origen, ruta.destino);
    const deLaRuta = [
      ...(taxistasPorRuta.get(ruta.id) ?? []),
      ...(taxistasPorTrayecto.get(clave) ?? []),
    ];
    taxistasPorTrayecto.delete(clave);

    return resumirRuta(
      {
        clave: ruta.id,
        nombre: ruta.nombre,
        origen: ruta.origen,
        destino: ruta.destino,
        distanciaKm: ruta.distanciaKm,
        tiempoEstimadoMin: ruta.tiempoEstimadoMin,
        enCatalogo: true,
        taxistas: [...deLaRuta].sort(ordenarTaxistas),
      },
      ruta.precioBase
    );
  });

  for (const [clave, deLaRuta] of taxistasPorTrayecto) {
    const { origen, destino } = deLaRuta[0];
    rutas.push(
      resumirRuta(
        {
          clave: `trayecto:${clave}`,
          nombre: `${origen} → ${destino}`,
          origen,
          destino,
          distanciaKm: null,
          tiempoEstimadoMin: null,
          enCatalogo: false,
          taxistas: [...deLaRuta].sort(ordenarTaxistas),
        },
        null
      )
    );
  }

  return rutas.sort(
    (a, b) =>
      b.taxistasEnServicio - a.taxistasEnServicio ||
      a.nombre.localeCompare(b.nombre, "es")
  );
}

export function coincideBusqueda(ruta: RutaCliente, busqueda: string): boolean {
  const termino = normalizarTexto(busqueda);
  if (!termino) {
    return true;
  }
  return [ruta.nombre, ruta.origen, ruta.destino].some((texto) =>
    normalizarTexto(texto).includes(termino)
  );
}

// `time` de Postgres llega como "HH:MM:SS".
export function formatearHorario(
  horarioTexto: string | null,
  horaInicio: string | null,
  horaFin: string | null
): string | null {
  if (horarioTexto?.trim()) {
    return horarioTexto.trim();
  }
  if (horaInicio && horaFin) {
    return `${horaInicio.slice(0, 5)} a ${horaFin.slice(0, 5)}`;
  }
  return null;
}

export function formatearDuracion(minutos: number | null): string | null {
  if (minutos === null) {
    return null;
  }
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

export function formatearKilometros(km: number | null): string | null {
  return km === null ? null : `${Number(km.toFixed(1))} km`;
}
