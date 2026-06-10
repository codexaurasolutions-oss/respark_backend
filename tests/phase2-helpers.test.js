import { describe, expect, it, vi } from "vitest";

import { createStockMovement } from "../src/lib/phase2.js";

const buildTx = ({
  product = {
    id: "product-1",
    salonId: "salon-1",
    branchId: "branch-1",
    name: "Retail Serum",
    currentStock: 10,
    allowNegativeStock: false
  },
  branchStock = 4
} = {}) => {
  const tx = {
    product: {
      findFirst: vi.fn().mockResolvedValue(product),
      update: vi.fn().mockResolvedValue({})
    },
    stockMovement: {
      findFirst: vi.fn().mockResolvedValue(
        branchStock == null
          ? null
          : { id: "movement-prev", productId: product.id, branchId: "branch-2", stockAfter: branchStock }
      ),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: "movement-1", ...data }))
    }
  };

  return tx;
};

describe("phase2 stock helpers", () => {
  it("stores branch-aware stock before and after values", async () => {
    const tx = buildTx({ branchStock: 4 });

    const movement = await createStockMovement(tx, {
      salonId: "salon-1",
      branchId: "branch-2",
      productId: "product-1",
      quantity: 3,
      movementType: "TRANSFER_IN",
      createdByUserId: "user-1"
    });

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { currentStock: 13 }
    });
    expect(tx.stockMovement.create).toHaveBeenCalled();
    expect(movement.stockBefore).toBe(4);
    expect(movement.stockAfter).toBe(7);
    expect(movement.branchId).toBe("branch-2");
  });

  it("blocks stock movement when branch-specific stock would go negative", async () => {
    const tx = buildTx({ branchStock: 1 });

    await expect(createStockMovement(tx, {
      salonId: "salon-1",
      branchId: "branch-2",
      productId: "product-1",
      quantity: -2,
      movementType: "TRANSFER_OUT",
      createdByUserId: "user-1"
    })).rejects.toMatchObject({ status: 400 });

    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });
});
