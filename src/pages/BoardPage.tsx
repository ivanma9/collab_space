import { useParams } from "@tanstack/react-router"
import { CursorTest } from "./CursorTest"

export function BoardPage() {
  const { boardId } = useParams({ from: "/board/$boardId" })
  return <CursorTest boardId={boardId} />
}
