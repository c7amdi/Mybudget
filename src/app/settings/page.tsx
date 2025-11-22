
"use client";

import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { allCurrencies } from "@/lib/currencies";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from '@/hooks/use-translation';
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Laptop, Download, Upload, LogOut, X, FileJson, Loader2, User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, useFirestore, useCollection, useMemoFirebase, useFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Currency, Transaction, Account, Category, RecurringTransaction, Budget } from "@/lib/types";
import { useMemo, useState, useRef } from "react";
import { exportDataToJson, importDataFromJson } from "@/lib/csv";
import { useToast } from "@/hooks/use-toast";
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, updateProfile } from "firebase/auth";
import { useRouter } from 'next/navigation';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";
import Image from 'next/image';

const passwordSchema = z.object({
    currentPassword: z.string().min(6, "Current password is required."),
    newPassword: z.string().min(6, "New password must be at least 6 characters."),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match.",
    path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

function PasswordForm({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const { user } = useFirebase();
    const { toast } = useToast();
    const form = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
    });

    const onSubmit = async (values: PasswordFormValues) => {
        if (!user || !user.email) {
            toast({ variant: "destructive", title: "Error", description: "You must be logged in to change your password." });
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, values.newPassword);
            toast({ title: "Success", description: "Your password has been updated." });
            onClose();
        } catch (error: any) {
            console.error("Password change failed:", error);
            if (error.code === 'auth/invalid-credential') {
                 toast({ variant: "destructive", title: "Password Change Failed", description: "The current password you entered is incorrect. Please try again." });
            } else {
                toast({ variant: "destructive", title: "Password Change Failed", description: error.message });
            }
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Current Password</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">{t('common.cancel')}</Button></DialogClose>
                    <Button type="submit">Change Password</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

function ThemeSelector() {
    const { setTheme, theme } = useTheme();

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg bg-muted p-1">
            <Button
              variant={theme === "light" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTheme("light")}
            >
              <Sun className="mr-2 h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTheme("dark")}
            >
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === "system" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTheme("system")}
            >
              <Laptop className="mr-2 h-4 w-4" />
              System
            </Button>
          </div>
    )
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, auth } = useFirebase();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const jsonImportInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const presetAvatars = PlaceHolderImages.filter(img => img.id.startsWith('preset-avatar'));


  const currenciesCollectionRef = useMemoFirebase(() => user ? collection(firestore, "currencies") : null, [user, firestore]);
  const transactionsCollectionRef = useMemoFirebase(() => user && collection(firestore, `users/${user.uid}/transactions`), [user, firestore]);
  const accountsCollectionRef = useMemoFirebase(() => user && collection(firestore, `users/${user.uid}/accounts`), [user, firestore]);
  const categoriesCollectionRef = useMemoFirebase(() => user && collection(firestore, `users/${user.uid}/categories`), [user, firestore]);
  const recurringTransactionsCollectionRef = useMemoFirebase(() => user && collection(firestore, `users/${user.uid}/recurring_transactions`), [user, firestore]);
  const budgetsCollectionRef = useMemoFirebase(() => user && collection(firestore, `users/${user.uid}/budgets`), [user, firestore]);

  const { data: currenciesData } = useCollection<Currency>(currenciesCollectionRef);
  const { data: transactionsData } = useCollection<Transaction>(transactionsCollectionRef);
  const { data: accountsData } = useCollection<Account>(accountsCollectionRef);
  const { data: categoriesData } = useCollection<Category>(categoriesCollectionRef);
  const { data: recurringTransactionsData } = useCollection<RecurringTransaction>(recurringTransactionsCollectionRef);
  const { data: budgetsData } = useCollection<Budget>(budgetsCollectionRef);


  const mergedCurrencies = useMemo(() => {
    const dbCurrencies = currenciesData || [];
    const dbCodes = new Set(dbCurrencies.map(c => c.code));
    const staticFiltered = allCurrencies.filter(sc => !dbCodes.has(sc.code));
    return [...dbCurrencies, ...staticFiltered].sort((a,b) => a.name.localeCompare(b.name));
  }, [currenciesData]);
  
  const handleExport = async () => {
    const allData = {
      accounts: accountsData || [],
      categories: categoriesData || [],
      transactions: transactionsData || [],
      recurringTransactions: recurringTransactionsData || [],
      budgets: budgetsData || [],
    };
    
    if (Object.values(allData).every(arr => arr.length === 0)) {
       toast({
          variant: "destructive",
          title: "Export Failed",
          description: "No data available to export.",
        });
      return;
    };
    
    try {
        exportDataToJson(allData);
        toast({
          title: "Export Successful",
          description: "Your data has been exported to budgetwise_data.json.",
        });
    } catch (error) {
        console.error("Export failed:", error);
        toast({
          variant: "destructive",
          title: "Export Failed",
          description: "Could not export your data. Please try again.",
        });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.json')) {
        setSelectedFile(file);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please upload a .json file.",
        });
        setSelectedFile(null);
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
        toast({
            variant: "destructive",
            title: "No File Selected",
            description: "Please select a JSON file to import.",
        });
        return;
    }
    if (!firestore || !user) return;

    setIsImporting(true);
    try {
      await importDataFromJson(selectedFile, firestore, user.uid);
      toast({
        title: "Import Successful",
        description: "Your data has been imported successfully. Please refresh the page to see the changes.",
      });
    } catch (error: any) {
      console.error("Import failed:", error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "An unexpected error occurred during import.",
      });
    } finally {
        // Clear the selection and reset loading state
        setIsImporting(false);
        setSelectedFile(null);
        if(jsonImportInputRef.current) {
            jsonImportInputRef.current.value = "";
        }
    }
  };
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Sign out failed:", error);
      toast({ variant: "destructive", title: "Sign Out Failed", description: "Could not sign you out. Please try again." });
    }
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    if(jsonImportInputRef.current) {
        jsonImportInputRef.current.value = "";
    }
  }

  const handleAvatarUpdate = async (imageUrl: string) => {
    if (!user) return;
    setIsUploading(true);
    try {
      await updateProfile(user, { photoURL: imageUrl });
      toast({ title: "Success", description: "Your avatar has been updated." });
      setIsAvatarDialogOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('settings.title')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
              <CardHeader>
                  <CardTitle className="font-headline">User Profile</CardTitle>
                  <CardDescription>Manage your account settings and password.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                      <DialogTrigger asChild>
                        <button className="relative group rounded-full" disabled={isUploading}>
                          <Avatar className="h-20 w-20">
                            <AvatarImage src={user?.photoURL || undefined} alt="User avatar" />
                            <AvatarFallback>
                              {isUploading ? <Loader2 className="h-10 w-10 animate-spin" /> : <UserIcon className="h-10 w-10" />}
                            </AvatarFallback>
                          </Avatar>
                           <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-white text-xs text-center">Change</p>
                           </div>
                        </button>
                      </DialogTrigger>
                       <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                          <DialogTitle>Choose Your Avatar</DialogTitle>
                          <DialogDescription>
                            Select one of the preset avatars below to update your profile picture.
                          </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh]">
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 p-4 pr-6">
                            {presetAvatars.map(avatar => (
                                <button 
                                    key={avatar.id}
                                    className={cn(
                                        "rounded-full aspect-square relative overflow-hidden ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                                        user?.photoURL === avatar.imageUrl && "ring-2 ring-primary"
                                    )}
                                    onClick={() => handleAvatarUpdate(avatar.imageUrl)}
                                    disabled={isUploading}
                                >
                                    <Image 
                                        src={avatar.imageUrl}
                                        alt={avatar.description}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 33vw, 25vw"
                                    />
                                    {isUploading && user?.photoURL !== avatar.imageUrl && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                            </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>

                    <div className="space-y-1">
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-muted-foreground">{user?.email || 'No email associated'}</p>
                    </div>
                  </div>
                   <Dialog open={isPasswordFormOpen} onOpenChange={setIsPasswordFormOpen}>
                      <DialogTrigger asChild>
                          <Button variant="outline">Change Password</Button>
                      </DialogTrigger>
                      <DialogContent>
                          <DialogHeader>
                              <DialogTitle>Change Your Password</DialogTitle>
                          </DialogHeader>
                          <PasswordForm onClose={() => setIsPasswordFormOpen(false)} />
                      </DialogContent>
                  </Dialog>
              </CardContent>
              <CardFooter>
                  <Button variant="destructive" onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                  </Button>
              </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Display</CardTitle>
              <CardDescription>
                Choose how you want the application to look.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeSelector />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Export All Data</CardTitle>
              <CardDescription>Download a JSON file of all your data (accounts, transactions, budgets, etc.).</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export Data (JSON)
              </Button>
            </CardContent>
          </Card>
          <Card>
              <CardHeader>
                  <CardTitle className="font-headline">Import Data</CardTitle>
                  <CardDescription>Import from a full backup JSON file. This may overwrite existing data.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                  <input
                      type="file"
                      ref={jsonImportInputRef}
                      onChange={handleFileSelect}
                      accept=".json"
                      className="hidden"
                  />
                  {!selectedFile && (
                      <Button onClick={() => jsonImportInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" />
                          Select JSON File
                      </Button>
                  )}
                  {selectedFile && (
                      <div className="space-y-4">
                          <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                              <FileJson className="h-5 w-5 text-muted-foreground" />
                              <span className="flex-1 font-medium text-sm truncate">{selectedFile.name}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearFileSelection}>
                                  <X className="h-4 w-4"/>
                              </Button>
                          </div>
                          <Button onClick={handleImport} disabled={isImporting}>
                              {isImporting ? (
                                  <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Importing...
                                  </>
                              ) : (
                                  <>
                                      <Upload className="mr-2 h-4 w-4" />
                                      Confirm and Import Data
                                  </>
                              )}
                          </Button>
                      </div>
                  )}
              </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
              <CardTitle className="font-headline">
                  {t('settings.currenciesTitle')}
              </CardTitle>
              <CardDescription>
                  {t('settings.currenciesDescription')}
              </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full whitespace-nowrap rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('settings.table.code')}</TableHead>
                    <TableHead>{t('settings.table.name')}</TableHead>
                    <TableHead className="text-right">{t('settings.table.symbol')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mergedCurrencies.map((currency) => (
                    <TableRow key={currency.code}>
                      <TableCell className="font-medium">
                        {currency.code}
                      </TableCell>
                      <TableCell>{currency.name}</TableCell>
                      <TableCell className="text-right">{currency.symbol}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
