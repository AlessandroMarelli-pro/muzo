import type { MusicTrack } from '@/__generated__/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AnalysisStatus } from '@/services/api-hooks';
import {
  Activity,
  BarChart3,
  Calendar,
  Music,
  PieChart as PieChartIcon,
  TrendingUp,
} from 'lucide-react';
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { NoData } from '../no-data';

interface LibraryChartProps {
  tracks: MusicTrack[];
  isLoading?: boolean;
}

interface ChartCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  icon,
  children,
  className = '',
}) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="flex items-center">
        {icon}
        <span className="ml-2">{title}</span>
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82CA9D',
  '#FFC658',
  '#FF7C7C',
  '#8DD1E1',
  '#D084D0',
];

const getAnalysisStatusData = (tracks: MusicTrack[]) => {
  const statusCounts = tracks.reduce((counts, track) => {
    counts[track.analysisStatus] = (counts[track.analysisStatus] || 0) + 1;
    return counts;
  }, {} as Record<AnalysisStatus, number>);

  return Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
    percentage: (count / tracks.length) * 100,
  }));
};

const getGenreData = (tracks: MusicTrack[]) => {
  const genreCounts: Record<string, number> = {};

  tracks.forEach((track) => {
    const genre =
      track.userGenre || track.aiGenre || track.originalGenre || 'Unknown';
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
  });

  return Object.entries(genreCounts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // Top 8 genres
};

const getFormatData = (tracks: MusicTrack[]) => {
  const formatCounts: Record<string, number> = {};

  tracks.forEach((track) => {
    formatCounts[track.format] = (formatCounts[track.format] || 0) + 1;
  });

  return Object.entries(formatCounts)
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);
};

const getYearData = (tracks: MusicTrack[]) => {
  const yearCounts: Record<number, number> = {};

  tracks.forEach((track) => {
    const year = track.originalYear;
    if (year && year >= 1950 && year <= new Date().getFullYear()) {
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
  });

  return Object.entries(yearCounts)
    .map(([year, count]) => ({ year: parseInt(year), count }))
    .sort((a, b) => a.year - b.year)
    .filter((item) => item.count > 0);
};

const getListeningTrendData = (tracks: MusicTrack[]) => {
  const sortedTracks = [...tracks]
    .sort((a, b) => (a.listeningCount || 0) - (b.listeningCount || 0))
    .slice(0, 20); // Top 20 most played tracks

  return sortedTracks.map((track, index) => ({
    rank: index + 1,
    track:
      track.userTitle || track.aiTitle || track.originalTitle || track.fileName,
    plays: track.listeningCount || 0,
  }));
};

const getConfidenceDistribution = (tracks: MusicTrack[]) => {
  const confidenceRanges = [
    { range: '0-20%', min: 0, max: 0.2, count: 0 },
    { range: '20-40%', min: 0.2, max: 0.4, count: 0 },
    { range: '40-60%', min: 0.4, max: 0.6, count: 0 },
    { range: '60-80%', min: 0.6, max: 0.8, count: 0 },
    { range: '80-100%', min: 0.8, max: 1.0, count: 0 },
  ];

  tracks.forEach((track) => {
    if (track.aiConfidence !== undefined) {
      confidenceRanges.forEach((range) => {
        if (
          track.aiConfidence! >= range.min &&
          track.aiConfidence! < range.max
        ) {
          range.count++;
        }
      });
    }
  });

  return confidenceRanges.filter((range) => range.count > 0);
};

export const LibraryChart: React.FC<LibraryChartProps> = ({
  tracks,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Library Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-80 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <NoData
        Icon={Music}
        title="No Data Available"
        subtitle="Add some tracks to see analytics and visualizations."
      />
    );
  }

  const analysisStatusData = getAnalysisStatusData(tracks);
  const genreData = getGenreData(tracks);
  const formatData = getFormatData(tracks);
  const yearData = getYearData(tracks);
  const listeningTrendData = getListeningTrendData(tracks);
  const confidenceData = getConfidenceDistribution(tracks);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Library Analytics</h2>
          <p className="text-muted-foreground">
            Visual insights into your music collection
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {tracks.length} tracks analyzed
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis Status Pie Chart */}
        <ChartCard
          title="Analysis Status"
          description="Distribution of track analysis states"
          icon={<PieChartIcon className="h-5 w-5" />}
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analysisStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, percentage }) => `${status}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {analysisStatusData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Genre Distribution Bar Chart */}
        {genreData.length > 0 && (
          <ChartCard
            title="Genre Distribution"
            description="Most popular genres in your library"
            icon={<BarChart3 className="h-5 w-5" />}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={genreData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="genre"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Format Distribution */}
        {formatData.length > 0 && (
          <ChartCard
            title="Audio Formats"
            description="Distribution of audio file formats"
            icon={<Music className="h-5 w-5" />}
          >
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={formatData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ format, count }) => `${format}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {formatData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Year Distribution Line Chart */}
        {yearData.length > 0 && (
          <ChartCard
            title="Release Years"
            description="Music release timeline"
            icon={<Calendar className="h-5 w-5" />}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={yearData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      {/* Listening Trends */}
      {listeningTrendData.length > 0 && (
        <ChartCard
          title="Most Played Tracks"
          description="Top tracks by play count"
          icon={<TrendingUp className="h-5 w-5" />}
          className="col-span-full"
        >
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={listeningTrendData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              layout="horizontal"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis
                dataKey="track"
                type="category"
                width={200}
                fontSize={12}
              />
              <Tooltip />
              <Bar dataKey="plays" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* AI Confidence Distribution */}
      {confidenceData.length > 0 && (
        <ChartCard
          title="AI Confidence Distribution"
          description="Quality of AI analysis results"
          icon={<Activity className="h-5 w-5" />}
          className="col-span-full"
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={confidenceData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
};
