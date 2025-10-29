import axios from "axios";

const axiosClient = axios.create({
  baseURL: "http://localhost:4000/api", // 👈 backend API URL
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Optional: attach token automatically (after login)
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
