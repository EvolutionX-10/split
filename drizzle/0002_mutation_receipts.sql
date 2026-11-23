-- Apply before deploying owned replay. Existing ledger rows are unchanged.
-- Retain receipts: removing one can allow a delayed retry to write again.
CREATE TABLE "mutation_receipts" (
	"ownerId" text NOT NULL,
	"mutationId" text NOT NULL,
	"kind" text NOT NULL,
	"payloadHash" text NOT NULL,
	"entityId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mutation_receipts_ownerId_mutationId_pk" PRIMARY KEY("ownerId","mutationId")
);
--> statement-breakpoint
ALTER TABLE "mutation_receipts" ADD CONSTRAINT "mutation_receipts_ownerId_users_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
