# Spec Quest

An interactive, colorful 3D RPG canvas for turning an idea into a researched software specification in GitHub Copilot. Explore four themed areas, talk to NPCs about assumptions and tradeoffs, make decisions, and unlock the next area as Copilot revises the plan. You can also sit by the campfire, fish, play the musical stones, kick a beach ball, and dance.

Spec Quest is a **Copilot canvas extension**, not a standalone website or a GitHub App. Copilot does the research in the conversation and publishes revised plans to the canvas. Decisions and exported specifications are saved in the owning Copilot session workspace, not in this repository.

## Install

Requires a GitHub Copilot app/runtime that supports [canvas extensions](https://docs.github.com/en/copilot). Node.js and npm are needed to install the bundled Three.js renderer.

1. Clone this repository into your personal Copilot extensions directory:

   ```sh
   mkdir -p ~/.copilot/extensions
   git clone https://github.com/octobooth-1/spec-quest.git ~/.copilot/extensions/spec-quest
   cd ~/.copilot/extensions/spec-quest
   npm ci
   ```

   If you already have a `spec-quest` extension there, back it up first; cloning will not overwrite it. Alternatively, place this folder at `.github/extensions/spec-quest/` in a project repository and run `npm ci` inside it. A project extension with the same name shadows a personal extension.
2. Reload extensions in the Copilot app (or restart it). The **Spec Quest** canvas and `spec_quest_read`, `spec_quest_publish`, and `spec_quest_reply` tools should become available.
3. Ask Copilot to create a spec or plan and use Spec Quest. Copilot researches your idea, opens the canvas, and publishes areas and NPC decisions. Open the Quest Journal to read or export the evolving Markdown specification.

The `@github/copilot-sdk` import is provided by the Copilot extension runtime; do not install it separately. `npm ci` installs `three` for the renderer. The extension serves its UI on a randomly chosen loopback port per canvas instance; it does not deploy a public web server.

## Play

| Control | Action |
| --- | --- |
| WASD / arrow keys, or click | Move |
| Space | Jump |
| E | Talk to an NPC or interact with the nearest activity |
| X | Dance; nearby NPCs join in |
| J | Open the quest journal |
| Q / camera buttons | Rotate the camera |

At the campfire, press **E** to sit and roast a marshmallow; at the pond, press **E** to cast and again when the bobber dips. Step across the five musical stones in order, run into the beach ball or jump on it. Island treasures appear in the journal. Choices made with NPCs evolve the specification when you advance; activities are optional.

## How it works

- `extension.mjs` registers the canvas, agent tools and planning guidance with the Copilot SDK.
- `store.mjs` and `schema.mjs` maintain per-session plan files, decisions, revisions and pending requests. No example plan or private session data is included in the repository.
- `server.mjs` serves the iframe and session state over an instance-specific loopback URL; `ui.js` and the renderer modules create the 3D world and interactions.
- `npm test` runs the plan-store tests. The extension intentionally has no build step.

Spec Quest is licensed under [MIT](LICENSE). Contributions and bug reports are welcome.
