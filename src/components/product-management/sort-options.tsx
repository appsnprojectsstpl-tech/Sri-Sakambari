import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface SortOptionsProps {
  sortBy: 'name' | 'price' | 'stock';
  sortDirection: 'asc' | 'desc';
  onSortChange: (sortBy: 'name' | 'price' | 'stock', direction?: 'asc' | 'desc') => void;
}

export function SortOptions({ sortBy, sortDirection, onSortChange }: SortOptionsProps) {
  const options = [
    { value: 'name', label: 'Name' },
    { value: 'price', label: 'Price' },
    { value: 'stock', label: 'Stock' }
  ];

  return (
    <div className="flex items-center gap-1 border rounded-md">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={sortBy === option.value ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onSortChange(option.value as any)}
          className="px-3 py-1 h-8"
        >
          <span className="text-sm">{option.label}</span>
          {sortBy === option.value && (
            sortDirection === 'asc' ? 
              <ChevronUp className="w-3 h-3 ml-1" /> : 
              <ChevronDown className="w-3 h-3 ml-1" />
          )}
        </Button>
      ))}
    </div>
  );
}