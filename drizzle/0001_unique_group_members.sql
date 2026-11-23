-- Run scripts/audit-ledger.sql first. Duplicate memberships require an explicit repair decision.
-- If duplicates exist, this statement fails without deleting or changing any membership.
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_user_unique" UNIQUE("groupId","userId");
