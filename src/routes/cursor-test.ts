import { createFileRoute } from '@tanstack/react-router'
import { CursorTest } from '../pages/CursorTest'

export const Route = createFileRoute('/cursor-test')({
  component: CursorTest,
})
