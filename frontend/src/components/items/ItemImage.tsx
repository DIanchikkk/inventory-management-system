import { resolveMediaSrc } from "../../utils/mediaUrl";

/** Фото объекта учёта: путь `/uploads/...` с API или внешний URL — не из `src/assets`. */
export function ItemImage({
  src,
  alt = "",
  className,
  loading = "lazy",
}: {
  src: string | undefined | null;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const url = resolveMediaSrc(src);
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
