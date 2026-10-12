import type { ThemeId } from '../domain/settings';

export type Theme = {
  id: ThemeId;
  label: string;
  colors: {
    background: string;
    surface: string;
    surfaceRaised: string;
    border: string;
    text: string;
    textMuted: string;
    textFaint: string;
    /** Sound is playing. */
    playing: string;
    /** Silent wait between plays. */
    waiting: string;
    paused: string;
    danger: string;
    onAccent: string;
    track: string;
  };
};

/**
 * Three night palettes. Every one keeps body text at a comfortable contrast
 * without pure white, and Ember drops nearly all blue light for bedtime use.
 */
export const THEMES: Record<ThemeId, Theme> = {
  dusk: {
    id: 'dusk',
    label: 'Dusk',
    colors: {
      background: '#0B0E14',
      surface: '#131823',
      surfaceRaised: '#1B2231',
      border: '#252E40',
      text: '#E3E7F0',
      textMuted: '#98A2B8',
      textFaint: '#5E6880',
      playing: '#9AA8FF',
      waiting: '#6FD3C1',
      paused: '#E8B86A',
      danger: '#F08A8A',
      onAccent: '#0B0E14',
      track: '#232B3B',
    },
  },
  black: {
    id: 'black',
    label: 'Black',
    colors: {
      background: '#000000',
      surface: '#0A0A0A',
      surfaceRaised: '#141414',
      border: '#1F1F1F',
      text: '#D6D6D6',
      textMuted: '#8C8C8C',
      textFaint: '#555555',
      playing: '#B8C4FF',
      waiting: '#7FD8C6',
      paused: '#DDB36B',
      danger: '#E58080',
      onAccent: '#000000',
      track: '#1C1C1C',
    },
  },
  ember: {
    id: 'ember',
    label: 'Ember',
    colors: {
      background: '#120A07',
      surface: '#1C110C',
      surfaceRaised: '#261811',
      border: '#36231A',
      text: '#EBCDB0',
      textMuted: '#B08C70',
      textFaint: '#76594A',
      playing: '#F0955A',
      waiting: '#D9B062',
      paused: '#C98F7A',
      danger: '#E0705C',
      onAccent: '#120A07',
      track: '#2E1D15',
    },
  },
};
