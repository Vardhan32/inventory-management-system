import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export function getErrorMessage(error) {
  const data = error.response?.data;
  if (!data) return "Could not reach the API. Is the FastAPI server running?";
  if (data.errors) {
    const firstError = Object.values(data.errors)[0];
    if (firstError) return firstError;
  }
  if (typeof data.detail === "string") return data.detail;
  return data.message || "Something went wrong. Please try again.";
}

export default api;
