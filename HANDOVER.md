# Oluwadamilola’s phone guide

## Publish a product

1. Open `shopwithlolaluxe.com.ng/admin` and sign in with your private username and password. Bookmark this private address; it is intentionally absent from the storefront navigation.
2. Tap **Products → Add product**.
3. Enter a name, category, naira price and description. Upload photos from your phone.
4. Add a row for every size + colour combination. Stock is the quantity for that exact row. Black size 38 and brown size 38 have separate stock. Zero means unavailable.
5. Tick **Publish in the boutique**, then **Save product**. Leave it unticked to keep a draft. Open the storefront to check the result.

Edit an existing product from the searchable Products list. Add a category at the bottom of that list. Release holds before removing a reserved combination or reducing its stock below the reserved quantity.

## Find an order

1. Ask the customer for the **LL-…** reference in their WhatsApp message.
2. Open **Orders**, type the reference, and open the matching request.
3. Check original items, fulfilment, product total and balance. Filter the list by payment status when following up.

A request is not a confirmed purchase. No stock is automatically held when a shopper opens WhatsApp. You can dismiss an abandoned request with no payments.

## Record money you received

1. Verify the transfer in your bank records.
2. Open the order and use **Record verified payment**.
3. Enter the date and how much was for **products** versus **delivery**. If ₦14,500 covers a ₦12,000 bag and ₦2,500 delivery, enter 12000 and 2500 respectively.
4. Add a note for anything outside your agreement, or any excess. Tap **Record payment** once and wait for the updated balance.

For a ₦12,000 bag, three ₦4,000 product payments show balances of **₦8,000 → ₦4,000 → ₦0**. The last entry marks the product order Paid. Record every actual receipt even if it needs an exception note. Two intentional equal transfers need two separate entries.

If a customer pays the rider, enter the agreed delivery fee and tick **Customer pays rider directly** under Agreement & delivery. Do not enter that rider's money as a transfer to you.

## Instalments and holds

In **Agreement & delivery**, enter the actual agreed due date and terms. The stated terms are a ₦2,000 minimum and completion within two weeks; exactly how that minimum applies and when the two weeks starts still need your confirmation. The site does not invent those details.

After a deposit, tap **Reserve this selection** for any exact item you agree to hold. Tap **Release reservation** if the arrangement ends. An overdue balance or an underpaid third instalment is flagged for follow-up. It stays Part-paid until the product balance is zero.

## Fix an entry

Under Payment history, tap **Correct this payment**, enter the correct amounts and date, and give the reason. Save the correction. The original is retained with who corrected it and when; totals update automatically. Reducing a fully paid product amount can reopen the balance and remove the completed sale from the dashboard.

To close a part-paid request, review its history, type its full reference and add a closing reason. Its money remains visible for follow-up. Paid sales must be corrected before dismissal when appropriate. Arrange refunds privately and keep their records with your bank reconciliation; this app does not issue refunds.

## Keep access private

Sign out on shared devices. Password resets use the host's `app.py owner` command, so keep your hosting account secure. The dashboard and order book are private; do not share your credentials with customers.

If an order shows a delivery excess or stock-conflict warning, review it before fulfilment. An unconfirmed payment draft can be restored after a network error; check history before retrying. Retries keep the same submission reference.


## Super Admin and Product Admin accounts

The existing owner login is the Super Admin; no public admin registration exists. After this update, sign in again at `/admin` with the existing owner credentials.

1. Open **Team** and enter a helper's username (letters, numbers, dots, underscores or hyphens).
2. Select **Create invitation**. Copy the private link and share it directly with that helper, together with their username. The app does not email invitations.
3. The helper opens the link within 24 hours and chooses a password of at least 12 characters. The link can only be used once.
4. They sign in at `/admin`. Product Admins can upload photos, add categories and create/edit drafts. They cannot publish, modify live products, access orders or finances, or manage accounts.
5. The Super Admin reviews drafts in **Products**, checks **Publish in the boutique**, and saves. Recent product actions appear on **Team**.
6. **Revoke access** immediately disables the account, including existing sessions. **New invitation / reset password** invalidates prior invitations and sessions and lets the helper choose a new password. **Invite again** restores a revoked helper through a new invitation.

Keep invitation links private: anyone holding an unused link can activate that one Product Admin account. Customers cannot create an account or become admins without a valid Super Admin-issued invitation. The original Super Admin account is provisioned/reset by the website administrator using the existing owner CLI; it is never created through customer signup. Resetting the owner password now invalidates existing owner sessions.


## Owner activates her account on her phone

The website administrator generates a private owner setup link from a trusted terminal with `DATABASE_URL` securely set to the SAME production Neon database used by Vercel. Do not commit connection strings, paste them in chat, or put invitation links in public logs. The CLI refuses to generate a live invitation when DATABASE_URL is absent, preventing accidental creation in local SQLite.

```bash
python app.py owner-invite --username oluwadamilola --site-url https://lolaluxe.vercel.app
```

Use the existing owner username if an owner account already exists. The command creates/replaces a 24-hour invitation, without changing the owner's current password. Share the resulting private link directly with the owner. She opens it, sees her assigned username, chooses and confirms her own password, then signs in at `/admin`. She never needs database credentials, a terminal, GitHub or Vercel access. There is no public invitation-generation or owner signup endpoint.

The link is single-use and stored only as a hash; creating a new invitation invalidates the previous link. Changing the owner account after issuance invalidates the invitation. Completing activation resets owner credentials and invalidates previous owner sessions. If the link expires, generate and privately share a new one. A page refresh removes the fragment token: reopen the original link if activation has not been completed. Use the actual connected custom domain as --site-url when ready.
