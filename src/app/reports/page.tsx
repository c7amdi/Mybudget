
'use client';

import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Transaction, Category, SummarizeTransactionsOutput, Account } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { Pie, PieChart, Cell } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfToday, endOfToday } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Sparkles, PlusCircle, Wallet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { generateFinancialAdvice } from '@/lib/advice';
import { getCurrencySymbol } from '@/lib/currencies';

type ReportView = 'day' | 'week' | 'month' | 'overall';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(20, 80%, 50%)',
  'hsl(80, 80%, 50%)',
  'hsl(140, 80%, 50%)',
  'hsl(200, 80%, 50%)',
  'hsl(260, 80%, 50%)',
  'hsl(320, 80%, 50%)',
];

const CategoryPieChart = ({ data, title, description, config }: { data: any[], title: string, description: string, config: ChartConfig }) => (
  <Card>
    <CardHeader>
      <CardTitle className="font-headline">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      {data && data.length > 0 ? (
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[300px]">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
          </PieChart>
        </ChartContainer>
      ) : (
        <div className="flex justify-center items-center h-[300px] text-muted-foreground">{useTranslation().t('reports.noData')}</div>
      )}
    </CardContent>
  </Card>
);

type ReportData = {
    incomeByCategory: Record<string, number>;
    expenseByCategory: Record<string, number>;
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    incomeChartData: any[];
    expenseChartData: any[];
    incomeChartConfig: ChartConfig;
    expenseChartConfig: ChartConfig;
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();
  const [view, setView] = useState<ReportView>('month');
  const [aiSummary, setAiSummary] = useState<SummarizeTransactionsOutput | null>(null);
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);

  const transactionsCollectionRef = useMemoFirebase(() => user && collection(firestore, 'users', user.uid, 'transactions'), [user, firestore]);
  const categoriesCollectionRef = useMemoFirebase(() => user && collection(firestore, 'users', user.uid, 'categories'), [user, firestore]);
  const accountsCollectionRef = useMemoFirebase(() => user && collection(firestore, 'users', user.uid, 'accounts'), [user, firestore]);

  const { data: transactionsData } = useCollection<Transaction>(transactionsCollectionRef);
  const { data: categoriesData } = useCollection<Category>(categoriesCollectionRef);
  const { data: accountsData } = useCollection<Account>(accountsCollectionRef);


  const memoizedTransactions = useMemo(() => transactionsData, [transactionsData]);
  const memoizedCategories = useMemo(() => categoriesData, [categoriesData]);
  const memoizedAccounts = useMemo(() => accountsData, [accountsData]);


  const filteredTransactions = useMemo(() => {
    if (!memoizedTransactions) return [];
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfToday();

    switch (view) {
      case 'day':
        startDate = startOfToday();
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'overall':
      default:
        return memoizedTransactions;
    }
    return memoizedTransactions.filter(t => {
      const transactionDate = (t.date as any)?.toDate ? (t.date as any).toDate() : t.date;
      if (!(transactionDate instanceof Date) || isNaN(transactionDate.getTime())) {
          return false; // Skip invalid dates
      }
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }, [memoizedTransactions, view]);

  const reportsByCurrency = useMemo(() => {
    if (!filteredTransactions || !memoizedCategories || !memoizedAccounts) return {};
    
    const accountMap = new Map(memoizedAccounts.map(a => [a.id, a]));
    const categoryMap = new Map(memoizedCategories.map(c => [c.id, c]));
    
    const reports: Record<string, ReportData> = {};

    for (const transaction of filteredTransactions) {
      const account = accountMap.get(transaction.accountId);
      if (!account) continue;

      const currency = account.currency;
      if (!reports[currency]) {
        reports[currency] = {
          incomeByCategory: {},
          expenseByCategory: {},
          totalIncome: 0,
          totalExpenses: 0,
          netSavings: 0,
          incomeChartData: [],
          expenseChartData: [],
          incomeChartConfig: {},
          expenseChartConfig: {}
        };
      }
      
      const report = reports[currency];
      const category = categoryMap.get(transaction.categoryId);
      const categoryName = category ? category.name : 'Uncategorized';
      
      if (transaction.type === 'income') {
        report.incomeByCategory[categoryName] = (report.incomeByCategory[categoryName] || 0) + transaction.amount;
        report.totalIncome += transaction.amount;
      } else if (transaction.type === 'expense') {
        report.expenseByCategory[categoryName] = (report.expenseByCategory[categoryName] || 0) + transaction.amount;
        report.totalExpenses += transaction.amount;
      }
    }

    // Post-process to create chart data and configs for each currency
    for (const currency in reports) {
      const report = reports[currency];
      report.netSavings = report.totalIncome - report.totalExpenses;

      report.incomeChartData = Object.entries(report.incomeByCategory).map(([name, value], index) => ({
          name, value, fill: COLORS[index % COLORS.length]
      }));
      report.expenseChartData = Object.entries(report.expenseByCategory).map(([name, value], index) => ({
          name, value, fill: COLORS[index % COLORS.length]
      }));
      
      report.incomeChartConfig = report.incomeChartData.reduce((acc, entry) => {
          acc[entry.name] = { label: entry.name, color: entry.fill };
          return acc;
      }, {} as ChartConfig);
      report.expenseChartConfig = report.expenseChartData.reduce((acc, entry) => {
          acc[entry.name] = { label: entry.name, color: entry.fill };
          return acc;
      }, {} as ChartConfig);
    }
    
    return reports;
  }, [filteredTransactions, memoizedCategories, memoizedAccounts]);

  useEffect(() => {
    // Note: AI summary does not support multi-currency yet. 
    // It will use the data from the first currency found.
    const firstCurrency = Object.keys(reportsByCurrency)[0];
    if (!firstCurrency) {
        setAiSummary(null);
        return;
    }
    const mainReport = reportsByCurrency[firstCurrency];
    const generateSummary = () => {
      setIsAiSummaryLoading(true);
      const summary = generateFinancialAdvice({
          period: view,
          totalIncome: mainReport.totalIncome,
          totalExpenses: mainReport.totalExpenses,
          expenseByCategory: mainReport.expenseByCategory,
      });
      setAiSummary(summary);
      setIsAiSummaryLoading(false);
    };
    generateSummary();
  }, [view, reportsByCurrency]);
  

  if (!accountsData || accountsData.length === 0) {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader title={t('reports.title')} />
            <Card className="flex flex-col items-center justify-center py-20 text-center">
              <CardHeader>
                  <div className="mx-auto bg-secondary p-3 rounded-full">
                      <Wallet className="h-12 w-12 text-muted-foreground" />
                  </div>
                <CardTitle className="mt-4">Generate a report to start</CardTitle>
                <CardDescription>You need an account to generate a report. Add an account first.</CardDescription>
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
    <div className="flex flex-col gap-6">
      <PageHeader title={t('reports.title')} />
      <Tabs value={view} onValueChange={(value) => setView(value as ReportView)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="day">{t('common.day')}</TabsTrigger>
          <TabsTrigger value="week">{t('common.week')}</TabsTrigger>
          <TabsTrigger value="month">{t('common.month')}</TabsTrigger>
          <TabsTrigger value="overall">{t('reports.overall')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {Object.entries(reportsByCurrency).map(([currency, report]) => (
        <div key={currency} className="space-y-6 border-b pb-6 mb-6">
          <h2 className="text-2xl font-bold font-headline">{currency} {t('reports.summary')}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('reports.totalIncome')}</CardTitle>
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-headline text-green-500">+{getCurrencySymbol(currency)}{report.totalIncome.toLocaleString()}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('reports.totalExpenses')}</CardTitle>
                  <ArrowDownLeft className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-headline text-red-500">-{getCurrencySymbol(currency)}{report.totalExpenses.toLocaleString()}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('reports.netSavings')}</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-headline ${report.netSavings >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {getCurrencySymbol(currency)}{report.netSavings.toLocaleString()}
                    </div>
                </CardContent>
            </Card>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <CategoryPieChart 
              data={report.expenseChartData} 
              title={t('reports.spendingByCategory')}
              description={t('reports.spendingDescription')}
              config={report.expenseChartConfig}
            />
            <CategoryPieChart 
              data={report.incomeChartData} 
              title={t('reports.incomeByCategory')}
              description={t('reports.incomeDescription')}
              config={report.incomeChartConfig}
            />
          </div>
        </div>
      ))}

      {Object.keys(reportsByCurrency).length > 0 && (
         <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <Sparkles className="text-primary" />
              {t('reports.aiSummaryTitle')}
            </CardTitle>
            <CardDescription>{t('reports.aiSummaryDescription')} ({t('reports.mainCurrencyNote')})</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAiSummaryLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-4/5 mt-2" />
              </div>
            ) : (
              <Alert>
                <AlertTitle className="font-semibold">{t('reports.narrativeTitle')}</AlertTitle>
                <AlertDescription>
                  {aiSummary?.narrative}
                </AlertDescription>
                <AlertTitle className="font-semibold mt-4">{t('reports.adviceTitle')}</AlertTitle>
                <AlertDescription>
                  {aiSummary?.advice}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {Object.keys(reportsByCurrency).length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.noData')}</CardTitle>
            <CardDescription>{t('reports.noDataDescription')}</CardDescription>
          </CardHeader>
        </Card>
      )}

    </div>
  );
}

    

    