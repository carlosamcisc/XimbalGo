# XimbalGo
XímbalGo es una aplicación móvil diseñada para mejorar la experiencia de los usuarios del transporte público en comunidades donde no existe información centralizada sobre rutas, horarios y disponibilidad de unidades.

# Ejecucion del proyecto
## Usando EXPO GO
- npm run android
## Sin Expo Go
- npx expo run:android
## Generar y instalar APK
- npx expo run:android --variant release

# Arquitectura del proyecto
assets
    --- imagenes, logos, etc
src
|-------- components
|            --- Buttons, Text, View, Card, etc
|-------- modules
|            --- Types (Datos del roles, campos de la DB)
|-------- screens
|            --- Pantallas de la aplicacion
|-------- navigaction
|            --- Rutas de navegacion por rol
|-------- theme
            --- Tipografia, Paleta de colores, etc
    
