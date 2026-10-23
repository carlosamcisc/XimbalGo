// Paraderos cercanos al cliente con la distancia y el tiempo por calle,
// caminando y en moto, calculados con GraphHopper.
//
// Secretos (`supabase secrets set`):
// - GRAPHHOPPER_URL: base de la API. Por defecto, GraphHopper Cloud.
// - GRAPHHOPPER_API_KEY: se envía como parámetro `key`.
// - GRAPHHOPPER_PERFIL_PIE / GRAPHHOPPER_PERFIL_MOTO: perfiles de ruta. El
//   plan gratis de la nube solo tiene `car`, `bike` y `foot`, así que la moto
//   usa `car` hasta tener el servidor propio.
//
// La sesión se valida al leer los paraderos con el token del cliente: la RPC
// solo se puede ejecutar como `authenticated`. Si GraphHopper no responde, el
// paradero se devuelve con su distancia en línea recta.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

interface Coordenadas {
  latitud: number;
  longitud: number;
}

interface Trayecto {
  metros: number;
  segundos: number;
}

const GRAPHHOPPER_URL = (
  Deno.env.get("GRAPHHOPPER_URL") ?? "https://graphhopper.com/api/1"
).replace(/\/+$/, "");
const GRAPHHOPPER_API_KEY = Deno.env.get("GRAPHHOPPER_API_KEY") ?? "";
const PERFIL_PIE = Deno.env.get("GRAPHHOPPER_PERFIL_PIE") ?? "foot";
const PERFIL_MOTO = Deno.env.get("GRAPHHOPPER_PERFIL_MOTO") ?? "car";

const LIMITE_PARADEROS = 5;
const ESPERA_GRAPHHOPPER_MS = 5_000;

// Mientras la instancia sigue viva, evita pedir otra vez la misma ruta al
// refrescar la pantalla. 4 decimales son unos 11 m.
const VIGENCIA_CACHE_MS = 10 * 60_000;
const cache = new Map<string, { trayecto: Trayecto | null; vence: number }>();

const respuesta = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const esCoordenada = (valor: unknown, limite: number): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && Math.abs(valor) <= limite;

async function calcularTrayecto(
  perfil: string,
  origen: Coordenadas,
  destino: Coordenadas,
  claveDestino: string
): Promise<Trayecto | null> {
  const clave = `${perfil}|${origen.latitud.toFixed(4)},${origen.longitud.toFixed(4)}|${claveDestino}`;
  const guardado = cache.get(clave);
  if (guardado && guardado.vence > Date.now()) {
    return guardado.trayecto;
  }

  const parametros = new URLSearchParams({
    profile: perfil,
    calc_points: "false",
    instructions: "false",
  });
  parametros.append("point", `${origen.latitud},${origen.longitud}`);
  parametros.append("point", `${destino.latitud},${destino.longitud}`);
  if (GRAPHHOPPER_API_KEY) {
    parametros.set("key", GRAPHHOPPER_API_KEY);
  }

  let trayecto: Trayecto | null = null;
  try {
    const res = await fetch(`${GRAPHHOPPER_URL}/route?${parametros}`, {
      signal: AbortSignal.timeout(ESPERA_GRAPHHOPPER_MS),
    });
    if (!res.ok) {
      // Sin ruta posible (400) o sin créditos (429): no se guarda en caché
      // para volver a intentar en la siguiente consulta.
      console.error(`GraphHopper ${perfil}: ${res.status} ${await res.text()}`);
      return null;
    }
    const datos = await res.json();
    const ruta = datos?.paths?.[0];
    if (typeof ruta?.distance === "number" && typeof ruta?.time === "number") {
      // GraphHopper devuelve el tiempo en milisegundos.
      trayecto = { metros: ruta.distance, segundos: Math.round(ruta.time / 1000) };
    }
  } catch (error) {
    console.error(`GraphHopper ${perfil}:`, error);
    return null;
  }

  cache.set(clave, { trayecto, vence: Date.now() + VIGENCIA_CACHE_MS });
  return trayecto;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return respuesta({ error: "Método no permitido." }, 405);
  }

  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) {
    return respuesta({ error: "Inicia sesión para buscar paraderos." }, 401);
  }

  let origen: Coordenadas;
  try {
    const { latitud, longitud } = await req.json();
    if (!esCoordenada(latitud, 90) || !esCoordenada(longitud, 180)) {
      throw new Error();
    }
    origen = { latitud, longitud };
  } catch {
    return respuesta({ error: "Ubicación no válida." }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: autorizacion } } }
  );

  const { data, error } = await supabase.rpc("obtener_paraderos_cercanos", {
    p_latitud: origen.latitud,
    p_longitud: origen.longitud,
    p_limite: LIMITE_PARADEROS,
  });
  if (error) {
    console.error("obtener_paraderos_cercanos:", error);
    const sinSesion = error.code === "42501" || error.code === "PGRST301";
    return respuesta(
      { error: sinSesion ? "Inicia sesión para buscar paraderos." : "No se pudieron buscar los paraderos." },
      sinSesion ? 401 : 500
    );
  }

  const paraderos = await Promise.all(
    (data ?? []).map(async (paradero: {
      id: string;
      nombre: string;
      referencia: string | null;
      distancia_metros: number;
      latitud: number;
      longitud: number;
    }) => {
      const destino = { latitud: paradero.latitud, longitud: paradero.longitud };
      const [caminando, moto] = await Promise.all([
        calcularTrayecto(PERFIL_PIE, origen, destino, paradero.id),
        calcularTrayecto(PERFIL_MOTO, origen, destino, paradero.id),
      ]);
      return {
        id: paradero.id,
        nombre: paradero.nombre,
        referencia: paradero.referencia,
        distanciaLineaRecta: paradero.distancia_metros,
        caminando,
        moto,
      };
    })
  );

  // El más cercano es el que menos hay que caminar.
  const distancia = (p: (typeof paraderos)[number]) =>
    p.caminando?.metros ?? p.distanciaLineaRecta;
  paraderos.sort((a, b) => distancia(a) - distancia(b));

  return respuesta({ paraderos });
});
