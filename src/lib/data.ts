
import {
  Car,
  UtensilsCrossed,
  Home,
  Shirt,
  ShoppingBag,
  Gift,
  Briefcase,
  TrendingUp,
  Landmark,
  CreditCard,
  Wallet,
  HeartPulse,
  BookOpen,
  Ticket,
  Plane,
  PawPrint,
  Baby,
  GraduationCap,
  Hammer,
  Receipt,
  PiggyBank,
  HandCoins,
  ArrowRightLeft,
} from "lucide-react";
import type { UIAccount, UICategory, Transaction, Account, Category } from "./types";

// Categories
export const expenseCategories: Omit<UICategory, 'id' | 'type'>[] = [
  { name: "Food & Drink", icon: UtensilsCrossed },
  { name: "Groceries", icon: ShoppingBag, parent: "Food & Drink" },
  { name: "Restaurants", icon: UtensilsCrossed, parent: "Food & Drink" },
  { name: "Coffee Shops", icon: UtensilsCrossed, parent: "Food & Drink" },

  { name: "Housing", icon: Home },
  { name: "Rent/Mortgage", icon: Home, parent: "Housing" },
  { name: "Utilities", icon: Receipt, parent: "Housing" },
  { name: "Maintenance", icon: Hammer, parent: "Housing" },

  { name: "Transportation", icon: Car },
  { name: "Gas/Fuel", icon: Car, parent: "Transportation" },
  { name: "Public Transit", icon: Car, parent: "Transportation" },
  { name: "Ride Share", icon: Car, parent: "Transportation" },
  { name: "Repairs", icon: Hammer, parent: "Transportation" },

  { name: "Health & Wellness", icon: HeartPulse },
  { name: "Doctor", icon: HeartPulse, parent: "Health & Wellness" },
  { name: "Pharmacy", icon: HeartPulse, parent: "Health & Wellness" },
  { name: "Gym", icon: HeartPulse, parent: "Health & Wellness" },

  { name: "Entertainment", icon: Ticket },
  { name: "Movies", icon: Ticket, parent: "Entertainment" },
  { name: "Concerts", icon: Ticket, parent: "Entertainment" },
  { name: "Streaming", icon: Ticket, parent: "Entertainment" },
  
  { name: "Shopping", icon: ShoppingBag },
  { name: "Clothing", icon: Shirt, parent: "Shopping" },
  { name: "Electronics", icon: ShoppingBag, parent: "Shopping" },
  { name: "Hobbies", icon: Gift, parent: "Shopping" },

  { name: "Personal Care", icon: Shirt },
  { name: "Education", icon: GraduationCap },
  { name: "Travel", icon: Plane },
  { name: "Pets", icon: PawPrint },
  { name: "Kids", icon: Baby },
  { name: "Taxes", icon: Receipt },
  { name: "Gifts & Donations", icon: Gift },
].map(c => ({ ...c, type: 'expense' as const }));

export const incomeCategories: Omit<UICategory, 'id' | 'type'>[] = [
  { name: "Salary", icon: Briefcase },
  { name: "Freelance", icon: TrendingUp },
  { name: "Investment", icon: Landmark },
  { name: "Rental Income", icon: Home },
  { name: "Gifts", icon: Gift },
  { name: "Bonuses", icon: HandCoins },
  { name: "Other", icon: PiggyBank },
].map(c => ({ ...c, type: 'income' as const }));

export const transferCategories: Omit<UICategory, 'id' | 'type'>[] = [
    { name: "Transfer", icon: ArrowRightLeft }
].map(c => ({ ...c, type: 'transfer' as const }));

export const allCategories = [...expenseCategories, ...incomeCategories, ...transferCategories].map(c => ({...c, id: c.name.toLowerCase().replace(/ /g, '-').replace(/\//g, '-') }));


// Accounts
export const accounts: UIAccount[] = [
  {
    id: "acc1",
    name: "Main Bank Account",
    type: "Bank",
    balance: 5250.75,
    currency: "USD",
    icon: Landmark,
  },
  {
    id: "acc2",
    name: "Credit Card",
    type: "Credit Card",
    balance: -430.5,
    currency: "USD",
    icon: CreditCard,
  },
  {
    id: "acc3",
    name: "Cash",
    type: "Cash",
    balance: 300,
    currency: "USD",
    icon: Wallet,
  },
   {
    id: "acc4",
    name: "Savings",
    type: "Bank",
    balance: 12800,
    currency: "USD",
    icon: Landmark,
  },
];

type TransactionWithRelations = Transaction & { category: Category, account: Account };

// Transactions
export const transactions: TransactionWithRelations[] = [
  {
    id: "txn1",
    type: "income",
    amount: 3500,
    date: new Date("2024-05-01"),
    description: "Monthly Salary",
    categoryId: "salary",
    accountId: "acc1",
    category: allCategories.find((c) => c.id === "salary")!,
    account: accounts.find((a) => a.id === "acc1")!,
  },
  {
    id: "txn2",
    type: "expense",
    amount: 850,
    date: new Date("2024-05-02"),
    description: "Apartment Rent",
    categoryId: "rent-mortgage",
    accountId: "acc1",
    category: allCategories.find((c) => c.id === "rent-mortgage")!,
    account: accounts.find((a) => a.id === "acc1")!,
  },
  {
    id: "txn3",
    type: "expense",
    amount: 55.6,
    date: new Date("2024-05-03"),
    description: "Grocery shopping at Walmart",
    categoryId: "groceries",
    accountId: "acc2",
    category: allCategories.find((c) => c.id === "groceries")!,
    account: accounts.find((a) => a.id === "acc2")!,
  },
  {
    id: "txn4",
    type: "expense",
    amount: 32.5,
    date: new Date("2024-05-05"),
    description: "Gasoline for car",
    categoryId: "gas-fuel",
    accountId: "acc2",
    category: allCategories.find((c) => c.id === "gas-fuel")!,
    account: accounts.find((a) => a.id === "acc2")!,
  },
  {
    id: "txn5",
    type: "expense",
    amount: 120,
    date: new Date("2024-05-07"),
    description: "New pair of jeans",
    categoryId: "clothing",
    accountId: "acc2",
    category: allCategories.find((c) => c.id === "clothing")!,
    account: accounts.find((a) => a.id === "acc2")!,
  },
  {
    id: "txn6",
    type: "income",
    amount: 450,
    date: new Date("2024-05-10"),
    description: "Web design project",
    categoryId: "freelance",
    accountId: "acc1",
    category: allCategories.find((c) => c.id === "freelance")!,
    account: accounts.find((a) => a.id === "acc1")!,
  },
  {
    id: "txn7",
    type: "expense",
    amount: 25.0,
    date: new Date("2024-05-12"),
    description: "Lunch with friends",
    categoryId: "restaurants",
    accountId: "acc3",
    category: allCategories.find((c) => c.id === "restaurants")!,
    account: accounts.find((a) => a.id === "acc3")!,
  },
];

export const recentTransactions = transactions.slice(0, 5);

export const monthlySummary = {
  totalBalance: accounts.reduce((sum, acc) => sum + acc.balance, 0),
  income: transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0),
  expenses: transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0),
};

export const overviewChartData = [
  { name: "Jan", income: 4000, expense: 2400 },
  { name: "Feb", income: 3000, expense: 1398 },
  { name: "Mar", income: 5000, expense: 3800 },
  { name: "Apr", income: 2780, expense: 3908 },
  { name: "May", income: 1890, expense: 4800 },
  { name: "Jun", income: 2390, expense: 3800 },
];


export const spendingByCategoryData = expenseCategories.map(category => ({
  name: category.name,
  value: transactions.filter(t => t.categoryId === category.name.toLowerCase().replace(/ /g, '-').replace(/\//g, '-') && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
  fill: `var(--color-${category.name.toLowerCase()})`
}));
