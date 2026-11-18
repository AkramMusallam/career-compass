// Initialize least-privilege application MongoDB users scoped strictly to career_compass.
const dbName = process.env.MONGO_DB || "career_compass";
const appDb = db.getSiblingDB(dbName);

const apiUser = process.env.MONGO_API_USER || "career_api";
const apiPassword = process.env.MONGO_API_PASSWORD;
if (!apiPassword) {
  throw new Error("MONGO_API_PASSWORD must be set to initialize career_api user");
}

const workerUser = process.env.MONGO_WORKER_USER || "career_worker";
const workerPassword = process.env.MONGO_WORKER_PASSWORD;
if (!workerPassword) {
  throw new Error("MONGO_WORKER_PASSWORD must be set to initialize career_worker user");
}

function ensureAppUser(username, pwd) {
  const existing = appDb.getUser(username);
  if (existing) {
    appDb.updateUser(username, {
      pwd,
      roles: [{ role: "readWrite", db: dbName }],
    });
  } else {
    appDb.createUser({
      user: username,
      pwd,
      roles: [{ role: "readWrite", db: dbName }],
    });
  }
}

ensureAppUser(apiUser, apiPassword);
ensureAppUser(workerUser, workerPassword);
