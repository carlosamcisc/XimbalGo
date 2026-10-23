import { supabase } from "../client";

export function escucharVehiculos(
  onChange: (payload: unknown) => void
) {
  const channel = supabase
    .channel("vehiculos-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "vehiculos",
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}