/**
 * Layout standardization utility for Sky Sensi components
 * Provides consistent spacing, alignment, and responsive behavior classes
 */

/**
 * Standard spacing constants (Tailwind classes)
 */
export const SPACING = {
  // Margins
  MARGIN: {
    XS: 'mb-1',      // 4px
    SM: 'mb-2',      // 8px  
    MD: 'mb-4',      // 16px
    LG: 'mb-6',      // 24px
    XL: 'mb-8',      // 32px
    XXL: 'mb-12'     // 48px
  },
  
  // Padding
  PADDING: {
    XS: 'p-1',       // 4px
    SM: 'p-2',       // 8px
    MD: 'p-4',       // 16px
    LG: 'p-6',       // 24px
    XL: 'p-8',       // 32px
    XXL: 'p-12'      // 48px
  },

  // Gaps for flex/grid
  GAP: {
    XS: 'gap-1',     // 4px
    SM: 'gap-2',     // 8px
    MD: 'gap-4',     // 16px
    LG: 'gap-6',     // 24px
    XL: 'gap-8',     // 32px
    XXL: 'gap-12'    // 48px
  }
};

/**
 * Standard container classes for consistent layouts
 */
export const CONTAINERS = {
  // Page containers
  PAGE: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  CONTENT: 'max-w-4xl mx-auto',
  NARROW: 'max-w-2xl mx-auto',
  
  // Card containers
  CARD: 'bg-white rounded-lg border border-gray-200 shadow-sm',
  CARD_DARK: 'bg-cockpit-panel border border-gray-700 rounded-lg',
  CARD_PADDING: 'p-6',
  CARD_PADDING_SM: 'p-4',
  
  // Section containers
  SECTION: 'py-6',
  SECTION_LG: 'py-12',
  HEADER_HEIGHT: 'h-16'
};

/**
 * Standard responsive grid layouts
 */
export const GRIDS = {
  // Dashboard grids
  DASHBOARD: 'grid grid-cols-1 xl:grid-cols-4 gap-6',
  DASHBOARD_MAIN: 'xl:col-span-3',
  DASHBOARD_SIDEBAR: 'xl:col-span-1',
  
  // Map and content grids  
  MAP_LAYOUT: 'grid grid-cols-1 xl:grid-cols-3 gap-6',
  MAP_MAIN: 'xl:col-span-2',
  MAP_SIDEBAR: 'xl:col-span-1',
  
  // Form grids
  FORM_GRID: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  FORM_GRID_3: 'grid grid-cols-1 md:grid-cols-3 gap-4',
  
  // Auto-fit grids
  AUTO_FIT: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  AUTO_FIT_4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
};

/**
 * Standard flex layouts for consistent alignment
 */
export const FLEX = {
  // Common flex combinations
  BETWEEN: 'flex items-center justify-between',
  CENTER: 'flex items-center justify-center', 
  START: 'flex items-center justify-start',
  END: 'flex items-center justify-end',
  
  // Column layouts
  COL: 'flex flex-col',
  COL_CENTER: 'flex flex-col items-center justify-center',
  COL_START: 'flex flex-col items-start',
  
  // With spacing
  BETWEEN_GAP: 'flex items-center justify-between gap-4',
  CENTER_GAP: 'flex items-center justify-center gap-4',
  START_GAP: 'flex items-center gap-4'
};

/**
 * Typography standardization
 */
export const TYPOGRAPHY = {
  // Headings
  H1: 'text-3xl font-bold text-gray-900',
  H2: 'text-2xl font-semibold text-gray-900',
  H3: 'text-xl font-semibold text-gray-900',
  H4: 'text-lg font-medium text-gray-900',
  
  // Dark theme headings
  H1_DARK: 'text-3xl font-bold text-white',
  H2_DARK: 'text-2xl font-semibold text-white',
  H3_DARK: 'text-xl font-semibold text-white',
  H4_DARK: 'text-lg font-medium text-white',
  
  // Body text
  BODY: 'text-sm text-gray-700',
  BODY_DARK: 'text-sm text-gray-300',
  CAPTION: 'text-xs text-gray-500',
  CAPTION_DARK: 'text-xs text-gray-400',
  
  // Labels
  LABEL: 'text-sm font-medium text-gray-700',
  LABEL_DARK: 'text-sm font-medium text-gray-300'
};

/**
 * Button standardization for consistent styling
 */
export const BUTTONS = {
  // Primary buttons
  PRIMARY: 'bg-cockpit-accent hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-md transition-colors',
  PRIMARY_SM: 'bg-cockpit-accent hover:bg-blue-600 text-white font-medium px-3 py-1.5 text-sm rounded-md transition-colors',
  PRIMARY_LG: 'bg-cockpit-accent hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-md transition-colors',
  
  // Secondary buttons
  SECONDARY: 'bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium px-4 py-2 rounded-md transition-colors',
  SECONDARY_DARK: 'bg-gray-700 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-md transition-colors',
  
  // Outline buttons
  OUTLINE: 'border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-4 py-2 rounded-md transition-colors',
  OUTLINE_DARK: 'border border-gray-600 hover:border-gray-500 text-gray-300 font-medium px-4 py-2 rounded-md transition-colors',
  
  // Icon buttons
  ICON: 'p-2 hover:bg-gray-100 rounded-md transition-colors',
  ICON_DARK: 'p-2 hover:bg-gray-700 rounded-md transition-colors'
};

/**
 * Input field standardization
 */
export const INPUTS = {
  // Standard inputs
  BASE: 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-cockpit-accent focus:ring-1 focus:ring-cockpit-accent',
  BASE_DARK: 'w-full px-3 py-2 bg-cockpit-bg border border-gray-600 text-white rounded-md shadow-sm focus:border-cockpit-accent focus:ring-1 focus:ring-cockpit-accent',
  
  // Select dropdowns
  SELECT: 'w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-cockpit-accent focus:ring-1 focus:ring-cockpit-accent bg-white',
  SELECT_DARK: 'w-full px-3 py-2 bg-cockpit-bg border border-gray-600 text-white rounded-md shadow-sm focus:border-cockpit-accent focus:ring-1 focus:ring-cockpit-accent',
  
  // Checkboxes and radios
  CHECKBOX: 'rounded border-gray-300 text-cockpit-accent focus:ring-cockpit-accent',
  RADIO: 'border-gray-300 text-cockpit-accent focus:ring-cockpit-accent'
};

/**
 * Aviation-specific status colors and indicators
 */
export const STATUS = {
  // Flight categories
  VFR: 'bg-green-100 text-green-800 border-green-200',
  MVFR: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  IFR: 'bg-red-100 text-red-800 border-red-200',
  LIFR: 'bg-purple-100 text-purple-800 border-purple-200',
  
  // Alert severities
  INFO: 'bg-blue-50 text-blue-700 border-blue-200',
  WARNING: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  ERROR: 'bg-red-50 text-red-700 border-red-200',
  SUCCESS: 'bg-green-50 text-green-700 border-green-200',
  
  // Status badges
  BADGE: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  BADGE_LG: 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium'
};

/**
 * Responsive breakpoint utilities
 */
export const RESPONSIVE = {
  // Show/hide at breakpoints
  MOBILE_ONLY: 'block sm:hidden',
  TABLET_UP: 'hidden sm:block',
  DESKTOP_UP: 'hidden lg:block',
  
  // Responsive text sizes
  TEXT_RESPONSIVE: 'text-sm sm:text-base lg:text-lg',
  
  // Responsive padding/margins
  PADDING_RESPONSIVE: 'p-4 sm:p-6 lg:p-8',
  MARGIN_RESPONSIVE: 'm-4 sm:m-6 lg:m-8'
};

/**
 * Animation and transition utilities
 */
export const ANIMATIONS = {
  // Transitions
  TRANSITION: 'transition-colors duration-200',
  TRANSITION_ALL: 'transition-all duration-200',
  TRANSITION_SLOW: 'transition-all duration-300',
  
  // Loading states
  PULSE: 'animate-pulse',
  SPIN: 'animate-spin',
  BOUNCE: 'animate-bounce',
  
  // Hover effects
  HOVER_LIFT: 'hover:shadow-lg hover:-translate-y-1 transition-all duration-200',
  HOVER_SCALE: 'hover:scale-105 transition-transform duration-200'
};

/**
 * Utility function to combine classes with proper spacing
 */
export const combineClasses = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

/**
 * Common layout patterns as functions
 */
export const createCardLayout = (content, { 
  dark = false, 
  padding = 'MD',
  shadow = true 
} = {}) => {
  const baseClasses = dark ? CONTAINERS.CARD_DARK : CONTAINERS.CARD;
  const paddingClass = padding === 'SM' ? CONTAINERS.CARD_PADDING_SM : CONTAINERS.CARD_PADDING;
  const shadowClass = shadow ? (dark ? 'shadow-xl' : 'shadow-sm') : '';
  
  return combineClasses(baseClasses, paddingClass, shadowClass);
};

/**
 * Create standardized section layout
 */
export const createSectionLayout = (spacing = 'MD') => {
  return spacing === 'LG' ? CONTAINERS.SECTION_LG : CONTAINERS.SECTION;
};

/**
 * Create responsive grid layout
 */
export const createGridLayout = (type = 'AUTO_FIT', gap = 'MD') => {
  const gridClass = GRIDS[type] || GRIDS.AUTO_FIT;
  const gapClass = SPACING.GAP[gap] || SPACING.GAP.MD;
  
  return combineClasses(gridClass.replace(/gap-\d+/, ''), gapClass);
};

export default {
  SPACING,
  CONTAINERS, 
  GRIDS,
  FLEX,
  TYPOGRAPHY,
  BUTTONS,
  INPUTS,
  STATUS,
  RESPONSIVE,
  ANIMATIONS,
  combineClasses,
  createCardLayout,
  createSectionLayout,
  createGridLayout
};