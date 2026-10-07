import {BottomTabBar, type BottomTabId} from "../../components/BottomTabBar";
import { View, Text, StyleSheet } from "react-native"
import {SafeAreaView} from "react-native-safe-area-context";
import {StatusBar} from "expo-status-bar";
import Colors from "../../theme/colors";
import AppText from "../../components/AppText";

const ClienteInicioScreen = () =>{
    return(
        <SafeAreaView style={styles.statusBAR} edges={['top', 'bottom']}>
            <StatusBar style="dark" />
            <View style={styles.pantalla}>
                <AppText>ClienteInicioScreen</AppText>
            </View>
        </SafeAreaView>

    );
};

const styles = StyleSheet.create({
    statusBAR: {
        flex: 1,
        backgroundColor: Colors.primary,
    },
    pantalla:{
        backgroundColor: Colors.surface,
    },
});

export default ClienteInicioScreen;