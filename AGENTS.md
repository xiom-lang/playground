# AGENTS.md -- playground lane working instructions

## Cross-lane relay protocol (xiom-relays, since 2026-10-10)

- At session start and before finishing any task: pull xiom-relays and
  process items addressed to your lane
  (`python tools/relay.py view --lane playground`).
- Never edit another lane's item; open a new item instead.

The bus lives at `E:\xiom-lang\xiom-relays` (private;
clone: `git clone https://github.com/xiom-lang/xiom-relays.git`).
Read `README.md` and `PROTOCOL.md` there for the full lifecycle; the
doorbell is a recurring session check that pulls, processes items
`to: playground`, and updates statuses. All cross-lane communication
goes through the bus -- no hand-relayed messages.
