# Configuración de servicios

Todo lo que se configura a mano fuera del repo. Ninguna clave secreta va en el repo.

## Supabase

- Proyecto: `gmpcnupjzqqfjkbywzet` (East US / Ohio) · URL `https://gmpcnupjzqqfjkbywzet.supabase.co`.
- Migraciones y seed: `supabase login` → `supabase link --project-ref gmpcnupjzqqfjkbywzet` → `npm run db:push`.

### Auth (paso 3)

1. **Authentication → URL Configuration**
   - Site URL: `https://familia-ludica.vercel.app`
   - Redirect URLs: `https://familia-ludica.vercel.app/**` y `http://localhost:5173/**`
2. **Authentication → Sign In / Providers → Google**: habilitado, con el Client ID y el Client Secret de Google Cloud (abajo).

## Google Cloud (cliente OAuth para el login del conductor)

1. [console.cloud.google.com](https://console.cloud.google.com) → crear proyecto "Familia Lúdica".
2. **APIs y servicios → Pantalla de consentimiento de OAuth** (Google Auth Platform → Branding): tipo **Externo**, nombre "Familia Lúdica", email de soporte. En **Público**, dejarla **en producción** (o en prueba agregando como usuarios de prueba a jorgeitamar@gmail.com y nataliaparatore@gmail.com).
3. **Clientes → Crear cliente → Aplicación web**:
   - Orígenes autorizados de JavaScript: `https://familia-ludica.vercel.app` y `http://localhost:5173`
   - URI de redireccionamiento autorizados: `https://gmpcnupjzqqfjkbywzet.supabase.co/auth/v1/callback`
4. Copiar Client ID y Client Secret a Supabase (arriba). El secret queda solo en Supabase.

## Vercel

- Proyecto `familia-ludica`, dominio de producción `https://familia-ludica.vercel.app`, rama `main`.
- Environment Variables (como Config, son públicas): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clave publishable).

## Admins

Los emails habilitados están en la tabla `admins` (seed). Para sumar uno: Supabase → SQL Editor →
`insert into admins (email) values ('nuevo@gmail.com');` (en minúsculas).
