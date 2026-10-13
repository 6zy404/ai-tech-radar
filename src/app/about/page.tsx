import { aboutPageMetadata, AboutPage } from "@/components/pages/about-page";

// Served per request like every other public page. This page's own copy
// is fixed, but the shell around it is not, and validate:deployment holds
// every page to an explicit render mode.
export const dynamic = "force-dynamic";

export const metadata = aboutPageMetadata;

export default AboutPage;
