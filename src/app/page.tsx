
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  PlusCircle,
  CalendarIcon,
  Target,
  Wallet,
} from 'lucide-react';
import { CurrencyOverviewChart } from '@/components/dashboard/overview-chart';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  format,
  startOfWeek,
  eachDayOfInterval,
  subDays,
  startOfMonth,
  startOfYear,
  differenceInMonths,
  isFuture,
  differenceInDays,
  isValid,
} from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import type { Transaction, Category, Account, Budget } from '@/lib/types';
import { useMemo, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { useTranslation } from '@/hooks/use-translation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrencySymbol } from '@/lib/currencies';
import { convertToTND, getBaseCurrency } from '@/lib/exchange-rates';
import { ScrollArea } from '@/components/ui/scroll-area';

type ChartView = 'day' | 'week' | 'month' | 'year' | 'custom';

type CurrencySummary = {
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [chartView, setChartView] = useState<ChartView>('month');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { t } = useTranslation();
  const baseCurrency = getBaseCurrency();

  const transactionsCollectionRef = useMemoFirebase(
    () =>
      user
        ? query(
            collection(firestore, 'users', user.uid, 'transactions'),
            orderBy('date', 'desc')
          )
        : null,
    [user, firestore]
  );
  const categoriesCollectionRef = useMemoFirebase(
    () => user && collection(firestore, 'users', user.uid, 'categories'),
    [user, firestore]
  );
  const accountsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, 'users', user.uid, 'accounts'),
    [user, firestore]
  );
   const budgetsCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "budgets"),
    [user, firestore]
  );

  const { data: transactionsData } =
    useCollection<Transaction>(transactionsCollectionRef);
  const { data: categoriesData } =
    useCollection<Category>(categoriesCollectionRef);
  const { data: accountsData } = useCollection<Account>(accountsCollectionRef);
  const { data: budgetsData } = useCollection<Budget>(budgetsCollectionRef);

  const recentTransactions = useMemo(() => {
    if (!transactionsData || !categoriesData) return [];
    const categoryMap = new Map(categoriesData.map((c) => [c.id, c]));
    return transactionsData.slice(0, 5).map((t) => {
      let date = t.date;
      if (date instanceof Timestamp) {
        date = date.toDate();
      }
      return {
        ...t,
        date: date,
        category: categoryMap.get(t.categoryId),
      }
    });
  }, [transactionsData, categoriesData]);

  const summaryByCurrency = useMemo(() => {
    const allTransactions = transactionsData || [];
    const allAccounts = accountsData || [];
    const accountMap = new Map(allAccounts.map(a => [a.id, a]));

    const summary: Record<string, CurrencySummary> = {};

    // Initialize summaries for all currencies present in accounts
    allAccounts.forEach(account => {
        if (!summary[account.currency]) {
            summary[account.currency] = {
                netWorth: 0,
                monthlyIncome: 0,
                monthlyExpenses: 0,
            };
        }
    });
    
    // Calculate net worth for each currency
    allAccounts.forEach(account => {
        if (summary[account.currency]) {
            summary[account.currency].netWorth += account.balance;
        }
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthTransactions = allTransactions.filter((t) => {
      const date = (t.date as any)?.toDate ? (t.date as any).toDate() : t.date;
      return date >= monthStart;
    });

    thisMonthTransactions.forEach(t => {
      const account = accountMap.get(t.accountId);
      if (account && summary[account.currency]) {
        if (t.type === 'income') {
            summary[account.currency].monthlyIncome += t.amount;
        } else if (t.type === 'expense') {
            summary[account.currency].monthlyExpenses += t.amount;
        }
      }
    });

    return summary;
  }, [transactionsData, accountsData]);

  const sortedBudgets = useMemo(() => {
    if (!budgetsData) return [];
    return (budgetsData || []).map(budget => {
        let targetDate = new Date(); // Default to today if date is invalid
        if (budget.targetDate) {
            let potentialDate = budget.targetDate;
            if (potentialDate instanceof Timestamp) {
                potentialDate = potentialDate.toDate();
            }
            if (isValid(potentialDate)) {
                targetDate = potentialDate;
            }
        }
        return {
            ...budget,
            targetDate: targetDate,
            progress: (budget.currentAmount / budget.targetAmount) * 100,
        }
    }).sort((a, b) => {
        if (!a.targetDate || !b.targetDate) return 0;
        return a.targetDate.getTime() - b.targetDate.getTime();
    });
  }, [budgetsData]);

  const availableToSave = useMemo(() => {
    if (!accountsData) return 0;
    return accountsData.reduce((sum, account) => {
        if (account.type !== 'Cash') {
            return sum + account.balance;
        }
        return sum;
    }, 0);
  }, [accountsData]);

  const suggestedMonthlySaving = useMemo(() => {
      if (sortedBudgets.length === 0) return 0;

      const primaryBudget = sortedBudgets[0];
      const amountToSave = primaryBudget.targetAmount - primaryBudget.currentAmount;
      const applicableSavings = Math.min(availableToSave, amountToSave);
      const remainingNeeded = amountToSave - applicableSavings;
      const targetDate = new Date(primaryBudget.targetDate);
      
      if (remainingNeeded <= 0) return 0;
      if (!isFuture(targetDate)) return remainingNeeded;

      const monthsDiff = differenceInMonths(targetDate, new Date());
      
      if (monthsDiff > 0) {
        return remainingNeeded / monthsDiff;
      }

      const daysDiff = differenceInDays(targetDate, new Date());
      if (daysDiff > 0) {
          const dailyRate = remainingNeeded / daysDiff;
          return dailyRate * 30.44; // Average days in a month
      }

      return remainingNeeded;
  }, [sortedBudgets, availableToSave]);

  const chartsDataByCurrency = useMemo(() => {
    const dataByCurrency: Record<string, Record<string, { name: string; income: number; expense: number; netFlow: number; balance: number }>> = {};
    const accountMap = new Map((accountsData || []).map(a => [a.id, a]));

    if (!transactionsData || !accountsData) return {};
    
    const now = new Date();
    let periods: { name: string; start: Date; end?: Date }[] = [];

    if (chartView === 'day') {
        const last7Days = eachDayOfInterval({ start: subDays(now, 6), end: now });
        periods = last7Days.map(d => ({ name: format(d, 'MMM d'), start: d, end: d }));
    } else if (chartView === 'month') {
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            periods.push({ name: format(d, 'MMM'), start: d });
        }
    } else if (chartView === 'week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
            const weekStart = startOfWeek(d);
            const name = format(weekStart, 'MMM d');
            if (!periods.some(p => p.name === name)) {
                periods.push({ name, start: weekStart });
            }
        }
        periods = periods.slice(-7);
    } else if (chartView === 'custom' && dateRange?.from) {
        const end = dateRange.to || dateRange.from;
        const interval = eachDayOfInterval({ start: dateRange.from, end });
        periods = interval.map(d => ({ name: format(d, 'MMM d'), start: d, end: d }));
    } else { // year
        for (let i = 4; i >= 0; i--) {
            const d = new Date(now.getFullYear() - i, 0, 1);
            periods.push({ name: format(d, 'yyyy'), start: d });
        }
    }

    (accountsData || []).forEach(account => {
        if (!dataByCurrency[account.currency]) {
            dataByCurrency[account.currency] = {};
            periods.forEach(p => {
                dataByCurrency[account.currency][p.name] = { name: p.name, income: 0, expense: 0, netFlow: 0, balance: 0 };
            });
        }
    });

    (transactionsData || []).forEach((t) => {
        const account = accountMap.get(t.accountId);
        if (!account) return;

        const currency = account.currency;
        const currencyData = dataByCurrency[currency];
        if (!currencyData) return;

        const date = (t.date as any)?.toDate ? (t.date as any).toDate() : t.date;
        let key: string | null = null;
        
        if (chartView === 'day') {
            if (date >= periods[0].start) key = format(date, 'MMM d');
        } else if (chartView === 'month') {
            if (date >= periods[0].start) key = format(date, 'MMM');
        } else if (chartView === 'week') {
            if (date >= periods[0].start) key = format(startOfWeek(date), 'MMM d');
        } else if (chartView === 'custom' && dateRange?.from) {
            if (date >= dateRange.from && date <= (dateRange.to || dateRange.from)) {
                key = format(date, 'MMM d');
            }
        } else { // year
            if (date >= periods[0].start) key = format(date, 'yyyy');
        }

        if (key && currencyData[key]) {
            if (t.type === 'income') {
                currencyData[key].income += t.amount;
            } else {
                currencyData[key].expense += t.amount;
            }
        }
    });

    const finalChartData: Record<string, { name: string; income: number; expense: number; netFlow: number; balance: number }[]> = {};
    for (const currency in dataByCurrency) {
        const totalBalanceForCurrency = (accountsData || [])
          .filter(acc => acc.currency === currency)
          .reduce((sum, acc) => sum + acc.balance, 0);

        const periodData = Object.values(dataByCurrency[currency]);
        let runningBalance = totalBalanceForCurrency;

        const netFlows = periodData.map(p => {
            p.netFlow = p.income - p.expense;
            return p.netFlow;
        });
        
        for (let i = periodData.length - 1; i >= 0; i--) {
            periodData[i].balance = runningBalance;
            runningBalance -= netFlows[i];
        }

        finalChartData[currency] = periodData;
    }
    
    return finalChartData;
  }, [transactionsData, accountsData, chartView, dateRange]);


  if (!accountsData || accountsData.length === 0) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title={t('dashboard.title')} />
            <Card className="flex flex-col items-center justify-center py-20 text-center">
              <CardHeader>
                  <div className="mx-auto bg-secondary p-3 rounded-full">
                      <Wallet className="h-12 w-12 text-muted-foreground" />
                  </div>
                <CardTitle className="mt-4">Welcome to BudgetWise</CardTitle>
                <CardDescription>Get started by adding your first bank account.</CardDescription>
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

  const currencyTabs = Object.keys(chartsDataByCurrency);


  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('dashboard.title')}>
        <Button asChild>
          <Link href="/transactions">
            <PlusCircle />
            {t('dashboard.addTransaction')}
          </Link>
        </Button>
      </PageHeader>
      <div className="space-y-4">
        {Object.entries(summaryByCurrency).map(([currency, summary]) => (
            <div key={currency} className="mb-4">
                <h2 className="text-lg font-semibold mb-2">{currency} Summary</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Link href="/accounts" className="block">
                        <Card className="hover:bg-muted/50 transition-colors h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('dashboard.netWorth')} ({currency})</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                            <div className="text-xl font-bold font-headline">
                                {getCurrencySymbol(currency)} {summary.netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                             {currency !== baseCurrency && (
                                <p className="text-xs text-muted-foreground">
                                    ~ {getCurrencySymbol(baseCurrency)}{' '}
                                    {convertToTND(summary.netWorth, currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('dashboard.netWorthDescription')}
                            </p>
                            </CardContent>
                        </Card>
                    </Link>
                     <Link href="/transactions?tab=income" className="block">
                        <Card className="hover:bg-muted/50 transition-colors h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t('dashboard.incomeThisMonth')}
                            </CardTitle>
                            <ArrowUpRight className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                            <div className="text-xl font-bold font-headline text-green-500">
                                +{getCurrencySymbol(currency)} {summary.monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {currency !== baseCurrency && (
                                <p className="text-xs text-muted-foreground">
                                    ~ {getCurrencySymbol(baseCurrency)}{' '}
                                    {convertToTND(summary.monthlyIncome, currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('dashboard.incomeThisMonthDescription')}
                            </p>
                            </CardContent>
                        </Card>
                    </Link>
                    <Link href="/transactions?tab=expenses" className="block">
                        <Card className="hover:bg-muted/50 transition-colors h-full">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t('dashboard.expensesThisMonth')}
                            </CardTitle>
                            <ArrowDownLeft className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                            <div className="text-xl font-bold font-headline text-red-500">
                                -{getCurrencySymbol(currency)} {summary.monthlyExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                             {currency !== baseCurrency && (
                                <p className="text-xs text-muted-foreground">
                                    ~ {getCurrencySymbol(baseCurrency)}{' '}
                                    {convertToTND(summary.monthlyExpenses, currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                                {t('dashboard.expensesThisMonthDescription')}
                            </p>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="font-headline">{t('dashboard.overview')}</CardTitle>
              <CardDescription>{t('dashboard.overviewDescription')}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <ToggleGroup
                type="single"
                value={chartView}
                onValueChange={(value: ChartView) => value && setChartView(value)}
                className="gap-1 w-full sm:w-auto"
              >
                <ToggleGroupItem value="day" size="sm" className="flex-1">
                  {t('common.day')}
                </ToggleGroupItem>
                <ToggleGroupItem value="week" size="sm" className="flex-1">
                  {t('common.week')}
                </ToggleGroupItem>
                <ToggleGroupItem value="month" size="sm" className="flex-1">
                  {t('common.month')}
                </ToggleGroupItem>
                <ToggleGroupItem value="year" size="sm" className="flex-1">
                  {t('common.year')}
                </ToggleGroupItem>
              </ToggleGroup>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={'outline'}
                    className={cn(
                      'w-full sm:w-[260px] justify-start text-left font-normal',
                      !dateRange && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'LLL dd, y')} -{' '}
                          {format(dateRange.to, 'LLL dd, y')}
                        </>
                      ) : (
                        format(dateRange.from, 'LLL dd, y')
                      )
                    ) : (
                      <span>{t('common.pickDateRange')}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      if (range) setChartView('custom');
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent className="pl-2">
            <Tabs defaultValue={currencyTabs[0] || 'overview'}>
                <TabsList>
                  {currencyTabs.map(currency => (
                    <TabsTrigger key={currency} value={currency}>{currency}</TabsTrigger>
                  ))}
                </TabsList>
                {currencyTabs.map(currency => (
                  <TabsContent key={currency} value={currency}>
                    <CurrencyOverviewChart 
                      data={chartsDataByCurrency[currency]} 
                      currency={currency}
                    />
                  </TabsContent>
                ))}
            </Tabs>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline">
              {t('dashboard.recentTransactions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('transactions.table.description')}</TableHead>
                    <TableHead>{t('transactions.table.category')}</TableHead>
                    <TableHead className="text-right">{t('transactions.table.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="font-medium">
                          {transaction.description}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {isValid(transaction.date) ? format(transaction.date, 'MMM d, yyyy') : 'Invalid Date'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {transaction.category && (
                          <Badge variant="outline">
                            {transaction.category.name}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right',
                          transaction.type === 'income'
                            ? 'text-green-500'
                            : 'text-red-500'
                        )}
                      >
                        {transaction.type === 'income' ? '+' : '-'} {getCurrencySymbol(accountsData?.find(a => a.id === transaction.accountId)?.currency || 'USD')}{' '}
                        {transaction.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
