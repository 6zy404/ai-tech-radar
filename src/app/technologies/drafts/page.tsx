import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TechnologyDraftsPage() {
  redirect("/workspace/technologies");
}
