
"use client";

import React, { useMemo, useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  MoreHorizontal,
  PlusCircle,
  Calendar as CalendarIcon,
  ArrowRightLeft,
  ArrowUpDown,
  Edit,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';
import type {
  Transaction as TransactionType,
  Category,
  Account,
} from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useForm } from "react-hook-form";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from "@/firebase";
import {
  collection,
  doc,
  Timestamp,
  runTransaction,
} from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { useTranslation } from '@/hooks/use-translation';
import { getCurrencySymbol } from "@/lib/currencies";
import { ScrollArea } from "@/components/ui/scroll-area";

const transactionSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  amount: z.preprocess(
    (a) => parseFloat(String(a)),
    z.number().positive("Amount must be a positive number")
  ),
  type: z.enum(["income", "expense"]),
  date: z.date(),
  categoryId: z.string().min(1, "Category is required"),
  accountId: z.string().min(1, "Account is required"),
  isRecurring: z.boolean().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, "Source account is required"),
    toAccountId: z.string().min(1, "Destination account is required"),
    amount: z.preprocess(
      (a) => parseFloat(String(a)),
      z.number().positive("Amount must be a positive number")
    ),
    date: z.date(),
    description: z.string().optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Source and destination accounts cannot be the same",
    path: ["toAccountId"],
  });

type TransferFormValues = z.infer<typeof transferSchema>;

function TransactionForm({
  transaction,
  onSave,
  onClose,
  categories,
  accounts,
}: {
  transaction?: TransactionType & { category?: Category; account?: Account };
  onSave: (
    transaction: TransactionFormValues,
    originalTransaction?: TransactionType
  ) => void;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
}) {
  const { t } = useTranslation();
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: transaction
      ? {
          ...transaction,
          date: (transaction.date as any)?.toDate
            ? (transaction.date as any).toDate()
            : transaction.date || new Date(),
        }
      : {
          description: "",
          amount: 0,
          type: "expense",
          date: new Date(),
          categoryId: "",
          accountId: "",
        },
  });

  const onSubmit = (values: TransactionFormValues) => {
    onSave(values, transaction);
    onClose();
  };

  const transactionType = form.watch("type");

  const hierarchicalCategories = useMemo(() => {
    const filteredCategories = categories.filter(
      (c) => c.type === transactionType
    );
    const categoryMap = new Map(
      filteredCategories.map((c) => [c.id, { ...c, subcategories: [] as Category[] }])
    );

    const rootCategories: (Category & { subcategories: Category[] })[] = [];

    categoryMap.forEach((cat) => {
      if (cat.parent) {
        const parentInMap = Array.from(categoryMap.values()).find(
          (c) => c.name === cat.parent
        );
        if (parentInMap) {
          const parent = categoryMap.get(parentInMap.id);
          if (parent && !parent.subcategories.some((sub) => sub.id === cat.id)) {
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="max-h-[70vh] pr-4">
        <div className="space-y-4 pr-2">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('transactions.form.description')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('transactions.form.descriptionPlaceholder')} {...field} />
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
                <FormLabel>{t('transactions.form.amount')}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder={t('transactions.form.amountPlaceholder')} {...field} />
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
                <FormLabel>{t('transactions.form.type')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('transactions.form.typePlaceholder')} />
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
                <FormLabel>{t('transactions.form.category')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('transactions.form.categoryPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {hierarchicalCategories.map((c) => (
                      <SelectGroup key={c.id}>
                        <SelectItem value={c.id}>{c.name}</SelectItem>
                        {c.subcategories &&
                          c.subcategories.map((sub) => (
                            <SelectItem
                              key={sub.id}
                              value={sub.id}
                              className="pl-6"
                            >
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
                <FormLabel>{t('transactions.form.account')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('transactions.form.accountPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t('transactions.form.date')}</FormLabel>
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
                          <span>{t('transactions.form.pickDate')}</span>
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
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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

function TransferForm({
  onSave,
  onClose,
  accounts,
}: {
  onSave: (values: TransferFormValues) => void;
  onClose: () => void;
  accounts: Account[];
}) {
  const { t } = useTranslation();
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromAccountId: "",
      toAccountId: "",
      amount: 0,
      date: new Date(),
      description: "",
    },
  });

  const onSubmit = (values: TransferFormValues) => {
    onSave(values);
    onClose();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="max-h-[70vh] pr-4">
        <div className="space-y-4 pr-2">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="fromAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transactions.transferForm.fromAccount')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('transactions.transferForm.fromAccountPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="toAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('transactions.transferForm.toAccount')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('transactions.transferForm.toAccountPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('transactions.transferForm.amount')}</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('transactions.transferForm.description')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('transactions.transferForm.descriptionPlaceholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t('transactions.transferForm.date')}</FormLabel>
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
                          <span>{t('transactions.form.pickDate')}</span>
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
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
          <Button type="submit">{t('transactions.transferForm.save')}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

type SortKey = "description" | "transactionType" | "category" | "date" | "account" | "amount";
type SortDirection = "asc" | "desc";

type UnifiedTransaction = TransactionType & {
  date: Date;
  transactionType: "Regular" | "Transfer" | "Recurring";
  category?: Category;
  account?: Account;
};

function TransactionsPageContent() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const transactionsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "transactions"),
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

  const { data: transactionsData } = useCollection<TransactionType>(transactionsCollectionRef);
  const { data: categoriesData } = useCollection<Category>(categoriesCollectionRef);
  const { data: accountsData } = useCollection<Account>(accountsCollectionRef);

  const [isTxFormOpen, setIsTxFormOpen] = useState(false);
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false);

  const [editingTransaction, setEditingTransaction] = useState<
    (TransactionType & { category?: Category; account?: Account }) | undefined
  >(undefined);

  const [activeTab, setActiveTab] = useState("all");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'desc' });


  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "income" || tab === "expenses" || tab === "transfers") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const allTransactions = useMemo<UnifiedTransaction[]>(() => {
    if (!transactionsData || !categoriesData || !accountsData) return [];

    const categoryMap = new Map(categoriesData.map((c) => [c.id, c]));
    const accountMap = new Map(accountsData.map((a) => [a.id, a]));

    const regularTransactions: UnifiedTransaction[] = transactionsData.map(t => {
      const date = (t.date as any)?.toDate ? (t.date as any).toDate() : t.date;
      return {
        ...t,
        date: date,
        category: categoryMap.get(t.categoryId),
        account: accountMap.get(t.accountId),
        transactionType: t.categoryId === 'transfer' 
            ? 'Transfer' 
            : t.isRecurring 
            ? 'Recurring' 
            : 'Regular'
      }
    });

    return regularTransactions;

  }, [transactionsData, categoriesData, accountsData]);

  const sortedAndFilteredTransactions = useMemo(() => {
    let transactionsToDisplay = allTransactions;

    if (activeTab === "income") {
      transactionsToDisplay = allTransactions.filter(
        (t) => t.type === "income" && t.transactionType !== 'Transfer'
      );
    } else if (activeTab === "expenses") {
      transactionsToDisplay = allTransactions.filter(
        (t) => t.type === "expense" && t.transactionType !== 'Transfer'
      );
    } else if (activeTab === "transfers") {
      transactionsToDisplay = allTransactions.filter(
        (t) => t.transactionType === "Transfer"
      );
    }

    return [...transactionsToDisplay].sort((a, b) => {
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
  }, [allTransactions, activeTab, sortConfig]);

  const handleSaveTransaction = async (
    transactionData: TransactionFormValues,
    originalTransaction?: TransactionType
  ) => {
    if (!firestore || !user) return;

    try {
      await runTransaction(firestore, async (transaction) => {
        const { id, ...dataToSave } = transactionData;
        const isEditing = !!id;
        
        let dataWithTimestamp: any = {
          ...dataToSave,
          date: Timestamp.fromDate(dataToSave.date),
          isRecurring: transactionData.isRecurring || false,
        };

        const newAccountRef = doc(
          firestore,
          "users",
          user.uid,
          "accounts",
          dataToSave.accountId
        );
        let oldAccountRef;

        if (
          isEditing &&
          originalTransaction &&
          originalTransaction.accountId !== dataToSave.accountId
        ) {
          oldAccountRef = doc(
            firestore,
            "users",
            user.uid,
            "accounts",
            originalTransaction.accountId
          );
        }

        const newAccountDoc = await transaction.get(newAccountRef);
        if (!newAccountDoc.exists()) {
          throw "New account not found!";
        }

        let oldAccountDoc;
        if (oldAccountRef) {
          oldAccountDoc = await transaction.get(oldAccountRef);
          if (!oldAccountDoc.exists()) {
            throw "Old account not found!";
          }
        }

        if (oldAccountRef && oldAccountDoc && originalTransaction) {
          const oldBalance = oldAccountDoc.data().balance;
          const revertedBalance =
            originalTransaction.type === "income"
              ? oldBalance - originalTransaction.amount
              : oldBalance + originalTransaction.amount;
          transaction.update(oldAccountRef, { balance: revertedBalance });
        }

        const currentBalance = newAccountDoc.data().balance;
        let diff = 0;

        if (isEditing && originalTransaction) {
          if (originalTransaction.accountId === dataToSave.accountId) {
            const oldAmount =
              originalTransaction.type === "income"
                ? originalTransaction.amount
                : -originalTransaction.amount;
            const newAmount =
              dataToSave.type === "income"
                ? dataToSave.amount
                : -dataToSave.amount;
            diff = newAmount - oldAmount;
          } else {
            diff =
              dataToSave.type === "income"
                ? dataToSave.amount
                : -dataToSave.amount;
          }
        } else {
          diff =
            dataToSave.type === "income"
              ? dataToSave.amount
              : -dataToSave.amount;
        }

        const newBalance = currentBalance + diff;
        transaction.update(newAccountRef, { balance: newBalance });

        const transactionRef = isEditing
          ? doc(firestore, "users", user.uid, "transactions", id)
          : doc(collection(firestore, "users", user.uid, "transactions"));

        transaction.set(transactionRef, dataWithTimestamp, { merge: true });
      });
    } catch (error) {
      console.error("Transaction failed: ", error);
    }
  };

  const handleSaveTransfer = async (values: TransferFormValues) => {
    if (!firestore || !user) return;

    try {
      await runTransaction(firestore, async (transaction) => {
        const { fromAccountId, toAccountId, amount, date, description } =
          values;

        const fromAccountRef = doc(
          firestore,
          "users",
          user.uid,
          "accounts",
          fromAccountId
        );
        const toAccountRef = doc(
          firestore,
          "users",
          user.uid,
          "accounts",
          toAccountId
        );

        const fromAccountDoc = await transaction.get(fromAccountRef);
        const toAccountDoc = await transaction.get(toAccountRef);

        if (!fromAccountDoc.exists() || !toAccountDoc.exists()) {
          throw new Error("One or both accounts not found.");
        }

        const fromAccountBalance = fromAccountDoc.data().balance;
        const toAccountBalance = toAccountDoc.data().balance;

        transaction.update(fromAccountRef, {
          balance: fromAccountBalance - amount,
        });
        transaction.update(toAccountRef, {
          balance: toAccountBalance + amount,
        });

        const timestamp = Timestamp.fromDate(date);
        const transferCategoryId = "transfer";
        const transferDescription =
          description || `Transfer to ${toAccountDoc.data().name}`;
        const transferDescriptionFrom =
          description || `Transfer from ${fromAccountDoc.data().name}`;

        const expenseTransactionRef = doc(
          collection(firestore, "users", user.uid, "transactions")
        );
        transaction.set(expenseTransactionRef, {
          type: "expense",
          amount,
          date: timestamp,
          description: transferDescription,
          categoryId: transferCategoryId,
          accountId: fromAccountId,
          isTransfer: true,
        });

        const incomeTransactionRef = doc(
          collection(firestore, "users", user.uid, "transactions")
        );
        transaction.set(incomeTransactionRef, {
          type: "income",
          amount,
          date: timestamp,
          description: transferDescriptionFrom,
          categoryId: transferCategoryId,
          accountId: toAccountId,
          isTransfer: true,
        });
      });
    } catch (error) {
      console.error("Transfer failed: ", error);
    }
  };

  const handleDeleteTransaction = async (
    transactionToDelete: TransactionType
  ) => {
    if (!firestore || !user || !transactionToDelete.id) return;
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const transactionRef = doc(
          firestore,
          "users",
          user.uid,
          "transactions",
          transactionToDelete.id
        );

        if (transactionToDelete.categoryId === "transfer") {
          console.warn("Deleting transfers is complex and not fully implemented.");
        }

        if ("accountId" in transactionToDelete) {
          const accountRef = doc(
            firestore,
            "users",
            user.uid,
            "accounts",
            transactionToDelete.accountId
          );
          const accountDoc = await transaction.get(accountRef);
          if (!accountDoc.exists()) {
            throw "Account not found!";
          }
          const amountToRevert =
            transactionToDelete.type === "income"
              ? -transactionToDelete.amount
              : +transactionToDelete.amount;

          const newBalance = accountDoc.data().balance + amountToRevert;
          transaction.update(accountRef, { balance: newBalance });
        }

        transaction.delete(transactionRef);
      });
    } catch (e) {
      console.error("Error deleting transaction: ", e);
    }
  };

  const handleEditClick = (transaction: UnifiedTransaction) => {
    if (transaction.transactionType !== 'Regular') {
      alert(t('transactions.actions.editDisabledWarning'));
      return;
    }
    
    const fullTransaction = allTransactions.find(t => t.id === transaction.id);

    if (fullTransaction) {
      setEditingTransaction(fullTransaction as any);
      setIsTxFormOpen(true);
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => {
        if (prev.key === key) {
            return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
        }
        return { key, direction: 'desc' };
    });
  };

  const SortableHeader = ({ sortKey, children }: { sortKey: SortKey, children: React.ReactNode }) => (
    <TableHead onClick={() => handleSort(sortKey)} className="cursor-pointer">
      <div className="flex items-center gap-2">
        {children}
        {sortConfig.key === sortKey && <ArrowUpDown className="h-4 w-4" />}
      </div>
    </TableHead>
  );

  const TransactionTable = ({ data }: { data: UnifiedTransaction[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader sortKey="description">{t('transactions.table.description')}</SortableHeader>
          <SortableHeader sortKey="transactionType">{t('transactions.table.transactionType')}</SortableHeader>
          <SortableHeader sortKey="category">{t('transactions.table.category')}</SortableHeader>
          <SortableHeader sortKey="date">{t('transactions.table.date')}</SortableHeader>
          <SortableHeader sortKey="account">{t('transactions.table.account')}</SortableHeader>
          <SortableHeader sortKey="amount">{t('transactions.table.amount')}</SortableHeader>
          <TableHead className="text-right">{t('transactions.table.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell className="font-medium">
              {transaction.description}
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  transaction.transactionType === "Transfer"
                    ? "secondary"
                    : transaction.transactionType === "Recurring"
                    ? "outline"
                    : "default"
                }
                className={cn(
                    transaction.transactionType === 'Regular' && 'border-transparent bg-transparent text-foreground px-0'
                )}
              >
                {t(`transactions.transactionTypes.${transaction.transactionType}`)}
              </Badge>
            </TableCell>
            <TableCell>
              {transaction.category && (
                <Badge variant="outline">{transaction.category.name}</Badge>
              )}
            </TableCell>
            <TableCell>
              {transaction.date instanceof Date
                ? format(transaction.date, "MMM d, yyyy")
                : "Invalid Date"}
            </TableCell>
            <TableCell>
              {transaction.account?.name}
            </TableCell>
            <TableCell
              className={cn(
                "text-right",
                transaction.type === "income"
                  ? "text-green-500"
                  : transaction.type === "expense"
                  ? "text-red-500"
                  : ""
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
                onClick={() => handleEditClick(transaction)}
                disabled={transaction.transactionType !== 'Regular'}
              >
                <Edit className="h-4 w-4" />
                <span className="sr-only">{t('transactions.actions.edit')}</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-red-500 hover:text-red-500"
                onClick={() => handleDeleteTransaction(transaction as TransactionType)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">{t('transactions.actions.delete')}</span>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (!accountsData || accountsData.length === 0) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title={t('transactions.title')} />
            <Card className="flex flex-col items-center justify-center py-20 text-center">
              <CardHeader>
                  <div className="mx-auto bg-secondary p-3 rounded-full">
                      <Wallet className="h-12 w-12 text-muted-foreground" />
                  </div>
                <CardTitle className="mt-4">Add a transaction to start</CardTitle>
                <CardDescription>You need an account to add a transaction. Add an account first.</CardDescription>
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
        open={isTxFormOpen}
        onOpenChange={(open) => {
          setIsTxFormOpen(open);
          if (!open) setEditingTransaction(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? t('transactions.edit') : t('transactions.add')}
            </DialogTitle>
          </DialogHeader>
          {isTxFormOpen && (
            <TransactionForm
              transaction={editingTransaction}
              onSave={handleSaveTransaction}
              onClose={() => setIsTxFormOpen(false)}
              categories={categoriesData || []}
              accounts={accountsData || []}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isTransferFormOpen} onOpenChange={setIsTransferFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('transactions.transferForm.title')}</DialogTitle>
          </DialogHeader>
          {isTransferFormOpen && (
            <TransferForm
              onSave={handleSaveTransfer}
              onClose={() => setIsTransferFormOpen(false)}
              accounts={accountsData || []}
            />
          )}
        </DialogContent>
      </Dialog>
      <div className="flex flex-col gap-6">
        <PageHeader title={t('transactions.title')}>
          <Button variant="outline" onClick={() => setIsTransferFormOpen(true)}>
            <ArrowRightLeft />
            {t('transactions.transfer')}
          </Button>
          <Button
            onClick={() => {
              setEditingTransaction(undefined);
              setIsTxFormOpen(true);
            }}
          >
            <PlusCircle />
            {t('transactions.add')}
          </Button>
        </PageHeader>
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="font-headline">{t('transactions.cardTitle')}</CardTitle>
              <CardDescription>
                {t('transactions.cardDescription')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">{t('transactions.tabs.all')}</TabsTrigger>
                <TabsTrigger value="income">{t('transactions.tabs.income')}</TabsTrigger>
                <TabsTrigger value="expenses">{t('transactions.tabs.expenses')}</TabsTrigger>
                <TabsTrigger value="transfers">{t('transactions.tabs.transfers')}</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <TransactionTable data={sortedAndFilteredTransactions} />
              </TabsContent>
              <TabsContent value="income">
                <TransactionTable data={sortedAndFilteredTransactions} />
              </TabsContent>
              <TabsContent value="expenses">
                <TransactionTable data={sortedAndFilteredTransactions} />
              </TabsContent>
              <TabsContent value="transfers">
                <TransactionTable data={sortedAndFilteredTransactions} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function TransactionsPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <TransactionsPageContent />
    </React.Suspense>
  );
}
