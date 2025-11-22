
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  LineChart,
  Settings,
  Repeat,
  Menu,
  WalletCards,
  PiggyBank,
  User as UserIcon,
} from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';
import { useLanguage, type Language } from '@/context/language-context';
import { useFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

const languages: Record<
  Language,
  { label: string; name: string }
> = {
  en: {
    label: 'EN',
    name: 'English',
  },
  fr: {
    label: 'FR',
    name: 'Français',
  },
  ar: {
    label: 'AR',
    name: 'العربية',
  },
};

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, auth } = useFirebase();
  const { toast } = useToast();
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar');
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();

  const navItems = [
    { href: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/accounts', label: t('nav.accounts'), icon: Wallet },
    { href: '/recurring', label: t('nav.recurring'), icon: Repeat },
    { href: '/transactions', label: t('nav.transactions'), icon: ArrowLeftRight },
    { href: '/budgets', label: t('nav.budgets'), icon: PiggyBank },
    { href: '/reports', label: t('nav.reports'), icon: LineChart },
    { href: '/categories', label: t('nav.categories'), icon: Tags },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Sign out failed:", error);
      toast({ variant: "destructive", title: "Sign Out Failed", description: "Could not sign you out. Please try again." });
    }
  };


  return (
    <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-50">
      <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
        <Link
          href="#"
          className="flex items-center gap-2 text-lg font-semibold md:text-base"
        >
          <WalletCards className="h-6 w-6 text-primary" />
          <span className="sr-only">BudgetWise</span>
        </Link>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'transition-colors hover:text-foreground',
              pathname === item.href
                ? 'text-foreground'
                : 'text-muted-foreground'
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="#"
              className="flex items-center gap-2 text-lg font-semibold"
            >
              <WalletCards className="h-6 w-6 text-primary" />
              <span className="sr-only">BudgetWise</span>
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'hover:text-foreground',
                  pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
        <div className="flex items-center gap-2">
            {(Object.keys(languages) as Language[]).map((key) => {
              const lang = languages[key];
              return (
                <Button
                  key={key}
                  variant={language === key ? "secondary" : "outline"}
                  onClick={() => setLanguage(key)}
                  className="gap-2"
                >
                  <span>{lang.label}</span>
                </Button>
              );
            })}
          </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.photoURL || undefined} alt="User avatar" />
                <AvatarFallback>
                  <UserIcon className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email || t('userMenu.myAccount')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              {t('userMenu.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>{t('userMenu.logout')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
