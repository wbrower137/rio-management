import express from "express";
import cors from "cors";
import { legalEntityRoutes } from "./routes/legalEntities.js";
import { orgUnitRoutes } from "./routes/orgUnits.js";
import { riskRoutes } from "./routes/risks.js";
import { categoryRoutes } from "./routes/categories.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use("/api/legal-entities", legalEntityRoutes);
app.use("/api/organizational-units", orgUnitRoutes);
app.use("/api/risks", riskRoutes);
app.use("/api/categories", categoryRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`RIO Management API running at http://localhost:${PORT}`);
});
