import * as Linking from "expo-linking";

export function escucharDeepLinks(
  callback: (url: string) => void
) {
  const subscription =
    Linking.addEventListener("url", ({ url }) => {
      callback(url);
    });

  return () => {
    subscription.remove();
  };
}