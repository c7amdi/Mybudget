
import Papa from 'papaparse';
import { Transaction, Account, Category, RecurringTransaction, Budget } from './types';
import { Timestamp, Firestore, runTransaction, doc, collection, writeBatch, getDocs, DocumentData } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';

type AllData = {
    accounts?: Account[];
    categories?: Category[];
    transactions?: Transaction[];
    recurringTransactions?: RecurringTransaction[];
    budgets?: Budget[];
}

export function exportDataToJson(data: AllData): void {
  // Convert Timestamps to a serializable format for JSON
  const serializableData = JSON.stringify(data, (key, value) => {
    if (value && value._type === 'Timestamp') {
      return {
        _type: 'timestamp',
        seconds: value.seconds,
        nanoseconds: value.nanoseconds,
      };
    }
    // Handle Date objects
    if (value instanceof Date) {
        return {
            _type: 'date',
            iso: value.toISOString(),
        };
    }
    if (value instanceof Timestamp) {
        return {
            _type: 'timestamp',
            seconds: value.seconds,
            nanoseconds: value.nanoseconds,
        };
    }
    return value;
  }, 2);
  
  const blob = new Blob([serializableData], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'budgetwise_data.json');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


export async function importDataFromJson(file: File, firestore: Firestore, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (!event.target?.result) {
                return reject(new Error('File is empty or could not be read.'));
            }
            try {
                const dataString = event.target.result as string;
                // Re-hydrate Timestamps and Dates from the special format
                const data: AllData = JSON.parse(dataString, (key, value) => {
                    if (value && value._type === 'timestamp') {
                        return new Timestamp(value.seconds, value.nanoseconds);
                    }
                    if (value && value._type === 'date') {
                        return new Date(value.iso);
                    }
                    return value;
                });

                const batch = writeBatch(firestore);

                // Define the order of import
                const collectionsInOrder: (keyof AllData)[] = ['accounts', 'categories', 'transactions', 'recurringTransactions', 'budgets'];

                for (const collectionName of collectionsInOrder) {
                    const collectionData = data[collectionName];
                    if (collectionData && Array.isArray(collectionData)) {
                        for (const item of collectionData as any[]) {
                             if (!item.id) {
                                console.warn(`Skipping item without id in ${collectionName}:`, item);
                                continue;
                            }
                            const { id, ...itemData } = item;
                            
                            // Convert any Date objects to Timestamps before writing
                            for(const key in itemData) {
                                if (itemData[key] instanceof Date) {
                                    itemData[key] = Timestamp.fromDate(itemData[key]);
                                }
                            }

                            const ref = doc(firestore, `users/${userId}/${collectionName}`, id);
                            batch.set(ref, itemData, { merge: true });
                        }
                    }
                }

                await batch.commit();
                resolve();

            } catch (error) {
                console.error("Error importing JSON:", error);
                reject(new Error("Failed to parse or import JSON file. Please ensure it's a valid export file."));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
}


export async function exportTransactionsToCsv(transactions: Transaction[], accounts: Account[], categories: Category[]): Promise<void> {
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const dataForCsv = transactions.map(t => {
        const account = accountMap.get(t.accountId);
        const category = categoryMap.get(t.categoryId);
        const date = t.date instanceof Timestamp ? t.date.toDate() : t.date;
        return {
            Date: format(date, 'yyyy-MM-dd'),
            Description: t.description,
            Type: t.type,
            Amount: t.amount,
            Currency: account?.currency || '',
            AccountName: account?.name || 'N/A',
            CategoryName: category?.name || 'N/A',
        };
    });

    const csv = Papa.unparse(dataForCsv);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'transactions.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// Type for a row in the CSV file
type CsvRow = {
  Date: string;
  Description: string;
  Type: 'income' | 'expense';
  Amount: string;
  Currency: string;
  AccountName: string;
  CategoryName: string;
};

export async function importFromCsv(file: File, firestore: Firestore, userId: string): Promise<void> {
    
    // 1. Fetch existing accounts and categories to avoid duplicates
    const accountsRef = collection(firestore, `users/${userId}/accounts`);
    const categoriesRef = collection(firestore, `users/${userId}/categories`);
    const [accountsSnap, categoriesSnap] = await Promise.all([getDocs(accountsRef), getDocs(categoriesRef)]);
    
    const existingAccounts = new Map(accountsSnap.docs.map(doc => [doc.data().name, {id: doc.id, currency: doc.data().currency}]));
    const existingCategories = new Map(categoriesSnap.docs.map(doc => [doc.data().name, doc.id]));
    
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as CsvRow[];

                try {
                    const batch = writeBatch(firestore);
                    
                    for (const row of rows) {
                        // Validate row data
                        if (!row.Date || !row.Description || !row.Amount || !row.AccountName || !row.CategoryName) {
                           console.warn("Skipping invalid row:", row);
                           continue;
                        }
                        
                        const currency = row.Currency || 'USD'; // Default to USD if not specified

                        // --- Find or Create Account ---
                        let accountId = existingAccounts.get(row.AccountName)?.id;
                        if (!accountId) {
                             const newAccountRef = doc(collection(firestore, `users/${userId}/accounts`));
                             accountId = newAccountRef.id;
                             const newAccountData: Omit<Account, 'id'> = {
                                 name: row.AccountName,
                                 currency: currency,
                                 balance: 0, // Balance will be calculated in a separate transaction
                                 type: 'Bank', // Default type
                             };
                             batch.set(newAccountRef, newAccountData);
                             existingAccounts.set(row.AccountName, { id: accountId, currency: currency }); // Add to map to reuse in this batch
                        }

                        // --- Find or Create Category ---
                        let categoryId = existingCategories.get(row.CategoryName);
                         if (!categoryId) {
                             const newCategoryRef = doc(collection(firestore, `users/${userId}/categories`));
                             categoryId = newCategoryRef.id;
                             const newCategoryData: Omit<Category, 'id'> = {
                                 name: row.CategoryName,
                                 type: row.Type,
                             };
                             batch.set(newCategoryRef, newCategoryData);
                             existingCategories.set(row.CategoryName, categoryId); // Add to map
                         }
                        
                        // --- Create Transaction ---
                        const amount = parseFloat(row.Amount);
                        if (isNaN(amount)) {
                            console.warn("Skipping row with invalid amount:", row);
                            continue;
                        }

                        const transactionDate = parseISO(row.Date);

                        const newTransactionRef = doc(collection(firestore, `users/${userId}/transactions`));
                        const transactionData: Omit<Transaction, 'id'> = {
                            description: row.Description,
                            amount: amount,
                            type: row.Type,
                            date: Timestamp.fromDate(transactionDate),
                            accountId: accountId,
                            categoryId: categoryId,
                        };
                        batch.set(newTransactionRef, transactionData);
                    }
                    
                    // Commit all new accounts, categories and transactions
                    await batch.commit();
                    
                    // Now, run a transaction to update balances correctly
                    await runTransaction(firestore, async (transaction) => {
                         const accountBalanceUpdates = new Map<string, number>();
                         
                         for (const row of rows) {
                            const account = existingAccounts.get(row.AccountName);
                            if (!account) continue;
                            
                            const amount = parseFloat(row.Amount);
                             if (isNaN(amount)) continue;
                             
                            const currentUpdate = accountBalanceUpdates.get(account.id) || 0;
                            const change = row.Type === 'income' ? amount : -amount;
                            accountBalanceUpdates.set(account.id, currentUpdate + change);
                         }
                         
                         // Fetch all account docs within the transaction
                        const accountRefs = Array.from(accountBalanceUpdates.keys()).map(id => doc(firestore, `users/${userId}/accounts`, id));
                        const accountDocs = await Promise.all(accountRefs.map(ref => transaction.get(ref)));

                        for (let i = 0; i < accountDocs.length; i++) {
                            const accountDoc = accountDocs[i];
                            const accountId = accountRefs[i].id;
                            const balanceChange = accountBalanceUpdates.get(accountId) || 0;

                            if(accountDoc.exists()) {
                               const newBalance = (accountDoc.data().balance || 0) + balanceChange;
                               transaction.update(accountDoc.ref, { balance: newBalance });
                            }
                        }
                    });

                    resolve();
                } catch (error) {
                    console.error("Error during batch write:", error);
                    reject(new Error('Failed to write data to the database.'));
                }
            },
            error: (error: Error) => {
                console.error('CSV Parsing Error:', error);
                reject(new Error('Failed to parse CSV file.'));
            },
        });
    });
}
