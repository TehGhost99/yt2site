// Cloud sync configuration for the Practice app.
//
// Leave as null to run in local-only mode (progress is saved in this browser).
// After creating your Appwrite Cloud project, replace with real values, e.g.:
//
window.APPWRITE_CONFIG = {
  endpoint: "https://sfo.cloud.appwrite.io/v1",
  projectId: "6a7541c7001f55e83f5c",
  databaseId: "practice",
  tableId: "progress",
  // Deployed Appwrite Function that grades written checks via Groq (Llama).
  functionId: "grade-check"
};
