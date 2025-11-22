
"use client";

import React, { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
  TableFooter,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { MoreHorizontal, PlusCircle, Target, Calendar as CalendarIcon, PiggyBank, Edit, Trash2, CheckCircle, Wallet, TrendingUp } from "lucide-react";
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter as BudgetDialogFooter,
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, differenceInMonths, isFuture, differenceInDays, addMonths, addDays, isBefore, getMonth, getYear, isValid } from "date-fns";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, Timestamp, runTransaction } from "firebase/firestore";
import type { Budget, Account, RecurringTransaction, Transaction } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { Checkbox } from "@/components/ui/checkbox";
import { getCurrencySymbol } from "@/lib/currencies";
import { ScrollArea } from "@/components/ui/scroll-area";
import { convertToTND, getExchangeRate, getBaseCurrency } from "@/lib/exchange-rates";

const budgetSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  targetAmount: z.preprocess(
    (a) => parseFloat(String(a)),
    z.number().positive("Target amount must be a positive number")
  ),
  currentAmount: z.preprocess(
    (a) => parseFloat(String(a)),
    z.number().min(0, "Current amount cannot be negative")
  ),
  targetDate: z.date(),
  accountIds: z.array(z.string()).min(1, "Please select at least one account."),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

function BudgetForm({
  budget,
  onSave,
  onClose,
  accounts,
}: {
  budget?: Budget;
  onSave: (data: BudgetFormValues) => void;
  onClose: () => void;
  accounts: Account[];
}) {
  const { t } = useTranslation();
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: budget
      ? {
          ...budget,
          targetDate: (budget.targetDate as any)?.toDate ? (budget.targetDate as any).toDate() : new Date(),
        }
      : {
          name: "",
          description: "",
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: new Date(),
          accountIds: [],
        },
  });

  const onSubmit = (values: BudgetFormValues) => {
    onSave(values);
    onClose();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('budgets.form.name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('budgets.form.namePlaceholder')} {...field} />
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
                  <FormLabel>{t('budgets.form.description')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('budgets.form.descriptionPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="targetAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('budgets.form.targetAmount')}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder={t('budgets.form.targetAmountPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('budgets.form.currentAmount')}</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder={t('budgets.form.currentAmountPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="targetDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t('budgets.form.targetDate')}</FormLabel>
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
                            <span>{t('budgets.form.pickDate')}</span>
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
              name="accountIds"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel className="text-base">{t('budgets.form.linkAccounts')}</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      {t('budgets.form.linkAccountsDescription')}
                    </p>
                  </div>
                  {accounts.map((account) => (
                    <FormField
                      key={account.id}
                      control={form.control}
                      name="accountIds"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={account.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(account.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), account.id])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (value) => value !== account.id
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                            {account.name} ({getCurrencySymbol(account.currency)} {account.balance.toLocaleString()})
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>
        <BudgetDialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">{t('common.cancel')}</Button>
          </DialogClose>
          <Button type="submit">{t('common.save')}</Button>
        </BudgetDialogFooter>
      </form>
    </Form>
  );
}

export default function BudgetsPage() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();

  const [projectionDate, setProjectionDate] = useState<Date | undefined>();

  const budgetsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "budgets"),
    [user, firestore]
  );
  const accountsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "accounts"),
    [user, firestore]
  );
  const transactionsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "transactions"),
    [user, firestore]
  );
  const recurringTransactionsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "recurring_transactions"),
    [user, firestore]
  );

  const { data: budgetsData } = useCollection<Budget>(budgetsCollectionRef);
  const { data: accountsData } = useCollection<Account>(accountsCollectionRef);
  const { data: transactionsData } = useCollection<Transaction>(transactionsCollectionRef);
  const { data: recurringTransactionsData } = useCollection<RecurringTransaction>(recurringTransactionsCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);

  const projectedBalances = useMemo(() => {
        const baseCurrency = getBaseCurrency();
        const baseCurrencySymbol = getCurrencySymbol(baseCurrency);

        if (!accountsData || accountsData.length === 0) {
            return {
                accountBalances: [],
                totalPredictedNetWorth: 0,
                baseCurrency,
                baseCurrencySymbol,
            };
        }

        const initialBalances = {
            accountBalances: accountsData.map(acc => ({
                ...acc,
                predictedBalance: acc.balance,
                predictedBalanceInBase: convertToTND(acc.balance, acc.currency),
                exchangeRateInfo: acc.currency !== baseCurrency ? getExchangeRate(acc.currency) : null,
            })),
            totalPredictedNetWorth: accountsData.reduce((sum, acc) => sum + convertToTND(acc.balance, acc.currency), 0),
        };

        if (!projectionDate || !recurringTransactionsData || isBefore(projectionDate, new Date())) {
            return { ...initialBalances, baseCurrency, baseCurrencySymbol };
        }

        const today = new Date();
        const predictedBalances = new Map(accountsData.map(acc => [acc.id, acc.balance]));

        recurringTransactionsData.forEach(rt => {
            if (!rt.isActive) return;
            const rtStartDate = (rt.startDate as any).toDate();
            let nextValidDate = rtStartDate;
            
            while (isBefore(nextValidDate, projectionDate)) {
                if(isBefore(nextValidDate, today)) {
                    // Skip past occurrences, assume they are reflected in current balance
                } else {
                     const currentBalance = predictedBalances.get(rt.accountId) || 0;
                     const change = rt.type === 'income' ? rt.amount : -rt.amount;
                     predictedBalances.set(rt.accountId, currentBalance + change);
                }

                switch (rt.frequency) {
                    case 'monthly': nextValidDate = addMonths(nextValidDate, 1); break;
                    case 'quarterly': nextValidDate = addMonths(nextValidDate, 3); break;
                    case 'semi-annually': nextValidDate = addMonths(nextValidDate, 6); break;
                    case 'yearly': nextValidDate = addMonths(nextValidDate, 12); break;
                }
                
                if (rt.endDate) {
                    const rtEndDate = (rt.endDate as any).toDate();
                    if(isBefore(rtEndDate, nextValidDate)) break;
                }
            }
        });

        const accountBalances = accountsData.map(acc => {
            const predictedBalance = predictedBalances.get(acc.id) || acc.balance;
            return {
                 ...acc,
                predictedBalance: predictedBalance,
                predictedBalanceInBase: convertToTND(predictedBalance, acc.currency),
                exchangeRateInfo: acc.currency !== baseCurrency ? getExchangeRate(acc.currency) : null,
            }
        });

        const totalPredictedNetWorth = accountBalances.reduce((sum, acc) => sum + acc.predictedBalanceInBase, 0);

        return { accountBalances, totalPredictedNetWorth, baseCurrency, baseCurrencySymbol };
  }, [projectionDate, accountsData, recurringTransactionsData]);


  const handleSaveBudget = async (data: BudgetFormValues) => {
    if (!firestore || !user) return;
    const { id, ...dataToSave } = data;
    const isEditing = !!id;

    const budgetData = {
      ...dataToSave,
      targetDate: Timestamp.fromDate(dataToSave.targetDate),
    };

    const docRef = isEditing
      ? doc(firestore, "users", user.uid, "budgets", id)
      : doc(collection(firestore, "users", user.uid, "budgets"));

    try {
      await runTransaction(firestore, async (transaction) => {
        transaction.set(docRef, budgetData, { merge: isEditing });
      });
    } catch (error) {
      console.error("Failed to save budget: ", error);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!firestore || !user) return;

    try {
      await runTransaction(firestore, async (transaction) => {
        const docRef = doc(firestore, "users", user.uid, "budgets", budgetId);
        transaction.delete(docRef);
      });
    } catch (e) {
      console.error("Error deleting budget: ", e);
    }
  };
  
  const handleMarkAsAchieved = async (budget: Budget) => {
    if (!firestore || !user) return;

    // Create an update object with only the currentAmount
    const updatedBudgetData = {
        currentAmount: budget.targetAmount,
    };
    
    const docRef = doc(firestore, "users", user.uid, "budgets", budget.id);
    try {
      await runTransaction(firestore, async (transaction) => {
        // Use update instead of set to only change specific fields
        transaction.update(docRef, updatedBudgetData);
      });
    } catch (error) {
      console.error("Failed to mark budget as achieved: ", error);
    }
  }

  const handleEditClick = (budget: Budget) => {
    setEditingBudget(budget);
    setIsFormOpen(true);
  };

   const processedBudgets = useMemo(() => {
    const today = new Date();
    const accountMap = new Map((accountsData || []).map(a => [a.id, a]));

    const sortedBudgets = (budgetsData || []).map(budget => {
        let date = new Date(); // Default to today if date is invalid
        if (budget.targetDate) {
            let potentialDate = budget.targetDate;
            if (potentialDate && typeof (potentialDate as any).toDate === 'function') {
                potentialDate = (potentialDate as any).toDate();
            }
            if (isValid(potentialDate)) {
                date = potentialDate as Date;
            }
        }
        return {
            ...budget,
            targetDate: date,
        }
    }).sort((a,b) => {
        const timeA = a.targetDate ? new Date(a.targetDate).getTime() : 0;
        const timeB = b.targetDate ? new Date(b.targetDate).getTime() : 0;
        if (!timeA || !timeB) return 0;
        return timeA - timeB;
    });

    let cumulativeEarmarkedByCurrency: Record<string, number> = {};

    return sortedBudgets.map((budget) => {
      const linkedAccounts = (budget.accountIds || []).map(id => accountMap.get(id)).filter(Boolean) as Account[];
      if (linkedAccounts.length === 0) return { ...budget, progress: 0 };
      
      const budgetCurrency = linkedAccounts[0].currency;
      const currencySymbol = getCurrencySymbol(budgetCurrency);
      
      // Calculate available savings for this budget's currency
      const totalBalanceInCurrency = linkedAccounts
        .filter(acc => acc.currency === budgetCurrency)
        .reduce((sum, acc) => sum + acc.balance, 0);

      const earmarkedForPreviousBudgets = cumulativeEarmarkedByCurrency[budgetCurrency] || 0;
      const availableForThisGoal = Math.max(0, totalBalanceInCurrency - earmarkedForPreviousBudgets);

      const amountToSave = budget.targetAmount - budget.currentAmount;
      const applicableSavings = Math.min(availableForThisGoal, amountToSave);
      const remainingNeeded = Math.max(0, amountToSave - applicableSavings);
      
      let suggestedSaving = 0;
      let savingPeriod: 'day' | 'month' = 'month';
      
      if (remainingNeeded > 0) {
        const targetDate = new Date(budget.targetDate);
        if (isFuture(targetDate)) {
            const daysDiff = differenceInDays(targetDate, today);
            if (daysDiff < 60) {
                savingPeriod = 'day';
                suggestedSaving = remainingNeeded / Math.max(1, daysDiff);
            } else {
                savingPeriod = 'month';
                const monthsDiff = differenceInMonths(targetDate, today);
                suggestedSaving = monthsDiff > 0 ? remainingNeeded / monthsDiff : remainingNeeded;
            }
        } else {
            savingPeriod = 'day';
            suggestedSaving = remainingNeeded;
        }
      }
      
      // Update cumulative earmarked funds for the next budget in line
      cumulativeEarmarkedByCurrency[budgetCurrency] = (cumulativeEarmarkedByCurrency[budgetCurrency] || 0) + budget.targetAmount;
      
      const progress = (budget.currentAmount / budget.targetAmount) * 100;

      return {
        ...budget,
        currency: budgetCurrency,
        currencySymbol,
        availableForThisGoal,
        suggestedSaving,
        savingPeriod,
        remainingNeeded,
        progress,
      };
    });
  }, [budgetsData, accountsData]);

  if (!accountsData || accountsData.length === 0) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title={t('budgets.title')} />
            <Card className="flex flex-col items-center justify-center py-20 text-center">
              <CardHeader>
                  <div className="mx-auto bg-secondary p-3 rounded-full">
                      <Wallet className="h-12 w-12 text-muted-foreground" />
                  </div>
                <CardTitle className="mt-4">Create a budget to start</CardTitle>
                <CardDescription>You need an account to create a budget. Add an account first.</CardDescription>
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
          if (!open) setEditingBudget(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? t('budgets.editBudget') : t('budgets.addBudget')}
            </DialogTitle>
          </DialogHeader>
          {isFormOpen && (
              <BudgetForm
                  budget={editingBudget}
                  onSave={handleSaveBudget}
                  onClose={() => setIsFormOpen(false)}
                  accounts={accountsData || []}
              />
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-6">
        <PageHeader title={t('budgets.title')}>
          <Button onClick={() => { setEditingBudget(undefined); setIsFormOpen(true); }}>
            <PlusCircle />
            {t('budgets.addBudget')}
          </Button>
        </PageHeader>
        
        <Card>
          <CardHeader className="flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-headline flex items-center gap-2"><TrendingUp/> Future Balance Projection</CardTitle>
              <CardDescription>Select a future date to see your predicted balances.</CardDescription>
            </div>
             <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[280px] justify-start text-left font-normal",
                        !projectionDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {projectionDate ? format(projectionDate, "PPP") : <span>Pick a future date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={projectionDate}
                      onSelect={setProjectionDate}
                      disabled={(date) => isBefore(date, new Date())}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
          </CardHeader>
          <CardContent>
             <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Current Balance</TableHead>
                          <TableHead className="text-right">Predicted Balance</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {projectedBalances.accountBalances.map(account => (
                          <TableRow key={account.id}>
                              <TableCell className="font-medium">{account.name}</TableCell>
                              <TableCell>{getCurrencySymbol(account.currency)} {account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right font-semibold">
                                  {getCurrencySymbol(account.currency)} {account.predictedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {account.currency !== projectedBalances.baseCurrency && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        ({projectedBalances.baseCurrencySymbol}{' '}
                                          {account.predictedBalanceInBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          {account.exchangeRateInfo?.isUnofficial && '*'})
                                      </span>
                                  )}
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter>
                      <TableRow>
                          <TableCell colSpan={2} className="font-bold">Total Predicted Net Worth</TableCell>
                          <TableCell className="text-right font-bold text-lg text-primary">
                              {projectedBalances.baseCurrencySymbol} {projectedBalances.totalPredictedNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                      </TableRow>
                  </TableFooter>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {processedBudgets.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-20 text-center">
              <CardHeader>
                  <div className="mx-auto bg-secondary p-3 rounded-full">
                      <PiggyBank className="h-12 w-12 text-muted-foreground" />
                  </div>
                <CardTitle className="mt-4">{t('budgets.cardTitle')}</CardTitle>
                <CardDescription>{t('budgets.cardDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => { setEditingBudget(undefined); setIsFormOpen(true); }}>
                  <PlusCircle />
                  {t('budgets.addBudget')}
                </Button>
              </CardContent>
            </Card>
          ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {processedBudgets.map((budget) => {
            if (!budget.id) return null;
            const isAchieved = budget.progress >= 100;
            return (
              <Card key={budget.id} className={cn("flex flex-col", isAchieved && "bg-emerald-50 border-emerald-200")}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                       <div className={cn("p-3 rounded-full", isAchieved ? "bg-emerald-100" : "bg-secondary")}>
                          <Target className={cn("h-6 w-6", isAchieved ? "text-emerald-600" : "text-primary")} />
                       </div>
                       <div>
                          <CardTitle className="font-headline">{budget.name}</CardTitle>
                          <CardDescription>{budget.description}</CardDescription>
                       </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">{t('budgets.table.currentAmount')}</span>
                      <span className="text-sm font-semibold">{budget.currencySymbol} {budget.currentAmount.toLocaleString()}</span>
                    </div>
                    <Progress value={budget.progress} className={cn(isAchieved && "[&>div]:bg-emerald-500")} />
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">{t('budgets.table.targetAmount')}</span>
                      <span className={cn("text-lg font-bold font-headline", isAchieved ? "text-emerald-600" : "text-primary")}>{budget.currencySymbol} {budget.targetAmount.toLocaleString()}</span>
                    </div>
                  </div>
                  
                </CardContent>
                 <CardFooter className="flex-col items-start gap-2 border-t pt-4 text-sm">
                    {!isAchieved ? (
                      <>
                        <div className="flex justify-between w-full">
                          <strong>{t('budgets.availableToSave')}:</strong>
                          <span className="font-semibold">{budget.currencySymbol} {budget.availableForThisGoal ? budget.availableForThisGoal.toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between w-full">
                          <strong>{t('budgets.remainingAfterAvailable')}:</strong>
                          <span className="font-semibold">{budget.currencySymbol} {budget.remainingNeeded && budget.remainingNeeded > 0 ? budget.remainingNeeded.toFixed(2) : '0.00'}</span>
                        </div>
                        <div className="flex justify-between w-full">
                          <strong>
                              {budget.savingPeriod === 'day' ? t('budgets.suggestedDailySaving') : t('budgets.suggestedMonthlySaving')}:
                          </strong>
                          <span className="text-green-500 font-semibold">{budget.currencySymbol} {budget.suggestedSaving && budget.suggestedSaving > 0 ? budget.suggestedSaving.toFixed(2) : '0.00'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center w-full font-bold text-emerald-600">Goal Achieved!</div>
                    )}
                     <div className="flex justify-between w-full text-muted-foreground mt-2">
                          <span>{t('budgets.table.targetDate')}:</span>
                          <span>{format(new Date(budget.targetDate), 'MMM d, yyyy')}</span>
                      </div>
                </CardFooter>
                 <CardFooter className="border-t pt-4 gap-2">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleEditClick(budget as Budget); }}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t('categories.actions.edit')}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteBudget(budget.id); }}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t('categories.actions.delete')}
                    </Button>
                    {!isAchieved && (
                       <Button variant="secondary" size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={(e) => { e.stopPropagation(); handleMarkAsAchieved(budget as Budget); }}>
                         <CheckCircle className="mr-2 h-4 w-4" />
                         Achieved
                       </Button>
                    )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
         )}
      </div>
    </>
  );
}

    

    
