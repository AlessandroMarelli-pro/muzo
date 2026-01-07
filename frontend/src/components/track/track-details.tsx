import type { MusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AnalysisStatus } from '@/services/api-hooks';
import {
  AlertCircle,
  Brain,
  Calendar,
  CheckCircle,
  Clock,
  Disc,
  Download,
  Edit,
  FileText,
  HardDrive,
  Loader,
  Music,
  Pause,
  Play,
  Share,
  Tag,
  User,
} from 'lucide-react';
import React from 'react';

interface TrackDetailsProps {
  track: MusicTrack;
  isPlaying?: boolean;
  onPlay: (trackId: string) => void;
  onPause: () => void;
  onEdit: (trackId: string) => void;
  onDownload?: (trackId: string) => void;
  onShare?: (trackId: string) => void;
}

const getAnalysisStatusColor = (status: AnalysisStatus) => {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getAnalysisStatusIcon = (status: AnalysisStatus) => {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4" />;
    case 'PROCESSING':
      return <Loader className="h-4 w-4 animate-spin" />;
    case 'PENDING':
      return <Clock className="h-4 w-4" />;
    case 'FAILED':
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes: number) => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const TrackDetails: React.FC<TrackDetailsProps> = ({
  track,
  isPlaying = false,
  onPlay,
  onPause,
  onEdit,
  onDownload,
  onShare,
}) => {
  const displayTitle =
    track.userTitle || track.aiTitle || track.originalTitle || track.fileName;
  const displayArtist =
    track.userArtist ||
    track.aiArtist ||
    track.originalArtist ||
    'Unknown Artist';
  const displayAlbum =
    track.userAlbum || track.aiAlbum || track.originalAlbum || 'Unknown Album';
  const displayGenres = track.genres && track.genres.length > 0 
    ? track.genres.join(', ') 
    : undefined;
  const displaySubgenres = track.subgenres && track.subgenres.length > 0 
    ? track.subgenres.join(', ') 
    : undefined;

  const hasAIMetadata =
    track.aiTitle || track.aiArtist || track.aiAlbum;
  const hasUserMetadata =
    track.userTitle || track.userArtist || track.userAlbum;
  const hasOriginalMetadata =
    track.originalTitle ||
    track.originalArtist ||
    track.originalAlbum;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Music className="h-8 w-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">{displayTitle}</CardTitle>
                <CardDescription className="text-lg">
                  {displayArtist}
                </CardDescription>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge
                    className={getAnalysisStatusColor(track.analysisStatus)}
                  >
                    {getAnalysisStatusIcon(track.analysisStatus)}
                    {track.analysisStatus}
                  </Badge>
                  {track.aiConfidence && (
                    <Badge variant="outline" className="text-blue-600">
                      <Brain className="h-3 w-3 mr-1" />
                      {Math.round(track.aiConfidence * 100)}% confidence
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => (isPlaying ? onPause() : onPlay(track.id))}
                size="lg"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 mr-2" />
                ) : (
                  <Play className="h-5 w-5 mr-2" />
                )}
                {isPlaying ? 'Pause' : 'Play'}
              </Button>
              <Button variant="outline" onClick={() => onEdit(track.id)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {onDownload && (
                <Button variant="outline" onClick={() => onDownload(track.id)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
              {onShare && (
                <Button variant="outline" onClick={() => onShare(track.id)}>
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Metadata Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Duration</div>
                <div className="font-medium flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {formatDuration(track.duration)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Format</div>
                <div className="font-medium">{track.format}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">File Size</div>
                <div className="font-medium flex items-center">
                  <HardDrive className="h-4 w-4 mr-1" />
                  {formatFileSize(track.fileSize)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Bitrate</div>
                <div className="font-medium">
                  {track.bitrate ? `${track.bitrate} kbps` : 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sample Rate</div>
                <div className="font-medium">
                  {track.sampleRate ? `${track.sampleRate} Hz` : 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Play Count</div>
                <div className="font-medium">{track.listeningCount} times</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Album Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Disc className="h-5 w-5 mr-2" />
              Album Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Album</div>
              <div className="font-medium">{displayAlbum}</div>
            </div>
            {displayGenres && (
              <div>
                <div className="text-sm text-muted-foreground">Genres</div>
                <div className="font-medium flex items-center flex-wrap gap-1">
                  <Tag className="h-4 w-4 mr-1" />
                  {displayGenres}
                </div>
              </div>
            )}
            {displaySubgenres && (
              <div>
                <div className="text-sm text-muted-foreground">Subgenres</div>
                <div className="font-medium flex items-center flex-wrap gap-1">
                  <Tag className="h-4 w-4 mr-1" />
                  {displaySubgenres}
                </div>
              </div>
            )}
            {track.originalYear && (
              <div>
                <div className="text-sm text-muted-foreground">Year</div>
                <div className="font-medium">{track.originalYear}</div>
              </div>
            )}
            {track.userTags && track.userTags.length > 0 && (
              <div>
                <div className="text-sm text-muted-foreground">User Tags</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {track.userTags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadata Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="h-5 w-5 mr-2" />
            Metadata Sources
          </CardTitle>
          <CardDescription>
            Information from different sources (Original, AI, User)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Original Metadata */}
            {hasOriginalMetadata && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground">
                  Original
                </h4>
                <div className="space-y-2 text-sm">
                  {track.originalTitle && (
                    <div>
                      <span className="text-muted-foreground">Title:</span>
                      <div className="font-medium">{track.originalTitle}</div>
                    </div>
                  )}
                  {track.originalArtist && (
                    <div>
                      <span className="text-muted-foreground">Artist:</span>
                      <div className="font-medium">{track.originalArtist}</div>
                    </div>
                  )}
                  {track.originalAlbum && (
                    <div>
                      <span className="text-muted-foreground">Album:</span>
                      <div className="font-medium">{track.originalAlbum}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Metadata */}
            {hasAIMetadata && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-blue-600 flex items-center">
                  <Brain className="h-4 w-4 mr-1" />
                  AI Generated
                </h4>
                <div className="space-y-2 text-sm">
                  {track.aiTitle && (
                    <div>
                      <span className="text-muted-foreground">Title:</span>
                      <div className="font-medium">{track.aiTitle}</div>
                    </div>
                  )}
                  {track.aiArtist && (
                    <div>
                      <span className="text-muted-foreground">Artist:</span>
                      <div className="font-medium">{track.aiArtist}</div>
                    </div>
                  )}
                  {track.aiAlbum && (
                    <div>
                      <span className="text-muted-foreground">Album:</span>
                      <div className="font-medium">{track.aiAlbum}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* User Metadata */}
            {hasUserMetadata && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-green-600 flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  User Modified
                </h4>
                <div className="space-y-2 text-sm">
                  {track.userTitle && (
                    <div>
                      <span className="text-muted-foreground">Title:</span>
                      <div className="font-medium">{track.userTitle}</div>
                    </div>
                  )}
                  {track.userArtist && (
                    <div>
                      <span className="text-muted-foreground">Artist:</span>
                      <div className="font-medium">{track.userArtist}</div>
                    </div>
                  )}
                  {track.userAlbum && (
                    <div>
                      <span className="text-muted-foreground">Album:</span>
                      <div className="font-medium">{track.userAlbum}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2" />
            Analysis Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="font-medium">
                <Badge className={getAnalysisStatusColor(track.analysisStatus)}>
                  {getAnalysisStatusIcon(track.analysisStatus)}
                  {track.analysisStatus}
                </Badge>
              </div>
            </div>
            {track.analysisStartedAt && (
              <div>
                <div className="text-sm text-muted-foreground">Started</div>
                <div className="font-medium flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(track.analysisStartedAt)}
                </div>
              </div>
            )}
            {track.analysisCompletedAt && (
              <div>
                <div className="text-sm text-muted-foreground">Completed</div>
                <div className="font-medium flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatDate(track.analysisCompletedAt)}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(track.createdAt)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Updated</div>
              <div className="font-medium flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(track.updatedAt)}
              </div>
            </div>
          </div>

          {track.analysisError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Analysis Error</span>
              </div>
              <p className="text-red-700 mt-2">{track.analysisError}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
