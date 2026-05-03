import type { ImgHTMLAttributes } from "react";

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "width" | "height"> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
  quality?: number;
  placeholder?: string;
  blurDataURL?: string;
}

export default function Image({ fill, priority, unoptimized, quality, placeholder, blurDataURL, style, ...rest }: ImageProps) {
  const computedStyle = fill
    ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const, ...style }
    : style;
  return <img {...rest} style={computedStyle} loading={priority ? "eager" : "lazy"} />;
}
