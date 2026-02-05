'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/lib/types';
import { useLanguage } from '@/context/language-context';
import { getProductName } from '@/lib/translations';

interface WhatsappTabProps {
    products: Product[];
    loading?: boolean;
}

export default function WhatsappTab({ products, loading }: WhatsappTabProps) {
    const { toast } = useToast();
    const { language } = useLanguage();
    const [message, setMessage] = useState('');
    const [isGenerated, setIsGenerated] = useState(false);

    // Generate message when products are loaded or language changes
    useEffect(() => {
        if (products.length > 0 && !isGenerated) {
            generateMessage();
        }
    }, [products, language, isGenerated]);

    const generateMessage = () => {
        const activeProducts = products
            .filter(p => p.isActive)
            .sort((a, b) => a.name.localeCompare(b.name));

        if (activeProducts.length === 0) {
            setMessage("No active products found.");
            return;
        }

        const productList = activeProducts
            .map(p => `* ${getProductName(p, language)}: ${p.pricePerUnit}/${p.unit}`)
            .join('\n');

        const appUrl = window.location.origin;
        // Use a generic greeting or allow customization later
        const generatedMsg = `*Today's Fresh Stock - Sri Sakambari Market*

${productList}

*Place your order now:*
1. *Click here:* ${appUrl}
2. *Or, reply to this message with your list!* (e.g., "Sweet Corn x 1, Milk x 2")`;

        setMessage(generatedMsg);
        setIsGenerated(true);
        toast({ title: "Message Generated", description: "Stock list updated." });
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(message);
        toast({ title: 'Message Copied!' });
    };

    const handleOpenWhatsapp = () => {
        window.open('https://web.whatsapp.com', '_blank');
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>WhatsApp Marketing</span>
                    <Button variant="outline" size="sm" onClick={generateMessage} title="Regenerate based on current stock">
                        <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                    </Button>
                </CardTitle>
                <CardDescription>
                    Copy this message to share the daily stock update with customers. You can edit the text before sending.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
                <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 min-h-[400px] font-mono text-sm resize-none"
                    placeholder="Generating stock list..."
                />
                <div className="flex gap-4">
                    <Button onClick={handleCopy} className="flex-1" size="lg">
                        <Copy className="mr-2 h-5 w-5" /> Copy Message
                    </Button>
                    <Button onClick={handleOpenWhatsapp} variant="secondary" className="flex-1" size="lg">
                        <ExternalLink className="mr-2 h-5 w-5" /> Open WhatsApp Web
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
