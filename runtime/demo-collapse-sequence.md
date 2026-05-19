# Collapse Propagation Demo Sequence

## Federation Runtime Demo

### Step 1
Seneschal emits:
intent_created

### Step 2
Fleet receives demand runtime and emits:
dispatch_started

### Step 3
Fleet overload simulation emits:
queue_overflow

### Step 4
Urban constraint simulation emits:
odd_reduced

### Step 5
Node capacity simulation emits:
acceptance_delayed

### Step 6
Grafana visualizes:
- Collapse Timeline
- Federation Coverage
- Responsibility Runtime
- Runtime Health degradation

## Expected Runtime Narrative

Demand increase
→ Queue increase
→ ETA degradation
→ ODD reduction
→ Node wait increase
→ Revenue degradation
