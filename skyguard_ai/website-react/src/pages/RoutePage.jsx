import React from 'react';
import { Navigate } from 'react-router-dom';

// The planner lives at /location — kept as a redirect shim so old /route
// links keep working.
export default function RoutePage() {
  return <Navigate to="/location" replace />;
}
