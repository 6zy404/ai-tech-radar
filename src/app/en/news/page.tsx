import { redirect } from "next/navigation";

// The English twin of src/app/news/page.tsx.
export const dynamic = "force-dynamic";

export default function NewsPage() {
  redirect("/en/technologies?view=news");
}
