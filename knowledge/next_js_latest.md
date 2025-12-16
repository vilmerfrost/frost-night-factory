### Rust Async Rules (2025): MUST Follow

**Use async Rust only for concurrency needs, not performance alone.** Async/await provides ergonomic concurrency (e.g., `select!`, timeouts, periodic tasks) but adds overhead and complexity; prefer sync code or threads for CPU-bound work without complex coordination[1][5].

**Drive futures externally via polling; ensure drop/cancel safety.** Futures must not block, self-progress, or require specific runtime context; use `tokio::time::timeout` for bounded execution[1][2].

**Leverage core tokio patterns: `select!`, `join!`, channels, intervals.** Express races, parallelism, and timeouts explicitly:
```
let mut tick = tokio::time::interval(Duration::from_millis(500));
loop {
    tokio::select! {
        _ = tick.tick() => { /* periodic */ }
        event = client.recv() => { /* handle */ }
    }
}
```
Avoid unbounded loops without cancellation checks[1][5][6].

**Handle task cancellation at every `.await`.** Tasks can drop mid-execution; spawn with handles (`JoinHandle`), use channels for results, and chunk work to allow polling independence[5].

**Prefer sync `Mutex` over async mutexes.** Use `std::sync::Mutex` inside async contexts unless holding across `.await`; async mutexes add executor overhead[5].

**Adopt 2025 async trait improvements; drop `async-trait` crate.** Use native `async fn` in traits with improved `async-fn-in-traits` support for dynamic dispatch (`dynosaur`-style); stabilizes async closures from 2024[3].

**Treat async as a library, not core architecture.** Core app sync + async for I/O (e.g., gRPC, networks); spawn selectively to avoid pervasive ref-counting or pinning issues[1][5].

**Avoid common pitfalls: no blocking, yield properly, pin-aware.** Use `Pin<Box<dyn Future>>` for custom futures; `std::task::yield_now()` for cooperation; test on single-threaded (embedded) and multi-threaded runtimes[1][4][5].

**Debug with runtime awareness (e.g., tokio::main).** Understand state machines, executors, and assembly-level polling; no GC/runtime dependency[2][8].