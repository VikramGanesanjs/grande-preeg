// Color palette - calming blues/teals for focus theme
export const colors = {
  // Primary colors
  primary: '#3B82F6',      // Blue
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',
  
  // Secondary colors
  secondary: '#14B8A6',    // Teal
  secondaryDark: '#0D9488',
  secondaryLight: '#2DD4BF',
  
  // Concentration states
  concentrated: '#22C55E', // Green
  concentratedLight: '#4ADE80',
  notConcentrated: '#6B7280', // Gray
  notConcentratedLight: '#9CA3AF',
  
  // Background colors
  background: '#0F172A',   // Dark slate
  surface: '#1E293B',      // Slate
  surfaceLight: '#334155',
  
  // Text colors
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  
  // Status colors
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  
  // Track colors
  trackBackground: '#1E293B',
  trackLane: '#334155',
  trackBorder: '#475569',
  
  // Car colors
  playerCar: '#3B82F6',
  opponentCar: '#F97316',
};

// Typography
export const typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// Spacing (4px base unit)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

// Border radius
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// Animation timing
export const animation = {
  fast: 150,
  normal: 300,
  slow: 500,
  carMovement: 600,
};

// Game configuration
export const gameConfig = {
  trackUnits: 20,           // Number of advancement units to finish
  advancePercentage: 5,     // Each advance = 5% of track
  defaultThreshold: 3 as 3 | 5,
  updateFrequency: 500,     // ms between signals
};
