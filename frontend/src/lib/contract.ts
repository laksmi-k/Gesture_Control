// Hand-written mirrors of the template's Pydantic models in backend/server.py.
// The focused MVP does not render status checks, but keeping the boundary typed
// preserves the contract for the existing smoke endpoint and future telemetry.
export interface StatusCheck {
  id: string;
  client_name: string;
  timestamp: string;
}

export interface StatusCheckCreate {
  client_name: string;
}