/**
 * Paleta de colores Material Design (modo claro)
 * Generada por Material3 Design de Google
 */

export const Colors = {
  //Colores de Ximbalgo
  primary: '#34618D',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D0E4FF',
  onPrimaryContainer: '#164974',

  secondary: '#526070',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D6E4F7',
  onSecondaryContainer: '#3B4857',

  tertiary: '#6A5779',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#F1DAFF',
  onTertiaryContainer: '#514060',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',

  background: '#F8F9FF',
  onBackground: '#191C20',

  surface: '#F8F9FF',
  onSurface: '#191C20',
  surfaceVariant: '#DFE3EB',
  onSurfaceVariant: '#42474E',

  outline: '#73777F',
  outlineVariant: '#C2C7CF',
  scrim: '#000000',

  inverseSurface: '#2D3135',
  inverseOnSurface: '#EFF0F7',
  inversePrimary: '#9ECAFC',

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

  //Advertencias
  danger: '#D6423F',
  onDanger: '#FFFFFF',
  success: '#2E9E5B',

  //Colores generales
  dark: '#000000',
  white: '#FFFFFF',
  shadow: '#A9A9A9',
} as const;

export type ColorKey = keyof typeof Colors;

export default Colors;
