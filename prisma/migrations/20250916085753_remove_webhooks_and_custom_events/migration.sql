/*
  Warnings:

  - You are about to drop the column `webhookSecret` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the `custom_events` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."custom_events" DROP CONSTRAINT "custom_events_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."custom_events" DROP CONSTRAINT "custom_events_tenantId_fkey";

-- AlterTable
ALTER TABLE "public"."tenants" DROP COLUMN "webhookSecret";

-- DropTable
DROP TABLE "public"."custom_events";
