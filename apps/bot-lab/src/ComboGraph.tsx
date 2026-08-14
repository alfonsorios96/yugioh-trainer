import type { ComboModel } from "@yugioh/bot-lab";

export function ComboGraph({ model }: { model: ComboModel }) {
  const byKind = {
    requires: model.edges.filter((e) => e.kind === "requires"),
    enables: model.edges.filter((e) => e.kind === "enables"),
    window: model.edges.filter((e) => e.kind === "window"),
    recovers: model.edges.filter((e) => e.kind === "recovers"),
  };
  return (
    <div className="graph">
      <div className="graph-nodes">
        {model.nodes.map((n) => (
          <div key={n.id} className="graph-node">
            <strong>{n.label}</strong>
            <span className="muted">{n.id}</span>
          </div>
        ))}
      </div>
      <div className="graph-edges">
        {(Object.keys(byKind) as (keyof typeof byKind)[]).map((kind) => (
          <section key={kind}>
            <h3>{kind}</h3>
            {byKind[kind].length === 0 ? (
              <p className="muted">Sin aristas.</p>
            ) : (
              <ul>
                {byKind[kind].map((e, i) => (
                  <li key={`${e.from}-${e.to}-${i}`}>
                    <code>{e.from}</code>
                    {" → "}
                    <code>{e.to}</code>
                    {e.note ? <span className="muted"> — {e.note}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
