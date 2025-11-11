# UNIFIED BUSINESS FLOW DIAGRAM
**Complete Platform Ecosystem: Supplier → Admin → Customer**

---

## 🎯 EXECUTIVE SUMMARY

Platform konsinyasi ini memiliki 3 aktor utama:
1. **SUPPLIER** - Menyediakan produk
2. **ADMIN** - Mengatur & mengawasi sistem
3. **CUSTOMER** - Membeli produk (self-checkout)

**Admin adalah pusat kendali** yang menghubungkan supplier dan customer. Setiap keputusan admin berdampak langsung pada kedua pihak.

---

## 📊 COMPLETE BUSINESS FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PLATFORM KONSINYASI                             │
│                     Kantin Kejujuran Digital System                     │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐          ┌─────────────────┐          ┌──────────────────┐
│                 │          │                 │          │                  │
│    SUPPLIER     │  ───────→│     ADMIN       │  ───────→│    CUSTOMER      │
│                 │          │                 │          │                  │
└─────────────────┘          └─────────────────┘          └──────────────────┘
      Product                   Gatekeeper                   Purchase
      Provider                  & Monitor                    Consumer


═══════════════════════════════════════════════════════════════════════════
PHASE 1: SUPPLIER ONBOARDING & PRODUCT SUBMISSION
═══════════════════════════════════════════════════════════════════════════

[SUPPLIER]                    [ADMIN]                      [CUSTOMER]
    │                            │                              │
    │ 1. Register Account        │                              │
    ├───────────────────────────→│                              │
    │   (supplier/register)       │                              │
    │                            │                              │
    │ ⏱️ Wait...                  │ 2. Review Supplier          │
    │                            │    - Check business info    │
    │                            │    - Verify documents       │
    │                            │    (admin/suppliers)        │
    │                            │                              │
    │                            │ 3. Approve/Reject           │
    │                            │    ✅ Approve               │
    │                            │    ❌ Reject                │
    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                              │
    │   (notification)            │                              │
    │                            │                              │
    │ 4. Submit Products         │                              │
    ├───────────────────────────→│                              │
    │   - Name, price, photo     │                              │
    │   - Cost, barcode          │                              │
    │   (supplier/products)       │                              │
    │                            │                              │
    │ ⏱️ Wait...                  │ 5. Review Products          │
    │                            │    - Check quality          │
    │                            │    - Verify pricing         │
    │                            │    - Validate info          │
    │                            │    (admin/products)         │
    │                            │                              │
    │                            │ 6. Approve/Reject/Suspend   │
    │                            │    ✅ Approve               │
    │                            │    ❌ Reject                │
    │                            │    ⏸️  Suspend              │
    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                              │
    │   (notification)            │                              │
    │                            │                              │
    │                            │                              │ ⚠️ Customer
    │                            │                              │ cannot see
    │                            │                              │ products yet
    │                            │                              │ (not in inventory)
    │                            │                              │

⏱️ BOTTLENECK RISK: If admin slow to approve products, supplier cannot proceed


═══════════════════════════════════════════════════════════════════════════
PHASE 2: LOCATION SETUP (ADMIN TASK)
═══════════════════════════════════════════════════════════════════════════

[SUPPLIER]                    [ADMIN]                      [CUSTOMER]
    │                            │                              │
    │                            │ 1. Create Location          │
    │                            │    - Name, address          │
    │                            │    - Generate QR slug       │
    │                            │    - Set QRIS (optional)    │
    │                            │    (admin/locations)        │
    │                            │                              │
    │                            │ 2. Print QR Code            │
    │                            │    - Download QR PNG        │
    │                            │    - Print & display        │
    │                            │                              │
    │                            │ 3. Activate Location        │
    │                            │    ✅ Set is_active = true  │
    │                            │                              │
    │                            │                              │ Now customer can
    │                            │                              │ scan QR at this
    │                            │                              │ location
    │                            │                              │

⚠️ If QRIS not configured, customer can only pay CASH


═══════════════════════════════════════════════════════════════════════════
PHASE 3: INVENTORY DISTRIBUTION (SHIPMENT FLOW)
═══════════════════════════════════════════════════════════════════════════

[SUPPLIER]                    [ADMIN]                      [CUSTOMER]
    │                            │                              │
    │ 1. Create Shipment         │                              │
    ├───────────────────────────→│                              │
    │   - Select products        │                              │
    │   - Set quantities         │                              │
    │   - Choose destination     │                              │
    │   (supplier/shipments)     │                              │
    │                            │                              │
    │ ⏱️ Wait...                  │ 2. Review Shipment          │
    │                            │    - Verify quantities      │
    │                            │    - Check product list     │
    │                            │    - Validate destination   │
    │                            │    (admin/shipments)        │
    │                            │                              │
    │                            │ 3. Approve/Reject           │
    │                            │    ✅ APPROVE:              │
    │                            │       → Add to inventory    │
    │                            │       → Update stock        │
    │                            │    ❌ REJECT:               │
    │                            │       → Return to supplier  │
    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                              │
    │   (notification)            │                              │
    │                            │                              │
    │ 2. Products now visible    │                              │ Products now
    │    in inventory            │                              │ available for
    │                            │                              │ purchase! 🎉
    │                            │                              │
    │                            │ [INVENTORY_LEVELS TABLE]    │
    │                            │  product_id | location_id   │
    │                            │  quantity | updated_at      │
    │                            │                              │

⏱️ BOTTLENECK RISK: If admin slow to approve shipments, shelves stay empty


═══════════════════════════════════════════════════════════════════════════
PHASE 4: CUSTOMER PURCHASE (SELF-CHECKOUT)
═══════════════════════════════════════════════════════════════════════════

[SUPPLIER]                    [ADMIN]                      [CUSTOMER]
    │                            │                              │
    │                            │                              │ 1. Scan QR Code
    │                            │                              │    at location
    │                            │                              │    ↓
    │                            │                              │ 2. Browse Products
    │                            │                              │    (kantin/[slug])
    │                            │                              │    ↓
    │                            │  [RPC: get_products_by_location]
    │                            │  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
    │                            │  Returns approved products   │
    │                            │  with inventory > 0          │
    │                            │                              │
    │                            │                              │ 3. Add to Cart
    │                            │                              │    - Select items
    │                            │                              │    - Set quantities
    │                            │                              │    ↓
    │                            │                              │ 4. Checkout
    │                            │                              │    (kantin/[slug]/checkout)
    │                            │                              │    ↓
    │                            │  [RPC: process_anonymous_checkout]
    │                            │  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
    │                            │  ✅ Create sales_transaction │
    │                            │  ✅ Deduct inventory         │
    │                            │  ✅ Calculate commission     │
    │                            │  ✅ Return QRIS              │
    │                            │                              │
    │                            │                              │ 5. Payment
    │                            │                              │    Option A: QRIS
    │                            │                              │    - Scan QR
    │                            │                              │    - Pay via e-wallet
    │                            │                              │    - Verify payment
    │                            │                              │    
    │                            │                              │    Option B: Cash
    │                            │                              │    - Click "Bayar Tunai"
    │                            │                              │    - Confirm payment
    │                            │                              │    ↓
    │                            │  [RPC: confirm_payment]       │
    │                            │  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
    │                            │  ✅ Mark as paid             │
    │                            │  ✅ Credit supplier wallets  │
    │                            │  ✅ Send notifications       │
    │                            │                              │
    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                              │ 6. Success!
    │  💰 Wallet credited!       │                              │    - Show receipt
    │  📬 Notification: New sale │                              │    - Print option
    │                            │                              │    - Back to menu
    │                            │                              │

💡 Admin's role here: MONITOR (not involved in real-time transaction)


═══════════════════════════════════════════════════════════════════════════
PHASE 5: POST-SALE MONITORING (ADMIN OVERSIGHT)
═══════════════════════════════════════════════════════════════════════════

[SUPPLIER]                    [ADMIN]                      [CUSTOMER]
    │                            │                              │
    │ 1. View Sales Report       │ 1. Monitor Dashboard        │
    │    (supplier/sales-report) │    (admin/page)             │
    │    - See transactions      │    - Total sales            │
    │    - Check earnings        │    - Revenue                │
    │                            │    - Pending approvals      │
    │                            │                              │
    │ 2. Check Wallet Balance    │ 2. View Sales Reports       │
    │    (supplier/wallet)       │    (admin/reports)          │
    │    - Total earnings        │    - Top products           │
    │    - Pending withdrawals   │    - Sales by period        │
    │                            │    - Export CSV             │
    │                            │                              │
    │ 3. Request Withdrawal      │ 3. Review Payments          │
    ├───────────────────────────→│    (admin/payments)         │
    │   - Enter amount           │    ⚠️ CURRENTLY NOT         │
    │   - Submit request         │       IMPLEMENTED!          │
    │                            │                              │
    │ ⏱️ Wait...                  │ 4. Process Withdrawal       │
    │                            │    - Verify balance         │
    │                            │    - Transfer funds         │
    │                            │    - Mark as paid           │
    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                              │
    │   💵 Withdrawal approved   │                              │
    │                            │                              │
    │                            │ 5. Monitor Inventory        │
    │                            │    - Low stock alerts       │
    │                            │    - Out of stock products  │
    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                              │
    │   📬 "Product X low stock" │                              │
    │                            │                              │
    │ 4. Create Restock Shipment │                              │
    ├───────────────────────────→│                              │
    │   (back to PHASE 3)        │                              │
    │                            │                              │

🔁 CYCLE REPEATS: Shipment → Approval → Sale → Monitoring → Restock


═══════════════════════════════════════════════════════════════════════════
PHASE 6: SPECIAL CASES - RETURN FLOW
═══════════════════════════════════════════════════════════════════════════

[SUPPLIER]                    [ADMIN]                      [CUSTOMER]
    │                            │                              │
    │                            │ 1. Initiate Return          │
    │                            │    (admin/shipments)        │
    │                            │    - Select products        │
    │                            │    - Set return quantities  │
    │                            │    - Submit return request  │
    │                            │    ↓                         │
    │                            │ [RPC: approve_shipment_return]
    │                            │    - Deduct from inventory  │
    │                            │    - Mark as 'returning'    │
    │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                              │
    │   📬 Return notification   │                              │
    │                            │                              │
    │ 2. Receive Products        │                              │
    │    (supplier/shipments)    │                              │
    │    ReturnTab               │                              │
    │    - View return details   │                              │
    │    - Confirm receipt       │                              │
    │    ↓                        │                              │
    │ [RPC: confirm_return_received_by_supplier]               │
    │    - Update return status  │                              │
    │    - Add back to supplier  │                              │
    │       inventory            │                              │
    │                            │                              │

💡 Return flow is admin-initiated (not supplier-initiated)


═══════════════════════════════════════════════════════════════════════════
END-TO-END DATA FLOW SUMMARY
═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│                           DATABASE TABLES                               │
└─────────────────────────────────────────────────────────────────────────┘

[SUPPLIER CREATES]                [ADMIN MANAGES]               [CUSTOMER TRIGGERS]
      │                                  │                              │
      ├─→ suppliers                      ├─→ locations                 │
      │   (status: pending)              │   (QR codes)                │
      │                                  │                              │
      ├─→ products                       ├─→ stock_movements           │
      │   (status: pending)              │   (approval workflow)       │
      │                                  │                              │
      ├─→ stock_movements                ├─→ inventory_levels          ├─→ sales_transactions
      │   (shipments)                    │   (location stock)          │   (checkout)
      │                                  │                              │
      └─→ supplier_wallets               └─→ notifications             ├─→ sales_transaction_items
          (earnings)                         (alerts)                  │   (line items)
                                                                        │
                                                                        └─→ inventory_levels
                                                                            (stock deduction)

┌─────────────────────────────────────────────────────────────────────────┐
│                         PERMISSION BOUNDARIES                           │
└─────────────────────────────────────────────────────────────────────────┘

SUPPLIER can:
  ✅ View own products, shipments, sales, wallet
  ✅ Create products, shipments, withdrawal requests
  ❌ View other suppliers' data
  ❌ Approve anything
  ❌ View all locations
  ❌ Access admin functions

ADMIN can:
  ✅ View ALL data (suppliers, products, locations, sales, inventory)
  ✅ Approve/reject suppliers, products, shipments
  ✅ Create/edit/delete locations
  ✅ Process withdrawals
  ✅ Initiate returns
  ✅ Export reports
  ❌ Create products (supplier's job)
  ❌ Create shipments (supplier's job)

CUSTOMER can:
  ✅ View approved products at specific location
  ✅ Purchase anonymously (no login required)
  ❌ View supplier info beyond name
  ❌ View admin data
  ❌ View other locations' products
  ❌ View transaction history (anonymous checkout)


═══════════════════════════════════════════════════════════════════════════
CRITICAL ADMIN TOUCHPOINTS (WHERE ADMIN INTERVENTION IS REQUIRED)
═══════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────┐
│  ADMIN APPROVAL GATES (Blocks progress if slow)                     │
├──────────────────────────────────────────────────────────────────────┤
│  1. ✋ Supplier Registration → MUST APPROVE before products visible  │
│  2. ✋ Product Submission → MUST APPROVE before available to customer│
│  3. ✋ Shipment Submission → MUST APPROVE before inventory added     │
│  4. ✋ Withdrawal Request → MUST PROCESS before supplier gets paid   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  ADMIN MONITORING DUTIES (Proactive oversight needed)               │
├──────────────────────────────────────────────────────────────────────┤
│  1. 👀 Low inventory alerts → Prompt supplier restock                │
│  2. 👀 Payment confirmations → Verify transactions                   │
│  3. 👀 Fraud detection → Review suspicious transactions              │
│  4. 👀 Product quality → Monitor customer feedback (future)          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  ADMIN CONFIGURATION TASKS (Setup required)                          │
├──────────────────────────────────────────────────────────────────────┤
│  1. ⚙️ Location creation & QR generation                             │
│  2. ⚙️ QRIS setup per location (for digital payments)                │
│  3. ⚙️ Platform settings (commission rates, etc.)                    │
└──────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
PERFORMANCE METRICS (SLA Targets)
═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│  APPROVAL TURNAROUND TIME (Admin Efficiency)                       │
├─────────────────────────────────────────────────────────────────────┤
│  Supplier Approval:  Target < 24 hours    Currently: ❓ Not tracked │
│  Product Approval:   Target < 12 hours    Currently: ❓ Not tracked │
│  Shipment Approval:  Target < 6 hours     Currently: ❓ Not tracked │
│  Withdrawal Process: Target < 48 hours    Currently: ❓ Not tracked │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CUSTOMER EXPERIENCE METRICS                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Product Availability: Target > 80%       Currently: ❓ Not tracked │
│  Stock-out Duration:   Target < 24 hours  Currently: ❓ Not tracked │
│  Checkout Success:     Target > 95%       Currently: ❓ Not tracked │
│  Payment Success:      Target > 98%       Currently: ❓ Not tracked │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SUPPLIER SATISFACTION METRICS                                      │
├─────────────────────────────────────────────────────────────────────┤
│  Time to First Sale:     Target < 3 days  Currently: ❓ Not tracked │
│  Withdrawal Processing:  Target < 48 hrs  Currently: ❓ Not tracked │
│  Sell-through Rate:      Target > 70%     Currently: ❓ Not tracked │
└─────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
ADMIN BOTTLENECK ANALYSIS
═══════════════════════════════════════════════════════════════════════════

🚨 HIGH IMPACT BOTTLENECKS (Affects both supplier & customer):

1. PRODUCT APPROVAL DELAY
   ├─→ Supplier Impact: Cannot sell, delayed revenue
   ├─→ Customer Impact: Limited product selection
   └─→ Solution: Bulk approve, auto-approve trusted suppliers

2. SHIPMENT APPROVAL DELAY
   ├─→ Supplier Impact: Inventory stuck, cannot fulfill orders
   ├─→ Customer Impact: Out of stock, bad experience
   └─→ Solution: Bulk approve, SLA alerts, auto-approve option

3. PAYMENT SYSTEM NOT INTEGRATED
   ├─→ Supplier Impact: Cannot see earnings, cannot request withdrawal
   ├─→ Customer Impact: Payment confirmation confusion
   └─→ Solution: Integrate payments page URGENTLY

4. NO PAGINATION ON SUPPLIERS/PRODUCTS
   ├─→ Admin Impact: Slow page load, cannot manage efficiently
   ├─→ Supplier Impact: Indirect - slower admin = slower approvals
   └─→ Solution: Add pagination (like shipments page)

⚠️ MEDIUM IMPACT BOTTLENECKS:

5. NO LOW STOCK ALERTS
   ├─→ Customer Impact: Products run out unexpectedly
   └─→ Solution: Dashboard widget + notifications

6. NO QRIS CONFIGURATION UI
   ├─→ Customer Impact: Can only pay cash
   └─→ Solution: Add to locations page

7. NO BULK OPERATIONS
   ├─→ Admin Impact: Time-consuming, error-prone
   └─→ Solution: Checkboxes + bulk action buttons


═══════════════════════════════════════════════════════════════════════════
RECOMMENDATIONS FOR ADMIN RECONFIGURATION
═══════════════════════════════════════════════════════════════════════════

🎯 PHASE 1: REMOVE BOTTLENECKS (Week 1-2)
   Priority: CRITICAL - Unblock supplier & customer flows

   1. ✅ Add Pagination to Suppliers Page
      - 10/25/50 items per page (like shipments)
      - Total count display
      - Estimated time: 2 hours

   2. ✅ Add Pagination to Products Page
      - Same pattern as shipments
      - Estimated time: 2 hours

   3. ✅ Implement Bulk Product Approval
      - Checkbox select all/individual
      - "Bulk Approve" button
      - Batch RPC call
      - Estimated time: 4 hours

   4. ✅ Implement Bulk Shipment Approval
      - Same UI pattern as products
      - Estimated time: 3 hours

   5. ✅ Integrate Payments Page
      - Connect to sales_transactions table
      - Show pending/completed split
      - Add withdrawal processing UI
      - Estimated time: 8 hours

   TOTAL: ~19 hours (~2.5 days)


🎯 PHASE 2: IMPROVE VISIBILITY (Week 3-4)
   Priority: HIGH - Enable proactive management

   6. ✅ Dashboard: Pending Approvals Widget
      - Count of pending suppliers
      - Count of pending products
      - Count of pending shipments
      - Quick links to each page
      - Estimated time: 3 hours

   7. ✅ Dashboard: Low Stock Alerts Widget
      - Products with quantity < 5 by location
      - Color-coded urgency (red/yellow)
      - Link to create shipment
      - Estimated time: 4 hours

   8. ✅ Dashboard: Fix Revenue Display
      - Calculate from sales_transactions
      - Show real revenue (currently hardcoded 0)
      - Estimated time: 1 hour

   9. ✅ Reports: Sales by Location
      - New report page or add to existing
      - Filter by date range
      - Show top locations
      - Estimated time: 5 hours

   10. ✅ Add SLA Time Tracking
       - Track time from submission to approval
       - Show "Pending for X hours" in tables
       - Highlight overdue items
       - Estimated time: 4 hours

   TOTAL: ~17 hours (~2 days)


🎯 PHASE 3: AUTOMATION & ALERTS (Week 5-6)
   Priority: MEDIUM - Reduce admin workload

   11. ✅ Auto-Notification System
       - Alert admin when approval pending > 24h
       - Alert suppliers when stock < threshold
       - Email + in-app notifications
       - Estimated time: 6 hours

   12. ✅ QRIS Configuration UI
       - Add to locations page
       - Upload QRIS image per location
       - Test QRIS display
       - Estimated time: 4 hours

   13. ✅ Supplier Trust Score
       - Track approval rate, sales velocity
       - Enable auto-approve for 5-star suppliers
       - Admin can override
       - Estimated time: 8 hours

   14. ✅ Predictive Restocking
       - Calculate avg daily sales per product
       - Alert when stock < 3 days supply
       - Suggest restock quantity
       - Estimated time: 6 hours

   TOTAL: ~24 hours (~3 days)


🎯 PHASE 4: ANALYTICS & INSIGHTS (Future)
   Priority: LOW - Nice to have

   15. ✅ Conversion Funnel Tracking
   16. ✅ Customer Traffic Analytics
   17. ✅ Supplier Performance Leaderboard
   18. ✅ Product Recommendation Engine

   TOTAL: ~40+ hours (future project)


═══════════════════════════════════════════════════════════════════════════
SUCCESS CRITERIA
═══════════════════════════════════════════════════════════════════════════

✅ Supplier can get from registration → first sale in < 48 hours
✅ Customer sees > 80% product availability at each location
✅ Admin spends < 2 hours/day on approvals (with 50+ suppliers)
✅ Payment processing turnaround < 48 hours
✅ Zero "HABIS" products at peak hours (stock alerts working)
✅ 95%+ customer checkout success rate


═══════════════════════════════════════════════════════════════════════════
CONCLUSION
═══════════════════════════════════════════════════════════════════════════

The platform is architecturally sound with:
  ✅ Solid supplier module (deployed & functional)
  ✅ Solid customer module (QR checkout working well)
  ⚠️ Admin module needs optimization (bottlenecks identified)

Admin is the KEY to platform success because:
  1. Gatekeeps supplier access to customers
  2. Controls inventory availability
  3. Processes financial transactions
  4. Monitors system health

Current admin issues:
  ❌ Manual, one-by-one approvals (slow)
  ❌ No bulk operations (inefficient)
  ❌ Payment system not integrated (supplier confusion)
  ❌ No proactive alerts (reactive management)
  ❌ Limited visibility into bottlenecks

After implementing Phase 1 & 2 optimizations:
  ✅ Admin can process 10x more volume
  ✅ Supplier time-to-market reduced by 70%
  ✅ Customer product availability improved 50%+
  ✅ Platform ready to scale to 100+ suppliers

**Next Step**: Implement Phase 1 (2.5 days of work for massive impact)
