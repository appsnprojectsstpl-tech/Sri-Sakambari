'use client';

import { useState } from 'react';
import { useAuth, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function LoginPage() {
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        if (!auth || !firestore) {
            setError("Authentication service not initialized.");
            setLoading(false);
            return;
        }

        try {
            let loginEmail = email;

            // Check if input looks like an email (contains @)
            if (!email.includes('@')) {
                // Assume it's a name, lookup user in Firestore
                const usersRef = collection(firestore, 'users');
                const q = query(usersRef, where('name', '==', email));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setError("No account found with that name. Please check your name or use email.");
                    setLoading(false);
                    return;
                }

                if (querySnapshot.size > 1) {
                    setError("Multiple accounts found with this name. Please use your email to login.");
                    setLoading(false);
                    return;
                }

                // Get the user's authEmail from Firestore
                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data();

                // Use the authEmail that was stored during signup
                if (userData.authEmail) {
                    loginEmail = userData.authEmail;
                } else {
                    // Fallback for old users without authEmail field
                    setError("This account was created before name-based login. Please use your email.");
                    setLoading(false);
                    return;
                }
            }

            await signInWithEmailAndPassword(auth, loginEmail, password);
            toast({ title: "Welcome Back!", description: "Logged in successfully." });
            router.push('/dashboard');
        } catch (err: any) {
            console.error("Login Error:", err);
            // Improving error messages for better UX
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError("Invalid email/name or password.");
            } else if (err.code === 'auth/too-many-requests') {
                setError("Too many failed attempts. Please try again later.");
            } else {
                setError(err.message || "Login failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
            <Card className="w-full max-w-md border-2 border-primary/20 shadow-xl overflow-hidden">
                <CardHeader className="space-y-1 bg-primary/5 pb-6">
                    <CardTitle className="text-2xl font-extrabold text-primary text-center">
                        Welcome Back
                    </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 pt-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="font-bold">Name or Email</Label>
                            <Input
                                id="email"
                                type="text"
                                placeholder="Your Name or email@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="font-bold">Password</Label>
                                {/* Optional: Add Forgot Password link here later */}
                            </div>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <Button className="w-full font-bold text-lg h-12" type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Login
                        </Button>

                        <div className="text-center pt-2">
                            <span className="text-sm text-gray-500">Don't have an account? </span>
                            <Link href="/signup" className="text-sm font-bold text-primary hover:underline">
                                Sign Up
                            </Link>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center pb-6">
                    <Link href="/home" className="text-sm font-bold text-muted-foreground hover:text-primary">
                        Skip Login & Browse
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
