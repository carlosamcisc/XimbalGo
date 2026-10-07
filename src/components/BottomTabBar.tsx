import {StyleSheet, View, TouchableOpacity} from "react-native";
import Colors from "../theme/colors";
import { Icono, NombreIcono } from "./Icono";
import AppText from "../components/AppText";

export type BottomTabId = 'inicio' | 'rutas' | 'ajustes';

interface TabItem{
    id: BottomTabId;
    label: string;
    icono: NombreIcono;
}

const TABS: TabItem[] = [
    {id: 'inicio', label: 'Inicio', icono: 'home'},
    {id: 'rutas', label: 'Rutas', icono: 'map'},
    {id: 'ajustes', label: 'Ajustes', icono: 'settings'}
];

interface Props{
    activeTab: BottomTabId;
    onPressTab: (id: BottomTabId) => void;
}

export function BottomTabBar({activeTab, onPressTab}: Props){
    return(
        <View style={styles.bar}>
            {TABS.map((tab) => {
                const active = tab.id === activeTab;
                return(
                    <TouchableOpacity
                    key = {tab.id}
                    testID = {`tab-${tab.id}`}
                    style={styles.item}
                    activeOpacity={0.85}
                    onPress={() => onPressTab(tab.id)}
                    accessibilityRole="button"
                    accessibilityState={{selected: active}}
                    accessibilityLabel={tab.label}
                    >
                        <Icono nombre={tab.icono} tamanio={24} color={active ? Colors.primary : Colors.danger}/>
                        <AppText style={[styles.label, active && styles.labelActive]}>{tab.label}</AppText>
                        <View style={[styles.indicator, active && styles.indicatorActive]}/>

                    </TouchableOpacity>
                    
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        elevation: 8,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: Colors.surface,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        paddingTop: 12,
        paddingBottom: 8,
        paddingHorizontal: 4,
        overflow: 'hidden',
    },
    item:{
        flex: 1,
        alignItems: 'center',
    },
    label:{
        color: Colors.onSurfaceVariant,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    labelActive:{
        color: Colors.primary,
        fontWeight: '800',
    },
    indicator:{
        width: 40,
        height: 3,
        borderRadius: 2,
        backgroundColor: Colors.primary,
        marginTop: 4,
    },
    indicatorActive:{
        backgroundColor: Colors.primary,
    },
});