import { Navigate, generatePath, useLocation, useParams } from 'react-router-dom';

/** Send an old address to its new home, keeping route parameters, the query string and the hash. */
export function Redirect({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={generatePath(to, params) + search + hash} replace />;
}
