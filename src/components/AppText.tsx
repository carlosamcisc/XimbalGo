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
        regular: "InterRegular",
        medium: "InterMedium",
        semibold: "InterSemiBold",
        bold: "InterBold",
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
        fontFamily: "InterRegular",
    },
});

export default AppText;