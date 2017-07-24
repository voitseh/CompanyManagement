

SET QUOTED_IDENTIFIER OFF;
GO
USE [CompanyManagement];
GO
IF SCHEMA_ID(N'dbo') IS NULL EXECUTE(N'CREATE SCHEMA [dbo]');
GO

-- --------------------------------------------------
-- Dropping existing FOREIGN KEY constraints
-- --------------------------------------------------


-- --------------------------------------------------
-- Dropping existing tables
-- --------------------------------------------------

IF OBJECT_ID(N'[dbo].[Companies]', 'U') IS NOT NULL
    DROP TABLE [dbo].[Companies];
GO

-- --------------------------------------------------
-- Creating all tables
-- --------------------------------------------------

-- Creating table 'Companies'
CREATE TABLE [dbo].[Companies] (
    [Id] int IDENTITY(1,1) NOT NULL,
    [ParentId] int  NULL,
    [NodeName] nvarchar(max)  NOT NULL,
	[Earnings] int NOT NULL
);
GO

-- --------------------------------------------------
-- Creating all PRIMARY KEY constraints
-- --------------------------------------------------

-- Creating primary key on [Id] in table 'Nodes'
ALTER TABLE [dbo].[Companies]
ADD CONSTRAINT [PK_Companies]
    PRIMARY KEY CLUSTERED ([Id] ASC);
GO

-- --------------------------------------------------
-- Creating all FOREIGN KEY constraints
-- --------------------------------------------------
-- Define the relationship between ParentID and ID fields.
IF NOT EXISTS (SELECT * FROM sys.foreign_keys 
       WHERE object_id = OBJECT_ID(N'[dbo].[FK_Companies_Companies]')
       AND parent_object_id = OBJECT_ID(N'[dbo].[Companies]'))
ALTER TABLE [dbo].[Companies]  WITH CHECK ADD  
       CONSTRAINT [FK_Companies_Companies] FOREIGN KEY([ParentID])
REFERENCES [dbo].[Companies] ([ID])
GO
ALTER TABLE [dbo].[Companies] CHECK 
       CONSTRAINT [FK_Companies_Companies]
GO
-- --------------------------------------------------
-- Script has ended
-- --------------------------------------------------
