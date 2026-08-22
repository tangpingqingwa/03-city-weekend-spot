import { redirect } from "next/navigation";
import { defaultBoardPath } from "../core/cities";

export default function HomePage() {
  redirect(defaultBoardPath());
}
