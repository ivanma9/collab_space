# Data-TestID Implementation Checklist

This checklist tracks which `data-testid` attributes need to be added to your components for E2E tests to work.

## Authentication Components

- [ ] `data-testid="login-page"` - Login page container component
- [ ] `data-testid="email-input"` - Email input field in login form
- [ ] `data-testid="password-input"` - Password input field in login form
- [ ] `data-testid="login-button"` - Login submit button
- [ ] `data-testid="google-login-button"` - Google OAuth login button
- [ ] `data-testid="user-menu"` - User menu dropdown/button
- [ ] `data-testid="sign-out-button"` - Sign out button in user menu

## Board/Stage Components

- [ ] `data-testid="board-stage"` - Main board/canvas container (BoardStage component)
- [ ] `data-transform` attribute on board-stage with transform values (for pan/zoom verification)

## Tool Buttons

- [ ] `data-testid="select-tool"` - Selection/pointer tool button
- [ ] `data-testid="sticky-note-tool"` - Sticky note creation tool button
- [ ] `data-testid="rectangle-tool"` - Rectangle shape tool button
- [ ] `data-testid="circle-tool"` - Circle shape tool button
- [ ] `data-testid="line-tool"` - Line shape tool button
- [ ] `data-testid="frame-tool"` - Frame creation tool button
- [ ] `data-testid="text-tool"` - Text element tool button
- [ ] `data-testid="connector-tool"` - Connector/arrow tool button

## Board Objects

### Sticky Notes
- [ ] `data-testid="sticky-note-{id}"` - Each sticky note element
  - Example: `data-testid="sticky-note-abc123"`
  - Should be on the Konva Group or the clickable element

### Shapes
- [ ] `data-testid="shape-{id}"` - Each shape element
  - Example: `data-testid="shape-xyz789"`
- [ ] `data-shape-type="rectangle|circle|line"` - Shape type attribute
  - Example: `data-shape-type="rectangle"`

### Frames
- [ ] `data-testid="frame-{id}"` - Each frame element
  - Example: `data-testid="frame-def456"`

### Connectors
- [ ] `data-testid="connector-{id}"` - Each connector element
  - Example: `data-testid="connector-ghi789"`
- [ ] `data-arrow="true"` - For connectors with arrow style

### Text Elements
- [ ] `data-testid="text-element-{id}"` - Each standalone text element
  - Example: `data-testid="text-element-jkl012"`

## Text Editing

- [ ] `data-testid="text-edit-overlay"` - Text editing overlay/modal container
- [ ] `data-testid="text-edit-input"` - Textarea/input for text editing

## Selection and Transformation

- [ ] `data-testid="selection-transformer"` - Konva Transformer for selected objects
- [ ] `data-testid="resize-handle-bottom-right"` - Bottom-right resize handle
- [ ] `data-testid="resize-handle-top-left"` - Top-left resize handle (optional)
- [ ] `data-testid="resize-handle-top-right"` - Top-right resize handle (optional)
- [ ] `data-testid="resize-handle-bottom-left"` - Bottom-left resize handle (optional)
- [ ] `data-testid="rotate-handle"` - Rotation handle
- [ ] `data-testid="selection-count"` - Display showing number of selected objects

## Collaboration Features

### Remote Cursors
- [ ] `data-testid="remote-cursor-{username}"` - Each remote user's cursor
  - Example: `data-testid="remote-cursor-User 2"`
  - Username should match the display name

### Presence
- [ ] `data-testid="presence-bar"` - Container showing online users
- [ ] `data-testid="presence-user-{id}"` - Each user in the presence bar
  - Example: `data-testid="presence-user-abc123"`

### Connection Status
- [ ] `data-testid="connection-status"` - Connection status indicator
- [ ] `data-status="connected|disconnected|connecting"` - Status attribute
  - Example: `data-status="connected"`

## Styling and Properties

- [ ] `data-testid="color-picker-button"` - Button to open color picker
- [ ] `data-testid="color-option-{color}"` - Individual color options
  - Example: `data-testid="color-option-yellow"`
  - Common colors: yellow, blue, green, red, purple, pink, orange

- [ ] `data-testid="connector-style-arrow"` - Arrow style option for connectors
- [ ] `data-testid="connector-style-line"` - Line style option for connectors

## Object Data Attributes

For verification in tests, objects should also have:
- [ ] `data-rotation` - Rotation angle for rotated objects
- [ ] `data-object-id` - Unique object ID

## Implementation Examples

### Sticky Note Component
```tsx
<Group
  data-testid={`sticky-note-${object.id}`}
  data-object-id={object.id}
  onClick={handleClick}
  onDblClick={handleDblClick}
>
  {/* sticky note content */}
</Group>
```

### Shape Component
```tsx
<Group
  data-testid={`shape-${object.id}`}
  data-shape-type={shapeType} // 'rectangle', 'circle', or 'line'
  data-object-id={object.id}
  onClick={handleClick}
>
  {shapeType === 'rectangle' && <Rect {...props} />}
  {shapeType === 'circle' && <Circle {...props} />}
  {shapeType === 'line' && <Line {...props} />}
</Group>
```

### Board Stage with Transform
```tsx
<Stage
  data-testid="board-stage"
  data-transform={JSON.stringify({ x: stageX, y: stageY, scale: stageScale })}
  {...stageProps}
>
  {/* layers */}
</Stage>
```

### Remote Cursor
```tsx
<div
  data-testid={`remote-cursor-${userName}`}
  style={{ position: 'absolute', left: x, top: y }}
>
  <div className="cursor-pointer" />
  <div className="cursor-label">{userName}</div>
</div>
```

### Connection Status
```tsx
<div
  data-testid="connection-status"
  data-status={isConnected ? 'connected' : 'disconnected'}
  className={cn('status-indicator', {
    'text-green-500': isConnected,
    'text-red-500': !isConnected,
  })}
>
  {isConnected ? 'Connected' : 'Disconnected'}
</div>
```

### Text Edit Overlay
```tsx
{editingId && (
  <div data-testid="text-edit-overlay" className="fixed inset-0">
    <textarea
      data-testid="text-edit-input"
      value={text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      autoFocus
    />
  </div>
)}
```

### Selection Transformer
```tsx
<Transformer
  ref={transformerRef}
  data-testid="selection-transformer"
  boundBoxFunc={(oldBox, newBox) => {
    // Resize handles are automatically created by Konva
    // Add data-testid to handles if needed via custom anchors
    return newBox;
  }}
/>
```

## Testing After Implementation

After adding data-testids, verify they work:

```bash
# Run a simple test
pnpm playwright test mvp-requirements.spec.ts -g "Sticky notes" --headed

# Check if elements are found
pnpm playwright test --grep "create sticky note" --headed
```

## Notes

- **Konva Components**: For react-konva components, add data attributes directly to the Konva element (e.g., `<Group data-testid="...">`)
- **Dynamic IDs**: Use the actual object ID from your database for `{id}` placeholders
- **Username Matching**: Ensure remote cursor testids use the exact username/display name
- **Transform Data**: The transform attribute should be parseable JSON with x, y, scale keys

## Priority Order

If implementing incrementally, prioritize in this order:

1. **Critical** (MVP tests won't run without these):
   - login-page, email-input, password-input, login-button
   - board-stage
   - sticky-note-{id}, shape-{id}
   - text-edit-overlay, text-edit-input

2. **High** (Real-time collaboration tests need these):
   - remote-cursor-{username}
   - presence-bar, presence-user-{id}
   - connection-status with data-status

3. **Medium** (Board features tests need these):
   - All tool buttons
   - frame-{id}, connector-{id}, text-element-{id}
   - selection-transformer, resize/rotate handles

4. **Low** (Nice to have):
   - color-picker-button, color-option-{color}
   - connector-style options
   - selection-count

## Verification Script

Create a simple script to verify data-testids are present:

```typescript
// verify-testids.ts
const page = await browser.newPage();
await page.goto('http://localhost:5173');

// Check critical testids
const testIds = [
  'board-stage',
  'sticky-note-tool',
  'text-edit-overlay',
  // ... add all required testids
];

for (const testId of testIds) {
  const element = await page.locator(`[data-testid="${testId}"]`);
  const count = await element.count();
  console.log(`${testId}: ${count > 0 ? '✓' : '✗'}`);
}
```
