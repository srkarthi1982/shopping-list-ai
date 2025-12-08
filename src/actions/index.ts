import type { ActionAPIContext } from "astro:actions";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import {
  ShoppingListItems,
  ShoppingLists,
  and,
  db,
  desc,
  eq,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

export const server = {
  createShoppingList: defineAction({
    input: z.object({
      name: z.string().min(1),
      storeName: z.string().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const list = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: input.name,
        storeName: input.storeName,
        notes: input.notes,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      } satisfies typeof ShoppingLists.$inferInsert;

      await db.insert(ShoppingLists).values(list);

      return {
        success: true,
        data: { list },
      };
    },
  }),

  updateShoppingList: defineAction({
    input: z.object({
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      storeName: z.string().optional(),
      notes: z.string().optional(),
      isArchived: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const [existing] = await db
        .select()
        .from(ShoppingLists)
        .where(and(eq(ShoppingLists.id, input.id), eq(ShoppingLists.userId, user.id)));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Shopping list not found.",
        });
      }

      const updates: Partial<typeof ShoppingLists.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.storeName !== undefined) updates.storeName = input.storeName;
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

      await db
        .update(ShoppingLists)
        .set(updates)
        .where(and(eq(ShoppingLists.id, input.id), eq(ShoppingLists.userId, user.id)));

      return {
        success: true,
        data: {
          list: {
            ...existing,
            ...updates,
          },
        },
      };
    },
  }),

  listMyShoppingLists: defineAction({
    input: z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(20),
      includeArchived: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const conditions = [eq(ShoppingLists.userId, user.id)];

      if (!input.includeArchived) {
        conditions.push(eq(ShoppingLists.isArchived, false));
      }

      const whereClause =
        conditions.length === 1 ? conditions[0] : and(...conditions);
      const offset = (input.page - 1) * input.pageSize;

      const [lists, totalResult] = await Promise.all([
        db
          .select()
          .from(ShoppingLists)
          .where(whereClause)
          .orderBy(desc(ShoppingLists.updatedAt))
          .limit(input.pageSize)
          .offset(offset),
        db.select().from(ShoppingLists).where(whereClause),
      ]);

      return {
        success: true,
        data: {
          items: lists,
          total: totalResult.length,
          page: input.page,
          pageSize: input.pageSize,
        },
      };
    },
  }),

  getShoppingListWithItems: defineAction({
    input: z.object({
      id: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [list] = await db
        .select()
        .from(ShoppingLists)
        .where(and(eq(ShoppingLists.id, input.id), eq(ShoppingLists.userId, user.id)));

      if (!list) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Shopping list not found.",
        });
      }

      const items = await db
        .select()
        .from(ShoppingListItems)
        .where(
          and(
            eq(ShoppingListItems.listId, input.id),
            eq(ShoppingListItems.userId, user.id),
          ),
        )
        .orderBy(desc(ShoppingListItems.updatedAt));

      return {
        success: true,
        data: { list, items },
      };
    },
  }),

  upsertShoppingListItem: defineAction({
    input: z.object({
      id: z.string().min(1).optional(),
      listId: z.string().min(1),
      name: z.string().min(1),
      quantity: z.number().positive().optional(),
      unit: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      notes: z.string().optional(),
      isChecked: z.boolean().optional(),
      isAiSuggested: z.boolean().optional(),
      aiContext: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const [list] = await db
        .select()
        .from(ShoppingLists)
        .where(and(eq(ShoppingLists.id, input.listId), eq(ShoppingLists.userId, user.id)));

      if (!list) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Shopping list not found.",
        });
      }

      const now = new Date();
      let itemId = input.id;

      if (itemId) {
        const [existingItem] = await db
          .select()
          .from(ShoppingListItems)
          .where(
            and(
              eq(ShoppingListItems.id, itemId),
              eq(ShoppingListItems.userId, user.id),
              eq(ShoppingListItems.listId, input.listId),
            ),
          );

        if (!existingItem) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Shopping list item not found.",
          });
        }

        const updates: Partial<typeof ShoppingListItems.$inferInsert> = {
          updatedAt: now,
        };

        if (input.name !== undefined) updates.name = input.name;
        if (input.quantity !== undefined) updates.quantity = input.quantity;
        if (input.unit !== undefined) updates.unit = input.unit;
        if (input.category !== undefined) updates.category = input.category;
        if (input.notes !== undefined) updates.notes = input.notes;
        if (input.isChecked !== undefined) updates.isChecked = input.isChecked;
        if (input.isAiSuggested !== undefined) updates.isAiSuggested = input.isAiSuggested;
        if (input.aiContext !== undefined) updates.aiContext = input.aiContext;

        await db
          .update(ShoppingListItems)
          .set(updates)
          .where(
            and(
              eq(ShoppingListItems.id, itemId),
              eq(ShoppingListItems.userId, user.id),
              eq(ShoppingListItems.listId, input.listId),
            ),
          );
      } else {
        itemId = crypto.randomUUID();

        await db.insert(ShoppingListItems).values({
          id: itemId,
          listId: input.listId,
          userId: user.id,
          name: input.name,
          quantity: input.quantity,
          unit: input.unit,
          category: input.category,
          notes: input.notes,
          isChecked: input.isChecked ?? false,
          isAiSuggested: input.isAiSuggested ?? false,
          aiContext: input.aiContext,
          createdAt: now,
          updatedAt: now,
        });
      }

      await db
        .update(ShoppingLists)
        .set({ updatedAt: now })
        .where(and(eq(ShoppingLists.id, input.listId), eq(ShoppingLists.userId, user.id)));

      const [item] = await db
        .select()
        .from(ShoppingListItems)
        .where(
          and(
            eq(ShoppingListItems.id, itemId),
            eq(ShoppingListItems.userId, user.id),
            eq(ShoppingListItems.listId, input.listId),
          ),
        );

      return {
        success: true,
        data: { item },
      };
    },
  }),

  deleteShoppingListItem: defineAction({
    input: z.object({
      id: z.string().min(1),
      listId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [item] = await db
        .select()
        .from(ShoppingListItems)
        .where(
          and(
            eq(ShoppingListItems.id, input.id),
            eq(ShoppingListItems.userId, user.id),
            eq(ShoppingListItems.listId, input.listId),
          ),
        );

      if (!item) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Shopping list item not found.",
        });
      }

      await db
        .delete(ShoppingListItems)
        .where(
          and(
            eq(ShoppingListItems.id, input.id),
            eq(ShoppingListItems.userId, user.id),
            eq(ShoppingListItems.listId, input.listId),
          ),
        );

      await db
        .update(ShoppingLists)
        .set({ updatedAt: new Date() })
        .where(and(eq(ShoppingLists.id, input.listId), eq(ShoppingLists.userId, user.id)));

      return {
        success: true,
        data: { deletedId: input.id },
      };
    },
  }),
};
