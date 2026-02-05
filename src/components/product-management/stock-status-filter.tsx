import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const stockStatuses = [
  { value: 'all', label: 'All Products' },
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'LOW_STOCK', label: 'Low Stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { value: 'NOT_TRACKED', label: 'Not Tracked' }
];

interface StockStatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function StockStatusFilter({ value, onChange }: StockStatusFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Stock Status" />
      </SelectTrigger>
      <SelectContent>
        {stockStatuses.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}