Here are **implementation rules you MUST follow** for **modern SQL work (2024/2025)**, focusing on SQL Server 2025 + general portable SQL where possible.

---

### 1. Target platform & versioning

- **If using SQL Server on-prem or IaaS, target SQL Server 2025 (17.x) or document down‑level constraints.**[1]  
- **Assume TDS 8.0 + TLS 1.3 by default in new deployments** and explicitly configure encryption options for any cross‑instance connectivity (linked servers, replication, log shipping).[1][2]

---

### 2. Breaking changes you MUST account for (SQL Server 2025)

1. **Linked servers / replication / log shipping**
   - Treat any upgrade to 2025 as **breaking for linked servers and replication** due to new encryption defaults.[2]  
   - For *every* linked server:
     - Explicitly configure `Encrypt`, `TrustServerCertificate`, and valid certificates in OLE DB / ODBC configuration.[2]  
   - For replication and log shipping topologies:
     - Validate and, if needed, re‑create endpoints with TLS 1.3–compatible certificates.
     - Test snapshot, transactional, peer‑to‑peer, and merge replication in a staging environment before upgrade.[2]  

2. **SSIS and legacy connectivity**
   - Do **not** depend on legacy SSIS providers and outdated APIs; SQL Server 2025 removes a list of older connections/APIs.[8]  
   - For ETL: standardize on **OLE DB 19+ / ODBC 18+** and modern connectors; mark any legacy DTS/old SSIS packages for rewrite.

---

### 3. New engine capabilities you SHOULD exploit

1. **Optimized locking for concurrency‑heavy workloads**
   - Design OLTP schemas assuming **Transaction ID (TID) locking + Lock After Qualification (LAQ)** is available on 2025.[1][4][5]  
   - You do *not* need app‑level changes to benefit, but:
     - Minimize unnecessary `SERIALIZABLE`/`HOLDLOCK` hints that can negate concurrency gains.
     - Prefer **short, set‑based transactions**; avoid chatty multi‑round‑trip transactions.

2. **Tempdb governance**
   - Assume **tempdb space resource governance** is active.[1]  
   - For heavy tempdb users (large sorts, hash joins, temp tables, version store):
     - Use targeted indexes to reduce spool/sort usage.
     - Avoid unbounded intermediate results (e.g., huge `SELECT INTO #t` without filters).

3. **Accelerated database recovery in tempdb**
   - You can safely use more temp tables in long‑running operations; rollback cost is mitigated by ADR even in `tempdb`.[1]  
   - Still keep transaction scopes tight; ADR is not a license for monolithic transactions.

4. **Persisted statistics on readable secondaries**
   - For **read‑scale AGs**, you may now plan read workloads on secondaries more aggressively because stats can be persisted.[1][5]  
   - Route *read‑only* queries explicitly to readable secondaries; assume plan stability comparable to primaries.

5. **Columnstore and batch mode improvements**
   - For analytic / HTAP workloads:
     - Prefer **columnstore** (clustered or nonclustered) for large fact tables; SQL 2025 improves compression, online build, shrink, and batch mode performance.[1][5]  
     - Avoid mixing wide `NVARCHAR(MAX)`/LOB with columnstore when possible; separate into side tables.

6. **Optional Parameter Plan Optimization (OPPO)**
   - For parameter‑sensitive queries, depend on **OPPO** instead of hand‑rolled `OPTION(RECOMPILE)`/plan guides where possible.[1][5]  
   - Do **not** force a single plan via hints for workloads with known parameter skew; let OPPO generate multiple plans keyed by parameter ranges.[5]  

---

### 4. AI / vector / JSON / text features (SQL Server 2025)

1. **Vector support**
   - For RAG / semantic search:
     - Use the **native vector data type** and **vector scalar functions** for storing and operating on embeddings.[1][4][5]  
     - Build **approximate vector indexes** and query via T‑SQL; manage them via `sys.vector_indexes`.[1]  
     - Always enable `PREVIEW_FEATURES` at DB scope to use vector indexes.[1]  

2. **External AI models**
   - For on‑DB inference orchestration:
     - Define **external AI model objects** for embedding tasks and REST AI endpoints.[1][4]  
     - Call external endpoints from T‑SQL using `sp_invoke_external_rest_endpoint` rather than ad‑hoc CLR or xp_cmdshell.[4]  

3. **JSON**
   - Use new **`JSON_OBJECTAGG`** and **`JSON_ARRAYAGG`** for server‑side JSON aggregation; avoid hand‑rolled string concatenation.[1]  
   - Leverage JSON types only as *integration edges*; keep core relational schema normalized.

4. **Fuzzy matching and regex**
   - For text cleanup and validation:
     - Use **fuzzy string matching** functions and **regular expression** functions introduced in 2025.[1]  
     - Enable `PREVIEW_FEATURES` if required by these functions.[1]  

5. **SUBSTRING behavior**
   - Do **not** rely on the old requirement for `length` in `SUBSTRING`; it is now **optional and defaults to remaining expression length**, aligning with ANSI.[1]  
   - Review old T‑SQL where omitted length could change behavior in non‑standard ways.

---

### 5. Security, connectivity, backup, and HA rules

1. **Encryption / TLS**
   - Design all new deployments assuming **TLS 1.3 + TDS 8.0** for server‑to‑server connections.[1]  
   - For any cross‑server feature (linked server, replication, log shipping):
     - Provision certificates compatible with TLS 1.3.
     - Explicitly configure encryption options (no reliance on driver defaults).[2]  

2. **Backups**
   - For compliance‑sensitive environments:
     - Use **immutable blob storage** for URL backups when regulatory requirements demand non‑modifiable backups.[1]  
   - For AGs:
     - Use **full and differential backups on any secondary replica**, not just copy‑only; adjust backup policies accordingly.[1]  

3. **Log shipping**
   - When configuring log shipping in 2025, **always configure TLS 1.3 on TDS 8.0** for all participating servers; treat plaintext or TLS < 1.3 as legacy only.[1]  

4. **RBAC / auditing / masking**
   - Where possible:
     - Implement **least privilege** using RBAC and built‑in auditing / data masking rather than custom security tables.[5]  

---

### 6. Change data, streaming, and CQRS‑friendly patterns

1. **Change event streaming**
   - For real‑time integrations:
     - Prefer **native real‑time change streaming** to Event Hubs / Kafka rather than polling‑based CDC consumers.[5]  
     - Ensure event contracts remain append‑only when possible to avoid schema evolution issues downstream.

2. **CQRS**
   - When designing CQRS:
     - Use **change streaming** to feed read models and keep write models normalized.[5]  
     - Place heavy analytical / reporting workloads on **columnstore + readable secondaries**, not on the primary OLTP path.[1][5]  

---

### 7. General performance and query‑writing rules (2024/2025 SQL)

- **Write portable ANSI SQL** unless you explicitly need SQL Server–only features (vector, regex, JSON aggregation, T‑SQL procedural logic).  
- **Always parameterize queries** from application code to allow OPPO and parameter‑sensitive plan features to work effectively.[1][5]  
- **Prefer set‑based operations**; avoid RBAR (row‑by‑agonizing‑row) cursor patterns except for truly sequential logic.  
- **Index strategy**:
  - Clustered index on a *narrow, stable, monotonically increasing* key for OLTP tables.
  - Nonclustered indexes tuned to key predicates; include columns to make critical queries covering.
  - Use columnstore on large, mostly‑append tables used for analytics or reporting.[1][5]  
- **Statistics & query store**:
  - Keep auto‑stats enabled and do not disable Query Store for important workloads; use Query Store for regression detection.

---

If you tell me which SQL platform(s) and language stack (e.g., .NET, Python, Go, Rust) you are co‑designing with, I can turn this into a cross‑stack ruleset (SQL + app‑layer) with concrete patterns and anti‑patterns.