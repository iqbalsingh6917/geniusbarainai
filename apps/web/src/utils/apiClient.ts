// Utility functions for making authenticated API calls

export class ApiError extends Error {
  status: number;
  maintenance?: boolean;
  code?: string;
  constructor(status: number, message: string, maintenance = false, code?: string) {
    super(message);
    this.status = status;
    this.maintenance = maintenance;
    this.code = code;
  }
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    let msg = `HTTP error! status: ${response.status}`;
    let maintenance = false;
    let code: string | undefined;
    try {
      const body = await response.json();
      msg = body?.error?.message || body?.message || msg;
      code = body?.error?.code || body?.code;
      maintenance = body?.error?.code === 'MAINTENANCE_MODE';
    } catch {
      // ignore
    }
    throw new ApiError(response.status, msg, maintenance, code);
  }
  if (response.status === 204) {
    return null;
  }
  const payload = await response.json();
  return (payload as any)?.data ?? payload;
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  console.log('Token from localStorage:', token);
  return {
    Authorization: `Bearer ${token}`,
  };
}

export const apiClient = {
  get: async (url: string) => {
    console.log('Making GET request to:', url);
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  post: async (url: string, data: any) => {
    console.log('Making POST request to:', url);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  patch: async (url: string, data: any) => {
    console.log('Making PATCH request to:', url);
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  put: async (url: string, data: any) => {
    console.log('Making PUT request to:', url);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (url: string) => {
    console.log('Making DELETE request to:', url);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};
