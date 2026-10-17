export function mensajeError(error: unknown, respaldo: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  // Los errores de Supabase pueden llegar como objetos planos con `message`.
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return respaldo;
}
