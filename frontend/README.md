# Muzo Frontend

AI-powered music library organization frontend built with React 19, Vite, TanStack Query, TailwindCSS, and ShadCN/ui.

## Tech Stack

- **React 19**: Latest React version with modern features
- **Vite**: Fast build tool and development server
- **TanStack Query**: Server state management and data fetching
- **TailwindCSS**: Utility-first CSS framework
- **ShadCN/ui**: High-quality component library
- **TypeScript**: Type-safe development

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/     # Reusable UI components (ShadCN/ui)
├── pages/         # Page components
├── services/      # API client and data services
├── lib/          # Utility functions
└── styles/       # Global styles and TailwindCSS
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## Dependencies

### Core Dependencies

- `react@^19.1.1` - React library
- `react-dom@^19.1.1` - React DOM rendering
- `vite@^7.1.6` - Build tool and dev server
- `typescript@^5.9.2` - TypeScript support

### State Management

- `@tanstack/react-query@^5.89.0` - Server state management
- `@tanstack/react-query-devtools@^5.89.0` - Query devtools

### Styling

- `tailwindcss@^4.1.13` - Utility-first CSS framework
- `postcss@^8.5.6` - CSS post-processor
- `autoprefixer@^10.4.21` - CSS vendor prefixing

### UI Components

- `@radix-ui/react-slot@^1.2.3` - Radix UI primitives
- `class-variance-authority@^0.7.1` - Component variant management
- `clsx@^2.1.1` - Conditional className utility
- `tailwind-merge@^3.3.1` - Tailwind class merging
- `lucide-react@^0.544.0` - Icon library

## Configuration

- `vite.config.ts` - Vite configuration with React plugin
- `tailwind.config.js` - TailwindCSS configuration with ShadCN/ui theme
- `components.json` - ShadCN/ui component configuration
- `tsconfig.json` - TypeScript configuration with path mapping

## Development Guidelines

- Use TypeScript for all new code
- Follow React 19 best practices
- Use TanStack Query for all server state
- Implement components using ShadCN/ui patterns
- Follow TailwindCSS utility-first approach
- Write self-documenting code with minimal comments
