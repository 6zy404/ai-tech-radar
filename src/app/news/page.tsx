import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NewsPage() {
  redirect("/technologies?view=news");
}
