# Muzo Frontend

AI-powered music library organization frontend built with React 19, Vite, TanStack Router, TanStack Query, TailwindCSS, and Shadcn/ui.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Features](#features)
- [Architecture](#architecture)
- [API Integration](#api-integration)
- [Testing](#testing)
- [Configuration](#configuration)
- [Dependencies](#dependencies)
- [Development Guidelines](#development-guidelines)
- [License](#license)

---

## Tech Stack

| Category             | Technology                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| **Framework**        | React 19                                                                   |
| **Build Tool**       | Vite 7                                                                     |
| **Language**         | TypeScript 5.9 (strict mode)                                               |
| **Routing**          | TanStack Router (file-based routing with auto code-splitting)              |
| **Server State**     | TanStack Query (React Query)                                               |
| **Styling**          | Tailwind CSS 4 + Shadcn/ui (New York style)                                |
| **Form Validation**  | Zod                                                                        |
| **Charts**           | Recharts                                                                   |
| **Animations**       | Motion (Framer Motion)                                                     |
| **Data Tables**      | TanStack Table                                                             |
| **Drag & Drop**      | dnd-kit                                                                    |
| **API Client**       | GraphQL (graphql-request) + REST                                           |
| **Real-time**        | Socket.IO Client                                                           |
| **Visualizations**   | p5.js (@p5-wrapper/react)                                                  |
| **Testing**          | Vitest + React Testing Library                                             |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (comes with Node.js) or **yarn** / **pnpm**

### Installation

```bash
# Clone the repository (if not already done)
cd frontend

# Install dependencies
npm install
```

### Development Server

```bash
npm run dev
```

The application will be available at **http://localhost:3000**.

### Building for Production

```bash
npm run build
```

This runs TypeScript compilation followed by Vite build. Output is generated in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

---

## Project Structure

```
frontend/
├── public/                    # Static assets
├── src/
│   ├── __generated__/         # Auto-generated GraphQL types
│   │   └── types.ts
│   ├── app/                   # App-specific data/config
│   │   └── dashboard/
│   ├── components/
│   │   ├── animated-components/   # p5.js waveform visualizations
│   │   ├── categories/            # Category/genre components
│   │   ├── data-table/            # Advanced data table components
│   │   ├── favorites/             # Favorites & recommendations
│   │   ├── filters/               # Filter UI components
│   │   ├── home/                  # Home page components
│   │   ├── layout/                # App sidebar & layout
│   │   ├── library/               # Music library management
│   │   ├── player/                # Music player & visualizers
│   │   ├── playlist/              # Playlist management
│   │   ├── research/              # Track research/analysis
│   │   ├── track/                 # Track cards, tables, details
│   │   ├── ui/                    # Shadcn/ui components
│   │   └── visualization/         # Audio visualizations
│   ├── config/                # App configuration
│   │   └── data-table.ts
│   ├── contexts/              # React contexts
│   │   ├── audio-player-context.tsx
│   │   └── filter-context.tsx
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-callback-ref.ts
│   │   ├── use-data-table.ts
│   │   ├── use-debounced-callback.ts
│   │   ├── use-mobile.ts
│   │   ├── useAudioPlayer.ts
│   │   ├── useFiltering.ts
│   │   ├── useFilterOptions.ts
│   │   └── useMusicPlayerWebSocket.ts
│   ├── lib/                   # Utility functions
│   │   ├── compose-refs.ts
│   │   ├── data-table.ts
│   │   ├── format.ts
│   │   ├── id.ts
│   │   ├── parsers.ts
│   │   └── utils.ts           # cn() utility for Tailwind
│   ├── routes/                # TanStack Router file-based routes
│   │   ├── __root.tsx         # Root layout
│   │   ├── index.tsx          # Home page (/)
│   │   ├── music.tsx          # Music library (/music)
│   │   ├── playlists.index.tsx
│   │   ├── playlists.$playlistId.tsx
│   │   ├── libraries.index.tsx
│   │   ├── libraries.$libraryId.tsx
│   │   ├── favorites.tsx
│   │   ├── categories.tsx
│   │   ├── research.index.tsx
│   │   ├── research.$trackId.tsx
│   │   └── settings.tsx
│   ├── services/              # API & data services
│   │   ├── api-hooks.ts       # TanStack Query hooks
│   │   ├── filter-hooks.ts
│   │   ├── graffle-client.ts  # GraphQL client
│   │   ├── metrics-hooks.ts
│   │   ├── music-player-hooks.ts
│   │   ├── music-player-websocket.ts
│   │   ├── playlist-hooks.ts
│   │   ├── rest-client.ts     # REST API client
│   │   └── websocket-service.ts
│   ├── styles/
│   │   └── index.css          # Global styles & Tailwind
│   ├── types/
│   │   └── data-table.ts      # TypeScript type definitions
│   ├── App.tsx                # Main App component
│   ├── App.css
│   ├── main.tsx               # Application entry point
│   ├── router.tsx             # Router configuration
│   └── routeTree.gen.ts       # Auto-generated route tree
├── tests/                     # Test files
│   ├── contract/              # Contract tests
│   ├── unit/                  # Unit tests
│   └── integration/           # Integration tests
├── ui-components/             # Additional UI components
├── .tanstack/                 # TanStack Router cache
├── dist/                      # Production build output
├── codegen.ts                 # GraphQL codegen config
├── components.json            # Shadcn/ui configuration
├── index.html                 # HTML entry point
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
└── vitest.config.coverage.ts
```

---

## Available Scripts

| Command                  | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `npm run dev`            | Start development server on port 3000            |
| `npm run build`          | TypeScript check + production build              |
| `npm run preview`        | Preview production build locally                 |
| `npm run lint`           | Run ESLint with zero warnings tolerance          |
| `npm run lint:fix`       | Auto-fix ESLint issues                           |
| `npm run type-check`     | Run TypeScript type checking (no emit)           |
| `npm run test`           | Run tests in watch mode                          |
| `npm run test:ui`        | Run tests with Vitest UI                         |
| `npm run test:run`       | Run tests once                                   |
| `npm run test:coverage`  | Run tests with coverage report                   |
| `npm run test:contract`  | Run contract tests only                          |
| `npm run test:unit`      | Run unit tests only                              |
| `npm run test:integration` | Run integration tests only                     |
| `npm run generate`       | Generate GraphQL types from schema               |

---

## Features

### Music Library Management
- Browse and organize music libraries
- Create, edit, and delete libraries
- Advanced filtering and sorting with URL-persisted state

### Playlist Management
- Create and manage playlists
- Drag-and-drop track reordering (dnd-kit)
- AI-powered track recommendations

### Music Player
- Full-featured audio player with playback controls
- Real-time waveform visualization (p5.js)
- Beat visualization and audio analysis
- WebSocket-based real-time sync

### Data Tables
- Advanced data tables with TanStack Table
- Faceted filtering, sorting, pagination
- Column visibility controls
- Responsive design

### Audio Visualizations
- Waveform visualizer
- Beat visualizer
- Interactive p5.js canvas components

### Research & Analysis
- Track analysis and metadata display
- Audio feature visualization
- AI-powered insights

---

## Architecture

### Routing

The app uses **TanStack Router** with file-based routing and automatic code-splitting:

```typescript
// Routes are defined in src/routes/
// Dynamic segments use $ prefix: playlists.$playlistId.tsx
// Index routes use .index suffix: playlists.index.tsx
```

### State Management

- **Server State**: TanStack Query for all API data fetching, caching, and mutations
- **Client State**: React Context for global UI state (audio player, filters)
- **URL State**: nuqs for URL query parameter synchronization

### Data Fetching

```typescript
// GraphQL with graphql-request
import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/services/graffle-client';

// REST with custom client
import { restClient } from '@/services/rest-client';
```

### Real-time Updates

WebSocket integration via Socket.IO for:
- Music player synchronization
- Live updates and notifications

---

## API Integration

### GraphQL

GraphQL types are auto-generated using GraphQL Codegen:

```bash
npm run generate
```

Configuration is in `codegen.ts`. Generated types are output to `src/__generated__/types.ts`.

### REST

REST endpoints are consumed via the `rest-client.ts` service with TanStack Query hooks.

---

## Testing

The project uses **Vitest** with **React Testing Library**:

```bash
# Run all tests
npm run test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:contract
npm run test:integration
```

Test files are organized in the `tests/` directory:
- `tests/unit/` - Unit tests for components and hooks
- `tests/contract/` - API contract tests
- `tests/integration/` - Integration tests

---

## Configuration

### Vite (`vite.config.ts`)

- TanStack Router plugin with auto code-splitting
- React plugin with Fast Refresh
- Tailwind CSS plugin
- Path alias: `@/` → `./src/`
- Dev server: port 3000

### TypeScript (`tsconfig.json`)

- Strict mode enabled
- Path mapping: `@/*` → `src/*`
- ES2022 target

### Tailwind CSS (`tailwind.config.js`)

- Extended theme with Shadcn/ui design tokens
- CSS variables for theming
- Custom animations

### Shadcn/ui (`components.json`)

- Style: New York
- Base color: Neutral
- CSS variables enabled
- Components path: `@/components`
- Utils path: `@/lib/utils`

---

## Dependencies

### Core

| Package                    | Version   | Purpose                          |
| -------------------------- | --------- | -------------------------------- |
| `react`                    | ^19.1.1   | UI framework                     |
| `react-dom`                | ^19.1.1   | React DOM rendering              |
| `vite`                     | ^7.1.7    | Build tool & dev server          |
| `typescript`               | ^5.9.2    | Type safety                      |

### Routing & State

| Package                        | Version   | Purpose                      |
| ------------------------------ | --------- | ---------------------------- |
| `@tanstack/react-router`       | ^1.133.3  | File-based routing           |
| `@tanstack/react-query`        | ^5.90.2   | Server state management      |
| `@tanstack/react-query-devtools` | ^5.90.2 | Query devtools               |
| `@tanstack/router-devtools`    | ^1.133.3  | Router devtools              |
| `@tanstack/react-table`        | ^8.21.3   | Headless table utilities     |
| `nuqs`                         | ^2.7.2    | URL query state management   |

### UI & Styling

| Package                    | Version   | Purpose                          |
| -------------------------- | --------- | -------------------------------- |
| `tailwindcss`              | ^4.1.13   | Utility-first CSS                |
| `@radix-ui/*`              | various   | Accessible UI primitives         |
| `class-variance-authority` | ^0.7.1    | Component variants               |
| `clsx`                     | ^2.1.1    | Conditional classNames           |
| `tailwind-merge`           | ^3.3.1    | Tailwind class merging           |
| `lucide-react`             | ^0.544.0  | Icon library                     |
| `motion`                   | ^12.23.24 | Animations                       |
| `recharts`                 | ^2.15.4   | Charts & graphs                  |
| `cmdk`                     | ^1.1.1    | Command palette                  |
| `sonner`                   | ^2.0.7    | Toast notifications              |
| `vaul`                     | ^1.1.2    | Drawer component                 |

### Data & API

| Package              | Version   | Purpose                          |
| -------------------- | --------- | -------------------------------- |
| `graphql`            | ^16.11.0  | GraphQL core                     |
| `graphql-request`    | ^7.2.0    | GraphQL client                   |
| `zod`                | ^3.25.76  | Schema validation                |
| `socket.io-client`   | ^4.8.1    | WebSocket client                 |

### Drag & Drop

| Package              | Version   | Purpose                          |
| -------------------- | --------- | -------------------------------- |
| `@dnd-kit/core`      | ^6.3.1    | Core drag & drop                 |
| `@dnd-kit/sortable`  | ^10.0.0   | Sortable lists                   |
| `@dnd-kit/modifiers` | ^9.0.0    | Drag modifiers                   |
| `@dnd-kit/utilities` | ^3.2.2    | Utilities                        |

### Visualizations

| Package              | Version      | Purpose                       |
| -------------------- | ------------ | ----------------------------- |
| `@p5-wrapper/react`  | 5.0.0-rc.3   | p5.js React wrapper           |
| `p5`                 | ^1.11.10     | Creative coding library       |
| `simplex-noise`      | ^4.0.3       | Noise generation              |

### Dev Dependencies

| Package                              | Version   | Purpose                      |
| ------------------------------------ | --------- | ---------------------------- |
| `vitest`                             | ^3.2.4    | Test runner                  |
| `@testing-library/react`             | ^16.3.0   | React testing utilities      |
| `@testing-library/jest-dom`          | ^6.8.0    | Jest DOM matchers            |
| `@testing-library/user-event`        | ^14.6.1   | User event simulation        |
| `jsdom`                              | ^27.0.0   | DOM environment for tests    |
| `@graphql-codegen/cli`               | ^6.0.0    | GraphQL code generation      |
| `@graphql-codegen/client-preset`     | ^5.0.1    | GraphQL client preset        |
| `@tanstack/router-plugin`            | ^1.133.22 | Router Vite plugin           |
| `shadcn`                             | ^3.3.1    | Shadcn CLI                   |
| `tw-animate-css`                     | ^1.4.0    | Tailwind animations          |

---

## Development Guidelines

### Code Style

- **TypeScript**: Use strict types, avoid `any`
- **Components**: PascalCase for component names
- **Functions/Variables**: camelCase
- **Files**: kebab-case for file names

### Import Conventions

Always use the `@/` path alias:

```typescript
// ✅ Good
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ❌ Bad
import { Button } from '../../../components/ui/button';
```

### Component Patterns

- Functional components with hooks
- Props typed with TypeScript interfaces
- Shadcn/ui components for UI primitives
- Custom hooks for reusable logic

### Data Validation

Use Zod for all external data validation:

```typescript
import { z } from 'zod';

const trackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
});

type Track = z.infer<typeof trackSchema>;
```

### Adding Shadcn Components

```bash
npx shadcn@latest add [component-name]
```

---

## License

MIT License - see [LICENSE](../LICENSE) for details.

---

## Author

**Alessandro Marelli**

---

## Related

- [Muzo Backend](../backend) - NestJS backend API
- [Shadcn/ui Documentation](https://ui.shadcn.com)
- [TanStack Router](https://tanstack.com/router)
- [TanStack Query](https://tanstack.com/query)
