# Deploying Acon to the Linux box

The app is a static renderer plus an agent API that must share one origin. In
development Vite provides both — it serves the renderer and `server/agentPlugin.ts`
mounts the API as middleware. `vite build` only emits the renderer, so production
needs `server/serve.ts`, which serves `dist/` and the same API handlers.

Node strips the TypeScript in `server/` itself, so only the renderer is compiled.

## Starting from a bare machine

One file, one run. `start.sh` installs anything the machine is missing before
building:

```bash
git clone https://github.com/anishganapathi/A-con.git
cd A-con
./start.sh
```

On a fresh box it reports what is absent, shows what it intends to do, and asks
once:

```
==> This machine is missing: curl git node24

  Plan: apt-get, plus NodeSource for Node 24 (needs sudo)

Install these now? [Y/n]
```

Node comes from NodeSource rather than the distro, which is usually years behind
— the server runs from `.ts` sources, so anything before 22.18 cannot start it at
all. apt, dnf, yum, pacman and zypper are all handled. With no root available it
falls back to nvm under `$HOME`.

Use `./start.sh -y` to skip the prompt, which is also what you need when running
it from a script with no terminal attached.

Once the box is set up this whole step is a silent no-op.

The only thing it will not install for you is llama.cpp, which has to be serving
Qwen3-VL on `:8080` already. Menu option **5** tells you whether it is reachable.

No compiler toolchain is needed either way. The three native dependencies
(rolldown, oxlint, lightningcss) ship prebuilt binaries for `linux-x64` and
`linux-arm64`, so `npm ci` works on an ARM box such as a GB10 without
`build-essential` or node-gyp.

## The menu

Once it is up, `start.sh` stays in the terminal:

```
Acon  ·  http://10.0.0.21:4173  ·  running
  1 update from git   2 rebuild   3 restart   4 logs   5 status   q quit
```

Press **1** after pushing from your laptop: it pulls, reinstalls only if the
lockfile moved, rebuilds and restarts. **5** is the one to check first if the
chat stops responding — it says whether the vision model is reachable.

Open `http://<box-ip>:4173` from any machine on the LAN. The banner prints that
address, so there is no need to go looking for it.

To use a different port: `PORT=4174 ./start.sh`. To keep it off the LAN entirely:
`HOST=127.0.0.1 ./start.sh`.

## Running it unattended

`start.sh` stops when you close the terminal, which is usually what you want for
a demo. To have it survive logout and come back after a reboot, use the systemd
unit instead:

```bash
sudo cp deploy/acon.service /etc/systemd/system/acon.service
sudo systemctl daemon-reload
sudo systemctl enable --now acon
journalctl -u acon -f
```

The unit expects the repo at `/opt/acon`, owned by an `acon` user. Updating is
then `git pull && npm ci && npm run build && sudo systemctl restart acon`.

## Configuration

Settings are environment variables, set either on the `start.sh` command line or
as `Environment=` lines in `deploy/acon.service`. Deliberately not `.env`: that
file is gitignored, so it would never arrive with a `git pull`.

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4173` | |
| `HOST` | `0.0.0.0` | `127.0.0.1` to hide it from the LAN |
| `ECON_LOCAL_LLM_URL` | `http://10.0.1.20:8080/v1` | The built-in default is a LAN address, not loopback. On the box that runs llama.cpp, set `http://127.0.0.1:8080/v1`. |
| `ECON_LOCAL_LLM_MODEL` | `Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf` | Must match what llama.cpp reports |

The startup banner prints which model URL actually resolved, so pointing at the
wrong box shows up immediately rather than at the first chat message.

## If something is wrong

**Chat replies never arrive.** Press **5**. If the vision model is unreachable,
llama.cpp is down or on another port — check with `curl localhost:8080/v1/models`.

**The page loads but every message 404s.** The renderer is being served by
something other than `serve.ts` (nginx pointed straight at `dist/`, say). The API
and the renderer have to come from one origin.

**`./start.sh` says Node cannot run TypeScript.** The box is on a Node older than
22.18. The server has no build step and runs from source, so it needs a version
that strips types.

**Port 4173 is taken.** `PORT=4174 ./start.sh`, or stop whatever holds it.

**Pressing 1 fails on the pull.** The box has local changes or has diverged from
`origin/main`. Sort it out with git by hand, then press 1 again.
