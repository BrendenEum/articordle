-- AlterTable
ALTER TABLE "Paper" ADD COLUMN     "libraryId" TEXT,
ADD COLUMN     "libraryType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "selectedLibraryId" TEXT,
ADD COLUMN     "selectedLibraryType" TEXT;
