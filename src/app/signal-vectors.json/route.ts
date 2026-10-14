import {
  etagMatches,
  getSignalVectorResponse
} from "@/lib/local-recommend-vectors";

// Built from the live corpus on request, so a newly published signal appears
// without a rebuild. The same file for every reader: it takes no parameters
// and reads no cookies.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let response;

  try {
    response = await getSignalVectorResponse();
  } catch (error) {
    console.warn(
      "[signal-vectors] embeddings not ready:",
      error instanceof Error ? error.message : error
    );

    return Response.json(
      { error: "not ready" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const headers = {
    // Ten minutes: a signal published in between is simply not a candidate
    // until the browser's copy expires.
    "Cache-Control": "public, max-age=600",
    ETag: response.etag
  };

  if (etagMatches(request.headers.get("if-none-match"), response.etag)) {
    return new Response(null, { status: 304, headers });
  }

  return Response.json(response.file, { headers });
}
