import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function MyRadarPage() {
  redirect("/technologies?view=followed");
}
