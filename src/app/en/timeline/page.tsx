import { redirect } from "next/navigation";

// The English twin of src/app/timeline/page.tsx.
export const dynamic = "force-dynamic";

export default function TimelinePage() {
  redirect("/en/technologies?view=timeline");
}
