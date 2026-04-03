# Tech Stack Guide — Complete Onboarding Notebook

> A practical, theory-first guide covering NestJS, Next.js, Nx Monorepo, LocalStack, Redux, AWS (S3/SQS/SNS), and Test-Driven Development.

---

# Table of Contents

1. [Nx Monorepo](#1-nx-monorepo)
2. [NestJS](#2-nestjs)
3. [Next.js](#3-nextjs)
4. [Redux (with Redux Toolkit)](#4-redux-with-redux-toolkit)
5. [AWS Core Services — S3, SQS, SNS](#5-aws-core-services--s3-sqs-sns)
6. [LocalStack](#6-localstack)
7. [Test-Driven Development (TDD)](#7-test-driven-development-tdd)
8. [Putting It All Together](#8-putting-it-all-together)

---

# 1. Nx Monorepo

## What Is Nx?

Nx is a build system and monorepo management tool. Instead of having separate repos for your frontend (Next.js), backend (NestJS), and shared libraries, they all live in one repo and Nx handles the orchestration.

## Core Concepts

### Workspace Structure

```
my-workspace/
├── apps/
│   ├── api/              # NestJS app
│   └── web/              # Next.js app
├── libs/
│   ├── shared/
│   │   ├── types/        # Shared TypeScript types
│   │   ├── utils/        # Shared utility functions
│   │   └── ui/           # Shared UI components
│   ├── api/
│   │   └── feature-x/    # Backend-only library
│   └── web/
│       └── feature-x/    # Frontend-only library
├── nx.json               # Nx configuration
├── tsconfig.base.json    # Base TypeScript config
└── package.json
```

### Project Graph

Nx builds a dependency graph of all projects. When you change a shared library, Nx knows which apps are affected and only rebuilds/retests those.

```bash
# Visualize the project graph
npx nx graph

# Only run tests for projects affected by your changes
npx nx affected --target=test

# Only build affected projects
npx nx affected --target=build
```

### Generators and Executors

- **Generators** = code scaffolding (like `nx generate @nx/nest:service users`)
- **Executors** = task runners (build, serve, test, lint)

```bash
# Generate a new NestJS library
npx nx generate @nx/nest:lib feature-auth --directory=libs/api/feature-auth

# Generate a new Next.js component library
npx nx generate @nx/react:library ui-buttons --directory=libs/web/ui-buttons

# Generate a NestJS service inside an existing project
npx nx generate @nx/nest:service users --project=api
```

### Caching

Nx caches task results. If nothing changed, the task completes instantly from cache.

```json
// nx.json
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]  // Build dependencies first
    },
    "test": {
      "cache": true
    }
  }
}
```

### Path Aliases (Imports Between Projects)

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "paths": {
      "@myorg/shared-types": ["libs/shared/types/src/index.ts"],
      "@myorg/shared-utils": ["libs/shared/utils/src/index.ts"],
      "@myorg/api-feature-x": ["libs/api/feature-x/src/index.ts"]
    }
  }
}
```

```typescript
// In your NestJS app, import from shared lib:
import { UserDto } from '@myorg/shared-types';

// In your Next.js app, same import works:
import { UserDto } from '@myorg/shared-types';
```

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| Importing from `libs/` using relative paths (`../../libs/shared`) | Breaks Nx dependency graph, bypasses path aliases | Always use `@myorg/lib-name` aliases |
| Putting everything in `apps/` | No code reuse, monolith in disguise | Extract shared logic into `libs/` |
| Circular dependencies between libs | Build failures, infinite loops | Use `nx graph` to detect; restructure with a shared base lib |
| Ignoring `affected` commands | Rebuilding/retesting everything is slow | Use `nx affected` in CI pipelines |
| Not using `--dry-run` with generators | Generates unwanted files | Always preview first: `nx generate ... --dry-run` |

## Edge Cases

- **Implicit dependencies**: Some libs depend on each other through config files, not imports. Declare these in `project.json`:
  ```json
  {
    "implicitDependencies": ["shared-config"]
  }
  ```
- **Cache invalidation**: If a task produces different results but Nx uses cache, clear with `nx reset`.
- **Version mismatches**: All Nx plugins in the workspace must be the same version. Mix-and-match causes cryptic errors.

---

# 2. NestJS

## What Is NestJS?

NestJS is a Node.js framework for building server-side applications. It uses TypeScript, decorators, and a modular architecture inspired by Angular. Think of it as "Spring Boot for Node.js."

## Core Concepts

### Modules

Everything in NestJS lives inside a module. Modules organize your app into cohesive blocks.

```typescript
// users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],  // Import other modules
  controllers: [UsersController],                // HTTP controllers
  providers: [UsersService],                     // Injectable services
  exports: [UsersService],                       // Make available to other modules
})
export class UsersModule {}
```

### Controllers (Handle HTTP Requests)

```typescript
// users.controller.ts
import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus,
         ParseIntPipe, ValidationPipe, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')  // Route prefix: /users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // ParseIntPipe auto-converts and validates
    return this.usersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(ValidationPipe) createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
```

### Services (Business Logic)

```typescript
// users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }
}
```

### Dependency Injection (DI)

NestJS uses constructor-based DI. The framework creates and injects instances automatically.

```typescript
// The DI container sees this constructor and injects UsersService automatically
constructor(private readonly usersService: UsersService) {}
```

**How DI Resolution Works:**
1. NestJS looks at the constructor parameter types
2. Finds a matching provider registered in the module
3. Creates (or reuses) an instance and injects it

**Custom Providers:**
```typescript
@Module({
  providers: [
    // Standard (class-based)
    UsersService,

    // Value provider
    { provide: 'CONFIG', useValue: { apiKey: 'abc123' } },

    // Factory provider
    {
      provide: 'ASYNC_CONNECTION',
      useFactory: async (configService: ConfigService) => {
        const conn = await createConnection(configService.get('DB_URL'));
        return conn;
      },
      inject: [ConfigService],
    },
  ],
})
```

### DTOs and Validation

```typescript
// dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
```

Enable global validation:
```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,       // Strip properties not in DTO
  forbidNonWhitelisted: true,  // Throw error on extra properties
  transform: true,       // Auto-transform payloads to DTO instances
}));
```

### Guards, Interceptors, Pipes, Filters (Middleware Stack)

Request flows through: **Middleware → Guards → Interceptors (before) → Pipes → Handler → Interceptors (after) → Exception Filters**

```typescript
// auth.guard.ts — decides if request is allowed
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return !!request.headers.authorization;
  }
}

// logging.interceptor.ts — wraps the handler
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`${Date.now() - now}ms`)),
    );
  }
}

// http-exception.filter.ts — catches errors
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Async Configuration Pattern

Many NestJS modules need async config (e.g., reading from env):

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,  // NEVER true in production
      }),
    }),
  ],
})
export class AppModule {}
```

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| Forgetting to add a service to `providers` | `Nest can't resolve dependencies` error | Add to providers array or import the module that exports it |
| Not exporting a service from its module | Other modules can't inject it | Add to `exports` array |
| Circular module dependencies | Crashes at startup | Use `forwardRef(() => OtherModule)` |
| Business logic in controllers | Untestable, violates SRP | Move logic to services |
| `synchronize: true` in production | Can drop tables/data on schema changes | Use migrations instead |
| Not using `ValidationPipe` globally | Unvalidated input reaches your handlers | Set it up in `main.ts` |
| Catching errors inside services and returning null | Hides bugs, makes debugging hard | Throw NestJS exceptions (`NotFoundException`, etc.) |

## Edge Cases

- **Circular dependencies**: Use `@Inject(forwardRef(() => OtherService))` for service-level circulars.
- **Request-scoped providers**: By default, providers are singletons. If you need per-request instances (e.g., for multi-tenancy), use `@Injectable({ scope: Scope.REQUEST })`. But beware — this makes the entire injection chain request-scoped, which impacts performance.
- **Hybrid applications**: NestJS can serve HTTP and microservices (SQS, etc.) from the same app using `app.connectMicroservice()`.

---

# 3. Next.js

## What Is Next.js?

Next.js is a React framework that adds server-side rendering (SSR), static generation (SSG), API routes, file-based routing, and more.

## Core Concepts

### App Router vs Pages Router

Next.js has two routing systems. **App Router** (`app/` directory) is the modern approach (Next.js 13+). **Pages Router** (`pages/` directory) is the legacy approach. Your codebase likely uses one or the other — check which one.

### App Router File Conventions

```
app/
├── layout.tsx          # Root layout (wraps all pages)
├── page.tsx            # Home page (/)
├── loading.tsx         # Loading UI (automatic Suspense boundary)
├── error.tsx           # Error UI (automatic error boundary)
├── not-found.tsx       # 404 page
├── users/
│   ├── page.tsx        # /users
│   ├── [id]/
│   │   └── page.tsx    # /users/123 (dynamic route)
│   └── layout.tsx      # Layout for /users/* routes
├── api/
│   └── users/
│       └── route.ts    # API route: GET/POST /api/users
└── (auth)/             # Route group (no URL impact)
    ├── login/
    │   └── page.tsx    # /login
    └── layout.tsx      # Shared layout for auth pages
```

### Server Components vs Client Components

**By default, all components in App Router are Server Components.**

```typescript
// app/users/page.tsx — SERVER Component (default)
// Runs on the server. Can directly access DB, filesystem, secrets.
// Cannot use useState, useEffect, event handlers, or browser APIs.

async function UsersPage() {
  // This runs on the server — no API call needed!
  const users = await db.query('SELECT * FROM users');

  return (
    <ul>
      {users.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
export default UsersPage;
```

```typescript
// components/counter.tsx — CLIENT Component
'use client';  // This directive makes it a Client Component

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>;
}
```

**The Rule**: Use Server Components by default. Only add `'use client'` when you need interactivity (state, effects, event handlers, browser APIs).

### Data Fetching

```typescript
// Server Component — direct fetch
async function UsersPage() {
  const res = await fetch('https://api.example.com/users', {
    // No option = NOT cached by default (Next.js 14+)
    // cache: 'force-cache',      // Opt-in: cache indefinitely
    // cache: 'no-store',         // Explicit: never cache (always fresh)
    // next: { revalidate: 60 },  // Revalidate every 60 seconds (ISR)
  });
  const users = await res.json();
  return <UserList users={users} />;
}
```

### Server Actions

```typescript
// app/users/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  await db.insert({ name, email });
  revalidatePath('/users');  // Refresh the users page
}
```

```typescript
// app/users/new/page.tsx
import { createUser } from '../actions';

export default function NewUserPage() {
  return (
    <form action={createUser}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

### API Routes (Route Handlers)

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get('page') ?? '1';

  const users = await db.query('SELECT * FROM users LIMIT 10 OFFSET $1', [(+page - 1) * 10]);
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const user = await db.insert(body);
  return NextResponse.json(user, { status: 201 });
}
```

### Middleware

```typescript
// middleware.ts (root of project)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token');

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],  // Only run on these routes
};
```

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| Adding `'use client'` everywhere | Defeats SSR, increases bundle size | Only use when you need interactivity |
| Using `useEffect` to fetch data | Waterfalls, loading spinners, no SEO | Use Server Components or `fetch` in server context |
| Importing server-only code in client components | Secrets/DB credentials leak to browser bundle | Use `import 'server-only'` guard in server modules |
| Not handling `loading.tsx` and `error.tsx` | Users see blank screens or unhandled errors | Add these files to route segments |
| Mutating data without `revalidatePath`/`revalidateTag` | Stale cached data served after mutations | Always revalidate after writes |
| Putting large state trees in client components near the root | Entire subtree becomes client-rendered | Push client components to the leaves |

## Edge Cases

- **Hydration mismatches**: If server HTML differs from client render (e.g., using `Date.now()` or `Math.random()`), React throws hydration errors. Use `suppressHydrationWarning` or move to client component.
- **Dynamic imports**: Use `next/dynamic` for heavy client components:
  ```typescript
  const HeavyChart = dynamic(() => import('./Chart'), {
    loading: () => <Skeleton />,
    ssr: false,  // Only render on client
  });
  ```
- **Parallel routes**: `@modal/page.tsx` alongside `page.tsx` renders both simultaneously — useful for modals that have their own URL.

---

# 4. Redux (with Redux Toolkit)

## What Is Redux?

Redux is a predictable state container. All app state lives in a single store, and the only way to change it is by dispatching actions.

**Mental Model**: `(currentState, action) => newState`

## Core Concepts

### The Redux Flow

```
User clicks button
  → dispatch(action)
    → reducer produces new state
      → components re-render with new state
```

### Setting Up the Store (Redux Toolkit — RTK)

```typescript
// store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { usersReducer } from './slices/usersSlice';
import { authReducer } from './slices/authSlice';

export const store = configureStore({
  reducer: {
    users: usersReducer,
    auth: authReducer,
  },
});

// Infer types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### Creating a Slice (Reducer + Actions in One)

```typescript
// store/slices/usersSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: number;
  name: string;
  email: string;
}

interface UsersState {
  items: User[];
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = {
  items: [],
  loading: false,
  error: null,
};

// Async thunk — handles API calls
export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch');
      return (await response.json()) as User[];
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // Synchronous actions
    addUser(state, action: PayloadAction<User>) {
      state.items.push(action.payload);  // Immer makes this "mutation" safe!
    },
    removeUser(state, action: PayloadAction<number>) {
      state.items = state.items.filter(u => u.id !== action.payload);
    },
    clearUsers(state) {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    // Handle async thunk lifecycle
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { addUser, removeUser, clearUsers } = usersSlice.actions;
export const usersReducer = usersSlice.reducer;
```

### Using in Components

```typescript
// Typed hooks (create once, use everywhere)
// store/hooks.ts
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './store';

// Modern RTK approach (RTK 2.0+ / react-redux 9+)
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

// Legacy approach (still works with older react-redux versions)
// import { TypedUseSelectorHook } from 'react-redux';
// export const useAppDispatch = () => useDispatch<AppDispatch>();
// export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

```typescript
// components/UsersList.tsx
'use client';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchUsers, removeUser } from '../store/slices/usersSlice';

export function UsersList() {
  const dispatch = useAppDispatch();
  const { items, loading, error } = useAppSelector((state) => state.users);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <ul>
      {items.map(user => (
        <li key={user.id}>
          {user.name}
          <button onClick={() => dispatch(removeUser(user.id))}>Remove</button>
        </li>
      ))}
    </ul>
  );
}
```

### Selectors (Derived State)

```typescript
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';

// Simple selector
const selectUsers = (state: RootState) => state.users.items;

// Memoized selector — only recomputes when input changes
export const selectActiveUsers = createSelector(
  [selectUsers],
  (users) => users.filter(u => u.isActive)
);

// Parameterized selector
export const selectUserById = (id: number) =>
  createSelector([selectUsers], (users) => users.find(u => u.id === id));
```

### RTK Query (API Caching Layer)

```typescript
// store/api/usersApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUsers: builder.query<User[], void>({
      query: () => '/users',
      providesTags: ['User'],
    }),
    createUser: builder.mutation<User, Partial<User>>({
      query: (body) => ({
        url: '/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['User'],  // Auto-refetches getUsers
    }),
  }),
});

export const { useGetUsersQuery, useCreateUserMutation } = usersApi;
```

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| Mutating state directly (without Immer) | State changes won't trigger re-renders | Use RTK slices (they use Immer internally) |
| Storing everything in Redux | Unnecessary complexity for local UI state | Only use Redux for shared/global state. Use `useState` for component-local state |
| Not using `createSelector` for derived state | Recomputes on every render | Memoize with `createSelector` |
| Using bare `useSelector`/`useDispatch` | No type safety | Create typed `useAppSelector`/`useAppDispatch` hooks |
| Putting API calls directly in components | Duplicated logic, no caching | Use `createAsyncThunk` or RTK Query |
| Giant reducers with dozens of cases | Hard to maintain, error-prone | Split into multiple slices by domain |

## Edge Cases

- **Immer gotcha — returning AND mutating**: In a reducer, either mutate the draft OR return a new value, never both:
  ```typescript
  // BAD — mutates AND returns
  addUser(state, action) {
    state.items.push(action.payload);
    return state;  // Don't do this!
  }

  // GOOD — just mutate (Immer handles the rest)
  addUser(state, action) {
    state.items.push(action.payload);
  }

  // ALSO GOOD — return entirely new state
  clearUsers() {
    return initialState;
  }
  ```
- **Serializable state**: Redux state must be serializable (no class instances, functions, Maps, Sets). The middleware warns you in dev mode.
- **Redux + Next.js SSR**: The store must be created per-request on the server (not a singleton) to avoid data leaking between users. Use `next-redux-wrapper` or create the store in a Server Component and pass initial state to the client.

---

# 5. AWS Core Services — S3, SQS, SNS

## Amazon S3 (Simple Storage Service)

### What Is It?

Object storage. Think of it as an infinite hard drive where you store files (objects) in folders (buckets).

### Key Concepts

- **Bucket**: A container for objects. Globally unique name.
- **Object**: A file + metadata. Identified by a key (path).
- **Key**: The "path" to an object, e.g. `uploads/users/123/avatar.jpg`
- **Presigned URLs**: Temporary URLs that grant access to private objects.

### Code Examples (AWS SDK v3)

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: 'us-east-1',
  // For LocalStack:
  // endpoint: 'http://localhost:4566',
  // forcePathStyle: true,
});

// Upload a file
async function uploadFile(bucket: string, key: string, body: Buffer) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: 'image/jpeg',
  }));
}

// Download a file
async function downloadFile(bucket: string, key: string) {
  const response = await s3.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
  // response.Body is a ReadableStream
  return response.Body;
}

// Generate a presigned URL (e.g., for frontend uploads)
async function getUploadUrl(bucket: string, key: string) {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
  return url;
}

// List objects with prefix
async function listFiles(bucket: string, prefix: string) {
  const response = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,     // e.g., 'uploads/users/123/'
    MaxKeys: 100,
  }));
  return response.Contents ?? [];
}

// Delete an object
async function deleteFile(bucket: string, key: string) {
  await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  }));
}
```

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| Not setting `forcePathStyle: true` for LocalStack | LocalStack doesn't support virtual-hosted-style URLs |
| Forgetting `ContentType` on upload | Files served with wrong MIME type |
| Not handling pagination in `ListObjectsV2` | Only returns first 1000 objects; use `ContinuationToken` |
| Storing user-uploaded files with original filenames | Path traversal risk; use UUIDs or hashed names |
| Not setting CORS on the bucket for frontend uploads | Browser blocks presigned URL uploads |

---

## Amazon SQS (Simple Queue Service)

### What Is It?

A message queue. Producer sends messages, consumer processes them asynchronously. Decouples services.

### Key Concepts

- **Queue**: Holds messages. Two types: Standard (at-least-once, possibly out of order) and FIFO (exactly-once, in order).
- **Message**: Up to 256KB of data.
- **Visibility Timeout**: After a consumer receives a message, it's hidden from other consumers for this duration. If not deleted in time, it becomes visible again.
- **Dead Letter Queue (DLQ)**: Messages that fail processing N times go here for investigation.

### Code Examples

```typescript
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  CreateQueueCommand,
} from '@aws-sdk/client-sqs';

const sqs = new SQSClient({
  region: 'us-east-1',
  // endpoint: 'http://localhost:4566',  // LocalStack
});

const QUEUE_URL = 'http://localhost:4566/000000000000/my-queue';

// Send a message
async function sendMessage(payload: object) {
  await sqs.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(payload),
    // For FIFO queues:
    // MessageGroupId: 'group-1',
    // MessageDeduplicationId: 'unique-id-123',
  }));
}

// Receive and process messages (polling loop)
async function pollMessages() {
  const response = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 10,  // Max 10
    WaitTimeSeconds: 20,      // Long polling (saves money, reduces empty responses)
    VisibilityTimeout: 30,    // 30 seconds to process
  }));

  for (const message of response.Messages ?? []) {
    try {
      const payload = JSON.parse(message.Body!);
      await processMessage(payload);

      // Delete after successful processing
      await sqs.send(new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle!,
      }));
    } catch (err) {
      console.error('Failed to process message:', err);
      // Message becomes visible again after VisibilityTimeout
    }
  }
}
```

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| Not deleting messages after processing | Message gets processed again (duplicates) |
| VisibilityTimeout shorter than processing time | Message reappears while still being processed |
| Not using long polling (leaving `WaitTimeSeconds` at default `0`) | Makes thousands of empty requests, wastes money; set to up to 20 |
| No Dead Letter Queue | Failed messages retry forever, clogging the queue |
| Assuming Standard queues deliver in order | Use FIFO queues if order matters |
| Message body > 256KB | Use S3 for large payloads, put the S3 key in the message |

---

## Amazon SNS (Simple Notification Service)

### What Is It?

Pub/Sub messaging. A topic broadcasts messages to all subscribers. Unlike SQS (point-to-point), SNS is one-to-many.

### Key Concepts

- **Topic**: A channel for messages.
- **Subscription**: A subscriber to a topic (SQS queue, HTTP endpoint, email, Lambda, etc.).
- **Fan-out pattern**: SNS topic → multiple SQS queues. Each queue gets a copy of every message.

### Code Examples

```typescript
import {
  SNSClient,
  PublishCommand,
  SubscribeCommand,
  CreateTopicCommand,
} from '@aws-sdk/client-sns';

const sns = new SNSClient({
  region: 'us-east-1',
  // endpoint: 'http://localhost:4566',  // LocalStack
});

const TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:user-events';

// Publish a message
async function publishEvent(event: object) {
  await sns.send(new PublishCommand({
    TopicArn: TOPIC_ARN,
    Message: JSON.stringify(event),
    MessageAttributes: {
      eventType: {
        DataType: 'String',
        StringValue: 'USER_CREATED',
      },
    },
  }));
}

// Subscribe an SQS queue to the topic
async function subscribeQueue(queueArn: string) {
  await sns.send(new SubscribeCommand({
    TopicArn: TOPIC_ARN,
    Protocol: 'sqs',
    Endpoint: queueArn,
  }));
}
```

### The Fan-Out Pattern (SNS + SQS)

```
User signs up
  → Publish to SNS topic "user-events"
    → SQS Queue 1: Send welcome email
    → SQS Queue 2: Create analytics record
    → SQS Queue 3: Provision user resources
```

Each service processes independently. If one fails, the others are unaffected.

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using SNS when you need SQS | SNS is fire-and-forget; use SQS if consumer needs to process at its own pace |
| Not setting up DLQ on SQS subscriptions | Failed deliveries are lost |
| Missing SNS subscription confirmation | HTTP subscribers must confirm; SQS/Lambda are auto-confirmed |
| Message filtering not set up | All subscribers get all messages; use filter policies to route |

---

# 6. LocalStack

## What Is LocalStack?

LocalStack is a local AWS cloud emulator. It runs AWS services (S3, SQS, SNS, Lambda, DynamoDB, etc.) on your machine so you can develop and test without an AWS account or internet connection.

## Setup

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"            # All services on one port
    environment:
      - SERVICES=s3,sqs,sns    # Only start what you need
      - DEBUG=1
      - PERSISTENCE=1          # Keep data across restarts
    volumes:
      - "./localstack-data:/var/lib/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"  # For Lambda
```

```bash
docker-compose up -d
```

### CLI Tool (awslocal)

`awslocal` is a wrapper around `aws` CLI that points to LocalStack:

```bash
pip install awscli-local

# Create an S3 bucket
awslocal s3 mb s3://my-bucket

# Create an SQS queue
awslocal sqs create-queue --queue-name my-queue

# Create an SNS topic
awslocal sns create-topic --name user-events

# Subscribe SQS to SNS
awslocal sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:000000000000:user-events \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:000000000000:my-queue

# List S3 buckets
awslocal s3 ls

# Upload a file
awslocal s3 cp ./test.txt s3://my-bucket/test.txt
```

### Configuring AWS SDK to Use LocalStack

```typescript
// config/aws.config.ts
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SNSClient } from '@aws-sdk/client-sns';

const isLocal = process.env.NODE_ENV !== 'production';

const localConfig = {
  endpoint: 'http://localhost:4566',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',         // LocalStack accepts any credentials
    secretAccessKey: 'test',
  },
};

const prodConfig = {
  region: process.env.AWS_REGION,
  // Credentials from IAM role or environment
};

const config = isLocal ? localConfig : prodConfig;

export const s3Client = new S3Client({
  ...config,
  forcePathStyle: true,  // Recommended for LocalStack (path-style access)
  // Alternative: use virtual-hosted-style via endpoint s3.localhost.localstack.cloud:4566
});

export const sqsClient = new SQSClient(config);
export const snsClient = new SNSClient(config);
```

### NestJS Integration

```typescript
// aws.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';

@Global()
@Module({
  providers: [
    {
      provide: 'S3_CLIENT',
      useFactory: (config: ConfigService) => {
        const isLocal = config.get('NODE_ENV') !== 'production';
        return new S3Client({
          region: config.get('AWS_REGION', 'us-east-1'),
          ...(isLocal && {
            endpoint: config.get('LOCALSTACK_ENDPOINT', 'http://localhost:4566'),
            credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
            forcePathStyle: true,
          }),
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'SQS_CLIENT',
      useFactory: (config: ConfigService) => {
        const isLocal = config.get('NODE_ENV') !== 'production';
        return new SQSClient({
          region: config.get('AWS_REGION', 'us-east-1'),
          ...(isLocal && {
            endpoint: config.get('LOCALSTACK_ENDPOINT', 'http://localhost:4566'),
            credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
          }),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['S3_CLIENT', 'SQS_CLIENT'],
})
export class AwsModule {}
```

```typescript
// Usage in a service
@Injectable()
export class FileUploadService {
  constructor(@Inject('S3_CLIENT') private s3: S3Client) {}

  async upload(file: Buffer, key: string) {
    await this.s3.send(new PutObjectCommand({
      Bucket: 'my-bucket',
      Key: key,
      Body: file,
    }));
  }
}
```

### Init Scripts (Auto-Setup Resources)

```bash
# localstack-init/ready.d/setup.sh
#!/bin/bash
# This runs automatically when LocalStack is ready

awslocal s3 mb s3://uploads
awslocal s3 mb s3://documents

awslocal sqs create-queue --queue-name email-queue
awslocal sqs create-queue --queue-name analytics-queue

awslocal sns create-topic --name user-events

awslocal sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:000000000000:user-events \
  --protocol sqs \
  --notification-endpoint arn:aws:sqs:us-east-1:000000000000:email-queue
```

```yaml
# docker-compose.yml addition
volumes:
  - "./localstack-init:/etc/localstack/init"
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting `forcePathStyle: true` for S3 (path-style) | S3 operations fail with DNS errors; set it unless using virtual-hosted-style (`s3.localhost.localstack.cloud`) |
| Hardcoding `http://localhost:4566` | Use env var so it works in Docker networks too (use service name: `http://localstack:4566`) |
| Not using init scripts | Manually recreating resources after every restart |
| Assuming 100% AWS parity | Some features/services aren't fully implemented; check LocalStack coverage docs |
| Leaving `SERVICES=` empty | All services start, slow boot time |
| Not setting `PERSISTENCE=1` | Data lost on container restart |

## Edge Cases

- **Docker networking**: If your NestJS app runs in Docker alongside LocalStack, use `http://localstack:4566` (Docker service name), not `localhost`.
- **Account ID**: LocalStack uses `000000000000` as the default account ID.
- **Region**: Default region is `us-east-1`. Be consistent.
- **SQS Queue URLs**: LocalStack's default SQS endpoint strategy (since v3) uses `sqs.<region>.localhost.localstack.cloud:4566/<account_id>/<queue_name>`. The legacy path-style URL (`http://localhost:4566/000000000000/queue-name`) is available by setting `SQS_ENDPOINT_STRATEGY=off` in the environment — match whichever your team uses.

---

# 7. Test-Driven Development (TDD)

## What Is TDD?

Write tests BEFORE writing the implementation code.

### The Red-Green-Refactor Cycle

```
1. RED    — Write a failing test for the feature/fix you want
2. GREEN  — Write the minimum code to make the test pass
3. REFACTOR — Clean up without changing behavior (tests still pass)
4. REPEAT
```

## Testing in NestJS

### Unit Tests

Test a single class in isolation. Mock all dependencies.

```typescript
// users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;

  // Mock the repository
  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOne', () => {
    it('should return a user when found', async () => {
      const user = { id: 1, name: 'Alice', email: 'alice@test.com' };
      mockRepository.findOne.mockResolvedValue(user);

      const result = await service.findOne(1);

      expect(result).toEqual(user);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create and return a new user', async () => {
      const dto = { name: 'Bob', email: 'bob@test.com' };
      const created = { id: 1, ...dto };

      mockRepository.create.mockReturnValue(created);
      mockRepository.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
      expect(mockRepository.create).toHaveBeenCalledWith(dto);
      expect(mockRepository.save).toHaveBeenCalledWith(created);
    });
  });
});
```

### Controller Tests

```typescript
// users.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockService = {
    findAll: jest.fn().mockResolvedValue([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]),
    findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Alice' }),
    create: jest.fn().mockResolvedValue({ id: 3, name: 'Charlie' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('GET /users should return all users', async () => {
    const result = await controller.findAll();
    expect(result).toHaveLength(2);
    expect(mockService.findAll).toHaveBeenCalled();
  });

  it('GET /users/:id should return one user', async () => {
    const result = await controller.findOne(1);
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });
});
```

### Integration Tests (E2E)

Test the full HTTP layer with real (or LocalStack) services.

```typescript
// test/users.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Users (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /users → 201 with valid data', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Alice', email: 'alice@test.com' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Alice');
      });
  });

  it('POST /users → 400 with invalid email', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Alice', email: 'not-an-email' })
      .expect(400);
  });

  it('GET /users/:id → 404 when not found', () => {
    return request(app.getHttpServer())
      .get('/users/99999')
      .expect(404);
  });
});
```

### Testing with LocalStack (AWS Integration Tests)

```typescript
// test/s3-upload.integration.spec.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

describe('S3 Upload Integration', () => {
  let s3: S3Client;
  const BUCKET = 'test-uploads';

  beforeAll(async () => {
    s3 = new S3Client({
      endpoint: 'http://localhost:4566',
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      forcePathStyle: true,
    });

    // Create test bucket
    const { CreateBucketCommand } = await import('@aws-sdk/client-s3');
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  });

  it('should upload and retrieve a file', async () => {
    const content = 'Hello, LocalStack!';

    // Upload
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: 'test.txt',
      Body: content,
    }));

    // Retrieve
    const response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: 'test.txt',
    }));

    const body = await response.Body!.transformToString();
    expect(body).toBe(content);
  });
});
```

### Testing SQS Message Processing

```typescript
// test/queue-processor.integration.spec.ts
import { SQSClient, SendMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';

describe('SQS Processing Integration', () => {
  let sqs: SQSClient;
  const QUEUE_URL = 'http://localhost:4566/000000000000/test-queue';

  beforeAll(async () => {
    sqs = new SQSClient({
      endpoint: 'http://localhost:4566',
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
  });

  it('should send and receive a message', async () => {
    const payload = { userId: 1, action: 'SIGNUP' };

    // Send
    await sqs.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(payload),
    }));

    // Receive
    const response = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 5,
    }));

    expect(response.Messages).toHaveLength(1);
    expect(JSON.parse(response.Messages![0].Body!)).toEqual(payload);
  });
});
```

## Testing Redux

```typescript
// store/slices/usersSlice.spec.ts
import { usersReducer, addUser, removeUser, clearUsers, fetchUsers } from './usersSlice';

describe('usersSlice', () => {
  const initialState = { items: [], loading: false, error: null };

  it('should add a user', () => {
    const user = { id: 1, name: 'Alice', email: 'alice@test.com' };
    const state = usersReducer(initialState, addUser(user));
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual(user);
  });

  it('should remove a user', () => {
    const state = {
      items: [{ id: 1, name: 'Alice', email: 'a@t.com' }],
      loading: false,
      error: null,
    };
    const result = usersReducer(state, removeUser(1));
    expect(result.items).toHaveLength(0);
  });

  it('should set loading on fetchUsers.pending', () => {
    const state = usersReducer(initialState, fetchUsers.pending('', undefined));
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('should set users on fetchUsers.fulfilled', () => {
    const users = [{ id: 1, name: 'Alice', email: 'a@t.com' }];
    const state = usersReducer(initialState, fetchUsers.fulfilled(users, '', undefined));
    expect(state.loading).toBe(false);
    expect(state.items).toEqual(users);
  });

  it('should set error on fetchUsers.rejected', () => {
    const state = usersReducer(
      initialState,
      fetchUsers.rejected(null, '', undefined, 'Network error')
    );
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Network error');
  });
});
```

### Testing React Components with Redux

```typescript
// components/UsersList.spec.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { usersReducer } from '../store/slices/usersSlice';
import { UsersList } from './UsersList';

function renderWithStore(preloadedState = {}) {
  const store = configureStore({
    reducer: { users: usersReducer },
    preloadedState,
  });

  return {
    ...render(
      <Provider store={store}>
        <UsersList />
      </Provider>
    ),
    store,
  };
}

describe('UsersList', () => {
  it('should display users from store', () => {
    renderWithStore({
      users: {
        items: [
          { id: 1, name: 'Alice', email: 'a@t.com' },
          { id: 2, name: 'Bob', email: 'b@t.com' },
        ],
        loading: false,
        error: null,
      },
    });

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    renderWithStore({
      users: { items: [], loading: true, error: null },
    });

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

## TDD Common Mistakes

| Mistake | Fix |
|---------|-----|
| Writing tests after code | Write the test first — it clarifies what you're building |
| Testing implementation details | Test behavior (inputs → outputs), not internal methods |
| Not testing error paths | Test both happy path AND failure scenarios |
| Overly specific mocks | Mock at the boundary (DB, HTTP), not between your own classes |
| Flaky async tests | Use `waitFor`, proper timeouts, and `WaitTimeSeconds` for SQS |
| No integration tests | Unit tests with mocks can pass while real integrations fail — use LocalStack |
| Giant test files | One describe per behavior, organize with nested describes |

---

# 8. Putting It All Together

## How These Pieces Connect in Your Codebase

```
┌─────────────────────────────────────────────────────────┐
│                    Nx Monorepo                          │
│                                                         │
│  ┌─────────────┐    shared libs    ┌──────────────┐    │
│  │  apps/web   │ ←── @myorg/* ───→ │  apps/api    │    │
│  │  (Next.js)  │                   │  (NestJS)    │    │
│  │             │                   │              │    │
│  │  Redux ────→│── HTTP/API ──────→│  Controllers │    │
│  │  Store      │                   │  → Services  │    │
│  │             │                   │  → Repos     │    │
│  └─────────────┘                   └──────┬───────┘    │
│                                           │            │
│                                    ┌──────▼───────┐    │
│                                    │  LocalStack  │    │
│                                    │  (Docker)    │    │
│                                    │              │    │
│                                    │  S3  SQS SNS │    │
│                                    └──────────────┘    │
│                                                         │
│  Tests: Jest (unit) + Supertest (e2e) + LocalStack     │
└─────────────────────────────────────────────────────────┘
```

## Typical Development Workflow

```bash
# 1. Start LocalStack
docker-compose up -d

# 2. Run the API (NestJS)
npx nx serve api

# 3. Run the Web app (Next.js)
npx nx serve web

# 4. Run tests for what you changed
npx nx affected --target=test

# 5. Run e2e tests
npx nx e2e api-e2e

# 6. Check the full dependency graph
npx nx graph
```

## Environment Variables (.env)

```bash
# .env.local
NODE_ENV=development

# LocalStack
LOCALSTACK_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# S3
S3_BUCKET_UPLOADS=uploads
S3_BUCKET_DOCUMENTS=documents

# SQS
SQS_EMAIL_QUEUE_URL=http://localhost:4566/000000000000/email-queue
SQS_ANALYTICS_QUEUE_URL=http://localhost:4566/000000000000/analytics-queue

# SNS
SNS_USER_EVENTS_TOPIC_ARN=arn:aws:sns:us-east-1:000000000000:user-events
```

## Quick Reference: When to Use What

| Scenario | Tool |
|----------|------|
| Store a file (image, document, export) | S3 |
| Process a task asynchronously (send email, generate report) | SQS |
| Notify multiple services about an event | SNS (fan-out to SQS queues) |
| Share types between frontend and backend | Nx shared library |
| Global client-side state (auth, user data, feature flags) | Redux |
| Server-side data fetching | Next.js Server Components |
| Form-local UI state (open/closed, input value) | React `useState` |
| API endpoints consumed by the frontend | NestJS controllers |
| Background job processing | NestJS service polling SQS |
| Test without AWS account | LocalStack |

---

*Last updated: 2026-04-03*
