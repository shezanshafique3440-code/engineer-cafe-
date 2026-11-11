const pg = require("pg");
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/cafe_operations_test") throw Error("Disposable localhost operations database required.");
module.exports = { ...pg, Pool: class extends pg.Pool { constructor(options) { super({ ...options, connectionString: String(url) }); } } };
