export const colors = {
  canvas: '#FFF8EC',
  canvasDeep: '#F0E7FF',
  paper: '#FFFFFF',
  ink: '#171337',
  inkSoft: '#655F79',
  violet: '#7C3CFF',
  violetDeep: '#4D22B8',
  violetSoft: '#E9DEFF',
  lime: '#D8FF3E',
  limeSoft: '#EEFFAD',
  cyan: '#48D9E8',
  peach: '#FF9273',
  rose: '#FF5F72',
  mint: '#59D98E',
  line: '#D8CFE6',
} as const;

export const fonts = {
  display: 'Baloo2_800ExtraBold',
  displaySemi: 'Baloo2_700Bold',
  body: 'FiraSans_400Regular',
  bodyBold: 'FiraSans_600SemiBold',
  bodyMedium: 'FiraSans_500Medium',
} as const;

export const layout = {
  gutter: 19,
  gutterNarrow: 15,
  sectionGap: 18,
  radius: 22,
  radiusSmall: 15,
  border: 2.5,
} as const;

export const motion = {
  entranceDistance: 18,
  springSpeed: 9,
  springBounce: 7,
} as const;

export const hardShadow = {
  shadowColor: colors.ink,
  shadowOffset: { width: 0, height: 7 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 8,
} as const;
