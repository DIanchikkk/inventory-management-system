import { resolveMediaSrc } from "@/shared/utils/mediaUrl";

export function ItemImage({
  src,
  cacheKey,
  alt = "",
  className,
  loading = "lazy",
}: {
  src: string | undefined | null;
  cacheKey?: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const url = resolveMediaSrc(src, cacheKey);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading={loading}
      referrerPolicy="no-referrer"
      decoding="async"
    />
  );
}
