// =============================================================================
// PORT MANAGER - Dynamic Port Allocation for Multiple Pipelines
// =============================================================================
import net from 'net';
export class PortManager {
    static usedPorts = new Set();
    /**
     * Find an available port in the range startPort-endPort
     */
    static async findAvailablePort(startPort = 3000, endPort = 3100) {
        for (let port = startPort; port <= endPort; port++) {
            if (this.usedPorts.has(port)) {
                continue;
            }
            const available = await this.isPortAvailable(port);
            if (available) {
                this.usedPorts.add(port);
                console.log(`   📡 Allocated port ${port}`);
                return port;
            }
        }
        throw new Error(`No available ports in range ${startPort}-${endPort}`);
    }
    /**
     * Check if a port is available
     */
    static isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', () => {
                resolve(false);
            });
            server.once('listening', () => {
                server.close();
                resolve(true);
            });
            server.listen(port);
        });
    }
    /**
     * Release a port back to the pool
     */
    static releasePort(port) {
        if (this.usedPorts.has(port)) {
            this.usedPorts.delete(port);
            console.log(`   ✅ Released port ${port}`);
        }
    }
    /**
     * Get all ports currently in use
     */
    static getUsedPorts() {
        return Array.from(this.usedPorts);
    }
    /**
     * Reserve a specific port (useful for known ports)
     */
    static reservePort(port) {
        this.usedPorts.add(port);
    }
}
