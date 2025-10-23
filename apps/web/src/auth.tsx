
import { Auth0Provider } from "@auth0/auth0-react";

const domain = import.meta.env.VITE_AUTH0_DOMAIN as string;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID as string;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE as string;

export function Auth({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        audience,
        scope: "todo.read todo.write todo.delete",
        redirect_uri: window.location.origin,
      }}
      cacheLocation="memory"
      useRefreshTokensFallback={true}
    >
      {children}
    </Auth0Provider>
  );
}
