'use client';

import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Role } from '@/lib/types'; // Assuming Role is exported from types
import {
    MoreHorizontal,
    MapPin,
    Mail,
    Phone,
    Search,
    Shield,
    Truck,
    User as UserIcon,
    PlusCircle,
    FilePen,
    Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore, createUser } from '@/firebase'; // Import createUser action
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface UsersTabProps {
    users: User[];
    loading: boolean;
    onUpdate?: () => void; // Callback to refresh data if needed
}

export default function UsersTab({
    users,
    loading,
    onUpdate
}: UsersTabProps) {
    const { toast } = useToast();
    const auth = useAuth();
    const firestore = useFirestore();

    // Local Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'delivery' | 'customer'>('all');

    // Dialog State
    const [isUserDialogOpen, setUserDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form State for Add/Edit
    const initialUserState = {
        name: '',
        email: '',
        phone: '',
        role: 'customer' as Role, // Default role
        address: '',
        area: '',
        pincode: '',
        password: '' // Only for new users
    };
    const [formData, setFormData] = useState(initialUserState);

    // Derived Data
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.phone.includes(searchTerm);

        const matchesRole =
            roleFilter === 'all' ? true :
                roleFilter === 'admin' ? (user.role === 'admin' || user.role === 'restricted_admin') :
                    user.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    // Handlers
    const handleAddNewUser = () => {
        setEditingUser(null);
        setFormData(initialUserState);
        setUserDialogOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser(user);
        setFormData({
            ...initialUserState,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            address: user.address || '',
            area: user.area || '',
            pincode: user.pincode || '',
        });
        setUserDialogOpen(true);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            if (editingUser) {
                // Update existing user
                if (!firestore) throw new Error("Firestore not initialized");

                await updateDoc(doc(firestore, 'users', editingUser.id), {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    role: formData.role,
                    address: formData.address,
                    area: formData.area,
                    pincode: formData.pincode,
                });

                toast({ title: "User Updated", description: `${formData.name} has been updated.` });
            } else {
                // Create new user (Requires server action or API call usually for Auth)
                // Using the server action 'createUser' imported from firebase
                if (!auth || !firestore) throw new Error("Auth or Firestore not initialized");

                await createUser(auth, firestore, {
                    email: formData.email,
                    password: formData.password,
                    name: formData.name,
                    phone: formData.phone,
                    role: formData.role,
                    address: formData.address,
                    area: formData.area,
                    pincode: formData.pincode
                });

                // if (result.error) throw new Error(result.error);

                toast({ title: "User Created", description: `${formData.name} has been added.` });
            }
            setUserDialogOpen(false);
            if (onUpdate) onUpdate();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Operation Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin': return <Badge variant="default">Super Admin</Badge>;
            case 'restricted_admin': return <Badge variant="secondary">Admin</Badge>;
            case 'delivery': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">Delivery</Badge>;
            default: return <Badge variant="outline">Customer</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card p-4 rounded-lg shadow-sm border">
                <div className="flex flex-1 gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-[300px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email, phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>

                    <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="admin">Admins</SelectItem>
                            <SelectItem value="delivery">Delivery Staff</SelectItem>
                            <SelectItem value="customer">Customers</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Button onClick={handleAddNewUser}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add User
                </Button>
            </div>

            {/* Users Table */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>User</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">Loading users...</TableCell>
                            </TableRow>
                        ) : filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No users found matching filters.</TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id} className="group">
                                    <TableCell>
                                        <div className="font-medium">{user.name}</div>
                                        {/* Mobile view email fallback */}
                                        <div className="md:hidden text-xs text-muted-foreground">{user.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col text-sm">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Mail className="h-3.5 w-3.5" /> {user.email}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Phone className="h-3.5 w-3.5" /> {user.phone}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getRoleBadge(user.role)}
                                    </TableCell>
                                    <TableCell>
                                        {user.area ? (
                                            <div className="flex items-center gap-1.5 text-sm">
                                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                {user.area}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                                            <FilePen className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <div className="p-4 border-t text-sm text-muted-foreground">
                    Showing {filteredUsers.length} users
                </div>
            </div>

            {/* Add/Edit User Dialog */}
            <Dialog open={isUserDialogOpen} onOpenChange={setUserDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
                        <DialogDescription>
                            {editingUser ? 'Update user details and permissions.' : 'Add a new user to the system. They will receive an email for verification.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSaveUser} className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(v: Role) => setFormData({ ...formData, role: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="customer">Customer</SelectItem>
                                        <SelectItem value="delivery">Delivery Staff</SelectItem>
                                        <SelectItem value="admin">Super Admin</SelectItem>
                                        <SelectItem value="restricted_admin">Restricted Admin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    disabled={!!editingUser} // Prevent email change for now as it's the auth ID
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        {!editingUser && (
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingUser}
                                    minLength={6}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="area">Area</Label>
                                {/* You might want to make this a Select dynamically populated from Orders/Config if available */}
                                <Input
                                    id="area"
                                    value={formData.area}
                                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pincode">Pincode</Label>
                                <Input
                                    id="pincode"
                                    value={formData.pincode}
                                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                />
                            </div>
                        </div>

                        <DialogFooter className="mt-6">
                            <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingUser ? 'Update User' : 'Create User'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
