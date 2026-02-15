export function HelpContent() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  const h2 = { margin: "1.75rem 0 0.75rem", fontSize: "1.125rem", fontWeight: 600, color: "#1e293b" };
  const h3 = { margin: "1.25rem 0 0.5rem", fontSize: "1rem", fontWeight: 600, color: "#334155" };
  const p = { margin: "0.5rem 0", fontSize: "0.9375rem", lineHeight: 1.65, color: "#475569" };
  const ul = { margin: "0.5rem 0", paddingLeft: "1.5rem", fontSize: "0.9375rem", lineHeight: 1.7, color: "#475569" };
  const li = { marginBottom: "0.35rem" };
  const strong = { color: "#334155" };
  const hr = { border: "none", borderTop: "1px solid #e2e8f0", margin: "1.5rem 0" };
  const box = { background: "#f8fafc", borderRadius: 6, padding: "0.75rem 1rem", margin: "0.75rem 0", borderLeft: "3px solid #94a3b8", fontSize: "0.9375rem", color: "#475569" };

  return (
    <section style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "2rem", maxWidth: 800 }}>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", fontWeight: 600, color: "#0f172a" }}>RIO Management — User Guide</h1>
      <p style={{ margin: 0, fontSize: "0.9375rem", color: "#64748b" }}>
        How to work with Risks, Issues, and Opportunities. Written for editors.
      </p>

      <hr style={hr} />

      <h2 style={h2}>1. Getting Started</h2>
      <p style={p}>
        RIO Management helps you track <strong style={strong}>Risks</strong>, <strong style={strong}>Issues</strong>, and <strong style={strong}>Opportunities</strong> for your programs, projects, and departments. The top navigation lets you switch between the main area (Risks, Issues, and Opportunities) and Help.
      </p>
      <p style={p}>
        Before you can work with data, you must select your <strong style={strong}>scope</strong>: a Legal Entity and then a Program, Project, or Department (PPD). All records you view and edit are scoped to that PPD.
      </p>

      <h2 id="scope" style={h2}>2. Selecting Your Scope</h2>
      <p style={p}>
        At the top of the main area, use the <strong style={strong}>Scope</strong> section:
      </p>
      <ul style={ul}>
        <li style={li}>Choose a <strong style={strong}>Legal Entity</strong> from the dropdown.</li>
        <li style={li}>Then choose a <strong style={strong}>Program</strong>, <strong style={strong}>Project</strong>, or <strong style={strong}>Department</strong>.</li>
      </ul>
      <p style={p}>
        All registers and matrices show data only for the selected PPD. Change the selection anytime to switch context.
      </p>

      <hr style={hr} />

      <h2 id="risks" style={h2}>3. Risks</h2>
      <p style={p}>
        Risks are potential future problems. Each risk has a name, condition (what could go wrong), If/Then statements, likelihood, consequence, category, owner, and status.
      </p>

      <h3 style={h3}>3.1 Risk Register</h3>
      <p style={p}>
        A table of all risks in your scope. Use filters (Category, Status) to narrow the list. Click column headers to sort.
      </p>
      <ul style={ul}>
        <li style={li}><strong style={strong}>Add a risk:</strong> Click “+ Add Risk” and fill in the required fields (Name, Condition, If, Then, Likelihood, Consequence).</li>
        <li style={li}><strong style={strong}>Open a risk:</strong> Click the risk name to open its detail view.</li>
      </ul>

      <h3 style={h3}>3.2 5×5 Risk Matrix</h3>
      <p style={p}>
        A visual grid showing risks by Likelihood (vertical) and Consequence (horizontal). Color indicates level: green (low), yellow (moderate), red (high). Click a risk to open it.
      </p>

      <h3 style={h3}>3.3 Risk Detail View</h3>
      <p style={p}>
        When you open a risk, you see:
      </p>
      <ul style={ul}>
        <li style={li}><strong style={strong}>Overview:</strong> Edit name, condition, If/Then, category, likelihood, consequence, status, owner. When changing status to Closed, Accepted, or Realized, you must provide a rationale.</li>
        <li style={li}><strong style={strong}>Mitigation Steps:</strong> Add, edit, reorder, and complete mitigation steps. Each step tracks planned actions, closure criteria, expected and actual dates, and L×C.</li>
        <li style={li}><strong style={strong}>Waterfall:</strong> Visual timeline of risk level over time (planned vs. actual).</li>
        <li style={li}><strong style={strong}>Audit Log:</strong> History of all changes to the risk and its mitigation steps.</li>
      </ul>

      <h3 style={h3}>3.4 Realized Risks → Creating an Issue</h3>
      <p style={p}>
        When a risk actually happens, set its status to <strong style={strong}>Realized</strong> and provide a rationale. Then:
      </p>
      <ul style={ul}>
        <li style={li}>Click <strong style={strong}>“Create issue from this risk”</strong> in the Overview.</li>
        <li style={li}>A form opens with fields pre-filled from the risk (name, description from Condition/If/Then, owner, category, consequence). Edit as needed and click Create.</li>
        <li style={li}>The new issue is linked to the risk. You can jump between them via the links shown in each detail view.</li>
      </ul>

      <hr style={hr} />

      <h2 id="issues" style={h2}>4. Issues</h2>
      <p style={p}>
        Issues are problems that have already occurred. Each issue has a name, description, consequence (1–5), category, owner, and status. Issues use a 1×5 matrix (consequence only, since likelihood is fixed at 1).
      </p>

      <h3 style={h3}>4.1 Issue Register</h3>
      <p style={p}>
        A table of all issues. Filter by Category and Status. The Level column is color-coded: yellow for minimal (C1), red for higher consequence (C2–C5). Click a name to open the issue.
      </p>

      <h3 style={h3}>4.2 1×5 Issue Matrix</h3>
      <p style={p}>
        A single row of five cells (Consequence 1–5). Issues are placed by their consequence. Use “Show level (8, 16, 20, 23, 25)” if you want to see the numerical levels.
      </p>

      <h3 style={h3}>4.3 Issue Detail View</h3>
      <p style={p}>
        Tabs: Overview (edit fields), Resolution Plan, Waterfall, Audit Log.
      </p>
      <ul style={ul}>
        <li style={li}><strong style={strong}>Resolution Plan:</strong> Add steps to resolve the issue. Each step has a planned action, expected dates, and expected consequence. Mark steps complete with actual dates and consequence when done.</li>
        <li style={li}><strong style={strong}>Source risk:</strong> If the issue was created from a realized risk, a link to that risk appears in the Overview.</li>
      </ul>

      <hr style={hr} />

      <h2 id="opportunities" style={h2}>5. Opportunities</h2>
      <p style={p}>
        Opportunities are potential positive outcomes. Each has a name, condition, If/Then, likelihood, impact, category, owner, and status. Levels are shown as Good (light purple), Very Good (medium blue), and Excellent (light blue).
      </p>

      <h3 style={h3}>5.1 Opportunity Register</h3>
      <p style={p}>
        Table of all opportunities. Filter by Category and Status. Level badges use the same colors as the 5×5 matrix.
      </p>

      <h3 style={h3}>5.2 5×5 Opportunity Matrix</h3>
      <p style={p}>
        Visual grid by Likelihood and Impact. Colors: light purple (low), medium blue (moderate), light blue (high).
      </p>

      <h3 style={h3}>5.3 Opportunity Detail View</h3>
      <p style={p}>
        Tabs: Overview (edit fields), Action Plan, Waterfall, Audit Log.
      </p>
      <ul style={ul}>
        <li style={li}><strong style={strong}>Action Plan:</strong> Add steps to pursue the opportunity. Track planned actions, expected dates, and expected L×I. Mark steps complete with actual dates when done.</li>
      </ul>

      <hr style={hr} />

      <h2 id="filters" style={h2}>6. Filters</h2>
      <p style={p}>
        Filters appear when you’re viewing a register or matrix and no detail view is open. They apply to the current tab:
      </p>
      <ul style={ul}>
        <li style={li}><strong style={strong}>Risk filters:</strong> Category, Status (e.g. Open, Mitigating, Closed).</li>
        <li style={li}><strong style={strong}>Issue filters:</strong> Category, Status (Ignore, Control).</li>
        <li style={li}><strong style={strong}>Opportunity filters:</strong> Category, Status (Pursue now, Defer, Reevaluate, Reject).</li>
      </ul>

      <hr style={hr} />

      <h2 id="quick-ref" style={h2}>7. Quick Reference</h2>
      <div style={box}>
        <strong style={strong}>Registers</strong> — Lists you can sort and filter. Add items with “+ Add …”. Click a name to open the detail view.
      </div>
      <div style={box}>
        <strong style={strong}>Matrices</strong> — Visual grids. Click an item to open it. Color indicates severity/level.
      </div>
      <div style={box}>
        <strong style={strong}>Detail views</strong> — Use the colored badges (Risk / Issue / Opportunity) to see which type you’re viewing. Use ← Back to return to the register or matrix.
      </div>
      <div style={box}>
        <strong style={strong}>Audit logs</strong> — Available in each detail view. They record when items and steps were created, updated, or deleted and what changed.
      </div>
    </section>
  );
}
