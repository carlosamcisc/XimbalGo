import { Text, TextProps, StyleSheet } from "react-native";

type AppTextProps = TextProps & {
    weight?: "regular" | "medium" | "semibold" | "bold";
};

const AppText = ({
    weight = "regular",
    style,
    ...props
}: AppTextProps) => {

    const fontFamily = {
        regular: "PoppinsRegular",
        medium: "PoppinsMedium",
        semibold: "PoppinsSemiBold",
        bold: "PoppinsBold",
    }[weight];

    return (
        <Text
            {...props}
            style={[
                styles.text,
                { fontFamily },
                style,
            ]}
        />
    );
};

const styles = StyleSheet.create({
    text: {
        fontFamily: "PoppinsRegular",
    },
});

export default AppText;