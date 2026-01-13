
import React, { memo } from 'react';
import Image from 'next/image';
import { Trash2 } from 'lucide-react';

interface ProductImageGalleryProps {
  images: string[];
  onRemove: (url: string) => void;
}

const ProductImageGallery = memo(({ images, onRemove }: ProductImageGalleryProps) => {
  if (!images || images.length === 0) return null;

  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {images.map((url, index) => (
        <div key={url} className="relative aspect-square bg-muted rounded-md overflow-hidden group">
          <Image
            src={url}
            alt={`Product image ${index + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 33vw, 150px"
          />
          <button
            type="button"
            onClick={() => onRemove(url)}
            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove Image"
            aria-label={`Remove image ${index + 1}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
});

ProductImageGallery.displayName = 'ProductImageGallery';

export default ProductImageGallery;
