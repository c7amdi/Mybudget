
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
  WalletCards,
  PiggyBank,
  User as UserIcon,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';
import { useLanguage, type Language } from '@/context/language-context';
import { useFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    <header className="sticky top-0 flex h-auto flex-col border-b bg-background z-50">
        {/* Main Header Bar */}
        <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            <Link
                href="/"
                className="flex items-center gap-2 font-semibold"
            >
                <WalletCards className="h-6 w-6 text-primary" />
                <span className="hidden sm:inline-block">BudgetWise</span>
            </Link>
            
            <div className="flex w-full items-center justify-end gap-2">
                <div className="hidden items-center gap-2 sm:flex">
                    {(Object.keys(languages) as Language[]).map((key) => {
                    const lang = languages[key];
                    return (
                        <Button
                        key={key}
                        variant={language === key ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setLanguage(key)}
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
        </div>

        {/* Navigation Links Bar */}
        <nav className="h-14 w-full">
            {/* Desktop Navigation */}
            <div className="hidden md:flex h-full items-center justify-center gap-4 lg:gap-6 px-6">
                 {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                        'flex flex-col items-center gap-1 text-sm font-medium transition-colors hover:text-primary',
                        pathname === item.href
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        )}
                    >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden h-full w-full">
                <TooltipProvider delayDuration={0}>
                <ScrollArea className="h-full w-full whitespace-nowrap">
                    <div className="flex h-full items-center justify-start gap-2 px-4">
                        {navItems.map((item) => (
                            <Tooltip key={item.href}>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                        'flex h-12 w-12 flex-col items-center justify-center rounded-md transition-colors',
                                        pathname === item.href
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-muted-foreground hover:bg-muted'
                                        )}
                                    >
                                        <item.icon className="h-6 w-6" />
                                        <span className="sr-only">{item.label}</span>
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{item.label}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="h-1.5"/>
                </ScrollArea>
                </TooltipProvider>
            </div>
        </nav>
    </header>
  );
}
