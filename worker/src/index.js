const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...JSON_HEADERS,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type, apikey"
    }
  });
}

function supabaseBase(env) {
  return env.SUPABASE_URL.replace(/\/$/, "");
}

async function supabaseRest(env, path, token) {
  const res = await fetch(supabaseBase(env) + "/rest/v1/" + path, {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + (token || env.SUPABASE_PUBLISHABLE_KEY),
      Accept: "application/json"
    }
  });
  const body = await res.text();
  if (!res.ok) return { error: body, status: res.status };
  return { data: body ? JSON.parse(body) : null };
}

async function supabaseUser(env, token) {
  const res = await fetch(supabaseBase(env) + "/auth/v1/user", {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + token
    }
  });
  if (!res.ok) return null;
  return res.json();
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "Authorization, Content-Type, apikey",
          "access-control-max-age": "86400"
        }
      });
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
      return json({ error: "Configuration Supabase manquante dans Cloudflare." }, 500);
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ service: "Wave Skincare API", status: "ok", configured: true });
    }

    if (request.method !== "GET") {
      return json({ error: "Méthode non autorisée." }, 405);
    }

    if (url.pathname === "/api/products") {
      const result = await supabaseRest(
        env,
        "products?select=id,category_id,name,description,price,image_url,stock,active,created_at&active=eq.true&order=created_at.desc"
      );
      if (result.error) return json({ error: "Lecture des produits impossible.", details: result.error }, 502);
      return json({ products: result.data });
    }

    if (url.pathname === "/api/categories") {
      const result = await supabaseRest(env, "categories?select=id,name,description&order=name.asc");
      if (result.error) return json({ error: "Lecture des catégories impossible.", details: result.error }, 502);
      return json({ categories: result.data });
    }

    if (url.pathname === "/api/me") {
      const authorization = request.headers.get("Authorization") || "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!token) return json({ error: "Connexion requise." }, 401);

      const user = await supabaseUser(env, token);
      if (!user?.id) return json({ error: "Session invalide ou expirée." }, 401);

      const profile = await supabaseRest(
        env,
        "profiles?select=id,full_name,phone,role&id=eq." + encodeURIComponent(user.id) + "&limit=1",
        token
      );
      if (profile.error) return json({ error: "Lecture du profil impossible.", details: profile.error }, 502);
      return json({
        user: { id: user.id, email: user.email },
        profile: profile.data?.[0] || null
      });
    }

    return json({ error: "Route introuvable." }, 404);
  }
};
