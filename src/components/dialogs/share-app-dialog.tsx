import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { shareApp, getShareData } from '@/lib/share-utils';
import { useToast } from '@/hooks/use-toast';

interface ShareAppDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ShareAppDialog({ open, onOpenChange }: ShareAppDialogProps) {
    const { toast } = useToast();

    const handleShare = async () => {
        const shareData = getShareData();
        const result = await shareApp(shareData);

        if (result.success) {
            if (result.method === 'clipboard' || result.method === 'clipboard-fallback') {
                toast({
                    title: 'Link Copied!',
                    description: 'App link has been copied to clipboard.',
                });
            } else {
                toast({
                    title: 'Shared Successfully!',
                    description: 'Thank you for sharing the app.',
                });
            }
            onOpenChange(false);
        } else {
            toast({
                title: 'Share Failed',
                description: 'Unable to share. Please try again.',
                variant: 'destructive'
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Share2 className="w-6 h-6 text-primary" />
                        <DialogTitle>Share App</DialogTitle>
                    </div>
                </DialogHeader>

                <DialogDescription className="text-base">
                    Share this app so others can browse products and place orders easily.
                </DialogDescription>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                    <Button onClick={handleShare} className="w-full sm:w-auto">
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
