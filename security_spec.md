# Security Specification - Vantage Invest

## Data Invariants
1. A user can only access their own profile, wallet, and transaction history.
2. Investment plans are read-only for all authenticated users.
3. Users cannot modify their own `walletBalance` directly (except through system-validated routes like buying a plan, but even then it should be controlled).
4. `uid` in the user document must match the document ID and the authenticated user's UID.
5. All timestamps must be server-generated.
6. Identity roles and ownership are immutable after creation.
7. Wallet balance must be non-negative.

## The "Dirty Dozen" Payloads (Unauthorized Attempts)
1. **Identity Spoofing**: User A tries to read User B's profile.
2. **Identity Spoofing (Write)**: User A tries to create a profile with User B's UID.
3. **Privilege Escalation**: User tries to set `status: 'admin'` (if admin role existed).
4. **Balance Injection**: User tries to update `walletBalance` to 1,000,000.
5. **Orphaned Purchase**: User tries to create a purchase for a plan that doesn't exist.
6. **Negative Wallet**: User tries to withdraw more than their balance.
7. **Bypassing Verification**: User tries to write without a verified email (as per instructions).
8. **Shadow Field**: User tries to add `isVerified: true` to their profile.
9. **Tampering History**: User tries to delete their purchase history or withdrawal requests.
10. **Plan Hijacking**: User tries to modify an existing investment plan's price.
11. **Timestamp Spoofing**: User sends a future date as `createdTime`.
12. **ID Poisoning**: User tries to use a 2MB string as a document ID.

## The Test Runner
A `firestore.rules.test.ts` will be created to verify these restrictions.
