/** Limita la espera y descarta resultados tardíos sin dejar temporizadores activos. */
export async function conTiempoLimite<T>(
  operacion: Promise<T>,
  milisegundos: number,
  mensaje: string,
  alVencer?: () => void,
): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operacion,
      new Promise<never>((_resolve, reject) => {
        temporizador = setTimeout(() => {
          reject(new Error(mensaje));
          alVencer?.();
        }, milisegundos);
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}
