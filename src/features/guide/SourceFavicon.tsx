import Image from "next/image";

export function SourceFavicon({
  hostname,
  size,
  className,
}: {
  hostname: string;
  size: number;
  className?: string;
}) {
  const extension = hostname === "eli.gov.pl" ? "ico" : "png";

  return (
    <Image
      className={className}
      src={`/source-icons/${hostname}.${extension}`}
      alt=""
      width={size}
      height={size}
      unoptimized
    />
  );
}
