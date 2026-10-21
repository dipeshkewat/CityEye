const API_BASE = "http://localhost:8000/api/v1";

export const getAuthToken = () => localStorage.getItem("cityeye_token");
export const setAuthToken = (token) => localStorage.setItem("cityeye_token", token);
export const removeAuthToken = () => localStorage.removeItem("cityeye_token");

export const getStoredUser = () => {
  const userStr = localStorage.getItem("cityeye_user");
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};
export const setStoredUser = (user) => localStorage.setItem("cityeye_user", JSON.stringify(user));
export const removeStoredUser = () => localStorage.removeItem("cityeye_user");

const request = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
};

export const api = {
  // Auth
  login: async (email, password) => {
    const data = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.access_token);
    setStoredUser(data.user);
    return data;
  },

  getMe: async () => {
    return request("/auth/me");
  },

  getWorkTeams: async () => {
    return request("/auth/work-teams");
  },

  // Stats
  getDashboardStats: async () => {
    return request("/stats/dashboard");
  },

  // Cameras
  getCameras: async () => {
    return request("/cameras");
  },

  registerCamera: async (cameraData) => {
    return request("/cameras", {
      method: "POST",
      body: JSON.stringify(cameraData),
    });
  },

  // Reports
  getReports: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.problem_type) query.append("problem_type", params.problem_type);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request(`/reports${qs}`);
  },

  getReportDetail: async (id) => {
    return request(`/reports/${id}`);
  },

  reviewReport: async (id, decision, rejection_reason = null) => {
    return request(`/reports/${id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ decision, rejection_reason }),
    });
  },

  assignReport: async (id, assigned_team) => {
    return request(`/reports/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assigned_team }),
    });
  },

  startProgress: async (id) => {
    return request(`/reports/${id}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" }),
    });
  },

  resolveReport: async (id, resolution_notes, resolution_photo_path = null) => {
    return request(`/reports/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ resolution_notes, resolution_photo_path }),
    });
  },

  // File Upload
  uploadResolutionPhoto: async (file) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/files/upload-resolution`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to upload resolution image");
    }

    return response.json();
  },

  // Helper for Authenticated Image URLs
  getImageUrl: (imagePath) => {
    if (!imagePath) return null;
    const token = getAuthToken();
    // imagePath format: /uploads/evidence/filename.jpg or /uploads/resolutions/filename.jpg
    const parts = imagePath.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[0] === "uploads") {
      const category = parts[1]; // evidence or resolutions
      const filename = parts[2];
      return `${API_BASE}/files/view/${category}/${filename}?token=${token}`;
    }
    return imagePath;
  },
};
