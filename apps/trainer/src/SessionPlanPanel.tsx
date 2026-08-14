import {
  academyForPlan,
  type AcademyItem,
  type SessionPlan,
} from "@yugioh/coach";

const FOCUS_LABEL: Record<string, string> = {
  "going-first": "Going 1st",
  "going-second": "Going 2nd",
  handtraps: "Handtraps",
  resources: "Recursos",
  wincon: "Win con",
};

export function SessionPlanPanel({
  plan,
  academy,
  checked,
  onToggle,
  onRefresh,
  busy,
}: {
  plan: SessionPlan | null;
  academy: AcademyItem[];
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  const habits = plan ? academyForPlan(plan, academy) : [];

  return (
    <div className="block session-plan">
      <div className="block-head">
        <h3>Esta sesión</h3>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={busy}
          onClick={onRefresh}
        >
          Refresh plan
        </button>
      </div>
      {!plan ? (
        <p className="field-hint">
          Select your .ydk to generate a plan and 3 session goals.
        </p>
      ) : (
        <>
          <p className="session-summary">{plan.deckSummary}</p>
          <div className="session-meta">
            <span className={`pill ${plan.source === "llm" ? "ok" : "warn"}`}>
              {plan.source === "llm" ? "IA" : "estático"}
              {plan.usedModel ? ` · ${plan.usedModel}` : ""}
            </span>
          </div>
          <div className="session-grid">
            <div>
              <h4>Starters</h4>
              <p>{plan.starters.join(" · ") || "—"}</p>
            </div>
            <div>
              <h4>Choke points</h4>
              <p>{plan.chokePoints.join(" · ") || "—"}</p>
            </div>
            <div>
              <h4>Going first</h4>
              <p>{plan.goingFirst}</p>
            </div>
            <div>
              <h4>Going second</h4>
              <p>{plan.goingSecond}</p>
            </div>
          </div>
          <h4 className="session-goals-heading">Objetivos (marca al cumplirlos)</h4>
          <ul className="goal-list">
            {plan.goals.map((goal) => (
              <li key={goal.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(checked[goal.id])}
                    onChange={() => onToggle(goal.id)}
                  />
                  <span>
                    <em>{FOCUS_LABEL[goal.focus] ?? goal.focus}</em>
                    {goal.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {habits.length > 0 && (
            <>
              <h4 className="session-goals-heading">Hábito de academy</h4>
              <ul className="academy-list">
                {habits.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
