/**
 * Shopping List AI - generate and manage smart shopping lists.
 *
 * Design goals:
 * - Multiple lists (store-based, trip-based, weekly lists).
 * - Items with quantities, units, categories, and AI suggestion link.
 */

import { defineTable, column, NOW } from "astro:db";

export const ShoppingLists = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    name: column.text(),                           // "Weekly Groceries", "Party Shopping"
    storeName: column.text({ optional: true }),    // "Carrefour", "Lulu", etc.
    notes: column.text({ optional: true }),

    isArchived: column.boolean({ default: false }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const ShoppingListItems = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    listId: column.text({
      references: () => ShoppingLists.columns.id,
    }),
    userId: column.text(),

    name: column.text(),                           // "Tomatoes", "Milk"
    quantity: column.number({ optional: true }),
    unit: column.text({ optional: true }),         // "kg", "litre", "pcs"
    category: column.text({ optional: true }),     // "vegetables", "dairy", etc.

    isChecked: column.boolean({ default: false }), // purchased or not
    isAiSuggested: column.boolean({ default: false }),
    aiContext: column.text({ optional: true }),    // reason: "based on your recipe", etc.

    notes: column.text({ optional: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const tables = {
  ShoppingLists,
  ShoppingListItems,
} as const;
