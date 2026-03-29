BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [full_name] VARCHAR(150) NOT NULL,
    [email] VARCHAR(120) NOT NULL,
    [password_hash] VARCHAR(255) NOT NULL,
    [role] VARCHAR(20) NOT NULL CONSTRAINT [users_role_df] DEFAULT 'STAFF',
    [is_active] BIT NOT NULL CONSTRAINT [users_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[ipo_master] (
    [id] INT NOT NULL IDENTITY(1,1),
    [company_name] VARCHAR(200) NOT NULL,
    [company_code] VARCHAR(40) NOT NULL,
    [price_per_unit] DECIMAL(18,2) NOT NULL,
    [district] VARCHAR(100) NOT NULL,
    [issued_units] INT NOT NULL,
    [min_units] INT NOT NULL,
    [max_units] INT NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [ipo_master_status_df] DEFAULT 'ACTIVE',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [ipo_master_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [ipo_master_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ipo_master_company_code_key] UNIQUE NONCLUSTERED ([company_code])
);

-- CreateTable
CREATE TABLE [dbo].[ipo_entries] (
    [id] INT NOT NULL IDENTITY(1,1),
    [ipo_id] INT NOT NULL,
    [form_no] VARCHAR(40) NOT NULL,
    [date_bs] VARCHAR(20) NOT NULL,
    [boid] VARCHAR(16) NOT NULL,
    [name] VARCHAR(150) NOT NULL,
    [father_name] VARCHAR(150) NOT NULL,
    [grandfather_name] VARCHAR(150) NOT NULL,
    [citizenship_no] VARCHAR(50) NOT NULL,
    [bank_name] VARCHAR(150) NOT NULL,
    [account_no] VARCHAR(80) NOT NULL,
    [mobile_no] VARCHAR(20) NOT NULL,
    [applied_units] INT NOT NULL,
    [deposit_amount] DECIMAL(18,2) NOT NULL,
    [remarks] VARCHAR(300),
    [pan_no] VARCHAR(30),
    [district] VARCHAR(100) NOT NULL,
    [created_by] INT NOT NULL,
    [updated_by] INT NOT NULL,
    [boid_verified] BIT NOT NULL CONSTRAINT [ipo_entries_boid_verified_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [ipo_entries_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [ipo_entries_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ipo_entries_ipo_id_form_no_key] UNIQUE NONCLUSTERED ([ipo_id],[form_no])
);

-- CreateTable
CREATE TABLE [dbo].[allotment] (
    [id] INT NOT NULL IDENTITY(1,1),
    [ipo_id] INT NOT NULL,
    [boid] VARCHAR(16),
    [name] VARCHAR(150) NOT NULL,
    [allotted_units] INT NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [allotment_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [allotment_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ipo_entries_ipo_id_idx] ON [dbo].[ipo_entries]([ipo_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ipo_entries_boid_idx] ON [dbo].[ipo_entries]([boid]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [allotment_ipo_id_idx] ON [dbo].[allotment]([ipo_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [allotment_boid_idx] ON [dbo].[allotment]([boid]);

-- AddForeignKey
ALTER TABLE [dbo].[ipo_entries] ADD CONSTRAINT [ipo_entries_ipo_id_fkey] FOREIGN KEY ([ipo_id]) REFERENCES [dbo].[ipo_master]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ipo_entries] ADD CONSTRAINT [ipo_entries_created_by_fkey] FOREIGN KEY ([created_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ipo_entries] ADD CONSTRAINT [ipo_entries_updated_by_fkey] FOREIGN KEY ([updated_by]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[allotment] ADD CONSTRAINT [allotment_ipo_id_fkey] FOREIGN KEY ([ipo_id]) REFERENCES [dbo].[ipo_master]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
