# Glossary

> Canonical terms used in LiquorPOS. Use these terms in prompts and code.

| Term                   | Definition                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Merchant**           | A liquor store owner/operator authenticated through Supabase and linked to Finix   |
| **Merchant Config**    | Stored Finix credentials + merchant ID + company name (`MerchantConfig` type)      |
| **Activation**         | Historical first-run API-key flow, now superseded by Supabase onboarding           |
| **Cashier**            | User who logs in with a 4-digit PIN; role is `admin` or `cashier`                  |
| **POS Screen**         | Main sales screen with product grid (ActionPanel) + cart (TicketPanel)             |
| **Action Panel**       | Left side of POS: product grid with category filter                                |
| **Ticket Panel**       | Right side of POS: shopping cart with line items and totals                        |
| **Cart Item**          | A product added to the current ticket (`CartItem` type in renderer)                |
| **Held Transaction**   | A saved cart snapshot that can be recalled later                                   |
| **Hold Number**        | Auto-generated ID for a held transaction                                           |
| **Transaction Number** | Auto-generated ID for a completed sale                                             |
| **SKU**                | Stock-keeping unit code, unique product identifier (max 64 chars, `[A-Za-z0-9-]+`) |
| **Item Number**        | Database primary key for inventory products                                        |
| **Department**         | Product grouping with profit margin and default tax settings                       |
| **Tax Code**           | Named tax rate applied to products (e.g., "STATE" at 8%)                           |
| **Distributor**        | Distributor of products (e.g. Empire Merchants North LLC)                          |
| **Sales Rep**          | Contact person at a distributor who visits the store                               |
| **Special Pricing**    | Promotional pricing rules: quantity thresholds, time-limited prices, mix-and-match |
| **Pricing Engine**     | `pricing-engine.ts` — evaluates special pricing rules against cart items           |
| **Promo Annotation**   | Metadata attached to cart lines by the pricing engine (`PromoAnnotation` type)     |
| **Finix Transfer**     | The `TR...` identifier recorded for a successful Finix charge or refund            |
| **Terminal Register**  | Physical card reader device registered with Finix                                  |
| **Terminal Charge**    | Payment processed through a physical card terminal via Finix API                   |
| **CRUD Panel**         | Reusable pattern for list + create/edit/delete UI, powered by `useCrudPanel` hook  |
| **BEM**                | CSS naming convention: Block\_\_Element--Modifier                                  |
| **Design Tokens**      | CSS custom properties in `tokens.css` (colors, spacing, borders)                   |
| **IPC**                | Inter-Process Communication: renderer ↔ main via Electron's `ipcMain.handle`       |
| **Context Bridge**     | Electron security layer that exposes `window.api` to the renderer                  |
| **Quality Gate**       | Required sequence: lint → typecheck → coverage (>=80%) → E2E                       |
