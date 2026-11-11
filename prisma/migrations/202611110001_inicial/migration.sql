CREATE TABLE "Nota" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "titulo" TEXT NOT NULL, "contenido" TEXT NOT NULL);
CREATE TABLE "Conversacion" ("id" TEXT NOT NULL PRIMARY KEY);
CREATE TABLE "Mensaje" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "conversacionId" TEXT NOT NULL, "rol" TEXT NOT NULL, "contenido" TEXT NOT NULL, CONSTRAINT "Mensaje_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "Conversacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "Mensaje_conversacionId_id_idx" ON "Mensaje"("conversacionId", "id");
CREATE TABLE "Consumo" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "modelo" TEXT NOT NULL, "operacion" TEXT NOT NULL, "inputTokens" INTEGER NOT NULL, "outputTokens" INTEGER NOT NULL, "costoUsd" REAL, "tarifaEntrada" REAL, "tarifaSalida" REAL);
CREATE INDEX "Consumo_fecha_idx" ON "Consumo"("fecha");
