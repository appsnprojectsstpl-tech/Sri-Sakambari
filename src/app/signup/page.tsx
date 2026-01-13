'use client';

import { useState } from 'react';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { createUser } from '@/firebase'; // Helper function
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { User as UserIcon } from 'lucide-react';
import { Mail } from 'lucide-react';
import { Lock } from 'lucide-react';
import { Phone } from 'lucide-react';
import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Area } from '@/lib/types';

export default function SignupPage() {
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { data: areas } = useCollection<Area>('areas');

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        address: '',
        area: '',
        pincode: ''
    });

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!auth || !firestore) {
            setError("Service unavailable. Please try again.");
            return;
        }

        // 1. Validation
        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (formData.password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (!formData.name || !formData.address || !formData.area) {
            setError("Please fill in all required fields (Name, Address, Area).");
            return;
        }

        setLoading(true);

        try {
            // 2. Create User (Atomic Auth + Firestore)
            await createUser(auth, firestore, {
                email: formData.email || undefined, // Pass undefined if empty so it can be handled properly
                password: formData.password,
                name: formData.name,
                phone: formData.phone || '',
                address: formData.address,
                area: formData.area,
                pincode: formData.pincode || '',
                landmark: '', // Default to empty string
                role: 'customer'
            });

            // 3. Success
            localStorage.setItem('loginTimestamp', Date.now().toString());
            toast({ title: "Account Created!", description: "Welcome to Sakambari Market." });
            router.push('/dashboard');

        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                setError("This email is already registered. Please Login.");
            } else {
                setError(err.message || "Failed to create account.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4 py-8">
            <Card className="w-full max-w-md border-2 border-primary/20 shadow-xl overflow-hidden">
                <CardHeader className="bg-primary/5 pb-6">
                    <CardTitle className="text-2xl font-extrabold text-primary text-center">
                        Create Account
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 pt-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSignup} className="space-y-4">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name *</Label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input id="name" className="pl-9" placeholder="John Doe" required
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address (Optional)</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input id="email" type="email" className="pl-9" placeholder="you@example.com"
                                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                        </div>

                        {/* Password Group */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password *</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input id="password" type="password" className="pl-9" placeholder="******" required
                                        value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm">Confirm *</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input id="confirm" type="password" className="pl-9" placeholder="******" required
                                        value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* Contact & Area */}
                        <div className="space-y-2">
                            <Label htmlFor="phone">Mobile (Optional)</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input id="phone" type="tel" className="pl-9" placeholder="+91 9876543210"
                                    value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="area">Delivery Area *</Label>
                            <Select required onValueChange={(val) => setFormData({ ...formData, area: val })} value={formData.area}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Area" />
                                </SelectTrigger>
                                <SelectContent>
                                    {areas?.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Address */}
                        <div className="space-y-2">
                            <Label htmlFor="address">Full Address *</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input id="address" className="pl-9" placeholder="House No, Street, Landmark" required
                                    value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pincode">Pincode *</Label>
                            <Input id="pincode" placeholder="500001" required
                                value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} />
                        </div>


                        <Button className="w-full font-bold text-lg h-12 mt-4" type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="flex justify-center pb-6 border-t pt-4 bg-gray-50">
                    <p className="text-sm font-medium text-gray-600">
                        Already have an account?{' '}
                        <Link href="/login" className="font-bold text-primary hover:underline">
                            Login here
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
