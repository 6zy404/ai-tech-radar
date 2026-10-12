import { RadarWorkspaceDetailPage } from "@/components/radar-workspace-pages";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspaceRadarDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <RadarWorkspaceDetailPage id={id} />;
}
