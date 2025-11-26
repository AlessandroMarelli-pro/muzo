# Image Module

This module provides functionality to search and manage album artwork for music tracks using the [covers.musichoarders.xyz](https://covers.musichoarders.xyz/) service.

## Features

- **Image Search**: Search for album artwork based on track metadata (artist, album)
- **Image Serving**: Serve cached images via HTTP endpoints
- **Batch Operations**: Search for multiple tracks at once
- **GraphQL API**: Full GraphQL support for image operations
- **REST API**: HTTP endpoints for image management

## Architecture

### Components

- **ImageService**: Core business logic for image operations
- **ImageController**: HTTP REST API endpoints
- **ImageResolver**: GraphQL API resolvers
- **ImageModule**: Module configuration and exports

### Data Flow

```
Track Request → ImageService → covers.musichoarders.xyz → Image Storage → HTTP Response
```

## API Endpoints

### REST API

#### Image Serving

- `GET /api/images/:imagePath` - Serve image file
- `GET /api/images/track/:trackId` - Get image info for track
- `GET /api/images/track/:trackId/url` - Get image URL for track

#### Image Search

- `POST /api/images/search` - Search for image for a track
- `POST /api/images/search/batch` - Batch search for multiple tracks
- `GET /api/images/search/:searchId/status` - Get search status

#### Image Management

- `GET /api/images/track/:trackId/searches` - Get all searches for track
- `POST /api/images/track/:trackId/delete` - Delete image for track
- `GET /api/images/health` - Health check

### GraphQL API

#### Queries

- `getImageForTrack(trackId: ID!)` - Get image for track
- `getImageUrl(trackId: ID!)` - Get image URL
- `getImageSearchStatus(searchId: ID!)` - Get search status
- `getImageSearchesForTrack(trackId: ID!)` - Get all searches for track

#### Mutations

- `searchImageForTrack(input: SearchImageInput!)` - Search for image
- `batchSearchImages(input: BatchSearchInput!)` - Batch search
- `deleteImageForTrack(trackId: ID!)` - Delete image

## Usage Examples

### Search for Image (REST)

```bash
curl -X POST http://localhost:3000/api/images/search \
  -H "Content-Type: application/json" \
  -d '{"trackId": "track-uuid-here"}'
```

### Search for Image (GraphQL)

```graphql
mutation {
  searchImageForTrack(input: { trackId: "track-uuid-here" }) {
    id
    trackId
    searchUrl
    status
    imageUrl
  }
}
```

### Get Image URL

```graphql
query {
  getImageUrl(trackId: "track-uuid-here") {
    url
  }
}
```

### Batch Search

```graphql
mutation {
  batchSearchImages(input: { trackIds: ["track1", "track2", "track3"] }) {
    id
    trackId
    status
    imageUrl
  }
}
```

## Configuration

### Environment Variables

No specific environment variables are required. The module uses:

- Default images directory: `backend/images/`
- Covers service URL: `https://covers.musichoarders.xyz`

### File Storage

Images are stored in the `backend/images/` directory with the following naming convention:

- `{trackId}.jpg` - Main album artwork
- `{searchId}.jpg` - Temporary search results

## Integration with covers.musichoarders.xyz

The module integrates with the covers.musichoarders.xyz service following their API guidelines:

### Query Parameters

The service builds search URLs with the following parameters:

- `artist` - Artist name
- `album` - Album name
- `theme` - UI theme (light/dark)
- `resolution` - Image resolution
- `sources` - Image sources
- `country` - Country code

### Search Process

1. **Metadata Extraction**: Extracts artist/album from track metadata
2. **URL Generation**: Builds search URL with parameters
3. **User Interaction**: Opens covers website for user selection
4. **Image Download**: Downloads selected image
5. **Storage**: Saves image to local storage
6. **Database Update**: Updates search status

### Compliance

The implementation follows the covers.musichoarders.xyz guidelines:

- ✅ Semi-automatic process based on user input
- ✅ Opens official covers website for user interaction
- ✅ Includes visible text mentioning the project
- ✅ Respects rate limiting and usage policies

## Error Handling

The module includes comprehensive error handling:

- **Track Not Found**: Returns 404 for non-existent tracks
- **Missing Metadata**: Handles tracks without artist/album info
- **Network Errors**: Graceful handling of API failures
- **File System Errors**: Proper error handling for file operations

## Performance Considerations

- **Caching**: Images are cached locally to avoid repeated downloads
- **Async Processing**: Image downloads happen asynchronously
- **Batch Operations**: Supports batch processing for multiple tracks
- **File Serving**: Efficient HTTP serving with proper headers

## Security

- **Input Validation**: All inputs are validated
- **Path Sanitization**: Prevents directory traversal attacks
- **File Type Validation**: Ensures only image files are served
- **Rate Limiting**: Respects external service rate limits

## Development

### Adding New Features

1. Update the `ImageService` with new business logic
2. Add corresponding endpoints to `ImageController`
3. Add GraphQL resolvers to `ImageResolver`
4. Update types and interfaces as needed
5. Add tests for new functionality

### Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:cov

# Run specific test file
npm run test -- image.service.spec.ts
```

## Dependencies

- `@nestjs/common` - NestJS core
- `@nestjs/graphql` - GraphQL support
- `axios` - HTTP client for external API calls
- `fs/promises` - File system operations
- `path` - Path utilities
- `uuid` - UUID generation

## Future Enhancements

- [ ] Database storage for image search history
- [ ] Image optimization and resizing
- [ ] Multiple image format support
- [ ] CDN integration for image serving
- [ ] Advanced caching strategies
- [ ] Image quality analysis
- [ ] Automatic fallback to other image sources
