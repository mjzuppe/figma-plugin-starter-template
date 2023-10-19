import * as postgres from "https://deno.land/x/postgres@v0.14.2/mod.ts";
import { QueryArrayResult, QueryResult } from "https://deno.land/x/postgres@v0.17.0/query/query.ts";

// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

type LemonSqueezy = {
  id?: string;
  license_key?: string;
  status: string;
  expires_at?: string;
}

type Payload = {
  status?: number;
  pathname: string;
  id?: string;
  id_figma?: string;
  trial_end?: string;
  ls?: LemonSqueezy;
  message?: string;
  license_key?: string;
};

const connection = async (): Promise<postgres.PoolClient> => {
  const databaseUrl = Deno.env.get('SUPABASE_DB_URL')!;
  const pool = new postgres.Pool(databaseUrl, 3, true);
  return await pool.connect();
}

const lsValidateKey = async (key: string) => {
  const formData = new FormData();
  formData.append("license_key", key);
  const r = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
    method: "POST",
    headers: {
      // "Accept": "application/json",
      // "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Bearer ${Deno.env.get('LS_TOKEN')}`
    },
    body: formData,
  });
  return r.json();
}

const lsActivateKey = async (key: string) => {
  const formData = new FormData();
  formData.append("license_key", key);
  formData.append("instance_name", "primary");
  const r = await fetch("https://api.lemonsqueezy.com/v1/licenses/activate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get('LS_TOKEN')}`
    },
    body: formData,
  });
  return r.json();
}

const route = async (req: { pathname: string, method: string, body: any, search: string }) => {
  const { pathname, method, body } = req;
  let payload: Payload = { status: 200, pathname };

  const getUser = async (email: string) => {
    const pg = await connection();
    const user: QueryArrayResult = await pg.queryArray("SELECT * FROM users WHERE id_figma = $1", email);
    if (user.rows.length === 0) return {};
    const id = typeof user.rows[0][0] === "bigint" ? user.rows[0][0].toString() : String(user.rows[0][0]);
    const id_figma = String(user.rows[0][2]);
    const trial_end = String(user.rows[0][1]);
    const ls_id = String(user.rows[0][3]);
    const license_key = String(user.rows[0][4]);
    const expires_at = String(user.rows[0][5]);
    const email_ls = String(user.rows[0][6]);
    return { id, id_figma, trial_end, ls_id, license_key, expires_at, email_ls };
  }

  switch (pathname) {
    case "/api/auth": {
      if (!body.id_figma) {
        payload = { ...payload, status: 422, message: "id_figma is required", ...{ pathname } };
        return payload;
      }

      let user = await getUser(body.id_figma);
      // new user
      if (!user.id) {
        const ts = new Date;
        ts.setDate(ts.getDate() + 7);
        const trial_end = ts.toISOString();
        const pg = await connection();
        await pg.queryArray(`INSERT INTO users (id_figma, trial_end) VALUES ('${body.id_figma}', '${trial_end}');`);
        user = await getUser(body.id_figma);
        const { id, id_figma, license_key } = user;
        payload = { ...payload, pathname, id_figma: body.id_figma, trial_end, id };
        return payload;
      }

      // existing user
      else {
        const { id, id_figma, license_key, trial_end } = user;
        if (license_key) {
          const license_key_data = await lsValidateKey(license_key);
          if (license_key_data?.license_key) {
            const { status, expires_at } = license_key_data.license_key;
            payload = { ...payload, ls: { status, expires_at }, license_key }
          }
        }
        payload = { ...payload, pathname, id_figma, trial_end, id };
      }
      return payload;
    }
    case "/api/activate": {
      // activate a license code
      if (!body.id_figma || !body.license_key) {
        payload = { ...payload, status: 422, message: "email and license_key are required", ...{ pathname } };
        return payload;
      }
      const pg = await connection();
      let user = await getUser(body.id_figma);
      if (!user) {
        // TODO throw error
      }
      const { license_key, meta } = await lsActivateKey(body.license_key);
      await pg.queryArray(`UPDATE users SET ls_id = '${license_key.id}', ls_license_key = '${license_key.key}', expires_at = '${license_key.expires_at}', email_ls = '${meta.customer_email}' WHERE id_figma = '${body.id_figma}';`);
      user = await getUser(body.id_figma);
      payload = { ...payload, pathname, ...user };
      return payload;
    }
    default: {
      break;
    }
  }

  return payload;
}
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const { method, headers } = req;
  const body = req.body ? await req.json() : {};
  const url = new URL(req.url);
  const { pathname, search } = url;
  const data = { method, body, pathname, search }

  let r = await route(data);
  const status = r?.status || 200;
  if (r?.status) delete r.status;


  return new Response(
    JSON.stringify(r),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
};


Deno.serve((req) => handler(req))

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
