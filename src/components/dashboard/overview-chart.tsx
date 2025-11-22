
"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Legend, Line } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { getCurrencySymbol } from "@/lib/currencies"

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(var(--chart-1))",
  },
  expense: {
    label: "Expense",
    color: "hsl(var(--chart-2))",
  },
  balance: {
      label: "Balance",
      color: "hsl(var(--chart-4))",
  }
} satisfies ChartConfig


type CurrencyOverviewChartProps = {
  data: { name: string; income: number; expense: number; netFlow: number, balance: number }[];
  currency: string;
};

export function CurrencyOverviewChart({ data, currency }: CurrencyOverviewChartProps) {
  const currencySymbol = getCurrencySymbol(currency);
  
  return (
    <ChartContainer config={chartConfig} className="min-h-[350px] w-full">
      <AreaChart accessibilityLayer data={data}>
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
          tickFormatter={(value) => value.slice(0, 3)}
        />
        <YAxis
          yAxisId="left"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tickFormatter={(value) => `${currencySymbol}${value / 1000}k`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          tickFormatter={(value) => `${currencySymbol}${value / 1000}k`}
        />
        <ChartTooltip
          content={<ChartTooltipContent
            formatter={(value, name, props) => {
              const label = chartConfig[name as keyof typeof chartConfig]?.label || name;
              const formattedValue = `${currencySymbol}${Number(value).toLocaleString()}`;
              return `${label}: ${formattedValue}`;
            }}
            labelFormatter={(label) => <div className="font-bold">{label}</div>}
           />}
        />
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
  );
}
