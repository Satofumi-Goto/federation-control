# Federation Surface Rule

## Runtime Federation OS

/runtime is the Runtime Federation OS.

Runtime is built in Grafana.

Runtime handles:
- Discovery
- Needs翻訳
- アライメント
- Queue propagation
- ODD constraint
- Collapse propagation
- Runtime synchronization
- KPI federation

---

## 4 Console Rule

The 4 operational consoles remain Base44 applications.

- Fleet Operations Console
- Service Hub Console
- Life Transaction Console
- Urban Operation Console

Base44 is the Operational UX implementation layer.

Operational consoles are NOT replaced by Grafana native applications.

---

## Federation Surface Rule

Row3 of /runtime must connect to Grafana Federation Surface dashboards.

The dashboards visualize:
- synchronization
- propagation
- KPI
- runtime state
- queue relation
- operational federation

These dashboards are NOT the operational consoles themselves.

---

## Forbidden

- Base44 direct login redirect
- Base44 preview URL exposure
- iframe-based operational runtime federation
- replacing operational consoles with Grafana native operational apps

---

## Architecture Separation

Grafana:
Federation OS / Federation Surface

Base44:
Operational UX / Runtime operation
