# Runtime Federation OS Architecture

## Runtime

Grafana acts as Runtime Federation OS.

Runtime contains:

* Discovery
* Needs翻訳
* アライメント
* Queue Federation
* Runtime KPI
* Collapse propagation
* Runtime synchronization

These are Runtime-native applications.

---

## Operational Console

Operational Consoles remain separate systems.

Base44 consoles are not replaced.

Reason:
Toyota / Denso already own operational systems.

Runtime federates existing operational runtimes rather than replacing them.

---

## Runtime Federation

Runtime Federation synchronizes:

* Queue
* ODD
* Constraint
* Energy
* Node
* Dispatch
* Need

across independent operational systems.

---

## Runtime Role

Runtime acts as:

* Federation OS
* Runtime synchronization layer
* Collapse propagation layer
* Cross-runtime KPI layer
* Responsibility alignment layer

Runtime is not a standalone operational app.

---

## Base44 Role

Base44 handles:

* Operational UX
* Runtime workflow
* dispatch operation
* queue operation
* modal interaction
* operational interaction

---

## Integration Rule

Runtime Workspace must make Base44 consoles appear federated inside Runtime.

Do not expose:

* preview URL feeling
* external app feeling
* app-launch dialog

---

## Canonical Rule

GitHub = Canonical
Grafana = Runtime Federation OS
Base44 = Operational Console
