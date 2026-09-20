import sql from "mssql";

export type GameStatus = "Playing" | "Completed" | "Quit";

export interface GameStatusEntry {
    id: number;
    status: GameStatus;
    name: string;
}

let poolPromise: Promise<sql.ConnectionPool> | undefined;

function getPool(): Promise<sql.ConnectionPool> {
    if (!poolPromise) {
        const connectionString = process.env.AZURE_SQL_CONNECTION_STRING;
        if (!connectionString) {
            throw new Error("AZURE_SQL_CONNECTION_STRING is not set");
        }
        poolPromise = sql.connect(connectionString);
    }
    return poolPromise;
}

export async function getGameStatuses(): Promise<GameStatusEntry[]> {
    const pool = await getPool();
    const result = await pool
        .request()
        .query(
            "SELECT CONVERT(int, entry.Id) AS id, status.Status AS status, entry.Name AS name " +
                "FROM dbo.GameStatusEntry AS entry " +
                "INNER JOIN dbo.GameStatus AS status ON status.GameStatusId = entry.GameStatusId " +
                "WHERE TRY_CONVERT(int, entry.Id) IS NOT NULL ORDER BY entry.Id"
        );
    return result.recordset as GameStatusEntry[];
}

export async function saveGameStatus(
    entry: GameStatusEntry
): Promise<void> {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const request = new sql.Request(transaction);
        request.input("gameId", sql.NVarChar(50), String(entry.id));
        request.input("status", sql.NVarChar(50), entry.status);
        request.input("gameName", sql.NVarChar(sql.MAX), entry.name);
        await request.query(
            "DECLARE @statusId int; " +
                "SELECT @statusId = GameStatusId FROM dbo.GameStatus WHERE Status = @status; " +
                "IF @statusId IS NULL BEGIN " +
                "INSERT INTO dbo.GameStatus (Status) VALUES (@status); " +
                "SET @statusId = CONVERT(int, SCOPE_IDENTITY()); END; " +
                "UPDATE dbo.GameStatusEntry SET Name = @gameName, GameStatusId = @statusId " +
                "WHERE Id = @gameId; " +
                "IF @@ROWCOUNT = 0 INSERT INTO dbo.GameStatusEntry (Id, Name, GameStatusId) " +
                "VALUES (@gameId, @gameName, @statusId);"
        );
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

export async function deleteGameStatus(gameId: number): Promise<void> {
    const pool = await getPool();
    await pool
        .request()
        .input("gameId", sql.NVarChar(50), String(gameId))
        .query("DELETE FROM dbo.GameStatusEntry WHERE Id = @gameId");
}