-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameZh" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "chinese" TEXT NOT NULL,
    "pinyin" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
