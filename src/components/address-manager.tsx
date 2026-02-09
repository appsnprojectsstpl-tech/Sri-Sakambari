"use client";

import { useState } from "react";
import { useUser, useFirestore, useCollection } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Address, Area, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, MapPin, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { haptics, ImpactStyle } from "@/lib/haptics";
import { v4 as uuidv4 } from "uuid";

interface AddressManagerProps {
    onSelect?: (address: Address) => void;
    selectedId?: string;
    enableSelection?: boolean;
}

export default function AddressManager({ onSelect, selectedId, enableSelection = false }: AddressManagerProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { data: areas } = useCollection<Area>("areas");

    const [isAdding, setIsAdding] = useState(false);
    const [newAddress, setNewAddress] = useState<Partial<Address>>({
        label: "Home",
        isDefault: false,
    });

    const addresses = user?.addresses || [];

    const validateAddress = (address: Partial<Address>): { isValid: boolean; errors: string[] } => {
        const errors: string[] = [];

        if (!address.label || address.label.trim().length < 2) {
            errors.push("Address label must be at least 2 characters long");
        }

        if (!address.line1 || address.line1.trim().length < 5) {
            errors.push("Address line 1 must be at least 5 characters long");
        }

        if (address.line2 && address.line2.trim().length > 100) {
            errors.push("Address line 2 must not exceed 100 characters");
        }

        if (!address.area || address.area.trim().length < 2) {
            errors.push("Area must be at least 2 characters long");
        }

        if (address.pincode) {
            const pincodeRegex = /^\d{6}$/;
            if (!pincodeRegex.test(address.pincode)) {
                errors.push("Pincode must be a valid 6-digit number");
            }
        }

        if (address.landmark && address.landmark.trim().length > 100) {
            errors.push("Landmark must not exceed 100 characters");
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    };

    const handleAddAddress = async () => {
        if (!user || !firestore) return;

        const validation = validateAddress(newAddress);
        if (!validation.isValid) {
            toast({
                title: "Validation Error",
                description: validation.errors.join(". "),
                variant: "destructive"
            });
            return;
        }

        haptics.impact(ImpactStyle.Medium);

        const addressToAdd: Address = {
            id: uuidv4(),
            label: newAddress.label || '',
            line1: newAddress.line1 || '',
            line2: newAddress.line2 || "",
            area: newAddress.area || '',
            pincode: newAddress.pincode || "",
            landmark: newAddress.landmark || "",
            isDefault: addresses.length === 0 || newAddress.isDefault, // First address is default
        };

        let updatedAddresses = [...addresses, addressToAdd];

        // If setting as default, unset others
        if (addressToAdd.isDefault) {
            updatedAddresses = updatedAddresses.map(a => ({ ...a, isDefault: a.id === addressToAdd.id }));
        }

        try {
            await updateDoc(doc(firestore, "users", user.id), {
                addresses: updatedAddresses,
                // Sync legacy fields if default
                ...(addressToAdd.isDefault ? {
                    address: `${addressToAdd.line1}, ${addressToAdd.area}`,
                    area: addressToAdd.area,
                    pincode: addressToAdd.pincode,
                } : {})
            });
            setIsAdding(false);
            setNewAddress({ label: "Home", isDefault: false });
            toast({ title: "Address Added" });
        } catch (e) {
            toast({ title: "Error", description: "Failed to add address", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!user || !firestore) return;

        const addressToDelete = addresses.find(a => a.id === id);
        if (!addressToDelete) return;

        const confirmed = window.confirm(`Are you sure you want to delete the address "${addressToDelete.label}"? This action cannot be undone.`);
        if (!confirmed) return;

        haptics.impact(ImpactStyle.Medium);

        try {
            const updatedAddresses = addresses.filter(a => a.id !== id);
            await updateDoc(doc(firestore, "users", user.id), { addresses: updatedAddresses });
            toast({ title: "Address Deleted", description: `"${addressToDelete.label}" has been deleted successfully` });
        } catch (error) {
            console.error('Error deleting address:', error);

            let errorMessage = 'Failed to delete address';
            if (error instanceof Error) {
                if (error.message.includes('permission-denied')) {
                    errorMessage = 'You do not have permission to delete this address';
                } else if (error.message.includes('not-found')) {
                    errorMessage = 'Address not found';
                } else {
                    errorMessage = error.message;
                }
            }

            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive"
            });
        }
    };

    const handleSetDefault = async (id: string) => {
        if (!user || !firestore) return;
        haptics.impact(ImpactStyle.Light);
        const target = addresses.find(a => a.id === id);
        if (!target) return;

        const updatedAddresses = addresses.map(a => ({ ...a, isDefault: a.id === id }));

        try {
            await updateDoc(doc(firestore, "users", user.id), {
                addresses: updatedAddresses,
                address: `${target.line1}, ${target.area}`,
                area: target.area,
                pincode: target.pincode,
            });
            toast({ title: "Default Address Set", description: `"${target.label}" is now your default address` });
        } catch (error) {
            console.error('Error setting default address:', error);

            let errorMessage = 'Failed to set default address';
            if (error instanceof Error) {
                if (error.message.includes('permission-denied')) {
                    errorMessage = 'You do not have permission to update this address';
                } else if (error.message.includes('not-found')) {
                    errorMessage = 'User not found';
                } else {
                    errorMessage = error.message;
                }
            }

            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive"
            });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5" /> Saved Addresses
                </h3>
                <Button size="sm" variant="outline" onClick={() => setIsAdding(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add New
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                    <Card
                        key={addr.id}
                        className={`relative cursor-pointer transition-colors ${selectedId === addr.id ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => enableSelection && onSelect?.(addr)}
                    >
                        <CardHeader className="p-4 pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    {addr.label}
                                    {addr.isDefault && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">Default</span>}
                                </CardTitle>
                                {!enableSelection && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(addr.id); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                                {enableSelection && selectedId === addr.id && (
                                    <Check className="h-5 w-5 text-primary" />
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
                            <p>{addr.line1}</p>
                            {addr.line2 && <p>{addr.line2}</p>}
                            <p>{addr.area} - {addr.pincode}</p>
                            {!enableSelection && !addr.isDefault && (
                                <Button variant="link" size="sm" className="px-0 h-auto mt-2" onClick={(e) => { e.stopPropagation(); handleSetDefault(addr.id); }}>
                                    Set as Default
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ))}
                {addresses.length === 0 && (
                    <div className="col-span-full text-center py-6 text-muted-foreground bg-muted/20 rounded-lg">
                        No saved addresses. Add one to speed up checkout!
                    </div>
                )}
            </div>

            <Dialog open={isAdding} onOpenChange={setIsAdding}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Address</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid gap-2">
                            <Label>Label</Label>
                            <Select value={newAddress.label} onValueChange={(v) => setNewAddress({ ...newAddress, label: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Home">Home</SelectItem>
                                    <SelectItem value="Work">Work</SelectItem>
                                    <SelectItem value="Parents">Parents</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Address Line 1</Label>
                            <Textarea
                                value={newAddress.line1 || ''}
                                onChange={e => setNewAddress({ ...newAddress, line1: e.target.value })}
                                placeholder="House No, Building, Street"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Area</Label>
                            <Select value={newAddress.area === 'Other' || (newAddress.area && !areas?.some(a => a.name === newAddress.area)) ? 'Other' : newAddress.area}
                                onValueChange={(v) => {
                                    if (v === 'Other') {
                                        setNewAddress({ ...newAddress, area: 'Other' });
                                    } else {
                                        setNewAddress({ ...newAddress, area: v });
                                    }
                                }}>
                                <SelectTrigger><SelectValue placeholder="Select Area" /></SelectTrigger>
                                <SelectContent>
                                    {areas?.map(area => (
                                        <SelectItem key={area.id} value={area.name}>{area.name}</SelectItem>
                                    ))}
                                    <SelectItem value="Other">Other (Custom Area)</SelectItem>
                                </SelectContent>
                            </Select>
                            {(newAddress.area === 'Other' || (newAddress.area && !areas?.some(a => a.name === newAddress.area) && newAddress.area !== '')) && (
                                <Input
                                    className="mt-2"
                                    placeholder="Enter your area name"
                                    value={newAddress.area === 'Other' ? '' : newAddress.area}
                                    onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
                                />
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label>Pincode</Label>
                            <Input
                                value={newAddress.pincode || ''}
                                onChange={e => setNewAddress({ ...newAddress, pincode: e.target.value })}
                                placeholder="5000XX"
                                type="number"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                        <Button onClick={handleAddAddress}>Save Address</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
