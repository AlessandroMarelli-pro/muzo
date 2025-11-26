# DetailedTrackCard Component

A comprehensive track card component inspired by modern music software interfaces, featuring detailed track information, analytics visualization, and action buttons.

## Features

- **Circular Album Art**: Large, prominent album cover with play button overlay
- **Rich Metadata**: Duration, artist, play count, BPM, energy, danceability
- **Genre Tags**: Visual badges for genre and subgenre
- **Analytics Visualization**: Mini waveform-style chart placeholder
- **Action Buttons**: Play, edit, share, export, and view controls
- **Responsive Design**: Adapts to different screen sizes

## Usage

### Basic Usage

```tsx
import { DetailedTrackCard } from '@/components/track/detailed-track-card';
import { MusicTrackListItem } from '@/__generated__/types';

function TrackView() {
  const track: MusicTrackListItem = {
    id: 'track-1',
    artist: 'Deadmau5',
    title: 'Strobe',
    duration: 636,
    genre: 'electronic',
    subgenre: 'progressive house',
    // ... other track properties
  };

  return (
    <DetailedTrackCard
      track={track}
      onPlay={(track) => console.log('Playing:', track.title)}
      onEdit={(track) => console.log('Editing:', track.title)}
      onShare={(track) => console.log('Sharing:', track.title)}
      onExport={(track) => console.log('Exporting:', track.title)}
    />
  );
}
```

### With Event Handlers

```tsx
import { DetailedTrackCard } from '@/components/track/detailed-track-card';
import { useAudioPlayerActions } from '@/contexts/audio-player-context';

function TrackPlayer() {
  const { playTrack } = useAudioPlayerActions();

  const handlePlay = (track: MusicTrackListItem) => {
    playTrack(track.id);
  };

  const handleEdit = (track: MusicTrackListItem) => {
    // Open track editor
    router.push(`/tracks/${track.id}/edit`);
  };

  const handleShare = (track: MusicTrackListItem) => {
    // Copy track link to clipboard
    navigator.clipboard.writeText(
      `${window.location.origin}/tracks/${track.id}`,
    );
  };

  const handleExport = (track: MusicTrackListItem) => {
    // Export track data
    const dataStr = JSON.stringify(track, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${track.title}.json`;
    link.click();
  };

  return (
    <DetailedTrackCard
      track={track}
      onPlay={handlePlay}
      onEdit={handleEdit}
      onShare={handleShare}
      onExport={handleExport}
    />
  );
}
```

## Props

### DetailedTrackCardProps

| Prop       | Type                                  | Required | Description                          |
| ---------- | ------------------------------------- | -------- | ------------------------------------ |
| `track`    | `MusicTrackListItem`                  | ✅       | The track data to display            |
| `onPlay`   | `(track: MusicTrackListItem) => void` | ❌       | Called when play button is clicked   |
| `onEdit`   | `(track: MusicTrackListItem) => void` | ❌       | Called when edit button is clicked   |
| `onShare`  | `(track: MusicTrackListItem) => void` | ❌       | Called when share button is clicked  |
| `onExport` | `(track: MusicTrackListItem) => void` | ❌       | Called when export button is clicked |

## Design Features

### Layout Structure

1. **Header Section**
   - Circular album art (128x128px)
   - Play button overlay
   - Track title and type badge
   - Metadata grid with icons

2. **Metadata Display**
   - Duration with clock icon
   - Artist with users icon
   - Play count with activity icon
   - BPM with music icon
   - Energy level with zap icon
   - Danceability with activity icon

3. **Genre Tags**
   - Primary genre badge
   - Subgenre badge (if available)

4. **Analytics Visualization**
   - Mini waveform-style chart
   - Analytics button

5. **Action Buttons**
   - Similar Tracks
   - Magic Sort
   - Auto Group (disabled)
   - Filters
   - Edit, Maximize, Refresh, List, Grid, Share
   - Export button

### Styling

- Uses Tailwind CSS for styling
- Follows the design system color scheme
- Responsive grid layout for metadata
- Consistent icon sizing (16x16px)
- Proper spacing and typography hierarchy

## Demo Component

A demo component is available to showcase the DetailedTrackCard:

```tsx
import { DetailedTrackCardDemo } from '@/components/track/detailed-track-card-demo';

function App() {
  return <DetailedTrackCardDemo />;
}
```

## Integration with Audio Player

The component is designed to work seamlessly with the audio player context:

```tsx
import {
  useAudioPlayerActions,
  useCurrentTrack,
} from '@/contexts/audio-player-context';

function TrackCardWithPlayer() {
  const { playTrack, pauseTrack } = useAudioPlayerActions();
  const currentTrack = useCurrentTrack();

  const handlePlay = (track: MusicTrackListItem) => {
    if (currentTrack?.id === track.id) {
      pauseTrack();
    } else {
      playTrack(track.id);
    }
  };

  return <DetailedTrackCard track={track} onPlay={handlePlay} />;
}
```

## Accessibility

- All interactive elements have proper ARIA labels
- Keyboard navigation support
- Screen reader friendly
- High contrast support
- Focus indicators

## Performance

- Optimized with React.memo for re-render prevention
- Efficient image loading with proper alt text
- Lazy loading support for large track lists
- Minimal bundle impact

## Future Enhancements

- Real analytics visualization integration
- Drag and drop support
- Context menu integration
- Real-time play count updates
- Social sharing features
- Export format options
