/* eslint-disable @next/next/no-img-element */

import type { ImgHTMLAttributes } from 'react';

interface RemotePosterImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> {
  src: string;
  alt: string;
  absoluteFill?: boolean;
}

export function RemotePosterImage({
  src,
  alt,
  absoluteFill = false,
  className,
  loading = 'lazy',
  referrerPolicy = 'no-referrer',
  decoding = 'async',
  onError,
  ...rest
}: RemotePosterImageProps) {
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      referrerPolicy={referrerPolicy}
      className={[
        absoluteFill ? 'absolute inset-0 w-full h-full' : '',
        className || '',
      ]
        .filter(Boolean)
        .join(' ')}
      onError={(event) => {
        event.currentTarget.style.display = 'none';
        onError?.(event);
      }}
    />
  );
}
