import { redirect } from "next/navigation";

interface ImportedCandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function ImportedCandidateDetailPage({
  params
}: ImportedCandidateDetailPageProps) {
  const { id } = await params;
  redirect(`/workspace/candidates/${id}`);
}
