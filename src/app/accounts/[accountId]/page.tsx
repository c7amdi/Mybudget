
"use client";

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from "@/components/page-header";
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import type { Account, Transaction, Category } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, startOfMonth, startOfYear, eachDayOfInterval, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ComposedChart, Line, Legend } from 'recharts';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { useTranslation } from '@/hooks/use-translation';
import { getCurrencySymbol } from '@/lib/currencies';
import { convertToTND, getBaseCurrency } from '@/lib/exchange-rates';

type ChartView = "day" | "week" | "month" | "year" | "custom";

export default function AccountDetailPage() {
  const { t } = useTranslation();
  const { accountId } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const [chartView, setChartView] = useState<ChartView>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const baseCurrency = getBaseCurrency();

  const accountRef = useMemoFirebase(
    () => user && accountId ? doc(firestore, "users", user.uid, "accounts", accountId as string) : null,
    [user, firestore, accountId]
  );
  const { data: accountData, isLoading: isAccountLoading } = useDoc<Account>(accountRef);

  const transactionsQuery = useMemoFirebase(
    () => user && accountId ? query(collection(firestore, "users", user.uid, "transactions"), where("accountId", "==", accountId)) : null,
    [user, firestore, accountId]
  );
  const { data: transactionsData } = useCollection<Transaction>(transactionsQuery);

  const categoriesCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "categories"),
    [user, firestore]
  );
  const { data: categoriesData } = useCollection<Category>(categoriesCollectionRef);

  const transactions = useMemo(() => {
    if (!transactionsData || !categoriesData) return [];
    const categoryMap = new Map(categoriesData.map(c => [c.id, c]));
    return transactionsData.map(t => ({
      ...t,
      date: (t.date as any).toDate(),
      category: categoryMap.get(t.categoryId),
    })).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactionsData, categoriesData]);

  const currencySymbol = useMemo(() => {
    return accountData ? getCurrencySymbol(accountData.currency) : '$';
  }, [accountData]);

  const chartData = useMemo(() => {
    const data: Record<string, { name: string; income: number; expense: number; netFlow: number; balance: number }> = {};
    const now = new Date();
    
    let periods: {name: string, start: Date, end?: Date}[] = [];
    
    if (chartView === 'day') {
        const last7Days = eachDayOfInterval({
          start: subDays(now, 6),
          end: now,
        });
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
                periods.push({ name: name, start: weekStart });
            }
        }
        periods = periods.slice(-7);
    } else if (chartView === 'custom' && dateRange?.from) {
        const end = dateRange.to || dateRange.from;
        const interval = eachDayOfInterval({ start: dateRange.from, end });
        periods = interval.map(d => ({ name: format(d, 'MMM d'), start: d, end: d}));
    } else { // year
        for (let i = 4; i >= 0; i--) {
            const d = new Date(now.getFullYear() - i, 0, 1);
            periods.push({ name: format(d, 'yyyy'), start: d });
        }
    }

    periods.forEach(p => {
        data[p.name] = { name: p.name, income: 0, expense: 0, netFlow: 0, balance: 0 };
    });

    (transactionsData || []).forEach(t => {
      const date = (t.date as any).toDate();
      let key: string | null = null;
      
      if (chartView === 'day') {
          if (date >= periods[0].start) {
            key = format(date, 'MMM d');
          }
      } else if (chartView === 'month') {
          if (date >= periods[0].start) {
            key = format(date, 'MMM');
          }
      } else if (chartView === 'week') {
         if (date >= periods[0].start) {
            key = format(startOfWeek(date), 'MMM d');
         }
      } else if (chartView === 'custom' && dateRange?.from) {
          if (date >= dateRange.from && date <= (dateRange.to || dateRange.from)) {
              key = format(date, 'MMM d');
          }
      } else { // year
          if (date >= periods[0].start) {
            key = format(date, 'yyyy');
          }
      }

      if (key && data[key]) {
        if (t.type === 'income') {
          data[key].income += t.amount;
        } else {
          data[key].expense += t.amount;
        }
      }
    });

    const periodData = Object.values(data);
    let runningBalance = accountData?.balance || 0;

    const netFlows = periodData.map(p => {
        p.netFlow = p.income - p.expense;
        return p.netFlow;
    });

    for (let i = periodData.length - 1; i >= 0; i--) {
        periodData[i].balance = runningBalance;
        runningBalance -= netFlows[i];
    }
    
    return periodData;

  }, [transactionsData, chartView, dateRange, accountData]);
  

  const chartConfig = {
    income: { label: "Income", color: "hsl(var(--chart-1))" },
    expense: { label: "Expense", color: "hsl(var(--chart-2))" },
    balance: { label: "Balance", color: "hsl(var(--chart-4))" }
  };

  if (isAccountLoading) {
    return <div>{t('accountDetail.loading')}</div>;
  }

  if (!accountData) {
    return <div>{t('accountDetail.notFound')}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={accountData.name} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>{t('accountDetail.balanceCardTitle')}</CardTitle>
                <CardDescription>{t('accountDetail.balanceCardDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-bold font-headline">{getCurrencySymbol(accountData.currency)} {accountData.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                 {accountData.currency !== baseCurrency && (
                    <p className="text-sm text-muted-foreground mt-1">
                        ~ {getCurrencySymbol(baseCurrency)}{' '}
                        {convertToTND(accountData.balance, accountData.currency).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                )}
                 <p className="text-xs text-muted-foreground mt-2">{t('accounts.currencyLabel')}: {accountData.currency}</p>
            </CardContent>
        </Card>
         <Card>
            <CardHeader>
                <CardTitle>{t('accountDetail.detailsCardTitle')}</CardTitle>
                <CardDescription>{t('accountDetail.detailsCardDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <p><strong>{t('accountDetail.accountType')}:</strong> {t(`accounts.types.${accountData.type}`)}</p>
                </div>
            </CardContent>
        </Card>
      </div>

       <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">{t('accountDetail.chartTitle')}</CardTitle>
            </div>
            <div className='flex items-center gap-2'>
              <ToggleGroup 
                type="single" 
                value={chartView}
                onValueChange={(value: ChartView) => value && setChartView(value)}
                className="gap-1"
              >
                <ToggleGroupItem value="day" size="sm">{t('common.day')}</ToggleGroupItem>
                <ToggleGroupItem value="week" size="sm">{t('common.week')}</ToggleGroupItem>
                <ToggleGroupItem value="month" size="sm">{t('common.month')}</ToggleGroupItem>
                <ToggleGroupItem value="year" size="sm">{t('common.year')}</ToggleGroupItem>
              </ToggleGroup>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-[300px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
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
          <CardContent>
            <CardDescription className="mb-4">
              {t('accountDetail.chartDescription')}
            </CardDescription>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <AreaChart accessibilityLayer data={chartData}>
                <defs>
                  <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-expense)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-expense)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis
                    yAxisId="left"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tickFormatter={(value) => `${currencySymbol} ${value / 1000}k`}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tickFormatter={(value) => `${currencySymbol}${value / 1000}k`}
                />
                <ChartTooltip content={<ChartTooltipContent 
                  formatter={(value, name, props) => {
                    const label = chartConfig[name as keyof typeof chartConfig]?.label || name;
                    const formattedValue = `${currencySymbol}${Number(value).toLocaleString()}`;
                    return `${label}: ${formattedValue}`;
                  }}
                  labelFormatter={(label) => <div className="font-bold">{label}</div>}
                />} />
                 <Area
                    yAxisId="left"
                    dataKey="expense"
                    type="natural"
                    fill="url(#fillExpense)"
                    stroke="var(--color-expense)"
                    stackId="a"
                />
                <Area
                    yAxisId="left"
                    dataKey="income"
                    type="natural"
                    fill="url(#fillIncome)"
                    stroke="var(--color-income)"
                    stackId="a"
                />
                <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} yAxisId="right" dot={false} name="Balance" />
                <Legend />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountDetail.transactionsTitle')}</CardTitle>
          <CardDescription>{t('accountDetail.transactionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accountDetail.table.description')}</TableHead>
                <TableHead>{t('accountDetail.table.category')}</TableHead>
                <TableHead>{t('accountDetail.table.date')}</TableHead>
                <TableHead className="text-right">{t('accountDetail.table.amount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">{transaction.description}</TableCell>
                  <TableCell>
                    {transaction.category && <Badge variant="outline">{transaction.category.name}</Badge>}
                  </TableCell>
                  <TableCell>{format(transaction.date, "MMM d, yyyy")}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right",
                      transaction.type === "income" ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {transaction.type === "income" ? "+" : "-"} {currencySymbol}{' '}
                    {transaction.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
