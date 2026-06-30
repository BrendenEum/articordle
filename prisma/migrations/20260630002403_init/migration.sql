-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('in_progress', 'won', 'lost');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "zoteroUserId" TEXT NOT NULL,
    "username" TEXT,
    "zoteroApiKeyEnc" TEXT NOT NULL,
    "selectedCollectionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "zoteroItemKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "citation" TEXT NOT NULL,
    "journal" TEXT NOT NULL DEFAULT '',
    "hasUsableText" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clue" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "methods" TEXT NOT NULL,
    "introDiscussion" TEXT NOT NULL,
    "journal" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameDate" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'in_progress',
    "guessesUsed" INTEGER NOT NULL DEFAULT 0,
    "cluesRevealed" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guess" (
    "id" TEXT NOT NULL,
    "dailyGameId" TEXT NOT NULL,
    "guessedPaperId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_zoteroUserId_key" ON "User"("zoteroUserId");

-- CreateIndex
CREATE INDEX "Paper_userId_idx" ON "Paper"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_userId_zoteroItemKey_key" ON "Paper"("userId", "zoteroItemKey");

-- CreateIndex
CREATE UNIQUE INDEX "Clue_paperId_key" ON "Clue"("paperId");

-- CreateIndex
CREATE INDEX "DailyGame_userId_idx" ON "DailyGame"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyGame_userId_gameDate_key" ON "DailyGame"("userId", "gameDate");

-- CreateIndex
CREATE INDEX "Guess_dailyGameId_idx" ON "Guess"("dailyGameId");

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clue" ADD CONSTRAINT "Clue_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGame" ADD CONSTRAINT "DailyGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyGame" ADD CONSTRAINT "DailyGame_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_dailyGameId_fkey" FOREIGN KEY ("dailyGameId") REFERENCES "DailyGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
