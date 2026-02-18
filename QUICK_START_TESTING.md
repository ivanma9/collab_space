# Quick Start: Running CollabBoard E2E Tests

Get your E2E tests running in 5 minutes.

## Step 1: Install Dependencies (1 minute)

```bash
# Install project dependencies
pnpm install

# Install Playwright browsers
pnpm playwright install
```

## Step 2: Set Up Test Users (2 minutes)

In your Supabase dashboard (https://app.supabase.com):

1. Go to **Authentication** > **Users**
2. Click **Add User** (manually)
3. Create these 5 users:

| Email | Password |
|-------|----------|
| user1@test.com | password1 |
| user2@test.com | password2 |
| user3@test.com | password3 |
| user4@test.com | password4 |
| user5@test.com | password5 |

✅ **Quick tip**: Use "Email" tab, not "Magic Link"

## Step 3: Verify Environment (30 seconds)

Check your `.env` file has:
```bash
VITE_SUPABASE_URL="your_supabase_project_url"
VITE_SUPABASE_ANON_KEY="your_anon_key"
```

## Step 4: Add Critical Data-TestIDs (2 minutes)

Add these minimal data-testids to get started:

### Login Page (`src/pages/LoginPage.tsx`)
```tsx
<div data-testid="login-page">
  <input data-testid="email-input" type="email" />
  <input data-testid="password-input" type="password" />
  <button data-testid="login-button">Login</button>
</div>
```

### Board Stage (`src/components/canvas/BoardStage.tsx`)
```tsx
<Stage
  data-testid="board-stage"
  data-transform={JSON.stringify({ x: stageX, y: stageY, scale: stageScale })}
>
  {/* your layers */}
</Stage>
```

### Sticky Notes (`src/components/canvas/StickyNote.tsx`)
```tsx
<Group
  data-testid={`sticky-note-${object.id}`}
  // ... other props
>
  {/* sticky note content */}
</Group>
```

### Text Editor (`src/components/canvas/TextEditOverlay.tsx`)
```tsx
{isEditing && (
  <div data-testid="text-edit-overlay">
    <textarea data-testid="text-edit-input" />
  </div>
)}
```

## Step 5: Run Your First Test! (30 seconds)

```bash
# Start dev server (in one terminal)
pnpm dev

# Run a simple test (in another terminal)
pnpm playwright test mvp-requirements.spec.ts -g "User authentication" --headed
```

You should see a browser open, the test log in, and pass!

## What's Next?

### Add More Data-TestIDs
See `e2e/DATA_TESTID_CHECKLIST.md` for the complete list.

Work through them in order:
1. **Critical** - MVP tests need these
2. **High** - Real-time tests need these
3. **Medium** - Board feature tests need these
4. **Low** - Nice to have

### Run More Tests

```bash
# Run all MVP tests
pnpm playwright test mvp-requirements --headed

# Run all tests (takes 10-15 minutes)
pnpm test:e2e

# View HTML report
pnpm test:e2e:report
```

### Debug Failures

If tests fail:
1. **Check the error message** - usually tells you what's missing
2. **Look for missing data-testids** - most common issue
3. **Verify test users exist** in Supabase Auth
4. **Check console logs** in the browser (headed mode)

## Common Issues

### "Cannot find element [data-testid='...']"
**Fix**: Add the data-testid attribute to that component

### "Login failed" or "Auth error"
**Fix**:
- Verify test users exist in Supabase Auth
- Check `.env` has correct credentials
- Verify Supabase is running

### "Timeout waiting for element"
**Fix**:
- Component might not have data-testid
- Increase timeout: `await expect(el).toBeVisible({ timeout: 10000 })`
- Check if element is actually rendered

### Tests are slow
**Fix**:
- Run specific tests instead of all: `pnpm playwright test mvp-requirements`
- Run in single browser: `pnpm playwright test --project=chromium`
- Close other applications

## Test Coverage Checklist

Check off as you implement:

- [ ] MVP Requirements (9 tests)
  - [ ] User authentication works
  - [ ] Board loads and displays
  - [ ] Can create sticky notes
  - [ ] Can create shapes
  - [ ] Can pan and zoom
  - [ ] Objects sync between users
  - [ ] Cursors show up
  - [ ] Presence works

- [ ] Board Features (40+ tests)
  - [ ] All object types work
  - [ ] Transform operations work
  - [ ] Selection works

- [ ] Real-Time Collaboration (30+ tests)
  - [ ] Multi-user sync works
  - [ ] Disconnect/reconnect works
  - [ ] State persists

- [ ] Testing Scenarios (25+ tests)
  - [ ] Simultaneous editing
  - [ ] Refresh mid-edit
  - [ ] Rapid operations
  - [ ] Network issues
  - [ ] 5+ users

- [ ] Performance Targets (20+ tests)
  - [ ] 60 FPS during operations
  - [ ] <100ms object sync
  - [ ] <50ms cursor sync
  - [ ] 500+ objects capacity
  - [ ] 5+ concurrent users

## Development Workflow

1. **Add feature** to your codebase
2. **Add data-testid** to new components
3. **Run relevant tests** to verify
4. **Fix any failures**
5. **Run full suite** before committing

## Tips for Success

✅ **DO**:
- Add data-testids as you build components
- Run tests frequently during development
- Use headed mode (`--headed`) to debug
- Check test output carefully

❌ **DON'T**:
- Use class names or text for selectors
- Skip adding data-testids (tests won't work)
- Ignore test failures
- Run tests without dev server

## Quick Commands Reference

```bash
# Run specific test file
pnpm playwright test mvp-requirements.spec.ts

# Run tests matching pattern
pnpm playwright test --grep "sticky note"

# Run in headed mode (see browser)
pnpm playwright test --headed

# Debug mode (step through)
pnpm playwright test --debug

# Run single browser
pnpm playwright test --project=chromium

# Show test report
pnpm test:e2e:report
```

## Getting Help

1. **Read error messages carefully** - they usually tell you what's wrong
2. **Check `e2e/README.md`** - comprehensive documentation
3. **Check `DATA_TESTID_CHECKLIST.md`** - missing testids?
4. **Check `E2E_TEST_SUMMARY.md`** - overview of test suite

## Success!

Once you see tests passing, you'll have:
- ✅ Verified MVP requirements
- ✅ Automated regression testing
- ✅ Performance validation
- ✅ Multi-user testing
- ✅ CI/CD readiness

**Now run the full suite and watch your CollabBoard come to life!** 🎉

```bash
pnpm test:e2e
```
