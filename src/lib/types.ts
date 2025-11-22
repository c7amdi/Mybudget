
import type { LucideIcon } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { z } from "zod";

export type Transaction = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: Timestamp | Date;
  description: string;
  categoryId: string;
  accountId: string;
  // For transfers
  fromAccountId?: string;
  toAccountId?: string;
  // For recurring
  isRecurring?: boolean;
  frequency?: "monthly" | "quarterly" | "semi-annually" | "yearly";
  startDate?: Timestamp | Date;
  nextDueDate?: Timestamp | Date;
};

export type RecurringTransaction = {
    id: string;
    accountId: string;
    categoryId: string;
    amount: number;
    description: string;
    type: "income" | "expense";
    frequency: "monthly" | "quarterly" | "semi-annually" | "yearly";
    startDate: Timestamp | Date;
    endDate?: Timestamp | Date | null;
    nextDueDate: Timestamp | Date;
    isActive: boolean;
};

export type Budget = {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Timestamp | Date;
  accountIds: string[];
};

export type Category = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  parent?: string;
};

export type UICategory = Category & {
  icon: LucideIcon;
  subcategories?: UICategory[];
};

export type Account = {
  id: string;
  name: string;
  type: "Cash" | "Bank" | "Credit Card";
  balance: number;
  currency: string;
};

export type UIAccount = Account & {
  icon: LucideIcon;
};

export type Currency = {
  id: string;
  name: string;
  code: string;
  symbol: string;
};

export type SummarizeTransactionsOutput = {
  narrative: string;
  advice: string;
}
