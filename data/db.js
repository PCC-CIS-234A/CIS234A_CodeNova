const sql = require("mssql");

// Database connection settings.
const config = {
    user: "CIS234A_CodeNova",
    password: "General6^",
    server: "cisdbss.pcc.edu",
    database: "CIS234A_CodeNova",
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Creates and returns a database connection pool.
async function getConnection() {
    return await sql.connect(config);
}

module.exports = {
    sql,
    getConnection
};