import { createFileRoute } from "@tanstack/react-router";
import { BoardPage } from "../pages/BoardPage";

export const Route = createFileRoute("/board/$boardId")({
  component: BoardPage,
});
