// Shared constants for public (marketing) pages. Single source so docs links,
// community links and legal text all point at the same real destinations.
import { API_BASE } from "../lib/api";

export const GITHUB_REPO_URL = "https://github.com/chi-trung/devflow-platform";
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`;

// Swagger UI is served by the API in every environment (see Program.cs), so
// this link always resolves to live, try-it-now endpoint documentation.
export const SWAGGER_URL = `${API_BASE}/swagger/index.html`;
