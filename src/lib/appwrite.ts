import { Account, Client, ID, OAuthProvider, Permission, Query, Role, TablesDB } from "appwrite";

const env = {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim(),
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID?.trim(),
    projectName: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_NAME?.trim(),
    databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID?.trim(),
    boardsCollectionId: process.env.NEXT_PUBLIC_APPWRITE_BOARDS_COLLECTION_ID?.trim(),
    adminEmail: process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim(),
};

export const APPWRITE_ENDPOINT = env.endpoint || "https://api.verygood-chocolate.com/v1";
export const APPWRITE_PROJECT_ID = env.projectId || "verygood-main";
export const APPWRITE_PROJECT_NAME = env.projectName || "verygood";
export const APPWRITE_DATABASE_ID = env.databaseId || "69c12e03001021845c83";
export const APPWRITE_BOARDS_COLLECTION_ID = env.boardsCollectionId || "boards";
export const ADMIN_EMAIL = env.adminEmail || "nam9295@gmail.com";

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);

export { ID, OAuthProvider, Permission, Query, Role };
