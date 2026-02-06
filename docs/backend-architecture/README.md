# Backend architecture (Clean Architecture)

This folder documents the NestJS backend's **Clean Architecture** implementation under `backend/src/clean-arch/`. Dependencies point **inward**: inner layers do not import from outer layers.

## Documents

| Doc | Content |
|-----|--------|
| [01-kernel.md](./01-kernel.md) | Kernel: types, IDs, errors, action context (ALS), pagination |
| [02-application.md](./02-application.md) | Application: ports (createToken), use cases (createUseCaseProvider), DTOs |
| [03-adapters-persistence.md](./03-adapters-persistence.md) | Persistence adapters: repositories, queries, loaders, AdaptersPersistenceModule |
| [04-adapters-graphql.md](./04-adapters-graphql.md) | GraphQL adapters: resolvers, schema, context, filters |
| [05-graphql-api.md](./05-graphql-api.md) | GraphQL API: queries, mutations, types |
| [06-infrastructure.md](./06-infrastructure.md) | Infrastructure: Prisma, audio, filesystem, Elasticsearch |
| [07-http-adapters.md](./07-http-adapters.md) | HTTP adapters: controllers, auth |
| [08-app-wiring.md](./08-app-wiring.md) | App wiring: AdaptersPersistenceModule, UseCasesModule, GraphQL context, DataLoaders |

## Folder map

```
backend/src/clean-arch/
├── kernel/           → 01-kernel.md
├── application/      → 02-application.md (ports, use-cases, utils/create-token.ts, create-use-case.provider.ts)
├── adapters/
│   ├── persistence/ → 03-adapters-persistence.md (AdaptersPersistenceModule)
│   ├── graphql/     → 04-adapters-graphql.md
│   ├── http/        → 07-http-adapters.md
│   └── common/      → shared utils (parse-id, middlewares)
└── infrastructure/  → 06-infrastructure.md (database, audio, filesystem, external-services/elasticsearch)
```

## Dependency rule

| Layer | Depends on | Must not depend on |
|-------|------------|--------------------|
| **kernel** | (none) | application, adapters, infrastructure |
| **application** | kernel, **port interfaces & tokens** (createToken) | adapters, infrastructure (concrete classes) |
| **adapters** | application, kernel | — |
| **infrastructure** | kernel (minimal) | domain/application logic |
