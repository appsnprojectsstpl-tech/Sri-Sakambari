import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export default function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden flex flex-col h-full border-muted shadow-sm">
      {/* Image Skeleton - Matches h-36 (9rem = 144px) */}
      <div className="relative h-36 w-full bg-muted/20">
        <Skeleton className="h-full w-full" />
      </div>

      <CardContent className="p-2.5 flex-1 flex flex-col gap-2">
        {/* Title Skeleton - Compact */}
        <div className="min-h-[2.5rem] space-y-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>

        {/* Optional "Cut" toggle skeleton */}
        <div className="flex gap-2 items-center pt-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>

      <CardFooter className="p-2.5 pt-0 mt-auto">
        {/* Add Button Skeleton - h-10 */}
        <Skeleton className="h-10 w-full rounded-md" />
      </CardFooter>
    </Card>
  );
}
