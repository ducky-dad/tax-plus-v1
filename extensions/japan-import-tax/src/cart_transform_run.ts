import type {
  CartTransformRunInput,
  CartTransformRunResult,
  Operation,
} from "../generated/api";

const NO_CHANGES: CartTransformRunResult = { operations: [] };

interface TaxSettings {
  enabled?: boolean;
  threshold?: number;   // USD
  kanzeiRate?: number;  // percent, e.g. 3 = 3%
  shohizeiRate?: number;// percent, e.g. 10 = 10%
  tesuryo?: number;     // flat USD fee
}

export function cartTransformRun(
  input: CartTransformRunInput
): CartTransformRunResult {
  // 1. Parse settings from cart attribute
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

  // 2. Sum cart subtotal in store currency (USD)
  const subtotal = input.cart.lines.reduce((sum, line) => {
    return sum + parseFloat(line.cost.amountPerQuantity.amount) * line.quantity;
  }, 0);

  if (subtotal < threshold) return NO_CHANGES;

  // 3. We need an existing line to expand — use the first line
  const firstLine = input.cart.lines[0];
  if (!firstLine) return NO_CHANGES;

  const currency = firstLine.cost.amountPerQuantity.currencyCode;

  // 4. Build the expanded items — the original item first, then tax lines
  // kanzei and shohizei are percentages; tesuryo is a flat fee
  const kanzeiAmount = parseFloat((subtotal * kanzeiRate / 100).toFixed(2));
  const shohizeiAmount = parseFloat((subtotal * shohizeiRate / 100).toFixed(2));
  const tesuryoAmount = parseFloat(tesuryo.toFixed(2));

  // The expand operation requires the original line item's merchandiseId
  // We reconstruct the original item at its original price, then append tax lines
  const originalUnitPrice = parseFloat(firstLine.cost.amountPerQuantity.amount);

  const expandedCartItems = [
    // Original item — keep at its original price
    {
      merchandiseId: (firstLine as any).merchandise?.id ?? firstLine.id,
      quantity: firstLine.quantity,
      price: {
        adjustment: {
          fixedPricePerUnit: {
            amount: String(originalUnitPrice),
          },
        },
      },
    },
    // 関税
    ...(kanzeiRate > 0 ? [{
      merchandiseId: (firstLine as any).merchandise?.id ?? firstLine.id,
      quantity: 1,
      title: "関税（輸入関税）",
      price: {
        adjustment: {
          fixedPricePerUnit: {
            amount: String(kanzeiAmount),
          },
        },
      },
    }] : []),
    // 消費税
    ...(shohizeiRate > 0 ? [{
      merchandiseId: (firstLine as any).merchandise?.id ?? firstLine.id,
      quantity: 1,
      title: "消費税（輸入消費税）",
      price: {
        adjustment: {
          fixedPricePerUnit: {
            amount: String(shohizeiAmount),
          },
        },
      },
    }] : []),
    // 手数料
    ...(tesuryoAmount > 0 ? [{
      merchandiseId: (firstLine as any).merchandise?.id ?? firstLine.id,
      quantity: 1,
      title: "通関手数料",
      price: {
        adjustment: {
          fixedPricePerUnit: {
            amount: String(tesuryoAmount),
          },
        },
      },
    }] : []),
  ];

  const operation: Operation = {
    lineExpand: {
      cartLineId: firstLine.id,
      expandedCartItems,
    },
  };

  return { operations: [operation] };
}
