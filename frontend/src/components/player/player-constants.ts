/**
 * Height of the docked music-player bar. Fixed px (not vh) so the transport
 * cluster, the 56px art thumb, and two text lines always fit — a viewport-
 * relative height collapsed the bar on short screens.
 *
 * `--music-player-height` is set from this on the sidebar wrapper and the
 * inset, so the three stay in lockstep. When no track is loaded the bar
 * unmounts and the inset drops its reserved margin (see MusicPlayerInset).
 */
export const MUSIC_PLAYER_HEIGHT = '4.5rem';
export const MUSIC_PLAYER_HEIGHT_SM = '5.5rem';
export const MUSIC_PLAYER_HEIGHT_CSS = `var(--music-player-height)`;
