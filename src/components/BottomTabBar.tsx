// BottomTabBar.tsx
import { StyleSheet, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "../theme/colors";
import { Icono, NombreIcono } from "./Icono";
import AppText from "../components/AppText";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icono: NombreIcono;
}

export type BottomTabId = 'inicio' | 'rutas' | 'reservaciones';

export const TABS_CLIENTE: readonly TabItem<BottomTabId>[] = [
  { id: 'inicio', label: 'Inicio', icono: 'home' },
  { id: 'rutas', label: 'Rutas', icono: 'map' },
  { id: 'reservaciones', label: 'Reservaciones', icono: 'bookMarks' }
];

export type TaxistaTabId = 'inicio' | 'viajes' | 'vehiculo' | 'perfil';

export const TABS_TAXISTA: readonly TabItem<TaxistaTabId>[] = [
  { id: 'inicio', label: 'Inicio', icono: 'home' },
  { id: 'viajes', label: 'Viajes', icono: 'bookMarks' },
  { id: 'vehiculo', label: 'Vehículo', icono: 'localTaxi' },
  { id: 'perfil', label: 'Perfil', icono: 'person' },
];

interface Props<T extends string> {
  tabs: readonly TabItem<T>[];
  activeTab: T;
  onPressTab: (id: T) => void;
}

export function BottomTabBar<T extends string>({ tabs, activeTab, onPressTab }: Props<T>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { bottom: insets.bottom }]}>
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            testID={`tab-${tab.id}`}
            style={[styles.item, active && styles.itemActive]}
            activeOpacity={0.85}
            onPress={() => onPressTab(tab.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <Icono
              nombre={tab.icono}
              tamanio={24}
              color={active ? Colors.primary : Colors.onSurfaceVariant}
            />
            <AppText style={[styles.label, active && styles.labelActive]}>
              {tab.label}
            </AppText>
            <View style={[styles.indicator, active && styles.indicatorActive]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    elevation: 10,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: -2 },
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 20, // redondeado
  },
  itemActive: {
    backgroundColor: Colors.onPrimary, // fondo más suave
  },
  label: {
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  indicator: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: "transparent",
  },
  indicatorActive: {
    backgroundColor: Colors.primary,
  },
});
