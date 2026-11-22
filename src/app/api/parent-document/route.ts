export async function POST() {
  return Response.json(
    {
      error:
        "Przesyłanie PDF-ów do chmury jest wyłączone. Odczytaj dokument lokalnie w przeglądarce.",
    },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
