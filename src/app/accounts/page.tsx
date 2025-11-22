
"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, PlusCircle, Edit, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Account as AccountType } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Landmark, CreditCard, Wallet, LucideIcon } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  setDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { allCurrencies, getCurrencySymbol } from "@/lib/currencies";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';
import { ScrollArea } from "@/components/ui/scroll-area";
import { convertToTND, getBaseCurrency } from "@/lib/exchange-rates";


const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["Bank", "Credit Card", "Cash"]),
  balance: z.preprocess(
    (a) => parseFloat(String(a)),
    z.number()
  ),
  currency: z.string().min(1, "Currency is required"),
});

type AccountFormValues = z.infer<typeof accountSchema>;

function AccountForm({
  account,
  onSave,
  onClose,
}: {
  account?: AccountType;
  onSave: (data: AccountFormValues, accountId?: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: account || {
      name: "",
      type: "Bank",
      balance: 0,
      currency: "USD",
    },
  });

  const onSubmit = (values: AccountFormValues) => {
    onSave(values, account ? account.id : undefined);
    onClose();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4 pr-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('accounts.form.name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('accounts.form.namePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('accounts.form.type')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('accounts.form.typePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Bank">{t('accounts.types.Bank')}</SelectItem>
                    <SelectItem value="Credit Card">{t('accounts.types.Credit Card')}</SelectItem>
                    <SelectItem value="Cash">{t('accounts.types.Cash')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="balance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('accounts.form.balance')}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder={t('accounts.form.balancePlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('accounts.form.currency')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allCurrencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.name} ({currency.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="submit">{t('common.save')}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

const accountIcons: Record<AccountType["type"], LucideIcon> = {
  Bank: Landmark,
  "Credit Card": CreditCard,
  Cash: Wallet,
};

export default function AccountsPage() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const baseCurrency = getBaseCurrency();

  const accountsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "accounts"),
    [user, firestore]
  );
  
  const { data: accountsData } = useCollection<AccountType>(accountsCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountType | undefined>(
    undefined
  );

  const accounts = useMemo(() => {
    return (accountsData || []).map(acc => ({
      ...acc,
      icon: accountIcons[acc.type]
    }));
  }, [accountsData]);


  const handleSaveAccount = (data: AccountFormValues, accountId?: string) => {
    if (!accountsCollectionRef) return;
  
    if (accountId) {
      // Editing existing account
      const docRef = doc(accountsCollectionRef, accountId);
      setDocumentNonBlocking(docRef, data, { merge: true });
    } else {
      // Adding new account
      addDocumentNonBlocking(accountsCollectionRef, data);
    }
  };

  const handleDeleteAccount = (accountId: string) => {
    if (!accountsCollectionRef) return;
    const docRef = doc(accountsCollectionRef, accountId);
    deleteDocumentNonBlocking(docRef);
  };

  return (
    <div className="flex flex-col gap-6">
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingAccount(undefined);
        }}
      >
        <PageHeader title={t('accounts.title')}>
          <DialogTrigger asChild>
             <Button onClick={() => { setEditingAccount(undefined); setIsFormOpen(true); }}>
              <PlusCircle />
              {t('accounts.addAccount')}
            </Button>
          </DialogTrigger>
        </PageHeader>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="flex flex-col group/card hover:bg-muted/50 transition-colors">
              <Link href={`/accounts/${account.id}`} className="flex flex-col flex-1 p-6 pb-2">
                <CardHeader className="flex flex-row items-center gap-4 p-0">
                  <account.icon className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <CardTitle className="font-headline">
                      {account.name}
                    </CardTitle>
                    <CardDescription>{t(`accounts.types.${account.type}`)}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 mt-6">
                  <div className="text-3xl font-bold font-headline">
                    {getCurrencySymbol(account.currency)} {account.balance.toLocaleString()}
                  </div>
                   {account.currency !== baseCurrency && (
                        <p className="text-xs text-muted-foreground">
                            ~ {getCurrencySymbol(baseCurrency)}{' '}
                            {convertToTND(account.balance, account.currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    )}
                </CardContent>
              </Link>
                <CardFooter className="flex items-center justify-between p-6 pt-2">
                  <p className="text-xs text-muted-foreground">
                    {t('accounts.currencyLabel')}: {account.currency}
                  </p>
                  <div className="flex items-center gap-2">
                     <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingAccount(account);
                          setIsFormOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-500"
                        onClick={() => handleDeleteAccount(account.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                  </div>
                </CardFooter>
            </Card>
          ))}
        </div>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? t('accounts.editAccount') : t('accounts.addAccount')}
            </DialogTitle>
          </DialogHeader>
          <AccountForm
            account={editingAccount}
            onSave={handleSaveAccount}
            onClose={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
