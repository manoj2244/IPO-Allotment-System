/*
  Warnings:

  - You are about to drop the column `allotted_units` on the `allotment` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `allotment` table. All the data in the column will be lost.
  - Added the required column `allotted_qty` to the `allotment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `applied_qty` to the `allotment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `full_name` to the `allotment` table without a default value. This is not possible if the table is not empty.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[allotment] DROP COLUMN [allotted_units],
[name];
ALTER TABLE [dbo].[allotment] ADD [allotted_qty] INT NOT NULL,
[applied_qty] INT NOT NULL,
[company_code] VARCHAR(40),
[full_name] VARCHAR(150) NOT NULL,
[match_note] VARCHAR(300),
[match_status] VARCHAR(20) NOT NULL CONSTRAINT [allotment_match_status_df] DEFAULT 'PENDING',
[matched_entry_id] INT,
[upload_batch] VARCHAR(40);

-- AlterTable
ALTER TABLE [dbo].[ipo_entries] ADD [allotted_units] INT NOT NULL CONSTRAINT [ipo_entries_allotted_units_df] DEFAULT 0,
[entry_status] VARCHAR(20) NOT NULL CONSTRAINT [ipo_entries_entry_status_df] DEFAULT 'PENDING',
[refund_amount] DECIMAL(18,2) NOT NULL CONSTRAINT [ipo_entries_refund_amount_df] DEFAULT 0,
[refund_units] INT NOT NULL CONSTRAINT [ipo_entries_refund_units_df] DEFAULT 0;

-- CreateIndex
CREATE NONCLUSTERED INDEX [allotment_full_name_idx] ON [dbo].[allotment]([full_name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [allotment_match_status_idx] ON [dbo].[allotment]([match_status]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
