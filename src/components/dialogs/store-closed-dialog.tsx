import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface StoreClosedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isStoreOpen: boolean;
}

export function StoreClosedDialog({ open, onOpenChange, isStoreOpen }: StoreClosedDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <AlertCircle className={`w-6 h-6 ${isStoreOpen ? 'text-green-500' : 'text-red-500'}`} />
                        <DialogTitle>{isStoreOpen ? 'Store Open' : 'Store Closed'}</DialogTitle>
                    </div>
                </DialogHeader>

                <DialogDescription className="text-base space-y-2">
                    {isStoreOpen ? (
                        <>
                            <p>The store is open and accepting orders.</p>
                            <p className="text-green-600 font-medium">You can browse products and place orders.</p>
                        </>
                    ) : (
                        <>
                            <p>The store is closed today and not accepting orders.</p>
                            <p className="text-red-600 font-medium">Ordering is temporarily disabled.</p>
                            <p className="text-muted-foreground">You may continue browsing products.</p>
                        </>
                    )}
                </DialogDescription>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} className="w-full">
                        OK
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
