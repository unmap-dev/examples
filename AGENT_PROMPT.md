# Build with an agent

Paste the following into your coding agent in the project you want to change. Replace the bracketed parts with your use case. The agent can prepare the integration without seeing your key; supply it directly in your local environment file or demo input.

```text
Build [my use case] from these Unmap examples.

1. Read README.md, AGENTS.md, and CATALOG.md. Inspect my current project and
   choose the closest example for its existing framework. If I have no app,
   use plain TypeScript unless my use case needs a React or Vue block. Tell
   me which example you selected and why.
2. For a first map without dependencies, run node scripts/serve.mjs quickstart
   3003. For development, install only the selected lane with the filtered
   install command in README.md, then run its dev command. Do not install
   all framework starters just to try one.
3. Reuse the example's page, components, imports, CSS, and helper/data files.
   When extracting into another app, include transitive dependencies and the
   matching MapLibre worker setup. Keep the map's explicit height, lifecycle
   cleanup, [longitude, latitude] convention, and source/data attribution.
4. Replace demonstration content with [my content] and add [my feature].
   Retain the project's design system. Document any required layer add-on.
5. I will supply a browser key in the lane's ignored environment file or demo
   input. Never read, print, or commit it. Tell me the exact localhost origin
   to allow. Do not use server secrets in browser configuration.
6. Run the selected lane's check command and inspect its page locally. Report
   changed files, commands/results, URL, and anything I must configure. Be
   explicit if live map/API requests could not be verified without a key.
   Do not deploy or publish as part of this task.
```

A finished integration should have a runnable local URL, a visible map when a valid browser key is supplied, correct attribution, and passing relevant checks. Review the changes before using them in production. For changes to this repository itself, follow [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
