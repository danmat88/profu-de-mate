export const colors = {
  // Surfaces
  canvas: '#FFF8EC',
  canvasWarm: '#FFF2DC',
  canvasDeep: '#EFE5FF',
  paper: '#FFFFFF',
  paperTint: '#FAF6FF',

  // Ink & text
  ink: '#171337',
  inkSoft: '#5A5372',
  inkMuted: '#7E7796',

  // Brand violet
  violet: '#7C3CFF',
  violetBright: '#9158FF',
  violetDeep: '#4B1FB8',
  violetSoft: '#ECE2FF',
  violetShadow: '#32107C',

  // Signature lime
  lime: '#D8FF3E',
  limeBright: '#E4FF6B',
  limeSoft: '#F0FFBA',
  limeDeep: '#567800',

  // Expressive accents
  cyan: '#43D6E6',
  cyanSoft: '#D2F7FA',
  cyanDeep: '#127D8C',
  peach: '#FF8D6B',
  peachBright: '#FFA88C',
  peachSoft: '#FFE4DA',
  peachDeep: '#B33B22',
  peachShadow: '#7A2313',
  berry: '#D63D73',
  berryDeep: '#8E1E4E',
  gold: '#FFD447',
  goldSoft: '#FFF2BF',
  rose: '#FF576D',
  roseSoft: '#FFE0E5',
  mint: '#4ED686',
  mintSoft: '#DCF8E7',
  mintDeep: '#177A43',

  // Lines, delicate studio hairlines & soft glows
  line: '#E6DCF9',
  borderHairline: '#E6DCF9',
  borderSoft: '#DDD0F7',
  borderDark: 'rgba(167, 139, 250, 0.24)',
  surfaceDark: '#1B143B',
  surfaceDarkCard: '#231B4B',
  shadowTint: 'rgba(35, 22, 78, 0.10)',
  shine: 'rgba(255, 255, 255, 0.55)',
  shineSoft: 'rgba(255, 255, 255, 0.16)',

  // Semantic aliases
  success: '#4ED686',
  successSoft: '#DCF8E7',
  warning: '#FFD447',
  warningSoft: '#FFF2BF',
  danger: '#FF576D',
  dangerSoft: '#FFE0E5',
  info: '#43D6E6',
  infoSoft: '#D2F7FA',
} as const;

export const fonts = {
  display: 'BalsamiqSans_700Bold',
  displaySemi: 'BalsamiqSans_700Bold',
  displayRegular: 'BalsamiqSans_400Regular',
  body: 'FiraSans_400Regular',
  bodyBold: 'FiraSans_600SemiBold',
  bodyMedium: 'FiraSans_500Medium',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const borders = {
  thin: 1,
  regular: 1.25,
  thick: 1.5,
} as const;

export const shadows = {
  sm: 2,
  md: 3,
  lg: 4,
} as const;

export const typography = {
  kicker: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  cardTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 21 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  display: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.3 },
} as const;

export const layout = {
  gutter: 19,
  gutterNarrow: 15,
  sectionGap: 18,
  radius: 22,
  radiusSmall: 15,
  border: 1.25,
} as const;

export const motion = {
  press: 90,
  fast: 150,
  enter: 220,
  sheet: 240,
  entranceDistance: 18,
  springSpeed: 9,
  springBounce: 7,
} as const;

export const springs = {
  press: { damping: 20, stiffness: 520, mass: 0.7 },
  bouncy: { damping: 14, stiffness: 360, mass: 0.85 },
  snappy: { damping: 22, stiffness: 420, mass: 0.8 },
  gentle: { damping: 20, stiffness: 220, mass: 0.95 },
  pop: { damping: 12, stiffness: 420, mass: 0.75 },
} as const;
