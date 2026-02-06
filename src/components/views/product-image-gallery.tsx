import React, { memo } from 'react';
import Image from 'next/image';
import { Trash2, GripVertical, Star } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';

interface ProductImageGalleryProps {
  images: string[];
  onRemove: (url: string) => void;
  onReorder: (newImages: string[]) => void;
}

const SortableImage = ({ url, index, onRemove }: { url: string, index: number, onRemove: (url: string) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square border rounded-lg overflow-hidden group bg-gray-50"
    >
      {/* Image */}
      <Image
        src={url}
        alt={`Product image ${index + 1}`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 33vw, 150px"
      />

      {/* Drag Handle Overlay */}
      <div
        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2"
        {...attributes}
        {...listeners}
      >
        <div className="cursor-grab active:cursor-grabbing text-white">
          <GripVertical className="h-6 w-6" />
        </div>

        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="h-8 w-8"
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
          onClick={(e) => { e.stopPropagation(); onRemove(url); }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Primary Badge (index 0) */}
      {index === 0 && (
        <div className="absolute top-1 left-1 bg-yellow-500 text-white text-[10px] px-2 py-0.5 rounded shadow flex items-center gap-1">
          <Star className="w-3 h-3 fill-current" /> Primary
        </div>
      )}

      {/* Index Badge */}
      <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
        #{index + 1}
      </div>
    </div>
  );
};

const ProductImageGallery = memo(({ images, onRemove, onReorder }: ProductImageGalleryProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = images.indexOf(String(active.id));
      const newIndex = images.indexOf(String(over?.id));
      onReorder(arrayMove(images, oldIndex, newIndex));
    }
  };

  if (!images || images.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={images}
        strategy={rectSortingStrategy}
      >
        <div className="mt-4 grid grid-cols-3 gap-4">
          {images.map((url, index) => (
            <SortableImage
              key={url}
              url={url}
              index={index}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
});

ProductImageGallery.displayName = 'ProductImageGallery';

export default ProductImageGallery;
