/**
 * Shared option lists for track audio-feature columns and filters.
 *
 * These live here (rather than inside a single table) so every track view —
 * Music, Pending, Favorites — labels and filters the same values identically.
 */

export const danceabilityFeelingOptions = [
  { label: 'Highly Danceable', value: 'highly-danceable' },
  { label: 'Danceable', value: 'danceable' },
  { label: 'Moderately Danceable', value: 'moderately-danceable' },
  { label: 'Slightly Danceable', value: 'slightly-danceable' },
  { label: 'Minimally Danceable', value: 'minimally-danceable' },
  { label: 'Ambient', value: 'ambient' },
  { label: 'Experimental', value: 'experimental' },
];

export const arousalMoodOptions = [
  { label: 'Very Calm', value: 'very calm' },
  { label: 'Calm', value: 'calm' },
  { label: 'Moderate Energy', value: 'moderate energy' },
  { label: 'Energetic', value: 'energetic' },
  { label: 'Very Energetic', value: 'very energetic' },
];

export const valenceMoodOptions = [
  { label: 'Very Positive', value: 'very positive' },
  { label: 'Positive', value: 'positive' },
  { label: 'Neutral', value: 'neutral' },
  { label: 'Negative', value: 'negative' },
  { label: 'Very Negative', value: 'very negative' },
];

/**
 * Camelot wheel keys with their harmonic-mixing colors. Keys a fifth apart sit
 * next to each other on the wheel and share a hue, so DJs can spot compatible
 * tracks at a glance.
 */
export const CamelotKeyOptions = [
  // Major keys (inner circle)
  { label: 'C major', value: '8B', color: 'rgba(221, 160, 221,0.5)' }, // Plum/Lavender
  { label: 'G major', value: '9B', color: 'rgba(128, 0, 128,0.5)' }, // Purple
  { label: 'D major', value: '10B', color: 'rgba(0, 0, 139,0.5)' }, // Dark Blue
  { label: 'A major', value: '11B', color: 'rgba(0, 0, 255,0.5)' }, // Blue
  { label: 'E major', value: '12B', color: 'rgba(0, 128, 128,0.5)' }, // Teal
  { label: 'B major', value: '1B', color: 'rgba(0, 255, 255,0.5)' }, // Cyan
  { label: 'F# major', value: '2B', color: 'rgba(144, 238, 144,0.5)' }, // Light Green
  { label: 'C# major', value: '3B', color: 'rgba(0, 128, 0,0.5)' }, // Green
  { label: 'G# major', value: '4B', color: 'rgba(255, 215, 0,0.5)' }, // Gold
  { label: 'D# major', value: '5B', color: 'rgba(255, 165, 0,0.5)' }, // Orange
  { label: 'A# major', value: '6B', color: 'rgba(255, 69, 0,0.5)' }, // Orange Red
  { label: 'Gb major', value: '2B', color: 'rgba(144, 238, 144,0.5)' }, // Light Green
  { label: 'Db major', value: '3B', color: 'rgba(0, 128, 0,0.5)' }, // Green
  { label: 'Ab major', value: '4B', color: 'rgba(255, 215, 0,0.5)' }, // Gold
  { label: 'Eb major', value: '5B', color: 'rgba(255, 165, 0,0.5)' }, // Orange
  { label: 'Bb major', value: '6B', color: 'rgba(255, 69, 0,0.5)' }, // Orange Red
  { label: 'F major', value: '7B', color: 'rgba(255, 20, 147,0.5)' }, // Deep Pink
  // Minor keys (outer circle)
  { label: 'A minor', value: '8A', color: 'rgba(221, 160, 221,0.5)' }, // Plum/Lavender
  { label: 'E minor', value: '9A', color: 'rgba(128, 0, 128,0.5)' }, // Purple
  { label: 'B minor', value: '10A', color: 'rgba(0, 0, 139,0.5)' }, // Dark Blue
  { label: 'F# minor', value: '11A', color: 'rgba(0, 0, 255,0.5)' }, // Blue
  { label: 'C# minor', value: '12A', color: 'rgba(0, 128, 128,0.5)' }, // Teal
  { label: 'G# minor', value: '1A', color: 'rgba(0, 255, 255,0.5)' }, // Cyan
  { label: 'D# minor', value: '2A', color: 'rgba(144, 238, 144,0.5)' }, // Light Green
  { label: 'A# minor', value: '3A', color: 'rgba(0, 128, 0,0.5)' }, // Green
  { label: 'F minor', value: '4A', color: 'rgba(255, 215, 0,0.5)' }, // Gold
  { label: 'C minor', value: '5A', color: 'rgba(255, 165, 0,0.5)' }, // Orange
  { label: 'G minor', value: '6A', color: 'rgba(255, 69, 0,0.5)' }, // Orange Red
  { label: 'D minor', value: '7A', color: 'rgba(255, 20, 147,0.5)' }, // Deep Pink
  { label: 'Db minor', value: '12A', color: 'rgba(0, 128, 128,0.5)' }, // Teal
  { label: 'Ab minor', value: '1A', color: 'rgba(0, 255, 255,0.5)' }, // Cyan
  { label: 'Eb minor', value: '2A', color: 'rgba(144, 238, 144,0.5)' }, // Light Green
  { label: 'Bb minor', value: '3A', color: 'rgba(0, 128, 0,0.5)' }, // Green
];

export const findCamelotKey = (key?: string | null) =>
  CamelotKeyOptions.find((option) => option.label?.toLowerCase() === key?.toLowerCase());

/**
 * A track's key in the one form used everywhere it's shown: the Camelot code
 * (the harmonic-mixing coordinate) plus an abbreviated musical name, e.g.
 * `"8A · A min"`. Falls back to the raw value when it isn't a known key.
 */
export const formatKey = (key?: string | null): string | null => {
  if (!key) return null;
  const match = findCamelotKey(key);
  if (!match) return key;
  const shortName = match.label.replace(/\bminor\b/i, 'min').replace(/\bmajor\b/i, 'maj');
  return `${match.value} · ${shortName}`;
};

export const findFeatureLabel = (
  options: { label: string; value: string }[],
  value?: string | null,
) => options.find((option) => option.value === value)?.label;
