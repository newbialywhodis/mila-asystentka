import { MilaGuide } from "../features/guide/MilaGuide";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <MilaGuide
      uploadAllowed={
        process.env.MILA_PDF_UPLOAD_ALLOWED === "1" &&
        Boolean(process.env.AI_GATEWAY_API_KEY?.trim())
      }
    />
  );
}
