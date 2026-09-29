import { serializeJsonLd } from "@/lib/structured-data";

/**
 * Renders schema.org JSON-LD. A server component: the data never enters a
 * client bundle. Several objects render as several scripts, which parsers
 * read the same as one `@graph`.
 */
export function JsonLd({ data }: { data: object | readonly object[] }) {
  const objects = Array.isArray(data) ? data : [data];

  return (
    <>
      {objects.map((object, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(object) }}
        />
      ))}
    </>
  );
}
