-- Read-only preflight. Review findings before applying the membership uniqueness migration.
-- This report never repairs, deletes, or reallocates historical records.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT "groupId", "userId", count(*) AS "membershipCount",
       array_agg(id ORDER BY "joinedAt", id) AS "membershipIds",
       array_agg(role ORDER BY "joinedAt", id) AS roles
FROM group_members
GROUP BY "groupId", "userId"
HAVING count(*) > 1;

SELECT e.id AS "expenseId", e.amount, coalesce(sum(s."owedAmount"), 0) AS allocated,
       e.amount - coalesce(sum(s."owedAmount"), 0) AS difference,
       count(s.id) AS "splitCount", count(DISTINCT s."userId") AS "participantCount",
       count(s.id) FILTER (WHERE s."owedAmount" < 0) AS "negativeShareCount"
FROM expenses e
LEFT JOIN expense_splits s ON s."expenseId" = e.id
GROUP BY e.id, e.amount
HAVING e.amount <= 0 OR count(s.id) = 0
    OR sum(s."owedAmount") <> e.amount
    OR count(s.id) <> count(DISTINCT s."userId")
    OR count(s.id) FILTER (WHERE s."owedAmount" < 0) > 0;

SELECT e.id AS "expenseId", e."groupId", e."paidBy"
FROM expenses e
WHERE NOT EXISTS (
    SELECT 1 FROM group_members m WHERE m."groupId" = e."groupId" AND m."userId" = e."paidBy"
);

SELECT s.id AS "splitId", s."expenseId", s."userId"
FROM expense_splits s
JOIN expenses e ON e.id = s."expenseId"
WHERE NOT EXISTS (
    SELECT 1 FROM group_members m WHERE m."groupId" = e."groupId" AND m."userId" = s."userId"
);

SELECT s.id AS "settlementId", s."groupId", s."fromUserId", s."toUserId", s.amount
FROM settlements s
WHERE s.amount <= 0 OR s."fromUserId" = s."toUserId"
   OR NOT EXISTS (SELECT 1 FROM group_members m WHERE m."groupId" = s."groupId" AND m."userId" = s."fromUserId")
   OR NOT EXISTS (SELECT 1 FROM group_members m WHERE m."groupId" = s."groupId" AND m."userId" = s."toUserId");

COMMIT;
