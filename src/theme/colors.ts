/**
 * Paleta de colores Material Design (modo claro)
 * Actualizada según branding de Xímbal Go
 */

export const Colors = {
  // Colores principales
  primary: '#0066FF',          // Azul principal (botones, acciones destacadas)
  onPrimary: '#FFFFFF',
  primaryContainer: '#E8F6FF', // Azul muy claro (fondos, tarjetas)
  onPrimaryContainer: '#0F2D5B',

  secondary: '#00D1FF',        // Cian principal (bordes, acentos, detalles)
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E5F6F9',
  onSecondaryContainer: '#0B263D',

  tertiary: '#94A3B8',         // Gris medio (informativo, íconos inactivos)
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E5EAF2',
  onTertiaryContainer: '#263746',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',

  background: '#FFFFFF',       // Fondo principal limpio
  onBackground: '#191C20',

  surface: '#FFFFFF',
  onSurface: '#191C20',
  surfaceVariant: '#E8F6FF',   // Azul muy claro como superficie secundaria
  onSurfaceVariant: '#42474E',

  outline: '#73777F',
  outlineVariant: '#C2C7CF',
  scrim: '#000000',

  inverseSurface: '#2D3135',
  inverseOnSurface: '#EFF0F7',
  inversePrimary: '#00D1FF',

  primaryFixed: '#D0E4FF',
  onPrimaryFixed: '#001D35',
  primaryFixedDim: '#9ECAFC',
  onPrimaryFixedVariant: '#164974',

  secondaryFixed: '#D6E4F7',
  onSecondaryFixed: '#0F1D2A',
  secondaryFixedDim: '#BAC8DB',
  onSecondaryFixedVariant: '#3B4857',

  tertiaryFixed: '#F1DAFF',
  onTertiaryFixed: '#241432',
  tertiaryFixedDim: '#D5BEE5',
  onTertiaryFixedVariant: '#514060',

  surfaceDim: '#D8DAE0',
  surfaceBright: '#F8F9FF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F2F3F9',
  surfaceContainer: '#ECEEF4',
  surfaceContainerHigh: '#E6E8EE',
  surfaceContainerHighest: '#E1E2E8',

  // Extras de branding
  brandDeep: '#0F2D5B',        // Azul oscuro (encabezados, textos principales)
  brandDeepShadow: '#0B263D',
  brandText: '#263746',
  brandSubtitle: '#D6E8F5',
  brandAccent: '#00D1FF',
  brandAccentStrong: '#0066FF',
  brandAccentBright: '#21A99C',
  brandAccentContainer: '#E5F6F3',
  brandOverlay: 'rgba(255,255,255,0.055)',
  brandSoft: '#EAF2FA',
  routeLine: '#B8C8D6',
  surfaceSoft: '#FBFCFD',
  surfaceMuted: '#F3F6F8',
  surfaceBorder: '#E3EAF0',
  cardBorder: '#E8EDF2',
  divider: '#EDF0F3',

  // Advertencias
  danger: '#D6423F',
  onDanger: '#FFFFFF',
  success: '#2E9E5B',
  errorContainerSoft: '#FFF0EE',

  // Colores generales
  black: '#000000',
  dark: '#000000',
  white: '#FFFFFF',
  shadow: '#A9A9A9',
} as const;

export type ColorKey = keyof typeof Colors;

export default Colors;
