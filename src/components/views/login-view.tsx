'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from 'next/navigation';

export default function LoginView() {
  const router = useRouter();

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold font-headline tracking-tight text-foreground sm:text-4xl">
          Welcome to Sri Sakambari Devi Vegetable Market
        </h2>
        <p className="mt-4 text-lg leading-6 text-muted-foreground uppercase text-center tracking-wider">
          quality and supply is our prime motive
        </p>
      </div>
      <Card className="mt-12 max-w-sm mx-auto">
        <CardHeader className="text-center">
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Login or create an account to start shopping.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
            <Button asChild size="lg" onClick={() => router.push('/login')}>
                <Link href="/login">Login</Link>
            </Button>
            <Button asChild variant="outline" size="lg" onClick={() => router.push('/signup')}>
                <Link href="/signup">Create Account</Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
