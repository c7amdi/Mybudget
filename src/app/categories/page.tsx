
"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { allCategories as allUICategories } from "@/lib/data";
import { PlusCircle, ChevronRight, ChevronDown, Edit, Trash2 } from "lucide-react";
import type { Category as CategoryType, UICategory } from "@/lib/types";
import { useMemo, useState } from "react";
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
} from "@/components/ui/select";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import {
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
  setDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { cn } from "@/lib/utils";
import { useTranslation } from '@/hooks/use-translation';

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["income", "expense"]),
  parent: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

function CategoryForm({
  category,
  onSave,
  onClose,
  categories,
}: {
  category?: CategoryType;
  onSave: (category: CategoryFormValues) => void;
  onClose: () => void;
  categories: CategoryType[];
}) {
  const { t } = useTranslation();
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: category
      ? { ...category }
      : { name: "", type: "expense" },
  });

  const onSubmit = (values: CategoryFormValues) => {
    onSave({ ...values, id: category?.id });
    onClose();
  };
  
  const categoryType = form.watch("type");

  const parentCategories = useMemo(() => {
    return categories.filter(c => c.type === categoryType && !c.parent)
  }, [categories, categoryType]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('categories.form.name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('categories.form.namePlaceholder')} {...field} />
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
                <FormLabel>{t('categories.form.type')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('categories.form.typePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="expense">{t('categories.types.expense')}</SelectItem>
                    <SelectItem value="income">{t('categories.types.income')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="parent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('categories.form.parent')}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('categories.form.parentPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">{t('categories.form.noParent')}</SelectItem>
                    {parentCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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

export default function CategoriesPage() {
  const { t } = useTranslation();
  const { user } = useUser();
  const firestore = useFirestore();

  const categoriesCollectionRef = useMemoFirebase(
    () => user && collection(firestore, "users", user.uid, "categories"),
    [user, firestore]
  );
  const { data: categoriesData } = useCollection<CategoryType>(categoriesCollectionRef);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryType | undefined>(undefined);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const allCategories = useMemo(() => {
    const uiCategoryMap = new Map(allUICategories.map(c => [c.name, c.icon]));
    const categories = (categoriesData || []).map(cat => ({
      ...cat,
      icon: uiCategoryMap.get(cat.name) || PlusCircle,
    }));

    const categoryMap = new Map(categories.map(c => [c.id, {...c, subcategories: [] as UICategory[]}]));
    
    const hierarchicalCategories: UICategory[] = [];

    for (const category of categories) {
      if (category.parent && categoryMap.has(category.parent)) {
        const parentCat = categoryMap.get(category.parent);
        if (parentCat) {
          parentCat.subcategories.push(category as UICategory);
        }
      } else {
         const catFromMap = categoryMap.get(category.id);
         if (catFromMap) {
            hierarchicalCategories.push(catFromMap);
         }
      }
    }
    
    // Find the parent by name, since that's what the form uses
    const categoryNameMap = new Map(categories.map(c => [c.name, c]));
    for (const category of categories) {
        if (category.parent && categoryNameMap.has(category.parent)) {
            const parentCat = categoryNameMap.get(category.parent);
            if(parentCat && !hierarchicalCategories.find(c => c.id === parentCat.id)) {
                // This is a sub-category whose parent is not in the top level, add it.
            }
        }
    }

    const finalCategories: UICategory[] = [];
    const addedIds = new Set<string>();

    for (const category of categories) {
        if (category.parent) {
            const parent = categoryNameMap.get(category.parent);
            if (parent && !addedIds.has(parent.id)) {
                 const parentWithSubcategories = categoryMap.get(parent.id);
                 if (parentWithSubcategories) {
                    finalCategories.push(parentWithSubcategories);
                    addedIds.add(parent.id);
                 }
            }
        } else {
             if (!addedIds.has(category.id)) {
                const catWithSubcategories = categoryMap.get(category.id);
                if (catWithSubcategories) {
                    finalCategories.push(catWithSubcategories);
                    addedIds.add(category.id);
                }
            }
        }
    }

    // This logic is getting complex. A simpler way:
    const cats = (categoriesData || []).map(cat => ({
      ...cat,
      icon: uiCategoryMap.get(cat.name) || PlusCircle,
    }));

    const catMap = new Map(cats.map(c => [c.id, { ...c, subcategories: [] as UICategory[] }]));
    const rootCategories: UICategory[] = [];

    for (const cat of catMap.values()) {
      if (cat.parent) {
        const parent = Array.from(catMap.values()).find(c => c.name === cat.parent);
        if (parent) {
          parent.subcategories.push(cat);
        } else {
          rootCategories.push(cat); // Orphaned subcategory
        }
      } else {
        rootCategories.push(cat);
      }
    }
    
    return rootCategories;

  }, [categoriesData]);

  const expenseCategories = useMemo(() => allCategories.filter(c => c.type === 'expense'), [allCategories]);
  const incomeCategories = useMemo(() => allCategories.filter(c => c.type === 'income'), [allCategories]);

  const handleSaveCategory = (categoryData: CategoryFormValues) => {
    if (!categoriesCollectionRef) return;
    const { id, ...dataToSave } = categoryData;
    
    if (dataToSave.parent === 'none') {
        dataToSave.parent = undefined;
    }

    if (id) {
      const docRef = doc(categoriesCollectionRef, id);
      setDocumentNonBlocking(docRef, dataToSave, { merge: true });
    } else {
      // For new categories, generate an ID from the name
      const newId = dataToSave.name.toLowerCase().replace(/ /g, '-').replace(/\//g, '-');
      const docRef = doc(categoriesCollectionRef, newId);
      addDocumentNonBlocking(categoriesCollectionRef, dataToSave);
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!categoriesCollectionRef) return;
    const docRef = doc(categoriesCollectionRef, categoryId);
    deleteDocumentNonBlocking(docRef);
  };
  
  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => ({...prev, [categoryId]: !prev[categoryId]}));
  }

  const CategoryList = ({
    categories,
    level = 0,
  }: {
    categories: UICategory[];
    level?: number;
  }) => (
    <ul className="space-y-1">
      {categories.map((category) => (
        <li key={category.id}>
          <div
            className={cn("flex items-center gap-2 rounded-md p-2", level > 0 && "pl-8")}
          >
            {category.subcategories && category.subcategories.length > 0 ? (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleCategory(category.id)}>
                    {openCategories[category.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
            ) : <div className="w-8 shrink-0"></div>}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <category.icon className="h-5 w-5" />
            </div>
            <span className="flex-1 font-medium">{category.name}</span>
            <div className="flex items-center gap-2">
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                        setEditingCategory(category);
                        setIsFormOpen(true);
                    }}
                >
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">{t('categories.actions.edit')}</span>
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:text-red-500"
                    onClick={() => handleDeleteCategory(category.id)}
                >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">{t('categories.actions.delete')}</span>
                </Button>
            </div>
          </div>
           {openCategories[category.id] && category.subcategories && category.subcategories.length > 0 && (
             <div className="pl-12">
                <CategoryList categories={category.subcategories} level={level + 1} />
             </div>
           )}
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog
      open={isFormOpen}
      onOpenChange={(open) => {
        setIsFormOpen(open);
        if (!open) setEditingCategory(undefined);
      }}
    >
      <div className="flex flex-col gap-6">
        <PageHeader title={t('categories.title')}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingCategory(undefined); setIsFormOpen(true); }}>
              <PlusCircle />
              {t('categories.addCategory')}
            </Button>
          </DialogTrigger>
        </PageHeader>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">{t('categories.manageTitle')}</CardTitle>
            <CardDescription>
              {t('categories.manageDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="expenses" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expenses">{t('categories.tabs.expense')}</TabsTrigger>
                <TabsTrigger value="income">{t('categories.tabs.income')}</TabsTrigger>
              </TabsList>
              <TabsContent value="expenses" className="mt-6">
                <CategoryList categories={expenseCategories} />
              </TabsContent>
              <TabsContent value="income" className="mt-6">
                <CategoryList categories={incomeCategories} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingCategory ? t('categories.editCategory') : t('categories.addCategory')}
          </DialogTitle>
        </DialogHeader>
        <CategoryForm
          category={editingCategory}
          onSave={handleSaveCategory}
          onClose={() => setIsFormOpen(false)}
          categories={categoriesData || []}
        />
      </DialogContent>
    </Dialog>
  );
}
