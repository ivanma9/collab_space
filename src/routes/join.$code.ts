import { createFileRoute } from "@tanstack/react-router";
import { JoinPage } from "../pages/JoinPage";

export const Route = createFileRoute("/join/$code")({
  component: JoinPage,
});
