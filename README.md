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

assets/
│── imagenes/
│── logos/

src/
│── components/
│   │── Buttons/
│   │── Text/
│   │── View/
│   │── Card/
│
│── modules/
│   │── Types/   # Datos de roles, campos de la DB
│
│── screens/
│   │── Home/
│   │── Login/
│   │── Dashboard/
│
│── navigation/
│   │── rutas_por_rol/
│
│── theme/
│   │── tipografia/
│   │── paleta_colores/

