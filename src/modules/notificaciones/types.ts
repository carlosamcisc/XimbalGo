export interface PreferenciasNotificaciones {
  push_habilitado: boolean;
  reservas: boolean;
  llegada: boolean;
  viajes: boolean;
}

export const PREFERENCIAS_PREDETERMINADAS: PreferenciasNotificaciones = {
  push_habilitado: true, reservas: true, llegada: true, viajes: true,
};

export type CampoPreferencia = keyof PreferenciasNotificaciones;
