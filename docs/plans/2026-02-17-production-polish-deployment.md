# Production Polish & Deployment Preparation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare CollabBoard for production deployment with proper polish, error handling, monitoring, CI/CD, and documentation.

**Architecture:** Implement production-grade error handling, add monitoring hooks, create CI/CD pipeline, remove debug code, add user feedback systems, and update documentation.

**Tech Stack:** React, TypeScript, Vite, GitHub Actions, Vercel, Sentry (error tracking), React Hot Toast (notifications)

---

## Phase 1: Code Quality & Production Readiness

### Task 1: Replace console.log with proper logging utility

**Files:**
- Create: `src/lib/logger.ts`
- Modify: `src/contexts/AuthContext.tsx:48`
- Modify: `src/hooks/useRealtimeSync.ts` (multiple locations)
- Modify: `src/hooks/useCursors.ts` (multiple locations)

**Step 1: Create logging utility**

```typescript
// src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDevelopment = import.meta.env.DEV

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (!isDevelopment && level === 'debug') return false
    return true
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) console.log('[DEBUG]', ...args)
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) console.info('[INFO]', ...args)
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) console.warn('[WARN]', ...args)
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) console.error('[ERROR]', ...args)
  }
}

export const logger = new Logger()
```

**Step 2: Replace console.log in AuthContext**

In `src/contexts/AuthContext.tsx`:
- Add import: `import { logger } from '@/lib/logger'`
- Replace line 48: `console.log('Auth state changed:', session)` with `logger.debug('Auth state changed:', session)`

**Step 3: Replace console.log in useRealtimeSync**

In `src/hooks/useRealtimeSync.ts`:
- Add import: `import { logger } from '@/lib/logger'`
- Replace all `console.log` calls with `logger.debug()`
- Replace all `console.error` calls with `logger.error()`

**Step 4: Replace console.log in useCursors**

In `src/hooks/useCursors.ts`:
- Add import: `import { logger } from '@/lib/logger'`
- Replace all `console.log` calls with `logger.debug()`

**Step 5: Commit**

```bash
git add src/lib/logger.ts src/contexts/AuthContext.tsx src/hooks/useRealtimeSync.ts src/hooks/useCursors.ts
git commit -m "feat: add production-safe logger utility and replace console.log calls

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Add React Error Boundary

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/App.tsx`

**Step 1: Create ErrorBoundary component**

```typescript
// src/components/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('React Error Boundary caught error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
              <h1 className="text-2xl font-bold text-red-600 mb-4">
                Something went wrong
              </h1>
              <p className="text-gray-600 mb-4">
                The application encountered an unexpected error. Please refresh the page to continue.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
              >
                Refresh Page
              </button>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-500">
                    Error details
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 overflow-auto">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
```

**Step 2: Wrap App with ErrorBoundary**

In `src/App.tsx`, wrap the router with ErrorBoundary:

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary'

// ... existing imports

function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      {/* ... devtools */}
    </ErrorBoundary>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/App.tsx
git commit -m "feat: add React Error Boundary for graceful error handling

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Add toast notifications for user feedback

**Files:**
- Install: `react-hot-toast`
- Create: `src/lib/toast.ts`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useRealtimeSync.ts`

**Step 1: Install react-hot-toast**

```bash
pnpm add react-hot-toast
```

**Step 2: Create toast utility wrapper**

```typescript
// src/lib/toast.ts
import toast from 'react-hot-toast'

export const showToast = {
  success: (message: string) => toast.success(message, { duration: 3000 }),
  error: (message: string) => toast.error(message, { duration: 4000 }),
  loading: (message: string) => toast.loading(message),
  dismiss: (toastId: string) => toast.dismiss(toastId),
}
```

**Step 3: Add Toaster to App**

In `src/App.tsx`:

```typescript
import { Toaster } from 'react-hot-toast'

function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" />
      {/* ... devtools */}
    </ErrorBoundary>
  )
}
```

**Step 4: Add toast notifications to useRealtimeSync**

In `src/hooks/useRealtimeSync.ts`, add error notifications:

```typescript
import { showToast } from '@/lib/toast'

// In the subscription error handler:
.on('error', (error) => {
  logger.error('Realtime subscription error:', error)
  showToast.error('Connection lost. Attempting to reconnect...')
})

// In createObject error handler:
catch (error) {
  logger.error('Failed to create object:', error)
  showToast.error('Failed to create object')
  throw error
}

// Similar for updateObject, deleteObject
```

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/toast.ts src/App.tsx src/hooks/useRealtimeSync.ts
git commit -m "feat: add toast notifications for user feedback

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Remove debug test files

**Files:**
- Delete: `e2e/debug-*.spec.ts` (5 files)

**Step 1: Remove debug test files**

```bash
rm e2e/debug-find-wrapper.spec.ts e2e/debug-login.spec.ts e2e/debug-login2.spec.ts e2e/debug-minimal.spec.ts e2e/debug-page-state.spec.ts e2e/debug-wrapper.spec.ts
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove debug test files

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: User Experience Polish

### Task 5: Add empty board state

**Files:**
- Create: `src/components/EmptyBoardState.tsx`
- Modify: `src/components/canvas/BoardStage.tsx`

**Step 1: Create EmptyBoardState component**

```typescript
// src/components/EmptyBoardState.tsx
export function EmptyBoardState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="text-center max-w-md p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Welcome to CollabBoard
        </h2>
        <p className="text-gray-600 mb-6">
          Your infinite collaborative whiteboard. Start creating by adding sticky notes, shapes, or text.
        </p>
        <div className="text-sm text-gray-500 space-y-2">
          <p><kbd className="px-2 py-1 bg-gray-100 rounded">N</kbd> - New sticky note</p>
          <p><kbd className="px-2 py-1 bg-gray-100 rounded">R</kbd> - Rectangle</p>
          <p><kbd className="px-2 py-1 bg-gray-100 rounded">C</kbd> - Circle</p>
          <p><kbd className="px-2 py-1 bg-gray-100 rounded">T</kbd> - Text</p>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Add to BoardStage**

In `src/components/canvas/BoardStage.tsx`:

```typescript
import { EmptyBoardState } from '@/components/EmptyBoardState'

// In the JSX, after the Stage component:
{objects.length === 0 && <EmptyBoardState />}
```

**Step 3: Commit**

```bash
git add src/components/EmptyBoardState.tsx src/components/canvas/BoardStage.tsx
git commit -m "feat: add empty board state with keyboard shortcuts

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Add loading skeleton for initial board load

**Files:**
- Create: `src/components/BoardLoadingSkeleton.tsx`
- Modify: `src/pages/Home.tsx`

**Step 1: Create loading skeleton**

```typescript
// src/components/BoardLoadingSkeleton.tsx
export function BoardLoadingSkeleton() {
  return (
    <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading board...</p>
      </div>
    </div>
  )
}
```

**Step 2: Add to Home page**

In `src/pages/Home.tsx`:

```typescript
import { BoardLoadingSkeleton } from '@/components/BoardLoadingSkeleton'

// In the component:
const { objects, isLoading } = useRealtimeSync(BOARD_ID)

if (isLoading) {
  return <BoardLoadingSkeleton />
}
```

**Step 3: Commit**

```bash
git add src/components/BoardLoadingSkeleton.tsx src/pages/Home.tsx
git commit -m "feat: add loading skeleton for initial board load

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Add AI command loading indicator

**Files:**
- Modify: `src/components/ai/AICommandInput.tsx`

**Step 1: Update AICommandInput with loading state**

In `src/components/ai/AICommandInput.tsx`:

```typescript
// Add loading state and feedback
const [isExecuting, setIsExecuting] = useState(false)

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  if (!command.trim() || isExecuting) return

  setIsExecuting(true)
  const loadingToast = showToast.loading('AI is processing your command...')

  try {
    await executeCommand(command, boardId)
    showToast.dismiss(loadingToast)
    showToast.success('Command executed successfully!')
    setCommand('')
  } catch (error) {
    showToast.dismiss(loadingToast)
    showToast.error('Failed to execute command')
    logger.error('AI command failed:', error)
  } finally {
    setIsExecuting(false)
  }
}

// Update button:
<button
  type="submit"
  disabled={!command.trim() || isExecuting}
  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
>
  {isExecuting ? 'Processing...' : 'Execute'}
</button>
```

**Step 2: Commit**

```bash
git add src/components/ai/AICommandInput.tsx
git commit -m "feat: add loading indicator and feedback to AI commands

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: CI/CD Pipeline

### Task 8: Create GitHub Actions workflow for CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create CI workflow file**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linter
        run: pnpm run lint

      - name: Type check
        run: pnpm run type-check

  build:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/
          retention-days: 7

  e2e-tests:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm run test:e2e
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

**Step 2: Add type-check script to package.json**

In `package.json`, add to scripts:

```json
"type-check": "tsc --noEmit"
```

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml package.json
git commit -m "ci: add GitHub Actions workflow for lint, build, and E2E tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 9: Create GitHub Actions workflow for Vercel deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

**Step 1: Create deployment workflow**

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./
```

**Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions workflow for Vercel deployment

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Documentation Updates

### Task 10: Update README for CollabBoard

**Files:**
- Modify: `README.md`

**Step 1: Replace README content**

Replace the entire `README.md` with CollabBoard-specific content:

```markdown
# CollabBoard

A real-time collaborative whiteboard application built with AI-first development practices.

![CollabBoard Demo](./public/collabboard-demo.png)

## Features

### Core Functionality
- **Infinite Canvas**: Pan and zoom freely across an unlimited workspace
- **Real-Time Collaboration**: See changes from all users instantly (<100ms sync)
- **Multiplayer Cursors**: View other users' cursors with name labels (<50ms latency)
- **Presence Awareness**: See who's online in real-time

### Drawing Tools
- **Sticky Notes**: Color-coded notes with editable text
- **Shapes**: Rectangles, circles, and lines with customizable colors
- **Connectors**: Arrows that follow objects as they move
- **Text Elements**: Standalone text anywhere on the canvas
- **Frames**: Group and organize related objects

### Operations
- **Selection**: Click to select, Shift+Click for multi-select, drag-to-select
- **Transforms**: Move, resize, and rotate objects
- **Duplicate**: Cmd/Ctrl+D to duplicate selected objects
- **Delete**: Delete key to remove selected objects

### AI Agent
- Natural language commands to create and manipulate board objects
- Multi-step operations (e.g., "Create a SWOT analysis")
- Context-aware board state understanding

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Canvas**: Konva.js via react-konva
- **Backend**: Supabase (Postgres, Auth, Realtime, Edge Functions)
- **AI**: Claude API (Sonnet 4) via Supabase Edge Functions
- **Deployment**: Vercel (frontend), Supabase (backend)
- **Testing**: Playwright (E2E), Vitest (unit)

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (or npm/yarn)
- Supabase account

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd collab_space
```

2. Install dependencies
```bash
pnpm install
```

3. Set up environment variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run database migrations

```bash
pnpm supabase db push
```

5. Start the development server

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

## Supabase Setup

### Enable Anonymous Auth
1. Go to Authentication → Settings in your Supabase dashboard
2. Enable "Allow anonymous sign-ins"

### Configure Google OAuth (Optional)
1. Go to Authentication → Providers
2. Enable Google provider
3. Add OAuth credentials from Google Cloud Console

### Deploy Edge Functions
```bash
pnpm supabase functions deploy ai-agent
pnpm supabase secrets set ANTHROPIC_API_KEY=your_claude_api_key
```

## Testing

### E2E Tests
```bash
# Run all E2E tests
pnpm test:e2e

# Run specific test suite
pnpm playwright test mvp-requirements
pnpm playwright test board-features

# Run in headed mode
pnpm playwright test --headed

# View test report
pnpm test:e2e:report
```

See `E2E_TEST_SUMMARY.md` and `QUICK_START_TESTING.md` for detailed testing documentation.

### Unit Tests
```bash
pnpm test:unit
```

## Deployment

### Vercel
1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy

### Docker
```bash
pnpm run build
docker build -t collabboard .
docker run -p 8080:80 collabboard
```

## Performance Targets

- **Frame Rate**: 60 FPS during pan/zoom
- **Object Sync**: <100ms latency
- **Cursor Sync**: <50ms latency
- **Object Capacity**: 500+ objects
- **Concurrent Users**: 5+ without degradation

## Architecture

### Data Sync Pattern
- **Ephemeral data** (cursors): Supabase Broadcast channels (no DB)
- **Durable data** (objects): Broadcast + async Postgres persistence
- **Conflict resolution**: Last-write-wins with timestamps

### File Structure
```
src/
├── components/       # React components
│   ├── canvas/      # Board and canvas objects
│   ├── ai/          # AI command interface
│   └── presence/    # User presence
├── hooks/           # Custom React hooks
│   ├── useRealtimeSync.ts
│   ├── useCursors.ts
│   └── usePresence.ts
├── contexts/        # React contexts (Auth)
├── lib/             # Utilities and config
└── pages/           # Route pages
```

## Contributing

See `docs/plans/` for implementation plans and development notes.

## License

MIT

## Acknowledgments

Built as part of the Gauntlet AI course, demonstrating AI-first development with Claude Code and Cursor.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for CollabBoard

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 11: Create deployment checklist document

**Files:**
- Create: `docs/DEPLOYMENT_CHECKLIST.md`

**Step 1: Create checklist document**

```markdown
# CollabBoard Deployment Checklist

## Pre-Deployment

### Code Quality
- [ ] All console.log statements replaced with logger utility
- [ ] No debug files in repository
- [ ] TypeScript passes without errors
- [ ] ESLint passes without errors
- [ ] All tests passing (E2E and unit)

### Security
- [ ] Environment variables not committed to git
- [ ] Supabase RLS policies enabled on all tables
- [ ] Service role key stored in environment variables only
- [ ] CSP headers configured in vercel.json
- [ ] HTTPS enforced

### Supabase Configuration
- [ ] Database migrations applied
- [ ] RLS policies tested
- [ ] Anonymous auth enabled (if using guest login)
- [ ] Google OAuth configured (if using)
- [ ] Edge functions deployed
- [ ] Edge function secrets set (ANTHROPIC_API_KEY)
- [ ] Realtime enabled
- [ ] Connection limits appropriate for usage

### Performance
- [ ] Build bundle analyzed for size
- [ ] Images optimized
- [ ] Lazy loading implemented where appropriate
- [ ] No memory leaks in development testing

### Testing
- [ ] All MVP requirements tests passing
- [ ] Multi-user collaboration tested manually
- [ ] Performance targets validated
- [ ] Mobile/responsive design tested (if implemented)
- [ ] Network resilience tested (slow 3G, disconnection)

## Vercel Deployment

### Initial Setup
- [ ] Vercel project created
- [ ] GitHub repository connected
- [ ] Build command set: `pnpm run build`
- [ ] Output directory set: `dist`
- [ ] Node.js version set: 18.x

### Environment Variables
Add these in Vercel dashboard (Settings → Environment Variables):

Production:
- [ ] `VITE_SUPABASE_URL` - Your production Supabase URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Your production anon key
- [ ] `VITE_APP_ENVIRONMENT=production`

Preview (optional):
- [ ] Same variables for preview deployments

### Domain Configuration
- [ ] Custom domain added (if applicable)
- [ ] SSL certificate auto-generated
- [ ] DNS configured correctly

## GitHub Configuration

### Secrets
Add these in GitHub Settings → Secrets and variables → Actions:

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `VERCEL_TOKEN` (for deployment workflow)
- [ ] `VERCEL_ORG_ID` (for deployment workflow)
- [ ] `VERCEL_PROJECT_ID` (for deployment workflow)

### Branch Protection
- [ ] Main branch protected
- [ ] Require status checks before merging
- [ ] Require CI to pass

## Post-Deployment

### Smoke Testing
- [ ] Application loads successfully
- [ ] Authentication works (Google OAuth and/or Guest)
- [ ] Can create objects (sticky notes, shapes, text)
- [ ] Real-time sync works between two browser windows
- [ ] Cursors appear and sync
- [ ] Presence bar shows online users
- [ ] AI commands execute successfully
- [ ] No console errors in browser

### Performance Validation
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 2s
- [ ] Time to Interactive < 3s
- [ ] No layout shifts

### Monitoring Setup
- [ ] Error tracking configured (Sentry or similar)
- [ ] Analytics configured (if applicable)
- [ ] Uptime monitoring configured
- [ ] Alert thresholds set

### Documentation
- [ ] README updated with live URL
- [ ] API documentation complete
- [ ] Troubleshooting guide available
- [ ] Known issues documented

## Rollback Plan

If deployment fails:

1. Revert to previous Vercel deployment:
   ```bash
   vercel rollback
   ```

2. Or redeploy previous commit:
   ```bash
   git revert HEAD
   git push origin main
   ```

3. Check Supabase Edge Functions:
   ```bash
   supabase functions deploy ai-agent --no-verify-jwt
   ```

## Maintenance

### Regular Tasks
- [ ] Monitor error tracking dashboard weekly
- [ ] Review Supabase usage and costs monthly
- [ ] Update dependencies quarterly
- [ ] Review and rotate API keys annually

### Scaling Considerations
- [ ] Monitor Realtime connection count
- [ ] Watch Postgres connection pool usage
- [ ] Track Edge Function invocations
- [ ] Monitor Claude API usage and costs

## Emergency Contacts

- Vercel Support: support@vercel.com
- Supabase Support: support@supabase.com
- Anthropic Support: support@anthropic.com

## Notes

Add deployment-specific notes here:
- Deployment date:
- Deployed by:
- Version/commit:
- Issues encountered:
- Resolution:
```

**Step 2: Commit**

```bash
git add docs/DEPLOYMENT_CHECKLIST.md
git commit -m "docs: add comprehensive deployment checklist

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Security & Monitoring

### Task 12: Add enhanced security headers

**Files:**
- Modify: `vercel.json`

**Step 1: Update vercel.json with CSP and additional headers**

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com; frame-ancestors 'none';"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "security: add enhanced security headers including CSP

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 13: Add environment variable validation

**Files:**
- Create: `src/lib/env.ts`
- Modify: `src/main.tsx`

**Step 1: Create environment validation utility**

```typescript
// src/lib/env.ts
interface EnvConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  environment: 'development' | 'production'
}

function validateEnv(): EnvConfig {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const environment = import.meta.env.VITE_APP_ENVIRONMENT || 'development'

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: VITE_SUPABASE_URL')
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing required environment variable: VITE_SUPABASE_ANON_KEY')
  }

  if (!supabaseUrl.startsWith('https://')) {
    throw new Error('VITE_SUPABASE_URL must start with https://')
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    environment: environment as 'development' | 'production',
  }
}

export const env = validateEnv()
```

**Step 2: Use validated env in main.tsx**

In `src/main.tsx`, add validation check:

```typescript
import { env } from './lib/env'

// This will throw if env vars are invalid
console.log(`Starting CollabBoard in ${env.environment} mode`)

// ... rest of main.tsx
```

**Step 3: Update supabase.ts to use validated env**

In `src/lib/supabase.ts`:

```typescript
import { env } from './env'

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey)
```

**Step 4: Commit**

```bash
git add src/lib/env.ts src/main.tsx src/lib/supabase.ts
git commit -m "feat: add environment variable validation on startup

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Manual Testing & Final Validation

After completing all tasks, perform these manual checks:

### Functional Testing
1. Open two browser windows side by side
2. Sign in with different accounts (or guests)
3. Create, move, edit, delete objects in one window
4. Verify changes appear in the other window within 100ms
5. Test AI commands with natural language
6. Test all keyboard shortcuts
7. Test disconnect/reconnect resilience

### Performance Testing
1. Open Chrome DevTools Performance tab
2. Record a session with pan, zoom, and object manipulation
3. Verify 60 FPS maintained
4. Check for memory leaks (no constantly growing memory)

### Production Build Testing
1. Run `pnpm run build`
2. Serve the dist folder: `pnpm preview`
3. Verify no console errors
4. Check bundle size is reasonable (<500KB main bundle)
5. Test all functionality in production build

### Security Validation
1. Open Network tab, verify HTTPS
2. Check Response headers include CSP
3. Verify no secrets in client-side code
4. Test RLS: try to access another user's board directly via Supabase API

---

## Success Criteria

- [ ] All Phase 1 tasks completed (code quality)
- [ ] All Phase 2 tasks completed (UX polish)
- [ ] All Phase 3 tasks completed (CI/CD)
- [ ] All Phase 4 tasks completed (documentation)
- [ ] All Phase 5 tasks completed (security)
- [ ] Manual testing checklist passed
- [ ] Deployment checklist completed
- [ ] Application deployed to production
- [ ] No critical errors in monitoring

---

## Execution Notes

**Estimated time:** 4-6 hours for complete implementation

**Priority order:**
1. Phase 1 (critical for production)
2. Phase 5 (security critical)
3. Phase 3 (enables automation)
4. Phase 2 (UX improvements)
5. Phase 4 (documentation)

**Can be parallelized:**
- Phase 1 & 2 can run simultaneously (different files)
- Phase 3 & 4 can run simultaneously (different concerns)
