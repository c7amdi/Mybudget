
"use client";
import React from "react";
import Link from 'next/link';
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { PlusCircle, Calendar as CalendarIcon, Edit, Trash2, Wallet, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import type { RecurringTransaction as RecurringTransactionType, Category, Account } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, Timestamp, runTransaction } from "firebase/firestore";
import { useTranslation } from '@/hooks/use-translation';
import { Checkbox } from "@/components/ui/checkbox";
import { getCurrencySymbol } from "@/lib/currencies";

const recurringTransactionSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.preprocess(
    (a) => parseFloat(String(a)),
    z.number().positive("Amount must be a positive number")
  ),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
  frequency: z.enum(["monthly", "quarterly", "semi-annually", "yearly"]),
  startDate: z.date(),
  endDate: z.date().optional().nullable(),
  noEndDate: z.boolean().optional(),
}).refine(data => {
    if (!data.noEndDate && data.endDate && data.startDate > data.endDate) {
        return false;
    }
    return true;
}, {
    message: "End date cannot be before start date",
    path: ["endDate"],
});


type RecurringTransactionFormValues = z.infer<typeof recurringTransactionSchema>;

function RecurringTransactionForm({
  transaction,
  onSave,
  onClose,
  categories,
  accounts,
}: {
  transaction?: RecurringTransactionType & { category?: Category; account?: Account };
  onSave: (transaction: RecurringTransactionFormValues) => void;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
}) {
  const { t } = useTranslation();
  const form = useForm<RecurringTransactionFormValues>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: transaction
      ? {
          ...transaction,
          startDate: (transaction.startDate as any)?.toDate ? (transaction.startDate as any).toDate() : new Date(),
          endDate: (transaction.endDate as any)?.toDate ? (transaction.endDate as any).toDate() : null,
          noEndDate: !transaction.endDate,
        }
      : {
          description: "",
          amount: 0,
          type: "expense",
          categoryId: "",
          accountId: "",
          frequency: "monthly",
          startDate: new Date(),
          endDate: null,
          noEndDate: true,
        },
  });

  const onSubmit = (values: RecurringTransactionFormValues) => {
    onSave(values);
    onClose();
  };
  
  const noEndDate = form.watch("noEndDate");

  const transactionType = form.watch("type");
  
  const hierarchicalCategories = useMemo(() => {
    const filteredCategories = categories.filter((c) => c.type === transactionType);
    const categoryMap = new Map(filteredCategories.map(c => [c.id, { ...c, subcategories: [] as Category[] }]));
    
    const rootCategories: (Category & { subcategories: Category[] })[] = [];

    categoryMap.forEach(cat => {
      if (cat.parent) {
        const parentInMap = Array.from(categoryMap.values()).find(c => c.name === cat.parent);
        if (parentInMap) {
          const parent = categoryMap.get(parentInMap.id);
           if (parent && !parent.subcategories.some(sub => sub.id === cat.id)) {
             parent.subcategories.push(cat);
           }
        }
      } else {
        rootCategories.push(cat);
      }
    });
    
    return rootCategories;
  }, [categories, transactionType]);


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('recurring.form.description')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('recurring.form.descriptionPlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('recurring.form.amount')}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder={t('recurring.form.amountPlaceholder')} {...field} />
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
                <FormLabel>{t('recurring.form.type')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('recurring.form.typePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="income">{t('categories.types.income')}</SelectItem>
                    <SelectItem value="expense">{t('categories.types.expense')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('recurring.form.category')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('recurring.form.categoryPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {hierarchicalCategories.map((c) => (
                      <SelectGroup key={c.id}>
                        <SelectItem value={c.id}>
                          {c.name}
                        </SelectItem>
                        {c.subcategories && c.subcategories.map(sub => (
                          <SelectItem key={sub.id} value={sub.id} className="pl-6">
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="accountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('recurring.form.account')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('recurring.form.accountPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({getCurrencySymbol(a.currency)} {a.balance.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="space-y-4 rounded-md border p-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('recurring.form.frequency')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('recurring.form.frequencyPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">{t('recurring.frequencies.monthly')}</SelectItem>
                        <SelectItem value="quarterly">{t('recurring.frequencies.quarterly')}</SelectItem>
                        <SelectItem value="semi-annually">{t('recurring.frequencies.semi-annually')}</SelectItem>
                        <SelectItem value="yearly">{t('recurring.frequencies.yearly')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('recurring.form.startDate')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t('recurring.form.pickDate')}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                      <FormItem className="flex flex-col">
                      <FormLabel>{t('recurring.form.endDate')}</FormLabel>
                      <Popover>
                          <PopoverTrigger asChild>
                          <FormControl>
                              <Button
                              variant={"outline"}
                              className={cn(
                                  "w-[240px] pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                  noEndDate && "disabled:opacity-50"
                              )}
                              disabled={noEndDate}
                              >
                              {field.value ? (
                                  format(field.value, "PPP")
                              ) : (
                                  <span>{t('recurring.form.pickDate')}</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                          </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={field.onChange}
                              initialFocus
                          />
                          </PopoverContent>
                      </Popover>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
              <FormField
                control={form.control}
                name="noEndDate"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if(checked) {
                              form.setValue("endDate", null);
                          }
                        }}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        {t('recurring.form.noEndDate')}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>
        </div>
       
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

type SortKey = "description" | "category" | "account" | "frequency" | "nextDueDate" | "amount" | "type";
type SortDirection = "asc" | "desc";

export default function RecurringPage() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  
  const recurringTransactionsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "recurring_transactions"),
    [user, firestore]
  );
  const categoriesCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "categories"),
    [user, firestore]
  );
  const accountsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "accounts"),
    [user, firestore]
  );

  const { data: recurringTransactionsData } = useCollection<RecurringTransactionType>(recurringTransactionsCollectionRef);
  const { data: categoriesData } = useCollection<Category>(categoriesCollectionRef);
  const { data: accountsData } = useCollection<Account>(accountsCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'nextDueDate', direction: 'asc' });

  const [editingTransaction, setEditingTransaction] = useState<
    (RecurringTransactionType & { category?: Category; account?: Account }) | undefined
  >(undefined);
  
  const sortedRecurringTransactions = useMemo(() => {
    if (!recurringTransactionsData || !categoriesData || !accountsData) return [];
    
    const categoryMap = new Map(categoriesData.map(c => [c.id, c]));
    const accountMap = new Map(accountsData.map(a => [a.id, a]));

    const allRecurringTransactions = recurringTransactionsData.map(rt => ({
      ...rt,
      startDate: (rt.startDate as any).toDate(), 
      endDate: rt.endDate ? (rt.endDate as any).toDate() : null,
      nextDueDate: (rt.nextDueDate as any).toDate(),
      category: categoryMap.get(rt.categoryId),
      account: accountMap.get(rt.accountId),
    }));

    return [...allRecurringTransactions].sort((a, b) => {
        let valA: any;
        let valB: any;

        switch(sortConfig.key) {
            case 'category':
                valA = a.category?.name || '';
                valB = b.category?.name || '';
                break;
            case 'account':
                valA = a.account?.name || '';
                valB = b.account?.name || '';
                break;
            default:
                valA = a[sortConfig.key];
                valB = b[sortConfig.key];
        }

        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }
        
        return sortConfig.direction === "asc" ? comparison : -comparison;
    });

  }, [recurringTransactionsData, categoriesData, accountsData, sortConfig]);


  const handleSaveTransaction = async (
    transactionData: RecurringTransactionFormValues,
  ) => {
    if (!firestore || !user) return;
  
    const { id, startDate, endDate, noEndDate, ...dataToSave } = transactionData;
    const isEditing = !!id;

    const recurringData = {
        ...dataToSave,
        startDate: Timestamp.fromDate(startDate),
        endDate: noEndDate ? null : Timestamp.fromDate(endDate!),
        nextDueDate: Timestamp.fromDate(startDate), // Or more complex logic
        isActive: true
    };
    
    const docRef = isEditing
        ? doc(firestore, "users", user.uid, "recurring_transactions", id)
        : doc(collection(firestore, "users", user.uid, "recurring_transactions"));

    try {
        await runTransaction(firestore, async (transaction) => {
            transaction.set(docRef, recurringData, { merge: isEditing });
        });
    } catch (error) {
        console.error("Failed to save recurring transaction: ", error);
    }
  };
  
  const handleDeleteTransaction = async (transactionToDelete: RecurringTransactionType) => {
    if (!firestore || !user || !transactionToDelete.id) return;
  
    try {
        await runTransaction(firestore, async (transaction) => {
            const transactionRef = doc(firestore, "users", user.uid, "recurring_transactions", transactionToDelete.id);
            transaction.delete(transactionRef);
        });
    } catch (e) {
        console.error("Error deleting transaction: ", e);
    }
  };
  
  const handleEditClick = (transactionId: string) => {
    const transaction = sortedRecurringTransactions.find(t => t.id === transactionId);
    if(transaction) {
      setEditingTransaction(transaction as any);
      setIsFormOpen(true);
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => {
        if (prev.key === key) {
            return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { key, direction: 'asc' };
    });
  };

  const SortableHeader = ({ sortKey, children, className }: { sortKey: SortKey, children: React.ReactNode, className?: string }) => (
    <TableHead onClick={() => handleSort(sortKey)} className={cn("cursor-pointer", className)}>
      <div className="flex items-center gap-2">
        {children}
        {sortConfig.key === sortKey && <ArrowUpDown className="h-4 w-4" />}
      </div>
    </TableHead>
  );


  if (!accountsData || accountsData.length === 0) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title={t('recurring.title')} />
            <Card className="flex flex-col items-center justify-center py-20 text-center">
              <CardHeader>
                  <div className="mx-auto bg-secondary p-3 rounded-full">
                      <Wallet className="h-12 w-12 text-muted-foreground" />
                  </div>
                <CardTitle className="mt-4">Create a recurring transaction to start</CardTitle>
                <CardDescription>You need an account to create a recurring transaction. Add an account first.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/accounts">
                    <PlusCircle />
                    Add Account
                  </Link>
                </Button>
              </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <>
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingTransaction(undefined);
        }}
      >
        <DialogContent className="flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? t('recurring.edit') : t('recurring.add')}
            </DialogTitle>
          </DialogHeader>
          {isFormOpen && (
            <RecurringTransactionForm
              transaction={editingTransaction}
              onSave={handleSaveTransaction}
              onClose={() => setIsFormOpen(false)}
              categories={categoriesData || []}
              accounts={accountsData || []}
            />
          )}
        </DialogContent>
      </Dialog>
      
      <div className="flex flex-col gap-6">
        <PageHeader title={t('recurring.title')}>
          <Button onClick={() => { setEditingTransaction(undefined); setIsFormOpen(true); }}>
            <PlusCircle />
            {t('recurring.add')}
          </Button>
        </PageHeader>
        <Card>
          <CardHeader>
              <CardTitle className="font-headline">{t('recurring.cardTitle')}</CardTitle>
              <CardDescription>
                {t('recurring.cardDescription')}
              </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                    <SortableHeader sortKey="description">{t('recurring.table.description')}</SortableHeader>
                    <SortableHeader sortKey="category">{t('recurring.table.category')}</SortableHeader>
                    <SortableHeader sortKey="account">{t('recurring.table.account')}</SortableHeader>
                    <SortableHeader sortKey="frequency">{t('recurring.table.frequency')}</SortableHeader>
                    <SortableHeader sortKey="nextDueDate">{t('recurring.table.nextDueDate')}</SortableHeader>
                    <SortableHeader sortKey="amount" className="text-right">{t('recurring.table.amount')}</SortableHeader>
                    <TableHead className="text-right">
                        {t('recurring.table.actions')}
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedRecurringTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                        {transaction.description}
                        </TableCell>
                        <TableCell>
                        {transaction.category && <Badge variant="outline">{transaction.category.name}</Badge>}
                        </TableCell>
                        <TableCell>
                        {transaction.account?.name}
                        </TableCell>
                        <TableCell className="capitalize">
                         {t(`recurring.frequencies.${transaction.frequency}`)}
                        </TableCell>
                        <TableCell>
                         {format(transaction.nextDueDate, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell
                        className={cn(
                            "text-right",
                            transaction.type === "income"
                            ? "text-green-500"
                            : "text-red-500"
                        )}
                        >
                        {transaction.type === "income" ? "+" : "-"} {transaction.account ? getCurrencySymbol(transaction.account.currency) : '$'}{' '}
                        {transaction.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="flex justify-end gap-2">
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleEditClick(transaction.id)}
                            >
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">{t('categories.actions.edit')}</span>
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-500 hover:text-red-500"
                                onClick={() => handleDeleteTransaction(transaction as RecurringTransactionType)}
                            >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">{t('categories.actions.delete')}</span>
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
