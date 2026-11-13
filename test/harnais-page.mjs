/* Le lancement commun des bancs de page : le serveur sur un port libre avec un dossier de projets
   temporaire, un Chromium sans écran piloté par le protocole DevTools, et de quoi évaluer dans la page. */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const RACINE = fileURLToPath(new URL("..", import.meta.url));
const CHROMIUM = process.env.CHROMIUM || "/usr/bin/chromium";
const portLibre = () => new Promise(r => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
export const pause = (ms) => new Promise(r => setTimeout(r, ms));
async function attendreHttp(url, essais = 100){
  for(let i = 0; i < essais; i++){ try{ const r = await fetch(url); if(r.ok) return r; }catch(_){} await pause(200); }
  throw new Error("pas de réponse de " + url);
}

export async function ouvrirConception(){
  const projets = mkdtempSync(join(tmpdir(), "banc-conception-"));
  const profil = mkdtempSync(join(tmpdir(), "banc-chromium-"));
  const portWeb = await portLibre(), portCdp = await portLibre();
  /* L'exécutable Rust : WEB_3D_BIN donne son dossier (CI), sinon celui de « cargo build ». Son dossier
     personnel est un dossier d'essai : l'inscription « Ouvrir avec » du poste ne bouge pas. */
  const maison = mkdtempSync(join(tmpdir(), "banc-maison-"));
  const exe = join(process.env.WEB_3D_BIN || join(RACINE, "target", "debug"), process.platform === "win32" ? "web_3d.exe" : "web_3d");
  const serveur = spawn(exe, ["--port", portWeb, "--local", "--sans-navigateur", "--sans-pause", "--sans-maj", "--projets", projets],
    { cwd:RACINE, stdio:"ignore", env:{ ...process.env, WEB_TOOLS_HTTP:"1", WEB_3D_DEPOT:RACINE, HOME:maison, USERPROFILE:maison } });
  let navigateur = null, ws = null;
  /* Interrompu (Ctrl+C, délai de la CI) : on ne laisse ni processus ni profil de 100 Mo dans /tmp. */
  const nettoyer = () => {
    navigateur?.kill(); serveur.kill();
    for(const d of [projets, profil, maison]) rmSync(d, { recursive:true, force:true });
  };
  for(const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { nettoyer(); process.exit(130); });

  const erreurs = [];
  let n = 0, etape = "démarrage";
  const attentes = new Map();
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++n;
    attentes.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    /* unref : sans cela, le banc fini attendrait encore la minuterie de sa dernière commande. */
    setTimeout(() => attentes.delete(id) && reject(new Error(`${method} : pas de réponse en 5 min`)), 300000).unref();
  });
  /** Évalue `code` (corps de fonction async) dans la page ; rend sa valeur JSON. */
  async function page(code, delai = 240000){
    etape = code.trim().split("\n")[0].slice(0, 70);
    let minuteur;
    const r = await Promise.race([
      cdp("Runtime.evaluate", { expression:`(async () => { ${code} })()`, awaitPromise:true, returnByValue:true }),
      new Promise(fin => { minuteur = setTimeout(() => fin({ exceptionDetails:{ text:"délai dépassé" } }), delai); }),
    ]);
    clearTimeout(minuteur);
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  const fermer = async () => { ws?.close(); navigateur?.kill(); await pause(300); nettoyer(); };

  try{
    await attendreHttp(`http://127.0.0.1:${portWeb}/conception.html`);
    /* Chromium démarre sur la page : depuis about:blank, Page.navigate restait sans réponse sur le Pi. */
    navigateur = spawn(CHROMIUM, ["--headless=new", `--remote-debugging-port=${portCdp}`, `--user-data-dir=${profil}`,
      "--password-store=basic", "--use-mock-keychain",     // sinon le réseau de Chromium attend un trousseau, sans fin
      "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-first-run", "--window-size=1500,1100",
      `http://127.0.0.1:${portWeb}/conception.html`], { stdio:"ignore" });
    const cibles = await (await attendreHttp(`http://127.0.0.1:${portCdp}/json/list`)).json();
    ws = new WebSocket(cibles.find(c => c.type === "page").webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if(m.id && attentes.has(m.id)){ const a = attentes.get(m.id); attentes.delete(m.id); m.error ? a.reject(new Error(m.error.message)) : a.resolve(m.result); return; }
      if(m.method === "Runtime.exceptionThrown") erreurs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if(m.method === "Runtime.consoleAPICalled" && m.params.type === "error") erreurs.push(m.params.args.map(a => a.value ?? a.description).join(" "));
      if(m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/favicon/.test(m.params.entry.url || "")) erreurs.push(m.params.entry.text + " " + (m.params.entry.url || ""));
    };
    await cdp("Runtime.enable"); await cdp("Log.enable");
  }catch(e){
    await fermer();
    throw e;
  }
  const souris = (type, x, y, extra = {}) => cdp("Input.dispatchMouseEvent", { type, x, y, button:"left", buttons:type === "mouseReleased" ? 0 : 1, clickCount:1, ...extra });
  const cliquer = async (x, y) => { await souris("mouseMoved", x, y, { buttons:0, button:"none" }); await souris("mousePressed", x, y); await souris("mouseReleased", x, y); await pause(60); };
  const glisser = async (x0, y0, x1, y1) => {
    await souris("mouseMoved", x0, y0, { buttons:0, button:"none" }); await souris("mousePressed", x0, y0);
    for(let i = 1; i <= 6; i++){ await souris("mouseMoved", x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6); await pause(40); }
    await souris("mouseReleased", x1, y1); await pause(80);
  };
  return { cdp, page, erreurs, projets, portWeb, fermer, souris, cliquer, glisser, etape:() => etape };
}
