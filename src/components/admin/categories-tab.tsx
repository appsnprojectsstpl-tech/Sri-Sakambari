'use client';

import { useState } from 'react';
import { Category } from '@/lib/types';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { DEFAULT_CATEGORIES } from '@/components/customer/customer-header';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, GripVertical, Pencil, Trash2, Check, X, RefreshCw } from 'lucide-react';
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
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Sortable Item Component
function SortableCategoryRow({ category, onEdit, onDelete }: { category: Category, onEdit: (c: Category) => void, onDelete: (c: Category) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as 'relative',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-4 p-3 bg-white border rounded-lg shadow-sm hover:border-primary/50 transition-colors group"
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
            >
                <GripVertical className="h-5 w-5" />
            </div>

            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${category.color.includes('bg-') ? category.color : 'bg-gray-100'}`}>
                {category.icon}
            </div>

            <div className="flex-1">
                <h4 className="font-medium text-sm">{category.name}</h4>
                <p className="text-xs text-muted-foreground">ID: {category.id}</p>
            </div>

            <Badge variant={category.isActive ? "default" : "secondary"}>
                {category.isActive ? 'Active' : 'Inactive'}
            </Badge>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" onClick={() => onEdit(category)}>
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(category)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

export default function CategoriesTab() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { data: categories, loading, error, forceRefetch } = useCollection<Category>('categories', {
        constraints: [['orderBy', 'displayOrder', 'asc']]
    });

    const [isSeeding, setIsSeeding] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category>>({});

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleSeedDefaults = async () => {
        if (!firestore) return;
        setIsSeeding(true);
        try {
            const batch = writeBatch(firestore);

            // Filter out 'All' as it's virtual
            const toSeed = DEFAULT_CATEGORIES.filter(c => c.id !== 'All');

            toSeed.forEach((cat, index) => {
                const docRef = doc(firestore, 'categories', cat.id);
                // Schema mapping
                const categoryData: Category = {
                    id: cat.id,
                    name: cat.label,
                    icon: cat.icon,
                    color: cat.color,
                    displayOrder: index, // Initial order from array
                    isActive: true,
                    createdAt: serverTimestamp()
                };
                batch.set(docRef, categoryData, { merge: true });
            });

            await batch.commit();
            toast({ title: "Categories Seeded", description: "Default categories added to database." });
            forceRefetch();
        } catch (e: any) {
            console.error(e);
            toast({ variant: "destructive", title: "Seeding Failed", description: e.message });
        } finally {
            setIsSeeding(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!categories) return;

        if (active.id !== over?.id) {
            const oldIndex = categories.findIndex(c => c.id === active.id);
            const newIndex = categories.findIndex(c => c.id === over?.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                // Optimistic UI Update (optional, but relying on re-fetch here for simplicity first)
                // const newOrdered = arrayMove(categories, oldIndex, newIndex);

                // Firestore Update
                // We need to update displayOrder for all affected items or just swap?
                // Re-indexing everything is safest for small lists (<100 items).

                // Construct new order
                const newOrderedList = arrayMove(categories, oldIndex, newIndex);

                try {
                    const batch = writeBatch(firestore);
                    newOrderedList.forEach((cat, index) => {
                        if (cat.displayOrder !== index) {
                            batch.update(doc(firestore, 'categories', cat.id), { displayOrder: index });
                        }
                    });
                    await batch.commit();
                    // toast({ title: "Order Updated" }); // Too noisy
                } catch (e) {
                    toast({ variant: "destructive", title: "Reorder Failed" });
                }
            }
        }
    };

    const handleSaveCategory = async () => {
        if (!firestore || !editingCategory.name || !editingCategory.id) {
            toast({ variant: "destructive", title: "Validation Error", description: "Name and ID are required." });
            return;
        }

        try {
            const catId = editingCategory.id.replace(/\s+/g, '-'); // Simple slugify for ID
            const docRef = doc(firestore, 'categories', catId);

            const payload = {
                ...editingCategory,
                id: catId,
                // Default values if new
                displayOrder: editingCategory.displayOrder ?? (categories?.length || 0),
                isActive: editingCategory.isActive ?? true,
                icon: editingCategory.icon || '📦',
                color: editingCategory.color || 'bg-gray-100 text-gray-700',
            };

            await setDoc(docRef, payload, { merge: true });
            toast({ title: "Category Saved" });
            setIsDialogOpen(false);
            setEditingCategory({});
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
        }
    };

    const handleDeleteClick = async (category: Category) => {
        if (!firestore) return;
        if (confirm(`Delete category "${category.name}"? Products in this category might become hidden.`)) {
            try {
                await deleteDoc(doc(firestore, 'categories', category.id));
                toast({ title: "Category Deleted" });
            } catch (e: any) {
                toast({ variant: "destructive", title: "Error", description: e.message });
            }
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
                    <p className="text-muted-foreground">Manage and reorder product categories.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSeedDefaults} disabled={isSeeding || (categories && categories.length > 0)}>
                        {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        {categories && categories.length > 0 ? 'Reseed Defaults' : 'Seed Defaults'}
                    </Button>
                    <Button onClick={() => { setEditingCategory({}); setIsDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> New Category
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={categories?.map(c => c.id) || []}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="grid gap-2 max-w-3xl">
                            {categories?.map((category) => (
                                <SortableCategoryRow
                                    key={category.id}
                                    category={category}
                                    onEdit={(c) => { setEditingCategory(c); setIsDialogOpen(true); }}
                                    onDelete={handleDeleteClick}
                                />
                            ))}
                            {(!categories || categories.length === 0) && (
                                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                                    No categories found. Seed defaults or create one.
                                </div>
                            )}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingCategory.id ? 'Edit Category' : 'New Category'}</DialogTitle>
                        <DialogDescription>
                            Configure category display settings. ID must be unique.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cat-name">Display Name</Label>
                            <Input
                                id="cat-name"
                                value={editingCategory.name || ''}
                                onChange={(e) => {
                                    setEditingCategory(prev => ({
                                        ...prev,
                                        name: e.target.value,
                                        // Auto-generate ID if new and empty
                                        id: !prev.id && !editingCategory.id ? e.target.value.replace(/\s+/g, '-') : prev.id
                                    }));
                                }}
                                placeholder="e.g. Vegetables"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="cat-id">ID (Unique Key)</Label>
                            <Input
                                id="cat-id"
                                value={editingCategory.id || ''}
                                onChange={(e) => setEditingCategory(prev => ({ ...prev, id: e.target.value }))}
                                disabled={!!editingCategory.createdAt} // Disable ID edit for existing
                                placeholder="e.g. vegetables"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="cat-icon">Icon (Emoji)</Label>
                                <Input
                                    id="cat-icon"
                                    value={editingCategory.icon || ''}
                                    onChange={(e) => setEditingCategory(prev => ({ ...prev, icon: e.target.value }))}
                                    placeholder="e.g. 🥦"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cat-color">Color Class</Label>
                                <Input
                                    id="cat-color"
                                    value={editingCategory.color || ''}
                                    onChange={(e) => setEditingCategory(prev => ({ ...prev, color: e.target.value }))}
                                    placeholder="bg-green-100 text-green-700"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveCategory}>Save Category</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
