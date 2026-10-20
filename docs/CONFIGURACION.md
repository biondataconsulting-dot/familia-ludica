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
2. **Google Auth Platform → Comenzar**: nombre "Familia Lúdica", email de soporte, público **Externo**. La app queda en modo **Prueba** (publicarla exige página principal y política de privacidad). En **Público → Usuarios de prueba** van los admins (jorgeitamar@gmail.com, nataliaparatore@gmail.com, bion.dataconsulting@gmail.com) y una cuenta extra para probar "Sin acceso". Cualquier otra cuenta es bloqueada por Google antes de llegar a la app.
3. **Clientes → Crear cliente → Aplicación web**:
   - Orígenes autorizados de JavaScript: `https://familia-ludica.vercel.app` y `http://localhost:5173`
   - URI de redireccionamiento autorizados: `https://gmpcnupjzqqfjkbywzet.supabase.co/auth/v1/callback`
4. Copiar Client ID y Client Secret a Supabase (arriba). El secret queda solo en Supabase.

## Vercel

- Proyecto `familia-ludica`, dominio de producción `https://familia-ludica.vercel.app`, rama `main`.
- Environment Variables (como Config, son públicas): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clave publishable).

## Admins

Habilitados: jorgeitamar@gmail.com, nataliaparatore@gmail.com, bion.dataconsulting@gmail.com (tabla `admins`).
Para sumar un conductor hacen falta **dos cosas**:
1. Una migración nueva en `supabase/migrations/` con `insert into public.admins (email) values ('nuevo@gmail.com') on conflict do nothing;` (en minúsculas) → `npm run db:push`.
2. Agregarlo como usuario de prueba en Google Auth Platform → Público (si no, Google lo bloquea).
