
import type { SummarizeTransactionsOutput } from './types';

interface AdviceEngineInput {
    period: string;
    totalIncome: number;
    totalExpenses: number;
    expenseByCategory: Record<string, number>;
}

export function generateFinancialAdvice(input: AdviceEngineInput): SummarizeTransactionsOutput {
    const { period, totalIncome, totalExpenses, expenseByCategory } = input;
    const netSavings = totalIncome - totalExpenses;

    let narrative = '';
    let advice = '';

    // Handle case with no transactions
    if (totalIncome === 0 && totalExpenses === 0) {
        return {
            narrative: `You had no transactions for this ${period}. Start by adding some to see your financial analysis.`,
            advice: 'Try adding a few transactions for this period. Even small ones count!'
        };
    }

    // Determine the highest spending category
    const spendingCategories = Object.entries(expenseByCategory);
    let highestSpendingCategory = { name: '', amount: 0 };
    if (spendingCategories.length > 0) {
        highestSpendingCategory = spendingCategories.reduce((max, current) => {
            return current[1] > max.amount ? { name: current[0], amount: current[1] } : max;
        }, { name: spendingCategories[0][0], amount: spendingCategories[0][1] });
    }

    // --- Generate Narrative ---
    narrative = `For this ${period}, your total income was $${totalIncome.toLocaleString()} and your expenses were $${totalExpenses.toLocaleString()}. `;

    if (netSavings > 0) {
        narrative += `You did a great job, saving $${netSavings.toLocaleString()}! `;
    } else {
        narrative += `You spent $${Math.abs(netSavings).toLocaleString()} more than you earned. `;
    }

    if (highestSpendingCategory.name && highestSpendingCategory.amount > 0) {
        const percentageOfTotal = ((highestSpendingCategory.amount / totalExpenses) * 100).toFixed(0);
        narrative += `Your largest spending area was "${highestSpendingCategory.name}", accounting for about ${percentageOfTotal}% of your total expenses.`;
    } else if (totalExpenses > 0) {
        narrative += "Your spending was spread across various categories.";
    }

    // --- Generate Advice ---
    if (netSavings > totalIncome * 0.2) {
        advice = 'You are saving a healthy portion of your income. Keep up the great work! You could consider investing some of your savings to grow your wealth further.';
    } else if (netSavings > 0) {
        advice = `You're on the right track by spending less than you earn. To increase your savings, take a closer look at your top spending category, "${highestSpendingCategory.name}", to see if there are any small cuts you can make.`;
    } else {
        advice = `You're currently in a deficit, but don't worry. The first step is to review your spending, especially in the "${highestSpendingCategory.name}" category, and identify areas where you can cut back. Creating a budget could be very helpful.`;
    }
    
    if (spendingCategories.length > 3) {
        advice += ' You have multiple spending categories; consolidating or finding patterns might reveal more saving opportunities.'
    }


    return { narrative, advice };
}

