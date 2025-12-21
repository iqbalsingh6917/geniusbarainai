// Utility functions for making authenticated API calls

export class ApiError extends Error {
  status: number;
  maintenance?: boolean;
  code?: string;
  details?: any;
  requestId?: string;
  constructor(
    status: number,
    message: string,
    maintenance = false,
    code?: string,
    details?: any,
    requestId?: string
  ) {
    super(message);
    this.status = status;
    this.maintenance = maintenance;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    let msg = `HTTP error! status: ${response.status}`;
    let maintenance = false;
    let code: string | undefined;
    let details: any;
    let requestId: string | undefined;
    try {
      const body = await response.json();
      msg = body?.error?.message || body?.message || msg;
      code = body?.error?.code || body?.code;
      maintenance = body?.error?.code === 'MAINTENANCE_MODE';
      details = body?.error?.details;
      requestId = body?.error?.requestId;
    } catch {
      // ignore
    }
    if (!requestId) {
      requestId = response.headers.get('x-request-id') ?? undefined;
    }
    if (requestId) {
      msg = `${msg} (requestId: ${requestId})`;
    }
    throw new ApiError(response.status, msg, maintenance, code, details, requestId);
  }
  if (response.status === 204) {
    return null;
  }
  const payload = await response.json();
  return (payload as any)?.data ?? payload;
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
  };
}

const inflightGets = new Map<string, Promise<any>>();

export const apiClient = {
  get: async (url: string) => {
    if (inflightGets.has(url)) {
      return inflightGets.get(url);
    }
    const promise = fetch(url, { headers: getAuthHeaders() })
      .then(handleResponse)
      .finally(() => {
        inflightGets.delete(url);
      });
    inflightGets.set(url, promise);
    return promise;
  },

  post: async (url: string, data: any) => {
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
    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};
