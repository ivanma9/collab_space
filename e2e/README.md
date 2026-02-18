# CollabBoard E2E Test Suite

Comprehensive end-to-end tests for verifying all MVP requirements, board features, real-time collaboration, testing scenarios, and performance targets.

## Test Coverage

This test suite provides complete coverage of the CollabBoard requirements:

### 1. MVP Requirements (Hard Gate) - `mvp-requirements.spec.ts`
Tests all 9 critical MVP requirements that must pass:
- ✅ Infinite board with pan/zoom
- ✅ Sticky notes with editable text
- ✅ At least one shape type (rectangle, circle, line)
- ✅ Create, move, and edit objects
- ✅ Real-time sync between 2+ users
- ✅ Multiplayer cursors with name labels
- ✅ Presence awareness (who's online)
- ✅ User authentication
- ✅ Deployed and publicly accessible

### 2. Board Features - `board-features.spec.ts`
Tests all board feature categories:
- **Workspace**: Infinite board, smooth pan/zoom
- **Sticky Notes**: Create, edit text, change colors
- **Shapes**: Rectangles, circles, lines with solid colors
- **Connectors**: Lines/arrows connecting objects
- **Text Elements**: Standalone text elements
- **Frames**: Group and organize content areas
- **Transforms**: Move, resize, rotate objects
- **Selection**: Single and multi-select (shift-click, drag-to-select)
- **Operations**: Delete, duplicate, copy/paste

### 3. Real-Time Collaboration - `realtime-collaboration.spec.ts`
Tests all collaboration features:
- **Cursors**: Multiplayer cursors with names, real-time movement
- **Sync**: Object creation/modification appears instantly for all users
- **Presence**: Clear indication of who's currently on the board
- **Conflicts**: Handle simultaneous edits (last-write-wins)
- **Resilience**: Graceful disconnect/reconnect handling
- **Persistence**: Board state survives all users leaving and returning

### 4. Testing Scenarios - `testing-scenarios.spec.ts`
Tests the 5 specific testing scenarios:
1. **Scenario 1**: 2 users editing simultaneously in different browsers
2. **Scenario 2**: One user refreshing mid-edit (state persistence check)
3. **Scenario 3**: Rapid creation and movement of sticky notes and shapes (sync performance)
4. **Scenario 4**: Network throttling and disconnection recovery
5. **Scenario 5**: 5+ concurrent users without degradation

### 5. Performance Targets - `performance-targets.spec.ts`
Tests all performance requirements:
- **Frame Rate**: 60 FPS during pan, zoom, object manipulation
- **Object Sync Latency**: <100ms
- **Cursor Sync Latency**: <50ms
- **Object Capacity**: 500+ objects without performance drops
- **Concurrent Users**: 5+ without degradation

## Prerequisites

### Environment Setup

1. **Node.js and pnpm**: Ensure you have Node.js (18+) and pnpm installed

2. **Environment Variables**: Create a `.env` file with your Supabase credentials:
   ```bash
   VITE_SUPABASE_URL="your_supabase_url"
   VITE_SUPABASE_ANON_KEY="your_supabase_anon_key"
   ```

3. **Test Users**: Create test user accounts in Supabase Auth:
   - `user1@test.com` / `password1`
   - `user2@test.com` / `password2`
   - `user3@test.com` / `password3`
   - `user4@test.com` / `password4`
   - `user5@test.com` / `password5`

   Or update the test credentials in `e2e/helpers/test-utils.ts`

### Supabase Setup

Ensure your Supabase project has:
- **Auth enabled** with email/password and Google OAuth configured
- **Database schema** with tables for boards, board_objects, board_members
- **Row Level Security (RLS)** policies properly configured
- **Realtime** enabled for the board_objects table

## Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm playwright install
```

## Running Tests

### Run All Tests
```bash
pnpm test:e2e
```

### Run Specific Test Suites
```bash
# MVP Requirements only
pnpm playwright test mvp-requirements

# Board Features only
pnpm playwright test board-features

# Real-Time Collaboration only
pnpm playwright test realtime-collaboration

# Testing Scenarios only
pnpm playwright test testing-scenarios

# Performance Targets only
pnpm playwright test performance-targets
```

### Run in Specific Browsers
```bash
# Chromium only
pnpm playwright test --project=chromium

# Firefox only
pnpm playwright test --project=firefox

# WebKit (Safari) only
pnpm playwright test --project=webkit

# All browsers
pnpm playwright test --project=chromium --project=firefox --project=webkit
```

### Run in Headed Mode (See Browser)
```bash
pnpm playwright test --headed
```

### Run Specific Tests
```bash
# Run a specific test file
pnpm playwright test mvp-requirements.spec.ts

# Run tests matching a pattern
pnpm playwright test --grep "sticky note"

# Run tests with specific tags
pnpm playwright test --grep "@critical"
```

### Debug Mode
```bash
# Debug with Playwright Inspector
pnpm playwright test --debug

# Debug specific test
pnpm playwright test mvp-requirements.spec.ts:20 --debug
```

## Test Reports

### View HTML Report
After running tests, view the detailed HTML report:
```bash
pnpm test:e2e:report
```

### View Test Traces
If tests fail, traces are automatically captured:
```bash
pnpm playwright show-trace trace.zip
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: pnpm install
      - run: pnpm playwright install --with-deps
      - run: pnpm test:e2e
        env:
          BASE_URL: ${{ secrets.DEPLOYED_URL }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Test Architecture

### Multi-User Testing
The test suite uses custom fixtures for multi-user testing:
```typescript
// Multi-user test example
test('Both users see real-time changes', async ({ user1Page, user2Page }) => {
  // user1Page and user2Page are separate browser contexts
  // simulating different users
});
```

### Helper Functions
Common test operations are abstracted into helper functions:
- `loginUser()`: Authenticate a user
- `createStickyNote()`: Create a sticky note at position
- `createShape()`: Create a shape (rectangle/circle/line)
- `dragObject()`: Drag an object from one position to another
- `measureFrameRate()`: Measure FPS during operations
- `measureSyncLatency()`: Measure real-time sync latency
- And many more...

## Adding Data-TestID Attributes

For the tests to work properly, your components need `data-testid` attributes. Here's a checklist:

### Required Data-TestIDs

**Authentication**:
- `[data-testid="login-page"]` - Login page container
- `[data-testid="email-input"]` - Email input field
- `[data-testid="password-input"]` - Password input field
- `[data-testid="login-button"]` - Login button
- `[data-testid="google-login-button"]` - Google OAuth button
- `[data-testid="user-menu"]` - User menu button
- `[data-testid="sign-out-button"]` - Sign out button

**Board**:
- `[data-testid="board-stage"]` - Main board/canvas container
- `[data-testid="board-stage"][data-transform]` - Stage with transform data

**Tools**:
- `[data-testid="select-tool"]` - Selection tool button
- `[data-testid="sticky-note-tool"]` - Sticky note tool button
- `[data-testid="rectangle-tool"]` - Rectangle tool button
- `[data-testid="circle-tool"]` - Circle tool button
- `[data-testid="line-tool"]` - Line tool button
- `[data-testid="frame-tool"]` - Frame tool button
- `[data-testid="text-tool"]` - Text tool button
- `[data-testid="connector-tool"]` - Connector tool button

**Objects**:
- `[data-testid="sticky-note-{id}"]` - Individual sticky notes
- `[data-testid="shape-{id}"][data-shape-type]` - Shapes with type attribute
- `[data-testid="frame-{id}"]` - Frames
- `[data-testid="connector-{id}"]` - Connectors
- `[data-testid="text-element-{id}"]` - Text elements

**Interaction**:
- `[data-testid="text-edit-overlay"]` - Text editing overlay
- `[data-testid="text-edit-input"]` - Text input field
- `[data-testid="selection-transformer"]` - Selection transformer/handles
- `[data-testid="resize-handle-bottom-right"]` - Resize handle
- `[data-testid="rotate-handle"]` - Rotate handle

**Collaboration**:
- `[data-testid="remote-cursor-{username}"]` - Remote user cursors
- `[data-testid="presence-bar"]` - Online users bar
- `[data-testid="presence-user-{id}"]` - Individual user in presence
- `[data-testid="connection-status"][data-status]` - Connection indicator

**Styling**:
- `[data-testid="color-picker-button"]` - Color picker button
- `[data-testid="color-option-{color}"]` - Color options

**Selection**:
- `[data-testid="selection-count"]` - Selected object count display

## Troubleshooting

### Tests Fail Due to Missing Data-TestIDs
**Solution**: Add the required `data-testid` attributes to your components (see checklist above)

### Network Timeout Errors
**Solution**: Increase timeout in specific tests:
```typescript
await expect(element).toBeVisible({ timeout: 10000 });
```

### Supabase Connection Issues
**Solution**:
- Verify `.env` file has correct credentials
- Ensure Supabase project is running
- Check RLS policies are not blocking test users

### Multi-User Tests Fail
**Solution**:
- Ensure test user accounts exist in Supabase Auth
- Verify users have access to the test board
- Check that Realtime is enabled

### Performance Tests Fail
**Solution**:
- Run on a machine with adequate resources
- Close other applications to free up CPU/memory
- Performance targets may need adjustment for CI environments

## Test Maintenance

### Updating Tests
When adding new features:
1. Add helper functions to `e2e/helpers/test-utils.ts`
2. Create test file in appropriate category
3. Use existing fixtures and helpers
4. Update this README with new test coverage

### Best Practices
- **Use data-testid** for element selection (not class names or text)
- **Use fixtures** for multi-user tests
- **Use helper functions** to keep tests DRY
- **Add waits judiciously** - prefer `expect().toBeVisible()` over `waitForTimeout()`
- **Test real user workflows** - not just API calls
- **Measure performance** - include timing assertions

## Performance Benchmarks

Expected performance on modern hardware:
- **FPS**: 50-60 FPS during pan/zoom/manipulation
- **Object Sync**: 50-100ms latency
- **Cursor Sync**: 30-80ms latency
- **Object Capacity**: 500+ objects at 30+ FPS
- **Concurrent Users**: 5+ users with <200ms sync latency

## Support

For issues with the test suite:
1. Check that all prerequisites are met
2. Verify data-testid attributes are added
3. Review test output and error messages
4. Check Supabase dashboard for backend issues

## License

Same as CollabBoard project license.
