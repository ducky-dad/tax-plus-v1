import type {
  CartTransformRunInput,
  CartTransformRunResult,
  Operation,
} from "../generated/api";

const NO_CHANGES: CartTransformRunResult = { operations: [] };

interface TaxSettings {
  enabled?: boolean;
  threshold?: number;
  kanzeiRate?: number;
  shohizeiRate?: number;
  tesuryo?: number;
}

export function cartTransformRun(
  input: CartTransformRunInput
): CartTransformRunResult {
  // Parse settings
  let settings: TaxSettings = {};
  try {
    const raw = input.cart.attribute?.value;
    if (raw) settings = JSON.parse(raw);
  } catch {
    return NO_CHANGES;
  }

  const {
    enabled = false,
    threshold = 10000,
    kanzeiRate = 0,
    shohizeiRate = 10,
    tesuryo = 0,
  } = settings;

  if (!enabled) return NO_CHANGES;

  // Find first line that is a ProductVariant (has an id we can use)
  const firstLine = input.cart.lines.find(
    (line) => line.merchandise.__typename === "ProductVariant"
  );
  if (!firstLine) return NO_CHANGES;

  const merchandiseId =
    firstLine.merchandise.__typename === "ProductVariant"
      ? firstLine.merchandise.id
      : null;
  if (!merchandiseId) return NO_CHANGES;

  // Calculate subtotal
  const subtotal = input.cart.lines.reduce((sum, line) => {
    return sum + parseFloat(line.cost.amountPerQuantity.amount) * line.quantity;
  }, 0);

  if (subtotal < threshold) return NO_CHANGES;

  const unitPrice = parseFloat(firstLine.cost.amountPerQuantity.amount);
  const kanzeiAmount   = parseFloat((subtotal * kanzeiRate / 100).toFixed(2));
  const shohizeiAmount = parseFloat((subtotal * shohizeiRate / 100).toFixed(2));
  const tesuryoAmount  = parseFloat(Number(tesuryo).toFixed(2));

  // Build expanded items: original item + tax lines
  const expandedCartItems: {
    merchandiseId: string;
    quantity: number;
    price?: { adjustment: { fixedPricePerUnit: { amount: string } } };
  }[] = [
    // Original line at its original price
    {
      merchandiseId,
      quantity: firstLine.quantity,
      price: {
        adjustment: {
          fixedPricePerUnit: { amount: String(unitPrice) },
        },
      },
    },
  ];

  if (kanzeiRate > 0) {
    expandedCartItems.push({
      merchandiseId,
      quantity: 1,
      price: {
        adjustment: {
          fixedPricePerUnit: { amount: String(kanzeiAmount) },
        },
      },
    });
  }

  if (shohizeiRate > 0) {
    expandedCartItems.push({
      merchandiseId,
      quantity: 1,
      price: {
        adjustment: {
          fixedPricePerUnit: { amount: String(shohizeiAmount) },
        },
      },
    });
  }

  if (tesuryoAmount > 0) {
    expandedCartItems.push({
      merchandiseId,
      quantity: 1,
      price: {
        adjustment: {
          fixedPricePerUnit: { amount: String(tesuryoAmount) },
        },
      },
    });
  }

  const operation: Operation = {
    lineExpand: {
      cartLineId: firstLine.id,
      expandedCartItems,
    },
  };

  return { operations: [operation] };
}
