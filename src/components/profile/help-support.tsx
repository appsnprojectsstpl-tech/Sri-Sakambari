'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { HelpCircle, MessageCircle, Mail, Phone } from 'lucide-react';

const faqs = [
    {
        question: 'How do I place an order?',
        answer: 'Browse products, add them to cart, and proceed to checkout. Fill in your delivery details and confirm your order.'
    },
    {
        question: 'What are the delivery timings?',
        answer: 'We deliver between 7 AM - 9 PM. You can select your preferred time slot during checkout.'
    },
    {
        question: 'How can I track my order?',
        answer: 'Go to your Profile > Order History to see real-time status of your orders.'
    },
    {
        question: 'What is the minimum order value?',
        answer: 'The minimum order value is ₹99. Orders below this amount cannot be placed.'
    },
    {
        question: 'Do you deliver cut vegetables?',
        answer: 'Yes! Select the "Cut & Cleaned" option when adding vegetables to cart. Additional charges apply.'
    },
    {
        question: 'How do I cancel an order?',
        answer: 'You can cancel pending orders from your Order History within 30 minutes of placing the order.'
    }
];

export default function HelpSupport() {
    const handleWhatsApp = () => {
        window.open('https://wa.me/919876543210?text=Hi, I need help with my order', '_blank');
    };

    const handleEmail = () => {
        window.location.href = 'mailto:support@srisakambari.com';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5" />
                    Help & Support
                </CardTitle>
                <CardDescription>Find answers or contact us</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* FAQ Section */}
                <div>
                    <h3 className="font-semibold mb-3">Frequently Asked Questions</h3>
                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((faq, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                                <AccordionTrigger className="text-left text-sm">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-sm text-muted-foreground">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                {/* Contact Options */}
                <div>
                    <h3 className="font-semibold mb-3">Contact Support</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" onClick={handleWhatsApp} className="h-auto py-4 flex-col gap-2">
                            <MessageCircle className="h-5 w-5 text-green-600" />
                            <span className="text-xs">WhatsApp</span>
                        </Button>
                        <Button variant="outline" onClick={handleEmail} className="h-auto py-4 flex-col gap-2">
                            <Mail className="h-5 w-5 text-blue-600" />
                            <span className="text-xs">Email</span>
                        </Button>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                    <p>📞 Customer Care: +91 98765 43210</p>
                    <p>⏰ Support Hours: 8 AM - 8 PM (Mon-Sat)</p>
                    <p>📧 Email: support@srisakambari.com</p>
                </div>
            </CardContent>
        </Card>
    );
}
