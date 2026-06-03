import { redirect } from "next/navigation";

interface TechnologyDraftDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function TechnologyDraftDetailPage({
  params
}: TechnologyDraftDetailPageProps) {
  const { id } = await params;
  redirect(`/workspace/technologies/${id}`);
}
