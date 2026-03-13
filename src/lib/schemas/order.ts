import { z } from "zod";

const MALAYSIAN_PHONE_RE = /^(\+?60|0)1[0-9]{8,9}$/;

export const OrderSubmitSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().max(200),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  total: z.number().positive(),
  contactNumber: z
    .string()
    .transform((val) => val.replace(/[-\s]/g, ""))
    .refine((val) => MALAYSIAN_PHONE_RE.test(val), {
      message: "Invalid Malaysian phone number",
    }),
  estimatedArrival: z
    .string()
    .datetime()
    .refine(
      (val) => new Date(val) > new Date(Date.now() + 14 * 60 * 1000),
      { message: "Arrival must be at least 15 minutes from now" }
    ),
});

export const OrderPatchSchema = z.object({
  status: z
    .enum(
      [
        "pending_approval",
        "approved",
        "payment_pending",
        "payment_uploaded",
        "preparing",
        "ready",
        "rejected",
        "seen",
        "expired",
      ],
      { message: "Invalid status value" }
    )
    .optional(),
  action: z
    .enum([
      "approve",
      "reject",
      "confirm_payment",
      "reject_payment",
      "mark_ready",
      "feedme_entered",
    ])
    .optional(),
  estimatedReady: z.string().datetime().optional(),
  rejectionReason: z.string().max(500).optional(),
});
