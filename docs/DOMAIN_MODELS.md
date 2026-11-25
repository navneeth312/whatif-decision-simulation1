# WhatIf domain models and limits

WhatIf runs deterministic, local solvers over the scenario inputs. The demo networks and intervention costs are illustrative synthetic inputs; OpenStreetMap supplies geographic context only. OSM roads and building footprints are not water-main or power-line records. Solver outputs are conditional on the entered network, assumptions, units, and boundary conditions.

## Road traffic: Cell Transmission Model

The traffic solver advances vehicle density by cell and time step using a triangular fundamental diagram. For a cell with free-flow speed `v_f`, backward wave speed `w`, jam density `k_j`, and `n` lanes, per-lane capacity is `q_max = v_f w k_j / (v_f + w)`. Sending flow is `S = n min(v_f k, q_max)` and receiving flow is `R = n min(q_max, w(k_j - k))`. Each configured connection transfers `min(S_upstream, R_downstream, signal capacity)`; boundary inflow is limited by receiving capacity. Vehicle count changes by `ΔN = (inflow - outflow) Δt`, then density is recovered from cell length and lane count.

**Units:** length km, speed km/h, density vehicles/km/lane, flow vehicles/hour, time seconds, delay vehicle-hours. The solver checks the CFL condition `Δt <= Δx / max(v_f, w)`, vehicle count bounds, queue density, and configured speed limits.

**Assumptions and limits:** homogeneous traffic within each cell; fixed equal split across a cell's configured downstream links; configured signal green ratios stand in for signal operation; simplified boundary inflow; no lane changing, driver classes, route choice, origin-destination assignment, incidents, weather physics, or calibrated turn counts. Results are short-horizon scenario calculations, not forecasts until calibrated with local traffic counts and signal timing.

## Water distribution: steady-state Darcy-Weisbach

For each pipe, Darcy-Weisbach head loss is `h_f = f (L/D) (v²/(2g))`, with `v = |Q|/A`, `A = πD²/4`, and `Re = vD/ν = ρvD/μ`. The Darcy friction factor is `64/Re` when `Re < 2,000`, the turbulent Swamee-Jain approximation when `Re > 4,000`, and a smooth cubic blend through the transition range. For each trial nodal head difference, the solver inverts the head-loss relation for signed flow by bisection; a damped Newton solve enforces continuity at unknown-head nodes. Gauge pressure is `p = ρg(H - z)`.

**Units:** pipe length and hydraulic head m, diameter m, absolute roughness mm, flow m³/s, velocity m/s, pressure kPa, density kg/m³, dynamic viscosity Pa·s, gravity m/s², and friction gradient m/km. The default water inputs use `ρ = 1,000 kg/m³`, `μ = 1.002 × 10⁻³ Pa·s`, and `g = 9.81 m/s²`.

**Assumptions and limits:** incompressible steady-state flow; no minor losses, pump head curves, pressure-reducing-valve controls, tank level/storage dynamics, water-quality transport, or surge transients. Pump and valve nodes are ordinary demand junctions. A tank without a specified fixed head is also treated as an unknown-head junction. Legacy imported Hazen-Williams-only pipes are translated to approximate equivalent roughness at a 1 m/s reference velocity and are flagged; this translation is not a material survey. Built-in roughness and network values are synthetic calibration inputs, not surveyed VVITU or municipal data.

## Electrical energy: DC power flow

The solver balances scheduled real-power injections at each bus, identifies connected islands, chooses a reference bus per island, and solves the reduced susceptance system `Bθ = P`, where a line contributes `1/x` to the bus susceptance matrix. Active line flow is `P_ij = S_base(θ_i - θ_j)/x_ij`. It checks line thermal ratings and slack-generator limits. Where resistance is supplied, it estimates losses after the DC solve as `I_pu ≈ |P_pu|/pf`, `P_loss,pu = I_pu² r`, and `P_loss = S_base P_loss,pu`.

**Units:** real power and ratings MW, base power MVA, line reactance/resistance per unit, bus angle radians internally and degrees for display, and power factor dimensionless.

**Assumptions and limits:** balanced steady-state real-power approximation, small angle differences, nominal 1.0 p.u. voltage, and negligible resistance in the angle/flow solve. The loss estimate is post-processed, not a full AC solution. Reactive power, voltage magnitude, transformer taps, frequency response, protection, generator ramping/commitment, and transient stability are not solved. Built-in electrical assets are synthetic; no real utility topology or ratings are included.

## Shared validation and evidence

Scenario imports reject oversized JSON, prototype-pollution keys, non-finite numeric values, dangling links, and invalid domain dimensions. Calculated outputs come from the selected deterministic solver; optional AI can suggest scenario inputs but cannot supply calculated results. Historical costs, schedules, and location-specific values remain illustrative or explicitly unestimated unless the user provides verified data.

For real planning use, replace synthetic asset geometry, demands, material properties, equipment curves, ratings, boundary conditions, and thresholds with validated utility records; confirm them with the responsible engineers. The project is a prototype and does not replace hydraulic, traffic, or AC grid studies.
