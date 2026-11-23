const mysql = require('mysql2');

const hasDbConfig = Boolean(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
);

let exportedPool;

if (!hasDbConfig) {
    console.warn('[pool_conexoes] Variáveis de banco ausentes — usando catálogo e armazenamento em memória.');
    exportedPool = {
        isMock: true,
        query: async () => [[]],
        getConnection: async () => ({
            beginTransaction: async () => {},
            query: async () => [[]],
            commit: async () => {},
            rollback: async () => {},
            release: () => {}
        })
    };
} else {
    const pool = mysql.createPool({
        host:     process.env.DB_HOST,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port:     process.env.DB_PORT,
        waitForConnections: true,
        connectionLimit: 4,
        queueLimit: 0
    });

    const promisePool = pool.promise();
    promisePool.isMock = false;

    pool.getConnection((err, conn) => {
        if (err) {
            console.error('Erro ao conectar ao SGBD (ativando fallback em memória):', err.message);
            promisePool.isMock = true;
        } else {
            console.log('Conectado ao SGBD MySQL!');
            conn.release();
        }
    });

    exportedPool = promisePool;
}

module.exports = exportedPool;