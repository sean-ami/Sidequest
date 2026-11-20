# Set up Beatbox to Beats on this machine (served over Tailscale HTTPS)

You are running on my own computer. Please set up the **Beatbox to Beats** web app here so I can open it from my phone over Tailscale, the same way I already reach **CardForge**. Work through the steps below, check each one, and stop to ask me before installing software or changing anything that CardForge uses.

## What it is

A static web app (plain HTML + JS, no build step, no dependencies) in the `beatbox/` folder of the GitHub repo `sean-ami/sidequest`, on branch `ccr-eabd2016-lyba63`. It needs the **microphone**, and browsers only allow the mic on **HTTPS** pages, so a plain `http://100.x.y.z:port` link is not enough. Use `tailscale serve` to give it a real `https://<machine>.<tailnet>.ts.net` address.

## Steps

1. **Look around first.**
   - Note the OS and shell.
   - Check that `git`, `tailscale` and either `python3` (`py` on Windows) or `node` are installed.
   - Run `tailscale status` and `tailscale serve status`. Write down what CardForge is already serving (which HTTPS port maps to which local port). **Do not change or remove any existing serve entries.**
   - Find how CardForge is kept running (a service, a launch agent, a scheduled task, pm2, a terminal script…). Beatbox should be kept running the same way.

2. **Get the code.**
   - If a clone of `sean-ami/sidequest` already exists on this machine, use it: `git fetch origin ccr-eabd2016-lyba63 && git checkout ccr-eabd2016-lyba63`. First make sure that clone has no uncommitted work you'd disturb. If it does, ask me.
   - Otherwise, clone it next to where my other projects live: `git clone https://github.com/sean-ami/sidequest.git Sidequest && cd Sidequest && git checkout ccr-eabd2016-lyba63`.
   - Check: `beatbox/index.html` exists.

3. **Sanity-check it (if Node is installed).**
   - Run `node --test beatbox/test/dsp.test.mjs`. All tests should pass. (The zip test uses `unzip`. If that one fails only because `unzip` is missing, that's fine.)

4. **Serve it locally on a free port.**
   - Pick a port that nothing else uses (try `8765`; check with `lsof -i :8765` / `netstat`).
   - From the `beatbox/` folder: `python3 -m http.server 8765 --bind 127.0.0.1` (or `npx --yes http-server -p 8765 -a 127.0.0.1`).
   - Bind to `127.0.0.1` so only Tailscale's HTTPS front door is exposed.
   - Check: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8765/` returns `200`.

5. **Put Tailscale HTTPS in front of it**, on an HTTPS port CardForge isn't using (`8443` if free, otherwise `10000` or another free port):
   - `tailscale serve --bg --https=8443 http://127.0.0.1:8765`
   - If it says HTTPS certificates aren't enabled, stop and tell me. I need to turn on **DNS → HTTPS Certificates** in the Tailscale admin console.
   - **Do not use `tailscale funnel`.** This should stay private to my tailnet.
   - Check: `tailscale serve status` shows both CardForge's entry (unchanged) and the new one. `curl -s -o /dev/null -w "%{http_code}" https://<machine>.<tailnet>.ts.net:8443/` returns `200`.

6. **Keep it running.**
   - Make the local server survive reboots and closed terminals, using the same mechanism CardForge uses. If CardForge has none, propose the simplest native option for this OS: launchd on macOS, a systemd user service on Linux, Task Scheduler on Windows. Show me the file before installing it.
   - `tailscale serve --bg` already persists across restarts.

7. **Report back** with:
   - the exact phone URL (`https://<machine>.<tailnet>.ts.net:8443`)
   - what you started and how it stays running
   - how to stop it (`tailscale serve --https=8443 off`, plus stopping the local server)
   - anything you skipped or couldn't do

## On my phone afterwards

With Tailscale connected, open the URL and tap **Record**. The browser asks for mic permission once. Headphones are best if I turn on the click during recording.
